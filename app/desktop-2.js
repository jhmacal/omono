
"use strict";
/* The window. Everything below touches the DOM or the bridge; everything that can
   be decided without either lives in OMonoDesktop above.

   Three rules hold this file together:
   - User and model text reaches the screen through textContent or a text node.
     There is no innerHTML assignment anywhere in this script.
   - No model call happens here. The credential lives in the Keychain and the
     request is made in the main process (Contracts §16).
   - Compose, intermediary and result are states of one compact window. Nothing
     opens a second window and nothing maximizes. */

const D = OMonoDesktop;
const E = window.OMonoEngine;
const T = window.OMonoTeaching;
const P = window.OMonoPolicy;
const REGISTRY = window.OMONO_REGISTRY;
const SNAPSHOT = window.OMONO_REGISTER_SNAPSHOT;
const bridge = window.omono || null;

const $ = (id) => document.getElementById(id);
const VIEWS = ["viewCompose", "viewIntermediary", "viewResult", "viewComponent", "viewSourceCheck",
  "viewFix", "viewHistory", "viewLearn", "viewSettings", "viewMatterSetup",
  "viewRedact", "viewRestore", "viewVerify", "viewRegister", "viewWatch", "viewOnboard", "viewSetup"];
const LOCAL = { dest: "omono_v3_destination", purpose: "omono_v3_purpose" };

let activeView = "viewCompose";
let compactMaxHeight = 900;

/* ---------- state ---------- */
let attachments = [];       /* {id, label, type, excerpt, media, data, bytes} */
let purpose = [];
let transactionId = null;
let interpretation = null;  /* omono.interpret.v3 */
let confirmed = null;
/* What the user has decided on the intermediary, held outside the DOM so that
   re-rendering the view — which happens on every lesson toggle — cannot undo it.
   See D.draftInit / D.draftApply. */
let intermediaryDraft = null;
/* A generation that failed. Held so the intermediary can say what happened
   instead of the user being returned to an empty compose box. */
let generationError = null;
/* The owner's name, cached so a sheet can state it without awaiting. Refreshed
   whenever it could have changed; never used for authentication. */
let ownerDisplayName = "";
let generation = null;      /* omono.generate.v3 */
/* R2: the destination and the tool this prompt was actually compiled for,
   captured together the moment the generation lands and restored together when
   a prompt is reopened.

   Two readers used to answer "which destination is this" separately and at
   different moments: the fold traits, the chips, the prompt box and the result
   heading read the live `destination`, while toolAssemblyOptions re-read
   localStorage["omono.tool"] at its own moment. On the reference run that put
   ChatGPT's double_check sentences about dermatology citation errors at the
   foot of a prompt compiled for Opus 5.

   The tool cannot be derived from the destination: six of the eleven dossiers
   seat on the same engine profile, and the tool is what decides the assembly
   surface and the closing checks. So both travel, together, as one fact about
   one prompt. Null before a generation, when the live selection is the only
   answer there is. */
let promptTarget = null;    /* { destination, tool_id } */
let modelProfiles = [];
let destination = null;     /* {system_id, model_id, label, profile} */
let policyEvaluation = null;
let panel = null;           /* teaching panel */
let lessonState = { open_lesson_id: null };
let includeReasoning = false;
let whyOpen = false;
/* Round two (R5): smart write-back. The interpretation is cached against a
   hash of its exact input; pressing Write with the same input and an
   untouched prompt returns to the cached intermediary with no new interpret
   run. Any edit to the prompt text, direct or through a field, means Write
   is a fresh run again. */
let lastInterpretHash = null;
let promptTouched = false;
/* R-C: every Write or Confirm takes a fresh token; Cancel advances the
   token, so a reply that arrives after a cancel finds itself stale and is
   discarded without rendering. */
let runToken = 0;
function interpretInputHash(rawIdea) {
  const material = rawIdea + "\u0000" + JSON.stringify(purpose)
    + "\u0000" + attachments.map(a => a.id).join(",")
    + "\u0000" + (destination ? destination.system_id + " " + destination.model_id : "");
  let hash = 5381;
  for (let i = 0; i < material.length; i += 1) {
    hash = ((hash * 33) ^ material.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
/* P4: every Redact door, screen and mention leaves the interface while
   the code paths, tests and fixtures stay intact. Flip to return them. */
const REDACT_UI_ENABLED = false;
let entryId = null;
let promptDraft = "";
let localFindings = null;
let overrideUntilEdit = false;
let sourceCheckResult = null;
let fixResult = null;
let creatorState = null;
let recoveryEnabled = false;
let recoveryRevision = 0;
let recoverySaveTimer = null;
let recoverySaveChain = Promise.resolve(false);
let draftSaveTimer = null;
let historyLimit = 25;
let histQuery = "";
let histOutcomeFilter = "";
let historyRequest = 0;
let lastHistoryRows = [];
let checklist = null;
let verifyTick = null;
let watchState = null;
let resizeSession = null;

/* ---------- announce ---------- */
function announce(message) {
  const live = $("live");
  if (live) live.textContent = String(message || "");
}

/* ---------- safe DOM ----------
   Every helper below builds nodes. None of them accepts markup, which is what
   makes "never innerHTML for untrusted content" a property of the file rather
   than a habit. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}
function panelBox(heading, options) {
  const box = el("div", "panel" + (options && options.className ? " " + options.className : ""));
  if (heading) box.appendChild(el("h3", null, heading));
  return box;
}
function paragraph(text, className) {
  return el("p", className || null, text);
}
function trunc(value, max) {
  const s = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/* Let the person typing a password see what they typed. A text label rather than
   an eye glyph: createElement cannot build SVG, innerHTML is forbidden here, and
   a bare glyph would leave the control without an accessible name. The button
   reuses .tbtn[aria-pressed="true"], so this adds no CSS.

   D.passwordRevealLabel owns the state so the label, the pressed flag, the
   accessible name and the input's type cannot drift apart. */
function attachReveal(input, fieldName) {
  if (!input || input.dataset.revealWired === "1") return null;
  const button = el("button", "tbtn");
  button.type = "button";
  let revealed = false;
  const paint = () => {
    const state = D.passwordRevealLabel(revealed, fieldName);
    input.type = state.inputType;
    button.textContent = state.text;
    button.setAttribute("aria-pressed", state.ariaPressed);
    button.setAttribute("aria-label", state.ariaLabel);
  };
  button.addEventListener("click", () => {
    revealed = !revealed;
    paint();
    /* Keep the caret with the person who was typing. */
    input.focus();
  });
  /* A field that is cleared must never be left revealed: the next value typed
     into it would be on screen without anyone asking for it. */
  input.addEventListener("omono:concealed", () => { revealed = false; paint(); });
  paint();
  input.dataset.revealWired = "1";
  if (input.parentNode) input.parentNode.insertBefore(button, input.nextSibling);
  return button;
}

function conceal(input) {
  if (input) input.dispatchEvent(new Event("omono:concealed"));
}

/* A labelled free-text field. The label is a real label[for], above the box, and
   the box has room to hold a sentence — locked rules ERR-OM-6 and ERR-OM-9. No
   floating unlabelled inputs, and no skinny one-line field for prose. */
let bigBoxSeq = 0;
function bigBox(labelText, value, placeholder, onInput) {
  const wrap = el("div");
  const area = document.createElement("textarea");
  area.id = "bb" + (++bigBoxSeq);
  area.className = "bigbox";
  area.value = value || "";
  if (placeholder) area.placeholder = placeholder;
  area.addEventListener("input", () => onInput(area.value));
  const label = el("label", "fieldlabel", labelText);
  label.htmlFor = area.id;
  wrap.appendChild(label);
  wrap.appendChild(area);
  return wrap;
}

/* The four fields that exist in the markup. The two built by script wire
   themselves where they are constructed. */
for (const [id, name] of [["apiKey", "Anthropic API key"], ["obPass", "owner password"],
  ["obPass2", "repeated owner password"], ["obKey", "Anthropic API key"]]) {
  attachReveal($(id), name);
}

/* ---------- view switching and compact height ---------- */

/* Where the user came from. Recorded here rather than at each of the thirty
   call sites that navigate, so a new view cannot forget to take part. */
let navStack = [];
let navReturning = false;

function show(view) {
  if (!navReturning && activeView && activeView !== view) {
    navStack = D.navPush(navStack, activeView);
  }
  VIEWS.forEach(id => {
    const node = $(id);
    if (node) node.classList.toggle("hidden", id !== view);
  });
  activeView = view;
  requestAnimationFrame(fitHeight);
}

/* What is behind each view right now. navBack() checks this when popping, not
   when pushing, because state can disappear while an entry waits on the stack. */
function navFacts() {
  return {
    generation: !!generation,
    interpretation: !!interpretation,
    checklist: !!checklist
  };
}

/* The single back destination for every control and for Escape. There were two
   independently authored tables before, disagreeing on six views. */
function goBack() {
  const step = D.navBack(navStack, navFacts());
  navStack = step.stack;
  if (!step.view) { hideApp(); return; }
  navReturning = true;
  try {
    /* Two views are rebuilt from state rather than merely unhidden; the rest
       still hold what was last drawn into them. */
    if (step.view === "viewResult" && generation) renderResult();
    else if (step.view === "viewIntermediary" && interpretation) renderIntermediary();
    else show(step.view);
  } finally {
    navReturning = false;
  }
}

/* The window asks for the height its content needs; the main process caps it at
   the compact maximum and the body scrolls from there. The renderer never sets a
   size and never has a number that could grow without a ceiling. */
let lastFitHeight = null;
function fitHeight() {
  const view = $(activeView);
  if (!view || !bridge || !bridge.resize) return;
  const body = view.querySelector(".body");
  let measured = 0;
  if (body) {
    const chrome = view.scrollHeight - body.clientHeight;
    measured = body.scrollHeight + chrome;
  } else {
    /* F1 (D1): a bodyless view stretches to the window, so scrollHeight
       echoed the current height and the window could never shrink. Measure
       the real content instead: the lowest child's bottom edge plus the
       view's own bottom padding. */
    let bottom = 0;
    const viewTop = view.getBoundingClientRect().top;
    for (const child of view.children) {
      /* Out-of-flow children (the floating chip hint) sit at the window
         edge and must not count as content. */
      const position = getComputedStyle(child).position;
      if (position === "absolute" || position === "fixed") continue;
      const box = child.getBoundingClientRect();
      if (box.height > 0) bottom = Math.max(bottom, box.bottom - viewTop);
    }
    measured = Math.ceil(bottom + parseFloat(getComputedStyle(view).paddingBottom || "0"));
  }
  const wanted = D.contentHeightFor(measured, 34, compactMaxHeight);
  /* The expansion law: same target, no resize call; rapid summon-dismiss
     stays deterministic and nothing oscillates. */
  if (wanted === lastFitHeight) return;
  lastFitHeight = wanted;
  const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  bridge.resize(wanted, animate);
}

async function refreshWindowFacts() {
  if (!bridge || !bridge.windowState) return;
  try {
    const state = await bridge.windowState();
    if (state && Number.isFinite(state.compactMaxHeight)) compactMaxHeight = state.compactMaxHeight;
  } catch { /* the ceiling keeps its last known value */ }
}

/* ---------- theme ---------- */
async function loadTheme() {
  if (!bridge || !bridge.theme) return applyTheme({ source: "system", resolved: "light" });
  try { applyTheme(await bridge.theme()); }
  catch { applyTheme({ source: "system", resolved: "light" }); }
}
function applyTheme(report) {
  const resolved = D.resolveTheme(report);
  document.documentElement.setAttribute("data-theme", resolved.resolved);
  const select = $("themeSelect");
  if (select) select.value = resolved.source;
  const note = $("themeNote");
  if (note) {
    note.textContent = resolved.source === "system"
      ? "Following the system appearance, currently " + resolved.resolved + "."
      : "Set to " + resolved.source + " in this browser. This preference stays on this device.";
  }
  return resolved;
}

/* ---------- the input slot ----------
   One element owns the slot: the textarea, the loading chip, or the error chip.
   Nothing is ever layered over text somebody is reading. */
function slot(which) {
  $("idea").classList.toggle("hidden", which !== "idea");
  $("loadChip").classList.toggle("hidden", which !== "load");
  $("waitLessonHost").classList.toggle("hidden", which !== "lesson");
  $("errChip").classList.toggle("hidden", which !== "err");
}
/* ---------- the wait rotation (D3) ----------
   While a phase is in flight the input-bar line alternates: one of that
   phase's status lines for 3 seconds, then a lesson for 10, repeating,
   starting with the statuses. A phase change calls loading() again, which
   tears the rotation down and starts from the new phase's status, so the
   interrupt rule holds by construction. Lessons come from the pool selected
   at Write time: never the same lesson twice in one run, never one shown in
   the previous run. */
let loadingTimer = null;
let waitLessons = [];
/* The three lessons O'Mono selected locally before Interpret. */
let selectedLessons = null;
/* C2: true while the closing slot is the thing on screen. */
let closingSlotOnScreen = false;
/* Lesson three cannot open while Generate is still writing its binding line. */
$("loadingMsg").addEventListener("click", () => {
  /* C2: the third slot is the closing lesson and it has no written binding
     line yet, so there is no card to open. It says so rather than doing
     nothing, which reads as a dead control. */
  if (closingSlotOnScreen) {
    $("loadingMsg").textContent = D.CLOSING_SLOT_LINE;
    announce(D.CLOSING_SLOT_LINE);
    return;
  }
});
/* R-C: which phase the bar is thinking through, for Cancel's target. */
let activePhase = null;
function thinkingChrome(on) {
  const foot = document.querySelector("#viewCompose .compose-foot");
  if (foot) foot.classList.toggle("hidden", on);
  $("chipHint").classList.toggle("hidden", on);
  $("writeBtn").classList.toggle("hidden", on);
  $("cancelBtn").classList.toggle("hidden", !on);
  if (on && typeof closeDropdowns === "function") closeDropdowns();
}
function clearWaitLessonCard() {
  const host = $("waitLessonHost");
  if (!host) return;
  host.removeAttribute("data-revision-key");
  clear(host);
}
/* C2: the generate wait runs on a clock, not on the network.

   Four seconds of status, then lesson one in full for twenty, then status,
   then lesson two in full for twenty, then status, then the closing lesson's
   hook and its recall question for fifteen. Sixty-seven seconds. If generate
   returns first the result screen takes over and the rest of the cadence never
   runs; if it has not returned by sixty-seven, the overrun line goes up and
   stays up, which is the only place in this wait that mentions the wait. */
function loadingFixedCadence(lines) {
  const tone = lessonTone();
  const rotation = (selectedLessons && selectedLessons.rotation) || [];
  const closing = selectedLessons && selectedLessons.closing;
  const slots = [rotation[0] || null, rotation[1] || null, closing || null];
  const connections = (interpretation && interpretation.lesson_connections) || {};
  let statusIndex = 0;
  let fallbackIndex = 0;
  const started = Date.now();
  let lastIndex = -1;

  const paint = () => {
    const now = D.generateCadenceStepAt(Date.now() - started);
    const msg = $("loadingMsg");
    if (!now) {
      clearWaitLessonCard();
      slot("load");
      msg.textContent = D.OVERRUN_LINE;
      msg.classList.remove("waitlesson");
      msg.style.cursor = "";
      msg.removeAttribute("title");
      currentWaitLesson = null;
      closingSlotOnScreen = false;
      announce(D.OVERRUN_LINE);
      return; /* the overrun line is terminal: nothing follows it */
    }
    if (now.index !== lastIndex) {
      lastIndex = now.index;
      const step = now.step;
      if (step.kind === "status") {
        clearWaitLessonCard();
        slot("load");
        msg.textContent = lines[statusIndex % lines.length];
        statusIndex += 1;
        msg.classList.remove("waitlesson");
        msg.style.cursor = "";
        msg.removeAttribute("title");
        currentWaitLesson = null;
        closingSlotOnScreen = false;
      } else {
        const view = slots[step.slot];
        closingSlotOnScreen = step.kind === "closing";
        if (!view) {
          /* No lesson for this slot. The line says nothing about that. */
          clearWaitLessonCard();
          slot("load");
          msg.textContent = D.waitFallbackLine(tone, fallbackIndex);
          fallbackIndex += 1;
          msg.classList.remove("waitlesson");
          msg.style.cursor = "";
          msg.removeAttribute("title");
          currentWaitLesson = null;
          closingSlotOnScreen = false;
        } else if (step.form === "full" && (view.full_paint_eligible === false
            || paintedFullRevisionKeys.has(view.revision_key))) {
          /* The final one or two unseen lessons belong to the cycle already in
             progress. A next-cycle selection may fill the three named slots,
             but it cannot repeat as a complete card before that cycle closes. */
          clearWaitLessonCard();
          slot("load");
          msg.textContent = lines[statusIndex % lines.length];
          statusIndex += 1;
          msg.classList.remove("waitlesson");
          msg.style.cursor = "";
          msg.removeAttribute("title");
          currentWaitLesson = null;
          closingSlotOnScreen = false;
        } else if (step.form === "full") {
          const role = step.slot === 0 ? "lesson_1" : "lesson_2";
          const bindingLine = role === "lesson_1"
            ? String(connections.lesson_1 || "").trim()
            : String(connections.lesson_2 || "").trim();
          const host = clear($("waitLessonHost"));
          host.dataset.revisionKey = view.revision_key || "";
          host.appendChild(buildLessonCardV5(view, {
            binding_line: bindingLine,
            surface: "generate_wait",
            role: role
          }));
          slot("lesson");
          msg.classList.remove("waitlesson");
          msg.style.cursor = "";
          msg.removeAttribute("title");
          currentWaitLesson = null;
          closingSlotOnScreen = false;
          const paintedRevision = view.revision_key || "";
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (activePhase !== "generate" || activeView !== "viewCompose") return;
              if ($("waitLessonHost").classList.contains("hidden")) return;
              if ($("waitLessonHost").dataset.revisionKey !== paintedRevision) return;
              paintedFullRevisionKeys.add(paintedRevision);
              recordLessonDisplay(view, "generate_wait", role);
            });
          });
          announce([view.hook, view.mechanism, view.consequence, bindingLine]
            .filter(Boolean).join(" "));
        } else {
          clearWaitLessonCard();
          slot("load");
          msg.textContent = D.waitLessonText(view, step.form);
          msg.classList.add("waitlesson");
          msg.style.cursor = "pointer";
          msg.setAttribute("title", closingSlotOnScreen
            ? "This one closes on the next screen"
            : "Keep this one and read it on the next screen");
          currentWaitLesson = closingSlotOnScreen ? null : view.lesson_id;
          recordLessonImpression(view, "generate_wait", "lesson_3");
        }
      }
      if ($("waitLessonHost").classList.contains("hidden")) announce(msg.textContent);
      lastFitHeight = null;
      fitHeight();
    }
    loadingTimer = setTimeout(paint, 250);
  };
  paint();
}

function loading(on, lines, cadence) {
  clearTimeout(loadingTimer);
  loadingTimer = null;
  closingSlotOnScreen = false;
  if (!on) {
    clearWaitLessonCard();
    thinkingChrome(false);
    if ($("errChip").classList.contains("hidden")) slot("idea");
    return;
  }
  thinkingChrome(true);
  slot("load");
  if (cadence === "generate") { loadingFixedCadence(lines); return; }
  let statusIndex = 0;
  let lessonIndex = 0;
  let step = 0;
  const V4 = window.OMonoLessonsV4;
  $("loadingMsg").classList.remove("waitlesson");
  currentWaitLesson = null;
  $("loadingMsg").textContent = lines[0];
  announce(lines[0]);
  const advance = () => {
    step += 1;
    let plan = V4 ? V4.rotationStep(step) : { kind: "status", holdMs: 2200 };
    if (plan.kind === "lesson" && !waitLessons[lessonIndex]) {
      step += 1; /* pool exhausted: stay on the statuses */
      plan = V4 ? V4.rotationStep(step) : plan;
    }
    if (plan.kind === "lesson") {
      const lesson = waitLessons[lessonIndex];
      lessonIndex += 1;
      /* Pass four (L3): the wait shows the hook line only, and a tap pins
         the full card to the next screen.

         R10: a line that scrolled past in the loading bar is an IMPRESSION, not
         a lesson somebody read. It used to call markLessonShown — consuming the
         lesson's novelty for the whole run, so the card that followed had to
         pick something else — and recordLessonDisplay, so the record counted a
         teaching moment nobody opened. The growth loop decides what is missing
         by reading those counts, which made every quiet rotation look like
         coverage. The rotation now records itself as what it is. */
      $("loadingMsg").textContent = lesson.hook || lesson.line;
      $("loadingMsg").classList.add("waitlesson");
      $("loadingMsg").style.cursor = "default";
      $("loadingMsg").removeAttribute("title");
      currentWaitLesson = lesson.lesson_id;
      recordLessonImpression(lesson, "interpret_wait", "lesson_" + lessonIndex);
    } else {
      statusIndex = (statusIndex + 1) % lines.length;
      $("loadingMsg").textContent = lines[statusIndex];
      $("loadingMsg").classList.remove("waitlesson");
      currentWaitLesson = null;
    }
    /* The hold is the displayed item's own: 3s for a status, 10s for a lesson. */
    loadingTimer = setTimeout(advance, plan.holdMs);
  };
  loadingTimer = setTimeout(advance, V4 ? V4.rotationStep(0).holdMs : 2200);
}

/* Lesson history: which lessons this run and the previous run showed, and
   which have ever been shown (the first-ever animation fires once per lesson
   ever). localStorage, ids only, never content. */
const LESSON_STORE_KEY = "omono_v4_lessons";
function lessonHistory() {
  try { return JSON.parse(localStorage.getItem(LESSON_STORE_KEY) || "{}") || {}; }
  catch { return {}; }
}
function saveLessonHistory(history) {
  try {
    localStorage.setItem(LESSON_STORE_KEY, JSON.stringify(history));
    return true;
  } catch { return false; }
}
let shownThisRun = [];
/* Pass four (L3/L4): the canon pool's async companions. Approved additions
   and the record's repeated failure categories are cached so the card can
   render synchronously; a tapped wait line pins its lesson to the next
   screen. */
let approvedLessonCache = [];
let workingLessonCache = [];
let workingLessonCacheLoaded = false;
let repeatedFailureCache = [];
let repeatedSkippedFieldCache = [];
/* V3 (voice-and-depth): per-domain, per-level teaching stats from the
   store feed the promotion rule, and this run's own counters feed the
   recall share cap. */
let domainLevelStatsCache = {};
let sessionLessonMoments = 0;
let sessionRecallsShown = 0;
let pinnedLessonId = null;
let currentWaitLesson = null;
/* F1: the lesson this prompt actually got, so the result screen shows the same
   card the intermediary chose instead of showing one only when the wait line
   happened to be tapped. Reset by startNewPrompt with everything else. */
let runLessonSelection = null;
async function refreshWorkingLessonCache() {
  if (!bridge || !bridge.lessonsWorkingSet) return false;
  try {
    const result = await bridge.lessonsWorkingSet();
    if (!result || result.ok === false || !Array.isArray(result.lessons)) return false;
    workingLessonCache = result.lessons;
    workingLessonCacheLoaded = true;
    return true;
  } catch { return false; }
}
async function refreshPracticeSignalCache() {
  if (!bridge || !bridge.practiceCounts) return false;
  try {
    const counts = await bridge.practiceCounts();
    const byMonth = (counts && counts.failures_by_month) || {};
    const now = new Date();
    const months = [0, 1].map(back => {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    });
    repeatedFailureCache = Object.keys(byMonth).filter(category =>
      months.reduce((sum, month) => sum + (byMonth[category][month] || 0), 0) >= 2);
    repeatedSkippedFieldCache = Array.from(new Set(
      ((counts && counts.repeated_skipped_fields) || [])
        .map(field => String(field || "").trim().toLowerCase()).filter(Boolean)
    ));
    return true;
  } catch { return false; }
}
function refreshLessonCaches() {
  refreshWorkingLessonCache().then(() => flushLessonWrites());
  if (bridge && bridge.lessonsApproved) {
    bridge.lessonsApproved().then(r => {
      approvedLessonCache = (r && r.lessons) || [];
    }).catch(() => {});
  }
  /* V3: coverage's two matrices are exactly the promotion inputs —
     moments from the exposure matrix, distinct lessons from the other. */
  if (bridge && bridge.lessonCoverage && window.OMonoLessonCanonV5) {
    bridge.lessonCoverage({ canon: window.OMonoLessonCanonV5.lessons }).then(r => {
      if (!r || !r.ok) return;
      const stats = {};
      const matrix = r.matrix || {};
      const exposures = r.matrix_exposures || {};
      Object.keys(exposures).forEach(domain => {
        stats[domain] = {};
        Object.keys(exposures[domain] || {}).forEach(level => {
          stats[domain][level] = {
            moments: (exposures[domain] || {})[level] || 0,
            distinct: (matrix[domain] || {})[level] || 0
          };
        });
      });
      domainLevelStatsCache = stats;
    }).catch(() => {});
  }
  refreshPracticeSignalCache();
}
function lessonPoolV5() {
  const E5 = window.OMonoLessonEngineV5;
  const canon = window.OMonoLessonCanonV5;
  if (!E5 || !canon) return [];
  if (workingLessonCacheLoaded) {
    return E5.poolFrom(workingLessonCache, [], lessonTone());
  }
  return E5.poolFrom(canon.lessons, approvedLessonCache, lessonTone());
}
/* The facts the binding line and the selection read: everything interpret
   already produced, nothing invented (L4). */
function lessonFacts(ideaText, beforeInterpret) {
  /* D9: the fold reads two traits; teaching reads three. A destination O'Mono
     could not verify is not a destination with no quirks — it is the one where
     model-behaviour teaching matters most — and the fold has no business
     knowing that, so the third trait is added here and nowhere else. */
  /* R2: after a generation the teaching describes the prompt that exists, so
     it reads the target that prompt was compiled for. */
  const activeInterpretation = beforeInterpret ? null : interpretation;
  const E5 = window.OMonoLessonEngineV5;
  const localRisk = beforeInterpret && E5 && typeof E5.localPreInterpretRiskFacts === "function"
    ? E5.localPreInterpretRiskFacts(ideaText) : { task_family: "", risk_ids: [] };
  const target = beforeInterpret ? destination : promptDestination();
  const profile = target && target.profile;
  const traits = Object.assign(D.destinationTraits(profile),
    { unverified: !!(profile && profile.status === "unknown") });
  const skipped = beforeInterpret ? repeatedSkippedFieldCache.slice() : [];
  try {
    if (!beforeInterpret && generation && Array.isArray(generation.components)) {
      D.fieldChips(generation.components, traits).forEach(chip => {
        /* field_id is the chip's own key; `chip.field` never existed, so this
           was reading the display label and lowercasing it and happening to
           agree for seven of the eight. */
        if (!chip.included) skipped.push(String(chip.field_id || "").toLowerCase());
      });
    }
  } catch { /* facts stay partial */ }
  const classes = (activeInterpretation && activeInterpretation.data && activeInterpretation.data.classes)
    || (localFindings && localFindings.classes) || [];
  return {
    idea_text: typeof ideaText === "string" ? ideaText : $("idea").value.trim(),
    destination_label: target ? (target.label || target.model_id) : "",
    traits,
    task_family: activeInterpretation && activeInterpretation.task
      ? String(activeInterpretation.task.family || "") : localRisk.task_family,
    data_classes: classes.map(value => {
      const match = String(value || "").match(/^c([1-8])(?:_|$)/i);
      return match ? "C" + match[1] : String(value || "");
    }),
    risk_ids: beforeInterpret ? localRisk.risk_ids
      : ((panel && panel.coaching) || []).map(u => u && u.risk_id).filter(Boolean),
    skipped_fields: skipped,
    repeated_failure_categories: repeatedFailureCache
  };
}
/* How much teaching each domain has already had, from the ever-seen record.
   Shared by both screens that select, so they cannot drift apart. */
function lessonDomainExposure(pool, history) {
  const exposure = {};
  Object.keys((history && history.ever) || {}).forEach(id => {
    const view = pool.find(v => v.lesson_id === id);
    if (view) exposure[view.domain] = (exposure[view.domain] || 0) + 1;
  });
  return exposure;
}
/* D9: why this lesson holds for this prompt, whatever route put it on screen.
   `breadth` is the honest fall-through — it is what the engine itself means by
   a candidate that only widens coverage — so it is named rather than passed as
   null and reconstructed downstream. */
function lessonReasonFor(view, facts) {
  const E5 = window.OMonoLessonEngineV5;
  if (!E5 || !view) return "breadth";
  return E5.matchReason(view, facts || lessonFacts()) || "breadth";
}
/* Pass four (L1): one emission per lesson per run. The emission record and
   the engagement events live in the lesson store; ids only, never content. */
const emittedThisRun = new Set();
const paintedFullRevisionKeys = new Set();
const LESSON_WRITE_QUEUE_KEY = "omono_v4_lesson_write_queue";
let lessonWriteQueue = loadLessonWriteQueue();
let lessonWriteFlush = null;
let lessonWriteRetryTimer = null;
let lessonActionSequence = 0;
/* R10: a hook that went past in the loading bar. Logged as an impression so the
   engagement record still knows the line was on screen, and deliberately NOT a
   display: it does not count as a teaching moment, it does not consume the
   lesson's novelty, and the growth loop does not read it as coverage. */
