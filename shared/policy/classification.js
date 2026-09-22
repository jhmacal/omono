/* O'Mono 3 — classification record, corrections, and secret review.

   Three things happen to a classification: the machine finds something locally, the model
   says something about it, and the person disagrees. All three have to survive. A correction
   that erased the original finding would destroy the only evidence that the classifier was
   wrong, which is the evidence the pilot exists to collect (Building O'Mono 3 §8.5, §16.2).

   This module never holds a matched value. It holds a pattern id and, at most, a mask the
   caller already produced. Exact values live in the encrypted local redaction map and
   nowhere else. */
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
    if (!v) throw new Error("shared/policy/vocabulary.js must load before classification.js");
    return v;
  }

  const SCHEMA = "omono.classification.v3";

  /* Detection sources the stack has to be able to name (§8.3 item 1). */
  const SOURCES = ["local_screening", "model", "user"];

  const SECRET_REVIEW_STATES = ["unreviewed", "false_positive", "live_secret"];
  const SECRET_RESOLUTIONS = ["present", "redacted", "removed"];

  /* A field named like a value is how a secret ends up in a log. Reject it at the door. */
  const FORBIDDEN_SECRET_KEYS = ["value", "text", "secret", "token", "password", "key", "match"];

  function str(value) { return value == null ? "" : String(value); }
  function trimmed(value, max) {
    const s = str(value).trim();
    return max ? s.slice(0, max) : s;
  }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function clone(value) { return JSON.parse(JSON.stringify(value == null ? null : value)); }

  function assertNoRawSecret(entry) {
    for (const key of FORBIDDEN_SECRET_KEYS) {
      if (entry && Object.prototype.hasOwnProperty.call(entry, key)) {
        throw new Error(
          "A secret finding carried a '" + key + "' field. Policy records hold a pattern id and " +
          "a caller-supplied mask, never the matched value.");
      }
    }
  }

  function normalizeSecret(raw, index) {
    const r = raw && typeof raw === "object" ? raw : {};
    assertNoRawSecret(r);
    const review = r.review && typeof r.review === "object" ? r.review : {};
    const reviewState = SECRET_REVIEW_STATES.indexOf(str(review.state)) > -1
      ? str(review.state) : "unreviewed";
    const resolution = SECRET_RESOLUTIONS.indexOf(str(r.resolution)) > -1
      ? str(r.resolution) : "present";
    return {
      id: trimmed(r.id, 64) || ("secret_" + (index + 1)),
      pattern_id: trimmed(r.pattern_id, 64) || "unknown_pattern",
      /* Optional. The caller masks; this module never derives a mask from a value it does not
         hold, and never widens one it is given. */
      masked_preview: trimmed(r.masked_preview, 24) || null,
      looks_like_example: !!r.looks_like_example,
      review: {
        state: reviewState,
        actor_id: reviewState === "unreviewed" ? null : (trimmed(review.actor_id, 96) || null),
        reason: reviewState === "unreviewed" ? null : (trimmed(review.reason, 400) || null),
        ts: Number.isFinite(Number(review.ts)) ? Number(review.ts) : null
      },
      resolution: resolution
    };
  }

  function normalizeFinding(raw, source) {
    const r = raw && typeof raw === "object" ? raw : {};
    return {
      source: SOURCES.indexOf(source) > -1 ? source : "local_screening",
      classes: V().normalizeClasses(r.classes),
      subject: r.subject == null ? null : V().normalizeSubject(r.subject),
      reason: trimmed(r.reason, 600) || null,
      matter_hits: Math.max(0, Math.floor(Number(r.matter_hits) || 0)),
      present: !!r.present || arr(r.classes).length > 0 || r.subject != null
    };
  }

  /* ---------- the record ----------
     `classes` and `subject` are the *current* reading. `original` is what local screening and
     the model each said, kept verbatim. `corrections` is the audit of how the current reading
     got there. Nothing in this module ever deletes from `original` or `corrections`. */
  function createClassificationRecord(input) {
    const source = input && typeof input === "object" ? input : {};
    const local = normalizeFinding(source.local, "local_screening");
    const model = normalizeFinding(source.model, "model");
    const secrets = arr(source.secrets).map(normalizeSecret);

    const sources = {};
    for (const c of local.classes) sources[c] = ["local_screening"];
    for (const c of model.classes) {
      if (sources[c]) { if (sources[c].indexOf("model") === -1) sources[c].push("model"); }
      else sources[c] = ["model"];
    }
    /* A secret finding is a C7 finding. Local screening is the only thing that can stop the
       first transmission, so the local scan owns this class (Building O'Mono 3 B11). */
    if (secrets.length && !sources.C7) sources.C7 = ["local_screening"];

    const classes = V().normalizeClasses(
      local.classes.concat(model.classes).concat(secrets.length ? ["C7"] : []));

    const subject = resolveSubject(local.subject, model.subject);

    return {
      schema: SCHEMA,
      classes: classes,
      subject: subject.subject,
      subject_decided_by: subject.decided_by,
      sources: sources,
      secrets: secrets,
      original: { local: local, model: model, classes: classes.slice(), subject: subject.subject },
      corrections: []
    };
  }

  /* Local and model disagree more often than either is simply wrong. Disagreement resolves
     upward, and never to `self`: a wrong `self` reading is exactly bug B08. */
  function resolveSubject(localGuess, modelGuess) {
    const v = V();
    const l = localGuess == null ? null : v.normalizeSubject(localGuess);
    const m = modelGuess == null ? null : v.normalizeSubject(modelGuess);
    if (l == null && m == null) return { subject: "unknown", decided_by: "default" };
    if (l == null) return { subject: m, decided_by: "model" };
    if (m == null) return { subject: l, decided_by: "local_screening" };
    if (l === m) return { subject: l, decided_by: "both" };
    if (l === "unknown") return { subject: m, decided_by: "model" };
    if (m === "unknown") return { subject: l, decided_by: "local_screening" };
    /* Two confident and different readings. One of them says someone else is involved. */
    return { subject: "mixed", decided_by: "conflict_resolved_restrictively" };
  }

  /* ---------- corrections ----------
     Structured, reasoned, authenticated, and additive. */
  function applyCorrection(record, correction) {
    const rec = requireRecord(record);
    const c = correction && typeof correction === "object" ? correction : {};
    const reason = trimmed(c.reason, 600);
    const actorId = trimmed(c.actor_id, 96);

    if (!reason) {
      return denied(rec, "reason_required",
        "A classification correction needs a reason. The reason is the evidence.");
    }
    if (!c.authenticated) {
      return denied(rec, "authentication_required",
        "Correcting a classification is a protected change and needs reauthentication.");
    }

    const nextClasses = c.classes === undefined ? rec.classes.slice() : V().normalizeClasses(c.classes);
    const nextSubject = c.subject === undefined ? rec.subject : V().normalizeSubject(c.subject);

    /* A correction may not drop C7 while a secret finding is still unresolved. Clearing a
       credential is a reviewed act (reviewSecret) or a redaction, never a relabel. */
    const secretState = liveSecretState(rec);
    if (rec.classes.indexOf("C7") > -1 && nextClasses.indexOf("C7") === -1 && secretState.present) {
      return denied(rec, "secret_requires_review",
        "This still contains something shaped like a live credential. Have the match reviewed as " +
        "a false positive, or remove or redact the value. It cannot be relabelled away.");
    }

    const next = clone(rec);
    next.classes = nextClasses;
    next.subject = nextSubject;
    next.subject_decided_by = c.subject === undefined ? rec.subject_decided_by : "user";
    for (const cls of nextClasses) {
      if (!next.sources[cls]) next.sources[cls] = ["user"];
      else if (next.sources[cls].indexOf("user") === -1 && rec.classes.indexOf(cls) === -1) {
        next.sources[cls].push("user");
      }
    }
    next.corrections = rec.corrections.concat([{
      id: "correction_" + (rec.corrections.length + 1),
      actor_id: actorId || null,
      reason: reason,
      ts: Number.isFinite(Number(c.ts)) ? Number(c.ts) : null,
      previous: { classes: rec.classes.slice(), subject: rec.subject },
      next: { classes: nextClasses.slice(), subject: nextSubject }
    }]);
    return { applied: true, record: next, denied_reason: null };
  }

  function denied(record, code, message) {
    return { applied: false, record: record, denied_reason: { code: code, message: message } };
  }

  /* ---------- secret review ----------
     A false positive is common and must be correctable. An actual value is a hard stop that
     no role clears by asserting it is fine (Building O'Mono 3 D03, D08, §2.4). */
  function reviewSecret(record, review) {
    const rec = requireRecord(record);
    const r = review && typeof review === "object" ? review : {};
    const id = trimmed(r.secret_id, 64);
    const verdict = str(r.verdict);
    const reason = trimmed(r.reason, 600);

    const index = rec.secrets.findIndex(function (s) { return s.id === id; });
    if (index === -1) {
      return denied(rec, "unknown_secret", "There is no secret finding with that id.");
    }
    if (verdict !== "false_positive" && verdict !== "live_secret") {
      return denied(rec, "invalid_verdict", "A secret review is either false_positive or live_secret.");
    }
    if (!r.authenticated) {
      return denied(rec, "authentication_required",
        "Reviewing a credential match is a protected change and needs reauthentication.");
    }
    if (verdict === "false_positive" && !reason) {
      return denied(rec, "reason_required",
        "Clearing a credential match as a false positive needs a reason.");
    }

    const next = clone(rec);
    next.secrets[index].review = {
      state: verdict,
      actor_id: trimmed(r.actor_id, 96) || null,
      reason: reason || null,
      ts: Number.isFinite(Number(r.ts)) ? Number(r.ts) : null
    };
    if (!liveSecretState(next).present && next.classes.indexOf("C7") > -1) {
      /* The C7 reading is set aside, not erased: `original` still carries it and the review is
         on the record. */
      next.classes = next.classes.filter(function (c) { return c !== "C7"; });
    }
    return { applied: true, record: next, denied_reason: null };
  }

  /* Removing or redacting the value is the other way out, and the one the manual prefers
     when the match is real. */
  function resolveSecret(record, resolution) {
    const rec = requireRecord(record);
    const r = resolution && typeof resolution === "object" ? resolution : {};
    const id = trimmed(r.secret_id, 64);
    const state = str(r.resolution);
    const index = rec.secrets.findIndex(function (s) { return s.id === id; });
    if (index === -1) return denied(rec, "unknown_secret", "There is no secret finding with that id.");
    if (state !== "redacted" && state !== "removed") {
      return denied(rec, "invalid_resolution", "A secret is resolved by redacting or removing the value.");
    }
    const next = clone(rec);
    next.secrets[index].resolution = state;
    if (!liveSecretState(next).present && next.classes.indexOf("C7") > -1) {
      next.classes = next.classes.filter(function (c) { return c !== "C7"; });
    }
    return { applied: true, record: next, denied_reason: null };
  }

  /* Unreviewed counts as live. A match nobody has looked at is not evidence of safety. */
  function liveSecretState(record) {
    const rec = requireRecord(record);
    const unresolved = [];
    const confirmed = [];
    const cleared = [];
    for (const s of rec.secrets) {
      if (s.resolution === "redacted" || s.resolution === "removed") { cleared.push(s.id); continue; }
      if (s.review.state === "false_positive") { cleared.push(s.id); continue; }
      if (s.review.state === "live_secret") { confirmed.push(s.id); unresolved.push(s.id); continue; }
      unresolved.push(s.id);
    }
    return {
      present: unresolved.length > 0,
      unresolved: unresolved,
      confirmed: confirmed,
      cleared: cleared,
      /* Suggestion only. Nothing auto-clears on the strength of a heuristic. */
      review_suggested: rec.secrets
        .filter(function (s) { return s.looks_like_example && s.review.state === "unreviewed"; })
        .map(function (s) { return s.id; })
    };
  }

  function requireRecord(record) {
    if (!record || typeof record !== "object" || record.schema !== SCHEMA) {
      throw new Error("Expected a " + SCHEMA + " record.");
    }
    return record;
  }

  /* What the interface shows for the detection layer: what was found, and by whom. */
  function describeDetection(record) {
    const rec = requireRecord(record);
    const v = V();
    return rec.classes.map(function (c) {
      const src = rec.sources[c] || [];
      const by = src.length === 2 ? "local screening and the model"
        : src[0] === "model" ? "the model"
          : src[0] === "user" ? "you"
            : "local screening on this machine";
      return { class: c, plain: v.classPlain(c), detected_by: src.slice(), plain_source: by };
    });
  }

  const Classification = {
    SCHEMA, SOURCES, SECRET_REVIEW_STATES, SECRET_RESOLUTIONS,
    createClassificationRecord, resolveSubject, applyCorrection,
    reviewSecret, resolveSecret, liveSecretState, describeDetection
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.classification = Classification;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = Classification;
  if (typeof window !== "undefined") window.OMonoPolicyClassification = Classification;
})();
