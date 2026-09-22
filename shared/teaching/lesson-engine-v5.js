"use strict";
/* O'Mono lesson engine v5 (pass four, L3/L4): pure adaptation, selection,
 * binding and mixing over the v5 canon. No DOM, no storage, no timers, no
 * network; the renderer owns those and feeds this module plain data.
 *
 * Selection order when candidates compete, on top of the novelty and
 * spacing gates: current task risk first, then a repeated failure, then an
 * important omitted field, then a destination trait. Breadth is last.
 *
 * The binding line is composed here, locally, at display time, one
 * sentence, from facts interpret already produced plus the lesson's
 * concept. Template-built, zero network, zero latency.
 *
 * Browser-safe: IIFE, dual export, loader-free by the module contract that
 * tests/teaching/module-contract.test.js enforces. */
var OMonoLessonEngineV5 = (function () {

  var TONES = ["straight", "playful", "sarcastic"];

  /* The canon-versus-record mix (L4). One behavior ships; the weight is a
     code constant, never a user setting. The three policies exist so the
     comparison harness can measure them against the synthetic ledgers; the
     shipped one is BALANCED unless the comparison clearly crowns another. */
  var MIX_POLICIES = {
    canon_led: 0.3,   /* record-driven candidates win 3 of 10 contested picks */
    balanced: 0.5,
    record_led: 0.7
  };
  var SHIPPED_MIX_POLICY = "balanced";

  /* ---------- adaptation ---------- */

  /* R-E: the engine's mirror of the schema's jargon lint (the two modules
     are loader-free by contract, so neither may require the other; the
     parity test in tests/teaching/lesson-engine-v5.test.js pins the copies
     together). Wait eligibility is the owner's flag, default false, and
     the lint hard-blocks it regardless. */
  var JARGON_TERMS = [
    { term: "agent", shape: /\bagents?\b/i },
    { term: "token", shape: /\btokens?\b/i },
    { term: "context window", shape: /\bcontext windows?\b/i },
    { term: "retrieval", shape: /\bretrievals?\b/i },
    { term: "embedding", shape: /\bembeddings?\b/i },
    { term: "fine-tune", shape: /\bfine[- ]tun(?:e|es|ed|ing)\b/i }
  ];
  function hookLintClean(lesson) {
    var tones = (lesson && lesson.tones && typeof lesson.tones === "object") ? lesson.tones : {};
    for (var i = 0; i < TONES.length; i += 1) {
      var hook = String(((tones[TONES[i]] || {}).hook) || "");
      for (var j = 0; j < JARGON_TERMS.length; j += 1) {
        var match = JARGON_TERMS[j].shape.exec(hook);
        if (!match) continue;
        var after = hook.slice(match.index + match[0].length);
        if (!/^[^.!?]{0,80}?(\(|\u2014\s*(that is|meaning|in plain (terms|words))|,\s*(that is|meaning|in plain (terms|words)))/i.test(after)) {
          return false;
        }
      }
    }
    return true;
  }

  function renderView(lesson, tone) {
    var chosen = TONES.indexOf(tone) > -1 ? tone : "straight";
    var tones = lesson.tones || {};
    var card = tones[chosen] || tones.straight || {};
    return {
      lesson_id: String(lesson.lesson_id || ""),
      version: Number(lesson.version),
      revision_key: revisionKey(lesson),
      concept: String(lesson.concept || ""),
      domain: String(lesson.domain || ""),
      level: String(lesson.level || ""),
      objective: String(lesson.objective || ""),
      takeaway: String(lesson.takeaway || ""),
      risk_relevance: String(lesson.risk_relevance || ""),
      hook: String(card.hook || ""),
      mechanism: String(card.mechanism || ""),
      consequence: String(card.consequence || ""),
      source_label: lesson.source ? String(lesson.source.label || "") : "",
      source_url: lesson.source ? String(lesson.source.url || "") : "",
      recall: typeof lesson.recall === "string" ? lesson.recall : null,
      choreography_eligible: lesson.retired_duplicate !== true,
      wait_eligible: lesson.wait_eligible === true
        && (lesson.__canon === true || hookLintClean(lesson)),
      familiar_use_trigger: String(lesson.familiar_use_trigger || "")
    };
  }

  function revisionKey(lessonOrId, version) {
    var id = typeof lessonOrId === "string" ? lessonOrId
      : String((lessonOrId && lessonOrId.lesson_id) || "");
    var v = version === undefined && lessonOrId && typeof lessonOrId === "object"
      ? lessonOrId.version : version;
    return id && Number.isInteger(v) && v >= 1 ? id + "@" + v : "";
  }

  /* The pool: shipped canon plus approved additions, one tone, valid rows
     only. Content this module cannot render is skipped, never guessed at. */
  function poolFrom(canonLessons, approvedLessons, tone) {
    /* U6: canon rows carry owner supremacy over the jargon lint; approved
       machine candidates never do. The marker is transient, set here. */
    var mark = function (list, canon) {
      return (Array.isArray(list) ? list : []).map(function (lesson) {
        if (!lesson || typeof lesson !== "object") return lesson;
        var copy = {}; Object.keys(lesson).forEach(function (k) { copy[k] = lesson[k]; });
        copy.__canon = canon;
        return copy;
      });
    };
    var all = [].concat(mark(canonLessons, true), mark(approvedLessons, false));
    var positions = {};
    var pool = [];
    all.forEach(function (lesson) {
      if (!lesson || !lesson.lesson_id) return;
      /* P5: a retired-duplicate is never selectable. */
      if (lesson.retired_duplicate === true) return;
      var view = renderView(lesson, tone);
      if (!view.revision_key || !view.hook || !view.mechanism || !view.consequence) return;
      var at = positions[lesson.lesson_id];
      if (at === undefined) {
        positions[lesson.lesson_id] = pool.length;
        pool.push(view);
      } else if (view.version > pool[at].version) {
        /* The latest revision is active; the store retains older revisions for
           historical resolution rather than presenting both as active. */
        pool[at] = view;
      }
    });
    return pool;
  }

  /* ---------- the gates (novelty and spacing, unchanged law) ---------- */

  function novel(pool, shownThisRun, shownLastRun) {
    var thisRun = shownThisRun || [];
    var lastRun = shownLastRun || [];
    return pool.filter(function (view) {
      return thisRun.indexOf(view.lesson_id) === -1
        && lastRun.indexOf(view.lesson_id) === -1;
    });
  }

  /* ---------- the four reasons, in the ruled order ---------- */

  /* Destination quirk: what THIS destination's shape makes likely. Traits
     are the profile facts the fold already uses (reasoning, tools). */
  var QUIRK_CONCEPTS = {
    tools: ["agentic_risk", "prompt_injection", "insecure_codegen"],
    reasoning: ["nondeterminism", "post_hoc_explanation", "automation_bias"],
    /* D9: a destination O'Mono could not verify against vendor documentation.
       The profile records every unconfirmed capability as the string "unknown"
       — which is the honest thing to record — and destinationTraits then
       collapses "unknown" to false, so on GPT-5.6 Sol and Gemini 3.6 Flash the
       quirk trigger had ZERO eligible lessons out of forty-nine and could never
       fire. An unverified destination is precisely where model-behaviour and
       uncertainty teaching applies, so it gets its own quirk family rather than
       being treated as a destination with no quirks at all. */
    unverified: ["nondeterminism", "fluency_miscalibration", "uncertainty_blindness"]
  };
  var QUIRK_DOMAINS = {
    tools: ["agentic_systems_and_tool_autonomy", "security"],
    reasoning: ["transparency_and_explanation_limits", "model_behavior_and_uncertainty"],
    unverified: ["model_behavior_and_uncertainty", "verification_and_evaluation"]
  };

  /* The mistake the record repeats: failure-category families mapped to the
     phenomena that produce them. Honest mappings only; unknown categories
     fall through to the next reason rather than stretching a match. */
  var FAILURE_CONCEPTS = {
    "source": { concepts: ["confabulation"], domains: ["reliability_and_confabulation", "verification_and_evaluation"] },
    "failure.invented_source": { concepts: ["confabulation"], domains: ["reliability_and_confabulation"] },
    "failure.stale_data": { concepts: ["training_data_staleness"], domains: ["data_provenance_and_training_data"] },
    "failure.too_generic": { concepts: ["homogenization"], domains: ["model_behavior_and_uncertainty"] },
    "failure.wrong_format": { concepts: ["nondeterminism"], domains: ["model_behavior_and_uncertainty"] },
    "failure.missing_context": { concepts: ["context_position_effect"], domains: ["reliability_and_confabulation"] }
  };

  /* The field they skipped. Only where the link is honest. */
  var SKIP_CONCEPTS = {
    input: { concepts: ["confabulation"], domains: ["reliability_and_confabulation"] },
    examples: { concepts: ["homogenization"], domains: ["model_behavior_and_uncertainty"] },
    role: { concepts: ["persona_ineffectiveness", "sycophancy"], domains: ["human_ai_interaction_and_automation_bias"] },
    context: { concepts: ["context_position_effect", "inference_privacy"], domains: ["privacy_and_data_protection"] },
    format: { concepts: ["nondeterminism"], domains: ["model_behavior_and_uncertainty"] }
  };

  /* The task's risk: interpret's own facts. */
  function riskMatch(view, facts) {
    var classes = facts.data_classes || [];
    var sensitive = classes.some(function (c) { return ["C3", "C4", "C5", "C6", "C7", "C8"].indexOf(c) > -1; });
    if (sensitive && ["privacy_and_data_protection", "confidentiality_and_privilege",
      "security"].indexOf(view.domain) > -1) return true;
    var family = String(facts.task_family || "");
    if (/^legal/.test(family) && ["confidentiality_and_privilege",
      "verification_and_evaluation", "reliability_and_confabulation"].indexOf(view.domain) > -1) return true;
    var risks = facts.risk_ids || [];
    if (risks.some(function (r) { return /^source\./.test(String(r)); })
      && view.domain === "reliability_and_confabulation") return true;
    return false;
  }

  function conceptOrDomain(view, table) {
    if (!table) return false;
    if ((table.concepts || []).indexOf(view.concept) > -1) return true;
    if ((table.domains || []).indexOf(view.domain) > -1) return true;
    return false;
  }

  /* Selection happens before Interpret, so the first pick cannot rely on a
     model-written task family or risk list. These narrow local patterns cover
     explicit legal and source-verification requests without sending or saving
     the person's text. Unknown requests stay unknown and fall through. */
  var LOCAL_LEGAL_RISK = /\b(legal (analysis|memorandum|memo|research|opinion)|contract review|review (?:a |the )?contract|clause|case law|caselaw|statute|regulation|court filing|petition|motion|due diligence)\b/i;
  var LOCAL_SOURCE_RISK = /\b(citations?|case law|caselaw|precedent|primary sources?|supporting sources?|authorit(?:y|ies)|statutes?|legal research|fact[- ]?check|verification|verify|check (?:the )?sources?|current law|latest (?:law|rule|regulation|case|news|facts?))\b/i;

  function localPreInterpretRiskFacts(text) {
    var source = String(text || "");
    return {
      task_family: LOCAL_LEGAL_RISK.test(source) ? "legal" : "",
      risk_ids: LOCAL_SOURCE_RISK.test(source)
        ? ["source.real_but_mischaracterized"] : []
    };
  }

  /* Why this lesson, for this prompt. The first reason in the ruled order
     that holds; null when only breadth recommends it. */
  function matchReason(view, facts) {
    var f = facts || {};
    var traits = f.traits || {};
    if (riskMatch(view, f)) return "risk";
    var repeats = f.repeated_failure_categories || [];
    for (var i = 0; i < repeats.length; i++) {
      var key = String(repeats[i]);
      var table = FAILURE_CONCEPTS[key] || FAILURE_CONCEPTS[key.split(".")[0]];
      if (conceptOrDomain(view, table)) return "repeat";
    }
    var skipped = f.skipped_fields || [];
    for (var j = 0; j < skipped.length; j++) {
      if (conceptOrDomain(view, SKIP_CONCEPTS[String(skipped[j])])) return "skip";
    }
    if (traits.tools && (QUIRK_CONCEPTS.tools.indexOf(view.concept) > -1
      || QUIRK_DOMAINS.tools.indexOf(view.domain) > -1)) return "quirk";
    if (traits.reasoning && (QUIRK_CONCEPTS.reasoning.indexOf(view.concept) > -1
      || QUIRK_DOMAINS.reasoning.indexOf(view.domain) > -1)) return "quirk";
    if (traits.unverified && (QUIRK_CONCEPTS.unverified.indexOf(view.concept) > -1
      || QUIRK_DOMAINS.unverified.indexOf(view.domain) > -1)) return "quirk";
    return null;
  }

  var REASON_RANK = { risk: 0, repeat: 1, skip: 2, quirk: 3 };

  /* ---------- the mix ---------- */

  /* Deterministic, seedless: the running pick counter decides which side of
     the weight a contested pick lands on, so tests and reruns agree. */
  function mixPrefersRecord(policy, pickCounter) {
    var weight = MIX_POLICIES[policy] === undefined
      ? MIX_POLICIES[SHIPPED_MIX_POLICY] : MIX_POLICIES[policy];
    var slot = ((Number(pickCounter) || 0) % 10 + 10) % 10;
    return slot < Math.round(weight * 10);
  }

  /* ---------- selection ---------- */

  /* One lesson for the card, or null. Facts and state:
     facts: { traits, task_family, data_classes, risk_ids, skipped_fields,
              repeated_failure_categories, destination_label }
     state: { shownThisRun, shownLastRun, dueLessonIds, domainExposure,
              pickCounter, mixPolicy } */
  /* V3 (voice-and-depth): the engine mirrors three numbers from
     shared/teaching/curriculum-constants.js — the recall share cap (1/3)
     and the working-grasp promotion thresholds (3 moments across 2
     distinct lessons) — because this module is loader-free by contract and
     may not require the constants file. The parity test in
     tests/teaching/lesson-engine-v5.test.js pins the mirror. Callers may
     pass state.recallShareCap to make the wiring explicit. */
  var RECALL_SHARE_CAP_MIRROR = 1 / 3;
  var PROMOTE_MIN_MOMENTS_MIRROR = 3;
  var PROMOTE_MIN_DISTINCT_MIRROR = 2;
  var LEVEL_RANK = { foundational: 0, intermediate: 1, advanced: 2 };

  /* A domain at working grasp on its foundational material prefers
     intermediate; intermediate at working grasp prefers advanced. Stats
     arrive per domain as {level: {moments, distinct}}; capacity, when
     given, is how many lessons the canon actually holds per level in the
     domain. The distinct requirement caps at that capacity: a domain whose
     canon carries one foundational lesson reaches its foundational grasp
     on that one lesson, because a requirement the canon cannot meet is a
     promotion that could never happen — and the ruling's own acceptance
     floors (intermediate in >= 10 domains, the canon's exact intermediate
     capacity) demand that it can. Stated openly as the conservative
     reading. */
  function preferredLevelFor(stats, capacity) {
    var grasp = function (cell, cap) {
      var need = PROMOTE_MIN_DISTINCT_MIRROR;
      if (isFinite(cap) && cap > 0 && cap < need) need = cap;
      return cell && Number(cell.moments) >= PROMOTE_MIN_MOMENTS_MIRROR
        && Number(cell.distinct) >= need;
    };
    var c = capacity || {};
    if (grasp(stats && stats.intermediate, c.intermediate)) return "advanced";
    if (grasp(stats && stats.foundational, c.foundational)) return "intermediate";
    return "foundational";
  }

  function selectLesson(pool, facts, state) {
    var s = state || {};
    var fresh = novel(pool, s.shownThisRun, s.shownLastRun);
    if (!fresh.length) return null;

    /* V3: recalls may take at most the capped share of a session's
       teaching moments. Past the cap a due lesson defers — the due list is
       ignored for this pick, so new teaching proceeds undisplaced. */
    var cap = Number(s.recallShareCap);
    if (!isFinite(cap) || cap <= 0) cap = RECALL_SHARE_CAP_MIRROR;
    var sessionMoments = Number(s.sessionMoments) || 0;
    var sessionRecalls = Number(s.sessionRecalls) || 0;
    var recallAllowed = (sessionRecalls + 1) <= cap * (sessionMoments + 1);
    var dueIds = recallAllowed ? (s.dueLessonIds || []) : [];

    /* Record-driven candidates: due recalls first, then the ruled order of
       reasons. Canon-led candidate: breadth, the least-exposed domain. */
    var due = fresh.filter(function (view) {
      return dueIds.indexOf(view.lesson_id) > -1;
    });

    var exposure = s.domainExposure || {};
    var levelStats = s.domainLevelStats || {};
    /* The canon's per-domain level capacity, from the pool in hand. */
    var capacityByDomain = {};
    pool.forEach(function (view) {
      var cell = capacityByDomain[view.domain] = capacityByDomain[view.domain] || {};
      cell[view.level] = (cell[view.level] || 0) + 1;
    });
    var seenEver = {};
    (s.everSeenIds || []).forEach(function (id) { seenEver[id] = true; });
    /* V3: how far a candidate sits from its domain's preferred level. The
       preferred level itself ranks 0; below it ranks by distance; above it
       ranks worse still, so depth is earned, never skipped to. This
       subsumes the old untouched-domain foundational rule: a domain with
       no stats prefers foundational by construction (C3 holds). */
    var levelFit = function (view) {
      var preferred = preferredLevelFor(levelStats[view.domain], capacityByDomain[view.domain]);
      var gap = LEVEL_RANK[view.level] - LEVEL_RANK[preferred];
      return gap >= 0 ? gap * 2 : -gap * 2 - 1; /* at: 0; one below: 1; one above: 2; two above: 4 */
    };
    /* V3: the record-driven candidates keep the ruled reason order first;
       inside one reason the same depth keys apply as for breadth, so a
       repeated failure teaches its domain up the ladder instead of
       repeating one lesson forever. */
    var reasoned = [];
    fresh.forEach(function (view) {
      var reason = matchReason(view, facts);
      if (reason) reasoned.push({ view: view, reason: reason });
    });
    reasoned.sort(function (a, b) {
      var rank = REASON_RANK[a.reason] - REASON_RANK[b.reason];
      if (rank !== 0) return rank;
      var fit = levelFit(a.view) - levelFit(b.view);
      if (fit !== 0) return fit;
      var sa = seenEver[a.view.lesson_id] ? 1 : 0;
      var sb = seenEver[b.view.lesson_id] ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return a.view.lesson_id < b.view.lesson_id ? -1 : 1;
    });

    /* V3: inside the preferred level, an install prefers lessons it has
       never seen, so a domain's second distinct lesson actually gets
       taught and working grasp (distinct >= 2 where capacity allows) is
       reachable instead of one lesson repeating forever. */
    var breadth = fresh.slice().sort(function (a, b) {
      var diff = (exposure[a.domain] || 0) - (exposure[b.domain] || 0);
      if (diff !== 0) return diff;
      var fit = levelFit(a) - levelFit(b);
      if (fit !== 0) return fit;
      var sa = seenEver[a.lesson_id] ? 1 : 0;
      var sb = seenEver[b.lesson_id] ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return a.lesson_id < b.lesson_id ? -1 : 1;
    })[0] || null;

    var recordCandidate = due.length
      ? { view: due[0], reason: "due" }
      : (reasoned.length ? reasoned[0] : null);
    var canonCandidate = breadth ? { view: breadth, reason: "breadth" } : null;

    var picked;
    if (recordCandidate && canonCandidate
        && recordCandidate.view.lesson_id !== canonCandidate.view.lesson_id) {
      picked = mixPrefersRecord(s.mixPolicy || SHIPPED_MIX_POLICY, s.pickCounter)
        ? recordCandidate : canonCandidate;
    } else {
      picked = recordCandidate || canonCandidate;
    }
    if (!picked) return null;

    return {
      view: picked.view,
      reason: picked.reason,
      question_form: dueIds.indexOf(picked.view.lesson_id) > -1
        && !!picked.view.recall
    };
  }

  /* Wait rotation: hooks only, drawn only from lessons whose hook stands
     alone, novelty-gated, record reasons ahead of breadth. */
  function selectWaitLessons(pool, facts, state) {
    var s = state || {};
    var fresh = novel(pool.filter(function (view) { return view.wait_eligible; }),
      s.shownThisRun, s.shownLastRun);
    var withReasons = fresh.map(function (view) {
      return { view: view, reason: matchReason(view, facts) };
    });
    withReasons.sort(function (a, b) {
      var ra = a.reason ? REASON_RANK[a.reason] : 9;
      var rb = b.reason ? REASON_RANK[b.reason] : 9;
      if (ra !== rb) return ra - rb;
      return a.view.lesson_id < b.view.lesson_id ? -1 : 1;
    });
    return withReasons.map(function (row) { return row.view; });
  }

  /* ---------- local three-lesson choreography ---------- */

  var IDEA_STOP_WORDS = {
    about: true, after: true, again: true, also: true, because: true,
    before: true, could: true, draft: true, from: true, have: true,
    into: true, need: true, should: true, that: true, their: true,
    there: true, these: true, they: true, this: true, want: true,
    with: true, would: true, write: true, your: true
  };

  function words(value) {
    var hits = String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [];
    var out = {};
    hits.forEach(function (word) {
      if (word.length >= 4 && !IDEA_STOP_WORDS[word]) out[word] = true;
    });
    return out;
  }

  function ideaRelevance(view, facts) {
    var wanted = words((facts || {}).idea_text);
    if (!Object.keys(wanted).length) return 0;
    var held = words([
      view.concept, view.domain, view.objective, view.takeaway,
      view.risk_relevance, view.familiar_use_trigger, view.hook,
      view.mechanism, view.consequence
    ].join(" ").replace(/_/g, " "));
    return Object.keys(wanted).reduce(function (score, word) {
      return score + (held[word] ? 1 : 0);
    }, 0);
  }

  function choreographyViews(pool) {
    var seen = {};
    return (Array.isArray(pool) ? pool : []).filter(function (view) {
      if (!view || view.choreography_eligible !== true || !view.revision_key) return false;
      if (seen[view.revision_key]) return false;
      seen[view.revision_key] = true;
      return true;
    });
  }

  function normalizeCompleteSeen(pool, revisionKeys) {
    var active = {};
    choreographyViews(pool).forEach(function (view) { active[view.revision_key] = true; });
    var seen = {};
    return (Array.isArray(revisionKeys) ? revisionKeys : []).filter(function (key) {
      if (typeof key !== "string" || !active[key] || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function rankChoreography(candidates, facts, state) {
    var exposure = (state && state.domainExposure) || {};
    return candidates.slice().sort(function (a, b) {
      var ar = matchReason(a, facts);
      var br = matchReason(b, facts);
      var rank = (ar ? REASON_RANK[ar] : 4) - (br ? REASON_RANK[br] : 4);
      if (rank !== 0) return rank;
      var relevance = ideaRelevance(b, facts) - ideaRelevance(a, facts);
      if (relevance !== 0) return relevance;
      var breadth = (exposure[a.domain] || 0) - (exposure[b.domain] || 0);
      if (breadth !== 0) return breadth;
      return a.revision_key < b.revision_key ? -1 : 1;
    });
  }

  function choreographySlot(view, role, membership, paintEligible, anchor) {
    if (!view) return null;
    var slot = {};
    Object.keys(view).forEach(function (key) { slot[key] = view[key]; });
    slot.selection_role = role;
    slot.cycle_membership = membership;
    slot.full_paint_eligible = paintEligible === true;
    slot.cycle_anchor = anchor === true;
    return slot;
  }

  /* Owner ruling, 2026-09-17: lessons never repeat. Every active revision
     that has not appeared in full is a candidate; relevance controls order,
     never admission. Nothing already seen is ever offered again, not even as a
     preview, so when the unseen set runs short a slot stays empty rather than
     repeating, and needs_more asks the caller to fetch new lessons before that
     happens. The result slot is filled first when fewer than three remain,
     because it is the one slot guaranteed to paint on every successful path. */
  var FETCH_MORE_WHEN_UNSEEN_BELOW = 6;

  function selectChoreographyLessons(pool, facts, state) {
    var s = state || {};
    var active = choreographyViews(pool);
    var seen = {};
    (Array.isArray(s.completeSeenRevisionKeys) ? s.completeSeenRevisionKeys : [])
      .forEach(function (key) { if (typeof key === "string") seen[key] = true; });
    var unseen = rankChoreography(active.filter(function (view) {
      return !seen[view.revision_key];
    }), facts || {}, s);
    var raw;
    if (unseen.length >= 3) raw = unseen.slice(0, 3);
    else if (unseen.length === 2) raw = [unseen[0], null, unseen[1]];
    else if (unseen.length === 1) raw = [null, null, unseen[0]];
    else raw = [null, null, null];
    var roles = ["lesson_1", "lesson_2", "lesson_3"];
    var ordered = raw.map(function (view, index) {
      return choreographySlot(view, roles[index], "current_cycle", true, false);
    });
    return {
      rotation: ordered.slice(0, 2),
      closing: ordered[2],
      ordered: ordered,
      exact_three: unseen.length >= 3,
      active_revision_count: active.length,
      unseen_revision_count: unseen.length,
      needs_more: unseen.length < FETCH_MORE_WHEN_UNSEEN_BELOW,
      cycle_reset_before_selection: false,
      cycle_boundary: null,
      boundary_anchor_revision_key: null,
      deferred_rotation_slots: []
    };
  }

  /* Call only after a complete lesson has rendered. Preview hooks never reach
     this function. The history only grows: it never clears, so no lesson
     repeats, and it keeps revisions that are not in the pool right now (a
     grown lesson whose store has not loaded yet must not become unseen). */
  function advanceCompleteCycle(pool, revisionKeys, completedRevisionKey) {
    var active = choreographyViews(pool);
    var activeKeys = {};
    active.forEach(function (view) { activeKeys[view.revision_key] = true; });
    var seen = [];
    var held = {};
    (Array.isArray(revisionKeys) ? revisionKeys : []).forEach(function (key) {
      if (typeof key !== "string" || !key || held[key]) return;
      held[key] = true;
      seen.push(key);
    });
    if (activeKeys[completedRevisionKey] && !held[completedRevisionKey]) {
      seen.push(completedRevisionKey);
    }
    return {
      completeSeenRevisionKeys: seen,
      cycle_completed: false,
      cycle_reset_before_record: false,
      active_revision_count: active.length
    };
  }

  /* ---------- the binding line ---------- */

  var FIELD_PLAIN = {
    role: "Role", task: "Task", context: "Context", input: "Input",
    constraints: "Constraints", examples: "Examples", format: "Format", tone: "Tone"
  };

  function taskPlain(facts) {
    var family = String((facts || {}).task_family || "").split(".")[0];
    return family ? family.replace(/_/g, " ") : "this";
  }

  function anOrA(word) {
    return /^[aeiou]/i.test(String(word || "")) ? "an " + word : "a " + word;
  }

  /* One sentence, composed locally from facts interpret already produced
     plus the lesson's concept. No network, no latency, no invention: every
     slot is a fact the caller handed over. */
  /* U5, the grammar contract: the binding line comes from a small set of
     vetted sentence templates per trigger type, with typed slots that
     accept only display-dictionary nouns and plain clauses — never an
     internal task-shape string. taskPlain() is gone from every template:
     jamming a task_family root into prose produced the observed garbage
     ("on a meta-inquiry about process prompt this is where it tends to
     show up"). Slot fillers: the destination label, the concept's
     dictionary name, the plain field name, the domain's dictionary name. */
  function dictionary() {
    var root = (typeof globalThis !== "undefined" && globalThis) || {};
    return root.OMonoDisplayNames || null;
  }
  function plainNoun(id, kind) {
    var names = dictionary();
    if (names) {
      if (kind === "concept") return names.conceptName(id);
      if (kind === "domain") {
        /* Lowercase for mid-sentence use without lowercasing AI. */
        return names.domainName(id).replace(/^AI\b/, "\u0001").toLowerCase().replace("\u0001", "AI");
      }
    }
    return String(id == null ? "" : id).split(".").pop().replace(/[_-]+/g, " ");
  }

  function bindingLineFor(view, facts, reason) {
    var f = facts || {};
    var v = view || {};
    var destination = String(f.destination_label || "this destination");
    var concept = plainNoun(v.concept, "concept");
    if (reason === "quirk") {
      var traits = f.traits || {};
      if (traits.tools) {
        return "Picked for " + destination + ": prompts that hand the model tools are where "
          + concept + " surfaces.";
      }
      if (traits.reasoning) {
        return "Picked for " + destination + ": long reasoning runs are where "
          + concept + " tends to surface.";
      }
      if (traits.unverified) {
        return "Picked for " + destination + ": O'Mono could not confirm what this "
          + "one can do, and " + concept + " is what that uncertainty costs.";
      }
      return "Picked for " + destination + ": this is a destination where "
        + concept + " tends to surface.";
    }
    if (reason === "repeat" || reason === "due") {
      return "Picked because your own record has met " + concept
        + " before, and it tends to come back.";
    }
    if (reason === "skip") {
      var skipped = (f.skipped_fields || [])[0];
      var label = (FIELD_PLAIN[skipped] || "a field").toLowerCase();
      /* "the opening THAT X uses": the reviewer flagged the bare reduced
         relative colliding with the-initial nouns (the training cutoff). */
      return "Picked because the " + label + " field is empty here, and that is the opening that "
        + concept + " uses.";
    }
    if (reason === "risk") {
      return "Picked for this task's risk: " + concept + " is the failure mode to watch.";
    }
    return "Picked to broaden the record: teaching in " + plainNoun(v.domain, "domain")
      + " has been thinnest so far.";
  }

  var api = {
    TONES: TONES.slice(),
    MIX_POLICIES: MIX_POLICIES,
    SHIPPED_MIX_POLICY: SHIPPED_MIX_POLICY,
    renderView: renderView,
    revisionKey: revisionKey,
    poolFrom: poolFrom,
    novel: novel,
    matchReason: matchReason,
    mixPrefersRecord: mixPrefersRecord,
    selectLesson: selectLesson,
    preferredLevelFor: preferredLevelFor,
    selectWaitLessons: selectWaitLessons,
    localPreInterpretRiskFacts: localPreInterpretRiskFacts,
    normalizeCompleteSeen: normalizeCompleteSeen,
    FETCH_MORE_WHEN_UNSEEN_BELOW: FETCH_MORE_WHEN_UNSEEN_BELOW,
    selectChoreographyLessons: selectChoreographyLessons,
    advanceCompleteCycle: advanceCompleteCycle,
    hookLintClean: hookLintClean,
    bindingLineFor: bindingLineFor
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoLessonEngineV5;
if (typeof window !== "undefined") window.OMonoLessonEngineV5 = OMonoLessonEngineV5;
else if (typeof globalThis !== "undefined") globalThis.OMonoLessonEngineV5 = OMonoLessonEngineV5;