const recordedActionsThisPrompt = new Set();
function loadLessonWriteQueue() {
  try {
    const stored = JSON.parse(localStorage.getItem(LESSON_WRITE_QUEUE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(item => item && typeof item.key === "string"
      && (item.type === "action" || item.type === "full")).map(item =>
        Object.assign({}, item, { durably_queued: true })) : [];
  } catch { return []; }
}
function saveLessonWriteQueue() {
  try {
    localStorage.setItem(LESSON_WRITE_QUEUE_KEY, JSON.stringify(lessonWriteQueue));
    return true;
  } catch { return false; }
}
function scheduleLessonWriteRetry() {
  if (lessonWriteRetryTimer) return;
  lessonWriteRetryTimer = setTimeout(() => {
    lessonWriteRetryTimer = null;
    flushLessonWrites();
  }, 2000);
}
function applyDurableLessonSuppression(item) {
  if (!item || !item.suppression_key) return;
  if (item.type === "full") {
    if (!emittedThisRun.has(item.suppression_key)) sessionLessonMoments += 1;
    emittedThisRun.add(item.suppression_key);
  } else if (item.suppress_once === true) {
    recordedActionsThisPrompt.add(item.suppression_key);
  }
}
function persistPendingLessonWrites() {
  const pending = lessonWriteQueue.filter(item => item.durably_queued !== true);
  if (!pending.length) return true;
  pending.forEach(item => { item.durably_queued = true; });
  if (saveLessonWriteQueue()) {
    pending.forEach(applyDurableLessonSuppression);
    return true;
  }
  pending.forEach(item => { item.durably_queued = false; });
  scheduleLessonWriteRetry();
  return false;
}
function enqueueLessonWrite(item) {
  if (!item || !item.key) return false;
  const existing = lessonWriteQueue.find(queued => queued.key === item.key
    || (item.logical_key && queued.logical_key === item.logical_key
      && queued.durably_queued !== true));
  if (existing) {
    if (existing.durably_queued === true || persistPendingLessonWrites()) {
      applyDurableLessonSuppression(existing);
      flushLessonWrites();
      return true;
    }
    return false;
  }
  item.durably_queued = false;
  lessonWriteQueue.push(item);
  if (!persistPendingLessonWrites()) return false;
  flushLessonWrites();
  return true;
}
function completeSeenForSelection(pool, persistedRevisionKeys) {
  const E5 = window.OMonoLessonEngineV5;
  let seen = Array.isArray(persistedRevisionKeys) ? persistedRevisionKeys.slice() : [];
  if (!E5 || typeof E5.advanceCompleteCycle !== "function") return seen;
  const activeRevisions = {};
  pool.forEach(view => { activeRevisions[view.revision_key] = true; });
  lessonWriteQueue.forEach(item => {
    if (!item || item.type !== "full" || item.cycle_finalized === true
        || typeof item.revision_key !== "string") return;
    if (item.cycle_target_prepared === true
        && Array.isArray(item.prepared_complete_seen_revisions)) {
      if (activeRevisions[item.revision_key]) {
        seen = item.prepared_complete_seen_revisions.slice();
      }
      return;
    }
    const advanced = E5.advanceCompleteCycle(pool, seen, item.revision_key);
    seen = advanced.completeSeenRevisionKeys;
  });
  return seen;
}
function finishSavedFullLesson(item) {
  /* On recovery, wait until the authoritative working set has loaded. If the
     revision was retired meanwhile, its saved historical row remains true but
     it no longer belongs in the active no-repeat cycle. */
  if (!workingLessonCacheLoaded) return false;
  const revision = String(item.revision_key || "");
  const pool = lessonPoolV5();
  const active = pool.some(view => view.revision_key === revision);
  if (active) {
    const E5 = window.OMonoLessonEngineV5;
    if (!E5 || typeof E5.advanceCompleteCycle !== "function") return false;
    const history = lessonHistory();
    if (item.cycle_target_prepared !== true
        || !Array.isArray(item.prepared_complete_seen_revisions)) {
      const advanced = E5.advanceCompleteCycle(pool,
        history.complete_seen_revisions || [], revision);
      item.cycle_target_prepared = true;
      item.prepared_complete_seen_revisions = advanced.completeSeenRevisionKeys.slice();
      if (!saveLessonWriteQueue()) {
        item.cycle_target_prepared = false;
        delete item.prepared_complete_seen_revisions;
        return false;
      }
    }
    history.complete_seen_revisions = item.prepared_complete_seen_revisions.slice();
    const nextShownThisRun = shownThisRun.indexOf(item.lesson_id) === -1
      ? shownThisRun.concat([item.lesson_id]) : shownThisRun.slice();
    history.ever = history.ever || {};
    history.ever[item.lesson_id] = Number(item.action && item.action.occurred_at) || Date.now();
    history.current_run = nextShownThisRun;
    if (!saveLessonHistory(history)) return false;
    shownThisRun = nextShownThisRun;
  }
  return true;
}
async function flushLessonWrites() {
  if (lessonWriteFlush || !bridge) return lessonWriteFlush;
  if (lessonWriteRetryTimer) { clearTimeout(lessonWriteRetryTimer); lessonWriteRetryTimer = null; }
  if (!persistPendingLessonWrites()) return null;
  lessonWriteFlush = (async () => {
    while (lessonWriteQueue.length) {
      const item = lessonWriteQueue[0];
      try {
        if (item.durably_queued !== true && !persistPendingLessonWrites()) return;
        if (item.type === "action") {
          if (!bridge.lessonEngage) return;
          const action = await bridge.lessonEngage(item.payload);
          if (!action || action.ok !== true) return;
        } else {
          if (!bridge.lessonEmit || !bridge.lessonEngage) return;
          if (item.emission_saved !== true) {
            const emission = await bridge.lessonEmit(item.emission);
            if (!emission || emission.ok !== true) return;
            item.emission_saved = true;
            saveLessonWriteQueue();
          }
          if (item.full_action_saved !== true) {
            const action = await bridge.lessonEngage(item.action);
            if (!action || action.ok !== true) return;
            item.full_action_saved = true;
            saveLessonWriteQueue();
          }
          if (item.cycle_finalized !== true) {
            if (!finishSavedFullLesson(item)) return;
            item.cycle_finalized = true;
            if (!saveLessonWriteQueue()) {
              item.cycle_finalized = false;
              return;
            }
          }
        }
        lessonWriteQueue.shift();
        saveLessonWriteQueue();
      } catch { return; }
    }
  })().finally(() => {
    lessonWriteFlush = null;
    if (lessonWriteQueue.length) scheduleLessonWriteRetry();
  });
  return lessonWriteFlush;
}
function recordLessonAction(kindOrEvent, viewArg, surfaceArg, roleArg) {
  const event = kindOrEvent && typeof kindOrEvent === "object"
    ? kindOrEvent : { kind: kindOrEvent, view: viewArg, surface: surfaceArg, role: roleArg };
  const view = event.view;
  if (!view || !view.lesson_id || !Number.isInteger(view.version) || !transactionId) return;
  const key = [transactionId, event.kind, view.revision_key || view.lesson_id + "@" + view.version,
    event.surface || "", event.role || ""].join("|");
  const oncePerSurface = ["selected", "hook_shown", "full_shown"].indexOf(event.kind) > -1;
  if (oncePerSurface && recordedActionsThisPrompt.has(key)) return;
  const eventId = newLessonRecordId("lesson-action");
  const payload = { kind: event.kind, lesson_id: view.lesson_id,
    lesson_version: view.version, transaction_id: transactionId,
    surface: event.surface, role: event.role, occurred_at: Date.now(), event_id: eventId };
  const queueKey = "action|" + eventId + "|" + (++lessonActionSequence);
  enqueueLessonWrite({ type: "action", key: queueKey,
    logical_key: oncePerSurface ? "action|" + key : null,
    suppression_key: key, suppress_once: oncePerSurface, payload });
}
function recordLessonImpression(view, surface, role) {
  recordLessonAction({ kind: "hook_shown", view, surface, role });
}
function recordLessonDisplay(view, context, role, surface) {
  if (!view || !view.lesson_id || !Number.isInteger(view.version) || !transactionId) return;
  const revision = view.revision_key || view.lesson_id + "@" + view.version;
  const visibleSurface = surface || context || "lesson";
  const recordKey = [transactionId, revision, visibleSurface, role || ""].join("|");
  if (emittedThisRun.has(recordKey)) return;
  const audience = (typeof appMode === "string" && appMode !== "personal") ? "cohort" : "user";
  const displayedAt = Date.now();
  const displayId = newLessonRecordId("lesson-display");
  const identity = { lesson_id: view.lesson_id, lesson_version: view.version,
    transaction_id: transactionId, surface: visibleSurface, role,
    occurred_at: displayedAt, display_id: displayId };
  enqueueLessonWrite({
    type: "full",
    key: "full|" + displayId,
    logical_key: "full-display|" + recordKey,
    suppression_key: recordKey,
    revision_key: revision,
    lesson_id: view.lesson_id,
    emission: Object.assign({}, identity, { context: context || "lesson",
      delivery_context: "full", audience }),
    action: Object.assign({ kind: "full_shown",
      event_id: newLessonRecordId("lesson-action") }, identity)
  });
}
function markLessonShown(lessonId) {
  if (shownThisRun.indexOf(lessonId) === -1) shownThisRun.push(lessonId);
  const history = lessonHistory();
  history.ever = history.ever || {};
  history.ever[lessonId] = Date.now();
  history.current_run = shownThisRun;
  saveLessonHistory(history);
}
/* At launch the previous run's list rolls over and this run starts empty. */
(function rolloverLessonRuns() {
  const history = lessonHistory();
  history.last_run = Array.isArray(history.current_run) ? history.current_run : [];
  history.current_run = [];
  saveLessonHistory(history);
})();
function lessonTone() {
  const V4 = window.OMonoLessonsV4;
  try { return V4.normalizeTone(localStorage.getItem("omono_v4_tone") || "straight"); }
  catch { return "straight"; }
}
let pendingError = null;
function showError(view) {
  pendingError = view;
  const chip = $("errChip");
  clear(chip);
  chip.appendChild(el("span", null, view.headline + " " + view.action));
  chip.appendChild(document.createTextNode("  (click for detail)"));
  slot("err");
  announce(view.headline + " " + view.action);
  fitHeight();
}
function showErrorText(headline, action) {
  showError({ state: "local", headline, action, repairable: false, technical: [] });
}
$("errChip").addEventListener("click", () => openErrorDetail());
$("errChip").addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openErrorDetail(); }
});
function openErrorDetail() {
  if (!pendingError || !pendingError.technical.length) {
    pendingError = null;
    slot("idea");
    $("idea").focus();
    return;
  }
  const body = $("setBody");
  /* Technical detail is shown in place, under the error, rather than replacing
     the message with a parser dump. */
  const chip = $("errChip");
  clear(chip);
  chip.appendChild(el("span", null, pendingError.headline + " " + pendingError.action));
  const list = el("div", "snote");
  pendingError.technical.forEach(line => list.appendChild(el("div", null, line)));
  chip.appendChild(list);
  pendingError = null;
  void body;
  fitHeight();
}

/* ---------- the landing dropdowns (R-A) ----------
   Purpose and Menu are dropdown pills by ruling. Escape closes, focus
   returns to the pill, there is no trap, and the window grows to fit the
   open panel then shrinks back; nothing animates, so reduce-motion is
   already a snap. */
/* U3: the panels are true popovers — frameless transparent child windows
   floating over, and past the edges of, the main window. "child" ships;
   "grow" is the ruled fallback (the pre-U3 in-window panels plus a window
   grow), kept behind this constant. */
const POPOVER_MODE = "inline";
let popoverOpenPanel = null;

function popoverSpecFor(pillId, panelId) {
  const rect = $(pillId).getBoundingClientRect();
  const items = [];
  if (panelId === "mainDropdown") {
    items.push({ header: $("composeCount").textContent || "" });
    [["redactBtn", "Redact"], ["verifyLoopBtn", "Verification"],
      ["restoreBtn", "Restore"], ["historyBtn", "History"], ["settingsBtn", "Settings"]]
      .forEach(([id, label]) => {
        const node = $(id);
        if (!node || node.classList.contains("hidden")) return;
        items.push({ id, label,
          note: id === "verifyLoopBtn" ? ($("verifyMenuCount").textContent || "") : "",
          title: node.title || "" });
      });
  } else {
    D.PURPOSE_CHIPS.forEach(chip => {
      items.push({ id: "chip-" + chip.id, label: chip.label, checkable: true,
        checked: purpose.indexOf(chip.id) !== -1, title: chip.explanation });
    });
  }
  const width = panelId === "mainDropdown" ? 250 : 300;
  const height = 26 + items.length * 36;
  return {
    panel: panelId, items, width, height,
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    x: Math.round(rect.right - width + 10),
    y: Math.round(rect.bottom + 4)
  };
}

function closeDropdowns() {
  if (POPOVER_MODE === "child") {
    if (popoverOpenPanel && bridge && bridge.popoverDismiss) bridge.popoverDismiss();
    popoverOpenPanel = null;
    $("purposeMenuBtn").setAttribute("aria-expanded", "false");
    $("mainMenuBtn").setAttribute("aria-expanded", "false");
    return;
  }
  let wasOpen = false;
  [["purposeMenuBtn", "purposeDropdown"], ["mainMenuBtn", "mainDropdown"]].forEach(([pillId, panelId]) => {
    const panel = $(panelId);
    if (!panel.classList.contains("hidden")) wasOpen = true;
    panel.classList.add("hidden");
    $(pillId).setAttribute("aria-expanded", "false");
  });
  if (wasOpen) { lastFitHeight = null; fitHeight(); }
}
function toggleDropdown(pillId, panelId) {
  if (POPOVER_MODE === "child" && bridge && bridge.popoverOpen) {
    const wasOpen = popoverOpenPanel === panelId;
    closeDropdowns();
    if (wasOpen) { $(pillId).focus(); return; }
    popoverOpenPanel = panelId;
    $(pillId).setAttribute("aria-expanded", "true");
    bridge.popoverOpen(popoverSpecFor(pillId, panelId));
    return;
  }
  const pill = $(pillId);
  const panel = $(panelId);
  const wasHidden = panel.classList.contains("hidden");
  closeDropdowns();
  if (!wasHidden) { pill.focus(); return; }
  const rect = pill.getBoundingClientRect();
  panel.style.top = Math.round(rect.bottom + 6) + "px";
  panel.style.right = Math.max(12, Math.round(window.innerWidth - rect.right)) + "px";
  panel.classList.remove("hidden");
  pill.setAttribute("aria-expanded", "true");
  const needed = Math.ceil(panel.getBoundingClientRect().bottom + 18);
  if (needed > window.innerHeight && bridge && bridge.resize) {
    lastFitHeight = D.contentHeightFor(needed, 34, compactMaxHeight);
    bridge.resize(lastFitHeight, !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  const first = panel.querySelector("button:not(.hidden)");
  if (first) first.focus();
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const open = !$("purposeDropdown").classList.contains("hidden")
    || !$("mainDropdown").classList.contains("hidden");
  if (!open) return;
  const purposeOpen = !$("purposeDropdown").classList.contains("hidden");
  closeDropdowns();
  $(purposeOpen ? "purposeMenuBtn" : "mainMenuBtn").focus();
  event.stopPropagation();
}, true);
document.addEventListener("click", (event) => {
  if (event.target.closest(".dropdown") || event.target.closest(".droppill")) return;
  closeDropdowns();
});

/* Purpose is the same four options with the same multi-select semantics
   the chips carried; only the control changed. The pill label wears the
   active selection. */
function purposePillLabel() {
  const picked = D.PURPOSE_CHIPS.filter(chip => purpose.indexOf(chip.id) > -1);
  if (!picked.length) return "Purpose \u25be";
  const head = "Purpose: " + picked[0].label;
  return (picked.length > 1 ? head + " +" + (picked.length - 1) : head) + " \u25be";
}
function renderPurposeChips() {
  const host = $("purposeDropdown");
  clear(host);
  D.PURPOSE_CHIPS.forEach(chip => {
    const button = el("button", "menuitem", chip.label);
    button.type = "button";
    button.id = "chip-" + chip.id;
    button.setAttribute("role", "menuitemcheckbox");
    button.setAttribute("aria-checked", purpose.indexOf(chip.id) === -1 ? "false" : "true");
    button.title = chip.explanation;
    button.setAttribute("aria-label", chip.label + ". " + chip.explanation);
    const describe = () => { $("chipHint").textContent = chip.explanation; };
    const undescribe = () => { $("chipHint").textContent = ""; };
    button.addEventListener("mouseenter", describe);
    button.addEventListener("focus", describe);
    button.addEventListener("mouseleave", undescribe);
    button.addEventListener("blur", undescribe);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      purpose = D.togglePurpose(purpose, chip.id);
      try { localStorage.setItem(LOCAL.purpose, JSON.stringify(purpose)); } catch { /* private mode */ }
      renderPurposeChips();
      const again = $("chip-" + chip.id);
      if (again) again.focus();
      announce(chip.label + (purpose.indexOf(chip.id) === -1 ? " off" : " on"));
    });
    host.appendChild(button);
  });
  $("purposeMenuBtn").textContent = purposePillLabel();
}

/* ---------- attachments ----------
   Explicit only. Nothing is read from the clipboard or the filesystem without a
   button press, and the excerpt is what travels in the interpretation request. */
function renderAttachments() {
  const state = $("ctxState");
  if (!attachments.length) {
    state.classList.add("hidden");
    state.onclick = null;
    return;
  }
  state.textContent = "Using: " + attachments.map(a => a.label).join(" + ") + "  ×";
  state.classList.remove("hidden");
  state.style.cursor = "pointer";
  state.title = "Click to remove every attachment";
  state.onclick = () => { attachments = []; renderAttachments(); fitHeight(); };
}
function addAttachment(entry) {
  attachments = attachments.concat([entry]).slice(0, 8);
  renderAttachments();
  fitHeight();
}
/* One control. There used to be three: clipboard text, clipboard image, and a
   file picker. The clipboard-text path is gone because the idea box is directly
   above it and pasting there is the shorter route, and the clipboard-image path
   is gone because the picker already takes images. The privacy rule is unchanged
   and is now easier to state: nothing is read without an explicit pick. */
async function attachFile() {
  if (!bridge) return;
  const file = await bridge.pickContextFile();
  if (!file) { announce("Nothing was attached."); return; }
  if (file.tooBig) {
    showErrorText("That file is larger than O'Mono will attach.",
      "The limit is 8 MB. Attach a smaller file or a page from it.");
    return;
  }
  addAttachment({
    id: "att-" + attachments.length + "-" + Date.now().toString(36),
    label: file.label,
    type: file.media === "application/pdf" ? "file" : "image",
    excerpt: "",
    media: file.media,
    data: file.data,
    bytes: file.bytes
  });
}
/* R-A: the chips row and its label are gone; the Purpose pill's own title
   and the per-item explanations carry the answer now. */

$("attachBtn").addEventListener("click", () => attachFile());

/* An image that only ever lived on the clipboard, never saved to a file, cannot
   be reached by a file picker. Paste is the way in.

   This deliberately does NOT restore the old clipboard-read IPC channel. A paste
   event hands the renderer the data because the user pressed the keys; there is
   no standing capability to read the clipboard, which is the property the
   channel's removal bought. Text paste is untouched and still lands in the box.

   The cap and the label match attachFile, so an attachment behaves the same
   however it arrived. */
const PASTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

$("idea").addEventListener("paste", async (event) => {
  const data = event.clipboardData;
  if (!data) return;
  const item = Array.from(data.items || [])
    .find(i => i.kind === "file" && PASTED_IMAGE_TYPES.indexOf(i.type) !== -1);
  if (!item) return;                       /* text paste: leave it alone */
  const file = item.getAsFile();
  if (!file) return;
  event.preventDefault();                  /* an image must not land as a filename */

  if (file.size > 8 * 1024 * 1024) {
    showErrorText("That image is larger than O'Mono will attach.",
      "The limit is 8 MB. Paste a smaller image or attach a file.");
    return;
  }
  let base64 = "";
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    base64 = btoa(binary);
  } catch (error) {
    showErrorText("That image could not be read.", "Try attaching it as a file instead.");
    return;
  }
  addAttachment({
    id: "att-" + attachments.length + "-" + Date.now().toString(36),
    label: "pasted image (" + (file.size < 1024
      ? file.size.toLocaleString() + " bytes"
      : Math.round(file.size / 1024).toLocaleString() + " KB") + ")",
    type: "image",
    excerpt: "",
    media: file.type,
    data: base64,
    bytes: file.size
  });
  announce("Image attached from the clipboard.");
});

/* ---------- destination ---------- */
async function loadProfiles() {
  if (!bridge || !bridge.modelProfiles) return [];
  try {
    const result = await bridge.modelProfiles();
    modelProfiles = (result && result.profiles) || [];
  } catch { modelProfiles = []; }
  if (!destination && modelProfiles.length) {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(LOCAL.dest) || "null"); } catch { stored = null; }
    /* Restoring what was already saved is not a new decision. F4: the opening
       default is the selected tool's own engine seat where there is one, and
       never a retired or deprecated profile. R1: the saved destination is a
       PREFERENCE, honoured only where the selected tool offers it, so a default
       left behind by another tool cannot open the window in disagreement with
       the tool select. The flat-table tail stays as the last resort for a stack
       with no readable dossier at all: no destination is a worse failure than a
       reconciled one, because interpret() refuses to run without one. */
    setDestination(destinationForSelectedTool(stored)
      || offerableProfiles()[0] || modelProfiles[0], "restore");
  }
  return modelProfiles;
}
/* `source` decides whether this also becomes the saved default. It used to
   persist unconditionally, so accepting a recommendation for one prompt quietly
   rewrote the user's global default. */
function setDestination(profile, source, remember) {
  if (!profile) return;
  destination = {
    system_id: profile.system_id,
    model_id: profile.model_id,
    label: profile.label || (profile.system_id + " " + profile.model_id),
    profile
  };
  if (!D.shouldPersistDestination(source, remember)) return;
  try {
    localStorage.setItem(LOCAL.dest,
      JSON.stringify({ system_id: profile.system_id, model_id: profile.model_id }));
  } catch { /* private mode */ }
}
function renderDestinationSelect() {
  const select = $("destSelect");
  clear(select);
  /* F4: retired and deprecated engine entries are never offered, here either.
     R1: and the choice here is scoped to the selected tool, the same rule the
     intermediary picker follows. Offering the flat engine table made this the
     one control that could save a default the selected tool does not own, and a
     saved default the tool refuses is a Settings screen naming a destination no
     prompt will ever go to.

     The option values also carried a literal NUL as their separator while the
     intermediary picker used a space. Both were self-consistent, so neither was
     broken; two controls answering the same question in two encodings is how
     they drift. One encoding now, and no NUL byte in the source. */
  const dossier = dossierById(selectedToolId());
  const offered = dossier ? profilesForTool(dossier) : offerableProfiles();
  offered.forEach(profile => {
    const option = el("option", null, profile.label || (profile.system_id + " " + profile.model_id));
    option.value = profile.system_id + " " + profile.model_id;
    select.appendChild(option);
  });
  if (destination) select.value = destination.system_id + " " + destination.model_id;
  select.disabled = !offered.length;
  const note = $("destNote");
  const chosen = destination && destination.profile;
  if (!chosen) { note.textContent = ""; return; }
  const warnings = Array.isArray(chosen.warnings) ? chosen.warnings : [];
  /* A tool that lists no models has no choice to offer, so its seat is named
     rather than a dropdown sitting there doing nothing. */
  const choiceState = dossier
    ? D.modelChoiceState(dossier, modelProfiles, today10()) : null;
  const lead = !choiceState || choiceState.state === "offered" ? ""
    : D.modelChoiceLine(choiceState, dossier.display_name, chosen.label) + " ";
  note.textContent = lead + "Profile " + chosen.profile_version + ", status " + chosen.status + "." +
    (warnings.length ? " " + warnings.map(w => w.message || w.code).join(" ") : "");
}
$("destSelect").addEventListener("change", () => {
  const [system, model] = $("destSelect").value.split(" ");
  /* R1: resolved inside the selected tool's own offer, never the flat table. */
  const profile = destinationForSelectedTool({ system_id: system, model_id: model });
  setDestination(profile, "settings");
  renderDestinationSelect();
});

/* ---------- transaction ids ----------
   Created before the call, random, and never a person identifier
   (Contracts §3.5.4, §8). */
function newTransactionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return "tx-" + window.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  (window.crypto || {}).getRandomValues && window.crypto.getRandomValues(bytes);
  return "tx-" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function newLessonRecordId(prefix) {
  const transaction = newTransactionId();
  return String(prefix || "lesson-event") + "-" + transaction.slice(3);
}

/* ---------- the local layer ----------
   The only control that can prevent a transmission. Every model-based check has
   already sent the thing by the time it answers. */
async function screenLocally(text) {
  if (!bridge || !bridge.screenText) return null;
  try { return await bridge.screenText(text, undefined); }
  catch { return null; }
}

async function evaluatePolicy(extra) {
  if (!bridge || !bridge.policyEvaluate) return null;
  const payload = Object.assign({
    local_finding: localFindings ? {
      classes: localFindings.classes,
      subject: localFindings.subject,
      spans: (localFindings.spans || []).length
    } : null,
    secrets: localFindings ? localFindings.secrets : null,
    spans: localFindings ? localFindings.spans : null,
    model_classification: interpretation ? interpretation.data : null,
    destination: destination ? { system_id: destination.system_id, model_id: destination.model_id } : null
  }, extra || {});
  try { return await bridge.policyEvaluate(payload); }
  catch { return null; }
}

/* ---------- phase A: interpret ---------- */
const LINES_A = ["Reading your intent…", "Marking what I would be guessing…", "Checking what needs asking…"];
const LINES_B = ["Building the prompt…", "Deciding what earns its place…", "Setting the safeguards…"];

async function interpret() {
  const rawIdea = $("idea").value.trim();
  if (!rawIdea) { $("idea").focus(); return; }
  if (!destination) {
    showErrorText("O'Mono has no destination to build for.",
      "Choose one in Settings.");
    return;
  }
  /* Pass four (P3): the engine-level credential halt is gone with the
     screening one below. A detected credential classifies (C7), logs, and
     speaks through the advisory; it never gates the flow. */
  /* Round two (R5): same input, untouched prompt: back to the cached
     intermediary, no new interpret run, no new cost. */
  if (interpretation && lastInterpretHash
      && interpretInputHash(rawIdea) === lastInterpretHash && !promptTouched) {
    renderIntermediary();
    return;
  }

  const combined = rawIdea + attachments.map(a => a.excerpt ? "\n" + a.excerpt : "").join("");
  /* Owner ruling, 2026-09-17: the screener is off in Personal. The idea is not
     scanned locally; both enterprise modes keep the scan. */
  localFindings = appMode === "personal" ? null : await screenLocally(combined);
  policyEvaluation = await evaluatePolicy({});
  /* Pass four (P3): nothing halts anywhere for any classification. A
     detected credential classifies, logs to the ledger, and speaks through
     the advisory line like every other class; the Redact surface still
     offers itself whenever policy has a redaction path, and the privacy
     declaration hides both, like every other class. */
  $("redactBtn").classList.toggle("hidden", !REDACT_UI_ENABLED || destinationsPrivate()
    || !(policyEvaluation && policyEvaluation.redaction_path && policyEvaluation.redaction_path.available));

  transactionId = newTransactionId();
  emittedThisRun.clear();
  paintedFullRevisionKeys.clear();
  recordedActionsThisPrompt.clear();
  selectedLessons = null;
  waitLessons = [];
  pinnedLessonId = null;
  currentWaitLesson = null;
  await refreshWorkingLessonCache();
  await refreshPracticeSignalCache();
  const token = ++runToken;
  activePhase = "interpret";
  $("writeBtn").disabled = true;
  /* O'Mono selects all three lessons locally before Interpret. Haiku receives
     only the first two lesson bodies so it can write their prompt-specific
     connection lines; it never receives lesson ids or the canon. */
  {
    const history = lessonHistory();
    const pool = lessonPoolV5();
    const E5 = window.OMonoLessonEngineV5;
    const completeSeen = completeSeenForSelection(pool,
      history.complete_seen_revisions || []);
    selectedLessons = E5 ? E5.selectChoreographyLessons(pool, lessonFacts(rawIdea, true), {
      completeSeenRevisionKeys: completeSeen,
      domainExposure: lessonDomainExposure(pool, history)
    }) : null;
    waitLessons = selectedLessons ? selectedLessons.rotation.slice() : [];
    const ordered = selectedLessons ? selectedLessons.ordered || [] : [];
    ordered.forEach((view, index) => recordLessonAction({ kind: "selected", view,
      surface: "choreography", role: "lesson_" + (index + 1) }));
    /* Owner ruling, 2026-09-17: lessons never repeat, so when the unseen set
       runs low O'Mono fetches more in the background. The prompt never waits. */
    if (selectedLessons && selectedLessons.needs_more) requestMoreLessons();
  }
  loading(true, LINES_A);
  try {
    const priorCorrections = bridge && bridge.manualAll
      ? (await bridge.manualAll()).slice(0, 12).map(m => ({ pattern: m.pattern, meaning: m.meaning }))
      : [];
    const result = await bridge.interpret({
      transaction_id: transactionId,
      destination: { system_id: destination.system_id, model_id: destination.model_id },
      payload: {
        schema_version: "omono.interpret.v4",
        raw_idea: rawIdea,
        attachments: attachments.map(a => ({
          id: a.id, label: a.label, type: a.type, excerpt: a.excerpt || ""
        })),
        prior_corrections: priorCorrections,
        /* Scoped to the tool the person actually selected, and drawn from that
           tool's dossier rather than from the flat engine table. The flat table
           made the recommendation impossible on every tool that does not run on
           Anthropic; see recommendationBrief. */
        recommendation_brief: recommendationBriefForSelectedTool(),
        connection_lessons: {
          lesson_1: connectionLessonPayload(waitLessons[0]),
          lesson_2: connectionLessonPayload(waitLessons[1])
        }
      }
    });
    if (token !== runToken) return; /* cancelled: the reply is discarded */
    if (!result || !result.ok) {
      showError(D.errorView(result && result.error));
      return;
    }
    interpretation = result.value;
    lastInterpretHash = interpretInputHash(rawIdea);
    promptTouched = false;
    /* The interpretation call must not write the final prompt (Contracts §3.1). */
    confirmed = null;
    intermediaryDraft = null;
    /* R2: a new reading means the previous prompt's target no longer describes
       anything on screen. */
    promptTarget = null;
  generationError = null;
    sourceCheckResult = null;
    fixResult = null;
    policyEvaluation = await evaluatePolicy({});
    buildTeachingPanel();
    applyRecommendation();
    renderIntermediary();
  } catch (error) {
    if (token !== runToken) return;
    showErrorText("O'Mono could not read that idea.",
      "Try again, or say it in fewer moving parts.");
  } finally {
    /* After a cancel the Cancel handler has already restored the bar and a
       newer run may own it; a stale finally must not touch either. */
    if (token === runToken) {
      activePhase = null;
      loading(false, LINES_A);
      $("writeBtn").disabled = false;
    }
  }
}
$("writeBtn").addEventListener("click", interpret);
/* R-C: Cancel aborts the in-flight transport, returns to the prior editable
   state with the input preserved, and logs a cancellation event to the work
   ledger. No outcome is recorded; a late reply is discarded by the token. */
