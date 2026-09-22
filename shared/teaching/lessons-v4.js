"use strict";
/* O'Mono v4 lesson system (D3) — pure selection, rotation, novelty, tone and
 * fading logic. No DOM, no storage, no timers: the renderer owns those and
 * feeds this module plain data, so every rule here is unit-testable.
 *
 * The pool holds ledger-derived items (the teaching panel's coaching, which is
 * new or due by construction) plus the shipped seed library for the cold
 * start. Selection at Write time is local and instant.
 *
 * Browser-safe: IIFE, dual export, no require. Since pass four (L2) the
 * cold-start table is the founding canon (canon-v5.js): the 48 seed lessons
 * are retired from the runtime, and the canon's card anatomy is adapted to
 * the pool shape this module serves until the v5 card replaces it.
 */
var OMonoLessonsV4 = (function () {

  /* Rotation cadence (D3): 10 seconds of a lesson, 3 seconds of one of the
     original status lines, repeating, starting with the statuses. A phase
     change interrupts to that phase's status immediately; the renderer does
     that by restarting the rotation with the new lines. */
  var LESSON_MS = 10000;
  var STATUS_MS = 3000;

  var TONES = ["straight", "playful", "sarcastic"];

  function normalizeTone(value) {
    return TONES.indexOf(value) > -1 ? value : "straight";
  }

  /* No require here, ever: the renderer loads this file with <script src> and
     no bundler (tests/shared-sync.test.js holds that line). canon-v5.js
     loads first and leaves the founding canon on the shared global scope; a
     Node caller requires canon-v5 before this module for the same effect.
     Each canon lesson is adapted to the pool's tone shape: the hook is the
     line, the mechanism and consequence are the detail, the source URL is
     the learn-more door. */
  function seedTable() {
    var root = (typeof window !== "undefined" && window)
      || (typeof globalThis !== "undefined" && globalThis) || {};
    var canon = root.OMonoLessonCanonV5;
    var base = (canon && Array.isArray(canon.lessons) ? canon.lessons : [])
      .filter(function (lesson) {
        /* P5: a retired-duplicate is never selectable, on any surface. */
        return !(lesson && lesson.retired_duplicate === true);
      })
      .map(function (lesson) {
      var tones = {};
      ["straight", "playful", "sarcastic"].forEach(function (tone) {
        var card = (lesson.tones && lesson.tones[tone]) || {};
        tones[tone] = { line: String(card.hook || ""),
          detail: String(card.mechanism || "") + " " + String(card.consequence || "") };
      });
      return { id: lesson.lesson_id, category: lesson.domain,
        title: lesson.tones && lesson.tones.straight ? String(lesson.tones.straight.hook || "") : "",
        tones: tones,
        learn_more: lesson.source ? String(lesson.source.url || "") : null };
    });
    /* v4 (D5): lessons returned by the refresh pipeline join the pool. The
       renderer parks them on the shared scope after a successful refresh;
       ids are namespaced "refresh." so they never collide with the seeds. */
    var refreshed = Array.isArray(root.__omonoRefreshedLessons) ? root.__omonoRefreshedLessons : [];
    return base.concat(refreshed.filter(function (lesson) {
      return lesson && typeof lesson.id === "string" && lesson.tones;
    }));
  }

  /* ---------- the pool ---------- */

  /* A pool item is one shape whatever its source:
     { lesson_id, source: "coaching"|"seed", category, title, line, detail,
       learn_more|null, parts|null }.
     Coaching items carry the owner's five-part lesson verbatim; nothing here
     rewrites that prose. Seed items carry the tone the caller asked for. */
  function poolFrom(coachingUnits, tone, seeds) {
    var chosen = normalizeTone(tone);
    var pool = [];
    (Array.isArray(coachingUnits) ? coachingUnits : []).forEach(function (unit) {
      if (!unit || !unit.lesson_id) return;
      pool.push({
        lesson_id: String(unit.lesson_id),
        source: "coaching",
        category: String(unit.competency_id || "coaching"),
        title: String(unit.be_careful || (unit.card && unit.card.be_careful) || ""),
        line: String(unit.be_careful || (unit.card && unit.card.be_careful) || ""),
        detail: String(unit.why || (unit.card && unit.card.why) || ""),
        learn_more: null,
        parts: unit.card || {
          be_careful: unit.be_careful, why: unit.why,
          protection_to_add: unit.protection_to_add,
          verify_after: unit.verify_after, return_if_failure: unit.return_if_failure
        }
      });
    });
    (Array.isArray(seeds) ? seeds : seedTable()).forEach(function (seed) {
      var toned = seed && seed.tones && seed.tones[chosen];
      if (!toned) return;
      pool.push({
        lesson_id: String(seed.id),
        source: "seed",
        category: String(seed.category || "general"),
        title: String(seed.title || ""),
        line: String(toned.line || seed.title || ""),
        detail: String(toned.detail || ""),
        learn_more: typeof seed.learn_more === "string" ? seed.learn_more : null,
        parts: null
      });
    });
    return pool;
  }

  /* ---------- novelty ----------
     Never the same lesson twice in one run, and never a lesson shown in the
     previous run. The caller passes both sets; this only filters. */
  function novel(pool, shownThisRun, shownLastRun) {
    var thisRun = shownThisRun || [];
    var lastRun = shownLastRun || [];
    return pool.filter(function (item) {
      return thisRun.indexOf(item.lesson_id) === -1
        && lastRun.indexOf(item.lesson_id) === -1;
    });
  }

  /* Wait-rotation selection: coaching first (it is about THIS task), then
     seeds, both novelty-gated. Deterministic order so a test can predict it. */
  function selectWaitLessons(pool, options) {
    var opts = options || {};
    var fresh = novel(pool, opts.shownThisRun, opts.shownLastRun);
    var coaching = fresh.filter(function (i) { return i.source === "coaching"; });
    var seeds = fresh.filter(function (i) { return i.source === "seed"; });
    return coaching.concat(seeds);
  }

  /* The rotation plan the renderer plays: status, lesson, status, lesson...
     starting with the statuses. Returns the next step given elapsed state. */
  function rotationStep(stepIndex) {
    var isStatus = stepIndex % 2 === 0;
    return { kind: isStatus ? "status" : "lesson", holdMs: isStatus ? STATUS_MS : LESSON_MS };
  }

  /* ---------- the one card ---------- */

  /* One lesson card maximum per screen. The card's title is the rule itself;
     detail sits one tap behind. A due lesson (recall=true) returns as a
     one-line question, tap to reveal. */
  function cardFor(pool, options) {
    var opts = options || {};
    var fresh = novel(pool, [], opts.shownLastRun);
    var pick = fresh.filter(function (i) { return i.source === "coaching"; })[0]
      || fresh[0] || pool[0] || null;
    if (!pick) return null;
    var everSeen = (opts.everSeen || []).indexOf(pick.lesson_id) > -1;
    var due = (opts.dueLessonIds || []).indexOf(pick.lesson_id) > -1;
    return {
      lesson_id: pick.lesson_id,
      source: pick.source,
      category: pick.category,
      title: pick.title,
      detail: pick.detail,
      parts: pick.parts,
      learn_more: pick.learn_more,
      first_ever: !everSeen,
      question_form: due,
      question: due ? questionForm(pick) : null
    };
  }

  /* The question is the rule turned back on the user, one line, no grading,
     no points. Tap reveals the full card and the reveal is logged. */
  function questionForm(item) {
    var line = String(item.title || item.line || "").replace(/\.\s*$/, "");
    if (!line) return null;
    return "Do you remember: " + line.charAt(0).toLowerCase() + line.slice(1) + "?";
  }

  /* ---------- fading ----------
     When a failure category goes quiet, its lessons step back automatically:
     card, then behind the tap, then silent. Nothing is deleted. Activity is
     the caller's per-category counts from the ledger. */
  var FADE_CARD_FLOOR = 1;      /* any failure in the recent window keeps the card */
  var QUIET_WINDOW_MS = 14 * 24 * 3600 * 1000;   /* one quiet fortnight steps back once */
  var SILENT_WINDOW_MS = 45 * 24 * 3600 * 1000;  /* a quiet forty-five days steps back twice */

  function fadeLevel(activity, now) {
    var a = activity || {};
    var failures = Number(a.failures || 0);
    var last = Number(a.last_failure_ts || 0);
    if (failures >= FADE_CARD_FLOOR && last && (now - last) < QUIET_WINDOW_MS) return "card";
    if (last && (now - last) < SILENT_WINDOW_MS) return "behind_tap";
    if (!last && failures === 0 && a.cold_start === true) return "card";
    return "silent";
  }

  /* A fresh failure promotes a category straight back to the card. */
  function promoteOnFailure(level) { return "card"; }

  var api = {
    LESSON_MS: LESSON_MS,
    STATUS_MS: STATUS_MS,
    TONES: TONES.slice(),
    normalizeTone: normalizeTone,
    poolFrom: poolFrom,
    novel: novel,
    selectWaitLessons: selectWaitLessons,
    rotationStep: rotationStep,
    cardFor: cardFor,
    questionForm: questionForm,
    fadeLevel: fadeLevel,
    promoteOnFailure: promoteOnFailure
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoLessonsV4;
if (typeof window !== "undefined") window.OMonoLessonsV4 = OMonoLessonsV4;
else if (typeof globalThis !== "undefined") globalThis.OMonoLessonsV4 = OMonoLessonsV4;
