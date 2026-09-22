"use strict";
/* P7: the dossier-lesson registry. Maps dossier passages to canon lessons
 * by field and pattern. In the Tools UI a mapped passage carries a small
 * expand mark; tapping opens the lesson card inline and writes a REAL
 * lesson emission that counts toward the curriculum. Unmapped dossier
 * reading stays dossier_opened engagement only — that boundary is the
 * owner's to veto.
 *
 * Browser-safe: IIFE, dual export, loader-free. */
var OMonoDossierLessonRegistry = (function () {

  /* Each entry: which dossier fields it inspects, the passage pattern
     (tested case-insensitively against the field's display text), and the
     canon lesson it opens. First match wins per passage. */
  var MAPPINGS = [
    { lesson: "canon.citation-confabulation",
      fields: ["good_at", "avoid", "double_check"],
      pattern: /citation|cite[sd]? |cited|grounding|hallucinat|convincing but false|fabricate/i },
    { lesson: "canon.pattern-arithmetic",
      fields: ["avoid", "double_check", "prompt_surfaces"],
      pattern: /COPILOT function|native formulas|calculations|arithmetic|generated arithmetic/i },
    { lesson: "canon.prompt-is-disclosure",
      fields: ["avoid", "double_check"],
      pattern: /data handling|retention|training terms|sensitive data|confidential|terms withhold|data exfiltration/i },
    { lesson: "canon.agent-real-world",
      fields: ["avoid", "prompt_shaping", "double_check"],
      pattern: /scope|approval|irreversible|boundaries|permission|malicious instructions|prompt injection/i },
    { lesson: "canon.model-swap-underfoot",
      fields: ["models_note", "avoid"],
      pattern: /retir|rollover|swapped|model choice could not|lineup could not|without notice/i },
    /* The five admitted lessons, to their source passages. */
    { lesson: "canon.brief-vs-script",
      fields: ["prompt_shaping"],
      pattern: /brief, not a procedure script|coding brief|let (Cowork|Codex|Agent) plan|its own sequence|guided inputs/i },
    { lesson: "canon.surface-wraps-model",
      fields: ["identity", "prompt_shaping"],
      pattern: /covers the .* product|operates separately|this card covers/i },
    { lesson: "canon.review-the-plan",
      fields: ["prompt_shaping", "prompt_surfaces", "double_check"],
      pattern: /research plan|proposed research plan|inspect the plan|proposes a plan|edit the proposed plan|review its approach/i },
    { lesson: "canon.one-question-per-pass",
      fields: ["prompt_shaping", "avoid"],
      pattern: /one (narrow|atomic) (extraction|classification|question)|per column|one concept per run|column question/i },
    { lesson: "canon.plain-words-still-decide",
      fields: ["prompt_shaping"],
      pattern: /no prompt engineering|no special syntax|context and precision still matter/i }
  ];

  /* The first mapping whose pattern hits the passage text, scoped to the
     dossier field the passage came from; null when unmapped. */
  function lessonForPassage(fieldName, passageText) {
    var text = String(passageText || "");
    for (var i = 0; i < MAPPINGS.length; i += 1) {
      var m = MAPPINGS[i];
      if (m.fields.indexOf(fieldName) === -1) continue;
      if (m.pattern.test(text)) return m.lesson;
    }
    return null;
  }

  var api = { MAPPINGS: MAPPINGS, lessonForPassage: lessonForPassage };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoDossierLessonRegistry;
if (typeof window !== "undefined") window.OMonoDossierLessonRegistry = OMonoDossierLessonRegistry;
else if (typeof globalThis !== "undefined") globalThis.OMonoDossierLessonRegistry = OMonoDossierLessonRegistry;
