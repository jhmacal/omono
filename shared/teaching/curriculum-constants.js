"use strict";
/* The curriculum voice-and-depth constants (the owner's rulings, V1-V6).
 * Every number those rulings name lives here and nowhere else; the
 * curriculum builder, the lesson engine's callers, the synthetic world
 * generator, the document builder and the audits all read this file, and
 * the report prints this table verbatim.
 *
 * Browser-safe: IIFE, dual export, loader-free by the module contract that
 * tests/teaching/module-contract.test.js enforces. */
var OMonoCurriculumConstants = (function () {

  var api = {
    /* ---------- V2 · claim thresholds ---------- */
    /* An area is INTRODUCED at the first teaching moment. */
    INTRODUCED_MIN_MOMENTS: 1,
    /* WORKING_GRASP: at least this many teaching moments in the area,
       across at least this many distinct lessons. */
    WORKING_GRASP_MIN_MOMENTS: 3,
    WORKING_GRASP_MIN_DISTINCT: 2,
    /* STRONG: moments, distinct lessons, and at least one recall revealed
       or source opened in the area. */
    STRONG_MIN_MOMENTS: 5,
    STRONG_MIN_DISTINCT: 3,
    STRONG_MIN_ENGAGEMENT: 1,
    /* A record below STRONG_RECORD_FLOOR total moments may never emit
       "strong"; below HONEST_START_FLOOR it emits only the honest-start
       sentence. */
    STRONG_RECORD_FLOOR: 100,
    HONEST_START_FLOOR: 25,

    /* ---------- V3 · depth ---------- */
    /* Recalls may take at most this share of a session's teaching moments;
       a due lesson past the cap defers, never displacing new teaching. */
    RECALL_SHARE_CAP: 1 / 3,
    /* The report asserts each replayed world's recall share stays at or
       below this. */
    RECALL_SHARE_REPORT_MAX: 0.34,
    /* Promotion uses WORKING_GRASP's own numbers on the level below:
       foundational at working grasp prefers intermediate; intermediate at
       working grasp prefers advanced. (The engine mirrors these two, being
       loader-free; the parity test pins the mirror.) */
    PROMOTE_MIN_MOMENTS: 3,
    PROMOTE_MIN_DISTINCT: 2,

    /* ---------- V4 · gaps ---------- */
    GAP_SENTENCES_MAX: 2,
    GAP_NAMED_DOMAINS_MAX: 4,

    /* ---------- V5 · module honesty ---------- */
    /* A module exists only when its failure category clears this floor. */
    MODULE_FLOOR: 5,
    /* A module names a safeguard only through the semantic map below AND
       when the mapped safeguard was removed in at least this many of the
       category's failures AND at least this share of them. */
    SAFEGUARD_REMOVED_MIN: 5,
    SAFEGUARD_REMOVED_SHARE: 0.2,
    /* Sentence pairs inside one module may not overlap tokens at or above
       this share. */
    MODULE_OVERLAP_MAX: 0.8,
    /* "showing up in real work" appears at most this many times per
       document. */
    FORMULA_MAX_PER_DOC: 1,
    /* The synthetic generator removes the mapped safeguard before a
       failure with this probability, so demonstrations carry signal. */
    GENERATOR_SAFEGUARD_CORRELATION: 0.4,

    /* The semantic map, owner-vetoable: which safeguard a failure category
       may name. A null entry means the category's module carries no
       safeguard sentence at all. */
    SAFEGUARD_FAILURE_MAP: {
      "failure.invented_source": "safeguard.cite_sources",
      "failure.stale_data": "safeguard.check_dates",
      "failure.missing_context": "safeguard.flag_uncertainty",
      "failure.wrong_format": "safeguard.quote_exactly",
      "failure.too_generic": null
    },

    /* ---------- V6 · the document ---------- */
    /* The regenerated document must run at or below this share of the
       prior document's word count. */
    DOC_WORDCOUNT_SHARE_MAX: 0.4,
    /* Duplicate-paragraph law: no paragraph of this many words or more may
       appear twice. */
    DOC_DUP_PARAGRAPH_MIN_WORDS: 15,

    /* ---------- V3 · acceptance floors, per world ---------- */
    ACCEPTANCE: {
      "enterprise-3-full-cohort": { intermediate_domains_min: 10, advanced_domains_min: 3 },
      "personal-3-mature": { intermediate_domains_min: 6, advanced_domains_min: 1 },
      "personal-1-first-week": { past_foundational_domains_max: 2 }
    }
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoCurriculumConstants;
if (typeof window !== "undefined") window.OMonoCurriculumConstants = OMonoCurriculumConstants;
else if (typeof globalThis !== "undefined") globalThis.OMonoCurriculumConstants = OMonoCurriculumConstants;