$("cancelBtn").addEventListener("click", async () => {
  const phase = activePhase;
  if (!phase) return;
  runToken += 1;
  activePhase = null;
  /* Stop the screen clock before either IPC call. A cancellation must not let
     another hook or card appear while transport and ledger acknowledgements
     settle. */
  if (phase === "generate") {
    loading(false, LINES_B);
    $("writeBtn").disabled = false;
    renderIntermediary();
  } else {
    loading(false, LINES_A);
    $("writeBtn").disabled = false;
    $("idea").focus();
  }
  if (bridge && bridge.cancelRun) {
    try { await bridge.cancelRun({ phase }); } catch { /* already settled */ }
  }
  if (bridge && bridge.ledgerAppend) {
    try {
      await bridge.ledgerAppend({ type: "cancellation", ref: transactionId || "",
        phase, ts: Date.now() });
    } catch { /* the cancel itself never fails on a ledger hiccup */ }
  }
});

function taskForTeaching() {
  const task = (interpretation && interpretation.task) || {};
  const data = (interpretation && interpretation.data) || {};
  return {
    family: task.family,
    stakes: task.stakes,
    use_context: task.use_context,
    source_dependency: task.source_dependency,
    subject: data.subject,
    destination_capabilities: destination && destination.profile ? destination.profile.capabilities : {},
    policy_requires_verification: !!(policyEvaluation &&
      D.policyFinal(policyEvaluation.explanation) &&
      D.policyFinal(policyEvaluation.explanation).result !== "pass")
  };
}
function buildTeachingPanel() {
  panel = D.teachingPanelFor(taskForTeaching(), interpretation && interpretation.coaching);
  lessonState = { open_lesson_id: null };
  refreshFadeLevels();
}

/* Fading (D3): when a failure category has gone quiet in the record, its
   lessons step back; a fresh failure promotes them straight back. Levels come
   from the local learning map; a cold start keeps everything at the card. */
async function refreshFadeLevels() {
  if (!bridge || !bridge.learningMap) return;
  try {
    const map = await bridge.learningMap({});
    const rows = (map && map.competencies) || [];
    const next = {};
    rows.forEach(row => {
      const id = row.competency_id || row.id;
      if (!id) return;
      const level = String(row.level || "");
      if (level === "recurring_failure_needs_attention" || level === "safeguards_recorded") {
        next[id] = "card";
      } else if (level === "verification_or_removal_recorded") {
        next[id] = "behind_tap";
      } else if (level === "repeated_verification_events") {
        next[id] = "silent";
      } else {
        next[id] = "card"; /* insufficient evidence: teach */
      }
    });
    fadeByCategory = next;
  } catch { fadeByCategory = {}; }
}
/* R1: the recommendation is advice about a model, not permission to change the
   tool the person selected. It is resolved against the selected tool's own
   dossier, exactly like every other destination decision. Where the tool offers
   the recommended profile it is taken; where it does not, the tool keeps its own
   seat and destinationRationale names the refusal. This used to resolve against
   the flat modelProfiles table and write `destination` while omono.tool stayed
   where it was, which is how one screen came to carry four labels from three
   sources. */
function applyRecommendation() {
  const recommendation = interpretation && interpretation.recommendation;
  if (!recommendation) return;
  const target = destinationForSelectedTool(recommendation);
  if (target) setDestination(target, "recommendation");
}

/* ---------- intermediary ---------- */
function renderIntermediary() {
  show("viewIntermediary");
  const body = clear($("intBody"));
  body.scrollTop = 0;

  /* Only material questions, each with its suggested answer already selected. */
  const questions = D.materialQuestions(interpretation.questions, interpretation.coaching, purpose);
  /* Build the draft once per interpretation, then read it for the rest of this
     render. Rebuilding it here is what used to discard the user's work. */
  if (!D.draftMatches(intermediaryDraft, transactionId)) {
    intermediaryDraft = D.draftInit(interpretation, questions, transactionId);
  }
  const answers = intermediaryDraft.answers;

  /* A generation that failed says so here, above everything, because this is the
     screen with the Confirm button on it. */
  if (generationError) {
    const failed = panelBox("That did not go through", { className: "strong" });
    failed.appendChild(paragraph(generationError.headline));
    if (generationError.action) failed.appendChild(paragraph(generationError.action, "snote"));
    body.appendChild(failed);
    announce(generationError.headline + " " + (generationError.action || ""));
  }

  /* The narrow interpretation, in the user's own subject matter. */
  const intent = panelBox("Reading it as", { className: "strong" });
  intent.appendChild(paragraph(interpretation.restated_intent, "intent"));
  /* The correction control. Required by the manual (§3), Building §14.3 and
     §4.6, and Design-Rules item 2; it went out with the O'Mode density and
     shared/engine.js has been carrying it into the generation message ever
     since with nothing to supply it. */
  intent.appendChild(bigBox("Not what you meant? Say it in your words",
    intermediaryDraft.correction, "I actually want…",
    value => {
      intermediaryDraft = D.draftApply(intermediaryDraft, { type: "correction", value: value });
    }));
  body.appendChild(intent);

  const questionCard = (question, index) => {
    const card = el("div", "qcard");
    card.setAttribute("role", "group");
    const heading = el("div", "qt", question.q);
    heading.id = "q-title-" + index;
    card.setAttribute("aria-labelledby", heading.id);
    card.appendChild(heading);
    if (question.why) card.appendChild(el("div", "qwhy", question.why));
    const row = el("div", "ynrow");
    const options = D.questionOptions(question);
    const suggested = D.suggestedOption(question);
    /* F13: the escape's own box, revealed when it is chosen and never before.
       A permanently open box under every question is a form; a box that appears
       because somebody said none of these is an answer. */
    let detailField = null;
    const showDetail = () => {
      if (detailField) return;
      detailField = bigBox("Say it in your own words",
        answers[index].detail || "",
        "What is actually true here…",
        value => {
          intermediaryDraft = D.draftApply(intermediaryDraft,
            { type: "answer_detail", index: index, detail: value });
        });
      card.appendChild(detailField);
      const area = detailField.querySelector("textarea");
      if (area) area.focus();
      fitHeight();
    };
    const hideDetail = () => {
      if (!detailField) return;
      card.removeChild(detailField);
      detailField = null;
      fitHeight();
    };
    options.forEach(option => {
      const label = el("label", "yn");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "q" + index;
      input.value = option.value;
      if (option.value === answers[index].answer) { input.checked = true; label.classList.add("on"); }
      input.addEventListener("change", () => {
        Array.from(row.querySelectorAll(".yn")).forEach(node => node.classList.remove("on"));
        label.classList.add("on");
        intermediaryDraft = D.draftApply(intermediaryDraft,
          { type: "answer", index: index, answer: option.value, answer_label: option.label });
        if (D.isOtherOption(option.value)) showDetail(); else hideDetail();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(
        option.label + (option.value === suggested.value ? " (suggested)" : "")));
      row.appendChild(label);
    });
    card.appendChild(row);
    if (D.isOtherOption(answers[index].answer)) showDetail();
    return card;
  };

  /* Questions are the bulk of this view — each is a full-width card — and
     materialQuestions() caps nothing by default: its threshold is 0 unless Speed
     is chosen without Structure, and the filter it would then apply reads
     `material` and `risk_id`, which the frozen question schema does not carry.
     So every question rendered, every time. Each one already has its suggested
     answer selected, so the ones past the first few can wait behind a disclosure
     without anything going unanswered. */
  const questionSplit = D.surfacedAssumptions(questions, 3);
  questionSplit.surface.forEach((question, index) => body.appendChild(questionCard(question, index)));
  if (questionSplit.deferred.length) {
    const moreQ = document.createElement("details");
    moreQ.className = "disclosure";
    moreQ.appendChild(el("summary", null,
      questionSplit.deferred.length + " more " +
      (questionSplit.deferred.length === 1 ? "question" : "questions") +
      ", already answered as suggested"));
    questionSplit.deferred.forEach((question, offset) =>
      moreQ.appendChild(questionCard(question, questionSplit.surface.length + offset)));
    body.appendChild(moreQ);
  }

  /* Assumptions stay adjustable without becoming a form to fill in. The first
     few are on the surface and the rest wait behind a disclosure that names its
     own count — nothing is dropped, because MANUAL.md promises every one of them
     is listed and strikeable, and everything here still reaches generation. */
  const assumptionCard = (assumption, index) => {
    const card = el("div", "acard");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = "assume-" + (assumption.id || index);
    const state = intermediaryDraft.assumptions[assumption.id];
    box.checked = state ? state.accepted : assumption.accepted_default !== false;
    box.dataset.assumption = String(index);
    box.addEventListener("change", () => {
      intermediaryDraft = D.draftApply(intermediaryDraft,
        { type: "assumption", id: assumption.id, accepted: box.checked });
    });
    const text = el("label", null, "Assuming: " + assumption.text);
    text.htmlFor = box.id;
    card.appendChild(box);
    card.appendChild(text);
    /* Somewhere to say what is actually true, next to the thing it is about
       rather than at the bottom of the page. Collapsed until it is wanted: a
       permanently open box under every assumption put back all the height that
       deferring the long tail had just saved. */
    const noteField = () => bigBox("Your note on this assumption",
      (intermediaryDraft.assumptions[assumption.id] || {}).note || "",
      "Only if it needs one…",
      value => {
        intermediaryDraft = D.draftApply(intermediaryDraft,
          { type: "note", id: assumption.id, note: value });
      });
    if (state && state.note) {
      card.appendChild(noteField());
    } else {
      const add = el("button", "tbtn", "Add a note");
      add.type = "button";
      add.setAttribute("aria-label", "Add a note about this assumption");
      add.addEventListener("click", () => {
        const field = noteField();
        card.replaceChild(field, add);
        const area = field.querySelector("textarea");
        if (area) area.focus();
        fitHeight();
      });
      card.appendChild(add);
    }
    return card;
  };

  const split = D.surfacedAssumptions(interpretation.assumptions || [], 4);
  split.surface.forEach((assumption, index) => body.appendChild(assumptionCard(assumption, index)));
  if (split.deferred.length) {
    const more = document.createElement("details");
    more.className = "disclosure";
    more.appendChild(el("summary", null,
      split.deferred.length + " more " +
      (split.deferred.length === 1 ? "assumption" : "assumptions") + " O'Mono made"));
    split.deferred.forEach((assumption, offset) =>
      more.appendChild(assumptionCard(assumption, split.surface.length + offset)));
    body.appendChild(more);
  }

  /* Destination and the reason for it. */
  const dest = panelBox("Destination");
  /* F3: the reason belongs to the destination it was written about. It is a
     sentence the interpret call authored once, naming one model; gluing it to
     whatever label is selected now produced "GPT-5.6 Sol. … Opus 5 has the
     reasoning depth …". Changing the tool or the model does not re-derive it —
     that would cost a second interpretation call — so when the selection moves
     off the recommendation the reason is withheld and the move is named
     instead. Nothing here ever explains one model in another model's words. */
  dest.appendChild(paragraph(destinationRationale()));
  /* Choose here, for this prompt. This used to be a button that opened Settings,
     and Settings' own Back is hardcoded to `generation ? viewResult : viewCompose`
     — mid-interpretation `generation` is null, so it always landed on Compose,
     where the only way forward mints a new transaction and makes a second
     billable interpretation call. The picker belongs on this screen. */
  const picker = el("div", "srow");
  const pickerLabel = el("label", null, "Writing this for");
  /* T4: tool-first. The Tool select leads; the model select that follows
     renders only where the selected tool's dossier lists models that map
     to engine profiles. */
  const toolPick = document.createElement("select");
  toolPick.id = "toolSelect";
  toolPick.setAttribute("aria-label", "Which tool this prompt is written for");
  (toolStack() || allDossiers().map(d => d.id)).forEach(id => {
    const dossier = dossierById(id);
    if (!dossier) return;
    const option = document.createElement("option");
    option.value = dossier.id;
    option.textContent = dossier.display_name;
    if (dossier.id === selectedToolId()) option.selected = true;
    toolPick.appendChild(option);
  });
  toolPick.addEventListener("change", async () => {
    try { localStorage.setItem("omono.tool", toolPick.value); } catch { /* private */ }
    const dossier = dossierById(toolPick.value);
    if (dossier) {
      /* F4: the tool's own models first, then the tool's own engine seat. The
         old chain ended at modelProfiles[0] — Claude Opus 5 — which is what
         eight of the eleven tools silently selected. R1: that chain is now
         destinationForTool, shared with the restore and the recommendation, and
         moving to a tool that DOES offer the recommended model takes it rather
         than dropping to the tool's first entry. */
      const target = destinationForTool(dossier,
        interpretation && interpretation.recommendation);
      if (target) setDestination(target, "prompt");
    }
    policyEvaluation = await evaluatePolicy({});
    buildTeachingPanel();
    renderIntermediary();
  });
  picker.appendChild(toolPick);
  /* F4/D2: the model list is the selected tool's own, never the flat engine
     table. It used to offer all seven engine profiles on every tool — Gemini
     under ChatGPT, and the deprecated Opus 4.1 everywhere — while the register
     function that answers this exact question was called one line above and
     used only to pick a default. Where the tool's dossier lists no models,
     there is no model choice to offer: the tool's engine seat is named instead,
     which is what the register's own contract says. */
  const toolDossier = dossierById(selectedToolId());
  const offered = toolDossier ? profilesForTool(toolDossier) : offerableProfiles();
  const select = document.createElement("select");
  select.id = "intDest";
  pickerLabel.htmlFor = select.id;
  if (!offered.length) {
    const seat = toolDossier ? engineSeatFor(toolDossier) : null;
    select.classList.add("hidden");
    select.disabled = true;
    pickerLabel.textContent = "Writing this for";
    picker.appendChild(pickerLabel);
    picker.appendChild(el("span", "snote", D.modelChoiceLine(
      D.modelChoiceState(toolDossier, modelProfiles, today10()),
      toolDossier ? toolDossier.display_name : "This tool",
      seat ? seat.label : (destination ? destination.label : "this tool"))));
    picker.appendChild(select);
    dest.appendChild(picker);
  } else {
  offered.forEach(profile => {
    const option = el("option", null, profile.label || (profile.system_id + " " + profile.model_id));
    option.value = profile.system_id + " " + profile.model_id;
    select.appendChild(option);
  });
  if (destination) select.value = destination.system_id + " " + destination.model_id;
  select.addEventListener("change", async () => {
    const [system, model] = select.value.split(" ");
    const profile = modelProfiles.find(p => p.system_id === system && p.model_id === model);
    if (!profile) return;
    setDestination(profile, "prompt", intermediaryDraft.remember_destination);
    /* A different destination can change the effective policy outright — it is
       what decides whether Confirm reads Blocked — and it changes which lessons
       apply. Both are recomputed before anything is drawn again. */
    policyEvaluation = await evaluatePolicy({});
    buildTeachingPanel();
    renderIntermediary();
  });
  picker.appendChild(pickerLabel);
  picker.appendChild(select);
  /* Codex lists seven models and one of them is profiled, so the dropdown used
     to appear with a single entry and no account of the other six. A choice of
     one is not a choice, and the reason it is one is ours. */
  const partial = D.modelChoiceState(toolDossier, modelProfiles, today10());
  if (partial.state === "partly_profiled") {
    picker.appendChild(el("span", "snote", D.modelChoiceLine(partial,
      toolDossier ? toolDossier.display_name : "This tool", null)));
  }
  dest.appendChild(picker);
  }

  /* The contest. DESIGN_RULES #10: the user's contest text is controlling for
     generation. shared/engine.js has honoured it since v2 with no caller. */
  dest.appendChild(bigBox("Disagree with this? Say what you want from it",
    intermediaryDraft.destination_contest, "For this one I want…",
    value => {
      intermediaryDraft = D.draftApply(intermediaryDraft, { type: "contest", value: value });
      const row = $("rememberDestRow");
      if (row) row.classList.toggle("hidden", !value.trim());
    }));

  /* Remembering is a separate act from contesting, and it is the only thing here
     that changes the saved default. */
  const rememberRow = el("div", "srow" +
    (intermediaryDraft.destination_contest.trim() ? "" : " hidden"));
  rememberRow.id = "rememberDestRow";
  const rememberLabel = el("label", "obcheck");
  const rememberBox = document.createElement("input");
  rememberBox.type = "checkbox";
  rememberBox.checked = intermediaryDraft.remember_destination;
  rememberBox.addEventListener("change", () => {
    intermediaryDraft = D.draftApply(intermediaryDraft,
      { type: "remember", value: rememberBox.checked });
    if (rememberBox.checked && destination && destination.profile) {
      setDestination(destination.profile, "prompt", true);
    }
  });
  rememberLabel.appendChild(rememberBox);
  rememberLabel.appendChild(el("span", null, "Remember this preference for tasks like this"));
  rememberRow.appendChild(rememberLabel);
  dest.appendChild(rememberRow);

  body.appendChild(dest);

  /* R-D: the "What is controlling this" apparatus is gone from this screen:
     no policy rows, no ALLOWED banner, no "More safeguards" expander, no
     "Before you confirm" line. A clean run is silent; a finding speaks one
     advisory line below. The full decision stack still goes to the ledger
     record with the generation. */

  confirmed = {
    answers: intermediaryDraft.answers,
    assumptions: D.acceptedAssumptions(intermediaryDraft, interpretation),
    correction: intermediaryDraft.correction,
    destination_contest: intermediaryDraft.destination_contest
  };
  /* Round two (R2): there is no state in which Confirm is unpressable
     because of policy. Classification still runs, still writes to the
     ledger, and may say one quiet line here; it never gates. The line is
     suppressed under the privacy declaration (R3). */
  $("confirmBtn").disabled = false;
  $("confirmBtn").textContent = "Confirm ↩";
  $("confirmBtn").title = "";
  const priorAdvisory = $("intAdvisory");
  if (priorAdvisory) priorAdvisory.remove();
  const final = policyEvaluation && D.policyFinal(policyEvaluation.explanation);
  if (final && final.result !== "pass" && appMode !== "personal" && !destinationsPrivate()) {
    /* Pass four (P2): the advisory opens with the owner's wording, not the
       plain-result label; RESULT_PLAIN itself is untouched everywhere else
       (ledger, History). R-D: the line is the only policy voice on this
       screen, and the small ⓘ beside it opens a transient summary of
       the decision stack for whoever wants the why. */
    const advisory = paragraph("Beware of sharing sensitive data. "
      + (final.why || ""), "snote");
    advisory.id = "intAdvisory";
    const info = el("button", "infodot", "ⓘ");
    info.type = "button";
    info.id = "intAdvisoryInfo";
    info.setAttribute("aria-label", "What decided this line");
    info.addEventListener("click", (event) => {
      event.stopPropagation();
      const prior = $("policyTip");
      if (prior) { prior.remove(); return; }
      const rows = D.policyRows(policyEvaluation.explanation) || [];
      const tip = el("div", "policytip");
      tip.id = "policyTip";
      tip.setAttribute("role", "note");
      rows.forEach(row => tip.appendChild(paragraph(
        row.label + ": " + (row.result_plain || row.result || "—")
          + (row.controlling && row.why ? " — " + row.why : ""), "snote")));
      tip.appendChild(paragraph("Effective result: "
        + (final.result_plain || final.result) + ". The full stack is on the ledger record.", "snote"));
      advisory.appendChild(tip);
      const dismiss = () => {
        tip.remove();
        document.removeEventListener("click", onAway, true);
        document.removeEventListener("keydown", onKey, true);
        clearTimeout(timer);
      };
      const onAway = (e) => { if (!tip.contains(e.target) && e.target !== info) dismiss(); };
      const onKey = (e) => {
        if (e.key !== "Escape") return;
        /* The transient dismisses first; the screen's own Escape behavior
           waits for the next press. */
        e.stopPropagation();
        e.preventDefault();
        dismiss();
        info.focus();
      };
      document.addEventListener("click", onAway, true);
      document.addEventListener("keydown", onKey, true);
      const timer = setTimeout(dismiss, 8000);
    });
    advisory.appendChild(info);
    body.insertBefore(advisory, body.firstChild);
  }
  fitHeight();
}

/* R-D: renderPolicyStack is deleted. The rows it drew (found, posture,
   destination, actor, override, effective result) live on in D.policyRows
   for the ledger record and the advisory tooltip; no screen draws them as
   furniture any more. */

/* At most three small pills, one open card at a time, labels from the approved
   catalog by lesson_type (Contracts §7.2, §7.3). */
/* One lesson card maximum per screen (D3). The card replaces the pill row:
   its title is the rule itself, the detail sits one tap behind (the reducer's
   one-open invariant and Escape handling are reused unchanged). A due lesson
   returns as a one-line question; the reveal is logged. When the lesson's
   failure category has gone quiet the card steps back: behind the tap first,
   then silent. Nothing is deleted; the pool stays in Learning. */
let fadeByCategory = {};

function renderTriggers(body) {
  /* Pass four (L3/L4): the one lesson card, canon-driven. A wait-line tap
     pins its lesson; otherwise the engine selects under the ruled order and
     the novelty gates. One card maximum per screen stays law. */
  const E5 = window.OMonoLessonEngineV5;
  if (!E5) return;
  const pool = lessonPoolV5();
  if (!pool.length) return;
  const history = lessonHistory();
  const now = Date.now();
  const dueLessonIds = Object.keys(history.ever || {}).filter(id => {
    const view = pool.find(v => v.lesson_id === id);
    return view && view.recall && (now - (history.ever[id] || now)) > 7 * 24 * 3600 * 1000;
  });
  const domainExposure = lessonDomainExposure(pool, history);

  let view = null;
  let reason = null;
  let questionForm = false;
  const facts = lessonFacts();
  if (pinnedLessonId) {
    view = pool.find(v => v.lesson_id === pinnedLessonId) || null;
    /* F1/D9: a pinned lesson still has a reason — the one that holds for THIS
       prompt. "pinned" is how it got here, not why it applies, and feeding it
       to the binding line was what forced the breadth sentence onto every
       pinned card. */
    reason = view ? lessonReasonFor(view, facts) : null;
    pinnedLessonId = null;
  }
  if (!view) {
    /* The card excludes only the previous run (the v4 law, unchanged): a
       re-render inside one run repeats the same lesson quietly. The strict
       both-runs gate belongs to the wait rotation. The pick counter
       advances only on a fresh exposure, so re-renders cannot spin the
       mix. */
    const selection = E5.selectLesson(pool, facts, {
      shownThisRun: [],
      shownLastRun: history.last_run || [],
      dueLessonIds,
      domainExposure,
      /* V3: promotion stats and this run's recall counters. */
      domainLevelStats: domainLevelStatsCache,
      /* V3: the unseen-first depth rotation looks across runs only. This
         run's own lessons carry no penalty, so a re-render inside one run
         repeats the same lesson quietly — the v4 law, unchanged. */
      everSeenIds: Object.keys(history.ever || {})
        .filter(id => shownThisRun.indexOf(id) === -1),
      recallShareCap: window.OMonoCurriculumConstants
        ? window.OMonoCurriculumConstants.RECALL_SHARE_CAP : undefined,
      sessionMoments: sessionLessonMoments,
      sessionRecalls: sessionRecallsShown,
      pickCounter: Number(history.pick_counter || 0)
    });
    if (!selection) return;
    view = selection.view;
    reason = selection.reason;
    questionForm = selection.question_form === true;
    if (questionForm) sessionRecallsShown += 1; /* V3: a recall takes a slot */
    if (shownThisRun.indexOf(view.lesson_id) === -1) {
      history.pick_counter = Number(history.pick_counter || 0) + 1;
      saveLessonHistory(history);
    }
  }
  if (!view) return;

  /* F1: remember what this prompt was taught, so renderResult shows the same
     card rather than nothing at all. */
  runLessonSelection = { lesson_id: view.lesson_id, reason: reason,
    question_form: questionForm };

  const everSeen = Object.keys(history.ever || {});
  const firstEver = everSeen.indexOf(view.lesson_id) === -1;
  const bindingLine = E5.bindingLineFor(view, facts, reason);

  const host = el("div", "triggers");
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "What to watch on this task");

  let shell;
  const open = lessonState && lessonState.open_lesson_id === view.lesson_id;
  if (questionForm && !open) {
    /* A due lesson returns as its recall question, tap to reveal, the
       reveal logged (L3). */
    shell = panelBox(null, { className: "strong lessoncard v4card" });
    shell.setAttribute("role", "region");
    shell.setAttribute("aria-label", view.recall);
    const pill = el("button", "trigger v4title", view.recall);
    pill.type = "button";
    pill.id = "trigger-" + view.lesson_id;
    pill.setAttribute("aria-expanded", "false");
    pill.addEventListener("click", () => {
      lessonState = D.lessonReducer(lessonState, { type: "toggle", lesson_id: view.lesson_id }, panel);
      recordLessonAction({ kind: "recall_opened", view,
        surface: "legacy_intermediary", role: "lesson" });
      renderIntermediary();
      const again = $("trigger-" + view.lesson_id);
      if (again) again.focus();
    });
    shell.appendChild(pill);
  } else {
    shell = buildLessonCardV5(view, { first_ever: firstEver, binding_line: bindingLine });
  }

  if (firstEver) markLessonShown(view.lesson_id);
  else if (shownThisRun.indexOf(view.lesson_id) === -1) markLessonShown(view.lesson_id);
  recordLessonDisplay(view, "legacy_intermediary", "lesson");

  body.appendChild(el("div", "fieldlabel", "What to watch on this task"));
  host.appendChild(shell);
  body.appendChild(host);
}

/* Pass four (L3): the v5 card. Bold hook; the two plain lines; the binding
   line behind the O'M mark; the source pill. No expansion door. The
   five-part coaching card retired with the seeds: coaching lives in the
   field details, untouched. */
function omonoMark() {
  const mark = el("span", "omark");
  mark.title = "O'Mono's read of this prompt";
  mark.setAttribute("aria-label", "O'Mono's read of this prompt");
  mark.appendChild(document.createTextNode("O"));
  const mic = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mic.setAttribute("viewBox", "0 0 8 12");
  mic.setAttribute("aria-hidden", "true");
  const capsule = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  [["x", "2"], ["y", "0.5"], ["width", "4"], ["height", "7"], ["rx", "2"],
    ["fill", "currentColor"]].forEach(([k, v]) => capsule.setAttribute(k, v));
  mic.appendChild(capsule);
  const cradle = document.createElementNS("http://www.w3.org/2000/svg", "path");
  [["d", "M0.8 5.5v1a3.2 3.2 0 0 0 6.4 0v-1"], ["fill", "none"],
    ["stroke", "currentColor"], ["stroke-width", "1.1"]].forEach(([k, v]) => cradle.setAttribute(k, v));
  mic.appendChild(cradle);
  const stand = document.createElementNS("http://www.w3.org/2000/svg", "line");
  [["x1", "4"], ["y1", "9.7"], ["x2", "4"], ["y2", "11.5"],
    ["stroke", "currentColor"], ["stroke-width", "1.1"]].forEach(([k, v]) => stand.setAttribute(k, v));
  mic.appendChild(stand);
  mark.appendChild(mic);
  mark.appendChild(document.createTextNode("M"));
  return mark;
}

function buildLessonCardV5(view, options) {
  const opts = options || {};
  const shell = panelBox(null, { className: "strong lessoncard v4card"
    + (opts.first_ever ? " first" : "") });
  shell.setAttribute("role", "region");
  shell.setAttribute("aria-label", view.hook || "Lesson");
  shell.appendChild(el("div", "v5hook", view.hook));
  shell.appendChild(el("div", "v5line", view.mechanism));
  shell.appendChild(el("div", "v5line", view.consequence));
  const bind = el("div", "v5bind");
  bind.appendChild(omonoMark());
  bind.appendChild(el("span", null, opts.binding_line || ""));
  shell.appendChild(bind);
  if (view.source_label && view.source_url) {
    const pill = el("button", "srcpill", view.source_label);
    pill.type = "button";
    pill.title = view.source_url;
    pill.addEventListener("click", () => {
      if (bridge && bridge.openExternal) bridge.openExternal(view.source_url).catch(() => {});
      recordLessonAction({ kind: "source_opened", view,
        surface: opts.surface || "lesson", role: opts.role || "lesson" });
    });
    shell.appendChild(pill);
  }
  return shell;
}

$("intBack").addEventListener("click", goBack);
$("confirmBtn").addEventListener("click", () => generate());

