/* O'Mono 3 — redaction planning and the rules that keep replaced values local.

   Redaction is offered before blocking wherever a safe redacted path exists, because a control
   that only ever says no gets switched off (Building O'Mono 3 §8.5).

   The replacement map is the only place a matched value ever exists outside the draft. It is
   encrypted, local, deletable, and never enters the ledger, a report, the curriculum export, a
   fixture, or a log (§12.1; Contracts §11, §14).

   Browser-safe: no CommonJS import, IIFE-scoped, dual export. The map is produced here as a pure
   value; palette/app/services/policy-service.js is what encrypts and stores it. */
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
    if (!v) throw new Error("shared/policy/vocabulary.js must load before redaction.js");
    return v;
  }

  const SCHEMA = "omono.redaction-plan.v3";
  const ACTIONS = ["token", "remove", "generalize", "keep"];

  /* A token names the kind of thing that was removed, so the destination model still has the
     shape of the sentence. It never encodes the value. */
  const TOKEN_PREFIX = {
    C3: "CONFIDENTIAL",
    C4: "CLIENT",
    C5: "FILING",
    C6: "PERSON",
    C7: "SECRET",
    C8: "SENSITIVE"
  };
  const KIND_PREFIX = {
    client: "CLIENT",
    matter_number: "MATTER",
    opposing_party: "PARTY",
    case_caption: "CAPTION",
    email: "EMAIL",
    phone: "PHONE",
    account: "ACCOUNT",
    national_id: "ID",
    date_of_birth: "DOB"
  };

  /* A class that arises from what the text is *about* cannot be redacted away. Removing the
     client's name from a memo about the client's matter leaves a memo about the client's
     matter. Saying otherwise would be the most dangerous kind of false comfort. */
  const CONTEXTUAL_CLASSES = ["C4", "C5"];

  function str(value) { return value == null ? "" : String(value); }
  function trimmed(value, max) { const s = str(value).trim(); return max ? s.slice(0, max) : s; }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function num(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

  function prefixFor(span) {
    const kind = trimmed(span && span.kind, 40).toLowerCase();
    if (KIND_PREFIX[kind]) return KIND_PREFIX[kind];
    const cls = V().normalizeClass(span && span.class);
    return TOKEN_PREFIX[cls] || "REDACTED";
  }

  /* One token per distinct value, so the same name reads as the same person throughout. */
  function planRedaction(spans, options) {
    const opts = options && typeof options === "object" ? options : {};
    const items = [];
    const assigned = new Map();
    const counters = {};
    const list = arr(spans).slice().sort(function (a, b) {
      return (num(a && a.start) || 0) - (num(b && b.start) || 0);
    });

    for (const raw of list) {
      const span = raw && typeof raw === "object" ? raw : {};
      const value = str(span.text);
      if (!value) continue;
      const key = value.toLowerCase();
      let token = assigned.get(key);
      if (!token) {
        const prefix = prefixFor(span);
        counters[prefix] = (counters[prefix] || 0) + 1;
        token = "[" + prefix + "_" + counters[prefix] + "]";
        assigned.set(key, token);
      }
      const requested = trimmed(span.action, 20).toLowerCase();
      const action = ACTIONS.indexOf(requested) > -1 ? requested
        : (V().normalizeClass(span.class) === "C7" ? "remove" : "token");
      items.push({
        span_id: trimmed(span.id, 64) || ("span_" + (items.length + 1)),
        start: num(span.start),
        end: num(span.end),
        length: value.length,
        class: V().normalizeClass(span.class) || null,
        kind: trimmed(span.kind, 40) || null,
        pattern_id: trimmed(span.pattern_id, 64) || null,
        source: trimmed(span.source, 40) || null,
        action: action,
        token: action === "keep" ? null : token
      });
    }

    return {
      schema: SCHEMA,
      created_for: trimmed(opts.transaction_id, 64) || null,
      items: items,
      /* Storage rules travel with the plan so no caller has to remember them. */
      storage: redactionMapEnvelope()
    };
  }

  /* Applies the plan and returns the redacted text plus the map. The map is the sensitive
     artefact; the caller encrypts it immediately and never puts it anywhere else. */
  function applyRedactionPlan(text, plan) {
    const original = str(text);
    if (!plan || plan.schema !== SCHEMA) throw new Error("Expected a " + SCHEMA + ".");
    const items = plan.items.slice().sort(function (a, b) { return (b.start || 0) - (a.start || 0); });
    let out = original;
    const map = [];
    const seen = new Set();
    let removed = 0;

    for (const item of items) {
      if (item.action === "keep") continue;
      const start = num(item.start);
      const end = num(item.end);
      if (start == null || end == null || start < 0 || end > out.length || end <= start) continue;
      const value = out.slice(start, end);
      const replacement = item.action === "remove" ? "" : (item.token || "");
      out = out.slice(0, start) + replacement + out.slice(end);
      removed++;
      if (item.action === "token" && item.token && !seen.has(item.token)) {
        seen.add(item.token);
        map.push({ token: item.token, value: value, class: item.class, kind: item.kind });
      }
    }

    return {
      text: out,
      /* Encrypted local storage only. There is no plaintext fallback and no export path. */
      map: { schema: "omono.redaction-map.v3", entries: map, storage: redactionMapEnvelope() },
      replaced: removed,
      /* Counts and classes are all the ledger ever sees. */
      summary: summarizePlan(plan)
    };
  }

  function restoreFromMap(text, map) {
    let out = str(text);
    const entries = map && Array.isArray(map.entries) ? map.entries : arr(map);
    const missing = [];
    for (const entry of entries) {
      const token = str(entry && entry.token);
      if (!token) continue;
      if (out.indexOf(token) === -1) { missing.push(token); continue; }
      out = out.split(token).join(str(entry.value));
    }
    const residual = out.match(/\[[A-Z]+_\d+\]/g) || [];
    return { text: out, missing: missing, residual_tokens: residual };
  }

  /* What the ledger and the curriculum are allowed to know about a redaction: that it
     happened, how many, and of what class. Never a value, never a token-to-value pair. */
  function summarizePlan(plan) {
    const byClass = {};
    let tokens = 0;
    let removals = 0;
    for (const item of (plan && plan.items) || []) {
      if (item.action === "keep") continue;
      if (item.action === "remove") removals++; else tokens++;
      const key = item.class || "unclassified";
      byClass[key] = (byClass[key] || 0) + 1;
    }
    return { tokens: tokens, removals: removals, by_class: byClass };
  }

  function redactionMapEnvelope() {
    return {
      encryption_required: true,
      plaintext_fallback: false,
      local_only: true,
      exportable: false,
      enters_ledger: false,
      enters_curriculum: false,
      deletable: true
    };
  }

  /* Is there a redacted version of this that would actually be safer?
     Yes when every flagged class comes from spans that can be replaced. No when a class comes
     from what the request is about rather than from a value inside it. */
  function safeRedactionPath(input) {
    const v = V();
    const source = input && typeof input === "object" ? input : {};
    const classes = v.normalizeClasses(source.classes);
    const contextual = v.normalizeClasses(source.contextual_classes);
    const spans = arr(source.spans);

    if (!classes.length) {
      return { available: false, reason: "nothing_to_redact", unresolvable: [] };
    }
    const spanClasses = {};
    for (const span of spans) {
      const c = v.normalizeClass(span && span.class);
      if (c) spanClasses[c] = true;
    }
    const unresolvable = classes.filter(function (c) {
      if (contextual.indexOf(c) > -1) return true;
      if (!spanClasses[c] && CONTEXTUAL_CLASSES.indexOf(c) > -1) return true;
      return !spanClasses[c];
    });
    if (unresolvable.length) {
      return {
        available: false,
        reason: "class_is_contextual",
        unresolvable: unresolvable,
        message: "Removing values would not change what this request is about: " +
          unresolvable.map(function (c) { return v.classPlain(c); }).join("; ") + "."
      };
    }
    return {
      available: true,
      reason: null,
      unresolvable: [],
      message: "A redacted version of this can go instead."
    };
  }

  /* The check that stops a value reaching somewhere it must never be. Given a map and any
     payload bound for the ledger, a report, the curriculum, a log, or a fixture, this throws
     if a replaced value appears in it. */
  function assertNoExactValues(payload, map) {
    const entries = map && Array.isArray(map.entries) ? map.entries : arr(map);
    if (!entries.length) return true;
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload == null ? null : payload);
    const leaked = [];
    for (const entry of entries) {
      const value = str(entry && entry.value);
      /* Short values produce false positives against ordinary words. The map is still the only
         place they live; this check is the belt on top of that. */
      if (value.length < 4) continue;
      if (serialized.indexOf(value) > -1) leaked.push(str(entry.token) || "(untokenized)");
    }
    if (leaked.length) {
      throw new Error("A redacted value reached an export or ledger payload (" + leaked.length +
        " of them). Replacement values stay in the encrypted local map and nowhere else.");
    }
    return true;
  }

  const Redaction = {
    SCHEMA, ACTIONS, TOKEN_PREFIX, KIND_PREFIX, CONTEXTUAL_CLASSES,
    planRedaction, applyRedactionPlan, restoreFromMap, summarizePlan,
    redactionMapEnvelope, safeRedactionPath, assertNoExactValues
  };

  const globalScope = (typeof globalThis !== "undefined") ? globalThis
    : (typeof window !== "undefined") ? window : null;
  if (globalScope) {
    if (!globalScope.OMonoPolicyModules) globalScope.OMonoPolicyModules = {};
    globalScope.OMonoPolicyModules.redaction = Redaction;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = Redaction;
  if (typeof window !== "undefined") window.OMonoPolicyRedaction = Redaction;
})();
