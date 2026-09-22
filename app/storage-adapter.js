/* Personal browser persistence. The canonical lesson and evidence services own
   validation, counting, deduplication and acknowledgments. The browser store is
   ordinary origin storage, not OS encryption or an authenticated audit trail. */
(function (scope) {
  "use strict";
  var R = scope.OMonoBrowserRuntime;
  if (!R || !R.require || !R.storage) throw new Error("The browser runtime must load first.");
  var bridge = R.bridge, store = R.storage;
  var Engine = R.require("/shared/engine.js");
  var Canon = R.require("/shared/teaching/canon-v5.js");
  /* Owner ruling, 2026-09-22: the phone starts with ten lessons, not the
     desktop's whole founding canon, and takes five more at each opening. It is
     not the machine the work is done on, and a library that outruns the use is
     just a backlog.

     Which ten matters. Taken in canon order they would cluster in whichever
     areas the canon happens to list first, so this takes one lesson from each
     area in turn — the same round-robin the growth brief uses to decide what to
     ask for next — and the phone opens on ten different subjects rather than
     ten shades of one. Nothing else about the library changes: the same
     schema, the same engine, and everything fetched afterwards arrives by the
     ordinary route. */
  var PHONE_STARTING_LESSONS = 10;
  var Seed = (function () {
    var live = (Canon.lessons || []).filter(function (lesson) { return lesson.retired_duplicate !== true; });
    var byDomain = [];
    var index = {};
    live.forEach(function (lesson) {
      var domain = lesson.domain || "";
      if (!index[domain]) { index[domain] = []; byDomain.push(index[domain]); }
      index[domain].push(lesson);
    });
    var chosen = [];
    for (var round = 0; chosen.length < PHONE_STARTING_LESSONS && round < live.length; round += 1) {
      for (var i = 0; i < byDomain.length && chosen.length < PHONE_STARTING_LESSONS; i += 1) {
        if (byDomain[i][round]) chosen.push(byDomain[i][round]);
      }
    }
    return Object.assign({}, Canon, { lessons: chosen });
  })();
  var Profiles = R.require("/shared/core/model-profiles.js");
  var lessons = R.require("/app/services/lesson-service.js").create({
    dataDir: "/user",
    schema: R.require("/shared/teaching/lesson-schema-v5.js"),
    growth: R.require("/shared/teaching/growth-v5.js"),
    names: R.require("/shared/teaching/display-names.js"),
    seed: Seed,
    managedContext: function () { return { mode: "personal", valid: false }; }
  });
  var evidence = R.require("/app/services/evidence-service.js").create({ dataDir: "/user" });
  R.services.lessons = lessons;
  R.services.evidence = evidence;

  function bindService(service) {
    Object.keys(service.preload).forEach(function (method) {
      bridge[method] = function (payload) {
        return Promise.resolve().then(function () {
          return service.channels[service.preload[method]](null, payload);
        });
      };
    });
  }
  bindService(lessons);
  bindService(evidence);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value, max) { return String(value == null ? "" : value).slice(0, max); }
  function id(value) {
    var valueId = String(value || "");
    if (!/^[A-Za-z0-9_-]{1,96}$/.test(valueId)) throw new Error("Invalid local record id.");
    return valueId;
  }
  function guard(value) {
    var serialized = JSON.stringify(value);
    if (Engine.scanSecrets(serialized).length) throw new Error("Authentication secrets cannot enter browser history.");
    function inspect(item) {
      if (!item || typeof item !== "object") return;
      Object.keys(item).forEach(function (key) {
        if (/^(api[_-]?key|provider[_-]?key|credential|authorization|access[_-]?token|password)$/i.test(key)) {
          throw new Error("Credential fields cannot enter browser history.");
        }
        inspect(item[key]);
      });
    }
    inspect(value);
    return value;
  }
  function get(key, fallback) { return store.get("records:" + key, fallback); }
  function put(key, value) { guard(value); store.set("records:" + key, value); return value; }
  function remove(key) { store.remove("records:" + key); return true; }
  function privateClasses(classes) {
    return (Array.isArray(classes) ? classes : []).filter(function (value) {
      return /^c[3-8](?:$|_)/i.test(String(value));
    });
  }
  function method(name, fn) {
    bridge[name] = function () {
      var args = Array.from(arguments);
      return Promise.resolve().then(function () { return fn.apply(null, args); });
    };
  }
  function allEvents() { return get("legacy-ledger", []); }
  function indexFor(events) {
    var index = { count: 0, outcomes: 0, last_hash: "", months: {} };
    events.forEach(function (event) {
      if (!event) return;
      if (event.type === "generation") index.count += 1;
      if (event.type === "outcome") index.outcomes += 1;
      index.last_hash = event.hash || "";
      var month = new Date(event.ts || 0).toISOString().slice(0, 7);
      index.months[month] = (index.months[month] || 0) + 1;
    });
    return index;
  }
  function appendEvent(input) {
    var events = allEvents(), body = clone(guard(input || {}));
    delete body.hash; delete body.prev_hash;
    if (body.type === "generation" && typeof body.idea === "string") {
      var local = Engine.localScreen(body.idea, { posture: "strict" });
      var classified = typeof R.services.currentClassification === "function"
        ? R.services.currentClassification() : null;
      var classes = privateClasses((body.data_classes || []).concat(local.classes || [], classified && classified.classes || []));
      if (classes.length) {
        body.idea_hash = R.sha256(body.idea); body.idea_chars = body.idea.length;
        delete body.idea;
        body.storage_mode = "hash_only"; body.data_classes = Array.from(new Set(classes));
      }
    }
    var previous = events.length ? events[events.length - 1].hash : "";
    var hash = R.sha256(previous + Engine.canonicalize(body));
    events.push(Object.assign({}, body, { prev_hash: previous, hash: hash }));
    put("legacy-ledger", events);
    return { hash: hash, count: indexFor(events).count };
  }
  function recent(limit) {
    var events = allEvents(), byId = new Map(), statuses = new Map();
    events.forEach(function (event) {
      if (event && event.type === "generation") {
        var previous = byId.get(event.id);
        if (!previous || Number(event.ts) >= Number(previous.ts)) byId.set(event.id, clone(event));
      }
    });
    events.forEach(function (event) {
      var row = event && byId.get(event.ref);
      if (!row) return;
      if (event.type === "outcome" && (!row.outcome || Number(event.ts) >= Number(row.outcome.ts))) {
        row.outcome = { verdict: event.verdict, failed_fields: event.failed_fields, note: event.note, ts: event.ts };
      }
      if (event.type === "status") {
        var previous = statuses.get(event.ref);
        if (!previous || Number(event.ts) >= Number(previous.ts)) statuses.set(event.ref, event);
      }
    });
    statuses.forEach(function (event, key) { byId.get(key).status = event.status; });
    var n = Number(limit), rows = Array.from(byId.values()).sort(function (a, b) { return Number(b.ts) - Number(a.ts); });
    return { entries: rows.slice(0, !Number.isFinite(n) ? 15 : n <= 0 ? 100000 : Math.min(100000, Math.max(1, Math.floor(n)))), index: indexFor(events) };
  }
  function verifyLegacy() {
    var events = allEvents(), check = Engine.verifyChain(events, R.sha256);
    check.generations = events.filter(function (event) { return event && event.type === "generation"; }).length;
    check.verified_at = new Date().toISOString();
    check.storage = "browser";
    return check;
  }
  method("ledgerAppend", appendEvent);
  method("ledgerStatus", function (ref, status) { return appendEvent({ type: "status", ref: ref, status: status, ts: Date.now() }); });
  method("ledgerOutcome", function (o) { return appendEvent({ type: "outcome", ref: o.ref, verdict: o.verdict, failed_fields: o.failed_fields || [], note: o.note || "", ts: Date.now() }); });
  method("ledgerRecent", recent);
  method("ledgerVerify", verifyLegacy);
  method("learning", function () { return Engine.learningReport(allEvents(), { now: Date.now() }); });
  method("sha256", function (value) { return R.sha256(String(value)); });

  function recovery(value, ref) {
    if (!value || Number(value.version) !== 1) throw new Error("Unsupported recovery snapshot.");
    if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error("Invalid recovery revision.");
    var state = clone(guard(value));
    if (JSON.stringify(state).length > 1200000) throw new Error("Recovery snapshot is too large.");
    if (!state.v3 || !state.v3.generation || !state.v3.interpretation
        || !Array.isArray(state.v3.generation.components)) throw new Error("The complete prompt is required for recovery.");
    if (!state.destination || !state.destination.system || !state.destination.model) throw new Error("Recovery destination is missing.");
    var classes = state.v3.interpretation.data && state.v3.interpretation.data.classes || [];
    var legacyClasses = state.interpretation && state.interpretation.data_flags && state.interpretation.data_flags.classes || [];
    var scanned = Engine.localScreen(String(state.idea || ""), { posture: "strict" });
    if (privateClasses(classes.concat(legacyClasses, scanned.classes || [])).length) {
      throw new Error("Private or sensitive prompts cannot enter unencrypted browser recovery.");
    }
    state.entry_id = id(ref);
    state.idea = text(state.idea, 200000);
    state.updated_at = new Date().toISOString();
    state.storage = "browser";
    return state;
  }
  function readRecovery(ref) {
    var saved = get("recovery:" + id(ref), null);
    if (!saved) return null;
    return recovery(saved, ref);
  }
  method("recoverySave", function (ref, value) {
    var state = recovery(value, ref), old = get("recovery:" + state.entry_id, null);
    if (old && old.revision >= state.revision) return { saved: false, stale: true, ref: state.entry_id, revision: old.revision };
    put("recovery:" + state.entry_id, state);
    put("recovery-current", state.entry_id);
    return { saved: true, ref: state.entry_id, revision: state.revision, storage: "browser", updated_at: state.updated_at };
  });
  method("recoveryRead", readRecovery);
  method("recoveryLoadCurrent", function () { var ref = get("recovery-current", null); return ref ? readRecovery(ref) : null; });
  method("recoveryAvailable", function (refs) {
    var out = {};
    (Array.isArray(refs) ? refs.slice(0, 100000) : []).forEach(function (ref) {
      try { out[id(ref)] = !!readRecovery(ref); } catch (_) { out[String(ref)] = false; }
    });
    return out;
  });
  method("recoveryClearCurrent", function () { return remove("recovery-current"); });
  method("recoverySaveDraft", function (value) {
    var valueText = text(value, 200000);
    if (!valueText.trim()) throw new Error("Draft is empty.");
    guard(valueText);
    if (privateClasses(Engine.localScreen(valueText, { posture: "strict" }).classes).length) {
      throw new Error("Private or sensitive drafts cannot enter unencrypted browser recovery.");
    }
    var draft = { version: 1, text: valueText, updated_at: new Date().toISOString(), storage: "browser" };
    put("draft", draft);
    return { saved: true, updated_at: draft.updated_at, storage: "browser" };
  });
  method("recoveryLoadDraft", function () { return get("draft", null); });
  method("recoveryClearDraft", function () { return remove("draft"); });

  function manualAll() { return get("manual", []); }
  method("manualAll", manualAll);
  method("manualUpsert", function (entry) {
    var pattern = text(entry && entry.pattern, 160), rows = manualAll();
    if (!pattern.trim()) throw new Error("A correction needs a pattern.");
    var old = rows.find(function (row) { return row.pattern === pattern; });
    rows = rows.filter(function (row) { return row.pattern !== pattern; });
    if (!entry.deleted) rows.push({ pattern: pattern, meaning: text(entry.meaning, 280), count: (old ? old.count : 0) + 1, last_ts: Date.now() });
    put("manual", rows);
    return true;
  });
  R.services.manualAll = manualAll;

  function step(value, fallback) {
    return { id: text(value && value.id, 40) || text(fallback && fallback.id, 40), ask: text(value && value.ask, 300) || text(fallback && fallback.ask, 300), done: !!(value && value.done), note: text(value && value.note, 500) };
  }
  function checklist(value) {
    var v = value || {}, number = function (n) { return Number.isFinite(n) ? n : null; };
    return guard({ kind: "verification_checklist", version: 1, id: id(v.id), ref: v.ref ? id(v.ref) : null,
      created_ts: number(v.created_ts) || Date.now(), engine_version: text(v.engine_version, 20),
      destination: v.destination ? { system: text(v.destination.system, 40), model: text(v.destination.model, 80), label: text(v.destination.label, 120) } : null,
      triggers: (v.triggers || []).slice(0, 12).map(function (s) { return text(s, 40); }),
      why: (v.why || []).slice(0, 12).map(function (s) { return text(s, 200); }), matter: text(v.matter, 200), verifier: text(v.verifier, 120),
      started_ts: number(v.started_ts), closed_ts: number(v.closed_ts), minutes: number(v.minutes),
      items: (v.items || []).slice(0, 300).map(function (item, i) {
        return { n: i + 1, kind: text(item.kind, 40), label: text(item.label, 60), text: text(item.text, 400),
          steps: (item.steps || []).slice(0, 10).map(function (s, j) { return step(s, Engine.AUTHORITY_STEPS[j]); }) };
      }), document: (v.document || []).slice(0, 10).map(function (s, i) { return step(s, Engine.DOCUMENT_STEPS[i]); }) });
  }
  function verificationRecord(cl, event) {
    return { id: cl.id, ref: cl.ref, event: event, created_ts: cl.created_ts, started_ts: cl.started_ts, closed_ts: cl.closed_ts,
      minutes: cl.minutes, matter: cl.matter, verifier: cl.verifier, destination: cl.destination, summary: Engine.verificationSummary(cl) };
  }
  function readVerification(value) { return get("checklists", {})[id(value)] || null; }
  function logVerification(cl, event) {
    return appendEvent(Engine.makeVerificationEntry({ id: cl.id + "-" + event, ts: Date.now(), checklist: cl, event: event, checklistHash: R.sha256(Engine.canonicalize(cl)) }));
  }
  method("verifySave", function (incoming, event) {
    var rows = get("checklists", {}), cl = checklist(Object.assign({}, rows[incoming.id] || {}, incoming));
    if (event === "started" && !Number.isFinite(cl.started_ts)) cl.started_ts = Date.now();
    if (event === "closed") {
      if (!Number.isFinite(cl.started_ts)) cl.started_ts = cl.created_ts;
      cl = checklist(Engine.closeVerification(cl, Date.now()));
    }
    rows[cl.id] = cl; put("checklists", rows);
    if (event === "generated" || event === "closed") logVerification(cl, event);
    return verificationRecord(cl, event || "saved");
  });
  method("verifyRead", readVerification);
  method("verifyList", function () { return Object.values(get("checklists", {})).map(function (cl) { return verificationRecord(cl, "listed"); }).sort(function (a, b) { return b.created_ts - a.created_ts; }).slice(0, 200); });
  method("verifyTax", function () { return Engine.verificationTax(allEvents()); });
  method("verifyWindowOpen", function () { return false; });
  method("verifyExport", async function (value) {
    var cl = readVerification(value);
    if (!cl) return { saved: false, reason: "not found" };
    var result = await bridge.saveText("verification-" + cl.id + ".md", Engine.renderVerificationChecklist(cl));
    if (result && result.saved) logVerification(cl, "exported");
    return result;
  });
  method("revealLedger", function () { return bridge.saveText("omono-local-record.json", JSON.stringify({ storage: "browser", integrity: verifyLegacy(), events: allEvents() }, null, 2)); });

  /* Catching up with the Mac. Owner ruling, 2026-09-22: the two devices keep
     their own records and iCloud carries a file between them. The Mac can read
     and write that folder by itself; a page in a browser cannot, so here it is
     one deliberate action each way — hand a file out, take a file in.

     The carry format, and the rule that a merge only ever adds, live in the
     canonical carry module, which both surfaces run. What is here is only the
     reading and writing of this device's own files. */
  var Carry = R.require("/shared/evidence/carry.js");
  var LESSON_FILES = { lessons: "approved.ndjson", emissions: "emissions.ndjson", engagement: "engagement.ndjson" };
  function lessonPath(name) { return "/user/lessons/" + name; }
  function readNdjson(file) {
    var out = [];
    try {
      R.fs.readFileSync(file, "utf8").split("\n").forEach(function (line) {
        if (!line.trim()) return;
        try { out.push(JSON.parse(line)); } catch (error) { /* a damaged line is not a row */ }
      });
    } catch (error) { /* absent is empty */ }
    return out;
  }
  function writeNdjson(file, lines) {
    R.fs.mkdirSync(file.slice(0, file.lastIndexOf("/")));
    R.fs.writeFileSync(file, lines.map(function (row) { return JSON.stringify(row); }).join("\n") + (lines.length ? "\n" : ""));
  }
  function held() {
    return { work: allEvents(), lessons: readNdjson(lessonPath(LESSON_FILES.lessons)),
      emissions: readNdjson(lessonPath(LESSON_FILES.emissions)),
      engagement: readNdjson(lessonPath(LESSON_FILES.engagement)) };
  }
  method("carryBuild", function () {
    var carry = Carry.buildCarry(held(), { origin: "browser", engineVersion: Engine.ENGINE_VERSION, now: Date.now() });
    Carry.assertCarrySafe(carry);
    return carry;
  });
  method("carryExport", async function () {
    var carry = Carry.buildCarry(held(), { origin: "browser", engineVersion: Engine.ENGINE_VERSION, now: Date.now() });
    Carry.assertCarrySafe(carry);
    var counts = {};
    Carry.COLLECTIONS.forEach(function (collection) { counts[collection.name] = carry[collection.name].length; });
    var result = await bridge.saveText("omono-from-phone.json", JSON.stringify(carry, null, 2));
    return Object.assign({ carried: counts, newest_ts: carry.newest_ts }, result);
  });
  method("carryImport", function (value) {
    var read = Carry.readCarry(typeof value === "string" ? value : (value && value.text));
    if (!read.ok) return { merged: false, reason: read.reason, dropped: read.dropped || 0 };
    var merged = Carry.mergeCarry(held(), read.carry);
    /* Work events are appended through this device's own ledger, so its chain
       stays its own and stays valid. The others are plain lines. */
    merged.added_rows.work.forEach(function (event) { appendEvent(event); });
    ["lessons", "emissions", "engagement"].forEach(function (name) {
      if (merged.added[name]) writeNdjson(lessonPath(LESSON_FILES[name]), merged.collections[name]);
    });
    return { merged: true, added: merged.added, known: merged.known, total_added: merged.total_added,
      total_known: merged.total_known, newest_ts: merged.newest_ts, origin: merged.origin,
      dropped: read.dropped || 0, integrity: verifyLegacy() };
  });

  /* The watch: the rules and terms O'Mono should keep an eye on. Owner ruling,
     2026-09-21 — the web version is the same O'Mono, so the screen is here too.
     The rows, their cadence and the overdue arithmetic are the canonical
     engine's, identical to the desktop's.

     What cannot work here is the fetching. A "diff" row compares a page's
     visible text against the last time it was read; a browser may not read
     another site's pages, and this app's transport rule allows the provider
     and nothing else. So the rows are listed and their overdue count is real,
     but a check reports that it cannot fetch and records NOTHING. Recording
     "looked" because a button was pressed would put a claim in the record
     that nobody made. */
  function readWatch() {
    var stored = get("watch", null) || {};
    return { rows: Engine.normalizeWatchRows(stored.rows || null), state: stored.state || {} };
  }
  function writeWatch(value) {
    put("watch", { rows: Engine.normalizeWatchRows(value.rows), state: value.state || {} });
    return readWatch();
  }
  function watchReport() {
    var w = readWatch();
    return Engine.watchSummary(w.rows, w.state, Date.now());
  }
  method("watchAll", watchReport);
  method("watchSave", function (rows) {
    var w = readWatch();
    return Engine.watchSummary(writeWatch({ rows: rows, state: w.state }).rows, w.state, Date.now());
  });
  method("watchCheck", function (value) {
    var w = readWatch();
    var wanted = text(value && (value.id != null ? value.id : value), 60);
    var row = w.rows.find(function (candidate) { return candidate.id === wanted; });
    if (!row) return { result: { checked: false, reason: "no such row" }, summary: watchReport() };
    return { result: { checked: false, reason: "browser_cannot_fetch_other_sites" }, summary: watchReport() };
  });
  method("watchPrompt", function (value) {
    var w = readWatch();
    var row = w.rows.find(function (candidate) { return candidate.id === text(value, 60); });
    if (!row) return null;
    return Engine.watchChangePrompt(row, w.state[row.id] || {});
  });

  method("dossierOpened", function (value) {
    var tool = text(value && (value.tool || value.tool_id), 80);
    if (!tool) return false;
    var rows = get("dossier-opens", []); rows.push({ tool: tool, ts: Date.now() }); put("dossier-opens", rows); return true;
  });
  method("dossierEngagement", function () {
    var rows = get("dossier-opens", []), byTool = {};
    rows.forEach(function (row) { byTool[row.tool] = (byTool[row.tool] || 0) + 1; });
    return { opens: rows.length, by_tool: byTool };
  });

  /* Same count inputs as the desktop's refreshCounts(), from the same folded
     append-only work record. No prompt text enters the refresh brief. */
  R.services.refreshCounts = function () {
    var folded = evidence.api.foldedWorkEvents(), entries = evidence.api.workLedger().entries;
    var counts = { generations: folded.length, by_competency: {}, by_outcome: {}, by_failure_category: {}, by_skipped_field: {}, by_destination_trait: {}, by_domain_taught: {}, distinct_sources: {}, pairs_kept: 0, pairs_removed: 0 };
    var traits = {}, domains = {};
    Profiles.listProfiles().forEach(function (profile) {
      var caps = profile.capabilities || {};
      traits[profile.system_id + "/" + profile.model_id] = { tools: caps.tools === true, reasoning: profile.reasoning === true, web: caps.web === true, files: caps.files === true, unverified: profile.status === "unknown" };
    });
    /* Every lesson this installation actually holds, not only the ones it
       started with: the phone starts with ten and grows, so a map built from
       the starting set alone would stop recognising its own later lessons and
       under-report which areas the record has been taught in. */
    (lessons.api.workingSet().lessons || []).forEach(function (lesson) { domains[lesson.lesson_id] = lesson.domain; });
    function count(table, key) { if (key) table[key] = (table[key] || 0) + 1; }
    folded.forEach(function (event) {
      (event.competency_ids || []).forEach(function (key) { count(counts.by_competency, key); });
      count(counts.by_outcome, event.outcome || "not_evaluated");
      if (event.failure_category) { count(counts.by_failure_category, event.failure_category); count(counts.distinct_sources, event.failure_category); }
      var destination = event.destination || {}, profile = traits[destination.system_id + "/" + destination.model_id] || {};
      Object.keys(profile).forEach(function (trait) { if (profile[trait]) { count(counts.by_destination_trait, trait); count(counts.distinct_sources, trait); } });
      (event.lesson_ids || []).forEach(function (key) { count(counts.by_domain_taught, domains[key]); });
    });
    entries.forEach(function (entry) {
      var event = entry && entry.event;
      if (!event) return;
      if (event.schema === "omono.safeguard-pair.v1") {
        if (event.pair === "safeguard_kept_then_worked") counts.pairs_kept += 1;
        if (event.pair === "safeguard_removed_then_failed") counts.pairs_removed += 1;
      }
      if (event.schema === "omono.field-skip.v1") (event.skipped_fields || []).forEach(function (field) { count(counts.by_skipped_field, field); count(counts.distinct_sources, field); });
    });
    return counts;
  };
  R.services.recordRefresh = function (event) { return evidence.api.recordRefresh(event); };

  var exportsService = R.require("/app/services/export-service.js").create({ dataDir: "/user", evidence: evidence, lessonService: lessons,
    lessonData: function () {
      var held = lessons.api.workingSet(), active = held.lessons || [];
      var revisions = new Map();
      Seed.lessons.concat(lessons.api.approved().lessons || []).forEach(function (lesson) {
        var old = revisions.get(lesson.lesson_id);
        if (!old || Number(lesson.version) > Number(old.version)) revisions.set(lesson.lesson_id, lesson);
      });
      return { canon: active, history_canon: Array.from(revisions.values()), working_set: held,
        coverage: lessons.api.coverage({ canon: active }), records: lessons.api.records() };
    } });
  R.services.exports = exportsService;
  method("previewCurriculum", function (request) {
    if (request && request.scope && request.scope !== "personal") return { ok: false, problems: ["This browser release supports personal curriculum exports."] };
    return exportsService.channels["omono:v3:export:curriculum-preview"](null, Object.assign({}, request || {}, { scope: "personal" }));
  });
  method("exportCurriculum", async function (request) {
    var pkg = await bridge.previewCurriculum(request);
    if (!pkg.ok) return pkg;
    var requested = [];
    for (var name of Object.keys(pkg.files || {})) {
      var result = await bridge.saveText(name, pkg.files[name]);
      if (!result || !result.saved) return { ok: false, files: requested, problems: ["A browser download could not be started."] };
      requested.push(name);
    }
    put("last-export", { last_export_at: Date.now(), last_export_kind: "curriculum", download_requested: true });
    return { ok: true, files: requested, problems: [], download_requested: true };
  });
  method("lastExport", function () { return get("last-export", { last_export_at: null, last_export_kind: null }); });
  R.services.storageAdapter = { storage: "browser", ready: true };
})(typeof window !== "undefined" ? window : globalThis);