/* ---------- phase B: generate ---------- */
async function generate() {
  if (!interpretation || !destination) return;
  /* Pass four (P3): the generate-time credential halt on intermediary free
     text is gone with the interpret-time ones. Nothing halts anywhere for
     any classification; detection still classifies and logs, and the
     advisory line is where it speaks. */
  /* Read the draft, not the DOM. Scraping #intBody meant generate() saw whatever
     the last re-render had put back, which was the model's defaults. */
  const accepted = D.acceptedAssumptions(intermediaryDraft, interpretation);
  confirmed = {
    answers: (intermediaryDraft && intermediaryDraft.answers) || [],
    assumptions: accepted,
    correction: (intermediaryDraft && intermediaryDraft.correction) || "",
    destination_contest: (intermediaryDraft && intermediaryDraft.destination_contest) || ""
  };

  generationError = null;
  show("viewCompose");
  /* Keep the exact three lessons O'Mono selected before Interpret. Generate
     never selects again, so the hooks and complete cards cannot diverge. */
  waitLessons = selectedLessons ? selectedLessons.rotation.slice() : [];
  const token = ++runToken;
  activePhase = "generate";
  loading(true, LINES_B, "generate");
  $("writeBtn").disabled = true;
  try {
    /* Pass four (P1): the author seat travels explicitly. The chooser lives
       in the main process next to the phase seating; asking it here makes
       the seat visible in the request instead of a silent default, and the
       fallback stays for any caller that sends nothing. */
    let authorSeat = null;
    try {
      authorSeat = bridge.authorModel ? await bridge.authorModel({
        destination: { system_id: destination.system_id, model_id: destination.model_id }
      }) : null;
    } catch { authorSeat = null; }
    const result = await bridge.generate({
      transaction_id: transactionId,
      engine_model: (authorSeat && authorSeat.engine_model) || undefined,
      destination: { system_id: destination.system_id, model_id: destination.model_id },
      payload: {
        schema_version: "omono.generate.request.v3",
        /* The minimum confirmed package, not the whole raw idea again
           (Contracts §3.3). */
        confirmed_task: {
          objective: interpretation.restated_intent,
          task: interpretation.task,
          /* F13: the person's own words travel with the answer and are
             controlling over the option label, the way `correction` already is
             for the reading. An escape nobody downstream reads is a text box
             that does nothing. */
          answers: confirmed.answers.map(a => ({ q: a.q, answer: a.answer,
            answer_label: a.answer_label, detail: a.detail || "" })),
          /* {id, text, note}. The id lets anything downstream refer to a
             particular assumption; the flat array of strings could not. */
          assumptions: confirmed.assumptions,
          /* The user's own words are controlling (Building §4.6, DESIGN_RULES
             #10). Omitted entirely when empty rather than sent as "". */
          correction: confirmed.correction || undefined,
          destination_contest: confirmed.destination_contest || undefined
        },
        selected_sources: attachments.map(a => ({ id: a.id, label: a.label, type: a.type, excerpt: a.excerpt || "" })),
        /* F14: the purpose chips reach the call that can act on them. Speed
           previously travelled only to the record, while the thing it claimed
           to do — ask less — was a dead filter. Now it asks for a shorter
           prompt, which is a real effect a person can see. */
        purpose: purpose.slice(),
        selected_destination: { system_id: destination.system_id, model_id: destination.model_id },
        model_profile: destination.profile,
        /* The panel's evidence carries .safeguards [{id,state}]; the old read
           of .safeguard_ids never existed, so this was silently always []. */
        required_safeguards: ((panel && panel.evidence && panel.evidence.safeguards) || [])
          .map(s => s.id),
        /* C3: the closing lesson travels with the request that writes the
           prompt, so the binding line is written with the components in front
           of it rather than from task facts alone. */
        closing_lesson: closingLessonPayload(),
        language_contract: { prompt_language: "en", answer_language: "en" }
      }
    });
    if (token !== runToken) return; /* cancelled: the reply is discarded */
    if (!result || !result.ok) {
      /* Back to the intermediary, not the compose box. The interpretation and
         every answer are still here; returning to compose would mean a second
         interpretation call to reach a Confirm button that already exists. The
         old copy even said "Try Confirm again" on a screen with no Confirm. */
      generationError = D.errorView(result && result.error);
      renderIntermediary();
      return;
    }
    /* Sonnet has finished. Stop the lesson clock before any local save work;
       the result is allowed to interrupt the cadence immediately. */
    activePhase = null;
    loading(false, LINES_B);
    generation = result.value;
    /* R2: the prompt is now a finished thing. The destination it was compiled
       for and the tool it was written for are fixed here, together, and every
       consumer reads them from here rather than re-deriving its own answer. */
    promptTarget = { destination: destination, tool_id: selectedToolId() };
    /* Round two (R7): the persona line becomes the Role field's component. */
    if (Array.isArray(generation.components)
        && !generation.components.some(c => c.component_id === "persona")) {
      const persona = D.personaComponentFrom(generation);
      if (persona) generation.components.unshift(persona);
    }
    /* U7: dedupe by component id at ingest, same rule as render.
       F10: and markdown is normalised here, once, so no later reader has to. */
    if (Array.isArray(generation.components)) {
      generation.components = D.normalizeComponents(
        D.dedupeComponentsById(generation.components));
    }
    /* Display text is the eight-canon assembly of the components (D2), with
       the closing VERIFICATION block (R1); the model's own final_prompt stays
       untouched on the record. */
    promptDraft = assembledPromptNow();
    promptTouched = false; /* a fresh result starts untouched (R5) */
    includeReasoning = false;
    whyOpen = false;
    /* The result paints before its history row exists. Retire the previous
       prompt's recovery identity first, or the save renderResult schedules
       lands under the old entry (overwriting its copy) or under none at all
       (the first prompt of a session was never saved). The new entry schedules
       its own save once writeLegacyLedgerRow has created it. */
    if (recoverySaveTimer) { clearTimeout(recoverySaveTimer); recoverySaveTimer = null; }
    recoveryEnabled = false;
    entryId = null;
    renderResult();
    /* The draft is a crash buffer for text that has not been sent. This one has:
       it is in the record and reopenable from History. These local writes run
       after the result is visible and never extend the lesson cadence. */
    if (bridge && bridge.recoveryClearDraft) {
      try { await bridge.recoveryClearDraft(); } catch { /* nothing pending */ }
    }
    await recordWork(result);
    await writeLegacyLedgerRow();
    scheduleRecovery();
    refreshVerifyBadge();
  } catch (error) {
    if (token !== runToken) return;
    generationError = { headline: "O'Mono could not finish that prompt.",
      action: "No prompt or result was saved. Your answers are still here — press Confirm to try again." };
    renderIntermediary();
  } finally {
    if (token === runToken) {
      activePhase = null;
      loading(false, LINES_B);
      $("writeBtn").disabled = false;
    }
  }
}

/* One completed generation, metadata only, on the canonical v3 work ledger. */
async function recordWork(result) {
  if (!bridge || !bridge.recordGeneration) return;
  const final = policyEvaluation ? D.policyFinal(policyEvaluation.explanation) : null;
  const event = D.workEventFrom({
    transaction_id: transactionId,
    ts: Date.now(),
    model_profile: result.model_profile,
    task: interpretation.task,
    evidence: generation.evidence,
    purpose,
    lesson_ids: D.lessonIds(panel).filter(Boolean),
    required_safeguard_ids: ((panel && panel.evidence && panel.evidence.safeguards) || [])
      .map(s => s.id),
    lesson_type_ids: ((panel && panel.triggers) || []).map(v => v.lesson_type),
    destination: { system_id: destination.system_id, model_id: destination.model_id },
    policy_result: final ? final.result : "pass",
    content_stored: false
  });
  /* R3: which canon fields this prompt went out without. Field names only, and
     they ride beside the frozen work event rather than inside it. Without this
     the growth loop cannot see what a person keeps leaving out, which is one of
     the five things it is supposed to notice. */
  const skipped = lessonFacts().skipped_fields || [];
  try { await bridge.recordGeneration(Object.assign({}, event, { skipped_fields: skipped })); }
  catch { /* a record that will not commit never blocks the person's work */ }
}

/* The browsable local history and the recovery pointer still live on the legacy
   local ledger; the v3 evidence surface has no channel that lists past prompts.
   This row carries no evidence claim — the work event above is the evidence. */
async function writeLegacyLedgerRow() {
  if (!bridge || !bridge.ledgerAppend || !generation) return;
  entryId = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  recoveryEnabled = true;
  recoveryRevision = 0;
  try {
    /* R-D: the screen no longer draws the decision stack, so the record
       carries it whole: every layer with its verdict and why, plus the
       effective result. The work event's frozen schema keeps its single
       policy_result field; this browsable row is where the detail lives. */
    const explanation = policyEvaluation && policyEvaluation.explanation;
    const stackRows = explanation ? (D.policyRows(explanation) || []) : [];
    const stackFinal = explanation ? D.policyFinal(explanation) : null;
    await bridge.ledgerAppend({
      type: "generation",
      id: entryId,
      ts: Date.now(),
      engine_version: E.ENGINE_VERSION,
      idea: $("idea").value.trim(),
      dest_system: destination.system_id,
      dest_model: destination.model_id,
      transaction_id: transactionId,
      task_type: interpretation.task ? interpretation.task.family : "other",
      policy_stack: stackRows.map(row => ({
        label: row.label, result: row.result, result_plain: row.result_plain,
        controlling: row.controlling === true, why: row.why || ""
      })),
      policy_final: stackFinal ? { result: stackFinal.result,
        result_plain: stackFinal.result_plain, why: stackFinal.why || "" } : null
    });
  } catch { /* the prompt is still on screen and still copyable */ }
}

/* ---------- result ---------- */
function renderResult() {
  show("viewResult");
  const body = clear($("resBody"));
  $("resBackName").textContent = trunc(interpretation.restated_intent, 34) || "Result";

  /* Lesson three is the exact closing lesson O'Mono selected before Interpret.
     Old recovery snapshots without that choreography render the prompt without
     inventing a replacement lesson. */
  {
    const E5 = window.OMonoLessonEngineV5;
    const selectedClosing = selectedLessons && selectedLessons.closing;
    const resultView = selectedClosing
      && selectedClosing.selection_role === "lesson_3"
      && selectedClosing.cycle_membership === "current_cycle"
      && selectedClosing.full_paint_eligible === true
      && typeof selectedClosing.revision_key === "string"
      && selectedClosing.revision_key ? selectedClosing : null;
    pinnedLessonId = null;
    if (E5 && resultView) {
      const context = "result_closing";
      const history = lessonHistory();
      const firstEver = Object.keys(history.ever || {}).indexOf(resultView.lesson_id) === -1;
      /* C3: the template path is retired for this surface. It composed the
         sentence from task facts and never saw the prompt, so it bound the
         lesson to the shape of the task rather than to a decision in the text.
         The model wrote this one with the components in front of it. */
      const modelBinding = generation && typeof generation.binding_line === "string"
        ? generation.binding_line.trim() : "";
      const resultLessonCard = buildLessonCardV5(resultView, {
        first_ever: firstEver,
        surface: "result",
        role: "lesson_3",
        binding_line: modelBinding
      });
      const paintedRevision = resultView.revision_key || "";
      resultLessonCard.dataset.revisionKey = paintedRevision;
      body.appendChild(resultLessonCard);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (activeView !== "viewResult" || !resultLessonCard.isConnected) return;
          if (resultLessonCard.dataset.revisionKey !== paintedRevision) return;
          recordLessonDisplay(resultView, context, "lesson_3", "result");
        });
      });
    }
  }

  /* What went into it, first and as controls. Since v4 the row is the eight
     canon fields (D2): the destination components fold into Role, Task,
     Context, Input, Constraints, Examples, Format and Tone (plus Tool
     instructions when the destination drives tools), and only those render as
     chips on every destination. componentRows/componentButtons stay the
     mechanism underneath; opening a chip opens its folded components. */
  const buttons = D.componentButtons(generation.components);
  const chips = D.fieldChips(generation.components, promptTraits());
  if (buttons.length && chips.length) {
    const grid = el("div", "compgrid");
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "What went into this prompt");
    chips.forEach(chip => {
      const control = el("button", "compbtn" + (chip.included ? "" : " omitted"), chip.label);
      control.type = "button";
      control.setAttribute("aria-label", chip.accessible_name);
      control.title = chip.accessible_name;
      control.addEventListener("click", () => openField(chip));
      grid.appendChild(control);
    });
    body.appendChild(grid);
  }

  /* The reasoning lives behind its labeled door in the header ("Why: N
     decisions", D1.4): the count is every component decision, and the panel
     renders only while the door is open. */
  if (whyOpen) {
    const why = panelBox("Why built this way");
    why.id = "whyPanel";
    why.appendChild(paragraph(generation.overall_reasoning));
    /* R3: the panel says where each component ended up, and it reads that from
       the same pass that built the prompt. It used to print `row.include`, which
       is the model's intention, not the outcome: Method arrived include:true,
       the fold dropped it whole on a reasoning destination, and the panel went
       on listing it as part of a prompt containing not one word of it.

       Every row is also a control now. Two of the fourteen components reach no
       chip on any destination, so their content, their reason and their rule of
       thumb were on the record and openable by nothing. */
    const placement = componentPlacementNow();
    D.componentRows(generation.components).forEach(row => {
      const place = placement[row.component_id] || {};
      const because = row.because || (place.where === "field" || place.where === "verification"
        ? "Included." : "Left out.");
      const mark = place.where === "field" ? ""
        : place.where === "verification" ? " (in the closing verification block)"
        : " (not in this prompt)";
      const control = el("button", "whyrow", "· " + row.label + mark + ": " + because);
      control.type = "button";
      control.setAttribute("aria-label", D.placementLine(place, row.label) + " Open it.");
      control.title = D.placementLine(place, row.label);
      control.addEventListener("click", () => { openFieldContext = null; openComponent(row.component_id); });
      why.appendChild(control);
    });
    body.appendChild(why);
  }

  /* Round two (R1): the check card is gone and nothing sits between the
     prompt and the buttons. The verification content lives inside the prompt
     text itself, as the closing VERIFICATION block the assembly writes; the
     return-if-failure route stays reachable through Fix This Result. The
     standalone Verify checklist screen is untouched. */

  /* The prompt itself, prominent and editable. */
  const promptBox = el("div", "promptbox");
  promptBox.appendChild(el("div", "fieldlabel", "The prompt for " + promptDestination().label));
  const area = document.createElement("textarea");
  area.id = "finalPrompt";
  area.setAttribute("aria-label", "The final prompt, editable");
  area.value = promptText();
  /* F2: the explicit empty state. The box is empty because every field is out,
     not because something failed quietly behind it. */
  area.placeholder = "Every field is left out of this prompt, so there is nothing to copy. "
    + "Open a field above and add it back.";
  area.addEventListener("input", () => {
    promptDraft = area.value;
    promptTouched = true; /* R5: an edited prompt makes Write a fresh run */
    scheduleRecovery();
  });
  promptBox.appendChild(area);
  body.appendChild(promptBox);

  /* The component list that used to live here, collapsed, is gone: the row at the
     top of this view is the same set of controls, opening the same editor, in the
     place where they are actually seen. */

  $("sourceCheckBtn").classList.toggle("hidden", !D.sourceCheckApplies(interpretation.task));
  syncVerifyPill();
  /* A real secondary button with a visible on state; the label never changes,
     the pressed state carries the meaning (D1.4). */
  $("copyReasonBtn").textContent = "Include reasoning";
  $("copyReasonBtn").setAttribute("aria-pressed", includeReasoning ? "true" : "false");
  $("whyBtn").textContent = "Why: " + ((generation.components || []).length) + " decisions";
  $("whyBtn").setAttribute("aria-expanded", whyOpen ? "true" : "false");
  $("copyBtn").disabled = !promptText().trim();
  $("copyBtn").title = $("copyBtn").disabled ? "There is nothing to copy yet: every field is empty or left out." : "";
  fitHeight();
  scheduleRecovery();
}

function promptText() {
  /* F2: no fallback to generation.final_prompt. An empty assembly is an empty
     prompt and says so on screen; it used to become the model's own authored
     text silently, which is how one run showed ROLE/TASK and the next showed
     markdown headings with nothing to explain the change. */
  const base = promptDraft || "";
  if (!includeReasoning || !generation) return base;
  return base + "\n\n---\nWhy this prompt is built this way:\n" + generation.overall_reasoning;
}

/* A chip is one of the eight canon fields (D2); opening it opens the folded
   components behind it, one at a time, with a small switcher when a field
   holds more than one. An empty field (Role, until a component feeds it)
   still opens, and says why there is nothing to edit. */
let openFieldContext = null;

function openField(chip) {
  openFieldContext = { label: chip.label, component_ids: chip.component_ids.slice() };
  if (!chip.component_ids.length) {
    $("compTitle").textContent = chip.label;
    $("compVerdict").textContent = "";
    $("compVerdict").className = "verdict";
    $("compContent").value = "";
    $("compContent").disabled = true;
    delete $("compContent").dataset.componentId;
    const why = clear($("compWhy"));
    why.appendChild(el("h3", null, "Why it is empty"));
    why.appendChild(paragraph("No component of this prompt feeds " + chip.label +
      " for this destination, so there is nothing to edit here yet."));
    $("compLesson").classList.add("hidden");
    const subnav = clear($("compSubnav"));
    subnav.classList.add("hidden");
    const toggle = $("compToggle");
    toggle.textContent = "Nothing to add";
    toggle.disabled = true;
    toggle.title = "This field has no component behind it on this destination.";
    show("viewComponent");
    return;
  }
  openComponent(chip.component_id);
}

function openComponent(componentId) {
  const row = D.componentRows(generation.components).find(c => c.component_id === componentId);
  if (!row) return;
  const field = openFieldContext && openFieldContext.component_ids.indexOf(componentId) > -1
    ? openFieldContext : null;
  $("compTitle").textContent = field
    ? field.label + (field.component_ids.length > 1 ? " · " + row.label : "")
    : row.label;
  /* F12: a field that folds several components opens its switcher, always. The
     first tap used to land on one of them silently, so a Constraints chip
     holding four components showed a quarter of what the prompt contained with
     nothing on screen to say there were three more. */
  const subnav = clear($("compSubnav"));
  if (field && field.component_ids.length > 1) {
    subnav.classList.remove("hidden");
    subnav.appendChild(el("span", "snote", field.label + " holds "
      + field.component_ids.length + " parts:"));
    D.componentButtons(generation.components)
      .filter(button => field.component_ids.indexOf(button.component_id) > -1)
      .forEach(button => {
        const pill = el("button", "action-pill" + (button.component_id === componentId ? " primary" : ""),
          button.label);
        pill.type = "button";
        pill.setAttribute("aria-pressed", button.component_id === componentId ? "true" : "false");
        pill.addEventListener("click", () => { saveComponent(); reassemblePrompt(); openComponent(button.component_id); });
        subnav.appendChild(pill);
      });
  } else {
    subnav.classList.add("hidden");
  }
  $("compContent").disabled = false;
  $("compToggle").disabled = false;
  $("compToggle").title = "";
  fillComponentEditor(row);
}

function fillComponentEditor(row) {
  $("compVerdict").textContent = row.verdict;
  $("compVerdict").className = "verdict";
  $("compContent").value = row.content;
  $("compContent").dataset.componentId = row.component_id;
  const why = clear($("compWhy"));
  /* F12: what the prompt actually holds for this component, when the fold
     changed it. The box above is the editable draft — editing it and going back
     re-assembles — but the person came here asking "what does the prompt say",
     and until now the answer on screen was the draft, which is a different
     string whenever the fold dropped a repeat, moved a task sentence out of
     Role, or put the layout back. Shown only when the two differ, so an
     unchanged component says nothing extra. */
  const folded = componentFoldedText(row.component_id);
  const place = (componentPlacementNow() || {})[row.component_id] || {};
  if (row.include && place.where === "verification") {
    /* R3: verification is prompt text and never a field, so the honest answer
       is where it went, not that it went nowhere. This branch used to fall
       through to "Everything here already appears in another field", which was
       true of a repeat and false of the one component that closes the prompt. */
    why.appendChild(el("h3", null, "What the prompt says"));
    why.appendChild(paragraph("This is the prompt's closing VERIFICATION block."));
    why.appendChild(paragraph(verificationBlockNow(), "snote"));
  } else if (row.include && place.where === "dropped") {
    why.appendChild(el("h3", null, "Not in the prompt"));
    why.appendChild(paragraph(place.why
      || "Nothing here reached the prompt."));
  } else if (row.include && folded !== String(row.content || "").trim()) {
    why.appendChild(el("h3", null, "What the prompt says"));
    why.appendChild(paragraph(folded));
  }
  why.appendChild(el("h3", null,
    place.where === "field" || place.where === "verification" ? "Why it is in" : "Why it is out"));
  why.appendChild(paragraph(row.because));
  const lesson = $("compLesson");
  clear(lesson);
  if (row.lesson) {
    lesson.classList.remove("hidden");
    lesson.appendChild(el("h3", null, "Rule of thumb"));
    lesson.appendChild(paragraph(row.lesson));
  } else {
    lesson.classList.add("hidden");
  }
  /* R3: a control that cannot act is worse than no control. Adding a component
     back that this destination folds away would change the checkbox and nothing
     else, so the button says so rather than promising a change it cannot make. */
  if (place.where === "dropped" && place.by === "destination") {
    $("compToggle").textContent = row.include ? "Remove from prompt" : "Add to prompt";
    $("compToggle").disabled = true;
    $("compToggle").title = place.why;
  } else {
    $("compToggle").disabled = false;
    $("compToggle").title = "";
    $("compToggle").textContent = row.include ? "Remove from prompt" : "Add to prompt";
  }
  show("viewComponent");
}
/* R3: the placement of every component in the prompt as it currently stands,
   read from the same assembly the prompt box holds. */
function componentPlacementNow() {
  if (!generation) return {};
  return D.componentPlacement(generation.components, promptTraits(),
    toolAssemblyOptions({ legal: !!(interpretation && interpretation.task
      && /^legal/.test(interpretation.task.family || "")) }));
}
function verificationBlockNow() {
  if (!generation) return "";
  return D.assembleBlocks(generation.components, promptTraits(),
    toolAssemblyOptions({ legal: !!(interpretation && interpretation.task
      && /^legal/.test(interpretation.task.family || "")) })).verification;
}
/* F12: the folded text for one component, as the prompt holds it. */
function componentFoldedText(componentId) {
  if (!generation) return "";
  return D.componentDetailText(generation.components, componentId,
    promptTraits(),
    toolAssemblyOptions({ legal: !!(interpretation && interpretation.task
      && /^legal/.test(interpretation.task.family || "")) }));
}
/* F3/F4: thin wrappers over the pure block, which owns the rules. The renderer
   supplies only the state — today's date, the loaded profile table, the current
   interpretation — so the behaviour itself stays testable. */
function today10() { return new Date().toISOString().slice(0, 10); }
function offerableProfiles() { return D.offerableProfiles(modelProfiles, today10()); }
function profilesForTool(dossier) { return D.profilesForTool(dossier, modelProfiles, today10()); }
function engineSeatFor(dossier) { return D.engineSeatFor(dossier, modelProfiles); }
/* R1: the reconciliation, bound to the tool the person has selected unless a
   caller names another. Every path that sets a destination goes through here. */
function destinationForTool(dossier, preferred) {
  return D.destinationForTool(dossier, modelProfiles, today10(), preferred);
}
function destinationForSelectedTool(preferred) {
  return destinationForTool(dossierById(selectedToolId()), preferred);
}
/* C3: the closing lesson, as the generate call receives it. */
function closingLessonPayload() {
  const view = selectedLessons && selectedLessons.closing;
  if (!view) return undefined;
  return {
    lesson_id: view.lesson_id,
    hook: view.hook,
    mechanism: view.mechanism,
    consequence: view.consequence
  };
}
/* Interpret receives the first two lesson bodies without any local identity. */
function connectionLessonPayload(view) {
  if (!view) return { hook: "", mechanism: "", consequence: "" };
  return {
    hook: String(view.hook || ""),
    mechanism: String(view.mechanism || ""),
    consequence: String(view.consequence || "")
  };
}
function recommendationBriefForSelectedTool() {
  return D.recommendationBrief(dossierById(selectedToolId()), modelProfiles, today10());
}
/* R2: the one destination every assembly decision reads. Before a generation
   there is only the live selection; after one, the prompt is a finished thing
   and the target it was compiled for is what describes it, whatever the
   selection has since become. */
function promptDestination() {
  return (promptTarget && promptTarget.destination) || destination;
}
function promptToolId() {
  return promptTarget && typeof promptTarget.tool_id === "string" && promptTarget.tool_id
    ? promptTarget.tool_id
    : selectedToolId();
}
function promptTraits() {
  const target = promptDestination();
  return D.destinationTraits(target && target.profile);
}
function destinationRationale() {
  const dossier = dossierById(selectedToolId());
  const offered = dossier ? profilesForTool(dossier) : null;
  const seat = dossier ? engineSeatFor(dossier) : null;
  return D.destinationRationale(destination,
    interpretation && interpretation.recommendation, modelProfiles,
    offered && offered.length ? offered : (seat ? [seat] : offered));
}
/* F2: a repair rewrites the objective, so it is written onto the objective
   component and the prompt is rebuilt from the components as usual. The
   component keeps its own verdict and reason; only the content changes, and the
   chip that opens it now shows what the prompt actually says. */
function applyRevisedInstruction(text) {
  const revised = String(text || "").trim();
  if (!generation || !revised) return false;
  const rows = Array.isArray(generation.components) ? generation.components : [];
  let target = rows.find(c => c && c.component_id === "objective");
  if (!target) target = rows.find(c => c && c.include && String(c.content || "").trim());
  if (!target) {
    target = { component_id: "objective", legacy_field: "task", include: true, content: "",
      verdict: "advisable", because: "", lesson: "" };
    generation.components = [target].concat(rows);
  }
  target.content = revised;
  target.include = true;
  target.because = "Rewritten by Fix This Result after the first answer did not hold up.";
  promptTouched = true;
  promptDraft = assembledPromptNow();
  return true;
}
/* F2: the single assembler. Every path that puts text in the prompt box goes
   through here, so the box can only ever hold the eight-canon fold — never the
   model's own authored prompt, and never a second format nobody chose. */
function assembledPromptNow() {
  if (!generation) return "";
  /* R2: no tool override parameter any more. A caller that had to remember to
     pass the right tool was a caller that could forget, and the reopen path was
     the only one that passed it, so every other reader of this prompt assembled
     it against whichever tool happened to be selected. The target carries it. */
  return D.assembleFromComponents(generation.components, promptTraits(),
    toolAssemblyOptions({ legal: !!(interpretation && interpretation.task
      && /^legal/.test(interpretation.task.family || "")) }));
}
/* The prompt text is reassembled from the fields whenever a field is edited
   or toggled; a direct edit to the prompt box survives until then (D2). */
function reassemblePrompt() {
  if (!generation) return;
  promptTouched = true; /* R5: a field toggle or edit changes the text */
  promptDraft = assembledPromptNow();
}
$("compBack").addEventListener("click", () => { saveComponent(); reassemblePrompt(); goBack(); });
$("compToggle").addEventListener("click", () => {
  const id = $("compContent").dataset.componentId;
  const component = (generation.components || []).find(c => c.component_id === id);
  if (component) component.include = !component.include;
  saveComponent();
  reassemblePrompt();
  renderResult();
});
function saveComponent() {
  const id = $("compContent").dataset.componentId;
  const component = (generation.components || []).find(c => c.component_id === id);
  if (component) component.content = $("compContent").value;
}

$("copyBtn").addEventListener("click", async () => {
  const text = promptText();
  if (!text.trim() || !bridge) return;
  await bridge.copy(text);
  const button = $("copyBtn");
  /* Exactly "Copied", for 1.4 seconds (D1.5). The word is in the markup and the
     class chooses it; the handler used to overwrite textContent, which would
     now delete both label spans on the first press. */
  button.classList.add("done");
  announce("Prompt copied.");
  if (entryId && bridge.ledgerStatus) bridge.ledgerStatus(entryId, "copied");
  setTimeout(() => { button.classList.remove("done"); }, 1400);
});
$("copyReasonBtn").addEventListener("click", () => {
  includeReasoning = !includeReasoning;
  renderResult();
});
$("whyBtn").addEventListener("click", () => {
  whyOpen = !whyOpen;
  renderResult();
});
$("reworkBtn").addEventListener("click", () => {
  if (!interpretation) { goCompose(); return; }
  renderIntermediary();
});
$("resBack").addEventListener("click", goBack);
$("newBtn").addEventListener("click", startNewPrompt);
$("resultHistoryBtn").addEventListener("click", openHistory);

async function startNewPrompt() {
  await flushRecovery();
  if (bridge && bridge.recoveryClearCurrent) { try { await bridge.recoveryClearCurrent(); } catch { /* nothing pending */ } }
  if (bridge && bridge.recoveryClearDraft) { try { await bridge.recoveryClearDraft(); } catch { /* nothing pending */ } }
  $("idea").value = "";
  attachments = [];
  interpretation = null;
  confirmed = null;
  intermediaryDraft = null;
  generationError = null;
  generation = null;
  promptTarget = null;
  panel = null;
  lessonState = { open_lesson_id: null };
  runLessonSelection = null; /* F1: the next prompt gets its own lesson */
  selectedLessons = null;
  waitLessons = [];
  pinnedLessonId = null;
  currentWaitLesson = null;
  emittedThisRun.clear();
  paintedFullRevisionKeys.clear();
  recordedActionsThisPrompt.clear();
  clearWaitLessonCard();
  policyEvaluation = null;
  transactionId = null;
  entryId = null;
  promptDraft = "";
  includeReasoning = false;
  whyOpen = false;
  lastInterpretHash = null;
  promptTouched = false;
  localFindings = null;
  overrideUntilEdit = false;
  sourceCheckResult = null;
  fixResult = null;
  recoveryEnabled = false;
  recoveryRevision = 0;
  checklist = null;
  if (verifyTick) { clearInterval(verifyTick); verifyTick = null; }
  renderAttachments();
  goCompose();
}

/* ---------- Source Check ----------
   Optional, post-result, and never part of the two-call core (Contracts §6.2). */
