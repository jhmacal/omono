"use strict";
/* O'Mono 3 — embedded AI literacy.

   This module produces teaching DATA and nothing else. It holds no DOM, no fs,
   no network, no policy enforcement, no ledger writing and no prompt assembly.
   Other workstreams consume what it returns.

   It is one file on purpose. The Electron renderer loads shared sources with a
   plain <script src> tag under contextIsolation with no bundler, so `require`
   does not exist there (docs/ARCHITECTURE-V3.md section 4, Contracts section 2).
   A shared module therefore cannot import a sibling. Splitting this domain
   across several files would force either a require call the renderer cannot run,
   or a load-order dependency that fails only at runtime while every CommonJS
   test still passes. One self-contained file with one <script src> and one
   dual export removes that failure mode entirely.

   Contract references below are to docs/INTERFACE-CONTRACTS-V3.md. */

var OMonoTeaching = (function () {

  /* ============================================================ *
   * 1. STABLE IDENTIFIERS — Contracts section 8                   *
   * ============================================================ *
   * Lowercase, dotted, stable across versions. Renaming one is a  *
   * contract change, not a refactor.                              */

  /* The organizing competency. A lesson exists because THIS task created a
     concrete risk; the other five competencies hang off that one. */
  var ORGANIZING_COMPETENCY = "risk.task_specific";

  var COMPETENCIES = [
    "risk.task_specific",              /* recognizing task-specific risks (organizing) */
    "ai.limits",                       /* understanding AI and its limits */
    "review.verify_outputs",           /* reviewing and verifying outputs */
    "instruct.effective",              /* instructing AI effectively */
    "select.systems_uses",             /* selecting appropriate systems and uses */
    "responsibility.human_and_affected" /* human responsibility and affected persons */
  ];

  /* The controlling documents print competency ids as examples that are more
     granular than the frozen six (Contracts section 8 shows
     `review.verify_sources`; the manual section 4.4 shows `risk.source_support`).
     The ledger needs a closed set, so those documented spellings are accepted as
     aliases and resolved to the canonical competency rather than silently
     becoming new ids. */
  var COMPETENCY_ALIASES = {
    "review.verify_sources": "review.verify_outputs",
    "review.verify": "review.verify_outputs",
    "risk.source_support": "risk.task_specific",
    "risk.specific": "risk.task_specific",
    "ai.limitations": "ai.limits",
    "instruct.prompting": "instruct.effective",
    "select.tools": "select.systems_uses",
    "responsibility.human": "responsibility.human_and_affected"
  };

  var TASK_FAMILIES = [
    "legal_research", "drafting", "analysis", "summarization", "translation",
    "coding", "data_extraction", "communication", "planning", "research_general",
    "creative", "decision_support", "image", "other"
  ];

  var TASK_FAMILY_LABELS = {
    legal_research: "legal research",
    drafting: "drafting",
    analysis: "analysis",
    summarization: "summarization",
    translation: "translation",
    coding: "coding",
    data_extraction: "data extraction",
    communication: "communication",
    planning: "planning",
    research_general: "research",
    creative: "creative work",
    decision_support: "decision support",
    image: "image work",
    other: "work"
  };

  var RISKS = [
    /* how a source can fail */
    "source.fabricated_citation",
    "source.real_but_mischaracterized",
    "source.outdated",
    "source.not_authoritative",
    "source.unsupplied_but_assumed",
    /* how the model itself can fail */
    "model.no_live_access",
    "model.no_internal_access",
    "model.confident_but_unverified",
    "model.context_truncation",
    /* how the instruction can fail */
    "input.ambiguous_objective",
    "input.missing_audience",
    "input.missing_constraints",
    "input.unstated_output_shape",
    /* how the output can fail */
    "output.unchecked_calculation",
    "output.overbroad_claim",
    /* how the workflow can fail */
    "workflow.no_verification_step",
    "workflow.safeguard_removed",
    /* how the destination can fail */
    "destination.capability_mismatch",
    "destination.policy_ceiling",
    /* who carries the consequence */
    "responsibility.affected_person",
    "responsibility.human_approval_required"
  ];

  var LESSONS = [
    "lesson.compare_proposition_to_source",
    "lesson.check_every_citation_exists",
    "lesson.supply_the_controlling_text",
    "lesson.name_the_authority_class",
    "lesson.currency_is_not_confidence",
    "lesson.model_has_no_live_access",
    "lesson.model_cannot_open_internal_systems",
    "lesson.fluency_is_not_evidence",
    "lesson.long_input_can_be_silently_cut",
    "lesson.state_the_audience_and_use",
    "lesson.state_the_output_shape",
    "lesson.name_the_constraints_that_bind",
    "lesson.narrow_an_ambiguous_objective",
    "lesson.recompute_every_number",
    "lesson.bound_the_claim_to_evidence",
    "lesson.destination_cannot_do_this",
    "lesson.a_removed_safeguard_repeats_the_failure",
    "lesson.name_the_people_affected",
    "lesson.you_own_the_judgment"
  ];

  var SAFEGUARDS = [
    "safeguard.require_exact_supported_proposition",
    "safeguard.forbid_uncited_authority",
    "safeguard.require_source_bound_answer",
    "safeguard.name_required_authority_class",
    "safeguard.require_effective_date_check",
    "safeguard.state_knowledge_cutoff_limit",
    "safeguard.require_pasted_internal_excerpt",
    "safeguard.require_uncertainty_statement",
    "safeguard.chunk_and_confirm_coverage",
    "safeguard.state_audience_and_use",
    "safeguard.specify_output_structure",
    "safeguard.enumerate_binding_constraints",
    "safeguard.restate_objective_for_confirmation",
    "safeguard.require_shown_calculation",
    "safeguard.bound_claims_to_evidence",
    "safeguard.state_destination_capability_limit",
    "safeguard.restore_removed_safeguard",
    "safeguard.name_affected_persons",
    "safeguard.mark_human_decision_point"
  ];

  var REPAIRS = [
    "repair.ground_in_verified_excerpt",
    "repair.replace_with_verified_authority",
    "repair.attach_controlling_text",
    "repair.reroute_to_authoritative_source",
    "repair.recheck_against_current_source",
    "repair.route_to_live_source",
    "repair.supply_internal_excerpt",
    "repair.request_uncertainty_and_sources",
    "repair.resend_missing_section",
    "repair.restate_audience_and_reissue",
    "repair.restate_output_structure",
    "repair.add_missing_constraint",
    "repair.narrow_the_objective",
    "repair.recompute_from_inputs",
    "repair.narrow_the_claim",
    "repair.change_destination_model",
    "repair.reinstate_safeguard",
    "repair.review_impact_with_owner",
    "repair.escalate_for_human_approval"
  ];

  /* Verification-panel entries. The interpretation schema in the manual prints
     the short keys ("existence", "support", "currency"); the ledger needs a
     stable dotted id. Every check carries both — see sourcePlanKeys(). */
  var CHECKS = [
    "check.source_exists",
    "check.claim_supported",
    "check.quotation_exact",
    "check.currency",
    "check.authority_class",
    "check.completeness",
    "check.calculation_recomputed",
    "check.scope_and_jurisdiction",
    "check.reliance_and_attribution"
  ];

  var CHECK_KEYS = {
    "check.source_exists": "existence",
    "check.claim_supported": "support",
    "check.quotation_exact": "exactness",
    "check.currency": "currency",
    "check.authority_class": "authority",
    "check.completeness": "completeness",
    "check.calculation_recomputed": "recomputation",
    "check.scope_and_jurisdiction": "scope",
    "check.reliance_and_attribution": "attribution"
  };

  var LESSON_TYPES = [
    "risk", "model_input_quality", "useful_fact", "workflow",
    "new_literacy", "source_dependency", "human_responsibility", "fallback"
  ];

  var SOURCE_DEPENDENCY = ["none", "supplied", "live", "authoritative", "citable"];
  var SAFEGUARD_STATES = ["inserted", "retained", "changed", "removed"];
  var OUTCOMES = ["worked", "partly", "failed", "not_evaluated", "unknown"];
  var LESSON_REACTIONS = ["new", "useful_reminder", "already_knew", "not_relevant", "unclear"];
  var SOURCE_CHECK_STATUS = ["supported", "contradicted", "not_found", "incomplete", "requires_different_source"];
  var USE_CONTEXTS = ["personal", "internal", "external", "citable", "filing"];
  var STAKES = ["low", "medium", "high"];

  var FAILURE_CATEGORIES = [
    "source_support_mismatch",
    "fabricated_citation",
    "outdated_source",
    "unverifiable_claim",
    "calculation_error",
    "scope_drift",
    "format_mismatch",
    "truncated_output",
    "refusal_or_block",
    "wrong_destination"
  ];

  var IDS = {
    TASK_FAMILIES: TASK_FAMILIES,
    SOURCE_DEPENDENCY: SOURCE_DEPENDENCY,
    COMPETENCIES: COMPETENCIES,
    RISKS: RISKS,
    LESSONS: LESSONS,
    SAFEGUARDS: SAFEGUARDS,
    SAFEGUARD_STATES: SAFEGUARD_STATES,
    OUTCOMES: OUTCOMES,
    FAILURE_CATEGORIES: FAILURE_CATEGORIES,
    REPAIRS: REPAIRS,
    LESSON_TYPES: LESSON_TYPES,
    CHECKS: CHECKS,
    LESSON_REACTIONS: LESSON_REACTIONS,
    SOURCE_CHECK_STATUS: SOURCE_CHECK_STATUS,
    USE_CONTEXTS: USE_CONTEXTS,
    STAKES: STAKES
  };

  var DICTIONARY_NAMES = Object.keys(IDS);
  var DICTIONARY_SETS = {};
  DICTIONARY_NAMES.forEach(function (name) {
    Object.freeze(IDS[name]);
    DICTIONARY_SETS[name] = IDS[name].reduce(function (set, id) { set[id] = true; return set; }, Object.create(null));
  });
  Object.freeze(IDS);

  function isKnownId(dictionary, id) {
    if (typeof dictionary !== "string" || typeof id !== "string") return false;
    var set = DICTIONARY_SETS[dictionary];
    return set ? set[id] === true : false;
  }

  function idDictionaries() {
    var out = {};
    DICTIONARY_NAMES.forEach(function (name) { out[name] = IDS[name].slice(); });
    return out;
  }

  function canonicalCompetency(id) {
    if (typeof id !== "string" || !id) return null;
    if (DICTIONARY_SETS.COMPETENCIES[id]) return id;
    return Object.prototype.hasOwnProperty.call(COMPETENCY_ALIASES, id) ? COMPETENCY_ALIASES[id] : null;
  }

  function sourceDependencyRank(level) {
    var index = typeof level === "string" ? SOURCE_DEPENDENCY.indexOf(level) : -1;
    return index === -1 ? null : index;
  }

  /* ============================================================ *
   * 2. UNTRUSTED TEXT AND THE CONCISENESS CONTRACT                *
   * ============================================================ *
   * Model output and user input are data, never markup and never  *
   * instructions. Everything that leaves this module is plain     *
   * text with control characters removed and a length ceiling.    *
   * Guidance that does not fit these ceilings is not concise, and *
   * a lesson nobody finishes reading teaches nothing.             */

  var CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g;

  var PART_LIMITS = {
    be_careful: 140,
    why: 220,
    protection_to_add: 220,
    verify_after: 220,
    return_if_failure: 220
  };
  Object.freeze(PART_LIMITS);

  var LESSON_PARTS = ["be_careful", "why", "protection_to_add", "verify_after", "return_if_failure"];
  Object.freeze(LESSON_PARTS);

  function safeText(value, cap) {
    if (typeof value !== "string") return "";
    var text = value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
    var ceiling = typeof cap === "number" && cap > 0 ? cap : 400;
    if (text.length <= ceiling) return text;
    return text.slice(0, ceiling - 1).replace(/\s+\S*$/, "") + "…";
  }

  /* ============================================================ *
   * 3. lesson_type AND THE APPROVED LABEL CATALOG                 *
   * ============================================================ *
   * Contracts section 7.2. The API proposes a canonical           *
   * lesson_type. Local code — here — picks the visible wording.   */

  /* chooseLabel() takes labels[0] unless a caller varies the index, so the FIRST
     entry of each type is what is on screen almost all of the time. Those first
     entries used to be instructions — "Be careful", "Check your sources" — which
     tell the user the answer badly and give them no reason to open the card. A
     closed trigger is the only thing between a person and the lesson behind it,
     so it has to read as an invitation.
     The warning wordings are kept, so anything already validating still does.
     Contracts §7.2 records this catalog; changing it is a contract change and is
     recorded there too. "Click here to learn why" is gone: CLAUDE.md forbids a
     bare click instruction as a label. */
  var LABEL_CATALOG = {
    risk: ["One thing to watch", "Be careful", "Watch for this"],
    model_input_quality: ["This will work better if you", "AI works best", "Help the AI"],
    useful_fact: ["Did you know?", "Worth knowing"],
    workflow: ["Tip", "Quick tip", "Best practice"],
    new_literacy: ["Learn something new", "New insight"],
    source_dependency: ["Before you rely on this", "Source tip", "Check your sources"],
    human_responsibility: ["Your call", "Human judgment"],
    fallback: ["Why this matters", "Open guidance"]
  };
  Object.keys(LABEL_CATALOG).forEach(function (type) { Object.freeze(LABEL_CATALOG[type]); });
  Object.freeze(LABEL_CATALOG);

  var APPROVED_LABELS = Object.create(null);
  Object.keys(LABEL_CATALOG).forEach(function (type) {
    LABEL_CATALOG[type].forEach(function (label) { APPROVED_LABELS[label] = type; });
  });

  /* One short phrase per risk, so a trigger still has an informative accessible
     name when a coaching unit arrives without a usable headline. */
  var RISK_PHRASES = {
    "source.fabricated_citation": "a citation that does not exist",
    "source.real_but_mischaracterized": "a real source described as saying something it does not say",
    "source.outdated": "a source that has since changed",
    "source.not_authoritative": "a source that does not control the question",
    "source.unsupplied_but_assumed": "an answer built on a source you never supplied",
    "model.no_live_access": "an answer written without current information",
    "model.no_internal_access": "an answer written without your internal records",
    "model.confident_but_unverified": "a fluent answer that was never checked",
    "model.context_truncation": "long input that was silently cut",
    "input.ambiguous_objective": "an objective open to more than one reading",
    "input.missing_audience": "an answer written for no particular reader",
    "input.missing_constraints": "a limit the answer must respect but was never told",
    "input.unstated_output_shape": "an answer in a shape you cannot use",
    "output.unchecked_calculation": "a number nobody recomputed",
    "output.overbroad_claim": "a claim wider than the evidence behind it",
    "workflow.no_verification_step": "a result relied on without any check",
    "workflow.safeguard_removed": "a safeguard removed before the same failure returned",
    "destination.capability_mismatch": "a destination that cannot do what this task needs",
    "destination.policy_ceiling": "a destination your policy does not allow for this material",
    "responsibility.affected_person": "someone else who carries the consequence",
    "responsibility.human_approval_required": "a decision that needs a human sign-off"
  };

  function normalizeLessonType(proposed) {
    return (typeof proposed === "string" && DICTIONARY_SETS.LESSON_TYPES[proposed]) ? proposed : "fallback";
  }

  function chooseLabel(lessonType, options) {
    var type = normalizeLessonType(lessonType);
    var labels = LABEL_CATALOG[type];
    var index = options && typeof options.index === "number" && options.index >= 0
      ? Math.floor(options.index) : 0;
    return labels[index % labels.length];
  }

  function isApprovedLabel(label, lessonType) {
    if (typeof label !== "string") return false;
    var owner = APPROVED_LABELS[label];
    if (!owner) return false;
    return typeof lessonType === "string" ? owner === lessonType : true;
  }

  var ACCESSIBLE_NAME_CAP = 160;

  /* "Click here" alone tells a screen-reader user nothing, so the accessible
     name always carries the teaching point as well as the pill wording. */
  function accessibleNameFor(unit) {
    var source = unit || {};
    var type = normalizeLessonType(source.lesson_type);
    var label = isApprovedLabel(source.label, type) ? source.label : chooseLabel(type, { index: 0 });
    var point = safeText(source.be_careful, ACCESSIBLE_NAME_CAP - label.length - 2);
    if (!point) {
      var phrase = RISK_PHRASES[source.risk_id];
      point = phrase ? ("this task can produce " + phrase) : "why O'Mono changed this prompt";
    }
    return label + ": " + point;
  }

  /* The closed pill plus the card behind it. Only these fields cross into the
     interface, so nothing the model wrote about presentation can reach it. */
  function triggerViewModels(units) {
    var list = Array.isArray(units) ? units : [];
    var usedPerType = Object.create(null);
    return list.map(function (source) {
      var raw = source || {};
      var type = normalizeLessonType(raw.lesson_type);
      var seen = usedPerType[type] || 0;
      usedPerType[type] = seen + 1;
      var label = chooseLabel(type, { index: seen });
      var view = {
        lesson_id: isKnownId("LESSONS", raw.lesson_id) ? raw.lesson_id : null,
        lesson_type: type,
        competency_id: canonicalCompetency(raw.competency_id),
        risk_id: isKnownId("RISKS", raw.risk_id) ? raw.risk_id : null,
        materiality: typeof raw.materiality === "number" ? raw.materiality : 0,
        label: label,
        expanded: false,
        card: {}
      };
      LESSON_PARTS.forEach(function (part) {
        view.card[part] = safeText(raw[part], PART_LIMITS[part]);
      });
      view.accessible_name = accessibleNameFor({
        lesson_type: type, label: label, be_careful: view.card.be_careful, risk_id: view.risk_id
      });
      return view;
    });
  }

  /* Contracts section 12: the work event carries canonical ids only. The
     decorative label and every line of lesson prose stay out of it. */
  function ledgerRecordFor(unit) {
    var raw = unit || {};
    var record = {
      lesson_id: isKnownId("LESSONS", raw.lesson_id) ? raw.lesson_id : null,
      lesson_type: normalizeLessonType(raw.lesson_type),
      competency_id: canonicalCompetency(raw.competency_id),
      risk_id: isKnownId("RISKS", raw.risk_id) ? raw.risk_id : null
    };
    if (isKnownId("SAFEGUARDS", raw.safeguard_id)) record.safeguard_id = raw.safeguard_id;
    return record;
  }

  /* ============================================================ *
   * 3b. MATERIALITY AND TRIGGER DENSITY — Contracts section 7.3   *
   * ============================================================ *
   * Three triggers is the budget. The manual is precise about the *
   * exception: an additional trigger appears only when THE EXTRA  *
   * ITEM is itself a hard stop, scores 7-8, or repeats a          *
   * documented failure. A single high score does not widen the    *
   * panel, because a high score already wins a default slot.      */

  var MATERIALITY_BOUNDS = {
    severity: [0, 3],
    task_relevance: [0, 2],
    workflow_effect: [0, 2],
    recurrence: [0, 1]
  };
  Object.keys(MATERIALITY_BOUNDS).forEach(function (part) { Object.freeze(MATERIALITY_BOUNDS[part]); });
  Object.freeze(MATERIALITY_BOUNDS);

  var MATERIALITY_MAX = 8;
  var MATERIALITY_FLOOR = 3;      /* below this an issue is not worth a pill at all */
  var VERY_HIGH_MATERIALITY = 7;
  var DEFAULT_TRIGGER_LIMIT = 3;

  function scoreMateriality(parts) {
    if (!parts || typeof parts !== "object") {
      throw new TypeError("materiality needs the four scored components");
    }
    var total = 0;
    Object.keys(MATERIALITY_BOUNDS).forEach(function (name) {
      var bounds = MATERIALITY_BOUNDS[name];
      var value = parts[name];
      if (value === undefined || value === null) value = 0;
      if (name === "recurrence" && typeof value === "boolean") value = value ? 1 : 0;
      var usable = typeof value === "number" && isFinite(value) && value % 1 === 0
        && value >= bounds[0] && value <= bounds[1];
      if (!usable) {
        throw new RangeError(name + " must be a whole number between " + bounds[0] + " and " + bounds[1]);
      }
      total += value;
    });
    return total;
  }

  function competencyRank(id) {
    var canonical = canonicalCompetency(id);
    var index = canonical === null ? -1 : COMPETENCIES.indexOf(canonical);
    return index === -1 ? COMPETENCIES.length : index;
  }

  function usableMateriality(unit) {
    var score = unit && unit.materiality;
    return typeof score === "number" && isFinite(score) && score % 1 === 0
      && score >= 0 && score <= MATERIALITY_MAX ? score : null;
  }

  /* Why an item is allowed past the default three, or null when it is one of
     the three. The interface shows this so a wider panel is explainable. */
  function beyondDefaultReason(unit) {
    if (unit.hard_stop === true) return "hard_stop";
    if (unit.materiality >= VERY_HIGH_MATERIALITY) return "very_high_materiality";
    if (unit.recurrence === true) return "recurrence";
    return null;
  }

  function selectTriggers(candidates, options) {
    var list = Array.isArray(candidates) ? candidates : [];
    var limit = options && typeof options.limit === "number" ? options.limit : DEFAULT_TRIGGER_LIMIT;
    var floor = options && typeof options.floor === "number" ? options.floor : MATERIALITY_FLOOR;

    var ranked = list
      .filter(function (unit) {
        var score = usableMateriality(unit);
        return score !== null && score >= floor;
      })
      .map(function (unit) {
        var copy = {};
        Object.keys(unit).forEach(function (key) { copy[key] = unit[key]; });
        return copy;
      })
      .sort(function (a, b) {
        if (b.materiality !== a.materiality) return b.materiality - a.materiality;
        var rank = competencyRank(a.competency_id) - competencyRank(b.competency_id);
        if (rank !== 0) return rank;
        return String(a.lesson_id) < String(b.lesson_id) ? -1 : (String(a.lesson_id) > String(b.lesson_id) ? 1 : 0);
      });

    var selected = [];
    ranked.forEach(function (unit, index) {
      if (index < limit) {
        unit.beyond_default_reason = null;
        selected.push(unit);
        return;
      }
      var reason = beyondDefaultReason(unit);
      if (reason) {
        unit.beyond_default_reason = reason;
        selected.push(unit);
      }
    });
    return selected;
  }

  /* ============================================================ *
   * 3c. THE TASK, NORMALIZED                                      *
   * ============================================================ *
   * Interpretation output is untrusted. Everything downstream     *
   * reads this normalized shape, never the raw object.            */

  var CONSEQUENTIAL_DOMAINS = [
    "legal", "medical", "financial", "regulatory", "immigration", "employment", "safety"
  ];
  var CONSEQUENTIAL_FAMILIES = ["legal_research"];
  var CONSEQUENTIAL_CONTEXTS = ["citable", "filing"];

  function oneOf(value, allowed, fallback) {
    return (typeof value === "string" && allowed.indexOf(value) !== -1) ? value : fallback;
  }

  /* An unstated or unrecognized source dependency must never collapse to
     "none" — that would silently delete every source safeguard. It falls back
     to the level the use context already implies, with a floor of "supplied". */
  function assumeSourceDependency(useContext) {
    if (CONSEQUENTIAL_CONTEXTS.indexOf(useContext) !== -1) return "citable";
    if (useContext === "external") return "authoritative";
    return "supplied";
  }

  /* What interpretation observed about the request. These are teaching signals,
     not new contract fields: each one answers "did this task actually create
     the gap the lesson is about". Absent means "not stated", never "fine". */
  function normalizeSignals(raw, source) {
    var given = (raw && typeof raw === "object") ? raw : {};
    function flag(name, fallback) {
      return typeof given[name] === "boolean" ? given[name] : fallback;
    }
    function idList(name) {
      return Array.isArray(given[name])
        ? given[name].filter(function (id) { return typeof id === "string" && id; })
        : [];
    }
    return {
      sources_supplied: (typeof given.sources_supplied === "number" && given.sources_supplied >= 0)
        ? Math.floor(given.sources_supplied) : 0,
      audience_stated: flag("audience_stated", typeof source.audience === "string" && source.audience.trim() !== ""),
      output_shape_stated: flag("output_shape_stated",
        typeof source.deliverable === "string" && source.deliverable.trim() !== ""),
      constraints_stated: flag("constraints_stated", false),
      objective_ambiguous: flag("objective_ambiguous", false),
      involves_numbers: flag("involves_numbers", false),
      input_is_large: flag("input_is_large", false),
      destination_gaps: idList("destination_gaps"),
      removed_safeguard_ids: idList("removed_safeguard_ids")
    };
  }

  function normalizeTask(raw) {
    var source = (raw && typeof raw === "object") ? raw : {};
    var useContext = oneOf(source.use_context, USE_CONTEXTS, "personal");
    var family = oneOf(source.family, TASK_FAMILIES, "other");
    var stated = oneOf(source.source_dependency, SOURCE_DEPENDENCY, null);
    var dependency = stated === null ? assumeSourceDependency(useContext) : stated;
    var domain = oneOf(source.domain, CONSEQUENTIAL_DOMAINS, null);
    var stakes = oneOf(source.stakes, STAKES, "medium");

    return {
      family: family,
      family_label: TASK_FAMILY_LABELS[family],
      stakes: stakes,
      use_context: useContext,
      source_dependency: dependency,
      assumed_source_dependency: stated === null,
      subject: oneOf(source.subject, ["self", "client", "third_party", "mixed", "unknown"], "unknown"),
      domain: domain,
      deliverable: safeText(source.deliverable, 80),
      audience: safeText(source.audience, 80),
      destination_capabilities: (source.destination_capabilities && typeof source.destination_capabilities === "object")
        ? source.destination_capabilities : {},
      policy_requires_verification: source.policy_requires_verification === true,
      signals: normalizeSignals(source.signals, source),
      consequential: domain !== null
        || CONSEQUENTIAL_FAMILIES.indexOf(family) !== -1
        || CONSEQUENTIAL_CONTEXTS.indexOf(useContext) !== -1
        || stakes === "high"
    };
  }

  /* ============================================================ *
   * 3d. SOURCE DEPENDENCY AND THE SOURCE PLAN                     *
   * ============================================================ *
   * Contracts section 6.1 and the manual section 7. The level     *
   * decides which checks exist; the use context decides how hard  *
   * O'Mono presses. Enforcement itself belongs to policy (Gate    *
   * 18) — teaching states the plan and says so.                   */

  var CHECK_INSTRUCTIONS = {
    "check.source_exists": "Open each source and confirm it exists as described, with the same identifier, date and issuer.",
    "check.claim_supported": "For each material claim, point to the exact sentence in the source that supports it.",
    "check.quotation_exact": "Compare every quotation and figure against the source text word for word.",
    "check.currency": "Confirm the source is still in force, and check its effective date and any later change.",
    "check.authority_class": "Confirm the source is the class of authority that actually governs this question.",
    "check.completeness": "Check whether the source covers the whole question or only part of it.",
    "check.calculation_recomputed": "Recompute every number from the stated inputs and compare the result.",
    "check.scope_and_jurisdiction": "Confirm the source applies to this jurisdiction, period and subject.",
    "check.reliance_and_attribution": "Confirm each cited source may be relied on and is attributed accurately."
  };

  var SOURCE_DEPENDENCY_RULES = {
    none: {
      required: false,
      checks: [],
      risk_ids: []
    },
    supplied: {
      required: true,
      checks: ["check.claim_supported", "check.quotation_exact", "check.completeness"],
      risk_ids: ["source.real_but_mischaracterized", "source.unsupplied_but_assumed"]
    },
    live: {
      required: true,
      checks: ["check.currency", "check.source_exists", "check.claim_supported"],
      risk_ids: ["source.outdated", "model.no_live_access"]
    },
    authoritative: {
      required: true,
      checks: ["check.authority_class", "check.source_exists", "check.claim_supported",
               "check.currency", "check.scope_and_jurisdiction"],
      risk_ids: ["source.not_authoritative", "source.real_but_mischaracterized", "source.outdated"]
    },
    citable: {
      required: true,
      checks: ["check.source_exists", "check.authority_class", "check.claim_supported",
               "check.quotation_exact", "check.currency", "check.scope_and_jurisdiction",
               "check.reliance_and_attribution"],
      risk_ids: ["source.fabricated_citation", "source.real_but_mischaracterized",
                 "source.not_authoritative", "source.outdated"]
    }
  };

  /* Source types worth consulting inside an organization. Every one of them
     carries o_mono_can_open: false. O'Mono has no connector to any of these,
     and a teaching module that implied otherwise would be teaching a lie. */
  var INTERNAL_SOURCE_TYPES = [
    { type: "matter_or_case_file", label: "the matter or case file",
      how_to_supply: "paste the controlling passage or attach the document" },
    { type: "document_management", label: "the document management system",
      how_to_supply: "export the approved version and attach it" },
    { type: "policy_or_handbook", label: "the internal policy or handbook page",
      how_to_supply: "paste the clause that governs, with its version and date" },
    { type: "system_of_record", label: "the system of record for these figures",
      how_to_supply: "export the report and paste the rows that matter" },
    { type: "prior_approved_work", label: "prior approved work product",
      how_to_supply: "attach the example you want followed" },
    { type: "message_thread", label: "the email or message thread that decided this",
      how_to_supply: "paste the decisive message, with its date" }
  ];

  var FAMILY_INTERNAL_PRIORITY = {
    legal_research: ["matter_or_case_file", "document_management", "policy_or_handbook"],
    drafting: ["prior_approved_work", "document_management", "policy_or_handbook"],
    analysis: ["system_of_record", "document_management", "prior_approved_work"],
    data_extraction: ["system_of_record", "document_management", "matter_or_case_file"],
    communication: ["message_thread", "prior_approved_work", "policy_or_handbook"],
    planning: ["policy_or_handbook", "message_thread", "prior_approved_work"]
  };

  function internalSourceSuggestions(family) {
    var priority = FAMILY_INTERNAL_PRIORITY[family] || [];
    return INTERNAL_SOURCE_TYPES.slice()
      .sort(function (a, b) {
        var rankA = priority.indexOf(a.type), rankB = priority.indexOf(b.type);
        if (rankA === -1) rankA = priority.length;
        if (rankB === -1) rankB = priority.length;
        return rankA - rankB;
      })
      .map(function (source) {
        return {
          type: source.type,
          label: source.label,
          how_to_supply: source.how_to_supply,
          o_mono_can_open: false
        };
      });
  }

  var STATEMENTS = {
    "statement.no_internal_access":
      "O'Mono cannot open your internal systems, and neither can the destination model. " +
      "Supply the controlling passage yourself and the prompt will be bound to it.",
    "statement.no_live_access":
      "This answer depends on current information, and the selected destination was not given live access here. " +
      "Treat anything time-sensitive as unconfirmed until you check a current source.",
    "statement.synthesis_is_not_validation":
      "A language model's synthesis of what a source says is not a current authoritative validation of it. " +
      "Confirm the point against the controlling source before you rely on it.",
    "statement.primary_source_required":
      "This work needs the primary or governing source itself, not a summary or a description of one.",
    "statement.attestation_not_verification":
      "A completed check is your own attestation that you performed it. It is not a validation carried out by O'Mono."
  };

  function sourcePlanFor(rawTask) {
    var task = normalizeTask(rawTask);
    var rule = SOURCE_DEPENDENCY_RULES[task.source_dependency];

    var enforcement = "advisory";
    if (rule.required) {
      if (task.policy_requires_verification || CONSEQUENTIAL_CONTEXTS.indexOf(task.use_context) !== -1) {
        enforcement = "checklist";
      } else if (task.use_context === "external") {
        enforcement = "prominent";
      }
    }
    var level = enforcement === "checklist" ? "required" : "suggest";

    var checks = rule.checks.map(function (checkId) {
      return {
        check_id: checkId,
        key: CHECK_KEYS[checkId],
        instruction: CHECK_INSTRUCTIONS[checkId],
        level: level
      };
    });

    var statements = [];
    function state(id) { statements.push({ id: id, text: STATEMENTS[id] }); }

    if (rule.required) {
      if (task.use_context === "internal") state("statement.no_internal_access");
      var needsCurrency = rule.checks.indexOf("check.currency") !== -1;
      if (needsCurrency && task.destination_capabilities.web !== true) state("statement.no_live_access");
      if (task.consequential || task.source_dependency === "authoritative" || task.source_dependency === "citable") {
        state("statement.synthesis_is_not_validation");
      }
      if (task.consequential) state("statement.primary_source_required");
      state("statement.attestation_not_verification");
    }

    return {
      source_dependency: task.source_dependency,
      assumed_source_dependency: task.assumed_source_dependency,
      use_context: task.use_context,
      consequential: task.consequential,
      required: rule.required,
      enforcement: enforcement,
      policy_may_require_more: rule.required,
      checks: checks,
      statements: statements,
      internal_sources: (rule.required && task.use_context === "internal")
        ? internalSourceSuggestions(task.family) : [],
      risk_ids: rule.risk_ids.slice()
    };
  }

  /* The interpretation schema prints checks as the short manual vocabulary
     ("existence", "support", "currency"). The ledger keeps the dotted id. */
  function sourcePlanKeys(plan) {
    var checks = (plan && Array.isArray(plan.checks)) ? plan.checks : [];
    var seen = Object.create(null);
    var keys = [];
    checks.forEach(function (check) {
      if (check && typeof check.key === "string" && !seen[check.key]) {
        seen[check.key] = true;
        keys.push(check.key);
      }
    });
    return keys;
  }

  /* ============================================================ *
   * 4. LESSON LIBRARY                                             *
   * ============================================================ *
   * Every entry is one concrete way THIS kind of task fails, the  *
   * safeguard that answers it, and the repair that follows a      *
   * failure. `applies` is the whole point: a lesson exists        *
   * because the task in front of the user created the risk.       *
   *                                                               *
   * severity 0-3 · relevance 0-2 · workflow_effect 0-2 feed the   *
   * materiality score in section 3b; recurrence comes from the    *
   * caller's history.                                             */

  function subjectPhrase(task) {
    return "this " + (task.deliverable || task.family_label);
  }

  function Subject(task) {
    var phrase = subjectPhrase(task);
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  }

  function dependencyIn(task) {
    var levels = Array.prototype.slice.call(arguments, 1);
    return levels.indexOf(task.source_dependency) !== -1;
  }

  function resolve(value, task) {
    return typeof value === "function" ? value(task) : value;
  }

  function lesson(spec) { return spec; }

  var LESSON_LIBRARY = {

    "lesson.compare_proposition_to_source": lesson({
      lesson_id: "lesson.compare_proposition_to_source",
      competency_id: "review.verify_outputs",
      risk_id: "source.real_but_mischaracterized",
      lesson_type: "source_dependency",
      safeguard_id: "safeguard.require_exact_supported_proposition",
      repair_id: "repair.ground_in_verified_excerpt",
      applies: function (task) { return dependencyIn(task, "supplied", "authoritative", "citable"); },
      severity: function (task) { return task.consequential ? 3 : 2; },
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " can cite a real source for a proposition the source never states.",
          why: "The model matches language to your question; it does not read your source and test the fit. "
             + "A close paraphrase can drop a condition or reverse an exception.",
          protection_to_add: "The prompt now requires the exact supporting sentence behind every material claim, "
             + "and forbids a claim with no supporting sentence.",
          verify_after: "For each material claim, open the passage it points to and confirm that passage says it, "
             + "including any condition or exception.",
          return_if_failure: "Bring back the claim and the passage cited for it. "
             + "O'Mono rebuilds the prompt around the verified excerpt."
        };
      }
    }),

    "lesson.check_every_citation_exists": lesson({
      lesson_id: "lesson.check_every_citation_exists",
      competency_id: "review.verify_outputs",
      risk_id: "source.fabricated_citation",
      lesson_type: "risk",
      safeguard_id: "safeguard.forbid_uncited_authority",
      repair_id: "repair.replace_with_verified_authority",
      applies: function (task) {
        return task.source_dependency === "citable"
          || (task.source_dependency === "authoritative" && task.consequential);
      },
      severity: 3,
      relevance: function (task) { return task.source_dependency === "citable" ? 2 : 1; },
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: "A citation in " + subjectPhrase(task) + " can be perfectly formed and still refer to nothing.",
          why: "Citation formats are highly predictable, so a model can complete one fluently with no source behind "
             + "it. Nothing in the answer marks the difference.",
          protection_to_add: "The prompt forbids any authority the model cannot tie to supplied text, and requires "
             + "it to say so rather than produce one.",
          verify_after: "Open every citation and confirm the identifier, date, issuer and page match a source you "
             + "can actually retrieve.",
          return_if_failure: "Bring back the citation line alone. O'Mono replaces it with a verified authority or "
             + "removes the claim it carried."
        };
      }
    }),

    "lesson.supply_the_controlling_text": lesson({
      lesson_id: "lesson.supply_the_controlling_text",
      competency_id: "instruct.effective",
      risk_id: "source.unsupplied_but_assumed",
      lesson_type: "source_dependency",
      safeguard_id: "safeguard.require_source_bound_answer",
      repair_id: "repair.attach_controlling_text",
      applies: function (task) {
        return dependencyIn(task, "supplied", "authoritative", "citable") && task.signals.sources_supplied === 0;
      },
      severity: 2,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " depends on a document the model was never given.",
          why: "Asked to work from a source it cannot see, a model reconstructs a plausible version of it. "
             + "The answer then describes a document that does not exist.",
          protection_to_add: "The prompt states that no source was supplied and requires the model to ask for it "
             + "instead of reconstructing it.",
          verify_after: "Confirm every statement about the document against the document itself before using it.",
          return_if_failure: "Paste the controlling passage. O'Mono rebuilds the prompt bound to the text you supply."
        };
      }
    }),

    "lesson.name_the_authority_class": lesson({
      lesson_id: "lesson.name_the_authority_class",
      competency_id: "select.systems_uses",
      risk_id: "source.not_authoritative",
      lesson_type: "source_dependency",
      safeguard_id: "safeguard.name_required_authority_class",
      repair_id: "repair.reroute_to_authoritative_source",
      applies: function (task) { return dependencyIn(task, "authoritative", "citable"); },
      severity: function (task) { return task.consequential ? 3 : 2; },
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " needs a particular class of authority, not whichever source reads best.",
          why: "A model ranks sources by how well they answer the question, not by which one governs. "
             + "A secondary summary can outrank the instrument itself.",
          protection_to_add: "The prompt names the class of authority that controls here and rejects a source "
             + "outside it.",
          verify_after: "Check that each source is the governing kind for this question, not a summary or a "
             + "commentary about it.",
          return_if_failure: "Bring back the source that was relied on. O'Mono reroutes the prompt to the "
             + "governing authority."
        };
      }
    }),

    "lesson.currency_is_not_confidence": lesson({
      lesson_id: "lesson.currency_is_not_confidence",
      competency_id: "review.verify_outputs",
      risk_id: "source.outdated",
      lesson_type: "risk",
      safeguard_id: "safeguard.require_effective_date_check",
      repair_id: "repair.recheck_against_current_source",
      applies: function (task) { return dependencyIn(task, "live", "authoritative", "citable"); },
      severity: function (task) { return task.consequential ? 3 : 2; },
      relevance: function (task) { return task.source_dependency === "live" ? 2 : 1; },
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " can rest on a rule that has since changed.",
          why: "A model's fluency does not vary with how current its information is. A superseded rule is stated "
             + "with exactly the confidence of a current one.",
          protection_to_add: "The prompt requires the effective date of each source, and an explicit statement "
             + "wherever currency is unknown.",
          verify_after: "Confirm each source is still in force, and check its effective date and any later change.",
          return_if_failure: "Bring back the source and the date you found. O'Mono rebuilds the prompt against the "
             + "current version."
        };
      }
    }),

    "lesson.model_has_no_live_access": lesson({
      lesson_id: "lesson.model_has_no_live_access",
      competency_id: "ai.limits",
      risk_id: "model.no_live_access",
      lesson_type: "useful_fact",
      safeguard_id: "safeguard.state_knowledge_cutoff_limit",
      repair_id: "repair.route_to_live_source",
      applies: function (task) {
        return task.source_dependency === "live" && task.destination_capabilities.web !== true;
      },
      severity: 2,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " depends on current information the selected system was not given.",
          why: "Without live access a model answers from what it absorbed in training. It cannot tell you what "
             + "changed since, and it will not volunteer the gap.",
          protection_to_add: "The prompt states the knowledge limit and requires anything time-sensitive to be "
             + "marked as unconfirmed.",
          verify_after: "Check every time-sensitive statement against a current source before relying on it.",
          return_if_failure: "Bring back the statement and what the current source says. O'Mono routes the work to "
             + "a live source."
        };
      }
    }),

    "lesson.model_cannot_open_internal_systems": lesson({
      lesson_id: "lesson.model_cannot_open_internal_systems",
      competency_id: "ai.limits",
      risk_id: "model.no_internal_access",
      lesson_type: "useful_fact",
      safeguard_id: "safeguard.require_pasted_internal_excerpt",
      repair_id: "repair.supply_internal_excerpt",
      applies: function (task) {
        return task.use_context === "internal" && task.source_dependency !== "none";
      },
      severity: 2,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " draws on internal records that neither O'Mono nor the model can open.",
          why: "There is no connector here to a document system, a matter file or a system of record, so an answer "
             + "about their contents is reconstruction rather than retrieval.",
          protection_to_add: "The prompt states that internal records were not supplied and confines the answer to "
             + "what you paste in.",
          verify_after: "Compare every statement about an internal record against the record itself.",
          return_if_failure: "Paste or attach the passage from the record. O'Mono rebuilds the prompt bound to it."
        };
      }
    }),

    "lesson.fluency_is_not_evidence": lesson({
      lesson_id: "lesson.fluency_is_not_evidence",
      competency_id: "ai.limits",
      risk_id: "model.confident_but_unverified",
      lesson_type: "new_literacy",
      safeguard_id: "safeguard.require_uncertainty_statement",
      repair_id: "repair.request_uncertainty_and_sources",
      applies: function (task) {
        return task.consequential || task.source_dependency !== "none" || task.stakes === "high";
      },
      severity: 2,
      relevance: function (task) { return task.consequential ? 2 : 1; },
      workflow_effect: 1,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " can read as settled when nothing in it was checked.",
          why: "Fluent, confident prose is what a language model produces by construction. It is a property of the "
             + "writing, not evidence about the subject.",
          protection_to_add: "The prompt requires the answer to mark what is uncertain and to name what it could "
             + "not establish.",
          verify_after: "Read for claims stated without support, and confirm each one before relying on it.",
          return_if_failure: "Bring back the claim you could not confirm. O'Mono narrows the prompt to what the "
             + "evidence supports."
        };
      }
    }),

    "lesson.long_input_can_be_silently_cut": lesson({
      lesson_id: "lesson.long_input_can_be_silently_cut",
      competency_id: "ai.limits",
      risk_id: "model.context_truncation",
      lesson_type: "useful_fact",
      safeguard_id: "safeguard.chunk_and_confirm_coverage",
      repair_id: "repair.resend_missing_section",
      applies: function (task) { return task.signals.input_is_large === true; },
      severity: 2,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: "The material behind " + subjectPhrase(task) + " may be longer than the model will read.",
          why: "Context limits are applied silently. An answer that covers only the first part of a long input "
             + "looks complete and says nothing about the gap.",
          protection_to_add: "The prompt splits the material into named sections and requires the answer to confirm "
             + "coverage of each one.",
          verify_after: "Check that every section you supplied is actually addressed, not only the first few.",
          return_if_failure: "Bring back the section that was skipped. O'Mono resends it as its own request."
        };
      }
    }),

    "lesson.state_the_audience_and_use": lesson({
      lesson_id: "lesson.state_the_audience_and_use",
      competency_id: "instruct.effective",
      risk_id: "input.missing_audience",
      lesson_type: "model_input_quality",
      safeguard_id: "safeguard.state_audience_and_use",
      repair_id: "repair.restate_audience_and_reissue",
      applies: function (task) { return task.signals.audience_stated !== true; },
      severity: 1,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " does not say who reads it or what they will do with it.",
          why: "With no reader named, a model writes for an average one. Depth, tone and what may safely be "
             + "assumed all change with the audience.",
          protection_to_add: "The prompt names the reader and the decision the work supports, so the level of "
             + "detail is chosen rather than guessed.",
          verify_after: "Read the result as the named reader would, and check nothing assumed is unknown to them.",
          return_if_failure: "Say who the reader is. O'Mono reissues the prompt for that audience."
        };
      }
    }),

    "lesson.state_the_output_shape": lesson({
      lesson_id: "lesson.state_the_output_shape",
      competency_id: "instruct.effective",
      risk_id: "input.unstated_output_shape",
      lesson_type: "model_input_quality",
      safeguard_id: "safeguard.specify_output_structure",
      repair_id: "repair.restate_output_structure",
      applies: function (task) { return task.signals.output_shape_stated !== true; },
      severity: 1,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " does not say what shape the answer has to take.",
          why: "A model defaults to prose. Where you need a table, a clause, a diff or a fixed set of fields, "
             + "that default costs a whole round.",
          protection_to_add: "The prompt states the exact structure the answer must follow, including its sections "
             + "and their order.",
          verify_after: "Check the result has the structure you asked for before spending time reading it.",
          return_if_failure: "Say what shape you need. O'Mono restates the structure and reissues."
        };
      }
    }),

    "lesson.name_the_constraints_that_bind": lesson({
      lesson_id: "lesson.name_the_constraints_that_bind",
      competency_id: "instruct.effective",
      risk_id: "input.missing_constraints",
      lesson_type: "workflow",
      safeguard_id: "safeguard.enumerate_binding_constraints",
      repair_id: "repair.add_missing_constraint",
      applies: function (task) {
        return task.signals.constraints_stated !== true && task.stakes !== "low";
      },
      severity: 1,
      relevance: 1,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " has limits the model was never told about.",
          why: "A model cannot infer a length limit, a house style, an excluded approach or a deadline. "
             + "What is unstated is treated as free.",
          protection_to_add: "The prompt lists the constraints that actually bind this work and marks them as "
             + "non-negotiable.",
          verify_after: "Check the result against each stated constraint, one at a time.",
          return_if_failure: "Bring back the constraint that was broken. O'Mono states it explicitly and reissues."
        };
      }
    }),

    "lesson.narrow_an_ambiguous_objective": lesson({
      lesson_id: "lesson.narrow_an_ambiguous_objective",
      competency_id: "instruct.effective",
      risk_id: "input.ambiguous_objective",
      lesson_type: "model_input_quality",
      safeguard_id: "safeguard.restate_objective_for_confirmation",
      repair_id: "repair.narrow_the_objective",
      applies: function (task) { return task.signals.objective_ambiguous === true; },
      severity: 2,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: "The objective behind " + subjectPhrase(task) + " can be read in more than one way.",
          why: "A model resolves ambiguity silently and confidently, choosing one reading without telling you "
             + "that it chose.",
          protection_to_add: "The prompt restates the objective in a single reading and asks the model to stop if "
             + "that reading is wrong.",
          verify_after: "Check the result answers the question you meant rather than a neighbouring one.",
          return_if_failure: "Say which reading you meant. O'Mono narrows the objective and reissues."
        };
      }
    }),

    "lesson.recompute_every_number": lesson({
      lesson_id: "lesson.recompute_every_number",
      competency_id: "review.verify_outputs",
      risk_id: "output.unchecked_calculation",
      lesson_type: "risk",
      safeguard_id: "safeguard.require_shown_calculation",
      repair_id: "repair.recompute_from_inputs",
      applies: function (task) { return task.signals.involves_numbers === true; },
      severity: function (task) { return task.consequential ? 3 : 2; },
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: "Every figure in " + subjectPhrase(task) + " needs recomputing before anyone relies on it.",
          why: "Arithmetic in a language model is pattern completion, not calculation. A wrong total is formatted "
             + "exactly like a right one.",
          protection_to_add: "The prompt requires the inputs and the method behind every figure to be shown "
             + "alongside it.",
          verify_after: "Recompute each figure from the stated inputs and compare the result.",
          return_if_failure: "Bring back the figure and its inputs. O'Mono rebuilds the prompt to compute it step "
             + "by step."
        };
      }
    }),

    "lesson.bound_the_claim_to_evidence": lesson({
      lesson_id: "lesson.bound_the_claim_to_evidence",
      competency_id: "risk.task_specific",
      risk_id: "output.overbroad_claim",
      lesson_type: "risk",
      safeguard_id: "safeguard.bound_claims_to_evidence",
      repair_id: "repair.narrow_the_claim",
      applies: function (task) {
        return task.stakes === "high" || ["external", "citable", "filing"].indexOf(task.use_context) !== -1;
      },
      severity: 2,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " can end up claiming more than the evidence behind it supports.",
          why: "A model generalizes to make prose read well. A narrow finding becomes a general rule with no "
             + "signal that the scope widened.",
          protection_to_add: "The prompt requires each conclusion to state the evidence it rests on and the limits "
             + "of that evidence.",
          verify_after: "Check that each conclusion is no wider than the evidence cited for it.",
          return_if_failure: "Bring back the conclusion and its evidence. O'Mono narrows the claim to what is "
             + "supported."
        };
      }
    }),

    "lesson.destination_cannot_do_this": lesson({
      lesson_id: "lesson.destination_cannot_do_this",
      competency_id: "select.systems_uses",
      risk_id: "destination.capability_mismatch",
      lesson_type: "workflow",
      safeguard_id: "safeguard.state_destination_capability_limit",
      repair_id: "repair.change_destination_model",
      applies: function (task) { return task.signals.destination_gaps.length > 0; },
      severity: 2,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: "The selected system cannot do part of what " + subjectPhrase(task) + " needs.",
          why: "Capability belongs to the destination and its configuration, not to what the model says about "
             + "itself. It will attempt the task regardless.",
          protection_to_add: "The prompt states the capability limit plainly, so the answer does not quietly "
             + "pretend to have it.",
          verify_after: "Check whether the part needing the missing capability was done or only described.",
          return_if_failure: "Bring back the part that failed. O'Mono routes it to a system that can do it."
        };
      }
    }),

    "lesson.a_removed_safeguard_repeats_the_failure": lesson({
      lesson_id: "lesson.a_removed_safeguard_repeats_the_failure",
      competency_id: "risk.task_specific",
      risk_id: "workflow.safeguard_removed",
      lesson_type: "workflow",
      safeguard_id: "safeguard.restore_removed_safeguard",
      repair_id: "repair.reinstate_safeguard",
      applies: function (task) { return task.signals.removed_safeguard_ids.length > 0; },
      severity: 3,
      relevance: 2,
      workflow_effect: 2,
      parts: function (task) {
        return {
          be_careful: "A safeguard removed from " + subjectPhrase(task) + " is the one that failed here before.",
          why: "The failure a safeguard prevents is invisible in the answer, which is exactly why the safeguard "
             + "looked unnecessary.",
          protection_to_add: "The prompt restores the removed safeguard and marks it as the one tied to the "
             + "recorded failure.",
          verify_after: "Check specifically for the failure that occurred last time.",
          return_if_failure: "Bring back the failing passage. O'Mono reinstates the safeguard and reissues."
        };
      }
    }),

    "lesson.name_the_people_affected": lesson({
      lesson_id: "lesson.name_the_people_affected",
      competency_id: "responsibility.human_and_affected",
      risk_id: "responsibility.affected_person",
      lesson_type: "human_responsibility",
      safeguard_id: "safeguard.name_affected_persons",
      repair_id: "repair.review_impact_with_owner",
      applies: function (task) {
        return ["client", "third_party", "mixed"].indexOf(task.subject) !== -1;
      },
      severity: 2,
      relevance: 2,
      workflow_effect: 1,
      parts: function (task) {
        return {
          be_careful: Subject(task) + " affects someone who is not in the room.",
          why: "A model optimizes the text in front of it. It carries no duty to the person the work describes or "
             + "decides about.",
          protection_to_add: "The prompt names who is affected and requires the answer to respect what is owed "
             + "to them.",
          verify_after: "Read the result from the position of the person affected, and check nothing about them "
             + "is unfair or wrong.",
          return_if_failure: "Bring back the passage that concerns them. O'Mono reworks it with the duty stated."
        };
      }
    }),

    "lesson.you_own_the_judgment": lesson({
      lesson_id: "lesson.you_own_the_judgment",
      competency_id: "responsibility.human_and_affected",
      risk_id: "responsibility.human_approval_required",
      lesson_type: "human_responsibility",
      safeguard_id: "safeguard.mark_human_decision_point",
      repair_id: "repair.escalate_for_human_approval",
      applies: function (task) {
        return task.consequential || task.stakes === "high"
          || ["external", "citable", "filing"].indexOf(task.use_context) !== -1;
      },
      severity: 2,
      relevance: 2,
      workflow_effect: 1,
      parts: function (task) {
        return {
          be_careful: "The judgment behind " + subjectPhrase(task) + " stays yours.",
          why: "A model produces material for a decision, never responsibility for it. Approval, escalation and "
             + "reliance remain human acts.",
          protection_to_add: "The prompt marks where a human decision is required, instead of letting the answer "
             + "settle it by phrasing.",
          verify_after: "Identify each decision point and confirm you, not the answer, made the call.",
          return_if_failure: "Bring back the point you are unsure about. O'Mono frames it as an explicit choice "
             + "for you or your approver."
        };
      }
    })
  };

  /* ============================================================ *
   * 5. BUILDING, VALIDATING AND SELECTING COACHING                *
   * ============================================================ */

  /* Wording that would be equally true of any task. On its own it teaches
     nothing, and repeated across unrelated work it trains people to ignore
     the panel. */
  var GENERIC_PHRASES = [
    "ai can make mistakes", "ai makes mistakes", "ai may hallucinate", "ai can hallucinate",
    "ai is not perfect", "models are not perfect", "be careful with ai",
    "always double-check", "always double check", "double-check the output",
    "verify the output", "always verify", "review everything", "check everything",
    "use your own judgment", "use your own judgement"
  ];

  var ANCHOR_STOPWORDS = ["this", "that", "with", "from", "your", "their", "other", "some", "into", "about"];

  function anchorTokens(task) {
    var text = [task.family_label, task.deliverable, task.audience, task.domain].join(" ").toLowerCase();
    var seen = Object.create(null);
    var tokens = [];
    text.split(/[^a-z0-9]+/).forEach(function (word) {
      if (word.length < 4 || ANCHOR_STOPWORDS.indexOf(word) !== -1 || seen[word]) return;
      seen[word] = true;
      tokens.push(word);
    });
    return tokens;
  }

  /* A lesson earns its place by naming the work in front of the user. */
  function assessTaskSpecificity(unit, task) {
    var source = unit || {};
    var text = (safeText(source.be_careful, 400) + " " + safeText(source.verify_after, 400)).toLowerCase();
    var anchored = anchorTokens(task).some(function (token) { return text.indexOf(token) !== -1; });
    if (anchored) return { task_specific: true, reason: null };
    var generic = GENERIC_PHRASES.some(function (phrase) { return text.indexOf(phrase) !== -1; });
    return { task_specific: false, reason: generic ? "generic_warning" : "not_task_specific" };
  }

  function isConcise(unit) {
    var source = unit || {};
    return LESSON_PARTS.every(function (part) {
      var text = source[part];
      return typeof text === "string" && text.length > 0 && text.length <= PART_LIMITS[part];
    });
  }

  /* Refuses anything the teaching contract does not allow onto the screen.
     Risk comes first: task-specific risk is the organizing competency, so a
     lesson with no concrete risk has no reason to exist. */
  function buildCoachingUnit(spec) {
    var source = (spec && typeof spec === "object") ? spec : {};

    if (!isKnownId("RISKS", source.risk_id)) {
      throw new Error("a coaching unit needs a known risk_id; task-specific risk is the organizing competency");
    }
    var competency = canonicalCompetency(source.competency_id);
    if (competency === null) throw new Error("unknown competency_id " + JSON.stringify(source.competency_id));
    if (!isKnownId("LESSON_TYPES", source.lesson_type)) {
      throw new Error("unknown lesson_type " + JSON.stringify(source.lesson_type));
    }

    var unit = {
      competency_id: competency,
      risk_id: source.risk_id,
      lesson_type: source.lesson_type,
      materiality: 0
    };

    LESSON_PARTS.forEach(function (part) {
      var text = safeText(source[part], PART_LIMITS[part] * 4);
      if (!text) throw new Error("a coaching unit needs a " + part);
      if (text.length > PART_LIMITS[part]) {
        throw new Error(part + " is " + text.length + " characters; guidance must stay concise, at most "
          + PART_LIMITS[part]);
      }
      unit[part] = text;
    });

    var score = source.materiality;
    if (typeof score !== "number" || !isFinite(score) || score % 1 !== 0 || score < 0 || score > MATERIALITY_MAX) {
      throw new Error("materiality must be a whole number from 0 to " + MATERIALITY_MAX);
    }
    unit.materiality = score;

    unit.lesson_id = isKnownId("LESSONS", source.lesson_id) ? source.lesson_id : null;
    unit.safeguard_id = isKnownId("SAFEGUARDS", source.safeguard_id) ? source.safeguard_id : null;
    unit.repair_id = isKnownId("REPAIRS", source.repair_id) ? source.repair_id : null;
    unit.hard_stop = source.hard_stop === true;
    unit.recurrence = source.recurrence === true;
    unit.beyond_default_reason = null;
    return unit;
  }

  /* Coaching proposed by the model. Everything here is untrusted: unknown ids
     are dropped rather than minted, UI wording is discarded, and guidance that
     names nothing in the task never reaches the panel. */
  function normalizeModelCoaching(raw, rawTask) {
    if (!Array.isArray(raw)) return [];
    var task = normalizeTask(rawTask);
    var accepted = [];
    raw.forEach(function (candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return;
      var unit;
      try {
        unit = buildCoachingUnit({
          competency_id: candidate.competency_id,
          risk_id: candidate.risk_id,
          lesson_type: normalizeLessonType(candidate.lesson_type),
          lesson_id: candidate.lesson_id,
          safeguard_id: candidate.safeguard_id,
          repair_id: candidate.repair_id,
          materiality: candidate.materiality,
          hard_stop: candidate.hard_stop,
          recurrence: candidate.recurrence,
          be_careful: candidate.be_careful,
          why: candidate.why,
          protection_to_add: candidate.protection_to_add,
          verify_after: candidate.verify_after,
          return_if_failure: candidate.return_if_failure
        });
      } catch (error) {
        return;
      }
      if (!assessTaskSpecificity(unit, task).task_specific) return;
      accepted.push(unit);
    });
    return accepted;
  }

  /* The sentence with every task-specific word taken out. Two tasks that share
     a skeleton are being told the same thing with the nouns swapped. */
  function guidanceSkeleton(text, tokens) {
    var stripped = safeText(text, 400).toLowerCase().replace(/[^a-z\s]/g, " ");
    tokens.forEach(function (token) {
      stripped = stripped.replace(new RegExp("\\b" + token + "\\b", "g"), " ");
    });
    return stripped.replace(/\s+/g, " ").trim();
  }

  /* options.recent_guidance is a local, in-session list of {task_family,
     be_careful}. It is never written to the ledger and never exported; it
     exists only so the panel does not recite itself across unrelated work. */
  function filterRepeatedGuidance(units, task, options) {
    var list = Array.isArray(units) ? units : [];
    var settings = options || {};
    var recent = Array.isArray(settings.recent_guidance) ? settings.recent_guidance : [];
    var anchors = anchorTokens(task);
    var seenInSet = Object.create(null);
    var kept = [];

    list.forEach(function (unit) {
      if (!assessTaskSpecificity(unit, task).task_specific) return;

      var ownSkeleton = guidanceSkeleton(unit.be_careful, anchors);
      if (seenInSet[ownSkeleton]) return;

      var recited = recent.some(function (entry) {
        if (!entry || typeof entry !== "object") return false;
        if (entry.task_family === task.family) return false;
        var tokens = anchors.concat(anchorTokens({
          family_label: TASK_FAMILY_LABELS[entry.task_family] || "",
          deliverable: "", audience: "", domain: null
        }));
        return guidanceSkeleton(unit.be_careful, tokens) === guidanceSkeleton(entry.be_careful, tokens);
      });
      if (recited) return;

      seenInSet[ownSkeleton] = true;
      kept.push(unit);
    });
    return kept;
  }

  /* The entry point. Returns the `coaching` array of the interpretation
     response: the material lessons this task earned, already ranked and
     already inside the density budget. */
  function coachingForTask(rawTask, options) {
    var task = normalizeTask(rawTask);
    var settings = options || {};
    var hardStops = Array.isArray(settings.hard_stop_risk_ids) ? settings.hard_stop_risk_ids : [];
    var history = Array.isArray(settings.history) ? settings.history : [];

    var candidates = [];
    LESSONS.forEach(function (lessonId) {
      var entry = LESSON_LIBRARY[lessonId];
      if (!entry.applies(task)) return;

      var recurs = history.some(function (record) {
        return record && record.lesson_id === lessonId && record.task_family === task.family
          && record.recurrence === true;
      });
      var parts = entry.parts(task);
      candidates.push(buildCoachingUnit({
        competency_id: entry.competency_id,
        risk_id: entry.risk_id,
        lesson_type: entry.lesson_type,
        lesson_id: entry.lesson_id,
        safeguard_id: entry.safeguard_id,
        repair_id: entry.repair_id,
        hard_stop: hardStops.indexOf(entry.risk_id) !== -1,
        recurrence: recurs,
        materiality: scoreMateriality({
          severity: resolve(entry.severity, task),
          task_relevance: resolve(entry.relevance, task),
          workflow_effect: resolve(entry.workflow_effect, task),
          recurrence: recurs ? 1 : 0
        }),
        be_careful: parts.be_careful,
        why: parts.why,
        protection_to_add: parts.protection_to_add,
        verify_after: parts.verify_after,
        return_if_failure: parts.return_if_failure
      }));
    });

    return selectTriggers(filterRepeatedGuidance(candidates, task, settings), settings);
  }

  /* Everything the work event needs from teaching, and nothing else:
     canonical ids, never a line of the lesson itself (Contracts section 12). */
  function evidenceFromCoaching(units) {
    var list = Array.isArray(units) ? units : [];
    var competencies = [], risks = [], lessons = [], types = [], safeguards = [];

    function add(collection, id) {
      if (typeof id === "string" && id && collection.indexOf(id) === -1) collection.push(id);
    }

    list.forEach(function (unit) {
      var source = unit || {};
      add(competencies, canonicalCompetency(source.competency_id));
      if (isKnownId("RISKS", source.risk_id)) add(risks, source.risk_id);
      if (isKnownId("LESSONS", source.lesson_id)) add(lessons, source.lesson_id);
      if (isKnownId("LESSON_TYPES", source.lesson_type)) add(types, source.lesson_type);
      if (isKnownId("SAFEGUARDS", source.safeguard_id)) {
        var state = isKnownId("SAFEGUARD_STATES", source.safeguard_state) ? source.safeguard_state : "inserted";
        var already = safeguards.some(function (entry) { return entry.id === source.safeguard_id; });
        if (!already) safeguards.push({ id: source.safeguard_id, state: state });
      }
    });

    return {
      competency_ids: competencies,
      risk_ids: risks,
      lesson_ids: lessons,
      lesson_type_ids: types,
      safeguards: safeguards
    };
  }

  /* ============================================================ *
   * 6. SOURCE CHECK — Contracts section 6.2                       *
   * ============================================================ *
   * An optional post-result workflow. It compares claims only     *
   * against supplied sources or a tool that is genuinely          *
   * connected, and it states that limit every time. A completed   *
   * check is the user's attestation. Nothing here is ever         *
   * "verified by O'Mono".                                         */

  var SOURCE_CHECK_LIMIT_STATEMENT =
    "Comparing an answer against a source is not proof that the source is current, still good law, or complete. " +
    "It shows only whether the supplied material supports the claim.";

  var SOURCE_CHECK_ATTESTATION =
    "Marking a check complete records that you attest to having performed it.";

  var SOURCE_CHECK_BASIS_STATEMENTS = {
    supplied_sources: "Claims are compared against the material you supplied, and against nothing else.",
    connected_tool: "Claims are compared against the connected source tool and the material you supplied.",
    none: "There is nothing to compare against yet. Supply the controlling source, by paste or attachment, first."
  };

  var SOURCE_CHECK_CLAIM_TYPES = [
    "material claim", "citation", "quotation", "calculation", "source-dependent conclusion"
  ];

  function buildSourceCheck(rawTask, options) {
    var task = normalizeTask(rawTask);
    var settings = options || {};
    var offered = task.source_dependency !== "none";

    var suppliedCount = typeof settings.supplied_sources === "number"
      ? settings.supplied_sources : task.signals.sources_supplied;
    var connected = Array.isArray(settings.connected_tools)
      ? settings.connected_tools.filter(function (tool) { return tool && tool.connected === true; })
      : [];

    var basis = "none";
    if (connected.length > 0) basis = "connected_tool";
    else if (suppliedCount > 0) basis = "supplied_sources";

    return {
      offered: offered,
      optional: true,
      part_of_core_workflow: false,
      source_dependency: task.source_dependency,
      claim_types: SOURCE_CHECK_CLAIM_TYPES.slice(),
      status_vocabulary: SOURCE_CHECK_STATUS.slice(),
      comparison_basis: basis,
      can_compare: basis !== "none",
      basis_statement: SOURCE_CHECK_BASIS_STATEMENTS[basis],
      limit_statement: SOURCE_CHECK_LIMIT_STATEMENT,
      attestation: SOURCE_CHECK_ATTESTATION,
      checks: sourcePlanFor(rawTask).checks
    };
  }

  /* One row of the claim-by-claim table. A status the model invented becomes
     `incomplete` — the check did not conclude for that claim — never
     `supported`, which would turn a failure to answer into an answer. */
  function normalizeSourceCheckRow(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var claim = safeText(raw.claim, 400);
    if (!claim) return null;
    var stated = isKnownId("SOURCE_CHECK_STATUS", raw.status);
    return {
      claim: claim,
      status: stated ? raw.status : "incomplete",
      status_was_stated: stated,
      source_ref: safeText(raw.source_ref, 200),
      note: safeText(raw.note, 300)
    };
  }

  function normalizeSourceCheckTable(rows) {
    var list = Array.isArray(rows) ? rows : [];
    var table = [];
    list.forEach(function (raw) {
      var row = normalizeSourceCheckRow(raw);
      if (row) table.push(row);
    });
    return table;
  }

  /* ============================================================ *
   * 7. FIX THIS RESULT — Contracts section 6.3                    *
   * ============================================================ *
   * The exact return route. It accepts the minimum diagnostic     *
   * material and nothing more: never the whole answer, never the  *
   * whole prompt.                                                 */

  var MINIMUM_DIAGNOSTIC_MATERIAL = {
    source_support_mismatch: ["the claim as written", "the passage cited for it"],
    fabricated_citation: ["the citation line", "what you found when you looked for it"],
    outdated_source: ["the source relied on", "the current version or its date"],
    unverifiable_claim: ["the sentence you could not confirm"],
    calculation_error: ["the figure", "the inputs it should come from"],
    scope_drift: ["the conclusion", "the evidence it was drawn from"],
    format_mismatch: ["the structure you needed", "one line of the result as it came back"],
    truncated_output: ["the last line you received", "the section that is missing"],
    refusal_or_block: ["the refusal message"],
    wrong_destination: ["the part the system could not do"]
  };
  Object.keys(MINIMUM_DIAGNOSTIC_MATERIAL).forEach(function (category) {
    Object.freeze(MINIMUM_DIAGNOSTIC_MATERIAL[category]);
  });
  Object.freeze(MINIMUM_DIAGNOSTIC_MATERIAL);

  var FAILURE_REPAIRS = {
    source_support_mismatch: "repair.ground_in_verified_excerpt",
    fabricated_citation: "repair.replace_with_verified_authority",
    outdated_source: "repair.recheck_against_current_source",
    unverifiable_claim: "repair.request_uncertainty_and_sources",
    calculation_error: "repair.recompute_from_inputs",
    scope_drift: "repair.narrow_the_claim",
    format_mismatch: "repair.restate_output_structure",
    truncated_output: "repair.resend_missing_section",
    refusal_or_block: "repair.narrow_the_objective",
    wrong_destination: "repair.change_destination_model"
  };

  var REPAIR_ACTIONS = {
    "repair.ground_in_verified_excerpt": "O'Mono rebuilds the prompt around the excerpt you verified.",
    "repair.replace_with_verified_authority": "O'Mono removes the unsupported authority and requires a verified one.",
    "repair.recheck_against_current_source": "O'Mono rebuilds the prompt against the current version of the source.",
    "repair.request_uncertainty_and_sources": "O'Mono requires the answer to mark what it cannot establish.",
    "repair.recompute_from_inputs": "O'Mono rebuilds the prompt to compute the figure from its inputs, step by step.",
    "repair.narrow_the_claim": "O'Mono narrows the conclusion to the evidence that actually supports it.",
    "repair.restate_output_structure": "O'Mono restates the required structure and reissues the prompt.",
    "repair.resend_missing_section": "O'Mono resends the missing section as its own request.",
    "repair.narrow_the_objective": "O'Mono restates the objective more narrowly and reissues the prompt.",
    "repair.change_destination_model": "O'Mono routes the work to a destination that can do it.",
    "repair.attach_controlling_text": "O'Mono rebuilds the prompt bound to the text you supplied.",
    "repair.reroute_to_authoritative_source": "O'Mono reroutes the prompt to the governing authority.",
    "repair.route_to_live_source": "O'Mono routes the time-sensitive part to a live source.",
    "repair.supply_internal_excerpt": "O'Mono rebuilds the prompt around the record you pasted in.",
    "repair.restate_audience_and_reissue": "O'Mono reissues the prompt for the reader you named.",
    "repair.add_missing_constraint": "O'Mono states the constraint explicitly and reissues the prompt.",
    "repair.reinstate_safeguard": "O'Mono reinstates the safeguard that was removed and reissues.",
    "repair.review_impact_with_owner": "O'Mono reworks the passage with the duty owed stated explicitly.",
    "repair.escalate_for_human_approval": "O'Mono frames the point as an explicit choice for you or your approver."
  };

  function diagnoseFailure(category, rawTask) {
    if (!isKnownId("FAILURE_CATEGORIES", category)) {
      throw new Error("unknown failure category " + JSON.stringify(category));
    }
    var task = normalizeTask(rawTask);
    var repairId = FAILURE_REPAIRS[category];
    return {
      failure_category: category,
      repair_id: repairId,
      bring_back: MINIMUM_DIAGNOSTIC_MATERIAL[category].slice(),
      next_action: REPAIR_ACTIONS[repairId],
      task_family: task.family
    };
  }

  /* The return route for one lesson: what failure to watch for, the least
     material that diagnoses it, and what O'Mono does with it. */
  var RISK_TRIGGERS = {
    "source.fabricated_citation": "a citation you cannot find",
    "source.real_but_mischaracterized": "a claim the cited passage does not support",
    "source.outdated": "a source that turns out to have changed",
    "source.not_authoritative": "a source that does not govern the question",
    "source.unsupplied_but_assumed": "a description of a document you never supplied",
    "model.no_live_access": "a time-sensitive statement you cannot confirm",
    "model.no_internal_access": "a statement about an internal record that does not match it",
    "model.confident_but_unverified": "a confident claim with nothing behind it",
    "model.context_truncation": "a section of your material that went unaddressed",
    "input.ambiguous_objective": "an answer to a neighbouring question",
    "input.missing_audience": "an answer pitched at the wrong reader",
    "input.missing_constraints": "a constraint the answer broke",
    "input.unstated_output_shape": "an answer in the wrong shape",
    "output.unchecked_calculation": "a figure that does not recompute",
    "output.overbroad_claim": "a conclusion wider than its evidence",
    "workflow.no_verification_step": "a result relied on before it was checked",
    "workflow.safeguard_removed": "the failure the removed safeguard prevented",
    "destination.capability_mismatch": "a step the system described instead of doing",
    "destination.policy_ceiling": "a destination your policy does not allow here",
    "responsibility.affected_person": "a passage unfair to the person it concerns",
    "responsibility.human_approval_required": "a decision the answer made for you"
  };

  var RISK_FAILURE_CATEGORIES = {
    "source.fabricated_citation": "fabricated_citation",
    "source.real_but_mischaracterized": "source_support_mismatch",
    "source.outdated": "outdated_source",
    "source.not_authoritative": "source_support_mismatch",
    "source.unsupplied_but_assumed": "unverifiable_claim",
    "model.no_live_access": "outdated_source",
    "model.no_internal_access": "unverifiable_claim",
    "model.confident_but_unverified": "unverifiable_claim",
    "model.context_truncation": "truncated_output",
    "input.ambiguous_objective": "scope_drift",
    "input.missing_audience": "scope_drift",
    "input.missing_constraints": "scope_drift",
    "input.unstated_output_shape": "format_mismatch",
    "output.unchecked_calculation": "calculation_error",
    "output.overbroad_claim": "scope_drift",
    "workflow.no_verification_step": "unverifiable_claim",
    "workflow.safeguard_removed": "source_support_mismatch",
    "destination.capability_mismatch": "wrong_destination",
    "destination.policy_ceiling": "wrong_destination",
    "responsibility.affected_person": "scope_drift",
    "responsibility.human_approval_required": "scope_drift"
  };

  function buildReturnInstruction(unit, rawTask) {
    var source = unit || {};
    var riskId = isKnownId("RISKS", source.risk_id) ? source.risk_id : null;
    var category = riskId ? RISK_FAILURE_CATEGORIES[riskId] : "unverifiable_claim";
    var diagnosis = diagnoseFailure(category, rawTask);
    var task = normalizeTask(rawTask);
    var symptom = riskId ? RISK_TRIGGERS[riskId] : "a claim you cannot confirm";
    return {
      trigger: safeText("If " + subjectPhrase(task) + " comes back with " + symptom + ".", PART_LIMITS.verify_after),
      bring_back: safeText("Bring back " + diagnosis.bring_back.join(", and ") + ". Nothing else is needed.",
        PART_LIMITS.return_if_failure),
      next_action: diagnosis.next_action
    };
  }

  /* ============================================================ *
   * 8. THE TRIGGER/CARD CONTRACT — Contracts section 7.3          *
   * ============================================================ *
   * A trigger is a small embedded pill. Opening one reveals the   *
   * five-part lesson in ONE embedded card, one at a time. This is *
   * the state machine for that rule; the pixels belong to the     *
   * desktop and web workstreams.                                  */

  function teachingPanel(rawTask, options) {
    var coaching = coachingForTask(rawTask, options);
    return {
      coaching: coaching,
      triggers: triggerViewModels(coaching),
      source_plan: sourcePlanFor(rawTask),
      evidence: evidenceFromCoaching(coaching),
      open_lesson_id: null
    };
  }

  function lessonPanelState() {
    return { open_lesson_id: null };
  }

  function openLessonCount(state) {
    return (state && state.open_lesson_id) ? 1 : 0;
  }

  function lessonPanelReducer(state, action, availableLessonIds) {
    var current = (state && typeof state === "object") ? state.open_lesson_id : null;
    var next = { open_lesson_id: current === undefined ? null : current };
    if (!action || typeof action !== "object") return next;

    var available = Array.isArray(availableLessonIds) ? availableLessonIds : [];
    var target = typeof action.lesson_id === "string" ? action.lesson_id : null;
    var onPanel = target !== null && available.indexOf(target) !== -1;

    if (action.type === "open") {
      if (onPanel) next.open_lesson_id = target;
      return next;
    }
    if (action.type === "toggle") {
      if (onPanel) next.open_lesson_id = (current === target) ? null : target;
      return next;
    }
    if (action.type === "close") {
      if (target === null || current === target) next.open_lesson_id = null;
      return next;
    }
    if (action.type === "escape") {
      next.open_lesson_id = null;
      return next;
    }
    return next;
  }

  function applyPanelState(triggers, state) {
    var list = Array.isArray(triggers) ? triggers : [];
    var open = (state && typeof state === "object") ? state.open_lesson_id : null;
    return list.map(function (view) {
      var copy = {};
      Object.keys(view).forEach(function (key) { copy[key] = view[key]; });
      copy.expanded = (open !== null && view.lesson_id === open);
      return copy;
    });
  }

  /* ============================================================ *
   * 9. NO MANDATORY TESTING — Contracts section 7.4               *
   * ============================================================ *
   * Nothing here gates the prompt workflow. Optional exercises    *
   * live in a separate Learn area and never block generating or   *
   * copying a prompt. hasKnowledgeGate() exists so that a         *
   * regression test can prove it stayed that way.                 */

  function workflowGates() { return []; }

  var LEARN_AREA_EXERCISES = {
    "risk.task_specific": [
      "Take a task you did last week and name the one way it could most plausibly have gone wrong.",
      "Compare two of your own requests and say which carried the greater consequence, and why."
    ],
    "ai.limits": [
      "Ask a model something only a current source could answer, then check what it actually did.",
      "Write down what a model can establish by itself, and what it cannot."
    ],
    "review.verify_outputs": [
      "Take one answer and mark every sentence you could not check against a source.",
      "Recompute one figure from a result you already accepted."
    ],
    "instruct.effective": [
      "Rewrite one of your own requests to name the reader, the output shape and one hard constraint.",
      "Give the same request twice, once with an example and once without, and compare."
    ],
    "select.systems_uses": [
      "Pick a recent task and say whether a model was the right tool for it at all.",
      "List which of your destinations can reach live information, and which cannot."
    ],
    "responsibility.human_and_affected": [
      "Name who is affected by a piece of work you produced with AI assistance.",
      "Identify the point in one workflow where a human must sign off, and say why."
    ]
  };

  function learnAreaExercises(competencyId) {
    var canonical = canonicalCompetency(competencyId);
    return {
      competency_id: canonical,
      location: "learn_area",
      required: false,
      blocks_generate: false,
      blocks_copy: false,
      exercises: (canonical && LEARN_AREA_EXERCISES[canonical]) ? LEARN_AREA_EXERCISES[canonical].slice() : []
    };
  }

  var GATE_KEYS = [
    "quiz", "quizzes", "correct_answer", "correct_answers", "required_to_continue",
    "knowledge_check", "knowledge_checks", "teach_back", "teachback", "pass_mark",
    "passing_score", "must_answer", "score_required", "blocks_until_answered"
  ];

  function hasKnowledgeGate(payload, depth) {
    var level = typeof depth === "number" ? depth : 0;
    if (level > 8 || !payload || typeof payload !== "object") return false;
    if (Array.isArray(payload)) {
      return payload.some(function (entry) { return hasKnowledgeGate(entry, level + 1); });
    }
    return Object.keys(payload).some(function (key) {
      if (GATE_KEYS.indexOf(key) !== -1) return true;
      return hasKnowledgeGate(payload[key], level + 1);
    });
  }

  /* A reaction is evidence about the lesson copy, not a mark against the
     reader. The option list is fixed and does not shrink once one is chosen. */
  function normalizeLessonReaction(raw) {
    return isKnownId("LESSON_REACTIONS", raw) ? raw : null;
  }

  function reactionRecord(lessonId, reaction) {
    var normalized = normalizeLessonReaction(reaction);
    if (!isKnownId("LESSONS", lessonId) || normalized === null) return null;
    return { lesson_id: lessonId, reaction: normalized };
  }

  /* ============================================================ *
   * EXPORTS                                                       *
   * ============================================================ *
   * Every published table is frozen. A consumer able to edit the  *
   * lesson library, the label catalog or a rule table at runtime  *
   * could put wording on screen that no test ever saw.            */

  [
    COMPETENCY_ALIASES, TASK_FAMILY_LABELS, CHECK_KEYS, RISK_PHRASES, STATEMENTS,
    CHECK_INSTRUCTIONS, SOURCE_DEPENDENCY_RULES, INTERNAL_SOURCE_TYPES, GENERIC_PHRASES,
    SOURCE_CHECK_CLAIM_TYPES, RISK_TRIGGERS, RISK_FAILURE_CATEGORIES, FAILURE_REPAIRS,
    REPAIR_ACTIONS, LEARN_AREA_EXERCISES, LESSON_LIBRARY, FAMILY_INTERNAL_PRIORITY,
    SOURCE_CHECK_BASIS_STATEMENTS, ANCHOR_STOPWORDS, GATE_KEYS
  ].forEach(function (table) {
    Object.keys(table).forEach(function (key) {
      if (table[key] && typeof table[key] === "object") Object.freeze(table[key]);
    });
    Object.freeze(table);
  });

  return {
    ORGANIZING_COMPETENCY: ORGANIZING_COMPETENCY,
    IDS: IDS,
    COMPETENCY_ALIASES: COMPETENCY_ALIASES,
    TASK_FAMILY_LABELS: TASK_FAMILY_LABELS,
    CHECK_KEYS: CHECK_KEYS,
    LESSON_LIBRARY: LESSON_LIBRARY,
    isKnownId: isKnownId,
    idDictionaries: idDictionaries,
    canonicalCompetency: canonicalCompetency,
    sourceDependencyRank: sourceDependencyRank,

    PART_LIMITS: PART_LIMITS,
    LESSON_PARTS: LESSON_PARTS,
    RISK_PHRASES: RISK_PHRASES,
    safeText: safeText,

    LABEL_CATALOG: LABEL_CATALOG,
    normalizeLessonType: normalizeLessonType,
    chooseLabel: chooseLabel,
    isApprovedLabel: isApprovedLabel,
    accessibleNameFor: accessibleNameFor,
    triggerViewModels: triggerViewModels,
    ledgerRecordFor: ledgerRecordFor,

    MATERIALITY_BOUNDS: MATERIALITY_BOUNDS,
    MATERIALITY_MAX: MATERIALITY_MAX,
    MATERIALITY_FLOOR: MATERIALITY_FLOOR,
    VERY_HIGH_MATERIALITY: VERY_HIGH_MATERIALITY,
    DEFAULT_TRIGGER_LIMIT: DEFAULT_TRIGGER_LIMIT,
    scoreMateriality: scoreMateriality,
    selectTriggers: selectTriggers,

    CONSEQUENTIAL_DOMAINS: CONSEQUENTIAL_DOMAINS,
    SOURCE_DEPENDENCY_RULES: SOURCE_DEPENDENCY_RULES,
    INTERNAL_SOURCE_TYPES: INTERNAL_SOURCE_TYPES,
    CHECK_INSTRUCTIONS: CHECK_INSTRUCTIONS,
    STATEMENTS: STATEMENTS,
    normalizeTask: normalizeTask,
    internalSourceSuggestions: internalSourceSuggestions,
    sourcePlanFor: sourcePlanFor,
    sourcePlanKeys: sourcePlanKeys,

    GENERIC_PHRASES: GENERIC_PHRASES,
    assessTaskSpecificity: assessTaskSpecificity,
    isConcise: isConcise,
    buildCoachingUnit: buildCoachingUnit,
    normalizeModelCoaching: normalizeModelCoaching,
    filterRepeatedGuidance: filterRepeatedGuidance,
    coachingForTask: coachingForTask,
    evidenceFromCoaching: evidenceFromCoaching,

    SOURCE_CHECK_LIMIT_STATEMENT: SOURCE_CHECK_LIMIT_STATEMENT,
    SOURCE_CHECK_ATTESTATION: SOURCE_CHECK_ATTESTATION,
    SOURCE_CHECK_CLAIM_TYPES: SOURCE_CHECK_CLAIM_TYPES,
    buildSourceCheck: buildSourceCheck,
    normalizeSourceCheckRow: normalizeSourceCheckRow,
    normalizeSourceCheckTable: normalizeSourceCheckTable,

    MINIMUM_DIAGNOSTIC_MATERIAL: MINIMUM_DIAGNOSTIC_MATERIAL,
    RISK_TRIGGERS: RISK_TRIGGERS,
    diagnoseFailure: diagnoseFailure,
    buildReturnInstruction: buildReturnInstruction,

    teachingPanel: teachingPanel,
    lessonPanelState: lessonPanelState,
    lessonPanelReducer: lessonPanelReducer,
    applyPanelState: applyPanelState,
    openLessonCount: openLessonCount,

    workflowGates: workflowGates,
    learnAreaExercises: learnAreaExercises,
    hasKnowledgeGate: hasKnowledgeGate,
    normalizeLessonReaction: normalizeLessonReaction,
    reactionRecord: reactionRecord
  };
})();

/* Dual export. The renderer has no require at all; it reads window.OMonoTeaching
   after a plain <script src="shared/teaching/teaching.js"> tag. */
if (typeof module !== "undefined" && module.exports) module.exports = OMonoTeaching;
if (typeof window !== "undefined") window.OMonoTeaching = OMonoTeaching;
