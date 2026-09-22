/* O'Mono 3 — policy facade.

   Loads last. Collects the modules that registered themselves on the shared namespace and
   exposes them as one object, plus the one call most callers want.

   Renderer load order is POLICY_SCRIPT_ORDER, as plain <script src> tags with no bundler
   (Contracts §2). The main process gets the same modules through
   palette/app/services/policy-service.js.

   Browser-safe: no CommonJS import, IIFE-scoped, dual export. */
(function () {
  "use strict";

  /* Dependency order. Every module resolves its dependencies inside its functions rather than
     at load time, so this order is for clarity and for the renderer's script tags; it is not a
     trap waiting for someone to reorder it. */
  const POLICY_SCRIPT_ORDER = [
    "shared/policy/vocabulary.js",
    "shared/policy/classification.js",
    "shared/policy/managed-profile.js",
    "shared/policy/security-events.js",
    "shared/policy/redaction.js",
    "shared/policy/effective-policy.js",
    "shared/policy/creator-authority.js",
    "shared/policy/recovery.js",
    "shared/policy/matter-screening.js",
    "shared/policy/migration.js",
    "shared/policy/index.js"
  ];

  function ns() {
    const g = (typeof globalThis !== "undefined") ? globalThis
      : (typeof window !== "undefined") ? window : null;
    if (!g) return {};
    if (!g.OMonoPolicyModules) g.OMonoPolicyModules = {};
    return g.OMonoPolicyModules;
  }

  function modules() {
    const m = ns();
    const missing = [];
    for (const key of ["vocabulary", "classification", "managedProfile", "securityEvents",
      "redaction", "effectivePolicy", "creatorAuthority", "recovery", "matterScreening", "migration"]) {
      if (!m[key]) missing.push(key);
    }
    if (missing.length) {
      throw new Error("shared/policy is incomplete: " + missing.join(", ") +
        " did not load. Expected load order: " + POLICY_SCRIPT_ORDER.join(", "));
    }
    return m;
  }

  /* One call for the ordinary path: take what local screening and the model found, resolve the
     single effective policy object, and return everything the interface needs alongside it —
     all derived from that one object, so no two surfaces can disagree. */
  function evaluateRequest(input) {
    const m = modules();
    const source = input && typeof input === "object" ? input : {};

    const record = source.classification && source.classification.schema === m.classification.SCHEMA
      ? source.classification
      : m.classification.createClassificationRecord({
          local: source.local_finding,
          model: source.model_classification,
          secrets: source.secrets
        });

    const redactionPath = m.redaction.safeRedactionPath({
      classes: record.classes,
      contextual_classes: source.contextual_classes,
      spans: source.spans
    });

    const effective = m.effectivePolicy.resolveEffectivePolicy({
      now: source.now,
      mode: source.mode,
      posture: source.posture,
      build: source.build,
      classification: record,
      destination: source.destination,
      managed: source.managed,
      actor: source.actor,
      override: source.override,
      confirmation: source.confirmation,
      redaction: {
        applied: !!(source.redaction && source.redaction.applied),
        safe_path_available: redactionPath.available
      }
    });

    const recovery = m.recovery.evaluateRecovery({
      effective: effective,
      user_opt_in: source.recovery_opt_in,
      encryption_available: source.encryption_available,
      managed_profile: source.managed && source.managed.validation && source.managed.validation.profile
    });

    return {
      classification: record,
      effective: effective,
      explanation: m.effectivePolicy.explainEffectivePolicy(effective),
      redaction_path: redactionPath,
      recovery: recovery,
      recovery_disclosure: m.recovery.disclosureFor(effective, recovery),
      creator: m.creatorAuthority.creatorCapabilities(source.build)
    };
  }

  const OMonoPolicy = {
    SCHEMA_VERSION: "omono.policy.v3",
    POLICY_SCRIPT_ORDER: POLICY_SCRIPT_ORDER,
    evaluateRequest: evaluateRequest,
    get vocabulary() { return modules().vocabulary; },
    get classification() { return modules().classification; },
    get managedProfile() { return modules().managedProfile; },
    get securityEvents() { return modules().securityEvents; },
    get redaction() { return modules().redaction; },
    get effectivePolicy() { return modules().effectivePolicy; },
    get creatorAuthority() { return modules().creatorAuthority; },
    get recovery() { return modules().recovery; },
    get matterScreening() { return modules().matterScreening; },
    get migration() { return modules().migration; }
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.index = OMonoPolicy;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = OMonoPolicy;
  if (typeof window !== "undefined") window.OMonoPolicy = OMonoPolicy;
})();
