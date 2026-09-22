/* O'Mono 3 — signed managed enterprise profile: validation and fail-closed behaviour.

   The managed profile is the only thing standing between an organization's rules and a user
   who would rather not have them. So it is signed, pinned to the organization, versioned
   monotonically, and validated before anything reads a value out of it. Every failure blocks
   Managed Mode and names the exact problem; none of them quietly becomes Personal Mode
   (Building O'Mono 3 §13.1, P06, B21; Contracts §10, §15).

   Browser-safe: no CommonJS import, no crypto here. Signature verification and digests are injected
   by palette/app/services/policy-service.js, which runs in the main process. */
(function () {
  "use strict";

  function ns() {
    const g = (typeof globalThis !== "undefined") ? globalThis
      : (typeof window !== "undefined") ? window : null;
    if (!g) return {};
    if (!g.OMonoPolicyModules) g.OMonoPolicyModules = {};
    return g.OMonoPolicyModules;
  }
  function V() {
    const v = ns().vocabulary;
    if (!v) throw new Error("shared/policy/vocabulary.js must load before managed-profile.js");
    return v;
  }

  const SCHEMA = "omono.managed-profile.v3";

  /* One supported schema. An unknown one is not "probably compatible"; it is refused (B04). */
  const SUPPORTED_SCHEMAS = [SCHEMA];

  const FAILURE_CODES = [
    "missing",
    "malformed",
    "unsupported_schema",
    "invalid_signature",
    "organization_mismatch",
    "expired",
    "rolled_back",
    "tampered"
  ];

  /* Grace is deliberately narrow. A profile that has merely run out of time, or one that has
     gone missing from disk, may fall back to the last known good copy if that copy said so.
     A bad signature, a tampered body, a rollback, or the wrong organization never does — those
     are the shapes an attack takes. */
  const GRACE_ELIGIBLE = ["missing", "expired"];

  const FAILURE_MESSAGE = {
    missing: "No managed profile is installed on this machine.",
    malformed: "The managed profile could not be read as a profile.",
    unsupported_schema: "The managed profile uses a schema this build does not read.",
    invalid_signature: "The managed profile's signature did not verify.",
    organization_mismatch: "The managed profile belongs to a different organization than this installation.",
    expired: "The managed profile has expired.",
    rolled_back: "The managed profile is older than the one this machine already accepted.",
    tampered: "The managed profile's contents do not match what was signed."
  };

  const RESULT_VALUES = ["pass", "notice", "confirm", "redact", "block"];
  const STALE_BEHAVIOURS = ["warn", "block"];

  function str(value) { return value == null ? "" : String(value); }
  function trimmed(value, max) { const s = str(value).trim(); return max ? s.slice(0, max) : s; }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function num(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }
  function bool(value) { return !!value; }

  /* Stable key order so a digest over this string means something. */
  function canonicalize(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value == null ? null : value);
    if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
    const keys = Object.keys(value).sort();
    return "{" + keys.map(function (k) {
      return JSON.stringify(k) + ":" + canonicalize(value[k]);
    }).join(",") + "}";
  }

  /* The signed body is everything except the signature block itself. */
  function signedBody(raw) {
    const copy = {};
    for (const key of Object.keys(raw || {})) {
      if (key === "signature") continue;
      copy[key] = raw[key];
    }
    return copy;
  }
  function canonicalProfileString(raw) { return canonicalize(signedBody(raw)); }

  function fail(code, detail) {
    return {
      valid: false,
      fail_closed: true,
      profile: null,
      grace: null,
      failure: {
        code: code,
        message: FAILURE_MESSAGE[code] || "The managed profile is not usable.",
        detail: detail == null ? null : trimmed(detail, 400)
      },
      managed_mode_available: false,
      requires_administrator_repair: true,
      /* Never a silent downgrade. Only an expressly permitted fallback, and only from a
         profile that verified. */
      fallback_to_personal: false
    };
  }

  function normalizeClassRules(raw) {
    const out = {};
    const source = raw && typeof raw === "object" ? raw : {};
    for (const key of Object.keys(source)) {
      const cls = V().normalizeClass(key);
      if (!cls) continue;
      const rule = source[key] && typeof source[key] === "object" ? source[key] : { result: source[key] };
      const result = RESULT_VALUES.indexOf(str(rule.result).toLowerCase()) > -1
        ? str(rule.result).toLowerCase() : null;
      out[cls] = {
        result: result,
        approved_destinations: arr(rule.approved_destinations).map(function (d) { return trimmed(d, 80); }).filter(Boolean),
        subjects: arr(rule.subjects).map(function (s) { return V().normalizeSubject(s); }),
        note_id: trimmed(rule.note_id, 64) || null
      };
    }
    return out;
  }

  function normalizeProfile(raw) {
    const r = raw && typeof raw === "object" ? raw : {};
    const v = V();
    return {
      schema: SCHEMA,
      profile_version: num(r.profile_version),
      organization: {
        id: trimmed(r.organization && r.organization.id, 120),
        name: trimmed(r.organization && r.organization.name, 200) || null
      },
      issued_at: num(r.issued_at),
      expires_at: num(r.expires_at),
      permitted_modes: arr(r.permitted_modes).map(function (m) { return v.normalizeMode(m); })
        .filter(function (m, i, list) { return list.indexOf(m) === i; }),
      posture_floor: r.posture_floor == null ? null : v.normalizePosture(r.posture_floor),
      posture_locked: bool(r.posture_locked),
      /* Self-relief is the Personal-Mode rule that the user's own information does not need
         confirmation. An organization has to opt in before it applies to managed work. */
      allow_self_relief: bool(r.allow_self_relief),
      /* Round two (R3): the admin-owned privacy declaration. Display and
         workflow gate only; classification records still write. */
      destinations_private: bool(r.destinations_private),
      /* R8: retained so an existing signed profile keeps parsing. It no longer
         decides anything: automatic passage is the default in every mode, and
         a firm that wants a queue sets lesson_review_mode instead. Filtering is
         opt-in, and its absence means everything clearing the gate passes. */
      lesson_auto_approve: bool(r.lesson_auto_approve),
      lesson_review_mode: bool(r.lesson_review_mode),
      class_rules: normalizeClassRules(r.class_rules),
      approved_destinations: arr(r.approved_destinations).map(function (d) {
        const entry = d && typeof d === "object" ? d : { system_id: d };
        return {
          system_id: trimmed(entry.system_id, 80),
          model_id: trimmed(entry.model_id, 120) || null,
          max_class: v.normalizeClass(entry.max_class) || null,
          approved_classes: v.normalizeClasses(entry.approved_classes),
          review_date: num(entry.review_date)
        };
      }).filter(function (d) { return !!d.system_id; }),
      destination_stale_behavior: STALE_BEHAVIOURS.indexOf(str(r.destination_stale_behavior).toLowerCase()) > -1
        ? str(r.destination_stale_behavior).toLowerCase() : "warn",
      overrides: {
        /* An enterprise administrator gets exactly the powers the signed profile grants.
           There is no vendor creator credential in a customer build, ever. */
        allow_admin_override: bool(r.overrides && r.overrides.allow_admin_override),
        require_reason: r.overrides && r.overrides.require_reason === false ? false : true,
        max_classes: v.normalizeClasses(r.overrides && r.overrides.max_classes)
      },
      reporting: {
        /* v3 never transmits. A cadence is a reminder, not an upload (E01, E02). */
        automatic_export: false,
        local_manual: true,
        reminder_hours: num(r.reporting && r.reporting.reminder_hours),
        grouping_dimension: trimmed(r.reporting && r.reporting.grouping_dimension, 60) || null,
        cohort_floor: Math.max(5, Math.floor(num(r.reporting && r.reporting.cohort_floor) || 5)),
        curriculum: bool(r.reporting && r.reporting.curriculum)
      },
      retention: {
        content_archive: bool(r.retention && r.retention.content_archive),
        ledger_days: num(r.retention && r.retention.ledger_days)
      },
      recovery: {
        allow_classes: v.normalizeClasses(r.recovery && r.recovery.allow_classes),
        allow_self: r.recovery && r.recovery.allow_self === false ? false : true
      },
      matter_screening: {
        required: bool(r.matter_screening && r.matter_screening.required),
        locked: bool(r.matter_screening && r.matter_screening.locked)
      },
      fallback: { allow_personal: bool(r.fallback && r.fallback.allow_personal) },
      grace: {
        allow_last_known_good: bool(r.grace && r.grace.allow_last_known_good),
        hours: Math.max(0, Math.floor(num(r.grace && r.grace.hours) || 0))
      }
    };
  }

  /* ---------- validation ----------
     context: { now, organization_id, last_known_version, last_known_good, verify }
     `verify` is injected: ({ canonical, signature, profile }) -> { ok, code?, detail? }.
     With no verifier the profile is unverifiable, and unverifiable fails closed. It never
     passes on the strength of "there was no way to check". */
  function validateManagedProfile(raw, context) {
    const ctx = context && typeof context === "object" ? context : {};
    const now = num(ctx.now);

    if (raw == null) return withGrace(fail("missing"), ctx, now);
    if (typeof raw !== "object" || Array.isArray(raw)) return fail("malformed", "not an object");
    if (SUPPORTED_SCHEMAS.indexOf(str(raw.schema)) === -1) {
      return fail("unsupported_schema", "schema=" + (trimmed(raw.schema, 80) || "(absent)"));
    }

    const version = num(raw.profile_version);
    if (version == null || !Number.isInteger(version) || version < 1) {
      return fail("malformed", "profile_version must be a whole number of 1 or more");
    }
    if (!trimmed(raw.organization && raw.organization.id, 120)) {
      return fail("malformed", "organization.id is required");
    }

    const signature = raw.signature && typeof raw.signature === "object" ? raw.signature : null;
    if (!signature || !trimmed(signature.value, 4096)) {
      return fail("invalid_signature", "the profile carries no signature");
    }
    const canonical = canonicalProfileString(raw);
    const verify = typeof ctx.verify === "function" ? ctx.verify : null;
    if (!verify) {
      return fail("invalid_signature",
        "no signature verifier is configured in this build, so the profile cannot be trusted");
    }
    const verdict = verify({ canonical: canonical, signature: signature, profile: raw }) || {};
    if (!verdict.ok) {
      const code = FAILURE_CODES.indexOf(str(verdict.code)) > -1 ? str(verdict.code) : "invalid_signature";
      return fail(code, verdict.detail);
    }

    const pinned = trimmed(ctx.organization_id, 120);
    if (pinned && pinned !== trimmed(raw.organization.id, 120)) {
      return fail("organization_mismatch",
        "installation is pinned to a different organization");
    }

    const lastVersion = num(ctx.last_known_version);
    if (lastVersion != null && version < lastVersion) {
      return fail("rolled_back", "installed version " + version + " is below accepted version " + lastVersion);
    }

    const expires = num(raw.expires_at);
    if (expires != null && now != null && now > expires) {
      return withGrace(fail("expired", "expired at " + expires), ctx, now);
    }

    return {
      valid: true,
      fail_closed: false,
      profile: normalizeProfile(raw),
      grace: null,
      failure: null,
      managed_mode_available: true,
      requires_administrator_repair: false,
      fallback_to_personal: false
    };
  }

  /* Last-known-good is only reachable from the two failure shapes that are not attacks, and
     only when the profile that is still trusted expressly allowed it, and only inside its own
     stated window. Anything else stays blocked. */
  function withGrace(failure, ctx, now) {
    const known = ctx.last_known_good;
    if (!known || GRACE_ELIGIBLE.indexOf(failure.failure.code) === -1) return failure;
    const normalized = known.schema === SCHEMA ? normalizeProfile(known) : null;
    if (!normalized || !normalized.grace.allow_last_known_good || normalized.grace.hours <= 0) return failure;
    const since = num(ctx.last_known_good_at);
    if (now == null || since == null) return failure;
    const elapsedHours = (now - since) / 3600000;
    if (elapsedHours < 0 || elapsedHours > normalized.grace.hours) return failure;
    return {
      valid: true,
      fail_closed: false,
      profile: normalized,
      grace: {
        active: true,
        because: failure.failure.code,
        message: failure.failure.message + " The last profile your administrator signed is still " +
          "being applied for a limited period.",
        expires_in_hours: Math.max(0, normalized.grace.hours - elapsedHours)
      },
      failure: failure.failure,
      managed_mode_available: true,
      requires_administrator_repair: true,
      fallback_to_personal: false
    };
  }

  /* What Managed Mode may do with this validation result. Personal fallback exists only when
     a profile that actually verified said so. */
  function managedModeAvailability(validation, requestedMode) {
    const v = V();
    const mode = v.normalizeMode(requestedMode);
    const result = validation && typeof validation === "object" ? validation : fail("missing");

    if (!result.valid) {
      return {
        mode: mode,
        available: false,
        blocked: true,
        reason: result.failure,
        requires_administrator_repair: true,
        fallback_to_personal: false,
        message: result.failure.message + " Managed Mode is blocked until an administrator repairs it."
      };
    }
    const permitted = result.profile.permitted_modes;
    if (permitted.length && permitted.indexOf(mode) === -1) {
      return {
        mode: mode,
        available: false,
        blocked: true,
        reason: { code: "mode_not_permitted", message: "Your organization's profile does not permit this mode." },
        requires_administrator_repair: false,
        fallback_to_personal: permitted.indexOf("personal") > -1 && result.profile.fallback.allow_personal,
        message: "Your organization's profile does not permit this mode."
      };
    }
    return {
      mode: mode,
      available: true,
      blocked: false,
      reason: null,
      requires_administrator_repair: !!result.grace,
      fallback_to_personal: result.profile.fallback.allow_personal,
      message: result.grace ? result.grace.message : null
    };
  }

  /* The managed layer's own contribution to the effective policy. Returns null when there is
     nothing for this class, so the caller can fall back to the posture matrix instead of
     inventing a managed rule that the profile never stated. */
  function managedRuleFor(profile, cls, subject) {
    if (!profile || typeof profile !== "object") return null;
    const v = V();
    const code = v.normalizeClass(cls);
    const rule = profile.class_rules && profile.class_rules[code];
    if (!rule || !rule.result) return null;
    if (rule.subjects && rule.subjects.length && rule.subjects.indexOf(v.normalizeSubject(subject)) === -1) {
      return null;
    }
    return {
      class: code,
      result: rule.result,
      approved_destinations: rule.approved_destinations.slice(),
      note_id: rule.note_id
    };
  }

  function destinationApproval(profile, destination) {
    if (!profile) return null;
    const v = V();
    const system = trimmed(destination && destination.system_id, 80);
    const model = trimmed(destination && destination.model_id, 120);
    if (!system) return { approved: false, row: null, reason: "no_destination" };
    const row = profile.approved_destinations.find(function (d) {
      return d.system_id === system && (!d.model_id || !model || d.model_id === model);
    }) || null;
    if (!row) return { approved: false, row: null, reason: "not_in_register" };
    return {
      approved: true,
      row: row,
      reason: null,
      max_class: row.max_class,
      approved_classes: row.approved_classes.slice(),
      ceiling_rank: row.max_class ? v.CLASS_RANK[row.max_class] : null
    };
  }

  const ManagedProfile = {
    SCHEMA, SUPPORTED_SCHEMAS, FAILURE_CODES, FAILURE_MESSAGE, GRACE_ELIGIBLE,
    canonicalize, canonicalProfileString, signedBody, normalizeProfile,
    validateManagedProfile, managedModeAvailability, managedRuleFor, destinationApproval
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.managedProfile = ManagedProfile;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = ManagedProfile;
  if (typeof window !== "undefined") window.OMonoPolicyManagedProfile = ManagedProfile;
})();
