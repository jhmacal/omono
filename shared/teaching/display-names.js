"use strict";
/* The display-name dictionary (curriculum corrections, C1). One place where
 * every machine key becomes English: domains, phenomena, levels, failure
 * categories, and limitations. Every user-facing surface and every
 * human-readable export routes through here; no dotted or underscored key
 * ever faces a user. Unknown keys fall through the humanizer, which
 * produces plain words, never raw keys.
 *
 * Browser-safe: IIFE, dual export, loader-free by the module contract that
 * tests/teaching/module-contract.test.js enforces. */
var OMonoDisplayNames = (function () {

  var DOMAINS = {
    reliability_and_confabulation: "Reliability and hallucination",
    verification_and_evaluation: "Verification and evaluation",
    privacy_and_data_protection: "Privacy and data protection",
    security: "Security",
    bias_and_fairness: "Bias and fairness",
    human_ai_interaction_and_automation_bias: "Working with AI and over-trust",
    model_behavior_and_uncertainty: "Model behavior and uncertainty",
    data_provenance_and_training_data: "Data provenance and training data",
    synthetic_media_and_information_integrity: "Synthetic media and information integrity",
    intellectual_property: "Intellectual property",
    confidentiality_and_privilege: "Confidentiality and privilege",
    governance_and_accountability: "Governance and accountability",
    agentic_systems_and_tool_autonomy: "AI agents and tool autonomy",
    transparency_and_explanation_limits: "Transparency and the limits of explanations",
    harmful_content_and_misuse: "Harmful content and misuse",
    environmental_and_resource_impacts: "Environmental and resource impacts",
    third_party_and_value_chain: "Third parties and the value chain",
    human_oversight_and_decision_making: "Human oversight and decision-making"
  };

  /* V1, the grammar contract: every name is a professional noun phrase
     that reads inside "understanding of X". No verb-phrase poetry. */
  var CONCEPTS = {
    adversarial_generation: "adversarial generation",
    agentic_risk: "real-world agent risk",
    anthropomorphism: "anthropomorphism",
    automation_bias: "automation bias",
    capability_jaggedness: "uneven model capability",
    confabulation: "hallucination",
    context_position_effect: "context-position effects",
    data_minimization: "data minimization",
    detector_bias: "AI-detector unreliability",
    dialect_bias: "dialect bias",
    fluency_miscalibration: "miscalibrated confidence",
    fluency_reliability_gap: "the fluency-reliability gap",
    generation_verification_gap: "the generation-verification gap",
    homogenization: "output homogenization",
    inference_privacy: "inference privacy",
    insecure_codegen: "insecure generated code",
    jailbreak_fragility: "jailbreak susceptibility",
    memorization_leakage: "memorization leakage",
    model_collapse: "model collapse",
    negation_trap: "negation handling errors",
    next_token_prediction: "next-token prediction",
    nondeterminism: "output nondeterminism",
    omission_blindness: "omission blindness",
    parametric_memory: "parametric memory",
    pattern_arithmetic: "pattern-based arithmetic",
    pattern_completion_bias: "pattern-completion bias",
    persona_ineffectiveness: "persona ineffectiveness",
    post_hoc_explanation: "post-hoc explanations",
    prompt_disclosure: "prompt disclosure",
    prompt_injection: "prompt injection",
    resource_intensity: "resource intensity",
    sycophancy: "sycophancy",
    synthetic_media_fabrication: "synthetic media fabrication",
    training_data_density: "training-data density",
    training_data_staleness: "the training cutoff",
    value_chain_opacity: "value-chain opacity",
    /* P6: the five admitted lessons' concepts (names flagged for the
       owner's veto in the block report). */
    brief_vs_script: "agent briefing",
    surface_wraps_model: "product-surface wrapping",
    review_the_plan: "research-plan review",
    one_question_per_pass: "single-question batch review",
    plain_words_still_decide: "plain-language precision"
  };

  var LEVELS = {
    foundational: "Foundational",
    intermediate: "Intermediate",
    advanced: "Advanced"
  };

  var FAILURE_CATEGORIES = {
    "failure.invented_source": "an invented source",
    "failure.missing_context": "missing context",
    "failure.wrong_format": "the wrong format",
    "failure.too_generic": "a too-generic answer",
    "failure.stale_data": "stale data",
    "source.fabricated_citation": "a fabricated citation",
    "source.misread_document": "a misread document",
    "format.structure_drift": "structure drift"
  };

  var SAFEGUARDS = {
    "safeguard.cite_sources": "cite sources",
    "safeguard.no_invented_names": "no invented names",
    "safeguard.quote_exactly": "quote exactly",
    "safeguard.flag_uncertainty": "flag uncertainty",
    "safeguard.check_dates": "check dates"
  };

  /* What the record supports: the interpretation rules, spoken plainly. */
  var RULES = {
    "use.repeated_no_failure": "Repeated use without failure",
    "verification.caught_and_returned": "Verification caught it and the work came back",
    "safeguard.retained_but_failed": "A safeguard kept, yet the work still failed",
    "safeguard.removed_then_preventable_failure": "A safeguard removed, then a preventable failure",
    "lesson.rejected_as_irrelevant": "A lesson rejected as irrelevant"
  };

  /* The learning map's limits are authored sentences already; these are the
     curriculum export's limitation ids, spoken plainly. */
  var LIMITATIONS = {
    "limit.counts_not_cause": "a count is not a cause",
    "limit.use_is_not_evidence": "use counts carry no learning outcome",
    "limit.partial_denominator": "work O'Mono never saw is not counted",
    "limit.evidence_floor": "small counts are withheld rather than over-read",
    "limit.safeguard_retained_failures": "failures under a kept safeguard count against the system, not the person",
    "limit.suppression_applied": "cells below the cohort floor are withheld"
  };

  /* The last resort: plain words, never a raw key. Strips a dotted prefix,
     replaces separators, and never invents meaning. */
  function humanize(key) {
    var text = String(key == null ? "" : key);
    var parts = text.split(".");
    text = parts[parts.length - 1];
    return text.replace(/[_-]+/g, " ").trim();
  }

  function domainName(id) { return DOMAINS[id] || capitalize(humanize(id)); }
  function conceptName(id) { return CONCEPTS[id] || humanize(id); }
  function levelName(id) { return LEVELS[id] || capitalize(humanize(id)); }
  function failureName(id) { return FAILURE_CATEGORIES[id] || humanize(id); }
  function safeguardName(id) { return SAFEGUARDS[id] || humanize(id); }
  function limitationName(id) { return LIMITATIONS[id] || humanize(id); }
  function ruleName(id) { return RULES[id] || capitalize(humanize(id)); }
  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  /* Correct pluralization everywhere (C1): count with its noun. */
  function countNoun(count, singular, plural) {
    var n = Number(count) || 0;
    return n.toLocaleString("en-US") + " " + (n === 1 ? singular : (plural || singular + "s"));
  }

  function listOut(items) {
    var list = (items || []).filter(Boolean);
    if (list.length <= 1) return list.join("");
    /* F2 (D6.4): names may themselves contain "and"; the serial comma
       keeps the list readable instead of chaining ands. */
    var compound = list.some(function (item) { return String(item).indexOf(" and ") > -1; });
    if (list.length === 2 && !compound) return list[0] + " and " + list[1];
    return list.slice(0, -1).join(", ") + ", and " + list[list.length - 1];
  }

  var api = {
    DOMAINS: DOMAINS, CONCEPTS: CONCEPTS, LEVELS: LEVELS,
    FAILURE_CATEGORIES: FAILURE_CATEGORIES, SAFEGUARDS: SAFEGUARDS,
    LIMITATIONS: LIMITATIONS,
    domainName: domainName, conceptName: conceptName, levelName: levelName,
    failureName: failureName, safeguardName: safeguardName,
    limitationName: limitationName, ruleName: ruleName, humanize: humanize,
    capitalize: capitalize, countNoun: countNoun, listOut: listOut
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoDisplayNames;
if (typeof window !== "undefined") window.OMonoDisplayNames = OMonoDisplayNames;
else if (typeof globalThis !== "undefined") globalThis.OMonoDisplayNames = OMonoDisplayNames;
