"use strict";
/* O'Mono lesson growth (R1-R11). The founding canon is a SEED. It carries the
 * first days of use and then stops being the whole of what a person holds: from
 * there the working set grows out of the record, so literacy compounds instead
 * of repeating a fixed list.
 *
 * This module is the part of that loop worth asserting: given a summary of the
 * record and the working set already held, it says what teaching is missing,
 * in what order, and how much of it may be added at once. It writes no lesson
 * text — the refresh call does that, under the gate — and it never sees prompt
 * content, a person, or a client. Counts and canonical identifiers only.
 *
 * Pure: no DOM, no storage, no timers, no network, no clock. The caller passes
 * the record in and the candidates back.
 *
 * Browser-safe: IIFE, dual export, loader-free by the module contract that
 * tests/teaching/module-contract.test.js enforces. */
var OMonoLessonGrowthV5 = (function () {

  /* ---------- R5: volume ----------
     How many lessons one refresh may add. Growth is steady, not sudden: a heavy
     week produces a long list of needs and still teaches three things, because
     the constraint on learning is the person's attention and not the size of
     the backlog. A named constant, stated in the run report, never a setting. */
  /* Raised from 3 on the owner's instruction: the refresh runs on the first
     open of each day and gets a visible "refreshing" screen, so a longer pass
     is affordable and three a day was never going to keep the wait line fresh.
     Twenty-five lessons is about 1,500 tokens against a refresh budget of
     8,000, so size is not the constraint.

     Worth knowing: this cap is not what limits the daily yield. `wanted` is
     min(cap, needs), and needs come from the person's own record. Raising the
     cap removes an artificial ceiling; it does not manufacture gaps that the
     record has not shown. */
  var MAX_NEW_LESSONS_PER_REFRESH = 25;

  /* How much evidence a single need must carry before it is worth a lesson.
     One bad afternoon is not a curriculum. */
  /* RETIRED on the owner's instruction; kept as a record of what was removed.
     Nothing reads it. See the note in add(). */
  var MIN_OCCURRENCES_RETIRED = 2;

  /* When a domain has been taught enough at the level the record is ready for.
     This is what makes growth compound rather than run away: a need is a need
     only while the working set does not yet answer it. Two lessons at a level,
     and the level itself promotes as they land, so a domain deepens through
     foundational, intermediate and advanced and then stops. Without this the
     same failure category produced a lesson every single day forever — measured
     at 403 lessons for one person in six months, which is not teaching, it is
     flooding. */
  /* RETIRED on the owner's instruction; kept as a record of what was removed.
     Nothing reads it. See the note in add(). */
  var ENOUGH_PER_LEVEL_RETIRED = 2;

  /* R7: the enterprise floor. shared/evidence/suppression.js is main-process
     only and this module is renderer-loadable, so the number is mirrored here
     and pinned to its source by tests/engine-fix/phase2.test.js. A need that
     fewer than this many distinct installations produced cannot become a
     deployment lesson, because a lesson minted for one person's mistake and
     shown to forty is that person's work made public. */
  var COHORT_FLOOR_MIRROR = 5;

  /* A combined deployment record earns a new daily curriculum, separate from
     the personal seed. This is an admission target, not an active-set cap:
     anything unavailable must carry one of the two explicit retirement
     authorities below. */
  var ENTERPRISE_DAILY_ADMISSION_TARGET = 150;

  /* Owner ruling, 2026-09-17: the founding lessons are only the first feed.
     Personal mode brings this many new lessons every day, the record's own
     gaps first and the rest spread across all eighteen areas, whether or not
     the record points at them. Bounded by MAX_NEW_LESSONS_PER_REFRESH. */
  var PERSONAL_DAILY_NEW_LESSONS = 25;
  var ENTERPRISE_RETIREMENT_REASONS = ["administrator", "enterprise_exhaustion"];
  var ENTERPRISE_IDENTITY_KEY = /(^|_)(actor|user|users|device|devices|email|mail|host|hostname|machine|install|installation|account|accounts|username|login|person|owner|serial|udid|imei|mac|ip|fingerprint|seat)(_|$)/i;

  /* ---------- R3: where new lessons come from ----------
     Five sources, in the order the refresh reads them. The order is the ruled
     selection order of the lesson engine extended one step: what this
     destination makes likely, what the record keeps getting wrong, what the
     person keeps leaving out, where the teaching is thin, and what happened
     when a safeguard came off. */
  var SOURCES = ["destination_quirk", "repeated_failure", "skipped_field",
    "thin_domain", "safeguard_pair"];
  var SOURCE_RANK = { destination_quirk: 0, repeated_failure: 1, skipped_field: 2,
    thin_domain: 3, safeguard_pair: 4, daily_growth: 5 };

  /* Which of the eight canon fields a skip points at, and the domain whose
     teaching answers it. Honest mappings only: a field with no honest home
     produces no need rather than a stretched one. */
  var SKIP_DOMAIN = {
    input: "reliability_and_confabulation",
    examples: "model_behavior_and_uncertainty",
    role: "human_ai_interaction_and_automation_bias",
    context: "privacy_and_data_protection",
    format: "model_behavior_and_uncertainty",
    constraints: "human_oversight_and_decision_making"
  };

  /* A destination trait and the domain whose teaching covers what it makes
     likely. The dossiers name the tool's own risks; these are the domains those
     risks live in. */
  var TRAIT_DOMAIN = {
    tools: "agentic_systems_and_tool_autonomy",
    reasoning: "transparency_and_explanation_limits",
    web: "reliability_and_confabulation",
    files: "confidentiality_and_privilege",
    unverified: "model_behavior_and_uncertainty"
  };

  var FAILURE_DOMAIN = {
    "failure.invented_source": "reliability_and_confabulation",
    "failure.stale_data": "data_provenance_and_training_data",
    "failure.too_generic": "model_behavior_and_uncertainty",
    "failure.wrong_format": "model_behavior_and_uncertainty",
    "failure.missing_context": "reliability_and_confabulation",
    "failure.overconfident": "human_ai_interaction_and_automation_bias",
    "failure.leaked_material": "privacy_and_data_protection"
  };

  var SAFEGUARD_DOMAIN = "human_oversight_and_decision_making";

  function num(value) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function obj(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function list(value) { return Array.isArray(value) ? value : []; }

  function cleanId(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function positiveCount(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function containsIdentityKey(value) {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(containsIdentityKey);
    return Object.keys(value).some(function (key) {
      return ENTERPRISE_IDENTITY_KEY.test(key) || containsIdentityKey(value[key]);
    });
  }

  function activeLessons(workingSet) {
    var byId = {};
    list(workingSet).forEach(function (lesson) {
      if (!lesson || !lesson.lesson_id || lesson.retired === true
          || lesson.retired_duplicate === true || lesson.status === "retired"
          || lesson.status === "retired_duplicate") return;
      var current = byId[lesson.lesson_id];
      if (!current || positiveCount(lesson.version) >= positiveCount(current.version)) {
        byId[lesson.lesson_id] = lesson;
      }
    });
    return Object.keys(byId).sort().map(function (id) { return byId[id]; });
  }

  function dayString(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var exact = new Date(value + "T00:00:00.000Z");
      return Number.isFinite(exact.getTime())
        && exact.toISOString().slice(0, 10) === value ? value : "";
    }
    var date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function enterpriseDay(day, period, now) {
    var value = dayString(day);
    var today = dayString(now);
    var start = dayString(period && period.start);
    var end = dayString(period && period.end);
    if (!value || !today || value > today) return "";
    if (start && value < start) return "";
    if (end && value > end) return "";
    return value;
  }

  /* ---------- what the working set already covers ---------- */

  /* The working set is what the person or the deployment actually holds: the
     seed plus everything the record has since produced, minus what was retired.
     Coverage is by domain and by concept, because a need is only a need when
     nothing already teaches it. */
  function coverageOf(workingSet) {
    var domains = {};
    var concepts = {};
    var levels = {};
    list(workingSet).forEach(function (lesson) {
      if (!lesson || lesson.retired_duplicate === true || lesson.retired === true) return;
      var domain = String(lesson.domain || "");
      var concept = String(lesson.concept || "");
      if (domain) {
        domains[domain] = (domains[domain] || 0) + 1;
        levels[domain] = levels[domain] || {};
        var level = String(lesson.level || "foundational");
        levels[domain][level] = (levels[domain][level] || 0) + 1;
      }
      if (concept) concepts[concept] = (concepts[concept] || 0) + 1;
    });
    return { domains: domains, concepts: concepts, levels: levels,
      size: Object.keys(concepts).length };
  }

  /* The level a need should be pitched at: a domain with nothing gets
     foundational, a domain with foundational material gets intermediate, and so
     on. Depth is earned, never skipped to — the same rule the selector uses. */
  function levelFor(coverage, domain) {
    var cell = obj(obj(coverage.levels)[domain]);
    if (num(cell.intermediate) >= 2) return "advanced";
    if (num(cell.foundational) >= 2) return "intermediate";
    return "foundational";
  }

  /* ---------- R3: the needs ---------- */

  /* `record` is counts and canonical ids, nothing else:
       generations                number
       by_destination_trait       { trait: count }
       dossier_topics             [{ tool_id, trait }]      what the dossiers name
       by_failure_category        { failure.x: count }
       by_skipped_field           { role|task|…: count }
       by_domain_taught           { domain: count }         what has been shown
       pairs_removed              number
       distinct_sources           { key: count }            enterprise only
     `options`: { scope: "personal"|"enterprise", floor, max } */
  function needsFrom(record, workingSet, options) {
    var r = obj(record);
    var o = obj(options);
    var enterprise = o.scope === "enterprise";
    var floor = num(o.floor) || COHORT_FLOOR_MIRROR;
    var coverage = coverageOf(workingSet);
    var distinct = obj(r.distinct_sources);
    var needs = [];

    function add(source, key, count, domain, why) {
      if (!domain) return;                       /* no honest home, no need */
      /* Two gates removed on the owner's instruction.

         The first required a thing to happen twice before it counted as a need
         at all. The second stopped a topic being a need once the working set
         held two lessons at the current level.

         Together they meant a settled record produced no needs whatever, so the
         refresh added nothing on most days regardless of its cap. Measured on
         the shipped canon against a plain record: zero needs. The ruling is
         that the refresh should be eager, and that the wait line staying fresh
         matters more than waiting for a pattern to prove itself.

         The level is still computed, because a need still has to say which
         level it is asking for. It no longer suppresses anything. */
      var level = levelFor(coverage, domain);
      /* R7: a deployment lesson has to come from the deployment, not from one
         desk. Below the floor the need is dropped and the reason recorded. */
      if (enterprise && num(distinct[key]) < floor) {
        needs.push({ source: source, key: key, count: count, domain: domain,
          level: level, why: why, suppressed: true,
          suppressed_because: "fewer than " + floor + " distinct installations produced it",
          already_taught: num(coverage.domains[domain]) });
        return;
      }
      needs.push({ source: source, key: key, count: count, domain: domain,
        level: level, why: why, suppressed: false,
        already_taught: num(coverage.domains[domain]) });
    }

    /* 1. Destination quirks the dossiers name and no lesson teaches. */
    var namedTraits = {};
    list(r.dossier_topics).forEach(function (topic) {
      var trait = String(obj(topic).trait || "");
      if (trait) namedTraits[trait] = (namedTraits[trait] || 0) + 1;
    });
    Object.keys(obj(r.by_destination_trait)).forEach(function (trait) {
      if (!namedTraits[trait]) return;           /* no dossier names it */
      var domain = TRAIT_DOMAIN[trait];
      if (!domain) return;
      add("destination_quirk", trait, num(r.by_destination_trait[trait]), domain,
        "The tools in use put this in front of the person and the working set "
        + "teaches it thinly or not at all.");
    });

    /* 2. Failure categories that recur in the outcome record. */
    Object.keys(obj(r.by_failure_category)).forEach(function (category) {
      var domain = FAILURE_DOMAIN[category];
      add("repeated_failure", category, num(r.by_failure_category[category]), domain,
        "This is what the record says keeps going wrong.");
    });

    /* 3. Fields that keep being skipped. */
    Object.keys(obj(r.by_skipped_field)).forEach(function (field) {
      var domain = SKIP_DOMAIN[field];
      add("skipped_field", field, num(r.by_skipped_field[field]), domain,
        "This field is left out again and again, and that is the opening the "
        + "failure it invites comes through.");
    });

    /* 4. Domains and levels with thin or absent coverage. A domain the record
       keeps touching and the working set barely teaches. */
    Object.keys(obj(r.by_domain_taught)).forEach(function (domain) {
      var held = num(coverage.domains[domain]);
      add("thin_domain", domain, num(r.by_domain_taught[domain]), domain,
        held ? "One lesson stands for this whole domain."
          : "The record keeps landing here and nothing teaches it.");
    });

    /* 5. Safeguard pairs: a safeguard came off and the work then failed. */
    /* One is enough now, per the same ruling: a safeguard coming off and the
       work then failing is worth teaching the first time it happens. */
    if (num(r.pairs_removed) >= 1) {
      add("safeguard_pair", "safeguard_removed_then_failed", num(r.pairs_removed),
        SAFEGUARD_DOMAIN,
        "A protection was taken out of the prompt and the answer then did not "
        + "hold up.");
    }

    needs.sort(function (a, b) {
      if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
      var rank = SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
      if (rank !== 0) return rank;
      if (b.count !== a.count) return b.count - a.count;
      return a.key < b.key ? -1 : 1;
    });
    return needs;
  }

  /* ---------- the brief the refresh call is given ---------- */

  /* Everything below is counts, canonical ids and O'Mono's own plain sentences.
     Nothing a person wrote, nothing a client owns, no identity, and — in
     enterprise — nothing below the suppression floor. */
  /* Every phenomenon O'Mono can already say out loud. A candidate naming
     anything else would reach a person as a raw machine key, because the
     binding line falls back to the identifier — so the vocabulary travels with
     the brief and the gate enforces it. Without this the model guesses, and a
     guess is a discarded day of growth. */
  function allowedConcepts(names) {
    var dictionary = names || (function () {
      var root = (typeof globalThis !== "undefined" && globalThis) || {};
      return root.OMonoDisplayNames;
    })();
    return Object.keys(obj(dictionary && dictionary.CONCEPTS)).sort();
  }

  function buildBrief(record, workingSet, options) {
    var o = obj(options);
    var cap = num(o.max) || MAX_NEW_LESSONS_PER_REFRESH;
    var all = needsFrom(record, workingSet, options);
    var live = all.filter(function (n) { return !n.suppressed; });
    var coverage = coverageOf(workingSet);
    var needs = live.slice(0, Math.min(cap, live.length));
    var target = o.scope === "enterprise" ? 0 : Math.min(cap, num(o.daily_target));
    if (needs.length < target) {
      needs = needs.concat(dailyGrowthNeeds(coverage, target - needs.length, o.names));
    }
    var wanted = needs.length;
    return {
      schema: "omono.growth-brief.v1",
      scope: o.scope === "enterprise" ? "enterprise" : "personal",
      generations: num(obj(record).generations),
      working_set_size: coverage.size,
      covered_domains: Object.keys(coverage.domains).sort(),
      covered_concepts: Object.keys(coverage.concepts).sort(),
      allowed_concepts: allowedConcepts(o.names),
      wanted: wanted,
      max_per_refresh: cap,
      needs: needs,
      deferred: live.slice(Math.min(cap, live.length)).map(summarize),
      suppressed: all.filter(function (n) { return n.suppressed; }).map(summarize)
    };
  }
  /* Daily growth places, round-robin across the eighteen areas, the areas the
     working set holds least of first, so every area keeps receiving lessons.
     Each place is its own need: several may share an area on a busy day. */
  function dailyGrowthNeeds(coverage, count, names) {
    var dictionary = names || (function () {
      var root = (typeof globalThis !== "undefined" && globalThis) || {};
      return root.OMonoDisplayNames;
    })();
    var domains = Object.keys(obj(dictionary && dictionary.DOMAINS)).sort(function (a, b) {
      var held = num(coverage.domains[a]) - num(coverage.domains[b]);
      return held !== 0 ? held : (a < b ? -1 : 1);
    });
    var out = [];
    for (var i = 0; domains.length && out.length < count; i += 1) {
      var domain = domains[i % domains.length];
      var round = Math.floor(i / domains.length) + 1;
      out.push({ source: "daily_growth", key: domain + "#" + round, count: 0,
        domain: domain, level: levelFor(coverage, domain),
        why: "Daily growth: every area keeps receiving new lessons, whether or not "
          + "the record points at it.",
        suppressed: false, already_taught: num(coverage.domains[domain]) });
    }
    return out;
  }

  function summarize(need) {
    return { source: need.source, key: need.key, count: need.count,
      domain: need.domain, suppressed_because: need.suppressed_because || null };
  }

  /* ---------- enterprise daily planning ----------
     This path consumes the already-suppressed, combined deployment record. It
     never counts the personal founding seed as enterprise-created curriculum.
     A day is complete only after 150 distinct stable ids have been admitted. */
  function relationshipDomain(row, lessonById) {
    var lessonIds = list(row && row.lesson_ids).map(cleanId).filter(Boolean).sort();
    for (var i = 0; i < lessonIds.length; i += 1) {
      var lesson = lessonById[lessonIds[i]];
      if (lesson && lesson.domain) return lesson.domain;
    }
    var failure = cleanId(row && row.failure_category);
    if (FAILURE_DOMAIN[failure]) return FAILURE_DOMAIN[failure];
    if (list(row && row.safeguards).some(function (item) {
      return cleanId(item && item.id);
    })) return SAFEGUARD_DOMAIN;
    return "";
  }

  function relationshipSignal(row) {
    var failure = cleanId(row && row.failure_category);
    if (failure) return { type: "failure", id: failure };
    var ordered = [
      ["risk", row && row.risk_ids],
      ["competency", row && row.competency_ids]
    ];
    for (var i = 0; i < ordered.length; i += 1) {
      var ids = list(ordered[i][1]).map(cleanId).filter(Boolean).sort();
      if (ids.length) return { type: ordered[i][0], id: ids[0] };
    }
    var safeguards = list(row && row.safeguards).map(function (item) {
      return cleanId(item && item.id);
    }).filter(Boolean).sort();
    if (safeguards.length) return { type: "safeguard", id: safeguards[0] };
    var dependency = cleanId(row && row.source_dependency);
    if (dependency && dependency !== "none") {
      return { type: "source_dependency", id: dependency };
    }
    var lessons = list(row && row.lesson_ids).map(cleanId).filter(Boolean).sort();
    if (lessons.length) return { type: "lesson", id: lessons[0] };
    var taskFamily = cleanId(row && row.task_family);
    return taskFamily ? { type: "task_family", id: taskFamily } : null;
  }

  function enterprisePatternKey(taskFamily, domain, signal) {
    return [taskFamily, domain, signal.type, signal.id].map(cleanId).join("|");
  }

  function compareEnterprisePattern(a, b) {
    return b.allocation_weight - a.allocation_weight
      || b.records - a.records || b.report_files - a.report_files
      || a.need_pattern_key.localeCompare(b.need_pattern_key);
  }

  function enterpriseLessonMeta(lesson) {
    var key = cleanId(lesson && lesson.need_key);
    var pattern = cleanId(lesson && lesson.need_pattern_key);
    var slot = positiveCount(lesson && lesson.need_slot);
    var day = dayString(lesson && lesson.enterprise_day);
    var match = key.match(/^(.*)\|lesson:(\d+)$/);
    if (!pattern && match) pattern = match[1];
    if (!slot && match) slot = positiveCount(match[2]);
    if (!key || !pattern || !slot || !day) return null;
    return { need_key: key, need_pattern_key: pattern, need_slot: slot,
      enterprise_day: day };
  }

  function buildEnterpriseDailyBrief(cohort, lessonRecords, options) {
    var safeCohort = obj(cohort);
    var safeOptions = obj(options);
    /* The merged cohort stores event timestamps. A reporting period is a local
       calendar decision, so its inclusive day bounds must be supplied rather
       than inferred by converting those timestamps through UTC. */
    var explicitPeriod = obj(safeOptions.period);
    var hasExplicitPeriod = typeof explicitPeriod.start === "string"
      && dayString(explicitPeriod.start) === explicitPeriod.start
      && typeof explicitPeriod.end === "string"
      && dayString(explicitPeriod.end) === explicitPeriod.end;
    var period = hasExplicitPeriod ? explicitPeriod : {};
    var day = enterpriseDay(safeOptions.day, period, safeOptions.now);
    var reportFiles = positiveCount(safeCohort.contributors);
    var records = positiveCount(obj(safeCohort.volume).records);
    var problems = [];
    if (safeCohort.schema !== "omono.firm-cohort.v3") {
      problems.push("not_a_combined_enterprise_record");
    }
    if (containsIdentityKey(safeCohort)) problems.push("combined_record_contains_identity");
    if (safeCohort.enough !== true) problems.push("combined_record_below_floor");
    if (positiveCount(safeCohort.floor) < COHORT_FLOOR_MIRROR) {
      problems.push("combined_record_floor_invalid");
    }
    if (!hasExplicitPeriod) problems.push("explicit_enterprise_period_required");
    if (!day) problems.push("day_outside_combined_record");
    if (safeCohort.contributors_are !== "report_files") {
      problems.push("contributors_are_not_report_files");
    }
    if (reportFiles < COHORT_FLOOR_MIRROR) problems.push("below_report_file_floor");

    var lessonById = {};
    list(lessonRecords).forEach(function (lesson) {
      if (lesson && lesson.lesson_id) lessonById[lesson.lesson_id] = lesson;
    });

    /* Count stable enterprise ids, including unavailable ids. Retirement does
       not create a replacement quota, and a higher revision is still one id. */
    var enterpriseById = {};
    var existingByPattern = {};
    var existingTodayByPattern = {};
    var existingTodayDomains = {};
    var nextSlotByPattern = {};
    list(lessonRecords).forEach(function (lesson) {
      if (!lesson || !lesson.lesson_id) return;
      var meta = enterpriseLessonMeta(lesson);
      if (!meta) return;
      var current = enterpriseById[lesson.lesson_id];
      if (!current || positiveCount(lesson.version) >= positiveCount(current.lesson.version)) {
        enterpriseById[lesson.lesson_id] = { lesson: lesson, meta: meta };
      }
    });
    Object.keys(enterpriseById).forEach(function (id) {
      var lesson = enterpriseById[id].lesson;
      var meta = enterpriseById[id].meta;
      existingByPattern[meta.need_pattern_key]
        = (existingByPattern[meta.need_pattern_key] || 0) + 1;
      if (meta.enterprise_day === day) {
        existingTodayByPattern[meta.need_pattern_key]
          = (existingTodayByPattern[meta.need_pattern_key] || 0) + 1;
        if (lesson.domain) existingTodayDomains[lesson.domain] = true;
      }
      nextSlotByPattern[meta.need_pattern_key]
        = Math.max(nextSlotByPattern[meta.need_pattern_key] || 0, meta.need_slot);
    });

    var retirementById = {};
    var refusedRetirements = [];
    list(safeOptions.retirements).forEach(function (retirement) {
      var id = cleanId(retirement && retirement.lesson_id);
      var storedReason = cleanId(retirement && retirement.reason);
      var by = cleanId(retirement && retirement.by);
      var reason = storedReason === "firm" && by === "administrator"
        ? "administrator" : storedReason;
      if (!id || ENTERPRISE_RETIREMENT_REASONS.indexOf(reason) === -1) {
        refusedRetirements.push({ lesson_id: id || null, reason: storedReason || null });
        return;
      }
      retirementById[id] = reason;
    });
    var unavailableByReason = { administrator: 0, enterprise_exhaustion: 0 };
    var availableTotal = 0;
    Object.keys(enterpriseById).forEach(function (id) {
      var lesson = enterpriseById[id].lesson;
      var reason = retirementById[id] || cleanId(lesson.retirement_reason);
      if (ENTERPRISE_RETIREMENT_REASONS.indexOf(reason) > -1) {
        unavailableByReason[reason] += 1;
      } else {
        availableTotal += 1;
      }
    });

    var patternsByKey = {};
    list(obj(safeCohort.curriculum_evidence).relationships).forEach(function (row) {
      var relationshipReportFiles = positiveCount(row && row.report_files);
      var taskFamily = cleanId(row && row.task_family);
      var domain = relationshipDomain(row, lessonById);
      var signal = relationshipSignal(row);
      if (relationshipReportFiles < COHORT_FLOOR_MIRROR
          || !taskFamily || !domain || !signal) return;
      var patternKey = enterprisePatternKey(taskFamily, domain, signal);
      var relationshipRecords = positiveCount(row && row.records);
      if (!relationshipRecords) return;
      var current = patternsByKey[patternKey];
      if (!current) {
        current = patternsByKey[patternKey] = {
          need_pattern_key: patternKey,
          task_family: taskFamily,
          domain: domain,
          signal_type: signal.type,
          signal_id: signal.id,
          records: 0,
          report_files: 0,
          allocation_weight: 0,
          coverage_requirement: false
        };
      }
      current.records += relationshipRecords;
      current.allocation_weight += relationshipRecords;
      /* Relationship rows do not expose report-file ids, so summing would
         double count files that produced more than one relationship. */
      current.report_files = Math.max(current.report_files, relationshipReportFiles);
    });

    var expectedDomains = {};
    list(safeOptions.domains).forEach(function (domain) {
      domain = cleanId(domain);
      if (domain) expectedDomains[domain] = true;
    });
    if (!Object.keys(expectedDomains).length) {
      list(lessonRecords).forEach(function (lesson) {
        var domain = cleanId(lesson && lesson.domain);
        if (domain) expectedDomains[domain] = true;
      });
    }
    var patterns = Object.keys(patternsByKey).map(function (key) {
      return patternsByKey[key];
    }).sort(compareEnterprisePattern);
    var reachableDomains = {};
    patterns.forEach(function (pattern) { reachableDomains[pattern.domain] = true; });
    var coverageDomains = Object.keys(expectedDomains).filter(function (domain) {
      return !reachableDomains[domain];
    }).sort();
    /* A domain with no visible relationship is still part of the enterprise
       curriculum. Give it one explicit coverage pattern rather than pretending
       the record contained a behavior signal or blocking every other lesson.
       Its weight is one, so it receives the required daily place before the
       remaining places follow actual record volume. */
    coverageDomains.forEach(function (domain) {
      var key = ["enterprise_curriculum", domain, "coverage", "all_18_areas"]
        .map(cleanId).join("|");
      patterns.push({
        need_pattern_key: key,
        task_family: "enterprise_curriculum",
        domain: domain,
        signal_type: "coverage",
        signal_id: "all_18_areas",
        records: 0,
        report_files: reportFiles,
        allocation_weight: 1,
        coverage_requirement: true,
        evidence_line: "The enterprise curriculum keeps all 18 areas reachable; "
          + "this area had no visible relationship pattern in the combined record."
      });
      reachableDomains[domain] = true;
    });
    patterns.sort(compareEnterprisePattern);
    var unreachableDomains = Object.keys(expectedDomains).filter(function (domain) {
      return !reachableDomains[domain];
    }).sort();

    var createdTotal = Object.keys(enterpriseById).length;
    var admittedToday = Object.keys(enterpriseById).filter(function (id) {
      return enterpriseById[id].meta.enterprise_day === day;
    }).length;
    var wanted = problems.length || !patterns.length ? 0
      : Math.max(0, ENTERPRISE_DAILY_ADMISSION_TARGET - admittedToday);
    var totalWeight = patterns.reduce(function (sum, pattern) {
      return sum + pattern.allocation_weight;
    }, 0);
    var allocations = {};
    var selected = [];

    function addForPattern(pattern) {
      var patternKey = pattern.need_pattern_key;
      allocations[patternKey] = (allocations[patternKey] || 0) + 1;
      nextSlotByPattern[patternKey] = (nextSlotByPattern[patternKey] || 0) + 1;
      var slot = nextSlotByPattern[patternKey];
      selected.push({
        need_key: patternKey + "|lesson:" + slot,
        need_pattern_key: patternKey,
        need_slot: slot,
        enterprise_day: day,
        admission_sequence: admittedToday + selected.length + 1,
        task_family: pattern.task_family,
        domain: pattern.domain,
        signal_type: pattern.signal_type,
        signal_id: pattern.signal_id,
        records: pattern.records,
        report_files: pattern.report_files,
        evidence_line: pattern.evidence_line || (pattern.records
          + " records across at least " + pattern.report_files
          + " report files in the combined record.")
      });
    }

    /* Every supported area gets a place each day before an area repeats. The
       remaining admissions follow the combined record's pattern weights. */
    var domainFirst = {};
    patterns.forEach(function (pattern) {
      if (!domainFirst[pattern.domain]) domainFirst[pattern.domain] = pattern;
    });
    Object.keys(domainFirst).sort(function (a, b) {
      return compareEnterprisePattern(domainFirst[a], domainFirst[b])
        || a.localeCompare(b);
    }).forEach(function (domain) {
      if (selected.length >= wanted || existingTodayDomains[domain]) return;
      addForPattern(domainFirst[domain]);
      existingTodayDomains[domain] = true;
    });

    var finalAcceptedToday = admittedToday + wanted;
    while (selected.length < wanted) {
      var best = patterns.slice().sort(function (a, b) {
        var aDeficit = totalWeight
          ? (a.allocation_weight / totalWeight) * finalAcceptedToday
            - ((existingTodayByPattern[a.need_pattern_key] || 0)
              + (allocations[a.need_pattern_key] || 0)) : 0;
        var bDeficit = totalWeight
          ? (b.allocation_weight / totalWeight) * finalAcceptedToday
            - ((existingTodayByPattern[b.need_pattern_key] || 0)
              + (allocations[b.need_pattern_key] || 0)) : 0;
        return bDeficit - aDeficit
          || compareEnterprisePattern(a, b);
      })[0];
      if (!best) break;
      addForPattern(best);
    }

    return {
      schema: "omono.enterprise-daily-growth-brief.v1",
      scope: "enterprise_daily",
      day: day || null,
      report_files: reportFiles,
      report_files_are_users: safeOptions.one_report_file_per_user === true,
      users: safeOptions.one_report_file_per_user === true ? reportFiles : null,
      records: records,
      floor: COHORT_FLOOR_MIRROR,
      daily_admission_target: ENTERPRISE_DAILY_ADMISSION_TARGET,
      admitted_today: admittedToday,
      enterprise_created_total: createdTotal,
      enterprise_available_total: availableTotal,
      enterprise_unavailable_total: createdTotal - availableTotal,
      retirement: {
        permitted_reasons: ENTERPRISE_RETIREMENT_REASONS.slice(),
        by_reason: unavailableByReason,
        refused: refusedRetirements
      },
      wanted: selected.length,
      needs: selected,
      supported_patterns: patterns.map(function (pattern) {
        return {
          need_pattern_key: pattern.need_pattern_key,
          domain: pattern.domain,
          records: pattern.records,
          report_files: pattern.report_files,
          coverage_requirement: pattern.coverage_requirement === true,
          existing_lessons: existingByPattern[pattern.need_pattern_key] || 0,
          admitted_today: existingTodayByPattern[pattern.need_pattern_key] || 0,
          allocated_now: allocations[pattern.need_pattern_key] || 0
        };
      }),
      reachable_domains: Object.keys(reachableDomains).sort(),
      unreachable_domains: unreachableDomains,
      coverage_domains: coverageDomains,
      allowed_concepts: allowedConcepts(safeOptions.names),
      problems: problems
    };
  }

  function contentFingerprint(lesson) {
    function normalized(value) {
      return typeof value === "string"
        ? value.toLowerCase().replace(/\s+/g, " ").trim() : "";
    }
    var straight = obj(obj(lesson).tones).straight || {};
    return [obj(lesson).domain, obj(lesson).level, obj(lesson).takeaway,
      straight.hook, straight.mechanism, straight.consequence]
      .map(normalized).join("|");
  }

  /* ---------- R4: the gate ----------
     A candidate passes only if it names a phenomenon the display dictionary can
     say out loud, sits in one of the eighteen domains, carries a mechanism, a
     consequence and a source, and survives the jargon lint. There is no
     softening step: a candidate that fails is discarded and counted. */
  function gate(candidates, deps) {
    var d = obj(deps);
    var schema = d.schema;                       /* OMonoLessonSchemaV5 */
    var names = d.names;                         /* OMonoDisplayNames */
    var held = {};
    var heldEnterpriseNeedOwner = {};
    var heldEnterpriseContentOwner = {};
    list(d.workingSet).forEach(function (lesson) {
      if (!lesson || !lesson.lesson_id) return;
      var version = Number(lesson.version);
      if (!Number.isInteger(version) || version < 1) return;
      held[lesson.lesson_id] = Math.max(held[lesson.lesson_id] || 0, version);
    });
    activeLessons(d.workingSet).forEach(function (lesson) {
      var key = cleanId(lesson.need_key);
      if (!key) return;
      heldEnterpriseNeedOwner[key] = lesson.lesson_id;
      heldEnterpriseContentOwner[contentFingerprint(lesson)] = lesson.lesson_id;
    });
    var enterpriseBatch = list(candidates).some(function (candidate) {
      return Boolean(cleanId(candidate && candidate.need_key));
    });
    var cap = num(d.max) || (enterpriseBatch
      ? ENTERPRISE_DAILY_ADMISSION_TARGET : MAX_NEW_LESSONS_PER_REFRESH);
    var accepted = [];
    var discarded = [];
    list(candidates).forEach(function (candidate) {
      var id = candidate && candidate.lesson_id ? String(candidate.lesson_id) : null;
      function reject(reason, problems) {
        discarded.push({ lesson_id: id, reason: reason, problems: problems || [] });
      }
      /* Validity first, THEN volume. A broken candidate is discarded because it
         is broken; discarding it as over-cap would put the wrong reason in the
         record and hide a systematic authoring problem behind a quota. */
      if (!candidate || typeof candidate !== "object") { reject("not_an_object"); return; }
      if (!id) { reject("no_lesson_id"); return; }
      /* A stable id may receive a higher revision. Equal or lower versions are
         stale; the store keeps them unchanged for historical resolution. */
      var candidateVersion = Number(candidate.version);
      if (held[id] && Number.isInteger(candidateVersion)
          && candidateVersion <= held[id]) {
        reject("stale_revision", ["active version is " + held[id]]);
        return;
      }
      /* STAMP THE FRAMEWORK MAPPING.

         The work order put this after the shape and dictionary gates. It cannot
         go there: validateLesson requires a framework mapping, and the model no
         longer sends one, so every candidate would be rejected by the gate that
         was supposed to run before the stamp. It goes here instead, before the
         shape gate that reads it.

         The domain is the candidate's own and is checked one gate later. Where
         it is not one of the eighteen, frameworkForDomain returns null, nothing
         is stamped, and validateLesson rejects the candidate naming the domain
         itself as the problem, which is the true reason.

         The write is unconditional. If a model ever emits a framework object
         despite the wire schema no longer declaring one, the table still wins:
         this field is O'Mono's to state, never the model's to propose. */
      if (schema && typeof schema.frameworkForDomain === "function") {
        var stamped = schema.frameworkForDomain(candidate && candidate.domain);
        if (stamped) candidate.framework = stamped;
      }
      if (schema) {
        var shape = schema.validateLesson(candidate);
        if (!shape.valid) { reject("shape_gate", shape.problems); return; }
        /* R4: for machine candidates the lint is admission, not advice. */
        var lint = schema.hookJargonLint(candidate);
        if (!lint.clean) {
          reject("jargon_lint", lint.hits.map(function (h) { return h.tone + ": " + h.term; }));
          return;
        }
      }
      /* R4: a concept the dictionary cannot name would reach a person as a raw
         machine key, because the binding line falls back to the id. */
      if (names) {
        if (!obj(names.CONCEPTS)[candidate.concept]) {
          reject("concept_not_in_dictionary", [String(candidate.concept)]);
          return;
        }
        if (!obj(names.DOMAINS)[candidate.domain]) {
          reject("domain_not_in_dictionary", [String(candidate.domain)]);
          return;
        }
      }
      /* Enterprise needs may produce several lessons, but each planned slot is
         one stable id and exact lesson copy cannot enter under another id. A
         higher revision of the same id may retain its own need key. */
      var needKey = cleanId(candidate.need_key);
      if (needKey) {
        var needOwner = heldEnterpriseNeedOwner[needKey];
        if (needOwner && needOwner !== id) {
          reject("duplicate_need_key", [needOwner]);
          return;
        }
        var fingerprint = contentFingerprint(candidate);
        var contentOwner = heldEnterpriseContentOwner[fingerprint];
        if (contentOwner && contentOwner !== id) {
          reject("duplicate_content", [contentOwner]);
          return;
        }
      }
      if (accepted.length >= cap) { reject("over_volume_cap"); return; }
      held[id] = candidateVersion;
      if (needKey) {
        heldEnterpriseNeedOwner[needKey] = id;
        heldEnterpriseContentOwner[contentFingerprint(candidate)] = id;
      }
      accepted.push(candidate);
    });
    return { accepted: accepted, discarded: discarded, cap: cap };
  }

  /* What the person is told arrived, in one line. Counts and plain domain
     names; never a source key, never a count of anybody's mistakes. */
  function arrivalLine(accepted, brief, names) {
    var n = list(accepted).length;
    if (!n) return "";
    var domains = {};
    list(accepted).forEach(function (lesson) {
      var domain = String((lesson && lesson.domain) || "");
      if (domain) domains[domain] = true;
    });
    var plain = Object.keys(domains).map(function (id) {
      return names && typeof names.domainName === "function" ? names.domainName(id) : id;
    });
    var count = n === 1 ? "One lesson" : n + " lessons";
    var where = names && typeof names.listOut === "function"
      ? names.listOut(plain) : plain.join(", ");
    var scope = /^enterprise/.test(String(obj(brief).scope || ""))
      ? "this deployment's record" : "your own record";
    return count + " came from " + scope + " today, in " + where + ".";
  }

  var api = {
    MAX_NEW_LESSONS_PER_REFRESH: MAX_NEW_LESSONS_PER_REFRESH,
    /* Both retired. Exported under their retired names so a caller that still
       reads the old ones fails loudly rather than silently reading a number
       nothing enforces. */
    MIN_OCCURRENCES_RETIRED: MIN_OCCURRENCES_RETIRED,
    ENOUGH_PER_LEVEL_RETIRED: ENOUGH_PER_LEVEL_RETIRED,
    COHORT_FLOOR_MIRROR: COHORT_FLOOR_MIRROR,
    ENTERPRISE_DAILY_ADMISSION_TARGET: ENTERPRISE_DAILY_ADMISSION_TARGET,
    PERSONAL_DAILY_NEW_LESSONS: PERSONAL_DAILY_NEW_LESSONS,
    ENTERPRISE_RETIREMENT_REASONS: ENTERPRISE_RETIREMENT_REASONS.slice(),
    SOURCES: SOURCES.slice(),
    SKIP_DOMAIN: SKIP_DOMAIN,
    TRAIT_DOMAIN: TRAIT_DOMAIN,
    FAILURE_DOMAIN: FAILURE_DOMAIN,
    coverageOf: coverageOf,
    levelFor: levelFor,
    allowedConcepts: allowedConcepts,
    needsFrom: needsFrom,
    buildBrief: buildBrief,
    buildEnterpriseDailyBrief: buildEnterpriseDailyBrief,
    gate: gate,
    arrivalLine: arrivalLine
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoLessonGrowthV5;
if (typeof window !== "undefined") window.OMonoLessonGrowthV5 = OMonoLessonGrowthV5;
else if (typeof globalThis !== "undefined") globalThis.OMonoLessonGrowthV5 = OMonoLessonGrowthV5;
