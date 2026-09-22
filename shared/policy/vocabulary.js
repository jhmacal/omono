/* O'Mono 3 — policy vocabulary.
   The single dictionary every other policy module reads. Nothing here decides anything; it
   only fixes the words and their order, because most policy defects are two files disagreeing
   about what "stronger" means.

   Browser-safe by contract (docs/INTERFACE-CONTRACTS-V3.md §2): no CommonJS import, body wrapped in
   an IIFE so two shared scripts loaded through <script src> cannot collide on a top-level
   const, and a dual export at the end. */
(function () {
  "use strict";

  /* ---------- C1-C8: the only canonical v3 class vocabulary ----------
     Legacy five-value labels are readable through shared/policy/migration.js and are never
     written by v3. The UI never shows a C code outside optional technical detail. */
  const CLASSES = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];

  const CLASS_PLAIN = {
    C1: "information that is already public",
    C2: "ordinary internal work",
    C3: "confidential material",
    C4: "client, matter, privileged or work-product material",
    C5: "court, filing or regulator submission material",
    C6: "another person's regulated personal data",
    C7: "a password, key, token or other authentication secret",
    C8: "health, immigration, financial or employment-sensitive information"
  };

  /* Rank is only used to describe a destination ceiling ("this system may receive up to C2").
     It is deliberately not the severity of a decision: C7 is the hardest bar in the product
     and it does not sit at the top of this list. */
  const CLASS_RANK = { C1: 1, C2: 2, C3: 3, C4: 4, C5: 5, C6: 6, C7: 7, C8: 8 };

  /* ---------- subject / ownership: a separate axis ----------
     Class answers what the information is. Subject answers whose rights or consent are
     implicated. mixed and unknown always take the more restrictive outcome; there is no
     self-only exception for mixed material. */
  const SUBJECTS = ["self", "client", "third_party", "mixed", "unknown"];

  const SUBJECT_PLAIN = {
    self: "about you",
    client: "about a client or a matter",
    third_party: "about someone else",
    mixed: "about you and about someone else",
    unknown: "we could not tell whose information this is"
  };

  /* The subjects a mixed or unknown reading has to be evaluated against. Evaluating the set
     and taking the worst result is what "most restrictive subject controls" means in code. */
  const SUBJECT_CANDIDATES = {
    self: ["self"],
    client: ["client"],
    third_party: ["third_party"],
    mixed: ["client", "third_party"],
    unknown: ["client", "third_party"]
  };

  /* ---------- posture ----------
     v2 called the middle setting "moderate". v3 calls it "intermediate" because the manual
     does; migration.js maps the old word. */
  const POSTURES = ["light", "intermediate", "strict"];
  const POSTURE_RANK = { light: 1, intermediate: 2, strict: 3 };
  const DEFAULT_POSTURE = "intermediate";

  const POSTURE_PLAIN = {
    light: "Light",
    intermediate: "Intermediate",
    strict: "Strict"
  };

  /* ---------- modes ----------
     Three separated experiences in one signed application. Enterprise Demo demonstrates
     managed behaviour and must never impersonate a managed customer deployment. */
  const MODES = ["personal", "managed_enterprise", "enterprise_demo"];

  const MODE_BRAND = {
    personal: "O'Mono",
    managed_enterprise: "O'Mono Enterprise",
    enterprise_demo: "O'Mono Enterprise Demo"
  };

  /* ---------- build channel ----------
     Distinct from mode. Mode is what the user chose; channel is what was signed and shipped.
     Creator authority is a property of the channel, which is why a customer managed build
     cannot acquire it by switching mode. */
  const BUILD_CHANNELS = ["personal", "enterprise_demo", "customer_managed_enterprise"];
  const CREATOR_CHANNELS = ["personal", "enterprise_demo"];

  /* ---------- actor authority ---------- */
  const AUTHORITIES = ["ordinary_user", "local_owner_admin", "creator_demo", "enterprise_admin"];

  const AUTHORITY_PLAIN = {
    ordinary_user: "you",
    local_owner_admin: "you, as the owner of this installation",
    creator_demo: "the creator account on this local or demonstration build",
    enterprise_admin: "an administrator for your organization"
  };

  /* ---------- effective result ----------
     Ordered by how much sensitive material can leave the machine, which is the only ordering
     the manual's own posture table supports: Light offers explicit confirmation for client
     material, Intermediate redacts it, Strict blocks it (Building O'Mono 3 §8.4, §8.5).
     Confirm therefore sits below redact: under confirm the original values are transmitted
     once the human accepts, under redact they are replaced first.

     The frozen contract lists the five values as a set, not as a ladder. This module is where
     the ladder is defined, so nothing else has to guess. */
  const RESULTS = ["pass", "notice", "confirm", "redact", "block"];
  const RESULT_RANK = { pass: 0, notice: 1, confirm: 2, redact: 3, block: 4 };

  const RESULT_PLAIN = {
    pass: "Allowed",
    notice: "Allowed, with something you should know",
    confirm: "Needs your explicit confirmation",
    redact: "Needs redaction before it can go",
    block: "Blocked"
  };

  /* ---------- protected changes ----------
     Each of these requires reauthentication and writes an identified security event. */
  const PROTECTED_CHANGES = [
    "mode",
    "strictness",
    "policy",
    "routing",
    "reporting",
    "retention",
    "managed_configuration",
    "creator_override"
  ];

  /* Contracts §13 freezes the event_type enum, so the mapping is stated once here rather than
     invented at each call site. Retention and managed configuration are policy edits; the
     reporting surface is the export configuration. */
  const PROTECTED_CHANGE_EVENT = {
    mode: "mode_change",
    strictness: "posture_change",
    policy: "policy_edit",
    routing: "policy_edit",
    reporting: "export_config_change",
    retention: "policy_edit",
    managed_configuration: "policy_edit",
    creator_override: "creator_bypass"
  };

  const SECURITY_EVENT_TYPES = [
    "mode_change", "posture_change", "policy_edit", "override",
    "creator_bypass", "tamper", "integrity_failure", "export_config_change"
  ];
  const SECURITY_EVENT_RESULTS = ["allowed", "denied", "failed"];

  /* A work event that carries any of these is a privacy defect, not a schema warning.
     shared/policy/security-events.js enforces it. */
  const WORK_EVENT_FORBIDDEN_KEYS = [
    "actor_id", "actor", "user", "user_id", "username", "device", "device_id",
    "email", "hostname", "host", "installation_id", "install_id", "machine_id",
    "serial", "account", "owner_id", "idea_hash"
  ];

  /* ---------- layer identity ----------
     The stack the interface has to be able to show, in the order the manual lists it
     (Building O'Mono 3 §8.3). */
  const LAYER_IDS = [
    "detection",
    "classification",
    "posture",
    "destination",
    "managed",
    "authority",
    "override"
  ];

  function str(value) { return value == null ? "" : String(value); }
  function lower(value) { return str(value).trim().toLowerCase(); }

  function normalizeClass(value) {
    const v = str(value).trim().toUpperCase();
    return CLASSES.indexOf(v) > -1 ? v : "";
  }
  function normalizeClasses(value) {
    const list = Array.isArray(value) ? value : (value == null ? [] : [value]);
    const out = [];
    for (const item of list) {
      const c = normalizeClass(item);
      if (c && out.indexOf(c) === -1) out.push(c);
    }
    out.sort(function (a, b) { return CLASS_RANK[a] - CLASS_RANK[b]; });
    return out;
  }
  function normalizeSubject(value) {
    const v = lower(value);
    return SUBJECTS.indexOf(v) > -1 ? v : "unknown";
  }
  function normalizePosture(value) {
    const v = lower(value);
    return POSTURES.indexOf(v) > -1 ? v : DEFAULT_POSTURE;
  }
  function normalizeMode(value) {
    const v = lower(value);
    return MODES.indexOf(v) > -1 ? v : "personal";
  }
  function normalizeChannel(value) {
    const v = lower(value);
    return BUILD_CHANNELS.indexOf(v) > -1 ? v : "customer_managed_enterprise";
  }
  function normalizeAuthority(value) {
    const v = lower(value);
    return AUTHORITIES.indexOf(v) > -1 ? v : "ordinary_user";
  }
  function normalizeResult(value) {
    const v = lower(value);
    return RESULTS.indexOf(v) > -1 ? v : "block";
  }

  /* The one comparison the whole product depends on. */
  function stronger(a, b) {
    const x = normalizeResult(a);
    const y = normalizeResult(b);
    return RESULT_RANK[x] >= RESULT_RANK[y] ? x : y;
  }
  function weaker(a, b) {
    const x = normalizeResult(a);
    const y = normalizeResult(b);
    return RESULT_RANK[x] <= RESULT_RANK[y] ? x : y;
  }
  function strongestResult(list) {
    let out = "pass";
    for (const item of (Array.isArray(list) ? list : [])) out = stronger(out, item);
    return out;
  }
  function strongerPosture(a, b) {
    const x = normalizePosture(a);
    const y = normalizePosture(b);
    return POSTURE_RANK[x] >= POSTURE_RANK[y] ? x : y;
  }

  function classPlain(value) {
    const c = normalizeClass(value);
    return c ? CLASS_PLAIN[c] : "material we could not classify";
  }
  function resultPlain(value) { return RESULT_PLAIN[normalizeResult(value)]; }
  function subjectPlain(value) { return SUBJECT_PLAIN[normalizeSubject(value)]; }
  function modeBrand(value) { return MODE_BRAND[normalizeMode(value)]; }

  function subjectCandidates(value) {
    return SUBJECT_CANDIDATES[normalizeSubject(value)].slice();
  }

  function isProtectedChange(value) {
    return PROTECTED_CHANGES.indexOf(lower(value)) > -1;
  }
  function securityEventTypeFor(change) {
    return PROTECTED_CHANGE_EVENT[lower(change)] || null;
  }

  const Vocabulary = {
    SCHEMA_VERSION: "omono.policy.v3",
    CLASSES, CLASS_PLAIN, CLASS_RANK,
    SUBJECTS, SUBJECT_PLAIN, SUBJECT_CANDIDATES,
    POSTURES, POSTURE_RANK, POSTURE_PLAIN, DEFAULT_POSTURE,
    MODES, MODE_BRAND,
    BUILD_CHANNELS, CREATOR_CHANNELS,
    AUTHORITIES, AUTHORITY_PLAIN,
    RESULTS, RESULT_RANK, RESULT_PLAIN,
    PROTECTED_CHANGES, PROTECTED_CHANGE_EVENT,
    SECURITY_EVENT_TYPES, SECURITY_EVENT_RESULTS,
    WORK_EVENT_FORBIDDEN_KEYS,
    LAYER_IDS,
    normalizeClass, normalizeClasses, normalizeSubject, normalizePosture,
    normalizeMode, normalizeChannel, normalizeAuthority, normalizeResult,
    stronger, weaker, strongestResult, strongerPosture,
    classPlain, resultPlain, subjectPlain, modeBrand, subjectCandidates,
    isProtectedChange, securityEventTypeFor
  };

  /* Shared modules reach each other through one namespace object rather than through require,
     because the renderer loads them as plain scripts. Dependants read the namespace inside
     their functions, never at load time, so <script src> order cannot silently break them. */
  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.vocabulary = Vocabulary;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = Vocabulary;
  if (typeof window !== "undefined") window.OMonoPolicyVocabulary = Vocabulary;
})();
