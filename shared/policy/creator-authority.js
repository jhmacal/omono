/* O'Mono 3 — creator and administrator authority.

   Creator authority exists in the signed local Personal and Enterprise Demo builds and nowhere
   else. A customer Managed Enterprise build carries no vendor creator credential, and there is
   no code path in it that could acquire one by switching mode (Building O'Mono 3 §2.4;
   Contracts §11).

   The decision to grant or refuse a bypass is not made here. It is made once, in
   shared/policy/effective-policy.js, and this module reads the result. Duplicating that logic
   is exactly how the interface and the engine come to disagree (bug B06).

   Nothing in this file, and nothing this file produces, contains or compares a password. The
   owner sets it locally; palette/app/services/auth-service.js verifies it in the main process.

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
    if (!m) throw new Error("shared/policy/" + file + " must load before creator-authority.js");
    return m;
  }
  function V() { return mod("vocabulary", "vocabulary.js"); }
  function SE() { return mod("securityEvents", "security-events.js"); }

  /* Command+Shift+M. Bare Command+M stays macOS Minimize and must not be taken over
     (Contracts §11, UI08). Configurable, but never down to the bare shortcut. */
  const DEFAULT_INVOCATION = {
    accelerator: "Command+Shift+M",
    electron_accelerator: "CommandOrControl+Shift+M",
    configurable: true,
    reserved: ["Command+M", "CommandOrControl+M"]
  };

  /* Elevated authority is temporary. It expires on inactivity and does not survive a restart. */
  const DEFAULT_ELEVATION_MS = 5 * 60 * 1000;

  const DIRECT_TRANSMISSION_WARNING =
    "You are about to send material that O'Mono classified as needing a stop. The original " +
    "classification stays on the record, this is written to the security audit with your name " +
    "and your reason, and it does not make the material safe. An authentication secret is never " +
    "released this way.";

  /* Fields whose presence in a shipped configuration would mean a vendor credential travelled
     into a customer build. */
  const CREATOR_CREDENTIAL_KEYS = [
    "creator_password", "creator_password_hash", "creator_hash", "creator_secret",
    "creator_credential", "creator_verifier", "vendor_password", "vendor_credential",
    "master_password", "backdoor"
  ];

  function str(value) { return value == null ? "" : String(value); }
  function trimmed(value, max) { const s = str(value).trim(); return max ? s.slice(0, max) : s; }
  function num(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

  /* What this build can do, decided by what was signed rather than by what mode is showing. */
  function creatorCapabilities(build) {
    const v = V();
    const channel = v.normalizeChannel(build && build.channel);
    const signed = build && build.signed === false ? false : true;
    const available = signed && v.CREATOR_CHANNELS.indexOf(channel) > -1;
    return {
      build_channel: channel,
      signed: signed,
      available: available,
      credential_present: available,
      /* The two things creator authority may and may not do. The second is not configurable. */
      may_bypass_policy_blocks: available,
      may_bypass_live_secret: false,
      requires_reauthentication: true,
      requires_direct_transmission_warning: true,
      requires_typed_reason: true,
      invocation: available ? {
        accelerator: DEFAULT_INVOCATION.accelerator,
        electron_accelerator: DEFAULT_INVOCATION.electron_accelerator
      } : null,
      reason: available ? null : (signed
        ? "This is a customer Managed Enterprise build. It contains no creator credential."
        : "This build is not signed, so creator authority is unavailable.")
    };
  }

  function assertInvocationAllowed(accelerator) {
    const value = trimmed(accelerator, 60);
    if (!value) throw new Error("A creator invocation shortcut is required.");
    const normalized = value.replace(/\s+/g, "");
    for (const reserved of DEFAULT_INVOCATION.reserved) {
      if (normalized.toLowerCase() === reserved.replace(/\s+/g, "").toLowerCase()) {
        throw new Error("Command+M is the macOS Minimize shortcut and cannot be taken over. " +
          "The default creator invocation is " + DEFAULT_INVOCATION.accelerator + ".");
      }
    }
    return value;
  }

  /* A customer build must not ship a creator credential in any configuration it carries. */
  function assertNoCreatorCredential(build, artifact) {
    const capabilities = creatorCapabilities(build);
    if (capabilities.available) return true;
    const found = [];
    function walk(value, path) {
      if (value == null || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(function (item, i) { walk(item, path + "[" + i + "]"); });
        return;
      }
      for (const key of Object.keys(value)) {
        const here = (path ? path + "." : "") + key;
        if (CREATOR_CREDENTIAL_KEYS.indexOf(key.toLowerCase()) > -1) found.push(here);
        walk(value[key], here);
      }
    }
    walk(artifact, "");
    if (found.length) {
      throw new Error("A customer Managed Enterprise build carried creator credential material at " +
        found.join(", ") + ". Customer builds contain no vendor creator credential.");
    }
    return true;
  }

  /* ---------- elevated session ----------
     Held by the caller; this module only says whether it is still good. The session carries no
     password and no verifier, only the fact that one was accepted and when. */
  function beginElevation(input) {
    const source = input && typeof input === "object" ? input : {};
    const now = num(source.now);
    if (now == null) throw new Error("An elevated session needs a timestamp.");
    if (!source.authenticated) throw new Error("An elevated session requires successful reauthentication.");
    const ttl = Math.max(30000, Math.min(3600000, num(source.ttl_ms) || DEFAULT_ELEVATION_MS));
    return {
      granted_at: now,
      expires_at: now + ttl,
      last_activity_at: now,
      ttl_ms: ttl,
      scope: trimmed(source.scope, 40) || "creator_override",
      actor_id: trimmed(source.actor_id, 96) || null
    };
  }

  function elevationValid(session, now) {
    const at = num(now);
    if (!session || typeof session !== "object" || at == null) return false;
    if (num(session.expires_at) == null) return false;
    if (at > session.expires_at) return false;
    const last = num(session.last_activity_at);
    if (last != null && at - last > session.ttl_ms) return false;
    return true;
  }

  function touchElevation(session, now) {
    if (!elevationValid(session, now)) return null;
    const next = JSON.parse(JSON.stringify(session));
    next.last_activity_at = num(now);
    next.expires_at = next.last_activity_at + next.ttl_ms;
    return next;
  }

  function endElevation() { return null; }

  /* ---------- reading a resolved decision ----------
     `effective` has already decided. This turns it into the sheet's state and the audit
     record, and it never contradicts it. */
  function bypassOutcome(effective) {
    if (!effective || !effective.override) throw new Error("Expected an effective policy object.");
    const override = effective.override;
    return {
      requested: override.requested,
      kind: override.kind,
      granted: override.granted,
      denied_reason: override.denied_reason,
      /* Preserved, always. A bypass authorizes continuation; it does not rewrite the input. */
      preserved_classification: {
        classes: effective.classification.classes.slice(),
        subject: effective.classification.subject,
        original: effective.classification.original
      },
      bypassed_layers: override.bypassed_layers.slice(),
      policy_result: effective.result,
      allowed: effective.allowed,
      warning_required: override.requested && !override.warning_acknowledged,
      warning: DIRECT_TRANSMISSION_WARNING,
      reason_required: override.denied_reason === "reason_required",
      reauthentication_required: override.denied_reason === "authentication_required" ||
        override.denied_reason === "elevation_expired",
      security_event_required: override.security_event_required
    };
  }

  /* Every attempt, allowed or denied, is an identified security event. */
  function bypassSecurityEvent(effective, meta) {
    return SE().bypassEventFromEffective(effective, meta);
  }

  const CreatorAuthority = {
    DEFAULT_INVOCATION, DEFAULT_ELEVATION_MS, DIRECT_TRANSMISSION_WARNING,
    CREATOR_CREDENTIAL_KEYS,
    creatorCapabilities, assertInvocationAllowed, assertNoCreatorCredential,
    beginElevation, elevationValid, touchElevation, endElevation,
    bypassOutcome, bypassSecurityEvent
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.creatorAuthority = CreatorAuthority;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = CreatorAuthority;
  if (typeof window !== "undefined") window.OMonoPolicyCreatorAuthority = CreatorAuthority;
})();
