/* O'Mono 3 — the effective policy object.

   Exactly one object is computed, and every screen renders from it. That is the whole point:
   bug B06 is the interface saying "allowed" while a layer underneath says no, and it happens
   whenever two places compute the same decision. There is one place, and it is here.

   Inputs are the twelve the frozen contract names (Contracts §10): local secret/matter
   finding, model classification, user correction, class, subject, mode, posture, destination
   capability and ceiling, managed rule, actor authority, override state, and the final result
   with its reason. Every one of them appears in `layers` so the interface can show the stack
   rather than a single banner (Building O'Mono 3 §8.3).

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
    if (!m) throw new Error("shared/policy/" + file + " must load before effective-policy.js");
    return m;
  }
  function V() { return mod("vocabulary", "vocabulary.js"); }
  function MP() { return mod("managedProfile", "managed-profile.js"); }
  function CL() { return mod("classification", "classification.js"); }

  const SCHEMA = "omono.effective-policy.v3";

  /* ---------- the class matrix ----------
     Read this as "what happens to material of this kind, about someone other than the user,
     at this posture, before any destination or managed rule is consulted".

     C7 is absent on purpose. A credential is not a posture question (Building O'Mono 3 §8.4
     final row, D03, D08). */
  const CLASS_MATRIX = {
    C1: { light: "pass",    intermediate: "pass",    strict: "pass" },
    C2: { light: "pass",    intermediate: "pass",    strict: "notice" },
    C3: { light: "notice",  intermediate: "redact",  strict: "block" },
    C4: { light: "confirm", intermediate: "redact",  strict: "block" },
    C5: { light: "notice",  intermediate: "confirm", strict: "block" },
    C6: { light: "confirm", intermediate: "redact",  strict: "block" },
    C8: { light: "confirm", intermediate: "redact",  strict: "block" }
  };

  /* What the subject axis does when the material is the user's own.
     C6 is *defined* as another person's regulated data, so your own is outside the class.
     Everything else caps at a notice: you can decide for yourself, and Personal Mode allows
     self-owned information without confirmation (D04, D05).

     This relief never applies to mixed or unknown, never to C7, and in Managed Enterprise only
     when the signed profile opted in. A self exception that leaked into mixed material is
     exactly bug B08. */
  const SELF_CAP = { C3: "notice", C4: "notice", C5: "notice", C6: "pass", C8: "notice" };

  function str(value) { return value == null ? "" : String(value); }
  function trimmed(value, max) { const s = str(value).trim(); return max ? s.slice(0, max) : s; }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function num(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

  function classResultFor(cls, subject, posture, selfReliefAllowed) {
    const v = V();
    const code = v.normalizeClass(cls);
    const row = CLASS_MATRIX[code];
    if (!row) {
      /* An unrecognised or unresolved class reads as unresolved, never as clean. */
      return { result: "confirm", basis: "unresolved_class" };
    }
    const candidates = v.subjectCandidates(subject);
    let worst = "pass";
    for (const candidate of candidates) {
      let result = row[posture];
      if (candidate === "self" && selfReliefAllowed && SELF_CAP[code]) {
        result = v.weaker(result, SELF_CAP[code]);
      }
      worst = v.stronger(worst, result);
    }
    const basis = candidates.length > 1 ? "most_restrictive_subject"
      : (candidates[0] === "self" && selfReliefAllowed && SELF_CAP[code]) ? "self_owned"
        : "posture";
    return { result: worst, basis: basis };
  }

  /* ---------- destination ---------- */
  function destinationLayer(destination, classes, mode, managedApplies, staleBehavior) {
    const v = V();
    const d = destination && typeof destination === "object" ? destination : null;
    /* Routing rules exist to control where flagged material goes. Public information and
       ordinary internal work do not acquire a destination problem simply because a register
       row is missing, so the register and ceiling checks only engage above C2. */
    const flagged = classes.some(function (c) { return v.CLASS_RANK[c] > 2; });
    if (!d || !trimmed(d.system_id, 80)) {
      return flagged
        ? { result: "confirm", basis: "no_destination_selected",
            why: "No destination has been chosen yet, so nothing can be approved for it." }
        : { result: "pass", basis: "no_destination_selected",
            why: "No destination has been chosen yet, and nothing here is flagged." };
    }
    const approvedClasses = v.normalizeClasses(d.approved_classes);
    const maxClass = v.normalizeClass(d.max_class);

    /* Credentials are never approvable for any destination, however the row is written. */
    if (classes.indexOf("C7") > -1) {
      return { result: "block", basis: "destination_never_receives_credentials",
        why: "No destination may receive an authentication secret." };
    }
    if (approvedClasses.length) {
      const refused = classes.filter(function (c) { return approvedClasses.indexOf(c) === -1; });
      if (refused.length) {
        return { result: "block", basis: "destination_class_not_approved",
          why: "This system is not approved for " + v.classPlain(refused[0]) + ".", classes: refused };
      }
    } else if (maxClass) {
      const ceiling = v.CLASS_RANK[maxClass];
      const over = classes.filter(function (c) { return v.CLASS_RANK[c] > ceiling; });
      if (over.length) {
        return { result: "block", basis: "destination_ceiling",
          why: "This system's ceiling is " + v.classPlain(maxClass) + ".", classes: over };
      }
    }

    if ((d.register_row === false || d.register_row == null) && flagged) {
      /* D10: warn and confirm in Personal, enforce in Managed. */
      return managedApplies
        ? { result: "block", basis: "destination_not_in_register",
            why: "Your organization keeps a register of which AI systems are approved for which " +
              "kinds of material. This system has no current entry in it." }
        : { result: "confirm", basis: "destination_not_in_register",
            why: "O'Mono keeps a register of which AI systems are approved for which kinds of " +
              "material. This system has no current entry, so what it may be sent is unknown." };
    }

    const stale = num(d.stale_days);
    if (stale != null && stale > 0) {
      const behaviour = managedApplies ? str(staleBehavior || "warn") : "warn";
      return behaviour === "block"
        ? { result: "block", basis: "register_row_stale",
            why: "This system's entry in the register of approved destinations is " + stale +
              " days out of date, and your organization's profile treats that as a change in " +
              "approval." }
        : { result: "notice", basis: "register_row_stale",
            why: "This system's entry in the register of approved destinations is " + stale +
              " days out of date." };
    }

    if (d.capability_ok === false) {
      return { result: "notice", basis: "destination_capability_gap",
        why: "This system does not have a capability this task depends on." };
    }
    return { result: "pass", basis: "destination_approved", why: "This system is approved for this material." };
  }

  /* ---------- the resolver ---------- */
  function resolveEffectivePolicy(input) {
    const v = V();
    const source = input && typeof input === "object" ? input : {};
    const now = num(source.now);

    const mode = v.normalizeMode(source.mode);
    const channel = v.normalizeChannel(source.build && source.build.channel);

    /* The classification record is the detection + model + correction history. A caller may
       instead pass plain classes/subject for a simple evaluation. */
    const record = source.classification && source.classification.schema === CL().SCHEMA
      ? source.classification : null;
    const classes = record ? record.classes.slice() : v.normalizeClasses(source.classes);
    const subject = record ? v.normalizeSubject(record.subject) : v.normalizeSubject(source.subject);
    const secretState = record ? CL().liveSecretState(record)
      : { present: !!(source.live_secret), unresolved: [], confirmed: [], cleared: [], review_suggested: [] };

    /* ---- managed layer applicability. This is the mode-leakage guard (B05). ----
       Personal Mode does not consult a managed profile at all, so it cannot run a hidden
       enterprise gate. Enterprise Demo consults one only when the caller marked it as a
       demonstration profile, so a demo can show managed behaviour without impersonating a
       managed customer deployment. */
    const managedInput = source.managed && typeof source.managed === "object" ? source.managed : null;
    const managedApplies = mode === "managed_enterprise"
      || (mode === "enterprise_demo" && !!(managedInput && managedInput.demo));
    const validation = managedApplies ? (managedInput && managedInput.validation) || null : null;
    const managedProfile = validation && validation.valid ? validation.profile : null;

    let managedModeBlocked = false;
    let managedFailure = null;
    if (mode === "managed_enterprise") {
      const availability = MP().managedModeAvailability(validation, mode);
      if (!availability.available) {
        managedModeBlocked = true;
        managedFailure = availability.reason;
      }
    }

    /* ---- posture: the stronger of the user's choice and the managed floor (P05) ---- */
    const userPosture = v.normalizePosture(source.posture);
    const floor = managedProfile && managedProfile.posture_floor ? managedProfile.posture_floor : null;
    const effectivePosture = floor ? v.strongerPosture(userPosture, floor) : userPosture;
    const postureLayer = {
      id: "posture",
      label: "Your posture",
      source: floor && effectivePosture === floor && v.POSTURE_RANK[userPosture] < v.POSTURE_RANK[floor]
        ? "managed_floor" : "user",
      user: userPosture,
      floor: floor,
      locked: !!(managedProfile && managedProfile.posture_locked),
      effective: effectivePosture,
      contributes: false,
      result: null,
      why: floor
        ? "Your setting is " + v.POSTURE_PLAIN[userPosture] + " and your organization's floor is " +
          v.POSTURE_PLAIN[floor] + ". The stronger of the two applies."
        : "Your setting is " + v.POSTURE_PLAIN[userPosture] + "."
    };

    const selfReliefAllowed = !managedApplies || !!(managedProfile && managedProfile.allow_self_relief);

    /* ---- detection layer ---- */
    const detection = record ? CL().describeDetection(record) : classes.map(function (c) {
      return { class: c, plain: v.classPlain(c), detected_by: ["local_screening"], plain_source: "local screening on this machine" };
    });
    const layers = [{
      id: "detection",
      label: "What O'Mono found",
      contributes: false,
      result: null,
      classes: detection,
      subject: subject,
      subject_plain: v.subjectPlain(subject),
      subject_decided_by: record ? record.subject_decided_by : "local_screening",
      corrections: record ? record.corrections.slice() : [],
      matter_hits: record ? record.original.local.matter_hits : 0,
      why: detection.length
        ? "Found: " + detection.map(function (d) { return d.plain; }).join("; ") + "."
        : "Nothing that needed classifying."
    }];

    /* ---- hard stop: a confirmed or unreviewed live secret ----
       Placed before every other layer because nothing below it can change the answer. */
    let hardStop = false;
    let hardStopReason = null;
    if (secretState.present || classes.indexOf("C7") > -1) {
      const unreviewed = secretState.present;
      hardStop = true;
      hardStopReason = unreviewed
        ? "credential_present"
        : "credential_declared";
      layers.push({
        id: "classification",
        label: "Authentication secret",
        contributes: true,
        result: "block",
        basis: "live_secret_hard_stop",
        classes: ["C7"],
        why: "This contains something shaped like a password, key or token. O'Mono does not " +
          "transmit an authentication secret, in any mode, under any authority. Remove or " +
          "redact the value, or have the match reviewed if it is not real.",
        waivable: false
      });
    }

    /* ---- classification layer: class x subject x posture ---- */
    const classDecisions = [];
    let classResult = "pass";
    for (const c of classes) {
      if (c === "C7") continue;
      const decision = classResultFor(c, subject, effectivePosture, selfReliefAllowed);
      classDecisions.push({
        class: c, plain: v.classPlain(c), result: decision.result, basis: decision.basis
      });
      classResult = v.stronger(classResult, decision.result);
    }
    if (!hardStop) {
      layers.push({
        id: "classification",
        label: "What this material is, and whose it is",
        contributes: true,
        result: classResult,
        basis: classDecisions.length ? "class_subject_posture" : "nothing_flagged",
        decisions: classDecisions,
        subject: subject,
        self_relief_applied: selfReliefAllowed && subject === "self" && classDecisions.some(function (d) {
          return d.basis === "self_owned";
        }),
        why: classDecisions.length
          ? classDecisions.map(function (d) {
              return d.plain + " at " + v.POSTURE_PLAIN[effectivePosture] + " posture: " + v.resultPlain(d.result).toLowerCase();
            }).join("; ") + "."
          : "Nothing here is classified above ordinary internal work."
      });
    }
    layers.push(postureLayer);

    /* ---- destination ---- */
    const staleBehaviour = managedProfile ? managedProfile.destination_stale_behavior : "warn";
    const dest = destinationLayer(source.destination, classes, mode, managedApplies, staleBehaviour);
    layers.push({
      id: "destination",
      label: "Where it would go",
      contributes: true,
      result: dest.result,
      basis: dest.basis,
      system_id: trimmed(source.destination && source.destination.system_id, 80) || null,
      model_id: trimmed(source.destination && source.destination.model_id, 120) || null,
      why: dest.why
    });

    /* ---- managed ---- */
    if (managedApplies) {
      if (managedModeBlocked) {
        layers.push({
          id: "managed",
          label: "Your organization's profile",
          contributes: true,
          result: "block",
          basis: "managed_profile_" + (managedFailure ? managedFailure.code : "missing"),
          requires_administrator_repair: true,
          why: (managedFailure ? managedFailure.message : "No managed profile is installed.") +
            " Managed Mode is blocked until an administrator repairs it."
        });
      } else {
        let managedResult = "pass";
        const managedDecisions = [];
        for (const c of classes) {
          const rule = MP().managedRuleFor(managedProfile, c, subject);
          if (!rule) continue;
          managedDecisions.push(rule);
          managedResult = v.stronger(managedResult, rule.result);
        }
        const flaggedForManaged = classes.some(function (c) { return v.CLASS_RANK[c] > 2; });
        const approval = MP().destinationApproval(managedProfile, source.destination);
        if (approval && !approval.approved && flaggedForManaged) {
          managedResult = v.stronger(managedResult, "block");
        }
        layers.push({
          id: "managed",
          label: "Your organization's profile",
          contributes: true,
          result: managedResult,
          basis: managedDecisions.length ? "managed_class_rule"
            : (approval && !approval.approved && flaggedForManaged
                ? "managed_destination_not_approved" : "managed_default"),
          decisions: managedDecisions,
          grace: validation && validation.grace ? validation.grace : null,
          organization: managedProfile.organization.name || null,
          why: managedDecisions.length
            ? "Your organization sets a rule for this material."
            : (approval && !approval.approved && flaggedForManaged
                ? "This system is not on your organization's approved list."
                : "Your organization sets no additional rule for this material.")
        });
      }
    }

    /* ---- actor authority ----
       Personal Mode has no enterprise administrator, and a build that was not signed as a
       personal or demonstration build has no creator. Both are downgraded here rather than
       silently honoured, and the downgrade is visible. */
    let authority = v.normalizeAuthority(source.actor && source.actor.authority);
    const authorityNotes = [];
    if (authority === "enterprise_admin" && mode !== "managed_enterprise") {
      authority = "ordinary_user";
      authorityNotes.push("enterprise_admin_not_available_in_this_mode");
    }
    if (authority === "creator_demo" && v.CREATOR_CHANNELS.indexOf(channel) === -1) {
      authority = "ordinary_user";
      authorityNotes.push("creator_not_present_in_this_build");
    }
    const actorAuthenticated = !!(source.actor && source.actor.authenticated);
    layers.push({
      id: "authority",
      label: "Who is asking",
      contributes: false,
      result: null,
      authority: authority,
      authority_plain: v.AUTHORITY_PLAIN[authority],
      authenticated: actorAuthenticated,
      elevated: !!(source.actor && source.actor.elevated),
      notes: authorityNotes,
      why: authorityNotes.length
        ? "This installation does not carry that authority, so ordinary permissions apply."
        : "Acting as " + v.AUTHORITY_PLAIN[authority] + "."
    });

    /* ---- the result before any override ---- */
    let result = "pass";
    for (const layer of layers) {
      if (layer.contributes) result = v.stronger(result, layer.result);
    }
    if (managedModeBlocked) result = "block";

    const controlling = layers
      .filter(function (l) { return l.contributes && l.result === result; })
      .map(function (l) { return l.id; });

    /* ---- override ---- */
    const override = evaluateOverrideState({
      requested: source.override,
      result: result,
      hardStop: hardStop,
      managedModeBlocked: managedModeBlocked,
      authority: authority,
      authenticated: actorAuthenticated,
      elevated: !!(source.actor && source.actor.elevated),
      mode: mode,
      channel: channel,
      classes: classes,
      managedProfile: managedProfile,
      managedApplies: managedApplies,
      layers: layers
    });
    layers.push({
      id: "override",
      label: "Override",
      contributes: false,
      result: null,
      requested: override.requested,
      kind: override.kind,
      granted: override.granted,
      denied_reason: override.denied_reason,
      bypassed_layers: override.bypassed_layers,
      why: override.why
    });

    const confirmationGiven = !!(source.confirmation && source.confirmation.given);
    const redactionApplied = !!(source.redaction && source.redaction.applied);
    const safeRedactionAvailable = !!(source.redaction && source.redaction.safe_path_available);

    const effective = {
      schema: SCHEMA,
      ts: now,
      mode: mode,
      brand: v.modeBrand(mode),
      build_channel: channel,
      posture: {
        user: userPosture, floor: floor, effective: effectivePosture,
        locked: postureLayer.locked, source: postureLayer.source
      },
      /* The original reading, preserved through every correction and every override. */
      classification: {
        classes: classes.slice(),
        subject: subject,
        original: record ? record.original : { classes: classes.slice(), subject: subject },
        corrections: record ? record.corrections.slice() : [],
        secrets: {
          present: secretState.present,
          unresolved: secretState.unresolved.slice(),
          confirmed: secretState.confirmed.slice(),
          cleared: secretState.cleared.slice(),
          review_suggested: secretState.review_suggested.slice()
        }
      },
      destination: {
        system_id: trimmed(source.destination && source.destination.system_id, 80) || null,
        model_id: trimmed(source.destination && source.destination.model_id, 120) || null,
        result: dest.result,
        basis: dest.basis
      },
      managed: {
        applicable: managedApplies,
        valid: managedApplies ? !!(validation && validation.valid) : null,
        blocked: managedModeBlocked,
        failure: managedFailure,
        grace: validation && validation.grace ? validation.grace : null,
        organization: managedProfile ? (managedProfile.organization.name || null) : null
      },
      actor: {
        authority: authority,
        requested_authority: v.normalizeAuthority(source.actor && source.actor.authority),
        authenticated: actorAuthenticated,
        elevated: !!(source.actor && source.actor.elevated),
        notes: authorityNotes
      },
      override: override,
      layers: layers,
      hard_stop: hardStop,
      hard_stop_reason: hardStopReason,
      result: result,
      controlling_layers: controlling,
      reason: reasonFor(result, layers, controlling, hardStop),
      confirmation: { given: confirmationGiven },
      redaction: { applied: redactionApplied, safe_path_available: safeRedactionAvailable },
      requires: {
        confirmation: result === "confirm" && !confirmationGiven && !override.granted,
        redaction: result === "redact" && !redactionApplied && !override.granted,
        secret_review: hardStop,
        administrator_repair: managedModeBlocked,
        reauthentication: override.requested && !override.granted &&
          override.denied_reason === "authentication_required",
        typed_reason: override.requested && !override.granted &&
          override.denied_reason === "reason_required"
      },
      actions: [],
      allowed: false
    };

    effective.allowed = computeAllowed(effective);
    effective.actions = availableActions(effective);
    assertConsistent(effective);
    return effective;
  }

  /* The one formula. `allowed` is never set from anywhere else, and assertConsistent proves
     it still matches. */
  function computeAllowed(effective) {
    if (effective.hard_stop) return false;
    if (effective.managed.blocked) return false;
    const granted = !!(effective.override && effective.override.granted);
    switch (effective.result) {
      case "pass":
      case "notice":
        return true;
      case "confirm":
        return effective.confirmation.given || granted;
      case "redact":
        return effective.redaction.applied || granted;
      case "block":
        return granted;
      default:
        return false;
    }
  }

  /* An override authorizes continuation. It does not rewrite the input as safe, so nothing
     here touches `result`, `classification`, or the layers it bypassed — it records them. */
  function evaluateOverrideState(context) {
    const v = V();
    const requestRaw = context.requested;
    const requested = !!(requestRaw && requestRaw.requested);
    const kind = trimmed(requestRaw && requestRaw.kind, 40);
    const reason = trimmed(requestRaw && requestRaw.reason, 600);

    const blocking = context.layers
      .filter(function (l) { return l.contributes && v.RESULT_RANK[l.result] >= v.RESULT_RANK["confirm"]; })
      .map(function (l) { return { layer: l.id, result: l.result, basis: l.basis || null }; });

    const base = {
      requested: requested, kind: kind || null, granted: false, denied_reason: null,
      bypassed_layers: [], reason_recorded: null, warning_acknowledged: !!(requestRaw && requestRaw.warning_acknowledged),
      security_event_required: false,
      why: requested ? "" : "No override was requested."
    };
    if (!requested) return base;

    /* Nothing overrides a live credential. Not the creator, not an administrator, not in any
       mode (Building O'Mono 3 §2.4, D03; Contracts §11). */
    if (context.hardStop) {
      base.denied_reason = "live_secret_hard_stop";
      base.security_event_required = true;
      base.why = "An authentication secret cannot be released by any authority. Remove or " +
        "redact the value, or have the match reviewed.";
      return base;
    }
    if (context.managedModeBlocked) {
      base.denied_reason = "managed_profile_invalid";
      base.security_event_required = true;
      base.why = "Managed Mode is blocked by a profile problem. An administrator has to repair it.";
      return base;
    }
    if (!context.authenticated) {
      base.denied_reason = "authentication_required";
      base.why = "An override needs reauthentication.";
      return base;
    }

    if (kind === "creator_bypass") {
      /* U9: the mechanism is removed. A creator bypass is never granted,
         under any channel, authority, elevation or acknowledgement; the
         attempt still produces an identified security event. */
      base.denied_reason = "mechanism_removed";
      base.security_event_required = true;
      base.why = "The creator bypass mechanism was removed. Nothing overrides a classification.";
      return base;
    }

    if (kind === "admin_override") {
      if (!context.managedApplies || context.authority !== "enterprise_admin") {
        base.denied_reason = "admin_override_not_available";
        base.security_event_required = true;
        base.why = "There is no administrator authority in this mode.";
        return base;
      }
      const profile = context.managedProfile;
      if (!profile || !profile.overrides.allow_admin_override) {
        base.denied_reason = "override_not_permitted_by_profile";
        base.security_event_required = true;
        base.why = "Your organization's profile does not permit an administrator override.";
        return base;
      }
      const permitted = profile.overrides.max_classes;
      if (permitted.length) {
        const beyond = context.classes.filter(function (c) { return permitted.indexOf(c) === -1; });
        if (beyond.length) {
          base.denied_reason = "class_beyond_override_authority";
          base.security_event_required = true;
          base.why = "Your organization's profile does not permit an override for this material.";
          return base;
        }
      }
      if (profile.overrides.require_reason && !reason) {
        base.denied_reason = "reason_required";
        base.why = "Your organization requires a typed reason for an override.";
        return base;
      }
      base.granted = true;
      base.bypassed_layers = blocking;
      base.reason_recorded = reason || null;
      base.security_event_required = true;
      base.why = "An administrator authorized continuation under your organization's profile.";
      return base;
    }

    base.denied_reason = "unknown_override_kind";
    base.security_event_required = true;
    base.why = "That is not an override this build recognises.";
    return base;
  }

  function reasonFor(result, layers, controlling, hardStop) {
    if (hardStop) {
      return "This contains an authentication secret. O'Mono does not transmit one, in any mode.";
    }
    const controllingLayers = layers.filter(function (l) { return controlling.indexOf(l.id) > -1; });
    const why = controllingLayers.map(function (l) { return l.why; }).filter(Boolean);
    if (result === "pass") return "Nothing here needs a decision.";
    return why.join(" ");
  }

  /* §8.3 item 7: the available actions and what each one records. */
  function availableActions(effective) {
    const out = [];
    if (effective.hard_stop) {
      out.push({ id: "redact_secret", label_key: "action.redact_secret",
        records: "a work event noting that a redaction happened, never the value" });
      out.push({ id: "remove_secret", label_key: "action.remove_secret", records: "nothing beyond the work event" });
      out.push({ id: "review_secret", label_key: "action.review_false_positive",
        records: "an identified security event with your reason" });
      return out;
    }
    if (effective.managed.blocked) {
      out.push({ id: "contact_administrator", label_key: "action.contact_administrator", records: "nothing" });
      return out;
    }
    if (effective.requires.confirmation) {
      out.push({ id: "confirm", label_key: "action.confirm_and_continue",
        records: "the policy result on the work event, with no content" });
    }
    if (effective.requires.redaction || (effective.redaction.safe_path_available && effective.result === "block")) {
      out.push({ id: "redact", label_key: "action.redact_and_continue",
        records: "that a redaction happened; the replacement map stays encrypted on this machine" });
    }
    if (effective.result === "block" || effective.result === "redact" || effective.result === "confirm") {
      out.push({ id: "change_destination", label_key: "action.change_destination", records: "the destination on the work event" });
      out.push({ id: "correct_classification", label_key: "action.correct_classification",
        records: "your correction and its reason, alongside the original finding, which is kept" });
    }
    if (effective.result === "block" && !effective.override.granted) {
      if (effective.build_channel === "personal" || effective.build_channel === "enterprise_demo") {
        out.push({ id: "creator_override", label_key: "action.creator_override",
          records: "an identified security event with the actor, the reason, and every layer bypassed" });
      }
      if (effective.managed.applicable) {
        out.push({ id: "admin_override", label_key: "action.admin_override",
          records: "an identified security event with the actor, the reason, and every layer bypassed" });
      }
    }
    return out;
  }

  /* ---------- the anti-contradiction invariant ----------
     Called on every object this module produces, and available to the renderer and to tests.
     If this throws, the interface would have shown two different answers. */
  function assertConsistent(effective) {
    const v = V();
    if (!effective || effective.schema !== SCHEMA) throw new Error("Expected a " + SCHEMA + " object.");
    if (v.RESULTS.indexOf(effective.result) === -1) {
      throw new Error("Effective result '" + effective.result + "' is not in the frozen vocabulary.");
    }
    const recomputed = computeAllowed(effective);
    if (recomputed !== effective.allowed) {
      throw new Error("Contradictory policy state: allowed=" + effective.allowed +
        " but the result '" + effective.result + "' with the recorded confirmation, redaction and " +
        "override state gives " + recomputed + ".");
    }
    if (effective.hard_stop && (effective.allowed || effective.result !== "block")) {
      throw new Error("Contradictory policy state: a hard stop that does not block.");
    }
    if (effective.hard_stop && effective.override.granted) {
      throw new Error("Contradictory policy state: an override was granted over a hard stop.");
    }
    if (effective.managed.blocked && effective.allowed) {
      throw new Error("Contradictory policy state: managed mode is blocked but transmission is allowed.");
    }
    let maximum = "pass";
    for (const layer of effective.layers) {
      if (!layer.contributes) continue;
      if (v.RESULTS.indexOf(layer.result) === -1) {
        throw new Error("Layer '" + layer.id + "' carries result '" + layer.result + "', which is not in the vocabulary.");
      }
      maximum = v.stronger(maximum, layer.result);
    }
    if (maximum !== effective.result) {
      throw new Error("Contradictory policy state: the strongest layer says '" + maximum +
        "' but the effective result says '" + effective.result + "'.");
    }
    if (!effective.managed.applicable && effective.layers.some(function (l) { return l.id === "managed"; })) {
      throw new Error("Mode leakage: a managed layer appeared outside Managed Enterprise Mode.");
    }
    if (effective.mode === "personal" && effective.actor.authority === "enterprise_admin") {
      throw new Error("Mode leakage: enterprise administrator authority in Personal Mode.");
    }
    if (effective.override.granted) {
      const original = effective.classification.original;
      const originalClasses = V().normalizeClasses(original && original.classes);
      const currentClasses = V().normalizeClasses(effective.classification.classes);
      if (originalClasses.length && currentClasses.length < originalClasses.length &&
          effective.classification.corrections.length === 0) {
        throw new Error("An override rewrote the classification. A bypass authorizes " +
          "continuation; it does not make the input safe.");
      }
      if (!effective.override.bypassed_layers.length) {
        throw new Error("An override was granted without recording the layers it bypassed.");
      }
    }
    return true;
  }

  /* Everything the interface needs to show the stack, derived from the same object so the two
     can never disagree. */
  function explainEffectivePolicy(effective) {
    assertConsistent(effective);
    const v = V();
    return {
      layers: effective.layers.map(function (l) {
        return {
          id: l.id,
          label: l.label,
          result: l.result,
          result_plain: l.result ? v.resultPlain(l.result) : null,
          controlling: effective.controlling_layers.indexOf(l.id) > -1,
          plain: l.why
        };
      }),
      final: {
        result: effective.result,
        result_plain: v.resultPlain(effective.result),
        allowed: effective.allowed,
        why: effective.reason,
        overridden: !!effective.override.granted,
        override_note: effective.override.granted
          ? "Continued under " + v.AUTHORITY_PLAIN[effective.actor.authority] +
            ". The original classification stands and every bypassed layer was recorded."
          : null
      },
      actions: effective.actions.slice()
    };
  }

  const Effective = {
    SCHEMA, CLASS_MATRIX, SELF_CAP,
    resolveEffectivePolicy, assertConsistent, explainEffectivePolicy,
    computeAllowed, classResultFor
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.effectivePolicy = Effective;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = Effective;
  if (typeof window !== "undefined") window.OMonoPolicyEffective = Effective;
})();