async function openSourceCheck() {
  show("viewSourceCheck");
  renderSourceCheck();
}
function renderSourceCheck() {
  const body = clear($("scBody"));
  const intro = panelBox("What this can and cannot tell you");
  intro.appendChild(paragraph(T ? T.SOURCE_CHECK_LIMIT_STATEMENT
    : "Comparing a claim to a supplied source is not proof that the claim is current or complete."));
  intro.appendChild(paragraph(T ? T.SOURCE_CHECK_ATTESTATION
    : "A completed check is your attestation, not O'Mono's."));
  body.appendChild(intro);

  if (!sourceCheckResult) {
    body.appendChild(paragraph(
      "Paste the answer you got back, then O'Mono compares each claim only against the sources you attached.",
      "snote"));
    const area = document.createElement("textarea");
    area.id = "scInput";
    area.rows = 5;
    area.setAttribute("aria-label", "The answer to check");
    area.placeholder = "Paste the answer you want checked";
    body.appendChild(area);
    $("scCounter").textContent = attachments.length
      ? attachments.length + " source" + (attachments.length === 1 ? "" : "s") + " attached"
      : "no sources attached";
    fitHeight();
    return;
  }

  const table = panelBox("Claim by claim");
  (sourceCheckResult.claims || []).forEach(claim => {
    const row = el("div", "claimrow");
    row.appendChild(el("div", null, claim.claim));
    row.appendChild(el("span", "verdict " + (claim.status === "supported" ? "pass" : "notice"),
      D.claimStatusLabel(claim.status)));
    if (claim.source_ref || claim.note) {
      row.appendChild(el("div", "cnote",
        [claim.source_ref, claim.note].filter(Boolean).join(" — ")));
    }
    table.appendChild(row);
  });
  body.appendChild(table);
  const limits = panelBox("The limit of this comparison", { className: "quiet" });
  limits.appendChild(paragraph(sourceCheckResult.limits || ""));
  if (Array.isArray(sourceCheckResult.compared_against) && sourceCheckResult.compared_against.length) {
    limits.appendChild(paragraph("Compared against: " + sourceCheckResult.compared_against.join(", "), "snote"));
  }
  body.appendChild(limits);
  $("scCounter").textContent = (sourceCheckResult.claims || []).length + " claims";
  fitHeight();
}
$("scRun").addEventListener("click", async () => {
  const input = $("scInput");
  const answer = input ? input.value.trim() : "";
  if (!answer) { if (input) input.focus(); return; }
  $("scRun").disabled = true;
  try {
    const result = await bridge.sourceCheck({
      transaction_id: transactionId,
      destination: { system_id: destination.system_id, model_id: destination.model_id },
      payload: {
        schema_version: "omono.source-check.v3",
        answer,
        sources: attachments.map(a => ({ id: a.id, label: a.label, excerpt: a.excerpt || "" }))
      }
    });
    if (!result || !result.ok) { showError(D.errorView(result && result.error)); show("viewCompose"); return; }
    sourceCheckResult = result.value;
    renderSourceCheck();
  } finally {
    $("scRun").disabled = false;
  }
});
$("scBack").addEventListener("click", goBack);
$("sourceCheckBtn").addEventListener("click", openSourceCheck);

/* ---------- Fix This Result ----------
   Takes the minimum diagnostic material and nothing more (Contracts §6.3). */
function openFixResult() {
  show("viewFix");
  renderFixResult();
}
function renderFixResult() {
  const body = clear($("fixBody"));
  const route = D.returnRoute(generation);
  const intro = panelBox("Bring back only this");
  intro.appendChild(paragraph(route ? route.bring_back
    : "The sentence, citation, claim, source passage, error message, or output fragment that did not hold up."));
  body.appendChild(intro);

  if (!fixResult) {
    const select = document.createElement("select");
    select.id = "fixKind";
    select.setAttribute("aria-label", "What are you bringing back?");
    D.RETURNED_MATERIAL_CATEGORIES.forEach(kind => {
      const option = el("option", null, D.returnedMaterialLabel(kind));
      option.value = kind;
      select.appendChild(option);
    });
    const row = el("div", "srow");
    const label = el("label", null, "What is it?");
    label.htmlFor = "fixKind";
    row.appendChild(label);
    row.appendChild(select);
    body.appendChild(row);
    const area = document.createElement("textarea");
    area.id = "fixInput";
    area.rows = 4;
    area.setAttribute("aria-label", "The material that did not hold up");
    area.placeholder = "Paste only that part";
    body.appendChild(area);
    fitHeight();
    return;
  }

  const diagnosis = panelBox("What went wrong", { className: "strong" });
  diagnosis.appendChild(paragraph(fixResult.diagnosis));
  body.appendChild(diagnosis);
  const changes = panelBox("What O'Mono changed");
  (fixResult.changes || []).forEach(change => {
    changes.appendChild(paragraph(change.target + ": " + change.change));
    changes.appendChild(paragraph(change.because, "snote"));
  });
  body.appendChild(changes);
  if (fixResult.revised_instruction) {
    const revised = panelBox("The revised instruction");
    revised.appendChild(paragraph(fixResult.revised_instruction));
    const apply = el("button", "btn btn-gold", "Use this instead");
    apply.type = "button";
    apply.addEventListener("click", () => {
      /* F2: the revision lands in the component it revises, then the fold
         rebuilds the prompt. Writing it straight into the box produced a third
         prompt format — free prose with no field labels — and detached the
         chips from the text they claim to describe. */
      applyRevisedInstruction(fixResult.revised_instruction);
      renderResult();
    });
    revised.appendChild(apply);
    body.appendChild(revised);
  }
  fitHeight();
}
$("fixRun").addEventListener("click", async () => {
  const input = $("fixInput");
  const material = input ? input.value.trim() : "";
  if (!material) { if (input) input.focus(); return; }
  const kindSelect = $("fixKind");
  $("fixRun").disabled = true;
  try {
    const result = await bridge.fixResult({
      transaction_id: transactionId,
      destination: { system_id: destination.system_id, model_id: destination.model_id },
      payload: {
        schema_version: "omono.fix-result.v3",
        returned_material_category: kindSelect ? kindSelect.value : "other",
        material,
        original_prompt: promptText()
      }
    });
    if (!result || !result.ok) { showError(D.errorView(result && result.error)); show("viewCompose"); return; }
    fixResult = result.value;
    if (transactionId) {
      await recordPromptOutcome(transactionId, entryId, "partly", {
        failure_category: fixResult.failure_category, repair_id: fixResult.repair_id,
        returned_material_category: kindSelect ? kindSelect.value : "other"
      }).catch(() => { /* the diagnosis is still useful without the record */ });
    }
    renderFixResult();
  } finally {
    $("fixRun").disabled = false;
  }
});
$("fixBack").addEventListener("click", goBack);
$("fixResultBtn").addEventListener("click", openFixResult);

/* U9: openCreator, renderCreator, the elevation flow and the sheet's
   listeners are deleted; the accelerator is gone from the menu and the
   grant path is removed from effective-policy. Nothing overrides a
   classification. */

/* T4: what the selected tool contributes to assembly — its surface type
   and its double_check sentences (display-stripped). The eight chips stay
   the canon; only prompt-text assembly varies. */
function toolAssemblyOptions(extra, toolIdOverride) {
  const R = window.OMonoToolRegister;
  /* F2: a reopened prompt assembles against the tool it was written for, not
     whichever tool happens to be selected now — otherwise switching tools
     silently changes the field order of a prompt already in the record. */
  /* R2: the tool this prompt was written for, not whichever is selected at the
     moment this happens to be called. promptToolId falls back to the live
     selection before a generation exists, which is the only time the two can
     honestly differ. */
  const toolId = toolIdOverride
    || (typeof promptToolId === "function" ? promptToolId() : "")
    || (typeof selectedToolId === "function" ? selectedToolId() : "");
  const dossier = typeof dossierById === "function" ? dossierById(toolId) : null;
  const out = Object.assign({}, extra || {});
  if (R && dossier) {
    out.surface = dossier.surface_type;
    out.double_check_lines = R.displayText(dossier.double_check)
      .split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean).slice(0, 4);
  }
  return out;
}

/* ---------- T3: the Tools section ---------- */
const TOOL_STACK_KEY = "omono.toolstack";
let approvedToolDrafts = []; /* user-approved Other/Update drafts, this world */
function toolStack() {
  try { return JSON.parse(localStorage.getItem(TOOL_STACK_KEY) || "null"); }
  catch { return null; }
}
function saveToolStack(ids) {
  try { localStorage.setItem(TOOL_STACK_KEY, JSON.stringify(ids)); } catch { /* full */ }
}
function allDossiers() {
  const R = window.OMonoToolRegister;
  const base = R ? R.founding() : [];
  return base.concat(approvedToolDrafts);
}
function dossierById(id) {
  return allDossiers().find(d => d.id === id) || null;
}
function selectedToolId() {
  try { return localStorage.getItem("omono.tool") || "claude"; } catch { return "claude"; }
}

function renderToolsSection() {
  const R = window.OMonoToolRegister;
  if (!R || !$("toolsCards")) return;
  const stack = toolStack();
  const cards = clear($("toolsCards"));
  if (!Array.isArray(stack)) {
    cards.appendChild(paragraph("Run setup to seed your stack; every tool stays changeable here.", "snote"));
  }
  (Array.isArray(stack) ? stack : []).forEach(id => {
    const d = dossierById(id);
    if (!d) return;
    const card = panelBox(null, { className: "quiet" });
    card.appendChild(el("div", "fieldlabel", d.display_name + " — " + d.maker + ", " + d.surface_type));
    const expiryState = R.expiryState(d, Date.now());
    card.appendChild(paragraph("Checked " + d.checked.date + "."
      + (expiryState.expired
        ? " Past its three-month shelf life; worth a re-check when convenient — everything below still reads."
        : " Fresh until " + d.checked.expires + "."), "snote"));
    const open = document.createElement("details");
    open.className = "disclosure";
    open.appendChild(el("summary", null, "Read the dossier"));
    const body = el("div");
    [["Good at", "good_at"], ["Avoid", "avoid"],
      ["How to shape the prompt", "prompt_shaping"],
      ["Where the prompts go", "prompt_surfaces"],
      ["Double-check in its answers", "double_check"]].forEach(([label, field]) => {
      body.appendChild(el("div", "fieldlabel", label));
      const text = R.displayText(d[field]);
      const para = paragraph(text, "snote");
      /* P7: a mapped passage carries the expand mark; tapping opens the
         lesson card inline and writes a REAL lesson emission counting
         toward the curriculum. Unmapped reading stays dossier_opened
         engagement only. */
      const Registry = window.OMonoDossierLessonRegistry;
      const lessonId = Registry ? Registry.lessonForPassage(field, text) : null;
      if (lessonId) {
        const mark = el("button", "infodot dossmark", "⊕");
        mark.type = "button";
        mark.setAttribute("aria-label", "Open the lesson this passage teaches");
        mark.dataset.lesson = lessonId;
        mark.addEventListener("click", async () => {
          const prior = para.querySelector(".lessoncard");
          if (prior) { prior.remove(); return; }
          const pool = lessonPoolV5();
          const view = pool.find(v => v.lesson_id === lessonId);
          if (!view) return;
          const inlineCard = el("div", "lessoncard v4card");
          inlineCard.appendChild(el("div", "v4title", view.hook));
          inlineCard.appendChild(paragraph(view.mechanism, "snote"));
          inlineCard.appendChild(paragraph(view.consequence, "snote"));
          para.appendChild(inlineCard);
          if (bridge && bridge.lessonEmit) {
            try {
              await bridge.lessonEmit({ lesson_id: lessonId, context: "dossier", audience: "user" });
            } catch { /* the card still shows */ }
          }
        });
        para.appendChild(mark);
      }
      body.appendChild(para);
    });
    if (d.models_note) {
      body.appendChild(el("div", "fieldlabel", "Models"));
      body.appendChild(paragraph(R.displayText(d.models_note), "snote"));
    }
    const sources = document.createElement("details");
    sources.className = "disclosure";
    sources.appendChild(el("summary", null, "Sources"));
    (d.checked.sources || []).forEach(src => {
      sources.appendChild(paragraph("· " + src.label, "snote"));
    });
    body.appendChild(sources);
    open.appendChild(body);
    /* Reading is a signal: one engagement event per open, re-reads
       recorded as such; never a curriculum emission. */
    open.addEventListener("toggle", () => {
      if (open.open && bridge && bridge.dossierOpened) {
        bridge.dossierOpened({ tool: d.id });
      }
    });
    card.appendChild(open);
    if (appMode !== "personal" && d.firm_notes) {
      card.appendChild(el("div", "fieldlabel", "Firm notes"));
      card.appendChild(paragraph(d.firm_notes, "snote"));
    }
    const row = el("div", "srow");
    const update = el("button", "tbtn", "Update");
    update.type = "button";
    update.title = "Re-run research for this tool alone; the result arrives as a diff for approval.";
    update.addEventListener("click", () => runDossierResearch(d.display_name, d.id, card));
    row.appendChild(update);
    card.appendChild(row);
    cards.appendChild(card);
  });
}

/* The Update and Other flows share the research door. Personal: the user
   approves the diff; enterprise: the admin approves (the managed register
   editability rules govern, unchanged). */
async function runDossierResearch(toolName, existingId, hostCard) {
  const note = $("toolsOtherNote");
  note.classList.remove("hidden");
  if (!bridge || !bridge.dossierResearch) { note.textContent = "Research is unavailable here."; return; }
  note.textContent = "Researching " + toolName + "…";
  let result = null;
  try { result = await bridge.dossierResearch({ tool_name: toolName }); } catch { result = null; }
  if (!result || !result.established || !result.draft) {
    note.textContent = "Research could not establish " + toolName
      + "; the clearly labeled generic instruction applies (the Other tool card).";
    return;
  }
  const draft = result.draft;
  const prior = existingId ? dossierById(existingId) : null;
  const diffLines = [];
  ["good_at", "avoid", "prompt_shaping", "double_check"].forEach(field => {
    const before = prior ? String(prior[field] || "") : "";
    const after = String(draft[field] || "");
    if (before !== after) diffLines.push(field + ": " + (before ? "changed" : "new"));
  });
  note.textContent = "Draft for " + (draft.display_name || toolName) + " — "
    + (diffLines.length ? diffLines.join("; ") : "no changes") + ". ";
  const approve = el("button", "tbtn", appMode === "personal" ? "Approve" : "Approve (admin)");
  approve.type = "button";
  approve.addEventListener("click", () => {
    approvedToolDrafts = approvedToolDrafts.filter(x => x.id !== draft.id).concat([draft]);
    const stack = toolStack() || [];
    if (stack.indexOf(draft.id) === -1) saveToolStack(stack.concat([draft.id]));
    note.textContent = "Approved: " + (draft.display_name || toolName) + " joined the stack.";
    renderToolsSection();
    renderDestinationSelect();
  });
  note.appendChild(approve);
}

/* ---------- Settings ---------- */
async function openSettings() {
  await refreshAppMode();
  if (window.__syncPrivacyControls) window.__syncPrivacyControls();
  await syncLessonApprovalControls();
  await renderPendingLessons();
  await loadProfiles();
  renderDestinationSelect();
  await loadPolicySettings();
  await renderMatterScreening();
  await loadCredentialStatus();
  await renderOwnerIdentity();
  await renderRegisterEditor();
  await refreshLegacyKeyState();
  renderToolsSection();
  $("engineNote").textContent = "Engine v" + E.ENGINE_VERSION + " (" + E.ENGINE_DATE + "). " +
    "Registry as of " + REGISTRY.as_of + ". Your key is kept on this device until you clear it. " +
    "Command-Enter or Control-Enter advances the current prompt.";
  show("viewSettings");
}
$("settingsBtn").addEventListener("click", openSettings);
$("setupRerunBtn").addEventListener("click", () => openSetup());
$("toolsOtherBtn").addEventListener("click", () => {
  const name = $("toolsOtherName").value.trim();
  if (name) runDossierResearch(name, null, null);
});
$("setBack").addEventListener("click", goBack);

/* Who this installation belongs to. The name is a label a person reads in an
   audit line; the identifier under it stays random and is what actually appears
   in a security event. Renaming asks for the password and changes nothing else. */
async function renderOwnerIdentity() {
  const note = $("ownerNote");
  if (!note || !bridge || !bridge.authStatus) return;
  let status = null;
  try { status = await bridge.authStatus(); } catch { status = null; }
  ownerDisplayName = (status && status.display_name) || "";
  clear(note);
  if (!status || !status.initialized) {
    note.appendChild(document.createTextNode("No owner account exists on this Mac yet."));
    return;
  }
  note.appendChild(document.createTextNode(status.display_name
    ? "Owner: " + status.display_name + ". Protected changes are recorded against this name."
    : "This installation has no owner name. Protected changes are recorded against an identifier only."));
  const rename = el("button", "tbtn", status.display_name ? "Change the name" : "Add a name");
  rename.type = "button";
  rename.addEventListener("click", async () => {
    const chosen = await askOwner("Name on this installation",
      "Recorded beside protected changes so an audit line names a person. It is not a login: " +
      "the password alone opens this account. Letters, spaces, hyphens and apostrophes; no " +
      "email addresses.", "Name");
    if (!chosen || !chosen.password) return;
    const result = await bridge.authSetDisplayName({
      password: chosen.password, display_name: chosen.reason || "" });
    if (!result || !result.applied) {
      announce("The name was not changed.");
      return;
    }
    ownerDisplayName = result.display_name || "";
    announce("The name on this installation was changed.");
    await renderOwnerIdentity();
  });
  note.appendChild(rename);
}

async function loadCredentialStatus() {
  if (!bridge || !bridge.apiCredentialStatus) return;
  try {
    const status = await bridge.apiCredentialStatus();
    $("apiKeyNote").textContent = status && status.configured
      ? "A key is kept on this device. Saving a new one replaces it; clearing it removes it."
      : "Enter your Anthropic key before writing a prompt. It is kept on this device until you clear it.";
  } catch { $("apiKeyNote").textContent = ""; }
}
$("apiKeySave").addEventListener("click", async () => {
  const field = $("apiKey");
  const value = field.value.trim();
  if (!value) { field.focus(); return; }
  field.value = "";
  conceal(field);
  try {
    const result = await bridge.setApiCredential({ value });
    $("apiKeyNote").textContent = result && result.ok
      ? "Kept on this device, in ordinary browser storage."
      : "That key could not be used in this tab. Check the key and try again.";
  } catch { $("apiKeyNote").textContent = "That key could not be used in this tab."; }
});

async function loadPolicySettings() {
  if (!bridge || !bridge.policySettings) return;
  try {
    const settings = await bridge.policySettings();
    if (settings && settings.mode) $("modeSelect").value = settings.mode;
    if (settings && settings.posture) $("postureSelect").value = settings.posture;
    $("policySettingsNote").textContent =
      "These settings apply to this browser on this device.";
  } catch { /* defaults stay on screen */ }
  if (bridge.policyManagedStatus) {
    try {
      const managed = await bridge.policyManagedStatus();
      $("managedNote").textContent = managed && managed.applicable
        ? (managed.message || "") + (managed.organization ? " (" + managed.organization + ")" : "")
        : "";
    } catch { $("managedNote").textContent = ""; }
  }
}
/* A protected change asks for the owner password and a written reason, both of
   which go into the security audit.

   This used to call window.prompt twice. window.prompt THROWS in Electron
   ("prompt() is not supported"), and the call sat outside the try, so the handler
   raised before it ever reached IPC: the dropdown showed its new value, nothing
   was applied, and no error was shown. Mode and strictness could not be changed
   at all. This is an in-window sheet instead. */
/* `secondLabel` names the second field. Protected changes want a Reason; the
   rename sheet wants a Name. Same sheet, honest label. */
function askOwner(title, detail, secondLabel, secondRequired, actionLabel) {
  return new Promise(resolve => {
    const needsSecondField = secondRequired !== false;
    /* Built with createElement, never innerHTML. The renderer has one rule about
       markup and it does not have an exception for strings that happen to be
       static today (tests/palette-renderer.test.js). */
    const sheet = el("div", "sheet");
    const box = panelBox(title, { className: "strong" });
    box.appendChild(paragraph(detail, "snote"));
    /* Stated, not asked for. The account already knows who this is, and a name
       typed here could differ from the account's, which would turn the audit
       line into a claim rather than a fact. */
    box.appendChild(paragraph(D.signingAsLine(ownerDisplayName), "signing"));

    const passRow = el("div", "srow");
    const passLabel = el("label", null, "Owner password");
    passLabel.setAttribute("for", "pcPass");
    const pass = document.createElement("input");
    pass.type = "password";
    pass.id = "pcPass";
    pass.autocomplete = "current-password";
    passRow.appendChild(passLabel);
    passRow.appendChild(pass);
    attachReveal(pass, "owner password");
    box.appendChild(passRow);

    const reasonRow = el("div", "srow");
    const reasonLabel = el("label", null, secondLabel || "Reason");
    reasonLabel.setAttribute("for", "pcReason");
    const reason = document.createElement("input");
    reason.type = "text";
    reason.id = "pcReason";
    reason.maxLength = 600;
    reasonRow.appendChild(reasonLabel);
    reasonRow.appendChild(reason);
    if (needsSecondField) box.appendChild(reasonRow);

    const note = el("div", "snote");
    note.id = "pcNote";
    box.appendChild(note);

    const foot = el("div", "footbar");
    foot.appendChild(el("span", "spacer"));
    const cancel = el("button", "tbtn", "Cancel");
    cancel.type = "button";
    cancel.id = "pcCancel";
    const ok = el("button", "btn btn-gold", actionLabel || "Apply");
    ok.type = "button";
    ok.id = "pcOk";
    ok.style.padding = "5px 13px";
    ok.style.fontSize = "13px";
    foot.appendChild(cancel);
    foot.appendChild(ok);
    box.appendChild(foot);

    sheet.appendChild(box);
    document.body.appendChild(sheet);
    pass.focus();

    const close = (value) => { sheet.remove(); resolve(value); };
    cancel.addEventListener("click", () => close(null));
    ok.addEventListener("click", () => {
      if (!pass.value) { note.textContent = "The password is required."; return; }
      if (needsSecondField && !reason.value.trim()) {
        note.textContent = "A reason is written to the audit, so one is required.";
        return;
      }
      close({ password: pass.value, reason: reason.value.trim() });
    });
    sheet.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(null); }
    });
  });
}

async function protectedChange(change, value) {
  if (change !== "strictness" && change !== "retention") {
    await loadPolicySettings(); return;
  }
  const answer = { password: "", reason: "Personal browser setting" };
  let result = null;
  try {
    result = await bridge.policyProtectedChange({
      change, value, password: answer.password, reason: answer.reason
    });
  } catch { result = null; }
  $("policySettingsNote").textContent = result && result.applied
    ? "Changed in this browser."
    : "Not changed: " + String((result && (result.detail || result.reason)) || "refused").replace(/_/g, " ");
  await loadPolicySettings();
}
$("modeSelect").addEventListener("change", () => protectedChange("mode", $("modeSelect").value));
$("postureSelect").addEventListener("change", () => protectedChange("strictness", $("postureSelect").value));
$("themeSelect").addEventListener("change", async () => {
  if (!bridge || !bridge.setTheme) return;
  applyTheme(await bridge.setTheme(D.normalizeThemeSource($("themeSelect").value)));
});

/* Local Matter Screening. Everything on screen comes from the policy module's
   view object, and when the feature is not configured that object has nothing to
   render — so neither does this. */
async function renderMatterScreening() {
  const slotNode = clear($("matterSlot"));
  const setupRow = clear($("matterSetupRow"));
  /* Owner ruling, 2026-09-17: the screener is off in Personal, Local Matter
     Screening included. The enterprise modes keep it. */
  if (appMode === "personal") return;
  let view = null;
  if (bridge && bridge.policyMatterScreeningView) {
    try { view = await bridge.policyMatterScreeningView(); } catch { view = null; }
  }
  if (!D.matterScreeningVisible(view)) {
    /* Invisible until configured: no control, no status line, no empty box, no
       sample name, no matter-number syntax, no "0 entries". The only trace is one
       neutral line inside Advanced explaining what could be set up. */
    const setUp = el("button", "tbtn", "Set up Local Matter Screening");
    setUp.type = "button";
    setUp.addEventListener("click", () => openMatterSetup(view));
    setupRow.appendChild(setUp);
    $("advancedNote").textContent =
      "Local Matter Screening is an optional local check. If you set it up, you tell O'Mono the " +
      "client names, matter numbers, opposing parties and case captions it should watch for, and " +
      "it warns you before any of them leave this Mac. The list stays encrypted here and is never " +
      "sent or exported.";
    return;
  }
  const box = panelBox("Local Matter Screening");
  box.appendChild(paragraph(D.matterStatusLine(view)));
  const configure = el("button", "tbtn", "Configure");
  configure.type = "button";
  configure.addEventListener("click", () => openMatterSetup(view));
  box.appendChild(configure);
  slotNode.appendChild(box);
  $("advancedNote").textContent = "";
}

let matterEntries = [];
function openMatterSetup(view) {
  matterEntries = [];
  const body = clear($("matBody"));
  const intro = panelBox("What this is");
  intro.appendChild(paragraph(
    "Local Matter Screening compares what you are about to send against a list you keep on this " +
    "Mac. If something on the list appears, O'Mono says so before anything leaves."));
  intro.appendChild(paragraph(
    "You can add client names, matter numbers, opposing parties and case captions. The list is " +
    "encrypted on this Mac, matched here, and never sent to a model, exported, or written to any " +
    "record.", "snote"));
  body.appendChild(intro);

  const actions = D.matterActions(view);
  const known = actions.length ? actions
    : (P && P.matterScreening
        ? P.matterScreening.KINDS.map(k => ({ kind: k, label: P.matterScreening.KIND_ACTION[k] }))
        : []);
  const list = el("div");
  body.appendChild(list);
  known.forEach(action => {
    const button = el("button", "btn btn-ghost", action.label);
    button.type = "button";
    button.addEventListener("click", () => {
      matterEntries.push({ kind: action.kind, value: "" });
      renderMatterEntries(list);
    });
    body.appendChild(button);
  });
  renderMatterEntries(list);
  show("viewMatterSetup");
}
function renderMatterEntries(list) {
  clear(list);
  matterEntries.forEach((entry, index) => {
    const row = el("div", "srow");
    const label = el("label", null,
      (P && P.matterScreening ? P.matterScreening.KIND_ACTION[entry.kind] : entry.kind).replace(/^Add /, ""));
    label.htmlFor = "matter-" + index;
    const input = document.createElement("input");
    input.type = "text";
    input.id = "matter-" + index;
    input.value = entry.value;
    input.addEventListener("input", () => { entry.value = input.value; });
    const remove = el("button", "tbtn", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => { matterEntries.splice(index, 1); renderMatterEntries(list); });
    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(remove);
    list.appendChild(row);
  });
  fitHeight();
}
$("matSave").addEventListener("click", async () => {
  if (!bridge || !bridge.policyMatterScreeningConfigure) return;
  const entries = matterEntries.filter(e => e.value.trim().length >= 3);
  try { await bridge.policyMatterScreeningConfigure({ entries, enabled: true }); }
  catch { /* the view below reports whatever actually landed */ }
  await renderMatterScreening();
  show("viewSettings");
});
$("matBack").addEventListener("click", goBack);

$("exportConfigBtn").addEventListener("click", async () => {
  if (!bridge || !bridge.exportConfiguration) return;
  const result = await bridge.exportConfiguration({ config: {} });
  $("advancedNote").textContent = result && result.ok
    ? "Written: " + result.files.join(", ")
    : "Not written: " + ((result && result.problems) || []).join("; ");
});
function currentQuarterPeriod(reference) {
  const date = reference instanceof Date ? reference : new Date();
  const year = date.getFullYear();
  const firstMonth = Math.floor(date.getMonth() / 3) * 3;
  const start = new Date(year, firstMonth, 1, 12, 0, 0, 0);
  const end = new Date(year, firstMonth + 3, 0, 12, 0, 0, 0);
  const day = value => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0")].join("-");
  return { period_start: day(start), period_end: day(end) };
}
$("exportReportBtn").addEventListener("click", async () => {
  if (!bridge || !bridge.exportEnterpriseReport) return;
  const result = await bridge.exportEnterpriseReport(Object.assign({ config: {} }, currentQuarterPeriod()));
  $("advancedNote").textContent = result && result.ok
    ? "Written: " + result.files.join(", ")
    : "Not written: " + ((result && result.problems) || []).join("; ");
});
$("exportEnterpriseCurriculumBtn").addEventListener("click", async () => {
  if (!bridge || !bridge.exportEnterpriseCurriculum || !bridge.authElevate) return;
  const answer = await askOwner("Export the enterprise curriculum",
    "The curriculum and its private recommendations are available only to the enterprise administrator.",
    null, false, "Export");
  if (!answer) return;
  let elevated = null;
  try {
    elevated = await bridge.authElevate({ password: answer.password, scope: "enterprise_admin" });
  } catch { elevated = null; }
  if (!elevated || elevated.elevated !== true) {
    $("advancedNote").textContent = "Not written: the owner password did not open administrator access.";
    return;
  }
  let result = null;
  try { result = await bridge.exportEnterpriseCurriculum({}); }
  catch { result = { ok: false, problems: ["the enterprise curriculum could not be written"] }; }
  finally {
    if (bridge.authEndElevation) {
      try { await bridge.authEndElevation(); } catch { /* expires on its own */ }
    }
  }
  $("advancedNote").textContent = result && result.ok
    ? "Written: " + result.files.join(", ")
    : "Not written: " + ((result && result.problems) || []).join("; ");
});
/* The cohort report is another state of this same window, at the same bounds.
   It never opens a second window and never becomes a dashboard (Contracts §18). */
$("openCohortBtn").addEventListener("click", async () => {
  if (!bridge || !bridge.openView) return;
  await flushRecovery();
  await bridge.openView("cohort");
});

/* ---------- History ---------- */
/* ---------- the verification loop (D4) ----------
   One outcome writer for every tap: the canonical v3 record (keyed by
   transaction id) plus the legacy verdict (keyed by the history row), so the
   History fold, the outcome filter and the badge all see what was answered. */
async function recordPromptOutcome(transactionIdValue, entryRef, outcome, extras) {
  const record = Object.assign({
    transaction_id: transactionIdValue, ts: Date.now(), outcome
  }, extras || {});
  if (bridge && bridge.recordOutcome && transactionIdValue) {
    try { await bridge.recordOutcome(record); } catch { /* still on screen */ }
  }
  if (bridge && bridge.ledgerOutcome && entryRef) {
    try { await bridge.ledgerOutcome({ ref: entryRef, verdict: outcome }); } catch { /* fold only */ }
  }
  refreshVerifyBadge();
  checkCelebrations();
}

/* v4 (D5): one refresh attempt. Runs at boot and again when first-launch
   setup completes, because before setup there is no credential and no chosen
   mode, so the boot attempt on a first launch correctly does nothing. */
async function runRefreshPipeline() {
  if (!bridge || !bridge.refreshRun) return;
  /* R1/R7: never while onboarding or setup is still on screen. The mode is
     chosen during onboarding, so a pass that fires 900ms after the window paints
     reads `personal` on a deployment that is about to be enterprise — and a
     deployment's first day of growth would then be evaluated, and its shipment
     skipped, under the wrong mode entirely. The pass runs when the application
     has actually reached the person. */
  const view = (document.querySelector("section.view:not(.hidden)") || {}).id || "";
  if (view === "viewOnboard" || view === "viewSetup") return;
  try {
    const run = await bridge.refreshRun({});
    /* Pass four (L5): candidates land in the lesson store in the main
       process, gated and routed by the approval policy; the renderer just
       refreshes its caches. Nothing parks in localStorage anymore.
       R1/R6: silent — no screen, no dialog, nothing interrupted. What arrived
       is kept for the Learning view to say in one line when it is opened. */
    if (run && run.refreshed) {
      lastRefreshRun = run;
      refreshLessonCaches();
    }
  } catch { /* keep the pool; retry next open */ }
}

