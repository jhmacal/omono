/* O'Mono 3 — recovery eligibility.

   Bug B09 is a prompt that proceeds and then silently cannot be restored. The fix is not more
   storage; it is telling the user the answer before generation, and deriving that answer from
   the same effective policy object the rest of the screen is built from.

   Encrypted or not at all. If secure local encryption is unavailable the session runs
   stateless; it never falls back to plaintext (Building O'Mono 3 §12.4, L04, L05, L07).

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
  function V() {
    const v = ns().vocabulary;
    if (!v) throw new Error("shared/policy/vocabulary.js must load before recovery.js");
    return v;
  }

  const SCHEMA = "omono.recovery-eligibility.v3";

  const REASONS = [
    "eligible",
    "encryption_unavailable",
    "live_secret",
    "user_declined",
    "managed_policy",
    "posture_strict",
    "managed_profile_blocked"
  ];

  const MESSAGE = {
    eligible: "This draft will be kept, encrypted, on this machine so you can come back to it.",
    encryption_unavailable:
      "Secure local storage is not available on this machine, so nothing is being saved. " +
      "You can still write and send this prompt; it will not be here after you close the window. " +
      "O'Mono does not fall back to storing it unencrypted.",
    live_secret:
      "This contains something shaped like a password, key or token, so it is not saved anywhere.",
    user_declined:
      "You have turned off keeping drafts, so this one is not being saved.",
    managed_policy:
      "Your organization's profile does not allow this kind of material to be kept for recovery, " +
      "so this draft is not being saved.",
    posture_strict:
      "At Strict posture, material about a client or another person is not kept for recovery, " +
      "so this draft is not being saved.",
    managed_profile_blocked:
      "Managed Mode is blocked by a profile problem, so nothing is being kept."
  };

  function str(value) { return value == null ? "" : String(value); }

  function decide(input) {
    const v = V();
    const source = input && typeof input === "object" ? input : {};
    const effective = source.effective && typeof source.effective === "object" ? source.effective : null;
    if (!effective) throw new Error("Recovery eligibility is derived from an effective policy object.");

    const encryptionAvailable = source.encryption_available !== false;
    const optIn = source.user_opt_in !== false;
    const classes = v.normalizeClasses(effective.classification.classes);
    const subject = v.normalizeSubject(effective.classification.subject);
    const flagged = classes.filter(function (c) { return v.CLASS_RANK[c] > 2; });
    const managedProfile = source.managed_profile && typeof source.managed_profile === "object"
      ? source.managed_profile : null;

    if (!encryptionAvailable) return result(false, "encryption_unavailable", { stateless: true });
    if (effective.hard_stop || effective.classification.secrets.present) {
      return result(false, "live_secret", {});
    }
    if (effective.managed.blocked) return result(false, "managed_profile_blocked", {});
    if (!optIn) return result(false, "user_declined", {});
    if (!flagged.length) return result(true, "eligible", {});

    /* Self-owned material restores with opt-in (L04). Mixed and unknown are not self. */
    if (subject === "self") {
      if (effective.managed.applicable && managedProfile && managedProfile.recovery.allow_self === false) {
        return result(false, "managed_policy", {});
      }
      return result(true, "eligible", {});
    }

    if (effective.managed.applicable) {
      const allowed = managedProfile ? v.normalizeClasses(managedProfile.recovery.allow_classes) : [];
      const refused = flagged.filter(function (c) { return allowed.indexOf(c) === -1; });
      if (refused.length) return result(false, "managed_policy", { refused_classes: refused });
      return result(true, "eligible", {});
    }

    if (effective.posture.effective === "strict") return result(false, "posture_strict", {});
    return result(true, "eligible", {});

    function result(eligible, reason, extra) {
      const out = {
        schema: SCHEMA,
        eligible: eligible,
        reason: reason,
        message: MESSAGE[reason],
        /* There is no third option. Encrypted, or not stored. */
        storage: eligible ? "encrypted_local" : "none",
        encryption_required: true,
        plaintext_fallback: false,
        stateless: !!(extra && extra.stateless),
        refused_classes: (extra && extra.refused_classes) || [],
        classes: classes.slice(),
        subject: subject,
        /* The whole point of the object: this is shown before generation, not discovered
           afterwards. */
        disclose_before_generation: true
      };
      return out;
    }
  }

  /* A prompt that proceeds while recovery is impossible must say so. This pairs the two
     objects so a caller cannot show one without the other. */
  function disclosureFor(effective, eligibility) {
    if (!eligibility || eligibility.schema !== SCHEMA) throw new Error("Expected a " + SCHEMA + ".");
    const proceeding = !!(effective && effective.allowed);
    return {
      show_before_generation: true,
      proceeding: proceeding,
      recoverable: eligibility.eligible,
      /* This is the sentence bug B09 asks for. */
      text: proceeding && !eligibility.eligible
        ? "This prompt can go ahead, and it will not be saved. " + eligibility.message
        : eligibility.message,
      stateless: eligibility.stateless
    };
  }

  /* A stored envelope that is not encrypted is a defect, not a degraded mode. */
  function assertEncryptedEnvelope(envelope) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("A recovery envelope is required.");
    }
    if (envelope.protection !== "safe_storage" && envelope.protection !== "keychain") {
      throw new Error("Recovery storage is encrypted only. There is no plaintext fallback.");
    }
    if (!envelope.payload) throw new Error("A recovery envelope carries an encrypted payload.");
    for (const key of ["text", "idea", "fields", "prompt"]) {
      if (Object.prototype.hasOwnProperty.call(envelope, key)) {
        throw new Error("A recovery envelope carried '" + key + "' outside the encrypted payload.");
      }
    }
    return true;
  }

  /* When encryption is unavailable the product keeps working, in memory, for this session. */
  function statelessSession(reason) {
    return {
      stateless: true,
      storage: "none",
      reason: str(reason) || "encryption_unavailable",
      message: MESSAGE.encryption_unavailable,
      /* Nothing to clear, which is the point. */
      clear: function () { return true; }
    };
  }

  const Recovery = {
    SCHEMA, REASONS, MESSAGE,
    evaluateRecovery: decide,
    disclosureFor, assertEncryptedEnvelope, statelessSession
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.recovery = Recovery;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = Recovery;
  if (typeof window !== "undefined") window.OMonoPolicyRecovery = Recovery;
})();
