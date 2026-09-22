/* Browser boundary for the current desktop engine. The canonical API service
   still owns phase schemas, model seating, request assembly, retries and
   diagnostics. This adapter changes only transport, key lifetime and the
   personal browser's platform capabilities. */
(function () {
  "use strict";
  const R = window.OMonoBrowserRuntime;
  if (!R || !R.require || !R.bridge || !R.storage) throw new Error("O'Mono browser runtime is unavailable.");
  const Api = R.require("/app/services/api-service.js");
  const Engine = R.require("/shared/engine.js");
  const Policy = R.require("/shared/policy/index.js");
  Policy.POLICY_SCRIPT_ORDER.forEach(function (file) { R.require("/" + file); });
  const Register = R.require("/shared/register_snapshot.json");
  R.services = R.services || {};

  /* Owner decision, 2026-09-22. The key is kept on the device, the way the
     page he has used for months already kept it: a phone that forgets it on
     every reload means typing forty characters on a phone keyboard before
     every prompt, which means not using O'Mono at all.

     What that costs, stated plainly rather than in a comment only — the
     Settings text says the same: this is ordinary browser storage for this one
     site. It is not the Mac's Keychain and it is not encrypted. No other site
     can read it; anyone holding an unlocked phone effectively can. It is
     reachable through no bridge method and no runtime property, and it is
     never written into the record, a report or a carry file.

     `clear the key` removes it from the device, not merely from the page. */
  const KEY_STORE = "provider.key";
  function rememberedKey() {
    try {
      const held = R.storage.get(KEY_STORE, "");
      return typeof held === "string" && held ? held : null;
    } catch (error) { return null; }
  }
  let apiKey = rememberedKey();
  const active = new Map();
  const runs = new Map();
  let matterConfig = null;
  let lastClassification = null;
  const redactions = new Map();
  const phaseMethods = { interpret: "interpret", generate: "generate", sourceCheck: "source-check",
    fixResult: "fix-result", refresh: "refresh", curriculumPreview: "curriculum-preview" };
  const build = { channel: "personal", signed: false };
  const clone = function (value) { return value == null ? value : JSON.parse(JSON.stringify(value)); };

  function unavailable(label) {
    return { ok: false, applied: false, created: false, elevated: false, available: false,
      reason: "browser_unavailable", detail: label + " is unavailable in this personal browser version." };
  }
  function noKey() {
    return { ok: false, warnings: [], error: { state: "no_credential",
      headline: "Add your Anthropic API key.",
      next_step: "It stays on this device until you clear it.",
      repairable: false, detail: { phase: "", provider: "", model: "", response_id: "", stop_reason: "",
        schema_path: "", retry_status: "", technical: "" } } };
  }
  function cancelled() {
    return { ok: false, warnings: [], error: { state: "cancelled", headline: "Request cancelled.",
      next_step: "", repairable: false, detail: { phase: "", provider: "", model: "", response_id: "",
        stop_reason: "", schema_path: "", retry_status: "", technical: "" } } };
  }
  function clearKey() {
    for (const run of runs.values()) run.cancelled = true;
    for (const run of active.values()) { run.cancelled = true; run.abort(); }
    active.clear();
    apiKey = null;
    try { R.storage.remove(KEY_STORE); } catch (error) { /* already gone */ }
    return { ok: true, configured: false, storage: "device" };
  }
  function settings() {
    const held = R.storage.get("policy.browser.v1", {}) || {};
    return { schema: "omono.policy-settings.v3", mode: "personal",
      posture: Policy.vocabulary.normalizePosture(held.posture || Policy.vocabulary.DEFAULT_POSTURE),
      recovery_opt_in: false, first_use_disclosure_shown: held.first_use_disclosure_shown === true,
      creator_accelerator: null, browser_personal: true };
  }
  function saveSettings(next) {
    /* Only public preferences enter browser storage. */
    R.storage.set("policy.browser.v1", { posture: next.posture,
      first_use_disclosure_shown: next.first_use_disclosure_shown === true });
    return settings();
  }
  function registerView() {
    return { editable: false, mode: "personal", as_of: Register.as_of || null,
      rows: Object.keys(Register.destinations || {}).map(function (id) {
        const row = Register.destinations[id];
        return { system_id: id, max_class: row.max_class || null, shipped_max_class: row.max_class || null,
          row: row.row || null, status: row.status || null, source: "shipped" };
      }) };
  }
  function destinationFacts(input) {
    if (!input || typeof input !== "object") return null;
    const row = (Register.destinations || {})[input.system_id] || {};
    return Object.assign({}, input, { register_row: row.row || null, max_class: row.max_class || null,
      approved_classes: Array.isArray(row.permitted) ? row.permitted.slice() : undefined });
  }
  function evaluate(input) {
    const source = input && typeof input === "object" ? input : {};
    const evaluation = Policy.evaluateRequest({ now: Date.now(), mode: "personal", posture: settings().posture,
      build: build, local_finding: source.local_finding, model_classification: source.model_classification,
      secrets: source.secrets, spans: source.spans, contextual_classes: source.contextual_classes,
      destination: destinationFacts(source.destination), managed: null,
      actor: { authority: "ordinary_user", authenticated: false, elevated: false },
      confirmation: source.confirmation, redaction: source.redaction,
      recovery_opt_in: false, encryption_available: false });
    lastClassification = clone(evaluation.classification);
    return evaluation;
  }
  R.services.currentClassification = function () { return clone(lastClassification); };
  const policyFacade = { channels: {
    "omono:v3:policy:settings": async function () { return settings(); },
    "omono:v3:policy:managed-status": async function () { return { applicable: false, mode: "personal" }; }
  } };

  /* Fetch sees the key only in the provider header. Refuse an unexpected URL
     even if a later canonical service were to introduce a configurable one. */
  function transport(wire, context) {
    if (context.url !== Api.API_URL || !context.credential) {
      return Promise.resolve({ ok: false, status: 0, error_type: "invalid_request", body: null });
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve({ offline: true });
    const phase = String(context.phase || "");
    const runState = runs.get(phase);
    if (runState && runState.cancelled) return Promise.resolve({ ok: false, status: 0, error_type: "cancelled" });
    const controller = new AbortController();
    const record = { cancelled: false, timedOut: false, abort: function () { controller.abort(); } };
    if (active.has(phase)) {
      const previous = active.get(phase);
      previous.cancelled = true;
      previous.abort();
    }
    active.set(phase, record);
    const timer = setTimeout(function () { record.timedOut = true; controller.abort(); }, 120000);
    return fetch(Api.API_URL, { method: "POST", credentials: "omit", mode: "cors", cache: "no-store",
      redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": context.credential,
        "anthropic-version": Api.API_VERSION, "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(wire) }).then(async function (response) {
        let body = null;
        try { body = await response.json(); } catch (error) { body = null; }
        /* No provider error may reflect a credential back into an error panel. */
        if (body && context.credential) {
          body = JSON.parse(JSON.stringify(body).split(context.credential).join("[redacted]"));
        }
        const message = body && body.error ? String(body.error.message || "") : "";
        if (runState && !response.ok && /CORS/i.test(message) && /organi[sz]ation/i.test(message)) {
          runState.browserDenied = true;
        }
        if (runState && response.status === 401 && !runState.browserDenied) runState.keyRefused = true;
        return { ok: response.ok, status: response.status,
          error_type: body && body.error ? String(body.error.type || "") : "", body: body };
      }).catch(function () {
        if (record.cancelled) return { ok: false, status: 0, error_type: "cancelled", body: null };
        if (record.timedOut) return { timeout: true };
        return { offline: true };
      }).finally(function () {
        clearTimeout(timer);
        if (active.get(phase) === record) active.delete(phase);
      });
  }

  const refreshRuntime = {
    policy: policyFacade,
    get lessons() {
      if (!R.services.lessons) throw new Error("The browser lesson service is unavailable.");
      return R.services.lessons;
    },
    counts: function () {
      if (typeof R.services.refreshCounts !== "function") throw new Error("The browser learning record is unavailable.");
      return R.services.refreshCounts();
    },
    /* Owner ruling, 2026-09-22: the phone keeps its own, smaller diet of
       lessons — it is not where the work happens. Five at each opening, against
       the desktop's twenty-five, and a starting library of ten rather than the
       whole canon (see the browser lesson store). */
    dailyTarget: function () { return 5; },
    readState: function () { return R.storage.get("refresh.browser.v1", {}); },
    writeState: function (state) { R.storage.set("refresh.browser.v1", state); },
    recordEvent: function (event) {
      if (typeof R.services.recordRefresh !== "function") throw new Error("The browser learning record is unavailable.");
      return R.services.recordRefresh(event);
    }
  };
  const service = Api.createService({
    secretStore: { save: function (value) { apiKey = value; return true; },
      load: function () { return apiKey; }, has: function () { return !!apiKey; }, clear: clearKey },
    transport: transport, refreshRuntime: refreshRuntime, logger: function () {},
    legacyDir: function () { throw new Error("Legacy credential migration is unavailable in a browser."); }
  });

  const bridge = {
    apiCredentialStatus: async function () { return { ok: true, configured: !!apiKey, storage: "device", migrated: false }; },
    setApiCredential: async function (request) {
      const value = request && typeof request.value === "string" ? request.value.trim() : "";
      if (!/^sk-ant-[A-Za-z0-9_-]{12,505}$/.test(value)) {
        return { ok: false, configured: !!apiKey, reason: "invalid_credential_format",
          error: { state: "invalid_request", headline: "Enter a valid Anthropic API key.", next_step: "",
            repairable: false, detail: { technical: "" } } };
      }
      clearKey();
      const result = await service.handle(Api.preload.setApiCredential, { value: value });
      if (result && result.ok !== false && apiKey) {
        try { R.storage.set(KEY_STORE, apiKey); } catch (error) { /* a full or blocked store still works for this session */ }
      }
      return Object.assign({}, result, { storage: "device" });
    },
    clearApiCredential: async function () { return clearKey(); },
    legacyCredentialState: async function () { return { ok: true, v3_configured: !!apiKey,
      legacy_plaintext_present: false, scrub_available: false, applicable: false }; },
    scrubLegacyCredential: async function () { return unavailable("Legacy desktop key cleanup"); },
    modelProfiles: function () { return service.handle(Api.preload.modelProfiles); },
    authorModel: function (input) { return service.handle(Api.preload.authorModel, input); },
    cancelRun: async function (input) {
      const phase = String(input && input.phase || "");
      if (phase !== "interpret" && phase !== "generate") return { ok: false, cancelled: false, reason: "unsupported_phase" };
      const record = active.get(phase);
      const run = runs.get(phase);
      if (run) run.cancelled = true;
      if (record) { record.cancelled = true; record.abort(); }
      return { ok: true, cancelled: !!(record || run) };
    },
    /* Owner ruling, 2026-08-20 and 2026-09-17, restated 2026-09-21: lessons
       arrive at every open, never repeat, and more are fetched when the unseen
       pool runs low — on every surface, not only the desktop. Requiring a press
       here left both of the renderer's own triggers inert, so the browser
       taught only when asked. The spend guards live in the shared refresh
       service, which is the same one the desktop runs: once per opening, a
       spacing interval before a running-low fetch, and nothing at all for a
       managed catalog. The request is passed through intact so "running low"
       is not mistaken for an opening. */
    refreshRun: async function (input) {
      if (!apiKey) return { refreshed: false, reason: "no_credential", mode: "personal" };
      return invoke("refresh", Api.preload.refreshRun, input && typeof input === "object" ? input : {});
    },
    dossierResearch: async function () {
      /* Desktop's current channel sends a fixture-only model label and no key.
         Do not turn that into a broken paid request or a fabricated dossier. */
      return { ok: false, established: false, reason: "browser_unavailable",
        note: "Live tool research is unavailable here. The existing tool profile remains available." };
    },
    authStatus: async function () { return { initialized: false, owner_required: false, browser_personal: true,
      actor_id: null, display_name: "", encryption_available: false, protection: "tab_memory",
      build_channel: "personal", creator: Policy.creatorAuthority.creatorCapabilities(build) }; },
    authCreateOwner: async function () { return unavailable("Desktop owner accounts"); },
    authSetDisplayName: async function () { return unavailable("Desktop owner accounts"); },
    authVerify: async function () { return unavailable("Desktop owner authentication"); },
    /* Owner ruling, 2026-09-21: the override is gone from the web version, and
       not named there either. Its capability report already reads unavailable
       for an unsigned personal build, and nothing in the browser can invoke it,
       so the refusal is kept as a closed door with no label on it. */
    authElevate: async function () { return unavailable("Owner elevation"); },
    authElevationState: async function () { return { elevated: false, actor_id: null, expires_at: null }; },
    authEndElevation: async function () { return { elevated: false, ended: false }; },
    authCreatorInvocation: async function () { return { available: false, accelerator: null, reason: "browser_unavailable" }; },
    policySettings: async function () { return settings(); },
    policyAcknowledgeDisclosure: async function () {
      const current = settings();
      saveSettings(Object.assign({}, current, { first_use_disclosure_shown: true }));
      return { acknowledged: true, already: current.first_use_disclosure_shown };
    },
    policyProtectedChange: async function (input) {
      const source = input || {};
      const current = settings();
      if (source.change === "mode" && source.value !== "personal") return unavailable("Enterprise mode");
      if (source.change === "strictness") {
        if (Policy.vocabulary.POSTURES.indexOf(source.value) === -1) return { applied: false, reason: "unsupported_posture" };
        return { applied: true, settings: saveSettings(Object.assign({}, current, { posture: source.value })), event_recorded: false };
      }
      if (source.change === "mode" || (source.change === "retention" && source.value === false)) {
        return { applied: true, settings: current, event_recorded: false };
      }
      return unavailable(source.change === "retention" ? "Encrypted private recovery" : "That setting");
    },
    policyEvaluate: async function (input) { return evaluate(input); },
    policyRegisterView: async function () { return registerView(); },
    policyRegisterSetCeiling: async function () { return unavailable("Protected destination approval changes"); },
    policyManagedStatus: async function () { return { applicable: false, available: false, mode: "personal",
      message: "This browser version runs in Personal mode." }; },
    policyCreatorBypass: async function (input) { return { evaluation: evaluate(input),
      outcome: { allowed: false, reason: "browser_unavailable" }, event_recorded: false }; },
    policyMatterScreeningView: async function () { return Policy.matterScreening.view(matterConfig); },
    policyMatterScreeningConfigure: async function (input) {
      try {
        matterConfig = Policy.matterScreening.configure({ entries: input && input.entries,
          enabled: !input || input.enabled !== false, configured_at: Date.now() });
        return { configured: true, view: Policy.matterScreening.view(matterConfig), storage: "tab_memory" };
      } catch (error) { return { configured: false, reason: "invalid_entries" }; }
    },
    screenText: async function (text, posture) {
      const result = Engine.localScreen(String(text || "").slice(0, 200000), {
        posture: posture || settings().posture, matters: matterConfig && matterConfig.enabled !== false ? matterConfig.entries : [] });
      return { spans: result.spans, classes: result.classes, tierFor: result.tierFor, secrets: result.secrets,
        subject: result.subject, verdict: result.verdict,
        matter_hits: result.spans.filter(function (span) { return span.source === "matter_list"; }).length };
    },
    mattersAll: async function () { return clone(matterConfig ? matterConfig.entries : []); },
    mattersSave: async function (entries) {
      const result = await bridge.policyMatterScreeningConfigure({ entries: entries, enabled: true });
      return { saved: result.configured, count: matterConfig ? matterConfig.entries.length : 0, storage: "tab_memory" };
    },
    redactionSave: async function (ref, entries, meta) {
      if (typeof ref !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(ref)) return { saved: false, reason: "invalid_reference" };
      const safeEntries = (Array.isArray(entries) ? entries : []).slice(0, 500).map(function (entry) {
        return { token: String(entry && entry.token || "").slice(0, 64),
          value: String(entry && entry.value || "").slice(0, 2000), class: String(entry && entry.class || "").slice(0, 64) };
      }).filter(function (entry) { return entry.token && entry.value; });
      redactions.set(ref, { entries: safeEntries, created_at: new Date().toISOString(), classes: clone(meta && meta.classes || []) });
      return { saved: true, ref: ref, count: safeEntries.length, storage: "tab_memory" };
    },
    redactionList: async function () { return Array.from(redactions.entries()).map(function (pair) {
      return { ref: pair[0], count: pair[1].entries.length, created_at: pair[1].created_at, classes: clone(pair[1].classes) };
    }); },
    redactionClear: async function (ref) { redactions.delete(String(ref)); return true; },
    restoreText: async function (ref, text) { const held = redactions.get(String(ref));
      return Engine.restoreText(String(text || "").slice(0, 200000), held ? held.entries : []); },
    policyRedactionPlan: async function (input) {
      const source = input || {};
      const plan = Policy.redaction.planRedaction(source.spans, { transaction_id: source.transaction_id });
      const applied = typeof source.text === "string" ? Policy.redaction.applyRedactionPlan(source.text, plan) : null;
      return { plan: { schema: plan.schema, items: plan.items.map(function (item) {
        return { span_id: item.span_id, class: item.class, kind: item.kind, action: item.action, token: item.token };
      }) }, text: applied ? applied.text : null, summary: applied ? applied.summary : Policy.redaction.summarizePlan(plan), map_stored: false };
    },
    policyMigrationPreview: async function () { return unavailable("Desktop data migration"); }
  };
  async function invoke(phase, channel, request) {
    if (!apiKey) return noKey();
    if (runs.has(phase)) return { ok: false, reason: "request_in_progress", warnings: [],
      error: { state: "request_in_progress", headline: "That step is already running.", next_step: "Wait or cancel the current request.", repairable: false } };
    const state = { cancelled: false, browserDenied: false, keyRefused: false };
    runs.set(phase, state);
    try {
      const result = await service.handle(channel, request);
      if (state.cancelled) return cancelled();
      if (state.browserDenied || state.keyRefused) {
        return { ok: false, warnings: result && result.warnings || [], error: {
          state: state.browserDenied ? "browser_access_disabled" : "authentication_error",
          headline: state.browserDenied ? "Your Anthropic organization has disabled browser API access." : "Anthropic did not accept this API key.",
          next_step: state.browserDenied ? "Use a key from an organization that permits browser requests." : "Check the key in Settings and try again.",
          repairable: false, detail: { phase: phase, provider: "anthropic", model: "", response_id: "",
            stop_reason: "", schema_path: "", retry_status: "not retried automatically", technical: "" }
        } };
      }
      return result;
    } finally { if (runs.get(phase) === state) runs.delete(phase); }
  }
  Object.keys(phaseMethods).forEach(function (method) {
    bridge[method] = function (request) {
      return invoke(phaseMethods[method].replace(/-/g, "_"), "omono:v3:api:" + phaseMethods[method], request);
    };
  });
  Object.assign(R.bridge, bridge);
  /* Leaving the page drops everything held only in memory. The key is no
     longer one of those things (owner decision, 2026-09-22), so the running
     requests are stopped without also wiping what was deliberately kept. */
  if (window.addEventListener) window.addEventListener("pagehide", function () {
    for (const run of runs.values()) run.cancelled = true;
    for (const run of active.values()) { run.cancelled = true; run.abort(); }
    active.clear();
    matterConfig = null;
    lastClassification = null;
    redactions.clear();
  });
})();