/* Lessons never repeat (owner ruling, 2026-09-17). When the selector says the
   unseen lessons are running low, ask the refresh for more. Overlapping asks
   collapse into one; the main process spaces them so a low pool cannot turn
   into repeated paid calls. */
let moreLessonsRequest = null;
function requestMoreLessons() {
  if (moreLessonsRequest || !bridge || !bridge.refreshRun) return moreLessonsRequest;
  moreLessonsRequest = bridge.refreshRun({ reason: "needs_more" })
    .then((run) => {
      if (run && run.refreshed) {
        lastRefreshRun = run;
        refreshLessonCaches();
      }
      return run;
    })
    .catch(() => null)
    .finally(() => { moreLessonsRequest = null; });
  return moreLessonsRequest;
}

/* Pass four (L5): the pending candidates and the approval controls.
   Personal: the Learning toggle decides auto or manual, and manual review
   happens in the Learning panel. Enterprise and demo: approval is the
   administrator's, decided in the signed profile, and the INTERIM
   approve-and-reject list below the managed settings carries it until the
   admin panel arrives. */
async function syncLessonApprovalControls() {
  const row = $("lessonApprovalRow");
  const note = $("lessonApprovalManagedNote");
  if (!row || !note) return;
  const enterprise = appMode !== "personal";
  row.classList.toggle("hidden", enterprise);
  note.classList.toggle("hidden", !enterprise);
  if (!enterprise && bridge && bridge.lessonApprovalPolicy) {
    try {
      const state = await bridge.lessonApprovalPolicy({});
      $("lessonApprovalToggle").checked = !!(state && state.policy === "manual");
    } catch { /* toggle keeps its last state */ }
  }
}
async function renderPendingLessons() {
  const personalSlot = $("pendingLessonsSlot");
  const enterpriseSlot = $("pendingLessonsEnterpriseSlot");
  if (!personalSlot || !enterpriseSlot) return;
  clear(personalSlot);
  clear(enterpriseSlot);
  if (!bridge || !bridge.lessonsPending) return;
  let pending = [];
  try { pending = ((await bridge.lessonsPending()) || {}).lessons || []; }
  catch { pending = []; }
  if (!pending.length) return;
  const slot = appMode === "personal" ? personalSlot : enterpriseSlot;
  const E5 = window.OMonoLessonEngineV5;
  slot.appendChild(el("div", "fieldlabel", "Pending lessons (" + pending.length + ")"));
  if (appMode !== "personal") {
    slot.appendChild(paragraph("Interim review list, until the admin panel session.", "snote"));
  }
  pending.forEach(lesson => {
    if (!E5) return;
    const view = E5.renderView(lesson, lessonTone());
    const card = buildLessonCardV5(view, { binding_line: "Awaiting review; not yet in the pool." });
    const row = el("div", "srow");
    const approve = el("button", "tbtn", "Approve");
    approve.type = "button";
    approve.addEventListener("click", async () => {
      try { await bridge.lessonApprove({ lesson_id: lesson.lesson_id }); } catch { /* stays pending */ }
      refreshLessonCaches();
      renderPendingLessons();
    });
    const reject = el("button", "tbtn", "Reject");
    reject.type = "button";
    reject.addEventListener("click", async () => {
      try { await bridge.lessonReject({ lesson_id: lesson.lesson_id }); } catch { /* stays pending */ }
      renderPendingLessons();
    });
    row.appendChild(approve);
    row.appendChild(reject);
    card.appendChild(row);
    slot.appendChild(card);
  });
}

/* v4 (D6/D7): the renderer's cached mode. Personal is the only mode with a
   streak or celebrations; managed_enterprise and enterprise_demo carry
   neither, and enterprise_demo mirrors managed_enterprise in every surface. */
let appMode = "personal";
async function refreshAppMode() {
  try {
    const settings = await bridge.policySettings();
    if (settings && settings.mode) appMode = settings.mode;
  } catch { /* personal stands */ }
  if (appMode === "managed_enterprise" || appMode === "enterprise_demo") {
    try {
      const managed = await bridge.policyManagedStatus();
      managedPrivacyFlag = !!(managed && managed.destinations_private);
    } catch { managedPrivacyFlag = false; }
  } else {
    managedPrivacyFlag = false;
  }
  $("exportEnterpriseCurriculumBtn").classList.toggle("hidden", appMode !== "managed_enterprise");
  /* Owner ruling, 2026-09-17: no screener in Personal, so no strictness control. */
  $("postureRow").classList.toggle("hidden", appMode === "personal");
  return appMode;
}

/* Round two (R3): the privacy declaration. "Destinations are private" hides
   the Redact surface and suppresses the advisory classification line. It is
   a display and workflow gate only: classification records still write to
   the ledger regardless, because the curriculum depends on them. Personal
   mode owns its own flag; the enterprise modes read the managed profile's,
   which only an administrator can set. */
let managedPrivacyFlag = false;
function destinationsPrivate() {
  if (appMode === "managed_enterprise" || appMode === "enterprise_demo") {
    return managedPrivacyFlag === true;
  }
  try { return localStorage.getItem("omono_v4_destinations_private") === "1"; }
  catch { return false; }
}

/* Celebrations (D7): rare landmarks only, each paired with one concrete
   check, at most one card at a time, never about gaps, never points. A new
   mechanic explains itself in one plain line, the first time only. */
async function checkCelebrations() {
  if (appMode !== "personal") return;
  const P = window.OMonoPracticeV4;
  if (!P || !bridge || !bridge.practiceCounts) return;
  let counts;
  try { counts = await bridge.practiceCounts(); } catch { return; }
  const seen = (() => {
    try { return JSON.parse(localStorage.getItem("omono_v4_landmarks") || "[]"); }
    catch { return []; }
  })();
  const state = {
    verified_count: counts.verified_count || 0,
    first_repair: counts.first_repair === true,
    first_quiet_category: P.firstQuietCategory(counts.failures_by_month || {}, Date.now())
  };
  const due = P.landmarksDue(state, seen);
  if (!due.length) return;
  const landmark = due[0];
  const prior = document.getElementById("celebrateCard");
  if (prior) prior.remove();
  const card = el("div", "panel quiet");
  card.id = "celebrateCard";
  card.appendChild(el("h3", null, "A landmark"));
  card.appendChild(paragraph(landmark.line));
  card.appendChild(paragraph("One check to pair with it: " + landmark.check, "snote"));
  const mechanicSeen = localStorage.getItem("omono_v4_mech_landmarks") === "1";
  if (!mechanicSeen) {
    card.appendChild(paragraph("Landmarks appear only at rare moments like this one, always with a check attached. Nothing is scored and nothing tracks gaps.", "snote"));
    try { localStorage.setItem("omono_v4_mech_landmarks", "1"); } catch { /* full */ }
  }
  const done = el("button", "tbtn", "Noted");
  done.type = "button";
  done.addEventListener("click", () => {
    seen.push(landmark.id);
    try { localStorage.setItem("omono_v4_landmarks", JSON.stringify(seen)); } catch { /* full */ }
    card.remove();
  });
  card.appendChild(done);
  const composeFoot = document.querySelector("#viewCompose .compose-foot");
  composeFoot.parentElement.insertBefore(card, composeFoot);
}

/* The badge counts prompts still waiting for an answer. Never asks at open:
   it only counts, quietly. */
async function refreshVerifyBadge() {
  const badge = $("verifyBadge");
  if (!badge || !bridge || !bridge.ledgerRecent) return;
  try {
    /* F15: the count and the label have to be about the same thing. The badge
       counted unanswered prompts within the most recent fifty entries and the
       heading printed the total for the whole ledger, so with fifty-nine
       prompts stored a bounded sample was presented as a total. The window is
       named where it is bounded. */
    const WINDOW = 50;
    const recent = await bridge.ledgerRecent(WINDOW);
    const entries = (recent && recent.entries) || [];
    const waiting = entries.filter(entry =>
      entry.type === "generation" && entry.transaction_id && !entry.outcome).length;
    const bounded = entries.length >= WINDOW;
    badge.textContent = String(waiting);
    badge.title = waiting
      ? (bounded
        ? waiting + " of your last " + WINDOW + " prompts have no outcome recorded yet."
        : waiting + " prompt" + (waiting === 1 ? " has" : "s have") + " no outcome recorded yet.")
      : "";
    badge.classList.toggle("hidden", waiting === 0);
    /* R-A: the ledger count heads the Menu dropdown; the Verification menu
       item carries its own count beside the pill badge. */
    const countEl = $("composeCount");
    if (countEl && recent && recent.index && window.OMonoDisplayNames) {
      const total = Number(recent.index.count) || 0;
      countEl.textContent = total ? window.OMonoDisplayNames.countNoun(total, "prompt") : "No prompts yet";
    }
    const menuCount = $("verifyMenuCount");
    if (menuCount) menuCount.textContent = waiting ? String(waiting) : "";
    const verifyItem = $("verifyLoopBtn");
    if (verifyItem && waiting) {
      verifyItem.title = bounded
        ? "Waiting on an outcome, within your last " + WINDOW + " prompts."
        : "Waiting on an outcome.";
    }
  } catch { badge.classList.add("hidden"); }
}

async function openVerifyLoop() {
  if (!bridge || !bridge.ledgerRecent) return;
  const prior = document.querySelector(".sheet.vloop");
  if (prior) prior.remove();
  let entries = [];
  try {
    const recent = await bridge.ledgerRecent(50);
    entries = ((recent && recent.entries) || []).filter(entry =>
      entry.type === "generation" && entry.transaction_id && !entry.outcome).slice(0, 5);
  } catch { entries = []; }
  const sheet = el("div", "sheet vloop");
  const panelHost = el("div", "panel");
  panelHost.appendChild(el("h3", null, "Did your last prompt work?"));
  if (!entries.length) {
    panelHost.appendChild(paragraph("Nothing is waiting for an answer.", "snote"));
  }
  entries.forEach(entry => {
    const row = el("div", "qcard");
    row.appendChild(el("div", "qt", trunc(entry.idea || "(untitled prompt)", 90)));
    const buttons = el("div", "outc");
    [["worked", "Worked"], ["partly", "Partly"], ["failed", "Failed"]].forEach(([value, label]) => {
      const button = el("button", "oc", label);
      button.type = "button";
      button.addEventListener("click", async () => {
        await recordPromptOutcome(entry.transaction_id, entry.id, value);
        announce("Outcome recorded.");
        if (value === "failed") {
          /* Failed offers the Fix This Result flow: reopen the prompt where a
             snapshot exists, then open the fix view. */
          sheet.remove();
          const reopened = await restoreHistoryPrompt(entry, null);
          if (reopened !== false && typeof openFixResult === "function"
              && generation && entryId === entry.id) {
            openFixResult();
          }
          return;
        }
        row.remove();
        if (!panelHost.querySelector(".qcard")) sheet.remove();
      });
      buttons.appendChild(button);
    });
    row.appendChild(buttons);
    panelHost.appendChild(row);
  });
  const foot = el("div", "srow");
  const older = el("button", "tbtn", "Older prompts are in History");
  older.type = "button";
  older.addEventListener("click", () => { sheet.remove(); openHistory(); });
  foot.appendChild(older);
  const close = el("button", "tbtn", "Close");
  close.type = "button";
  close.addEventListener("click", () => sheet.remove());
  foot.appendChild(close);
  panelHost.appendChild(foot);
  sheet.appendChild(panelHost);
  sheet.addEventListener("click", event => { if (event.target === sheet) sheet.remove(); });
  document.body.appendChild(sheet);
}
$("verifyLoopBtn").addEventListener("click", openVerifyLoop);

async function openHistory() {
  historyLimit = 25;
  histQuery = "";
  histOutcomeFilter = "";
  $("histSearch").value = "";
  $("histOutcome").value = "";
  clear($("verifyOut"));
  await renderHistory();
  show("viewHistory");
}
async function renderHistory() {
  if (!bridge || !bridge.ledgerRecent) return;
  const request = ++historyRequest;
  let result = null;
  try { result = await bridge.ledgerRecent(historyLimit); }
  catch { result = null; }
  if (request !== historyRequest) return;
  const all = (result && result.entries) || [];
  const index = (result && result.index) || {};
  const entries = all.filter(matchesHistoryFilters);
  lastHistoryRows = entries;
  /* Which of these still have an encrypted snapshot behind them. The bridge has
     always offered this; nothing called it, so every finished prompt was listed
     and unreachable. */
  let restorable = {};
  if (entries.length && bridge.recoveryAvailable) {
    try { restorable = await bridge.recoveryAvailable(entries.map(e => e.id).filter(Boolean)) || {}; }
    catch { restorable = {}; }
  }
  const body = clear($("histBody"));
  $("histCounter").textContent = index.count
    ? entries.length + " of " + (index.count || 0).toLocaleString() + " shown"
    : "empty";
  if (!entries.length) {
    body.appendChild(paragraph(
      histQuery || histOutcomeFilter ? "Nothing matches those filters."
        : "Nothing yet. Prompts land here as you make them.", "snote"));
    fitHeight();
    return;
  }
  entries.forEach(entry => {
    const row = el("div", "hrow");
    row.appendChild(el("div", "hidea", entry.idea || "(no text stored for this entry)"));
    row.appendChild(el("div", "hmeta",
      new Date(entry.ts).toLocaleString() + " · " + (entry.dest_system || "?") + " " +
      (entry.dest_model || "") + " · " + (entry.status || "generated")));
    /* F16: a prompt that carried a classification was never snapshotted
       (main.js normalizeRecoveryState refuses one), so it can never be
       reopened — and the row said only that it could not be opened, which
       reads as a fault. The refusal stands for now; the reason is on screen.
       Flagged for the owner's ruling in ENGINE_FIX_REPORT.md: the alternative
       is to store those snapshots encrypted and allow reopening. */
    const restore = D.historyRowRestore(
      restorable[entry.id] === true ? true : (restorable[entry.id] || false),
      entry.storage_mode !== "hash_only",
      !!(entry.policy_final && entry.policy_final.result
        && entry.policy_final.result !== "pass"));
    if (restore.canOpen) {
      const open = el("button", "btn btn-ghost", "Open prompt");
      open.type = "button";
      open.setAttribute("aria-label", "Reopen this prompt and everything that went into it");
      open.addEventListener("click", () => restoreHistoryPrompt(entry, open));
      row.appendChild(open);
    } else {
      row.appendChild(el("div", "hmeta", restore.note));
    }
    if (entry.transaction_id) {
      const outcomes = el("div", "outc");
      outcomes.appendChild(el("span", "hmeta", "How did it go?"));
      /* F15: the recorded verdict shows. It is stored (ledgerOutcome), folded
         back onto the entry (main.js readRecent) and returned on every read —
         and the row rendered all three buttons unpressed regardless, so an
         answered prompt went on asking forever. */
      const recorded = (entry.outcome && entry.outcome.verdict) || "";
      if (recorded) outcomes.querySelector(".hmeta").textContent = "How did it go?";
      [["worked", "Worked"], ["partly", "Partly"], ["failed", "Did not work"]].forEach(([value, label]) => {
        const button = el("button", "oc" + (value === recorded ? " on" : ""), label);
        button.type = "button";
        button.setAttribute("aria-pressed", value === recorded ? "true" : "false");
        button.addEventListener("click", async () => {
          Array.from(outcomes.querySelectorAll(".oc")).forEach(node => {
            node.setAttribute("aria-pressed", "false");
            node.classList.remove("on");
          });
          button.setAttribute("aria-pressed", "true");
          button.classList.add("on");
          try {
            await recordPromptOutcome(entry.transaction_id, entry.id, value);
            entry.outcome = { verdict: value };
            announce("Outcome recorded.");
          } catch { announce("That outcome could not be recorded."); }
        });
        outcomes.appendChild(button);
      });
      row.appendChild(outcomes);
    }
    body.appendChild(row);
  });
  if (historyLimit > 0 && all.length >= historyLimit) {
    const more = el("button", "btn btn-ghost", "Load older");
    more.type = "button";
    more.addEventListener("click", () => { historyLimit += 25; renderHistory(); });
    body.appendChild(more);
  }
  fitHeight();
}
/* Put a finished prompt back on screen exactly as it was. The snapshot carries
   the canonical interpretation and generation, so the result view is restored
   whole — components, reasoning, verification panel and return route — rather
   than rebuilt from the legacy eight fields, which carry none of that. */
async function restoreHistoryPrompt(entry, button) {
  if (!bridge || !bridge.recoveryRead || !entry || !entry.id) return false;
  const original = button ? button.textContent : "";
  if (button) { button.disabled = true; button.textContent = "Opening…"; }
  /* F15: "Opening…" was set and never cleared on the success path, and there
     was no deadline — so a reopen that stalled anywhere left a row saying
     Opening for the rest of the session with nothing else to read. */
  const settle = () => {
    if (!button) return;
    button.disabled = false;
    if (button.textContent === "Opening…") button.textContent = original;
  };
  const deadline = setTimeout(() => {
    if (!button || button.textContent !== "Opening…") return;
    button.disabled = false;
    button.textContent = "Still opening…";
    button.title = "This is taking longer than it should. Press again to retry.";
  }, 8000);
  try {
    await flushRecovery();
    const state = await bridge.recoveryRead(entry.id);
    const v3 = state && state.v3;
    if (v3 && v3.generation && v3.interpretation) {
      interpretation = v3.interpretation;
      generation = v3.generation;
      confirmed = v3.confirmed || null;
      transactionId = typeof v3.transaction_id === "string" ? v3.transaction_id : null;
      selectedLessons = v3.choreography && v3.choreography.closing
        ? v3.choreography : null;
      waitLessons = selectedLessons ? (selectedLessons.rotation || []).slice(0, 2) : [];
      pinnedLessonId = null;
      currentWaitLesson = null;
      emittedThisRun.clear();
      paintedFullRevisionKeys.clear();
      recordedActionsThisPrompt.clear();
      intermediaryDraft = null;
      generationError = null;
      sourceCheckResult = null;
      fixResult = null;
      if (v3.destination) destination = v3.destination;
      /* R2: the pair the prompt was written under, restored as a pair. The tool
         used to be handed to the assembler as a one-off argument, so the prompt
         box got the recorded tool while the chips and the field editor got
         whichever tool the person happened to have selected today. */
      promptTarget = { destination: v3.destination || destination,
        tool_id: typeof v3.tool_id === "string" ? v3.tool_id : "" };
      entryId = entry.id;
      runLessonSelection = null; /* F1: a reopened prompt selects its own card */
      /* F2: rebuild from the restored components and the restored destination,
         both of which the snapshot carries. This line used to assign the
         model's own final_prompt, which is a different artifact from the text
         the person copied — different headings, different content, nothing
         dropped by the fold — and that is what made a reopen read as a
         regeneration. */
      promptDraft = assembledPromptNow();
      promptTouched = false;
      includeReasoning = !!state.include_reasoning;
      if (typeof state.idea === "string") $("idea").value = state.idea;
      policyEvaluation = await evaluatePolicy({});
      buildTeachingPanel();
      renderResult();
      clearTimeout(deadline);
      settle();
      announce("Reopened.");
      return true;
    }
  } catch (error) { /* fall through to the message below */ }
  clearTimeout(deadline);
  if (button) {
    button.disabled = false;
    button.textContent = "Could not reopen";
    setTimeout(() => { button.textContent = original; }, 1800);
  }
  announce("That prompt could not be reopened.");
  return false;
}

function matchesHistoryFilters(entry) {
  if (histOutcomeFilter) {
    const verdict = entry.outcome && entry.outcome.verdict;
    if (histOutcomeFilter === "none" ? !!verdict : verdict !== histOutcomeFilter) return false;
  }
  if (histQuery) {
    const hay = [entry.idea, entry.dest_system, entry.dest_model, entry.task_type, entry.status]
      .filter(Boolean).join(" ").toLowerCase();
    if (hay.indexOf(histQuery) === -1) return false;
  }
  return true;
}
$("historyBtn").addEventListener("click", openHistory);
$("histBack").addEventListener("click", goBack);
$("histSearch").addEventListener("input", () => {
  histQuery = $("histSearch").value.trim().toLowerCase();
  renderHistory();
});
$("histOutcome").addEventListener("change", () => {
  histOutcomeFilter = $("histOutcome").value;
  renderHistory();
});
$("revealBtn").addEventListener("click", () => bridge && bridge.revealLedger && bridge.revealLedger());
$("exportBtn").addEventListener("click", async () => {
  if (!bridge || !bridge.saveText || !lastHistoryRows.length) return;
  const head = ["id", "timestamp", "destination_system", "destination_model", "status"];
  const cell = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const csv = [head.map(cell).join(",")].concat(lastHistoryRows.map(entry =>
    [entry.id, new Date(entry.ts).toISOString(), entry.dest_system, entry.dest_model, entry.status]
      .map(cell).join(","))).join("\n");
  await bridge.saveText("omono-history-" + new Date().toISOString().slice(0, 10) + ".csv", csv);
});
$("verifyChainBtn").addEventListener("click", async () => {
  const box = clear($("verifyOut"));
  if (!bridge || !bridge.verifyIntegrity) return;
  box.appendChild(el("div", "statline", "Recomputing the record…"));
  let result = null;
  try { result = await bridge.verifyIntegrity({}); } catch { result = null; }
  clear(box);
  if (!result) { box.appendChild(el("div", "statline bad", "The record could not be verified.")); return; }
  box.appendChild(el("div", "statline " + (result.ok ? "ok" : "bad"), result.ok
    ? "The stored record passed its integrity checks. Browser storage is not an authenticated security audit."
    : "The stored record did not pass its integrity checks."));
  fitHeight();
});

/* ---------- Learning ---------- */
async function openLearning() {
  const body = clear($("lrnBody"));
  /* Managed Enterprise owns a deployment-level lesson surface. It must not
     fall through to the personal learning map or inherit "your own work"
     claims. Enterprise Demo remains on the existing demonstration path. */
  if (appMode === "managed_enterprise") {
    $("lrnCounter").textContent = "Managed Enterprise";
    await renderWorkingSetPanel(body);
    show("viewLearn");
    return;
  }
  /* v4 (D7): the weekday streak, personal mode only. Active means a
     generation or a recorded verification, never a mere open; weekends
     neither count toward it nor break it. Enterprise modes carry no streak. */
  if (appMode === "personal" && window.OMonoPracticeV4 && bridge && bridge.practiceCounts) {
    try {
      const counts = await bridge.practiceCounts();
      const streak = window.OMonoPracticeV4.weekdayStreak(counts.active_timestamps || [], Date.now());
      if (streak > 0) {
        const line = el("div", "statline");
        line.textContent = streak + " active weekday" + (streak === 1 ? "" : "s") + " in a row.";
        body.appendChild(line);
        if (localStorage.getItem("omono_v4_mech_streak") !== "1") {
          body.appendChild(paragraph("Active means a prompt was generated or an outcome was answered that day. Weekends neither count nor break the run.", "snote"));
          try { localStorage.setItem("omono_v4_mech_streak", "1"); } catch { /* full */ }
        }
      }
    } catch { /* the view stands without it */ }
  }
  if (!bridge || !bridge.learningMap) {
    body.appendChild(paragraph("Your record is only readable inside the app.", "snote"));
    show("viewLearn");
    return;
  }
  let map = null;
  try { map = await bridge.learningMap({}); } catch { map = null; }
  if (!map) {
    body.appendChild(paragraph("Nothing in your record yet.", "snote"));
    show("viewLearn");
    return;
  }
  /* Curriculum corrections (C1): every name through the dictionary,
     correct pluralization, panels populated in sentences. */
  const Names = window.OMonoDisplayNames;
  $("lrnCounter").textContent = Names.countNoun(map.records || 0, "prompt");
  const intro = panelBox("What your own record shows");
  intro.appendChild(paragraph(
    "Counts from your own work. A count is not a cause, and nothing here is a score."));
  body.appendChild(intro);
  await renderWorkingSetPanel(body);
  (map.competencies || []).forEach(entry => {
    /* C1: a panel renders only when it has a sentence to say; an empty box
       is not a populated panel. */
    const line = [entry.level_words ? entry.level_words + "." : "", entry.why,
      entry.uncertainty].filter(Boolean).join(" ");
    if (!line) return;
    const box = panelBox(entry.label || Names.capitalize(Names.humanize(entry.competency_id)),
      { className: "quiet" });
    box.appendChild(paragraph(line, "snote"));
    body.appendChild(box);
  });

  /* C1: what the teaching has covered, per area, in sentences. */
  try {
    const canon = window.OMonoLessonCanonV5 ? window.OMonoLessonCanonV5.lessons : [];
    const coverage = bridge.lessonCoverage ? await bridge.lessonCoverage({ canon }) : null;
    if (coverage && coverage.ok && coverage.emissions > 0) {
      body.appendChild(el("div", "fieldlabel", "What the lessons have covered"));
      const byId = {};
      canon.concat(approvedLessonCache).forEach(lesson => { byId[lesson.lesson_id] = lesson; });
      const perDomain = {};
      Object.keys(coverage.exposures_by_lesson || {}).forEach(id => {
        const lesson = byId[id];
        if (!lesson) return;
        (perDomain[lesson.domain] = perDomain[lesson.domain] || []).push(lesson);
      });
      Object.keys(perDomain).sort().forEach(domain => {
        const met = perDomain[domain];
        const box = panelBox(Names.domainName(domain), { className: "quiet" });
        const row = coverage.matrix[domain] || {};
        const concepts = Names.listOut(met.slice(0, 3).map(l => Names.conceptName(l.concept)));
        box.appendChild(paragraph("You have met " + Names.countNoun(met.length, "lesson")
          + " here, on " + concepts + (met.length > 3 ? ", among others." : "."), "snote"));
        const gap = !(row.intermediate || 0) && !(row.advanced || 0)
          ? "The top gap: nothing past the foundational level yet."
          : (!(row.foundational || 0)
            ? "The top gap: the foundational ground here has not been covered."
            : "Teaching here has moved past the first level.");
        box.appendChild(paragraph(gap, "snote"));
        body.appendChild(box);
      });
    }
  } catch { /* the view stands without the coverage section */ }

  /* C5: the teaching modules the record supports, the personal view. */
  try {
    const supported = bridge.teachingModules ? await bridge.teachingModules() : null;
    if (supported && supported.ok && supported.modules.length) {
      body.appendChild(el("div", "fieldlabel", "What your record can teach"));
      supported.modules.forEach(module => {
        const box = panelBox(module.title, { className: "quiet" });
        box.appendChild(el("div", "fieldlabel", "What O'Mono teaches"));
        box.appendChild(paragraph(module.understand, "snote"));
        box.appendChild(el("div", "fieldlabel", "What to do"));
        box.appendChild(paragraph(module.act, "snote"));
        box.appendChild(el("div", "fieldlabel", "What the record shows"));
        box.appendChild(paragraph(module.evidence, "snote"));
        body.appendChild(box);
      });
    }
  } catch { /* the view stands without modules */ }

  if (Array.isArray(map.limits)) {
    const limits = panelBox("What this cannot tell you", { className: "quiet" });
    map.limits.forEach(line => limits.appendChild(paragraph(line, "snote")));
    body.appendChild(limits);
  }
  show("viewLearn");
}
/* R2/R6: what this installation actually holds, and how much of it the record
   produced. The founding set is a seed; this panel is where a person sees that
   it stopped being the whole of it, and where they retire anything they do not
   want. One line, counts only, never a score. */
let lastRefreshRun = null;

function deploymentCountWord(count) {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const n = Math.max(0, Number(count) || 0);
  return words[n] || n.toLocaleString("en-US");
}

function deploymentEvidenceLine(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim()
    .replace(/\bPeople\b/g, "Users").replace(/\bpeople\b/g, "users");
  if (!text) return "";
  return /^Written because\b/i.test(text) ? text : "Written because " + text;
}

function deploymentPeriodLabel(summary) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const start = new Date(String(summary.period_start || "") + "T12:00:00");
  const end = new Date(String(summary.period_end || "") + "T12:00:00");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "This period";
  if (start.getFullYear() === end.getFullYear()) {
    return months[start.getMonth()] + " to " + months[end.getMonth()] + " " + end.getFullYear();
  }
  return months[start.getMonth()] + " " + start.getFullYear() + " to "
    + months[end.getMonth()] + " " + end.getFullYear();
}

function deploymentSummaryCell(number, label, detail) {
  const cell = el("div", "deployment-summary-cell");
  cell.appendChild(el("span", "deployment-summary-number", Number(number || 0).toLocaleString("en-US")));
  cell.appendChild(el("span", "deployment-summary-label", label));
  if (detail) cell.appendChild(el("span", "deployment-summary-detail", detail));
  return cell;
}

