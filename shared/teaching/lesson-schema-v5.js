"use strict";
/* O'Mono lesson schema v5 (pass four, L1). The LESSON object, the EMISSION
 * record, and the engagement events, exactly as the owner ruled them.
 *
 * The identity that governs everything here: a LESSON teaches a general
 * property of AI, delivered through the specific prompt on the table. The
 * admission gate, verbatim, applied to every canon entry forever:
 *
 *   "Every lesson must reveal a surprising property, limitation, or
 *    consequence of AI that changes how a person understands or uses it."
 *
 * Prompt tips fail the gate by definition; they are coaching, and coaching
 * already lives in the field details. The gate itself is editorial; this
 * module enforces everything enforceable about shape, and carries the gate
 * text so every authoring surface quotes one source.
 *
 * Browser-safe: IIFE, dual export, loader-free by the module contract that
 * tests/teaching/module-contract.test.js enforces. */
var OMonoLessonSchemaV5 = (function () {

  var LESSON_SCHEMA = "omono.lesson.v5";
  var EMISSION_SCHEMA_V1 = "omono.lesson-emission.v1";
  var EMISSION_SCHEMA_V2 = "omono.lesson-emission.v2";
  var EMISSION_SCHEMA = EMISSION_SCHEMA_V2;
  var ENGAGEMENT_SCHEMA = "omono.lesson-engagement.v1";
  var ACTION_SCHEMA = "omono.lesson-action.v2";

  var ADMISSION_GATE = "Every lesson must reveal a surprising property, " +
    "limitation, or consequence of AI that changes how a person understands or uses it.";

  /* The eighteen domains, seeded; owner-editable later. Exactly one per
     lesson. */
  var DOMAINS = [
    "reliability_and_confabulation",
    "verification_and_evaluation",
    "privacy_and_data_protection",
    "security",
    "bias_and_fairness",
    "human_ai_interaction_and_automation_bias",
    "model_behavior_and_uncertainty",
    "data_provenance_and_training_data",
    "synthetic_media_and_information_integrity",
    "intellectual_property",
    "confidentiality_and_privilege",
    "governance_and_accountability",
    "agentic_systems_and_tool_autonomy",
    "transparency_and_explanation_limits",
    "harmful_content_and_misuse",
    "environmental_and_resource_impacts",
    "third_party_and_value_chain",
    "human_oversight_and_decision_making"
  ];

  /* THE FRAMEWORK MAPPING IS A PROPERTY OF THE DOMAIN, NOT OF THE LESSON.

     It used to be generated. The refresh asked the model for a compliance tag
     on every lesson it wrote, and the wire schema required the field with no
     way to leave it empty, so when no honest mapping existed the model produced
     a plausible citation instead. A product whose canon teaches confabulation
     directly was requiring the model to confabulate in a compliance field.

     O'Mono chooses the domain, so the mapping is knowable the moment the brief
     is written. This is that table. It is stamped, never asked for.

     Each NIST value is the one the shipped canon already used most for that
     domain. Where two competed, the owner's tie-break is the tag holding fewer
     lessons across the canon, so that one tag does not swallow everything.

     One row was decided against that rule, on the owner's ruling of
     2026-08-20: model_behavior_and_uncertainty takes Measure. The rule would
     have given it Harmful Bias and Homogenization, but that would file lessons
     about a model's own certainty under a bias heading, and forcing a tag that
     does not fit is the failure this table exists to end. Three of that
     domain's four tagged lessons already read Measure.

     eu_ai_act is "Article 4" on every row, and that is not laziness. Article 4
     is the AI-literacy obligation, and every lesson here is AI literacy. It is
     a property of what this curriculum IS, not a per-domain fact, and inventing
     eighteen different articles to look thorough would be the same sin again.

     There is no `internal` key. It was a third slot in the validator that no
     lesson ever carried and nothing could satisfy, and it was removed on the
     owner's instruction rather than left standing as coverage that was not
     there. */
  var FRAMEWORK_BY_DOMAIN = {
    reliability_and_confabulation:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Confabulation" },
    verification_and_evaluation:
      { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
    privacy_and_data_protection:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Data Privacy" },
    security:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Information Security" },
    bias_and_fairness:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Harmful Bias and Homogenization" },
    human_ai_interaction_and_automation_bias:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Human-AI Configuration" },
    model_behavior_and_uncertainty:
      { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
    data_provenance_and_training_data:
      { eu_ai_act: "Article 4", nist: "NIST AI RMF: Map" },
    synthetic_media_and_information_integrity:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Information Integrity" },
    intellectual_property:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Intellectual Property" },
    confidentiality_and_privilege:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Data Privacy" },
    governance_and_accountability:
      { eu_ai_act: "Article 4", nist: "NIST AI RMF: Govern" },
    agentic_systems_and_tool_autonomy:
      { eu_ai_act: "Article 4", nist: "NIST AI RMF: Manage" },
    transparency_and_explanation_limits:
      { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
    harmful_content_and_misuse:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Information Security" },
    environmental_and_resource_impacts:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Environmental Impacts" },
    third_party_and_value_chain:
      { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Value Chain" },
    human_oversight_and_decision_making:
      { eu_ai_act: "Article 4", nist: "NIST AI RMF: Govern" }
  };

  function frameworkForDomain(domain) {
    var row = FRAMEWORK_BY_DOMAIN[String(domain || "")];
    return row ? { eu_ai_act: row.eu_ai_act, nist: row.nist } : null;
  }

  var LEVELS = ["foundational", "intermediate", "advanced"];
  var TONES = ["straight", "playful", "sarcastic"];

  /* The concept names the phenomenon. The vocabulary grows with the canon:
     this list seeds it and validation checks shape, not membership, so a new
     phenomenon never needs a schema change. */
  var SEED_CONCEPTS = [
    "sycophancy", "confabulation", "automation_bias", "prompt_injection",
    "nondeterminism", "homogenization", "inference_privacy", "agentic_risk",
    "insecure_codegen", "detector_bias"
  ];

  /* Legacy engagement rows remain readable. New rows name the exact action. */
  var ENGAGEMENT_KINDS = ["displayed", "source_opened", "recall_revealed"];
  var ACTION_KINDS = ["selected", "hook_shown", "full_shown", "recall_opened", "source_opened"];

  var ID_SHAPE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
  var CONCEPT_SHAPE = /^[a-z][a-z0-9_]{2,63}$/;
  var URL_SHAPE = /^https?:\/\/\S+$/;
  var DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

  /* Card text bounds. The hook is one bold line; mechanism and consequence
     are the two plain lines under it. One line means one line. */
  var HOOK_MAX = 140;
  var LINE_MAX = 220;
  var SOURCE_LABEL_MAX = 40;

  function isString(v) { return typeof v === "string" && v.trim().length > 0; }
  function oneLine(v) { return isString(v) && v.indexOf("\n") === -1; }

  function checkToneCard(problems, tone, card) {
    if (!card || typeof card !== "object") {
      problems.push(tone + ": the card text is missing");
      return;
    }
    if (!oneLine(card.hook)) problems.push(tone + ": hook must be one non-empty line");
    else if (card.hook.length > HOOK_MAX) problems.push(tone + ": hook longer than " + HOOK_MAX);
    if (!oneLine(card.mechanism)) problems.push(tone + ": mechanism must be one non-empty line");
    else if (card.mechanism.length > LINE_MAX) problems.push(tone + ": mechanism longer than " + LINE_MAX);
    if (!oneLine(card.consequence)) problems.push(tone + ": consequence must be one non-empty line");
    else if (card.consequence.length > LINE_MAX) problems.push(tone + ": consequence longer than " + LINE_MAX);
  }

  function validateLesson(lesson) {
    var problems = [];
    var l = lesson && typeof lesson === "object" ? lesson : {};
    if (l.schema !== LESSON_SCHEMA) problems.push("schema must be " + LESSON_SCHEMA);
    if (!isString(l.lesson_id) || !ID_SHAPE.test(l.lesson_id)) problems.push("lesson_id is not a stable id");
    if (!(Number.isInteger(l.version) && l.version >= 1)) problems.push("version must be a whole number from 1");
    if (!isString(l.concept) || !CONCEPT_SHAPE.test(l.concept)) problems.push("concept must name the phenomenon as a lowercase identifier");
    if (DOMAINS.indexOf(l.domain) === -1) problems.push("domain must be exactly one of the eighteen");
    if (!isString(l.objective)) problems.push("objective is required");
    if (!isString(l.takeaway)) problems.push("takeaway is required");
    if (LEVELS.indexOf(l.level) === -1) problems.push("level must be foundational, intermediate or advanced");
    ["prerequisites", "related"].forEach(function (key) {
      var list = l[key];
      if (list === undefined) return;
      if (!Array.isArray(list)) { problems.push(key + " must be a list of lesson_id references"); return; }
      list.forEach(function (ref) {
        if (!isString(ref) || !ID_SHAPE.test(ref)) problems.push(key + " carries a malformed reference: " + JSON.stringify(ref));
      });
    });
    if (!isString(l.risk_relevance)) problems.push("risk_relevance is required");
    if (!l.source || !isString(l.source.label) || !isString(l.source.url)) {
      problems.push("source must be a pair: short label plus URL");
    } else {
      if (l.source.label.length > SOURCE_LABEL_MAX) problems.push("source label must stay short; the label is what renders");
      if (!URL_SHAPE.test(l.source.url)) problems.push("source url is not a URL");
    }
    /* `internal` was a third disjunct here that no lesson ever carried and
       nothing could satisfy. Removed on the owner's instruction: a compliance
       gate should not offer an option that reads as coverage and holds
       nothing. */
    var framework = l.framework && typeof l.framework === "object" ? l.framework : null;
    if (!framework || !(isString(framework.eu_ai_act) || isString(framework.nist))) {
      problems.push("framework mapping needs at least one of eu_ai_act, nist");
    }
    if (!isString(l.familiar_use_trigger)) problems.push("familiar_use_trigger is required (metadata for matching, never rendered)");
    if (typeof l.hook_standalone !== "boolean") {
      problems.push("hook_standalone must be declared: a hook that cannot stand alone makes the lesson card-only, never wait-eligible");
    }
    /* R-E: the owner's wait ruling is optional and defaults to false. */
    if (l.wait_eligible !== undefined && typeof l.wait_eligible !== "boolean") {
      problems.push("wait_eligible, when present, must be a boolean; absent means card-only");
    }
    if (l.recall !== undefined) {
      if (!oneLine(l.recall) || !/\?$/.test(l.recall.trim())) problems.push("recall must be a one-line question");
    }
    var tones = l.tones && typeof l.tones === "object" ? l.tones : {};
    TONES.forEach(function (tone) { checkToneCard(problems, tone, tones[tone]); });
    return { valid: problems.length === 0, problems: problems };
  }

  /* The render view for one tone. The familiar-use trigger is metadata and
     deliberately absent here: it is never rendered. */
  function renderCard(lesson, tone) {
    var chosen = TONES.indexOf(tone) > -1 ? tone : "straight";
    var card = (lesson.tones && lesson.tones[chosen]) || (lesson.tones && lesson.tones.straight) || {};
    return {
      lesson_id: lesson.lesson_id,
      version: lesson.version,
      revision_key: revisionKey(lesson),
      concept: lesson.concept,
      domain: lesson.domain,
      level: lesson.level,
      hook: String(card.hook || ""),
      mechanism: String(card.mechanism || ""),
      consequence: String(card.consequence || ""),
      source_label: lesson.source ? String(lesson.source.label || "") : "",
      source_url: lesson.source ? String(lesson.source.url || "") : "",
      recall: typeof lesson.recall === "string" ? lesson.recall : null
    };
  }

  function revisionKey(lessonOrId, version) {
    var id = typeof lessonOrId === "string" ? lessonOrId
      : String((lessonOrId && lessonOrId.lesson_id) || "");
    var v = version === undefined && lessonOrId && typeof lessonOrId === "object"
      ? lessonOrId.version : version;
    if (!ID_SHAPE.test(id) || !(Number.isInteger(v) && v >= 1)) return "";
    return id + "@" + v;
  }

  /* Full choreography uses every valid active revision. Hook-only preview
     eligibility stays separate because a preview can need stricter wording. */
  function choreographyEligible(lesson) {
    return !!lesson && lesson.retired_duplicate !== true
      && validateLesson(lesson).valid === true;
  }


  /* R-E: the jargon lint. A hook that names AI jargon without an inline
     plain definition can never rotate on the wait line, whatever the owner
     flag says. A term counts as defined inline only when, before the
     sentence ends, it is followed closely by a parenthetical or a
     "meaning" / "that is" / "in plain terms" clause. The rule is
     deliberately strict: a miss makes the lesson card-only, never broken. */
  var JARGON_TERMS = [
    { term: "agent", shape: /\bagents?\b/i },
    { term: "token", shape: /\btokens?\b/i },
    { term: "context window", shape: /\bcontext windows?\b/i },
    { term: "retrieval", shape: /\bretrievals?\b/i },
    { term: "embedding", shape: /\bembeddings?\b/i },
    { term: "fine-tune", shape: /\bfine[- ]tun(?:e|es|ed|ing)\b/i }
  ];
  function hookJargonLint(lesson) {
    var hits = [];
    var tones = (lesson && lesson.tones && typeof lesson.tones === "object") ? lesson.tones : {};
    TONES.forEach(function (tone) {
      var hook = String(((tones[tone] || {}).hook) || "");
      JARGON_TERMS.forEach(function (entry) {
        var match = entry.shape.exec(hook);
        if (!match) return;
        var after = hook.slice(match.index + match[0].length);
        var defined = /^[^.!?]{0,80}?(\(|\u2014\s*(that is|meaning|in plain (terms|words))|,\s*(that is|meaning|in plain (terms|words)))/i.test(after);
        if (!defined) hits.push({ tone: tone, term: entry.term });
      });
    });
    return { clean: hits.length === 0, hits: hits };
  }

  /* Hook-preview eligibility is the owner's ruling, default false. It does
     not govern the full three-lesson choreography, which uses every active
     valid revision. hook_standalone remains preview authoring metadata. */
  /* U6, owner supremacy: for CANON entries an owner-set wait_eligible true
     overrides the jargon lint (whose verdict still displays as advice on
     the worksheet); for machine-generated candidates the lint stays a hard
     block. The caller says which world the lesson came from. */
  function waitEligible(lesson, options) {
    if (!lesson || lesson.wait_eligible !== true) return false;
    if (options && options.canon === true) return true;
    return hookJargonLint(lesson).clean === true;
  }

  /* Legacy v1 rows remain unchanged. A prospective full display is v2 and
     carries the exact lesson revision and prompt transaction. */
  function makeEmission(input) {
    var src = input && typeof input === "object" ? input : {};
    var problems = [];
    var audience = src.audience === "cohort" ? "cohort" : (src.audience === "user" ? "user" : null);
    if (!audience) problems.push("audience must be user or cohort");
    if (!isString(src.date) || !DATE_SHAPE.test(src.date)) problems.push("date must be YYYY-MM-DD");
    if (!isString(src.lesson_id) || !ID_SHAPE.test(src.lesson_id)) problems.push("lesson_id is required");
    var exposure = Number(src.exposure_count);
    if (!(Number.isInteger(exposure) && exposure >= 1)) problems.push("exposure_count must be a whole number from 1");
    if (!isString(src.context)) problems.push("context is required");
    var hasVersion = src.lesson_version !== undefined && src.lesson_version !== null;
    var hasTransaction = src.transaction_id !== undefined && src.transaction_id !== null;
    var prospective = hasVersion || hasTransaction;
    if (prospective && !(Number.isInteger(src.lesson_version) && src.lesson_version >= 1)) {
      problems.push("lesson_version must be a whole number from 1");
    }
    if (prospective && !oneLine(src.transaction_id)) problems.push("transaction_id is required");
    if (src.display_id !== undefined && !oneLine(src.display_id)) {
      problems.push("display_id must be one non-empty line");
    }
    if (src.occurred_at !== undefined && !(Number.isFinite(Number(src.occurred_at))
        && Number(src.occurred_at) >= 0)) {
      problems.push("occurred_at must be a timestamp");
    }
    if (problems.length) throw new Error("emission refused: " + problems.join("; "));
    var record = {
      schema: prospective ? EMISSION_SCHEMA_V2 : EMISSION_SCHEMA_V1,
      audience: audience,
      date: src.date,
      lesson_id: src.lesson_id,
      exposure_count: exposure,
      context: src.context
    };
    if (prospective) {
      record.lesson_version = src.lesson_version;
      record.transaction_id = src.transaction_id;
      if (isString(src.display_id)) record.display_id = src.display_id;
      if (src.occurred_at !== undefined) record.occurred_at = Number(src.occurred_at);
      if (isString(src.surface)) record.surface = src.surface;
      if (isString(src.role)) record.role = src.role;
    }
    if (isString(src.delivery_context)) record.delivery_context = src.delivery_context;
    return record;
  }

  function makeEngagement(input) {
    var src = input && typeof input === "object" ? input : {};
    var problems = [];
    if (ENGAGEMENT_KINDS.indexOf(src.kind) === -1) {
      problems.push("kind must be one of: " + ENGAGEMENT_KINDS.join(", ") + " (saved and rated are dead)");
    }
    if (!isString(src.lesson_id) || !ID_SHAPE.test(src.lesson_id)) problems.push("lesson_id is required");
    if (!isString(src.date) || !DATE_SHAPE.test(src.date)) problems.push("date must be YYYY-MM-DD");
    if (problems.length) throw new Error("engagement refused: " + problems.join("; "));
    return { schema: ENGAGEMENT_SCHEMA, kind: src.kind, lesson_id: src.lesson_id, date: src.date };
  }

  function makeAction(input) {
    var src = input && typeof input === "object" ? input : {};
    var problems = [];
    if (ACTION_KINDS.indexOf(src.kind) === -1) {
      problems.push("kind must be one of: " + ACTION_KINDS.join(", "));
    }
    if (!isString(src.lesson_id) || !ID_SHAPE.test(src.lesson_id)) problems.push("lesson_id is required");
    if (!(Number.isInteger(src.lesson_version) && src.lesson_version >= 1)) {
      problems.push("lesson_version must be a whole number from 1");
    }
    if (!oneLine(src.transaction_id)) problems.push("transaction_id is required");
    if (!isString(src.date) || !DATE_SHAPE.test(src.date)) problems.push("date must be YYYY-MM-DD");
    if (src.event_id !== undefined && !oneLine(src.event_id)) {
      problems.push("event_id must be one non-empty line");
    }
    if (src.display_id !== undefined && !oneLine(src.display_id)) {
      problems.push("display_id must be one non-empty line");
    }
    if (src.occurred_at !== undefined && !(Number.isFinite(Number(src.occurred_at))
        && Number(src.occurred_at) >= 0)) {
      problems.push("occurred_at must be a timestamp");
    }
    if (src.surface !== undefined && !oneLine(src.surface)) problems.push("surface must be one non-empty line");
    if (src.role !== undefined && !oneLine(src.role)) problems.push("role must be one non-empty line");
    if (problems.length) throw new Error("lesson action refused: " + problems.join("; "));
    var record = {
      schema: ACTION_SCHEMA,
      kind: src.kind,
      lesson_id: src.lesson_id,
      lesson_version: src.lesson_version,
      transaction_id: src.transaction_id,
      date: src.date
    };
    if (isString(src.event_id)) record.event_id = src.event_id;
    if (isString(src.display_id)) record.display_id = src.display_id;
    if (src.occurred_at !== undefined) record.occurred_at = Number(src.occurred_at);
    if (isString(src.surface)) record.surface = src.surface;
    if (isString(src.role)) record.role = src.role;
    return record;
  }

  var api = {
    LESSON_SCHEMA: LESSON_SCHEMA,
    EMISSION_SCHEMA: EMISSION_SCHEMA,
    EMISSION_SCHEMA_V1: EMISSION_SCHEMA_V1,
    EMISSION_SCHEMA_V2: EMISSION_SCHEMA_V2,
    ENGAGEMENT_SCHEMA: ENGAGEMENT_SCHEMA,
    ACTION_SCHEMA: ACTION_SCHEMA,
    ADMISSION_GATE: ADMISSION_GATE,
    DOMAINS: DOMAINS.slice(),
    FRAMEWORK_BY_DOMAIN: FRAMEWORK_BY_DOMAIN,
    frameworkForDomain: frameworkForDomain,
    LEVELS: LEVELS.slice(),
    TONES: TONES.slice(),
    SEED_CONCEPTS: SEED_CONCEPTS.slice(),
    ENGAGEMENT_KINDS: ENGAGEMENT_KINDS.slice(),
    ACTION_KINDS: ACTION_KINDS.slice(),
    HOOK_MAX: HOOK_MAX,
    LINE_MAX: LINE_MAX,
    SOURCE_LABEL_MAX: SOURCE_LABEL_MAX,
    validateLesson: validateLesson,
    renderCard: renderCard,
    revisionKey: revisionKey,
    choreographyEligible: choreographyEligible,
    waitEligible: waitEligible,
    hookJargonLint: hookJargonLint,
    makeEmission: makeEmission,
    makeEngagement: makeEngagement,
    makeAction: makeAction
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoLessonSchemaV5;
if (typeof window !== "undefined") window.OMonoLessonSchemaV5 = OMonoLessonSchemaV5;
else if (typeof globalThis !== "undefined") globalThis.OMonoLessonSchemaV5 = OMonoLessonSchemaV5;
