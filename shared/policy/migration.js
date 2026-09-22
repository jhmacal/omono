/* O'Mono 3 — v2.17.1 read and migration adapters.

   Legacy classes, postures, subjects, levels, managed profiles, matter lists, recovery
   snapshots and ledger events are read through versioned adapters. The historical append-only
   ledger is never rewritten (Building O'Mono 3 §15.2, M02, B04).

   Two rules run through everything here:

   1. Nothing unknown is mapped silently. An unrecognised value comes back as unmapped with a
      reason, and the caller decides. Guessing is bug B04.
   2. Legacy five-value labels are readable and are never written. v3 writes C1-C8 only.

   Browser-safe: no CommonJS import, IIFE-scoped, dual export. */
(function () {
  "use strict";

  function ns() {
    const g = (typeof globalThis !== "undefined") ? globalThis
      : (typeof window !== "undefined") ? window : null;
    if (!g) return {};
    if (!g.OMonoPolicyModules) g.OMonoPolicyModules = {};
    return g.OMonoPolicyModules;
  }
  function mod(name, file) {
    const m = ns()[name];
    if (!m) throw new Error("shared/policy/" + file + " must load before migration.js");
    return m;
  }
  function V() { return mod("vocabulary", "vocabulary.js"); }
  function MS() { return mod("matterScreening", "matter-screening.js"); }

  const SOURCE_ENGINE = "2.17.1";
  const LEDGER_ACCESS = "read_only";

  /* ---------- classes ----------
     Two legacy generations. The pre-2.4.0 five-value list, and the 2.4.0+ c<N>_ identifiers.
     `personal_sensitive` is the one that cannot be resolved mechanically: it covered both C6
     and C8, which shared a posture row in v2 and do not share one in v3. It maps to the more
     protective of the two and is flagged for review rather than being quietly resolved. */
  const CLASS_MAP = {
    /* pre-2.4.0 five-value vocabulary */
    confidential:          { to: "C3" },
    client_privileged:     { to: "C4" },
    court_filing:          { to: "C5" },
    personal_sensitive:    { to: "C6", review_required: true,
      note: "v2 merged another person's regulated data with health, financial and employment " +
        "sensitive information. v3 separates them into C6 and C8, which no longer share a rule." },
    credentials:           { to: "C7" },
    /* 2.4.0 - 2.17.1 */
    c1_public:             { to: "C1" },
    c2_internal:           { to: "C2" },
    c3_confidential:       { to: "C3" },
    c4_client_privileged:  { to: "C4" },
    c5_court_filing:       { to: "C5" },
    c6_regulated_personal: { to: "C6" },
    c7_credentials:        { to: "C7" },
    c8_sensitive_personal: { to: "C8" },
    /* The engine's marker for "the model did not give a usable classification". It was never
       a class and does not become one. */
    unverified:            { to: null, unresolved: true,
      note: "v2 recorded that the classification could not be read. It is carried forward as " +
        "unresolved, never as clean." }
  };

  const POSTURE_MAP = { light: "light", moderate: "intermediate", strict: "strict" };

  const SUBJECT_MAP = { self: "self", client: "client", third_party: "third_party", unknown: "unknown" };

  /* v2 decided in log/pass/warn/block. v3 decides in pass/notice/confirm/redact/block.
     `log` was "recorded, nothing shown", which is a pass with an entry. */
  const LEVEL_MAP = { log: "pass", pass: "pass", warn: "notice", block: "block" };

  /* §9.2: R identifiers are reserved for rubric rules and legacy R2/R3/R6 map through an
     adapter. The policy-facing ones are listed here; the teaching-facing ones travel with
     WS02's rubric work and the master may relocate them. */
  const RUBRIC_ID_MAP = {
    R1_task: "TASK_UNDERSPECIFIED",
    R2_legal_role: "ROLE_POSTURE_MISMATCH",
    R3_verify: "VERIFICATION_INSTRUCTION_MISSING",
    R4_class: "DATA_CLASS_POLICY",
    R5_secrets: "CREDENTIAL_PRESENT",
    R6_register: "DESTINATION_NOT_APPROVED",
    R7_gate17: "DESTINATION_USE_NOT_PERMITTED",
    R8_gate18: "SOURCE_VERIFICATION_MISSING",
    R9_watch: "GOVERNANCE_SOURCE_STALE"
  };

  function str(value) { return value == null ? "" : String(value); }
  function lower(value) { return str(value).trim().toLowerCase(); }
  function trimmed(value, max) { const s = str(value).trim(); return max ? s.slice(0, max) : s; }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function num(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

  function migrateClass(value) {
    const key = lower(value);
    if (!key) return { from: str(value), to: null, mapped: false, reason: "empty" };
    const entry = CLASS_MAP[key];
    if (!entry) {
      return { from: key, to: null, mapped: false, reason: "unknown_legacy_class",
        note: "This build does not recognise that class, so nothing was assumed about it." };
    }
    return {
      from: key,
      to: entry.to,
      mapped: entry.to != null,
      unresolved: !!entry.unresolved,
      review_required: !!entry.review_required,
      reason: entry.to ? null : (entry.unresolved ? "unresolved_in_source" : "not_a_class"),
      note: entry.note || null
    };
  }

  function migrateClasses(values) {
    const results = arr(values).map(migrateClass);
    return {
      classes: V().normalizeClasses(results.map(function (r) { return r.to; })),
      details: results,
      unmapped: results.filter(function (r) { return !r.mapped; }),
      review_required: results.filter(function (r) { return r.review_required; })
    };
  }

  function migratePosture(value) {
    const key = lower(value);
    const to = POSTURE_MAP[key] || null;
    return { from: key, to: to, mapped: !!to, reason: to ? null : "unknown_legacy_posture" };
  }

  function migrateSubject(value) {
    const key = lower(value);
    const to = SUBJECT_MAP[key] || null;
    return { from: key, to: to, mapped: !!to, reason: to ? null : "unknown_legacy_subject" };
  }

  function migrateLevel(value) {
    const key = lower(value);
    const to = LEVEL_MAP[key] || null;
    return { from: key, to: to, mapped: !!to, reason: to ? null : "unknown_legacy_level" };
  }

  function migrateRubricId(value) {
    const key = trimmed(value, 40);
    const to = RUBRIC_ID_MAP[key] || null;
    return { from: key, to: to, mapped: !!to, reason: to ? null : "unknown_legacy_rubric_id" };
  }

  /* ---------- managed profile ----------
     A v2 profile was a plain JSON file with version 1 and no signature. v3 requires a signed,
     organization-pinned, monotonically versioned profile. So this does not produce a valid v3
     profile — it produces a candidate for an administrator to review and sign. Promoting an
     unsigned file to a trusted one would defeat the control it is being migrated into. */
  function migrateManagedProfileV1(raw) {
    const r = raw && typeof raw === "object" ? raw : null;
    if (!r) {
      return { migrated: false, reason: "missing", candidate: null, requires_signature: true, notes: [] };
    }
    if (num(r.version) !== 1) {
      return { migrated: false, reason: "unsupported_legacy_version", candidate: null,
        requires_signature: true, notes: ["v2 managed profiles are version 1. Version " +
          str(r.version) + " is not read by this adapter."] };
    }
    const notes = [];
    const posture = migratePosture(r.posture && r.posture.value);
    if (r.posture && !posture.mapped) notes.push("The legacy posture floor could not be read.");
    if (posture.from === "moderate") notes.push("The legacy 'moderate' floor is 'intermediate' in v3.");

    const reportingMode = lower(r.reporting && r.reporting.mode);
    if (reportingMode === "folder") {
      notes.push("v2 wrote reports on an interval. v3 never transmits or writes on a schedule; " +
        "the interval becomes a reminder and the administrator exports manually.");
    }
    if (r.matter_list && r.matter_list.path) {
      notes.push("A managed matter-list path was present. Local Matter Screening stays local and " +
        "encrypted in v3 and is never exported.");
    }
    if (r.role || r.practice_group) {
      notes.push("Role and practice group move to the reporting grouping dimension. Only one " +
        "grouping dimension is enabled per deployment in v3.");
    }

    const candidate = {
      schema: "omono.managed-profile.v3",
      /* Deliberately absent: signature. The administrator signs the reviewed candidate. */
      profile_version: 1,
      organization: { id: null, name: trimmed(r.organization, 200) || null },
      issued_at: null,
      expires_at: null,
      permitted_modes: ["managed_enterprise"],
      posture_floor: posture.to,
      posture_locked: !!(r.posture && r.posture.locked),
      allow_self_relief: false,
      class_rules: {},
      approved_destinations: arr(r.destinations && r.destinations.allow).map(function (id) {
        return { system_id: trimmed(id, 80), model_id: null, max_class: null, approved_classes: [] };
      }).filter(function (d) { return !!d.system_id; }),
      destination_stale_behavior: "warn",
      overrides: { allow_admin_override: false, require_reason: true, max_classes: [] },
      reporting: {
        automatic_export: false,
        local_manual: true,
        reminder_hours: num(r.reporting && r.reporting.interval_hours),
        grouping_dimension: r.practice_group ? "practice_group" : (r.role ? "role" : null),
        cohort_floor: 5,
        curriculum: !!(r.reporting && r.reporting.curriculum)
      },
      retention: { content_archive: false, ledger_days: null },
      recovery: { allow_classes: [], allow_self: true },
      matter_screening: { required: false, locked: !!(r.matter_list && r.matter_list.locked) },
      fallback: { allow_personal: false },
      grace: { allow_last_known_good: false, hours: 0 }
    };

    return {
      migrated: true,
      reason: null,
      candidate: candidate,
      /* Until this is signed and pinned, Managed Mode stays blocked. */
      requires_signature: true,
      requires_organization_id: true,
      valid_for_use: false,
      notes: notes
    };
  }

  /* ---------- matter list ----------
     v2 stored an encrypted array of {kind, value}. Carrying it forward is a read, and the
     result is configured only if the user actually had entries; an empty legacy file leaves the
     feature invisible, which is the v3 default. */
  function migrateMatterList(rows, options) {
    const opts = options && typeof options === "object" ? options : {};
    const entries = arr(rows).map(function (r) {
      return { kind: lower(r && r.kind) || "client", value: trimmed(r && r.value, 300) };
    }).filter(function (r) { return r.value.length >= 3; });

    if (!entries.length && !opts.force_configured) {
      return { migrated: true, config: MS().hiddenState(), entry_count: 0,
        note: "No legacy entries, so Local Matter Screening stays invisible until it is set up." };
    }
    return {
      migrated: true,
      config: MS().configure({ entries: entries, enabled: opts.enabled !== false,
        configured_at: num(opts.configured_at) }),
      entry_count: entries.length,
      note: null
    };
  }

  /* ---------- recovery ----------
     The snapshot survives. The O'M/O'Mode density state does not exist in v3 and is dropped
     rather than migrated (Contracts §18, §21). */
  function migrateRecoverySnapshot(state) {
    const s = state && typeof state === "object" ? state : null;
    if (!s) return { migrated: false, reason: "missing", state: null, dropped: [] };
    const dropped = [];
    const next = {};
    for (const key of Object.keys(s)) {
      if (key === "interpretation_mode") { dropped.push(key); continue; }
      next[key] = s[key];
    }
    const classes = migrateClasses(
      (s.interpretation && s.interpretation.data_flags && s.interpretation.data_flags.classes) || []);
    return {
      migrated: true,
      reason: null,
      state: next,
      dropped: dropped,
      classes: classes.classes,
      class_details: classes.details,
      note: dropped.length
        ? "The O'M/O'Mode interpretation density is removed in v3 and was dropped from this snapshot."
        : null
    };
  }

  /* ---------- ledger ----------
     Read only. This returns a v3-shaped *view* of a historical entry for display and counting.
     It is never written back, and nothing here mutates the source object. */
  function readLegacyWorkEvent(raw) {
    const r = raw && typeof raw === "object" ? raw : null;
    if (!r) return null;
    /* Field names are the ones `Engine.makeLedgerEntry` actually wrote in 2.17.1:
       `data_classes`, `data_subject`, `dest_system`, `dest_model`. The shorter
       aliases are kept as fallbacks so a hand-built or pre-2.4.0 record still
       reads. Reading only the aliases silently produced an unclassified event
       with no destination for every real entry on disk. */
    const classes = migrateClasses(r.data_classes || r.classes);
    /* Absent is not the same as unrecognized. Early 2.x entries predate
       `data_subject` and `posture` entirely, so they have nothing to map rather
       than something this build failed to read. Reporting both the same way made
       45 of 49 real entries look like migration failures. */
    const posture = fieldOrNotStored(r.posture, migratePosture, "posture");
    const subject = fieldOrNotStored(r.data_subject || r.subject, migrateSubject, "subject");
    const level = legacyPolicyLevel(r);
    const notStored = [posture, subject, level]
      .filter(function (m) { return m.not_stored; })
      .map(function (m) { return m.field; });

    const view = {
      schema: "omono.work-event.v3",
      source_schema: trimmed(r.schema, 60) || ("omono.legacy." + SOURCE_ENGINE),
      source_engine_version: trimmed(r.engine_version, 40) || null,
      event_id: trimmed(r.event_id || r.id, 64) || null,
      transaction_id: trimmed(r.transaction_id, 64) || null,
      ts: num(r.ts || r.at),
      classes: classes.classes,
      subject: subject.to,
      posture: posture.to,
      policy_result: level.to,
      destination: {
        system_id: trimmed(r.dest_system, 80) ||
          trimmed(r.destination && r.destination.system, 80) ||
          trimmed(r.system, 80) || null,
        model_id: trimmed(r.dest_model, 120) ||
          trimmed(r.destination && r.destination.model, 120) ||
          trimmed(r.model, 120) || null
      },
      /* v2 wrote the outcome on a separate `type:"outcome"` record keyed by `ref`,
         so a generation record on its own carries none. readLegacyLedger folds
         them back together; a lone record stays honestly unknown. */
      outcome: migrateOutcome(r.outcome).to,
      content_stored: false,
      /* v2's unsalted idea hash is treated as withheld personal data. It is not read forward
         and it never leaves the machine (Building O'Mono 3 §15.4, L03). */
      withheld: r.idea_hash != null ? ["idea_hash"] : [],
      migration: {
        access: LEDGER_ACCESS,
        unmapped: classes.unmapped.concat(
          posture.mapped || posture.not_stored ? [] : [posture],
          subject.mapped || subject.not_stored ? [] : [subject],
          level.mapped || level.not_stored ? [] : [level]),
        /* A field the source never carried. It is a real gap in what can be
           migrated, and it is reported, but it is not a value this build failed
           to read, and reporting it as one made every entry look broken. */
        not_stored: notStored,
        review_required: classes.review_required
      }
    };
    return view;
  }

  /* The v2.17.1 ledger holds six record types in one file. Only `generation` is a
     work event. `outcome` and `status` are amendments to one, and the rest are
     their own kinds. Reading every line as a work event turned 49 real generations
     into 127 malformed ones. A record with no `type` is still read as a work event
     so a hand-built or pre-2.4.0 entry keeps working. */
  const LEGACY_WORK_TYPE = "generation";
  const LEGACY_AMENDMENT_TYPES = ["outcome", "status"];
  const LEGACY_OTHER_TYPES = ["install", "upgrade", "posture", "watch", "report"];

  /* v2's outcome verdicts and v3's outcome vocabulary are the same three words,
     so the mapping is identity. It is written out rather than assumed, because a
     silent identity mapping is how a vocabulary drifts unnoticed. */
  const OUTCOME_MAP = { worked: "worked", partly: "partly", failed: "failed" };

  function migrateOutcome(value) {
    const key = lower(value);
    if (!key || key === "null" || key === "undefined") {
      return { from: null, to: "unknown", mapped: true, reason: null };
    }
    const to = OUTCOME_MAP[key] || null;
    return { from: key, to: to || "unknown", mapped: !!to,
      reason: to ? null : "unknown_legacy_outcome" };
  }

  /* v2 stored `data_classes`, `data_subject` and `posture` and computed the verdict
     from them at read time, so a generation record carries no level. The pre-2.4.0
     shape and the `verdict` object did carry one. `rubric` is deliberately not read:
     it is the prompt-quality rubric (pass/flag), a different vocabulary from the
     class-evaluation levels (log/pass/warn/block) this maps. */
  /* Absent reads as `not_stored`; present but unrecognized still reads as unmapped. */
  function fieldOrNotStored(value, migrate, field) {
    if (value == null || lower(value) === "") {
      return { from: null, to: null, mapped: false, not_stored: true, field: field,
        reason: "not_stored_in_source",
        note: "This 2.x entry predates the field. Nothing was assumed in its place." };
    }
    return Object.assign({ field: field }, migrate(value));
  }

  function legacyPolicyLevel(r) {
    const explicit = r.level ||
      (r.verdict && typeof r.verdict === "object" ? r.verdict.level : null);
    if (explicit) return Object.assign({ field: "policy_result" }, migrateLevel(explicit));
    return { from: null, to: null, mapped: false, not_stored: true, field: "policy_result",
      reason: "not_stored_in_source",
      note: "v2.17.1 computed the policy verdict when it displayed a row and never wrote it " +
        "to the ledger. It is not recoverable from history and is left unset rather than guessed." };
  }

  function readLegacyLedger(events) {
    const rows = arr(events);
    const views = [];
    const problems = [];
    const byId = new Map();
    const skipped = {};
    let amendments = 0;
    let unmatchedAmendments = 0;

    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const type = lower(raw.type);
      if (type && type !== LEGACY_WORK_TYPE) {
        /* Amendments are counted once, as amendments, in the fold below. Counting
           them here too would double-count every line in the file. */
        if (LEGACY_AMENDMENT_TYPES.indexOf(type) === -1) {
          skipped[type] = (skipped[type] || 0) + 1;
        }
        continue;
      }
      const view = readLegacyWorkEvent(raw);
      if (!view) continue;
      views.push(view);
      if (view.event_id) byId.set(view.event_id, view);
    }

    /* Fold the amendments back onto their generation, newest wins, exactly as
       `Engine.foldOutcomes` did in v2. */
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const type = lower(raw.type);
      if (LEGACY_AMENDMENT_TYPES.indexOf(type) === -1) continue;
      amendments += 1;
      const target = byId.get(trimmed(raw.ref, 64));
      if (!target) { unmatchedAmendments += 1; continue; }
      if (type === "outcome") {
        const ts = num(raw.ts);
        if (target._outcome_ts == null || ts == null || ts >= target._outcome_ts) {
          const mapped = migrateOutcome(raw.verdict);
          target.outcome = mapped.to;
          target._outcome_ts = ts;
          if (!mapped.mapped && mapped.from) target.migration.unmapped.push(mapped);
        }
      }
    }
    for (const view of views) delete view._outcome_ts;

    for (const view of views) {
      if (view.migration.unmapped.length || view.migration.review_required.length) {
        problems.push({ event_id: view.event_id, unmapped: view.migration.unmapped,
          review_required: view.migration.review_required });
      }
    }

    return {
      access: LEDGER_ACCESS,
      count: views.length,
      events: views,
      problems: problems,
      /* What was in the file but is not a work event, so a migration report can
         account for every line rather than quietly dropping most of them. */
      read: rows.length,
      skipped: skipped,
      amendments: amendments,
      unmatched_amendments: unmatchedAmendments
    };
  }

  /* The append-only chain is history. A migration that rewrote it would destroy the only thing
     that makes it evidence. This is the assertion the service calls before it writes anywhere
     near the legacy ledger. */
  function assertNoLedgerRewrite(operation) {
    const op = lower(operation && operation.mode ? operation.mode : operation);
    if (op !== "read" && op !== LEDGER_ACCESS) {
      throw new Error("The v2 append-only ledger is read-only. '" + op + "' would rewrite history.");
    }
    return true;
  }

  /* Features v2 had that v3 does not. The v3 surface carries no identifier from any of them —
     only this disposition list, so a migration can state that a legacy file on disk is
     deliberately left alone rather than silently ignored (Building O'Mono 3 §15.6, §9.4). */
  function removedLegacyFeatures() {
    return [
      {
        id: "legacy_matter_bundle",
        legacy_name: "Matter Packet",
        imported: false,
        removed_from_product: true,
        replacement: null,
        note: "Removed from O'Mono 3 with no replacement, and no matter-bundle feature succeeds " +
          "it. Existing files on disk are left untouched and are not read."
      },
      {
        id: "legacy_interpretation_density",
        legacy_name: "O'M / O'Mode",
        imported: false,
        removed_from_product: true,
        replacement: null,
        note: "One workflow with progressive disclosure replaces the two-density state. The " +
          "stored density is dropped from any snapshot that carried it."
      }
    ];
  }

  const Migration = {
    SOURCE_ENGINE, LEDGER_ACCESS,
    CLASS_MAP, POSTURE_MAP, SUBJECT_MAP, LEVEL_MAP, RUBRIC_ID_MAP, OUTCOME_MAP,
    LEGACY_WORK_TYPE, LEGACY_AMENDMENT_TYPES, LEGACY_OTHER_TYPES,
    migrateClass, migrateClasses, migratePosture, migrateSubject, migrateLevel, migrateRubricId,
    migrateOutcome,
    migrateManagedProfileV1, migrateMatterList, migrateRecoverySnapshot,
    readLegacyWorkEvent, readLegacyLedger, assertNoLedgerRewrite,
    removedLegacyFeatures
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.migration = Migration;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = Migration;
  if (typeof window !== "undefined") window.OMonoPolicyMigration = Migration;
})();