async function renderManagedDeploymentLessons(body, held) {
  const Names = window.OMonoDisplayNames;
  if (bridge && bridge.publishEnterpriseLessonCatalog) {
    try {
      const published = await bridge.publishEnterpriseLessonCatalog({});
      if (published && published.ok === true && bridge.lessonsWorkingSet) {
        const current = await bridge.lessonsWorkingSet();
        if (current && current.ok === true) held = current;
      }
    } catch { /* a non-admin view does not publish or claim that it did */ }
  }
  const published = new Set(held.managed_catalog &&
    Array.isArray(held.managed_catalog.lesson_revision_ids)
      ? held.managed_catalog.lesson_revision_ids : []);
  const newLessons = (Array.isArray(held.record_lessons_today)
    ? held.record_lessons_today : []).filter(lesson =>
      published.has(lesson.lesson_id + "@" + lesson.version));
  const lessons = newLessons.slice(0, 4);
  const summary = held.enterprise_summary || {
    period_start: "", period_end: "", created: newLessons.length,
    new_today: newLessons.length, available: held.size || 0,
    retired_enterprise_exhaustion: 0, retired_firm: held.retired || 0,
    rejected_today: held.admission && held.admission.automatically_rejected_today || 0,
    rejected_period: held.admission && held.admission.automatically_rejected_total || 0
  };
  let reviewOn = false;
  if (bridge && bridge.policyManagedStatus) {
    try {
      const status = await bridge.policyManagedStatus();
      reviewOn = !!(status && status.lesson_review_mode === true);
    } catch { reviewOn = false; }
  }

  const surface = el("section", "deployment-lessons");
  surface.id = "managedDeploymentLessons";
  surface.setAttribute("aria-label", "Lessons written from this deployment's record");

  const head = el("div", "deployment-lessons-head");
  head.appendChild(el("div", "deployment-lessons-kicker glass-text",
    "New today, written from enterprise's combined record"));
  const count = Number(summary.new_today) || 0;
  const noun = count === 1 ? "lesson" : "lessons";
  const verb = count === 1 ? "was" : "were";
  const liveVerb = count === 1 ? "is" : "are";
  const opening = reviewOn
    ? deploymentCountWord(count) + " approved " + noun + " " + liveVerb + " live for everyone."
    : deploymentCountWord(count) + " " + noun + " " + verb
      + " added automatically and " + liveVerb + " live for everyone.";
  head.appendChild(paragraph(opening + " Retire any you do not want. Review before publishing is "
    + (reviewOn ? "on." : "off.") + (newLessons.length > lessons.length ? " Showing four." : ""),
    "deployment-lessons-summary glass-text"));
  surface.appendChild(head);

  const period = deploymentPeriodLabel(summary);
  const retiredTotal = Number(summary.retired_enterprise_exhaustion || 0)
    + Number(summary.retired_firm || 0);
  const metrics = el("div", "deployment-summary-grid");
  metrics.appendChild(deploymentSummaryCell(summary.new_today, "New today"));
  metrics.appendChild(deploymentSummaryCell(summary.created, "Created", period));
  metrics.appendChild(deploymentSummaryCell(summary.available, "Available"));
  metrics.appendChild(deploymentSummaryCell(retiredTotal, "Retired",
    Number(summary.retired_enterprise_exhaustion || 0).toLocaleString("en-US")
      + " reached enterprise exhaustion; "
      + Number(summary.retired_firm || 0).toLocaleString("en-US") + " by the firm"));
  metrics.appendChild(deploymentSummaryCell(summary.rejected_period, "Rejected", period + "; "
    + Number(summary.rejected_today || 0).toLocaleString("en-US") + " today"));
  surface.appendChild(metrics);

  const list = el("div", "deployment-lessons-list");
  lessons.forEach(lesson => {
    const card = panelBox(null, { className: "strong deployment-lesson-card" });
    const copy = el("div", "deployment-lesson-copy");
    const straight = (lesson.tones && lesson.tones.straight) || {};
    copy.appendChild(el("div", "deployment-lesson-hook", straight.hook || lesson.lesson_id));
    copy.appendChild(el("div", "deployment-lesson-domain", Names.domainName(lesson.domain)));
    const evidence = deploymentEvidenceLine(lesson.evidence_line);
    if (evidence) copy.appendChild(el("div", "deployment-lesson-evidence", evidence));
    card.appendChild(copy);

    const actions = el("div", "deployment-lesson-actions");
    actions.appendChild(el("span", "deployment-live", "Live"));
    const retire = el("button", "tbtn deployment-retire", "Retire");
    retire.type = "button";
    retire.setAttribute("aria-label", "Retire " + (straight.hook || lesson.lesson_id));
    retire.addEventListener("click", async () => {
      if (!bridge || !bridge.retireEnterpriseLesson) return;
      let result = null;
      try {
        result = await bridge.retireEnterpriseLesson({ lesson_id: lesson.lesson_id });
      } catch { result = null; }
      if (!result || result.ok !== true) {
        const problem = result && Array.isArray(result.problems) && result.problems[0];
        announce(problem || "That lesson could not be retired for everyone.");
        return;
      }
      refreshLessonCaches();
      announce("Retired.");
      openLearning();
    });
    actions.appendChild(retire);
    card.appendChild(actions);
    list.appendChild(card);
  });
  surface.appendChild(list);

  const rejected = Math.max(0, Number(summary.rejected_today) || 0);
  const candidate = rejected === 1 ? "candidate" : "candidates";
  const failure = rejected === 1 ? "it failed" : "they failed";
  surface.appendChild(paragraph(
    "O'Mono automatically rejected " + rejected.toLocaleString("en-US") + " " + candidate
      + " today because " + failure + " lesson format or wording checks. "
      + Number(summary.rejected_period || 0).toLocaleString("en-US") + " were rejected "
      + deploymentPeriodLabel(summary) + ". Administrators retire live lessons separately.",
    "deployment-lessons-foot glass-text"));
  body.appendChild(surface);
}

async function renderWorkingSetPanel(body) {
  if (!bridge || !bridge.lessonsWorkingSet) return;
  let held = null;
  try { held = await bridge.lessonsWorkingSet(); } catch { held = null; }
  if (!held || !held.ok) return;
  if (appMode === "managed_enterprise") {
    await renderManagedDeploymentLessons(body, held);
    return;
  }
  const Names = window.OMonoDisplayNames;
  const Growth = window.OMonoLessonGrowthV5;
  const personal = appMode === "personal";
  const panel = panelBox(personal ? null : "What you hold");
  if (personal) {
    panel.appendChild(el("div", "deployment-lessons-kicker",
      "New today, written from your own record"));
    const todayCount = Array.isArray(held.record_lessons_today)
      ? held.record_lessons_today.length : 0;
    panel.appendChild(paragraph(
      Names.countNoun(todayCount, "lesson") + " added today.", "snote"));
  }
  const scope = appMode === "personal" ? "your own record" : "this deployment's record";
  panel.appendChild(paragraph(
    Names.countNoun(held.size, "lesson") + " in all: "
    + held.from_seed + " from the founding set, and "
    + Names.countNoun(held.from_record, "lesson") + " that " + scope + " produced."
    + (held.retired ? " " + Names.countNoun(held.retired, "lesson") + " retired." : "")));
  /* R6: what arrived today, in one line naming where it came from. */
  if (lastRefreshRun && Growth) {
    const line = Growth.arrivalLine(lastRefreshRun.lessons || [], lastRefreshRun.brief || {}, Names);
    if (line) panel.appendChild(paragraph(line, "snote"));
  }
  /* R6/R8: retire anything, seed or grown. Behind a disclosure, because this is
     a list to reach for and not a list to read. */
  const open = document.createElement("details");
  open.className = "disclosure";
  open.appendChild(el("summary", null, "Retire a lesson"));
  (held.lessons || []).slice().sort((a, b) =>
    String(a.domain) < String(b.domain) ? -1 : 1).forEach(lesson => {
    const row = el("div", "srow");
    const straight = (lesson.tones && lesson.tones.straight) || {};
    row.appendChild(el("span", "snote", straight.hook || lesson.lesson_id));
    const drop = el("button", "tbtn", "Retire");
    drop.type = "button";
    drop.setAttribute("aria-label", "Retire this lesson so it is never shown again");
    drop.addEventListener("click", async () => {
      if (!bridge.lessonRetire) return;
      try { await bridge.lessonRetire({ lesson_id: lesson.lesson_id, by: appMode === "personal" ? "user" : "administrator" }); }
      catch { announce("That lesson could not be retired."); return; }
      refreshLessonCaches();
      announce("Retired.");
      openLearning();
    });
    row.appendChild(drop);
    open.appendChild(row);
  });
  panel.appendChild(open);
  body.appendChild(panel);
}
$("learnBtn").addEventListener("click", openLearning);
$("lrnBack").addEventListener("click", goBack);
$("lrnExport").addEventListener("click", async () => {
  if (!bridge || !bridge.exportCurriculum) return;
  const result = await bridge.exportCurriculum({ scope: "personal" });
  announce(result && result.ok ? "Curriculum exported." : "Nothing was exported.");
});

/* ---------- Redact and Restore ----------
   The local privacy pair. Both run in the main process; the map of real values
   never enters this window. */
let redactPlan = null;
let redactSource = "";
let redactRef = null;
function openRedact() {
  if (!REDACT_UI_ENABLED) return;
  if (!localFindings || !localFindings.spans || !localFindings.spans.length) return;
  redactSource = $("idea").value;
  redactPlan = E.buildRedactionPlan(localFindings.spans.filter(s => s.class !== "matter_reference"));
  $("redWhy").value = "";
  renderRedact();
  show("viewRedact");
}
function renderRedact() {
  const list = clear($("redList"));
  const ACTIONS = [["token", "Placeholder"], ["delete", "Delete"], ["generalize", "Generalize"],
    ["custom", "My own text"], ["false_positive", "Not that"]];
  redactPlan.forEach(item => {
    const row = el("div", "hrow");
    row.appendChild(el("div", "hidea", "“" + item.text + "”"));
    row.appendChild(el("div", "hmeta", E.plainLabel(item.class) + " · " + item.tier +
      (item.action === "token" ? " · becomes " + item.token : "")));
    const actions = el("div", "outc");
    ACTIONS.forEach(([value, label]) => {
      const button = el("button", "oc", label);
      button.type = "button";
      button.setAttribute("aria-pressed", item.action === value ? "true" : "false");
      button.addEventListener("click", () => { item.action = value; renderRedact(); });
      actions.appendChild(button);
    });
    row.appendChild(actions);
    if (item.action === "generalize" || item.action === "custom") {
      const input = document.createElement("input");
      input.type = "text";
      input.setAttribute("aria-label", "Replacement text");
      input.value = item.replacement || "";
      input.addEventListener("input", () => { item.replacement = input.value; updateRedactPreview(); });
      row.appendChild(input);
    }
    list.appendChild(row);
  });
  updateRedactPreview();
  fitHeight();
}
function updateRedactPreview() {
  const applied = E.applyRedactions(redactSource, redactPlan);
  $("redPreview").textContent = applied.text || "(everything would be removed)";
  $("redCounter").textContent = applied.changed + " of " + redactPlan.length + " changed";
  const recheck = E.localScreen(applied.text, { matters: [] });
  const stat = $("redStat");
  const remaining = recheck.classes.filter(c => recheck.tierFor[c] === "hard");
  stat.className = "statline " + (remaining.length ? "bad" : "ok");
  stat.textContent = remaining.length
    ? "Re-checked after redaction: still carries " + remaining.map(E.plainLabel).join(", ") + ". Keep going."
    : "Re-checked after redaction: clear to send.";
  return applied;
}
$("redBack").addEventListener("click", goBack);
$("redApply").addEventListener("click", async () => {
  const why = $("redWhy").value.trim();
  if (why.length < 8) {
    $("redWhy").focus();
    $("redStat").className = "statline bad";
    $("redStat").textContent = "Say why in a line. It is recorded; the replaced values are not.";
    return;
  }
  const applied = updateRedactPreview();
  redactRef = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  if (bridge && bridge.redactionSave && applied.map.length) {
    await bridge.redactionSave(redactRef, applied.map, { classes: redactPlan.map(i => i.class) });
  }
  $("idea").value = applied.text;
  attachments = [];
  renderAttachments();
  localFindings = null;
  goCompose();
  interpret();
});
$("redactBtn").addEventListener("click", openRedact);

async function openRestore() {
  const select = clear($("restRef"));
  let maps = [];
  if (bridge && bridge.redactionList) { try { maps = await bridge.redactionList(); } catch { maps = []; } }
  if (!maps.length) {
    const option = el("option", null, "No redactions yet");
    option.value = "";
    select.appendChild(option);
  }
  maps.forEach(map => {
    const option = el("option", null, new Date(map.created_at).toLocaleString() + " · " + map.count + " values");
    option.value = map.ref;
    select.appendChild(option);
  });
  if (redactRef && maps.some(m => m.ref === redactRef)) select.value = redactRef;
  $("restIn").value = "";
  $("restOut").textContent = "";
  $("restStat").textContent = "";
  show("viewRestore");
}
$("restoreBtn").addEventListener("click", openRestore);
$("restBack").addEventListener("click", goBack);
$("restRun").addEventListener("click", async () => {
  if (!$("restIn").value.trim()) {
    const stat = $("restStat");
    stat.className = "statline";
    stat.textContent = "Paste the finished text first.";
    return;
  }
  const ref = $("restRef").value;
  const text = $("restIn").value;
  if (!ref || !text.trim() || !bridge || !bridge.restoreText) return;
  const result = await bridge.restoreText(ref, text);
  $("restOut").textContent = result.text;
  const stat = $("restStat");
  stat.className = "statline " + (result.complete ? "ok" : "bad");
  stat.textContent = result.complete
    ? result.restored + " of " + result.expected + " values restored by exact match. Nothing left over."
    : result.restored + " of " + result.expected + " restored." +
      (result.residuals.length ? "  Still unresolved: " + result.residuals.join(", ") + "." : "") +
      "  Check before you send this anywhere.";
  fitHeight();
});
$("restCopy").addEventListener("click", async () => {
  const text = $("restOut").textContent;
  if (text.trim() && bridge) await bridge.copy(text);
});

/* ---------- Verify (Gate 18) ---------- */
function syncVerifyPill() {
  const button = $("verifyOpenBtn");
  const task = interpretation ? interpretation.task : null;
  const applies = !!(task && (task.use_context === "filing" || task.use_context === "regulatory" ||
    task.source_dependency === "citable"));
  button.classList.toggle("hidden", !applies);
}
$("verifyOpenBtn").addEventListener("click", async () => {
  if (!generation) return;
  if (!checklist) {
    checklist = E.buildVerificationChecklist({
      ref: entryId || ("draft-" + Date.now()),
      text: promptText(),
      destination: { system: destination.system_id, model: destination.model_id, label: destination.label }
    });
    if (bridge && bridge.verifySave) {
      try { await bridge.verifySave(checklist, "generated"); await bridge.verifySave(checklist, "started"); }
      catch { /* the checklist still works offline */ }
    }
    if (!Number.isFinite(checklist.started_ts)) checklist.started_ts = Date.now();
  }
  /* C4: its own window, so the checklist can sit beside the document it is
     checking instead of replacing the prompt that produced it. The in-window
     view stays as the fallback for any build without the channel. */
  if (bridge && bridge.verifyWindowOpen) {
    const opened = await bridge.verifyWindowOpen(checklist.id);
    if (opened) return;
  }
  $("verVerifier").value = checklist.verifier || "";
  $("verMatter").value = checklist.matter || "";
  renderVerify();
  show("viewVerify");
  if (verifyTick) clearInterval(verifyTick);
  verifyTick = setInterval(renderVerifyClock, 15000);
});
function stepRow(step, onChange) {
  const wrap = el("label", "togglerow");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !!step.done;
  box.addEventListener("change", () => { step.done = box.checked; onChange(); });
  wrap.appendChild(box);
  wrap.appendChild(el("span", null, step.ask));
  return wrap;
}
function renderVerify() {
  if (!checklist) return;
  $("verWhy").textContent = (checklist.why && checklist.why.length)
    ? checklist.why.join(" ")
    : "This work is heading somewhere a person signs for it.";
  const list = clear($("verList"));
  if (!checklist.items.length) {
    list.appendChild(paragraph(
      "No citation-shaped text was found in the prompt. That does not mean the finished document " +
      "has none. Save the file and add what the model returns.", "snote"));
  }
  checklist.items.forEach(item => {
    const card = panelBox(null, { className: "quiet" });
    card.appendChild(el("div", "fieldlabel", item.n + ". " + item.text + "  (" + item.label + ")"));
    item.steps.forEach(step => card.appendChild(stepRow(step, onVerifyChange)));
    list.appendChild(card);
  });
  const doc = clear($("verDoc"));
  checklist.document.forEach(step => doc.appendChild(stepRow(step, onVerifyChange)));
  renderVerifyClock();
  renderVerifyStat();
  fitHeight();
}
function renderVerifyClock() {
  if (!checklist) return;
  const node = $("verClock");
  if (Number.isFinite(checklist.closed_ts)) {
    node.textContent = "Closed. Time spent: " +
      (Number.isFinite(checklist.minutes) ? checklist.minutes + " minutes." : "not recorded.");
    return;
  }
  const minutes = E.elapsedMinutes(checklist.started_ts, Date.now());
  node.textContent = minutes === null
    ? "Timing this check."
    : "Open for " + minutes + " minutes. The time is recorded so the cost of checking is visible.";
}
function renderVerifyStat() {
  const summary = E.verificationSummary(checklist);
  $("verCounter").textContent = summary.authorities_cleared + "/" + summary.authorities + " cleared";
  $("verStat").textContent = summary.complete
    ? "Nothing outstanding. Close the checklist to record it."
    : summary.outstanding + " check" + (summary.outstanding === 1 ? "" : "s") +
      " outstanding. Do not file while anything is unchecked.";
  $("verClose").disabled = !summary.complete || Number.isFinite(checklist.closed_ts);
}
let verifySaveTimer = null;
function onVerifyChange() {
  renderVerifyStat();
  if (verifySaveTimer) clearTimeout(verifySaveTimer);
  verifySaveTimer = setTimeout(saveVerifyQuiet, 400);
}
async function saveVerifyQuiet() {
  if (!checklist || !bridge || !bridge.verifySave) return;
  checklist.verifier = $("verVerifier").value.trim();
  checklist.matter = $("verMatter").value.trim();
  try { await bridge.verifySave(checklist, "saved"); } catch { /* offline is not a failure */ }
}
$("verVerifier").addEventListener("input", onVerifyChange);
$("verMatter").addEventListener("input", onVerifyChange);
$("verClose").addEventListener("click", async () => {
  if (!checklist) return;
  await saveVerifyQuiet();
  if (bridge && bridge.verifySave) {
    try {
      const record = await bridge.verifySave(checklist, "closed");
      if (record) { checklist.closed_ts = record.closed_ts; checklist.minutes = record.minutes; }
    } catch { checklist = E.closeVerification(checklist, Date.now()); }
  } else {
    checklist = E.closeVerification(checklist, Date.now());
  }
  renderVerify();
});
$("verExport").addEventListener("click", async () => {
  await saveVerifyQuiet();
  if (checklist && bridge && bridge.verifyExport) {
    const result = await bridge.verifyExport(checklist.id);
    $("verStat").textContent = result && result.saved ? "Saved to " + result.path : "Not saved.";
  }
});
$("verBack").addEventListener("click", async () => {
  await saveVerifyQuiet();
  if (verifyTick) { clearInterval(verifyTick); verifyTick = null; }
  if (verifyWindowId) { window.close(); return; }
  goBack();
});

/* ---------- Register and Watch ---------- */
$("openRegister").addEventListener("click", () => {
  const rows = E.registerRows(SNAPSHOT, Date.now());
  const summary = E.registerSummary(SNAPSHOT, Date.now());
  $("regCounter").textContent = summary.usable + "/" + summary.rows + " usable";
  $("regHead").textContent = "Snapshot of " + (summary.as_of || "unknown date") + ", " +
    (summary.age_days === null ? "no usable date" : summary.age_days + " days old") + ". " +
    (summary.stale
      ? "Past the " + summary.stale_after_days + "-day rule the file states about itself."
      : "Inside its own " + summary.stale_after_days + "-day rule.");
  const list = clear($("regList"));
  rows.forEach(row => {
    const card = panelBox(null, { className: "quiet" });
    card.appendChild(el("div", "fieldlabel",
      (row.self ? "O'Mono itself: " : "") + row.label + "  " + row.status));
    [
      "Allowed: " + ((row.permitted || []).map(c => E.plainLabel(c)).join(", ") || "none"),
      "Never: " + ((row.barred || []).map(c => E.plainLabel(c)).join(", ") || "none"),
      row.intake_date
        ? "Checked on " + row.intake_date + (row.intake_current ? "." : ". That is past the limit, so this row cannot be relied on.")
        : "Never checked.",
      row.note || null
    ].filter(Boolean).forEach(line => card.appendChild(paragraph(line, "snote")));
    list.appendChild(card);
  });
  show("viewRegister");
});
$("regBack").addEventListener("click", goBack);

/* Settings navigation. §14.9 asks for readable sections covering appearance,
   models and routing, data and privacy, security, source and filing
   verification, storage and history, learning, enterprise administration and
   advanced details. These open the views that already implement them rather
   than duplicating any of it here. */
/* Both selects are populated from the frozen vocabulary, so the screen and the
   policy service cannot disagree about what a value means. */
(function fillPolicySelects() {
  const V = P && P.vocabulary;
  if (!V) return;
  const postures = V.POSTURES || [];
  const plain = V.POSTURE_PLAIN || {};
  const host = $("postureSelect");
  host.textContent = "";
  for (const id of postures) {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = plain[id] || id;
    host.appendChild(o);
  }
  const modes = V.MODES || [];
  const modeHost = $("modeSelect");
  if (modes.length && modeHost) {
    const labels = { personal: "Personal", managed_enterprise: "Managed Enterprise",
      enterprise_demo: "Enterprise Demo" };
    modeHost.textContent = "";
    for (const id of modes) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = labels[id] || id;
      modeHost.appendChild(o);
    }
  }
})();

/* ---------- the register, as something you can set ----------

   The shipped snapshot is an export of an adopted register, dated. In Personal
   and Enterprise Demo the owner IS the governance authority for their own
   machine, and had no way to record an assessment: the ceilings were fixed at
   build time and could only be changed by editing a file inside the app bundle.

   Raising one is a protected change, because §2.2 item 5 names altering
   destination approvals as one. Owner password, typed reason, security audit.
   In Managed Enterprise the signed profile decides and this is read only. */
async function renderRegisterEditor() {
  if (!bridge || !bridge.policyRegisterView) return;
  const host = clear($("regEditList"));
  let view = null;
  try { view = await bridge.policyRegisterView(); } catch { view = null; }
  if (!view) { $("regEditNote").textContent = "The register could not be read."; return; }

  $("regEditNote").textContent = view.editable
    ? "What each destination may be sent. Raising a ceiling is your assessment, and it is recorded in the security audit like any other protected change. Snapshot as of " + (view.as_of || "unknown") + "."
    : "Your organization's signed profile decides these. Snapshot as of " + (view.as_of || "unknown") + ".";

  const classes = (P && P.vocabulary && P.vocabulary.CLASSES) || [];
  for (const row of view.rows) {
    const line = el("div", "srow");
    /* C1: the destination's name, never its machine id. */
    const name = el("label", null, row.label
      || window.OMonoDisplayNames.capitalize(window.OMonoDisplayNames.humanize(row.system_id)));
    name.setAttribute("for", "reg-" + row.system_id);
    line.appendChild(name);

    const select = document.createElement("select");
    select.id = "reg-" + row.system_id;
    select.disabled = !view.editable;
    for (const id of classes) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = id + "  " + ((P.vocabulary.classPlain && P.vocabulary.classPlain(id)) || "");
      if (id === row.max_class) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", async () => {
      const answer = await askOwner("Alter a destination approval",
        "You are recording that " + row.system_id + " may receive material up to " +
        select.value + ". This is your assessment and it is written to the security audit.");
      if (!answer) { renderRegisterEditor(); return; }
      let result = null;
      try {
        result = await bridge.policyRegisterSetCeiling({
          system_id: row.system_id, max_class: select.value,
          password: answer.password, reason: answer.reason
        });
      } catch { result = null; }
      $("regEditResult").textContent = result && result.applied
        ? row.system_id + " may now receive up to " + select.value + ". Recorded in the security audit."
        : "Not changed: " + String((result && result.reason) || "refused").replace(/_/g, " ");
      renderRegisterEditor();
    });
    line.appendChild(select);

    const note = el("span", "snote", row.source === "owner"
      ? "your assessment" : (row.status || "as shipped"));
    line.appendChild(note);
    host.appendChild(line);
  }
}

$("setOpenWatch").addEventListener("click", () => $("openWatch").click());
/* Delegates to the real opener, as the rows above and below do. A raw
   show("viewVerify") skipped the checklist construction and the tick that
   verifyOpenBtn performs, and renderVerify() guards on `if (!checklist) return` —
   so from Settings the view came up blank, or showed the previous prompt's
   checklist. */
$("setOpenVerify").addEventListener("click", () => $("verifyOpenBtn").click());
$("setOpenHistory").addEventListener("click", () => $("historyBtn").click());
$("setOpenLearn").addEventListener("click", () => openLearning());
$("setRevealRecord").addEventListener("click", () => {
  if (bridge && bridge.revealLedger) bridge.revealLedger();
});

/* The version 2 key is still on disk in the clear after migration, by design:
   migration never touches it so a rollback keeps working. Removing it is a
   separate, owner-authenticated action, and it is only offered once the
   encrypted replacement is present and readable. */
async function refreshLegacyKeyState() {
  if (!bridge || !bridge.legacyCredentialState) return;
  let state = null;
  try { state = await bridge.legacyCredentialState(); } catch { state = null; }
  if (!state) return;
  $("legacyScrubRow").classList.toggle("hidden", !state.scrub_available);
  $("legacyKeyNote").textContent = state.legacy_plaintext_present
    ? (state.v3_configured
        ? "A version 2 copy of the key is still on this Mac, stored in the clear. The encrypted copy is in use."
        : "A version 2 copy of the key is on this Mac, stored in the clear.")
    : "";
}

$("scrubLegacyBtn").addEventListener("click", async () => {
  const answer = await askOwner("Remove the legacy plaintext key",
    "Version 2 stored the key unencrypted. Removing that copy means a rollback to version 2 would ask for the key again. The encrypted copy stays.");
  if (!answer) return;
  let result = null;
  try {
    result = await bridge.scrubLegacyCredential({
      acknowledged: true, password: answer.password, reason: answer.reason
    });
  } catch { result = null; }
  $("legacyKeyNote").textContent = result && (result.scrubbed || result.staged)
    ? (result.staged
        ? "Quit and reopen O'Mono to finish removing it."
        : "Removed, and recorded in the security audit.")
    : "Not removed: " + String((result && result.reason) || "refused").replace(/_/g, " ");
  await refreshLegacyKeyState();
});

async function openWatch() {
  if (bridge && bridge.watchAll) { try { watchState = await bridge.watchAll(); } catch { watchState = null; } }
  const list = clear($("wchList"));
  if (!watchState) {
    $("wchHead").textContent = "The watch is only readable inside the app.";
    show("viewWatch");
    return;
  }
  $("wchCounter").textContent = watchState.overdue + " of " + watchState.total + " overdue";
  $("wchHead").textContent = watchState.effect;
  watchState.rows.forEach(row => {
    const card = panelBox(null, { className: "quiet" });
    card.appendChild(el("div", "fieldlabel", row.what + "  (every " + row.days + " days)"));
    card.appendChild(paragraph(row.source, "snote"));
    card.appendChild(paragraph(row.line + (row.last_result ? "  Last result: " + row.last_result + "." : ""), "snote"));
    if (row.kind === "diff") {
      const check = el("button", "tbtn", "Open the page");
      check.type = "button";
      check.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        if (bridge && bridge.openExternal) bridge.openExternal(row.source);
        announce("Opening " + row.what + ". Read it there; nothing is recorded here.");
      });
      /* It used to await the fetch and re-render, with no feedback and no catch.
         A slow page looked like a dead button, and a failed one looked exactly
         the same, because the rejection went nowhere. A network fetch is the one
         thing in this window that can take seconds, so it says what it is doing
         and what happened. */
      check.addEventListener("click", async () => {
        if (check.disabled) return;
        check.disabled = true;
        const label = check.textContent;
        check.textContent = "Checking…";
        announce("Checking " + row.what + ".");
        let result = null;
        try { result = await bridge.watchCheck(row.id); }
        catch (error) { result = null; }
        if (!result || !result.summary) {
          check.disabled = false;
          check.textContent = label;
          const failed = paragraph("This version cannot fetch pages for you. Open it yourself and read it. Nothing was recorded.", "snote");
          card.appendChild(failed);
          announce("That page could not be fetched.");
          return;
        }
        watchState = result.summary;
        const outcome = result.result && result.result.checked === false
          ? "This version cannot fetch pages. Open it yourself and read it."
          : "Checked. " + row.what + " came back " +
            String((result.result && result.result.result) || "unchanged") + ".";
        openWatch();
        $("wchHead").textContent = outcome;
        announce(outcome);
      });
      card.appendChild(check);
    }
    list.appendChild(card);
  });
  show("viewWatch");
}
$("openWatch").addEventListener("click", openWatch);
$("wchBack").addEventListener("click", goBack);
$("wchCheckAll").addEventListener("click", async () => {
  if (!watchState) return;
  const button = $("wchCheckAll");
  if (button.disabled) return;
  button.disabled = true;
  const rows = watchState.rows.filter(r => r.kind === "diff");
  let done = 0;
  let failed = 0;
  for (const row of rows) {
    $("wchHead").textContent = "Checking " + (done + 1) + " of " + rows.length + "…";
    let result = null;
    try { result = await bridge.watchCheck(row.id); }
    catch (error) { result = null; }
    if (result && result.summary) { watchState = result.summary; } else { failed += 1; }
    done += 1;
  }
  button.disabled = false;
  openWatch();
  $("wchHead").textContent = failed
    ? "This version cannot fetch pages for you. Open them yourself; the list above says which are due."
    : "Checked " + rows.length + (rows.length === 1 ? " page." : " pages.");
});

/* ---------- recovery ----------
   The encrypted local cache that survives a crash. It is a convenience, never
   ledger evidence, and it refuses anything classified or secret-shaped. */
/* S2: what a snapshot is, after the size work.

   It used to carry two copies of the same prompt: the v3 block (the canonical
   interpretation and generation) and an eight-field mirror rendered from the
   same components, plus a legacy interpretation shape and a legacy confirmed
   block. Measured over twenty real generations the mirror and its companions
   were about a fifth of every snapshot — and nothing read them. The only reader
   of a snapshot is restoreHistoryPrompt, and it takes v3, idea and
   include_reasoning.

   So the snapshot is now the components and the destination, which is what the
   prompt re-assembles from, and one copy of everything rather than two. Fewer
   bytes is the smaller half of the reason; one copy of a person's prompt on
   disk instead of two is the larger one. */
