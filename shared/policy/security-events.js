/* O'Mono 3 — the two event streams, and the wall between them.

   A work/learning event carries no actor, user, device, email, hostname, or stable
   installation identity. A security/configuration event requires an authenticated actor. The
   two are stored separately and never joined, and the curriculum export never receives an
   actor id (Building O'Mono 3 §2.3, §12.1; Contracts §12, §13, §14).

   This module builds the security events that policy decisions produce, and it holds the
   assertions that keep identity out of the work stream. Persisting either stream belongs to
   WS04's evidence service; nothing here writes.

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
    if (!v) throw new Error("shared/policy/vocabulary.js must load before security-events.js");
    return v;
  }

  const SECURITY_SCHEMA = "omono.security-event.v3";
  const WORK_SCHEMA = "omono.work-event.v3";

  function str(value) { return value == null ? "" : String(value); }
  function trimmed(value, max) { const s = str(value).trim(); return max ? s.slice(0, max) : s; }
  function num(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

  /* `before` and `after` carry canonical non-content state only. A free-text field here is how
     a matter fact reaches an audit file, so anything that is not a scalar or a short list of
     scalars is refused rather than truncated. */
  function canonicalState(value, path) {
    if (value == null) return null;
    const type = typeof value;
    if (type === "string") {
      if (value.length > 200) {
        throw new Error("Security event state at " + (path || "root") +
          " is longer than a canonical value. Record an id, not content.");
      }
      return value;
    }
    if (type === "number" || type === "boolean") return value;
    if (Array.isArray(value)) {
      return value.slice(0, 50).map(function (item, i) { return canonicalState(item, (path || "") + "[" + i + "]"); });
    }
    if (type === "object") {
      const out = {};
      for (const key of Object.keys(value).sort()) {
        out[key] = canonicalState(value[key], (path ? path + "." : "") + key);
      }
      return out;
    }
    throw new Error("Security event state at " + (path || "root") + " is not canonical state.");
  }

  /* An identified event. Refuses to exist without an authenticated actor, because an
     unattributed security record is not an audit trail. */
  function buildSecurityEvent(input) {
    const v = V();
    const source = input && typeof input === "object" ? input : {};
    const actorId = trimmed(source.actor_id, 96);
    const eventType = trimmed(source.event_type, 40);
    const result = trimmed(source.result, 20);

    if (!actorId) {
      throw new Error("A security/configuration event requires an authenticated actor id.");
    }
    if (v.SECURITY_EVENT_TYPES.indexOf(eventType) === -1) {
      throw new Error("'" + eventType + "' is not a frozen security event type.");
    }
    if (v.SECURITY_EVENT_RESULTS.indexOf(result) === -1) {
      throw new Error("'" + result + "' is not a frozen security event result.");
    }
    const reason = trimmed(source.reason, 600) || null;
    if ((eventType === "creator_bypass" || eventType === "override") && result === "allowed" && !reason) {
      throw new Error("A granted bypass or override requires a recorded reason.");
    }
    return {
      schema: SECURITY_SCHEMA,
      event_id: trimmed(source.event_id, 64) || null,
      ts: num(source.ts),
      actor_id: actorId,
      event_type: eventType,
      before: canonicalState(source.before === undefined ? null : source.before, "before"),
      after: canonicalState(source.after === undefined ? null : source.after, "after"),
      reason: reason,
      result: result,
      engine_version: trimmed(source.engine_version, 40) || null
    };
  }

  /* Every protected change writes one of these, allowed or denied. */
  function protectedChangeEvent(input) {
    const v = V();
    const source = input && typeof input === "object" ? input : {};
    const change = trimmed(source.change, 40);
    if (!v.isProtectedChange(change)) {
      throw new Error("'" + change + "' is not a protected change.");
    }
    return buildSecurityEvent({
      event_id: source.event_id,
      ts: source.ts,
      actor_id: source.actor_id,
      event_type: v.securityEventTypeFor(change),
      before: source.before,
      after: source.after,
      reason: source.reason,
      result: source.result,
      engine_version: source.engine_version
    });
  }

  /* The bypass record the manual specifies: actor, time, classes, destination, reason, and
     every policy layer bypassed (Building O'Mono 3 §2.4). The original classification travels
     in `before`, which is what makes "the bypass does not rewrite the input as safe" true in
     the record and not only in the prose. */
  function bypassEventFromEffective(effective, meta) {
    const m = meta && typeof meta === "object" ? meta : {};
    if (!effective || !effective.override) throw new Error("Expected an effective policy object.");
    const kind = effective.override.kind;
    const eventType = kind === "creator_bypass" ? "creator_bypass" : "override";
    return buildSecurityEvent({
      event_id: m.event_id,
      ts: m.ts == null ? effective.ts : m.ts,
      actor_id: m.actor_id,
      event_type: eventType,
      before: {
        classes: effective.classification.original.classes || effective.classification.classes,
        subject: effective.classification.original.subject || effective.classification.subject,
        policy_result: effective.result,
        mode: effective.mode,
        posture: effective.posture.effective,
        destination_system: effective.destination.system_id,
        destination_model: effective.destination.model_id
      },
      after: {
        authorized: !!effective.override.granted,
        /* Unchanged on purpose. The classification after a bypass is the classification
           before it. */
        classes: effective.classification.classes,
        subject: effective.classification.subject,
        bypassed_layers: effective.override.bypassed_layers.map(function (b) {
          return b.layer + ":" + b.result + (b.basis ? ":" + b.basis : "");
        })
      },
      reason: effective.override.reason_recorded,
      result: effective.override.granted ? "allowed" : "denied",
      engine_version: m.engine_version
    });
  }

  /* ---------- the wall ----------
     A work event that carries identity is a privacy defect. This is the check, and it looks at
     nested objects too, because that is where an identifier actually turns up. */
  function assertWorkEventAnonymous(event) {
    const v = V();
    const forbidden = v.WORK_EVENT_FORBIDDEN_KEYS;
    const found = [];
    function walk(value, path) {
      if (value == null || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(function (item, i) { walk(item, path + "[" + i + "]"); });
        return;
      }
      for (const key of Object.keys(value)) {
        if (forbidden.indexOf(key.toLowerCase()) > -1) found.push((path ? path + "." : "") + key);
        walk(value[key], (path ? path + "." : "") + key);
      }
    }
    walk(event, "");
    if (found.length) {
      throw new Error("A work/learning event carried identity: " + found.join(", ") +
        ". Work events never carry an actor, user, device, email, hostname or installation id.");
    }
    if (event && event.schema && event.schema !== WORK_SCHEMA) {
      throw new Error("Expected a " + WORK_SCHEMA + " event.");
    }
    return true;
  }

  /* The curriculum export never receives an actor id, so a security event may not travel with
     one (Contracts §13, §14). */
  function assertExportFree(payload) {
    const found = [];
    function walk(value, path) {
      if (value == null || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(function (item, i) { walk(item, path + "[" + i + "]"); });
        return;
      }
      for (const key of Object.keys(value)) {
        const here = (path ? path + "." : "") + key;
        if (key === "actor_id") found.push(here);
        if (key === "schema" && value[key] === SECURITY_SCHEMA) found.push(here + "=" + SECURITY_SCHEMA);
        walk(value[key], here);
      }
    }
    walk(payload, "");
    if (found.length) {
      throw new Error("An export payload carried security-audit identity at " + found.join(", ") +
        ". The two streams are never joined.");
    }
    return true;
  }

  const SecurityEvents = {
    SECURITY_SCHEMA, WORK_SCHEMA,
    buildSecurityEvent, protectedChangeEvent, bypassEventFromEffective,
    assertWorkEventAnonymous, assertExportFree, canonicalState
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.securityEvents = SecurityEvents;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = SecurityEvents;
  if (typeof window !== "undefined") window.OMonoPolicySecurityEvents = SecurityEvents;
})();