function recoveryState(revision) {
  return {
    version: 1,
    revision,
    engine_version: E.ENGINE_VERSION,
    idea: $("idea").value,
    destination: destination ? {
      system: destination.system_id, model: destination.model_id,
      systemLabel: destination.label, modelLabel: destination.model_id
    } : null,
    recommended: null,
    include_reasoning: includeReasoning,
    /* Everything the result view needs to come back whole: the canonical
       interpretation and generation, the destination as it was, and the tool
       whose surface decided the assembly. */
    v3: {
      transaction_id: transactionId || null,
      interpretation: interpretation || null,
      generation: generation || null,
      destination: destination ? {
        system_id: destination.system_id, model_id: destination.model_id,
        label: destination.label, profile: destination.profile
      } : null,
      /* F2: the tool decides the assembly surface, so a reopen has to know
         which tool the prompt was written for. */
      tool_id: typeof selectedToolId === "function" ? selectedToolId() : "",
      confirmed: confirmed || null,
      choreography: selectedLessons ? {
        rotation: (selectedLessons.rotation || []).slice(0, 2),
        closing: selectedLessons.closing || null
      } : null
    }
  };
}
function scheduleRecovery() {
  if (!recoveryEnabled || !entryId || !bridge || !bridge.recoverySave) return;
  if (recoverySaveTimer) clearTimeout(recoverySaveTimer);
  recoverySaveTimer = setTimeout(() => { recoverySaveTimer = null; flushRecovery(); }, 450);
}
function flushRecovery() {
  if (recoverySaveTimer) { clearTimeout(recoverySaveTimer); recoverySaveTimer = null; }
  if (!recoveryEnabled || !entryId || !bridge || !bridge.recoverySave) return Promise.resolve(false);
  const state = recoveryState(++recoveryRevision);
  recoverySaveChain = recoverySaveChain.catch(() => false).then(async () => {
    try { const result = await bridge.recoverySave(entryId, state); return !!(result && result.saved); }
    catch { return false; }
  });
  return recoverySaveChain;
}
function scheduleDraft() {
  if (!bridge || !bridge.recoverySaveDraft) return;
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  const text = $("idea").value;
  draftSaveTimer = setTimeout(() => {
    draftSaveTimer = null;
    if (!text.trim()) { if (bridge.recoveryClearDraft) bridge.recoveryClearDraft(); return; }
    bridge.recoverySaveDraft(text).catch(() => {});
  }, 450);
}

/* ---------- compose ---------- */
function goCompose() {
  show("viewCompose");
  slot("idea");
  renderOffline();
  $("idea").focus();
}
$("idea").addEventListener("input", () => {
  overrideUntilEdit = false;
  $("redactBtn").classList.add("hidden");
  fitHeight();
  scheduleDraft();
});
$("idea").addEventListener("input", () => {
  const area = $("idea");
  area.style.height = "76px";
  area.style.height = Math.min(210, Math.max(76, area.scrollHeight + 2)) + "px";
});

function renderOffline() {
  const chip = $("offlineChip");
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  chip.classList.toggle("hidden", !offline);
  if (offline) {
    chip.textContent = "Offline. The local checks still run; writing a prompt does not.";
    chip.title = chip.textContent;
  }
}
window.addEventListener("online", renderOffline);
window.addEventListener("offline", renderOffline);

/* The running total lives in History, where a count of what you have done is
   the point of the view. On the compose screen it was a number you did not ask
   for above the box you are about to type in. */

/* ---------- resize grip ---------- */
const grip = $("resizeGrip");
grip.addEventListener("pointerdown", async event => {
  if (!bridge || !bridge.windowBounds || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  grip.setPointerCapture(event.pointerId);
  grip.classList.add("active");
  const bounds = await bridge.windowBounds();
  if (!bounds || !grip.hasPointerCapture(event.pointerId)) return;
  resizeSession = {
    pointerId: event.pointerId, startX: event.screenX, startY: event.screenY,
    width: bounds.width, height: bounds.height
  };
});
grip.addEventListener("pointermove", event => {
  if (!resizeSession || resizeSession.pointerId !== event.pointerId || !bridge) return;
  bridge.resizeManual({
    width: resizeSession.width + (event.screenX - resizeSession.startX),
    height: resizeSession.height + (resizeSession.startY - event.screenY)
  });
});
function endResize(event) {
  if (!resizeSession || resizeSession.pointerId !== event.pointerId) return;
  resizeSession = null;
  grip.classList.remove("active");
  if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
  refreshWindowFacts();
}
grip.addEventListener("pointerup", endResize);
grip.addEventListener("pointercancel", endResize);
grip.addEventListener("keydown", event => {
  if (!bridge || !bridge.resizeManualBy) return;
  const step = event.shiftKey ? 80 : 24;
  const delta =
    event.key === "ArrowRight" ? { width: step, height: 0 } :
    event.key === "ArrowLeft" ? { width: -step, height: 0 } :
    event.key === "ArrowUp" ? { width: 0, height: step } :
    event.key === "ArrowDown" ? { width: 0, height: -step } : null;
  if (!delta) return;
  event.preventDefault();
  bridge.resizeManualBy(delta).then(refreshWindowFacts);
});

/* ---------- keyboard ----------
   Command+Enter advances, Escape steps back one state and hides from compose,
   and Escape closes an open lesson card before it does anything else. */
document.addEventListener("keydown", event => {
  const tag = document.activeElement ? document.activeElement.tagName : "";
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    if (activeView === "viewCompose") interpret();
    else if (activeView === "viewIntermediary") generate();
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && activeView === "viewIntermediary" &&
      tag !== "TEXTAREA" && tag !== "INPUT" && tag !== "SELECT" && tag !== "BUTTON") {
    event.preventDefault();
    generate();
    return;
  }
  if (event.key !== "Escape") return;
  event.preventDefault();
  /* First launch is modal. Without this the catch-all below fired, and because
     `generation` is null on a first launch it resolved to viewCompose — an app
     with no owner account and no credential, reached by pressing one key during
     setup. There is nothing to go back to here, so Escape does nothing. */
  if (activeView === "viewOnboard") return;
  if (activeView === "viewIntermediary" && lessonState.open_lesson_id) {
    lessonState = D.lessonReducer(lessonState, { type: "escape" }, panel);
    renderIntermediary();
    return;
  }
  if (activeView === "viewComponent") { saveComponent(); renderResult(); return; }
  if (activeView === "viewIntermediary") { goCompose(); return; }
  if (activeView === "viewResult") { hideApp(); return; }
  if (activeView === "viewCompose") { hideApp(); return; }
  goBack();
});

async function hideApp() {
  await flushRecovery();
  if (bridge) bridge.hide();
}

/* ---------- boot ---------- */
/* C4: when this document IS the verification window, the hash names the
   checklist. The full boot is skipped on purpose: it loads profiles, reads the
   window facts and touches the app mode, and a second document doing that
   behind the main window is how two renderers come to disagree about one
   store. This path reads one record and draws one screen. */
const verifyWindowId = (() => {
  const hash = String(location.hash || "");
  return hash.indexOf("#verify:") === 0 ? hash.slice("#verify:".length) : "";
})();

async function bootVerifyWindow() {
  await loadTheme();
  document.body.classList.add("verify-window");
  /* Nothing to go back to in a window of its own. */
  const back = $("verBack");
  if (back) {
    const name = back.querySelector(".fname");
    if (name) name.textContent = "Close";
    const arrow = back.querySelector(".arrow");
    if (arrow) arrow.textContent = "\u00d7";
    back.title = "Close this window";
  }
  if (bridge && bridge.verifyRead) {
    try {
      const record = await bridge.verifyRead(verifyWindowId);
      if (record) checklist = record.checklist || record;
    } catch { /* drawn empty rather than not at all */ }
  }
  if (!checklist) {
    show("viewVerify");
    $("verWhy").textContent = "This checklist could not be opened. Close this window and try again.";
    return;
  }
  $("verVerifier").value = checklist.verifier || "";
  $("verMatter").value = checklist.matter || "";
  renderVerify();
  show("viewVerify");
  if (verifyTick) clearInterval(verifyTick);
  verifyTick = setInterval(renderVerifyClock, 15000);
}

async function boot() {
  if (verifyWindowId) return bootVerifyWindow();
  try { purpose = JSON.parse(localStorage.getItem(LOCAL.purpose) || "[]"); } catch { purpose = []; }
  purpose = purpose.filter(p => D.purposeIds().indexOf(p) !== -1);
  renderPurposeChips();
  renderAttachments();
  await loadTheme();
  await refreshWindowFacts();
  await loadProfiles();
  refreshVerifyBadge(); /* counts quietly; never asks at open (D4) */
  await refreshAppMode();
  /* Tone (D8): stored locally, read by the lesson pool in every mode. */
  try { $("toneSelect").value = lessonTone(); } catch { /* default shown */ }
  $("toneSelect").addEventListener("change", () => {
    try { localStorage.setItem("omono_v4_tone", $("toneSelect").value); } catch { /* full */ }
  });
  /* Round two (R3): the privacy declaration. Personal owns the toggle; the
     enterprise modes read the managed profile's flag and show a note. */
  const privacyToggle = $("privacyToggle");
  const syncPrivacyControls = () => {
    const enterprise = appMode === "managed_enterprise" || appMode === "enterprise_demo";
    $("privacyRow").classList.toggle("hidden", enterprise);
    $("privacyManagedNote").classList.toggle("hidden", !(enterprise && managedPrivacyFlag));
    if (!enterprise) privacyToggle.checked = destinationsPrivate();
  };
  privacyToggle.addEventListener("change", () => {
    try { localStorage.setItem("omono_v4_destinations_private", privacyToggle.checked ? "1" : "0"); }
    catch { /* full */ }
  });
  syncPrivacyControls();
  window.__syncPrivacyControls = syncPrivacyControls;
  /* R-A: the two landing dropdowns; the badge on the Menu pill jumps
     straight to the Verification screen. */
  $("purposeMenuBtn").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleDropdown("purposeMenuBtn", "purposeDropdown");
  });
  $("mainMenuBtn").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleDropdown("mainMenuBtn", "mainDropdown");
  });
  /* U3: popover actions route to the same handlers the hidden panels
     carry; a purpose pick keeps the popover open and refreshes it. */
  if (bridge && bridge.onPopoverAction) {
    bridge.onPopoverAction(({ id }) => {
      const node = $(id);
      if (!node) return;
      if (String(id).indexOf("chip-") === 0) {
        node.click();
        if (popoverOpenPanel === "purposeDropdown" && bridge.popoverUpdate) {
          bridge.popoverUpdate(popoverSpecFor("purposeMenuBtn", "purposeDropdown"));
        }
        return;
      }
      popoverOpenPanel = null;
      if (bridge.popoverDismiss) bridge.popoverDismiss();
      node.click();
    });
    bridge.onPopoverClosed(({ reason }) => {
      const owner = popoverOpenPanel === "purposeDropdown" ? "purposeMenuBtn" : "mainMenuBtn";
      popoverOpenPanel = null;
      $("purposeMenuBtn").setAttribute("aria-expanded", "false");
      $("mainMenuBtn").setAttribute("aria-expanded", "false");
      if (reason === "escape") $(owner).focus();
    });
  }

  const badgeJump = (event) => {
    event.stopPropagation();
    event.preventDefault();
    closeDropdowns();
    $("verifyLoopBtn").click();
  };
  $("verifyBadge").addEventListener("click", badgeJump);
  $("verifyBadge").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") badgeJump(event);
  });
  ["verifyLoopBtn", "restoreBtn", "historyBtn", "settingsBtn", "redactBtn"].forEach((id) => {
    $(id).addEventListener("click", () => closeDropdowns());
  });
  /* Pass four (L5): the personal approval toggle writes the store's own
     policy; enterprise approval belongs to the signed profile. */
  $("lessonApprovalToggle").addEventListener("change", () => {
    if (bridge && bridge.lessonApprovalPolicy) {
      bridge.lessonApprovalPolicy({
        set: $("lessonApprovalToggle").checked ? "manual" : "auto"
      }).catch(() => {});
    }
  });
  checkCelebrations();
  /* v4 (D5): the lesson pool refresh, in the background after the window has
     painted. Cached refreshed lessons load immediately; the pipeline decides
     for itself whether a refresh is due (7 days personal, daily enterprise).
     Offline or failed keeps the pool and the next open retries. */
  try {
    /* Pass four (L1/L5 migration): lesson data that predates the v5 schema
       is archived into the lesson store once, and the old key is cleared;
       the canon and the approved store are the only runtime feeds now. */
    const preSchema = JSON.parse(localStorage.getItem("omono_v4_refreshed") || "[]");
    if (preSchema.length && bridge && bridge.lessonMigrateLegacy) {
      bridge.lessonMigrateLegacy({ refreshed: preSchema })
        .then(() => { try { localStorage.removeItem("omono_v4_refreshed"); } catch { /* stays */ } })
        .catch(() => {});
    }
    window.__omonoRefreshedLessons = [];
    refreshLessonCaches();
  } catch { window.__omonoRefreshedLessons = []; }
  setTimeout(runRefreshPipeline, 900);
  /* Setup is complete when the owner account exists AND a credential is present.
     Gating on the credential alone was the defect: once migration supplied a key,
     first launch never ran, so the mode was never chosen and no owner was ever
     created, which left every protected change refusing with not_initialized. */
  let configured = false;
  let initialized = false;
  if (bridge && bridge.apiCredentialStatus) {
    try {
      const status = await bridge.apiCredentialStatus();
      configured = !!(status && status.configured);
    } catch { configured = false; }
  }
  if (bridge && bridge.authStatus) {
    try {
      const auth = await bridge.authStatus();
      initialized = !!(auth && auth.initialized);
      ownerDisplayName = (auth && auth.display_name) || "";
    } catch { initialized = false; }
  }
  if (!configured) {
    /* Someone upgrading already has a key. Skip straight past the step that asks
       for one they have already given. */
    OB_STEPS = configured ? OB_ALL_STEPS.filter(id => id !== "obStepKey") : OB_ALL_STEPS.slice();
    obIndex = 0;
    obRenderPostures();
    /* Owner exists but the key was cleared: only the key is missing. */
    if (initialized && !configured) obIndex = OB_STEPS.indexOf("obStepKey");
    obShow();
    show("viewOnboard");
  } else {
    if (bridge && bridge.recoveryLoadDraft) {
      try {
        const draft = await bridge.recoveryLoadDraft();
        if (draft && draft.text) $("idea").value = draft.text;
      } catch { /* no draft is the normal case */ }
    }
    /* S5: an install whose setup marker predates the current flow opens
       into setup at first summon; every record persists untouched. */
    let setupNeeded = false;
    if (bridge && bridge.setupState) {
      try { setupNeeded = !!(await bridge.setupState()).needed; } catch { setupNeeded = false; }
    }
    if (setupNeeded) openSetup(); else goCompose();
  }
}
/* ---------- S1/S2/S5: the first-run setup ----------
   One decision per screen, keyboard-first, Escape back, under a minute.
   Managed prefills remove their screens (S2); prefilled values render
   instead of blanks (S5); completing never touches any record. */
let setupSteps = [];
let setupIndex = 0;
function setupShow() {
  ["setupWelcome", "setupMode", "setupStrictness", "setupKey", "setupTools",
    "setupPrivacy", "setupDone"].forEach(id =>
    $(id).classList.toggle("hidden", setupSteps[setupIndex] !== id));
  $("setupStepNote").textContent = (setupIndex + 1) + " of " + setupSteps.length;
  $("setupNext").textContent = setupIndex === setupSteps.length - 1 ? "Finish" : "Continue";
  const focusable = { setupKey: "setupKeyInput", setupPrivacy: "setupPrivacyToggle" };
  const target = focusable[setupSteps[setupIndex]];
  setTimeout(() => { ($(target) || $("setupNext")).focus(); }, 60);
  lastFitHeight = null; fitHeight();
}
async function openSetup() {
  const steps = ["setupWelcome"];
  let keyStored = false;
  try {
    const cred = bridge.apiCredentialStatus ? await bridge.apiCredentialStatus() : null;
    keyStored = !!(cred && (cred.configured || cred.stored));
  } catch { keyStored = false; }
  await refreshAppMode();
  const managed = appMode === "managed_enterprise";
  /* P1: mode and strictness, one decision each, prefilled; a managed
     profile pre-sets both, so both screens leave the sequence. */
  let currentPosture = "intermediate";
  try {
    const settings = bridge.policySettings ? await bridge.policySettings() : null;
    if (settings && settings.posture) currentPosture = settings.posture;
  } catch { /* the default stands */ }
  if (!managed) steps.push("setupStrictness");
  ($("setupModePersonal") || {}).checked = appMode !== "enterprise_demo";
  ($("setupModeEnterprise") || {}).checked = appMode === "enterprise_demo";
  ["Light", "Intermediate", "Strict"].forEach(level => {
    const box = $("setupStrict" + level);
    if (box) box.checked = currentPosture === level.toLowerCase();
  });
  /* S2: a pre-set value removes its screen. The key screen stays for a
     personal install without one; a managed install's key policy is the
     administrator's. S5: prefill instead of blank everywhere. */
  if (!keyStored && !managed) steps.push("setupKey");
  if (!managed) steps.push("setupTools"); /* a managed firm stack is the profile's */
  if (appMode === "personal") steps.push("setupPrivacy");
  steps.push("setupDone");
  setupSteps = steps;
  setupIndex = 0;
  syncSetupStrictnessStep();
  /* Prefills. */
  const host = clear($("setupToolsChecklist"));
  const existing = toolStack();
  allDossiers().filter(d => d.id !== "other-tool").forEach(d => {
    const label = el("label", "obcheck");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.dataset.tool = d.id;
    /* Conservative default, flagged for the owner's veto: Claude
       preselected on a fresh stack; an existing stack prefills itself. */
    box.checked = existing ? existing.indexOf(d.id) !== -1 : d.id === "claude";
    label.appendChild(box);
    label.appendChild(el("span", null, d.display_name));
    host.appendChild(label);
  });
  $("setupPrivacyToggle").checked = destinationsPrivate();
  setupShow();
  show("viewSetup");
}
/* Owner ruling, 2026-09-17: strictness belongs to the screener, which is off in
   Personal. The step is present only while the chosen mode is not Personal, and
   follows the mode picked one screen earlier. */
function syncSetupStrictnessStep() {
  const without = setupSteps.filter(id => id !== "setupStrictness");
  const modeAt = without.indexOf("setupMode");
  if (appMode === "personal" || modeAt === -1) { setupSteps = without; return; }
  without.splice(modeAt + 1, 0, "setupStrictness");
  setupSteps = without;
}
async function setupAdvance() {
  const step = setupSteps[setupIndex];
  if (step === "setupMode") {
    const picked = $("setupModeEnterprise").checked ? "enterprise_demo" : "personal";
    /* A mode change is a protected change (G27); the signing sheet rules,
       exactly as it does from Settings. An unchanged value is a no-op. */
    if (picked !== appMode) { await protectedChange("mode", picked); await refreshAppMode(); }
    syncSetupStrictnessStep();
  }
  if (step === "setupStrictness") {
    const picked = $("setupStrictStrict").checked ? "strict"
      : ($("setupStrictLight").checked ? "light" : "intermediate");
    let current = "intermediate";
    try {
      const settings = bridge.policySettings ? await bridge.policySettings() : null;
      if (settings && settings.posture) current = settings.posture;
    } catch { /* stands */ }
    if (picked !== current) await protectedChange("strictness", picked);
  }
  if (step === "setupKey") {
    const value = $("setupKeyInput").value.trim();
    if (value) {
      if (!/^sk-ant-[A-Za-z0-9_-]{8,}$/.test(value)) {
        $("setupKeyNote").textContent = "That does not look like an Anthropic key (sk-ant-…).";
        return;
      }
      try {
        const result = await bridge.setApiCredential({ value });
        if (!result || !result.ok) { $("setupKeyNote").textContent = "That key could not be used in this tab."; return; }
        $("setupKeyInput").value = "";
      } catch { $("setupKeyNote").textContent = "That key could not be used in this tab."; return; }
    }
  }
  if (step === "setupTools") {
    const picked = Array.from(document.querySelectorAll("#setupToolsChecklist input:checked"))
      .map(box => box.dataset.tool);
    saveToolStack(picked.length ? picked : ["claude"]);
  }
  if (step === "setupPrivacy") {
    /* The personal declaration is the same flag the Settings toggle
       writes (R3); managed installs never reach this screen. */
    try {
      localStorage.setItem("omono_v4_destinations_private",
        $("setupPrivacyToggle").checked ? "1" : "0");
    } catch { /* stays undeclared */ }
    if (window.__syncPrivacyControls) window.__syncPrivacyControls();
  }
  if (setupIndex >= setupSteps.length - 1) {
    if (bridge && bridge.setupDone) { try { await bridge.setupDone(); } catch { /* retried next launch */ } }
    goCompose();
    return;
  }
  setupIndex += 1;
  setupShow();
}
function maybeOpenSetup() {
  if (bridge && bridge.setupState) {
    bridge.setupState().then(state => {
      if (state && state.needed) openSetup(); else goCompose();
    }).catch(() => goCompose());
  } else { goCompose(); }
}
$("setupNext").addEventListener("click", setupAdvance);
document.addEventListener("keydown", (event) => {
  if (activeView !== "viewSetup") return;
  if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") { event.preventDefault(); setupAdvance(); }
  if (event.key === "Escape" && setupIndex > 0) {
    event.preventDefault(); event.stopPropagation();
    setupIndex -= 1; setupShow();
  }
}, true);

/* ---------- first launch (Building O'Mono 3 §2.2) ----------

   Five steps, in the order the manual sets them: mode, owner account, tuning,
   the transmission disclosure, then the credential.

   The mode and the tuning are collected first and APPLIED after the owner exists,
   because applying them is a protected change and a protected change needs an
   owner to authenticate against. That ordering is why every choice made here
   lands in the security audit with an actor, exactly as a later change would,
   rather than being written behind the policy service's back. */
/* The key step is dropped when a credential already exists, which is the case
   for anyone upgrading: migration recovered the v2 key, so asking for it again
   at the end of setup would be asking for something already held. */
const OB_ALL_STEPS = ["obStepKey"];
let OB_STEPS = OB_ALL_STEPS.slice();
let obIndex = 0;
let obMode = "personal";
let obPosture = "intermediate";

function obShow() {
  OB_STEPS.forEach((id, i) => $(id).classList.toggle("hidden", i !== obIndex));
  $("obStep").textContent = (obIndex + 1) + " of " + OB_STEPS.length;
  $("obNext").textContent = obIndex === OB_STEPS.length - 1 ? "Start using O'Mono" : "Continue";
  fitHeight();
}

function obRenderPostures() {
  const host = $("obPostureChips");
  host.textContent = "";
  const postures = (P && P.vocabulary && P.vocabulary.POSTURES) || ["light", "intermediate", "strict"];
  const plain = (P && P.vocabulary && P.vocabulary.POSTURE_PLAIN) || {};
  for (const id of postures) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pchip";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(id === obPosture));
    b.textContent = D.postureLabel(plain, id);
    b.addEventListener("click", () => {
      obPosture = id;
      obRenderPostures();
    });
    host.appendChild(b);
  }
}

for (const card of Array.from(document.querySelectorAll("#obModeGrid .modecard"))) {
  card.addEventListener("click", () => {
    obMode = card.getAttribute("data-mode");
    Array.from(document.querySelectorAll("#obModeGrid .modecard"))
      .forEach(c => c.setAttribute("aria-checked", String(c === card)));
    $("obModeNote").textContent = obMode === "enterprise_demo"
      ? "Enterprise Demo is clearly labelled throughout and does not stand in for a managed customer deployment."
      : "You can change this later in Settings. Changing it asks for the owner password.";
    syncObTuningForMode();
  });
}
/* Owner ruling, 2026-09-17: Personal has no screener, so first launch offers
   neither a strictness choice nor the Local Matter Screening opt-in there. */
function syncObTuningForMode() {
  const personal = obMode === "personal";
  $("obStrictnessPanel").classList.toggle("hidden", personal);
  $("obScreeningRow").classList.toggle("hidden", personal);
  if (personal) $("obScreening").checked = false;
}
syncObTuningForMode();

async function obAdvance() {
  const step = OB_STEPS[obIndex];

  if (step === "obStepOwner") {
    const pass = $("obPass").value;
    const again = $("obPass2").value;
    if (!pass || pass !== again) {
      $("obOwnerNote").textContent = pass ? "Those two do not match." : "A password is required.";
      return;
    }
    /* A label for the audit, not a login: there is one local account and the
       password alone opens it. It never becomes actor_id. */
    const created = await bridge.authCreateOwner({
      password: pass, display_name: $("obName").value });
    /* A previous attempt may have created the owner and then failed to set
       the mode (a managed profile that does not validate). The account
       exists; the password decides whether setup may continue, so a wedged
       first launch can move again instead of dead-ending (D6). */
    if (created && !created.created && created.reason === "already_initialized") {
      const verdict = await bridge.authVerify({ password: pass });
      if (!verdict || !verdict.ok) {
        $("obOwnerNote").textContent = "An owner already exists on this Mac and that is not its password.";
        return;
      }
    } else if (!created || !created.created) {
      $("obOwnerNote").textContent = created && created.reason === "password_too_short"
        ? "That is shorter than " + (created.minimum_length || 8) + " characters."
        : "The owner account could not be created on this Mac.";
      return;
    }
    try {
      const fresh = await bridge.authStatus();
      ownerDisplayName = (fresh && fresh.display_name) || "";
    } catch { ownerDisplayName = ""; }
    /* The choices from step 1 and the ones about to be made in step 3 are applied
       with this password. It is held only for the length of this flow and is
       cleared below. */
    obPassword = pass;
    $("obPass").value = ""; $("obPass2").value = "";
    conceal($("obPass")); conceal($("obPass2"));
    const applied = await bridge.policyProtectedChange({
      change: "mode", value: obMode, password: obPassword, reason: "First launch setup"
    });
    if (!applied || !applied.applied) {
      $("obOwnerNote").textContent = "The mode could not be set: " +
        String((applied && applied.reason) || "refused").replace(/_/g, " ") + ".";
      return;
    }
  }

  if (step === "obStepTuning") {
    if (obMode !== "personal") {
      await bridge.policyProtectedChange({
        change: "strictness", value: obPosture, password: obPassword, reason: "First launch setup"
      });
    }
    await bridge.policyProtectedChange({
      change: "retention", value: $("obRetention").checked, password: obPassword, reason: "First launch setup"
    });
    try { applyTheme(await bridge.setTheme(D.normalizeThemeSource($("obTheme").value))); } catch { /* theme is not fatal */ }
    if (obMode !== "personal" && $("obScreening").checked) {
      /* Enabled, but still nothing to show: screening stays invisible until the
         user actually supplies entries in Settings. */
      try { await bridge.policyMatterScreeningConfigure({ entries: [], enabled: true }); } catch { /* optional */ }
    }
  }

  if (step === "obStepDisclosure") {
    if (!$("obDisclosure").checked) return;
    try { await bridge.policyAcknowledgeDisclosure(); } catch { /* recorded next launch */ }
  }

  if (step === "obStepDisclosure" && obIndex === OB_STEPS.length - 1) {
    /* Last step because the credential was already there. */
    obPassword = "";
    maybeOpenSetup();
    return;
  }

  if (step === "obStepKey") {
    const value = $("obKey").value.trim();
    if (!value) { $("obKey").focus(); return; }
    $("obKey").value = "";
    conceal($("obKey"));
    try {
      const result = await bridge.setApiCredential({ value });
      if (!result || !result.ok) {
        $("obNote").textContent = "That key could not be used in this tab. Check the key and try again.";
        return;
      }
    } catch { $("obNote").textContent = "That key could not be used in this tab."; return; }
    obPassword = "";                 /* not held past the flow */
    /* Setup is complete: the credential and the mode now exist, so the
       refresh that could not run at boot runs now (D5), and the cached mode
       catches up with what onboarding chose (D6). */
    refreshAppMode();
    setTimeout(runRefreshPipeline, 600);
    maybeOpenSetup();
    return;
  }

  obIndex += 1;
  obShow();
}

let obPassword = "";
$("obNext").addEventListener("click", () => { obAdvance(); });

/* Round two (R6): once per session, on summon, when at least one prompt
   awaits an outcome, point at the Verification button for about three
   seconds. Never a modal, never a question box, never repeated. Under
   reduce-motion the cue is a static highlight on the button itself. */
let verifyPointerShown = false;
async function maybeShowVerifyPointer() {
  if (verifyPointerShown) return;
  if (activeView !== "viewCompose") return;
  await refreshVerifyBadge();
  const badge = $("verifyBadge");
  if (!badge || badge.classList.contains("hidden")) return;
  verifyPointerShown = true;
  /* R-A: Verification lives inside the Menu dropdown now, so the pointer
     anchors to the visible carrier of the badge, the Menu pill itself. */
  const button = $("mainMenuBtn");
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    button.classList.add("vpointer-highlight");
    setTimeout(() => button.classList.remove("vpointer-highlight"), 3000);
    return;
  }
  const cue = el("div", "vpointer", "Did your last prompt work?");
  document.body.appendChild(cue);
  const rect = button.getBoundingClientRect();
  const width = cue.getBoundingClientRect().width;
  cue.style.left = Math.max(8, rect.left + rect.width / 2 - width / 2) + "px";
  cue.style.top = (rect.top - cue.getBoundingClientRect().height - 9) + "px";
  setTimeout(() => cue.remove(), 3000);
}

if (bridge) {
  bridge.onShown(() => {
    refreshWindowFacts();
    /* U1: state sizing computes fresh on every show; no cached target
       survives a summon. */
    lastFitHeight = null;
    fitHeight();
    if (activeView === "viewCompose") $("idea").focus();
    maybeShowVerifyPointer();
    });
  if (bridge.onPrepareQuit && bridge.recoveryFlushed) {
    bridge.onPrepareQuit(async () => {
      await flushRecovery();
      bridge.recoveryFlushed();
    });
  }
  if (bridge.onThemeChanged) bridge.onThemeChanged(report => applyTheme(report));
  /* Same reason as Escape: owner elevation out of an unfinished first launch
     leaves the app configured by nobody. Setup finishes first. */
  if (bridge.onCreatorInvoke) {
    /* U9: the accelerator is deleted; a stray invoke event does nothing. */
    bridge.onCreatorInvoke(() => {});
  }
}

window.addEventListener("resize", () => { refreshWindowFacts(); });

boot().catch(() => { if (!verifyWindowId) goCompose(); });
