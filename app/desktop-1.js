
/* OMONO-PURE-START
   Everything between these markers is pure: no DOM, no IPC, no timers. It is the
   part of the window whose behaviour is worth asserting, so
   tests/palette-renderer.test.js slices this block out and runs it in a bare
   context with the real teaching module loaded. Keep it that way — a DOM call in
   here turns a behaviour test back into a grep. */
"use strict";
var OMonoDesktop = (function () {

  /* Contracts §18. One word each, multi-select, and never evidence of competence:
     the explanation says what the user is telling O'Mono, not what they know. */
  var PURPOSE_CHIPS = [
    { id: "structure", label: "Structure", explanation: "I am unsure how to formulate this request." },
    { id: "speed", label: "Speed", explanation: "I know what I need and want it faster." },
    { id: "review", label: "Review", explanation: "I want a second check or improvement pass." },
    { id: "policy", label: "Policy", explanation: "My organization requires me to use O'Mono." }
  ];

  function purposeIds() { return PURPOSE_CHIPS.map(function (c) { return c.id; }); }

  function togglePurpose(selected, id) {
    var known = purposeIds();
    var current = (Array.isArray(selected) ? selected : []).filter(function (v) {
      return known.indexOf(v) !== -1;
    });
    if (known.indexOf(id) === -1) return current.slice();
    var at = current.indexOf(id);
    if (at === -1) return current.concat([id]);
    return current.filter(function (v) { return v !== id; });
  }

  /* F14: the reduction claim is removed, and the chips keep what was always
     true of them.

     materialQuestions filtered on `q.material` and `q.risk_id`. Neither is a
     field of the frozen interpret question schema, which carries id, q, why,
     options and suggested and nothing else — so the filter matched nothing,
     fell through to its "keep at least one" fallback, and every question
     rendered every time. Speed reduced nothing, ever. Structure and Speed
     together cancelled by construction, because the threshold applied only when
     Speed was chosen WITHOUT Structure, so the two chips the person had selected
     did nothing at all.

     The choice was to implement the filter against fields that exist or to drop
     the claim. Nothing in the schema says which question is material, inventing
     a materiality score is the model deciding what a person may be asked, and a
     chip that silently removes questions removes safeguards by accident. So the
     questions all stand, and the preference reaches the one place it can act
     honestly: the generation call, where Speed asks for a shorter prompt. The
     chips stay a statement about pace and never a claim about the person
     (Contracts §18). */
  function materialQuestions(questions, coaching, selected) {
    void coaching; void selected;
    return (Array.isArray(questions) ? questions : []).slice();
  }

  /* A question arrives with its own choices; yes/no is the fallback, never the
     assumption (Contracts §3.2, DESIGN_RULES: two to four meaningful choices).

     F13: and every question ends with a way out. Four fixed options with one
     preselected is a form that answers itself, and a person whose real answer
     is none of them had nowhere to say so — so they picked the nearest one and
     the prompt was built on it. The escape is last, is never the suggestion,
     and opens a box for their own words. */
  var OTHER_OPTION = { value: "__other", label: "None of these" };
  function questionOptions(question) {
    var seen = {};
    var options = [];
    var raw = question && Array.isArray(question.options) ? question.options : [];
    for (var i = 0; i < raw.length && options.length < 4; i++) {
      var value = String((raw[i] && raw[i].value) || "").trim();
      var label = String((raw[i] && raw[i].label) || value).trim();
      if (!value || !label || seen[value] || value === OTHER_OPTION.value) continue;
      seen[value] = true;
      options.push({ value: value, label: label });
    }
    if (options.length < 2) {
      options = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
    }
    return options.concat([{ value: OTHER_OPTION.value, label: OTHER_OPTION.label }]);
  }
  function isOtherOption(value) { return value === OTHER_OPTION.value; }

  /* The suggested answer is preselected, so confirming without reading is the
     same as accepting what O'Mono proposed rather than an empty form. */
  function suggestedOption(question) {
    var options = questionOptions(question).filter(function (option) {
      return !isOtherOption(option.value);
    });
    var suggested = String((question && question.suggested) || "").trim();
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === suggested) return options[i];
    }
    /* F13: the escape is never preselected. Confirming without reading still
       means accepting what O'Mono proposed, which is the property worth
       keeping; it must never mean "none of these". */
    return options[0];
  }

  function preselectedAnswers(questions) {
    return (Array.isArray(questions) ? questions : []).map(function (q) {
      var option = suggestedOption(q);
      return { id: q && q.id, q: q && q.q, answer: option.value,
        answer_label: option.label, detail: "" };
    });
  }

  /* ---------- teaching ----------
     The label comes from the approved catalog by lesson_type. The renderer never
     writes lesson wording and never falls back to "Be careful" for everything
     (Contracts §7.2). */
  function teaching() {
    return (typeof OMonoTeaching !== "undefined") ? OMonoTeaching
      : (typeof globalThis !== "undefined" ? globalThis.OMonoTeaching : null);
  }

  function teachingPanelFor(task, modelCoaching) {
    var T = teaching();
    if (!T) return { coaching: [], triggers: [], source_plan: null, evidence: null, open_lesson_id: null };
    var normalized = Array.isArray(modelCoaching) && modelCoaching.length
      ? T.normalizeModelCoaching(modelCoaching, task)
      : null;
    var panel = T.teachingPanel(task);
    if (!normalized || !normalized.length) return panel;
    /* What the model sent, scored and capped by the same local rules, so the API
       cannot widen the panel or invent a label. */
    var merged = T.selectTriggers(normalized.concat(panel.coaching));
    return {
      coaching: merged,
      triggers: T.triggerViewModels(merged),
      source_plan: panel.source_plan,
      evidence: T.evidenceFromCoaching(merged),
      open_lesson_id: null
    };
  }

  function triggerLabels(panel) {
    return ((panel && panel.triggers) || []).map(function (view) { return view.label; });
  }

  /* Contracts §7.2: labels must vary. If a panel ever comes back all-identical
     the interface is the last place that can notice. */
  function labelsVary(panel) {
    var labels = triggerLabels(panel);
    if (labels.length < 2) return true;
    for (var i = 1; i < labels.length; i++) {
      if (labels[i] !== labels[0]) return true;
    }
    return false;
  }

  function accessibleNamesOk(panel) {
    return ((panel && panel.triggers) || []).every(function (view) {
      var name = String(view.accessible_name || "").trim().toLowerCase();
      return name.length > 0 && name !== "click here";
    });
  }

  function lessonIds(panel) {
    return ((panel && panel.triggers) || []).map(function (view) { return view.lesson_id; });
  }

  /* One card at a time. The state machine belongs to the teaching module; this is
     only the call site, so the two cannot drift. */
  function lessonReducer(state, action, panel) {
    var T = teaching();
    if (!T) return state || { open_lesson_id: null };
    return T.lessonPanelReducer(state || T.lessonPanelState(), action, lessonIds(panel));
  }

  function triggersWithState(panel, state) {
    var T = teaching();
    if (!T) return [];
    return T.applyPanelState((panel && panel.triggers) || [], state || { open_lesson_id: null });
  }

  function openCardCount(views) {
    return (Array.isArray(views) ? views : []).filter(function (v) { return v && v.expanded; }).length;
  }

  /* ---------- effective policy ----------
     One object decides, and every layer that contributed is shown with it. A
     surface that displayed a different verdict from the one below it would be
     the contradiction Contracts §10 calls a defect. */
  function policyRows(explanation) {
    var layers = (explanation && Array.isArray(explanation.layers)) ? explanation.layers : [];
    return layers.map(function (layer) {
      return {
        id: layer.id,
        label: layer.label,
        result: layer.result,
        result_plain: layer.result_plain,
        controlling: layer.controlling === true,
        why: layer.plain
      };
    });
  }

  function policyFinal(explanation) {
    var final = (explanation && explanation.final) ? explanation.final : null;
    if (!final) return null;
    return {
      result: final.result,
      result_plain: final.result_plain,
      allowed: final.allowed === true,
      why: final.why,
      overridden: final.overridden === true,
      override_note: final.override_note
    };
  }

  function blocksGeneration(explanation) {
    var final = policyFinal(explanation);
    return !!(final && final.allowed === false);
  }

  function needsConfirmation(explanation) {
    var final = policyFinal(explanation);
    return !!(final && final.result === "confirm");
  }

  /* ---------- result ----------
     Canonical components are the mechanism; the legacy eight are a teaching and
     compatibility mapping and are shown only where one exists (Contracts §5). */
  /* U7: components deduplicate by id — a model reply that lists
     sources_inputs twice (the observed defect: two switcher tabs, two Why
     entries, one reading "Duplicate—already addressed above") collapses to
     one row. The row kept is the first that is included with content,
     else the first seen. Every render and assembly path runs through
     here; generate() dedupes at ingest with the same rule so the record
     stays clean. */
  function dedupeComponentsById(components) {
    var list = Array.isArray(components) ? components : [];
    var keptAt = {};
    var out = [];
    list.forEach(function (c) {
      if (!c || typeof c.component_id !== "string") return;
      var id = c.component_id;
      if (keptAt[id] === undefined) {
        keptAt[id] = out.length;
        out.push(c);
        return;
      }
      var kept = out[keptAt[id]];
      var keptGood = kept.include === true && typeof kept.content === "string" && kept.content;
      var thisGood = c.include === true && typeof c.content === "string" && c.content;
      if (!keptGood && thisGood) out[keptAt[id]] = c;
    });
    return out;
  }

  function componentRows(components) {
    return dedupeComponentsById(components).map(function (c) {
      var legacy = typeof c.legacy_field === "string" ? c.legacy_field.trim() : "";
      return {
        component_id: c.component_id,
        label: componentLabel(c.component_id),
        legacy_field: legacy,
        legacy_label: legacy ? legacyLabel(legacy) : null,
        include: c.include === true,
        content: typeof c.content === "string" ? c.content : "",
        verdict: c.verdict,
        because: typeof c.because === "string" ? c.because : "",
        lesson: typeof c.lesson === "string" ? c.lesson : ""
      };
    });
  }

  var COMPONENT_LABELS = {
    persona: "Persona",
    objective: "Objective", deliverables: "Deliverables", context: "Context",
    sources_inputs: "Sources and inputs", audience: "Audience", method: "Method",
    constraints: "Constraints", acceptance_criteria: "Acceptance criteria",
    output_structure: "Output structure", examples: "Examples", tone_style: "Tone and style",
    uncertainty: "Uncertainty", verification: "Verification", tool_instructions: "Tool instructions"
  };
  var LEGACY_LABELS = {
    role: "Role", task: "Task", context: "Context", input: "Input",
    constraints: "Constraints", examples: "Examples", format: "Format", tone: "Tone"
  };
  function componentLabel(id) { return COMPONENT_LABELS[id] || String(id || "").replace(/_/g, " "); }
  function legacyLabel(id) { return LEGACY_LABELS[id] || String(id || "").replace(/_/g, " "); }

  /* ---------- v4: the eight-field canon (D2) ----------
     Role, Task, Context, Input, Constraints, Examples, Format, Tone. The
     destination components stay the mechanism underneath (componentRows is
     untouched); this fold is the view the chips and the prompt text present.
     The fold table is D2's, not the compiler's LEGACY_MAP: method and
     uncertainty fold into constraints, acceptance criteria into format,
     audience into context, and verification leaves the fields entirely to
     become the verification interface. Tool instructions fold into
     constraints except for a destination that drives tools, where they stay
     their own chip. Method is hidden entirely for a reasoning-model
     destination. Nothing here maps into Role: the canon keeps the chip and it
     renders as left out until a component feeds it. */
  var FIELD_CANON = ["role", "task", "context", "input", "constraints", "examples", "format", "tone"];
  var FOLD_MAP_V4 = {
    persona: "role",
    objective: "task", deliverables: "task", method: "constraints",
    audience: "context", context: "context",
    sources_inputs: "input",
    output_structure: "format", acceptance_criteria: "format",
    constraints: "constraints", uncertainty: "constraints",
    examples: "examples",
    tone_style: "tone",
    verification: null,
    tool_instructions: "constraints"
  };

  /* Round two (R7): Role is real. The engine's persona line, the sentence
     the model opens its authored prompt with ("You are ..."), feeds the Role
     field. Audience stays folded into Context: the persona producing the
     output and the reader it is for are different things and are never
     merged. Returns a synthetic component row, or null when the authored
     text opens with no persona. */
  function personaComponentFrom(generation) {
    var text = generation && typeof generation.final_prompt === "string"
      ? generation.final_prompt : "";
    var firstLine = text.split(/\n/).map(function (line) { return line.trim(); })
      .filter(Boolean)[0] || "";
    /* F8: the first SENTENCE, not the first line. A markdown paragraph is one
       line, so this used to lift the whole opening paragraph into Role — three
       sentences, two of them the task, which is precisely the defect. Returning
       null is safe: Role already renders as left out until a component feeds
       it, and an absent Role is honest where a Role full of task is not. */
    var first = (splitSentences(normalizeMarkup(firstLine))[0] || "").trim();
    if (!identitySentence(first)) return null;
    return {
      component_id: "persona",
      legacy_field: "role",
      include: true,
      content: first,
      verdict: "advisable",
      because: "The persona line sets who is producing the output, before anything else is read.",
      lesson: "A stated persona anchors register and defaults; without one the model chooses its own."
    };
  }

  function destinationTraits(profile) {
    var p = profile || {};
    return {
      reasoning: p.reasoning === true,
      tools: !!(p.capabilities && p.capabilities.tools === true)
    };
  }

  /* Which field each component lands in for THIS destination, or null when it
     leaves the surface (verification always; method on a reasoning model). */
  function foldTargetFor(componentId, traits) {
    var t = traits || {};
    if (componentId === "verification") return null;
    if (componentId === "method" && t.reasoning) return null;
    var target = FOLD_MAP_V4[componentId];
    return target === undefined ? "constraints" : target;
  }

  function fieldChips(components, traits) {
    var rows = componentRows(components);
    if (!rows.length) return [];
    /* Only the eight ever render as chips, on every destination (D2). Tool
       instructions live inside Constraints; "kept separate" for a
       tool-driving destination means their own labelled sub-block there and
       their own entry in the field switcher, never a ninth chip. */
    var order = FIELD_CANON.slice();
    var byField = {};
    order.forEach(function (field) { byField[field] = []; });
    rows.forEach(function (row) {
      var target = foldTargetFor(row.component_id, traits);
      if (target && byField[target]) byField[target].push(row);
    });
    return order.map(function (field) {
      var folded = byField[field];
      var included = folded.some(function (row) { return row.include; });
      var label = legacyLabel(field);
      var first = folded[0] || null;
      return {
        field_id: field,
        label: label,
        included: included,
        component_id: first ? first.component_id : null,
        component_ids: folded.map(function (row) { return row.component_id; }),
        accessible_name: included
          ? label + " — in this prompt. Open it."
          : label + " — left out of this prompt. Open it to see why."
      };
    });
  }

  /* The folds land in the generated prompt text: the displayed prompt is
     assembled from the included components under the eight-canon headings, in
     canon order, so what the chips say and what gets copied agree. The
     model's own final_prompt stays untouched on the generation record.

     Round two (R1): the prompt closes with a VERIFICATION block assembled
     from the engine's verification component, exactly where it lived before
     v4. For legal task families the acceptance criteria render inside that
     same block as pass-or-fail lines. Verification is prompt text, never a
     field chip. */
  /* U8: the cross-field dedupe. A sentence with >= 80% token overlap
     against one already placed — in another field or earlier in the same
     field — is dropped; Role carries persona identity only, never an
     imperative restatement of the task. The VERIFICATION block is exempt:
     the legal acceptance echo duplicates Format lines there by law (R1). */
  var IMPERATIVE_OPENERS = /^(write|draft|determine|review|summarize|summarise|analyze|analyse|create|explain|list|compare|check|produce|prepare|assess|evaluate|identify|state|ensure|provide|make|include|use|keep|avoid|focus|deliver)\b/i;
  function sentenceTokens(sentence) {
    var out = {};
    String(sentence).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .forEach(function (tok) { if (tok) out[tok] = true; });
    return out;
  }
  /* F9: how much two sentences overlap, measured against their UNION.

     It used to divide by the smaller token set, which has two consequences and
     both are bad. A short sentence is deleted whenever any longer sentence
     before it happens to contain its words — "Be specific." disappears against
     anything containing "be" and "specific" — and the score is so inflated by
     ordinary shared words that the median pair on real model output scored
     0.45, which made 0.8 the only threshold that did not delete the prompt.

     Measured over the captured corpus (176 sentences, 171 pairs):
       min-denominator  p50 0.450  p90 0.714  p95 0.769  max 0.889
       union (Jaccard)  p50 0.162  p90 0.263  p95 0.333  max 0.800
     The union separates. Ordinary prose sits under 0.35; a genuine restatement
     sits at 0.45 and above. */
  function overlapShare(a, b) {
    var A = Object.keys(a), B = Object.keys(b);
    if (!A.length || !B.length) return 0;
    var both = 0;
    A.forEach(function (tok) { if (b[tok]) both += 1; });
    return both / (A.length + B.length - both);
  }
  /* The bar a sentence has to clear to count as a repeat of one already placed.
     Named, because it is the number that decides whether the dedupe does
     anything at all, and the old one was set where model paraphrase never
     reached it. Cross-field is the repetition a person actually sees — the same
     point under two headings — so it is held to the tighter bar. Inside one
     component a writer may legitimately circle back, so that bar is looser. */
  var DEDUPE_THRESHOLD = 0.45;
  var WITHIN_FIELD_THRESHOLD = 0.6;
  /* Below this a sentence is too short to compare honestly: three words share
     three words with half the language. */
  var MIN_COMPARABLE_TOKENS = 4;
  /* F9: sentences, not fragments. The old split fired after any period followed
     by whitespace, so "1. Target Summary" became the sentence "1." and then the
     sentence "Target Summary" — a one-token fragment that the overlap rule can
     match against almost anything, and a numbered list that rejoins as prose.
     An ordinal or a lettered marker is not the end of a sentence. */
  function splitSentences(text) {
    return String(text)
      .split(/(?<=[.!?])(?!\s*(?:\d+|[a-z])[.)]\s)\s+|\n+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  /* F10: one place where markdown stops.

     The prompt is plain text under plain uppercase labels, and the model writes
     markdown because that is what it writes everywhere else — so "**Target
     Summary**" arrived as four literal asterisks in the middle of a plain-text
     prompt, four times in one field. Nothing stripped it, because the fold was
     the only thing touching the text and the fold does not read markup.

     Emphasis is removed rather than converted: bold in a plain prompt is noise
     the destination cannot use. Headings become plain lines, since the canon
     labels are the only headings this prompt has. Bullets keep their marker,
     because a list is structure and structure is meaning. Nothing else is
     touched — no reflowing, no rewriting, no cleverness. */
  function normalizeMarkup(text) {
    return String(text == null ? "" : text)
      /* fenced code stays exactly as written: it is content, not decoration */
      .replace(/(^|[^`])\*\*\*([^*\n]+)\*\*\*/g, "$1$2")
      .replace(/(^|[^`])\*\*([^*\n]+)\*\*/g, "$1$2")
      .replace(/(^|[\s(])__([^_\n]+)__/g, "$1$2")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2")
      .replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2")
      .replace(/^#{1,6}[ \t]+/gm, "")
      .replace(/[ \t]+$/gm, "");
  }
  /* Applied once, where the response lands, so nothing downstream has to
     remember. The model's own final_prompt is left exactly as it arrived: it is
     the record of what the model wrote and it is never rendered. */
  function normalizeComponents(components) {
    return (Array.isArray(components) ? components : []).map(function (row) {
      if (!row || typeof row !== "object") return row;
      var copy = {};
      Object.keys(row).forEach(function (key) { copy[key] = row[key]; });
      copy.content = normalizeMarkup(row.content);
      return copy;
    });
  }

  /* F8: Role holds who is producing the output, and nothing else.

     The old rule was negative — drop a Role sentence that STARTS with one of
     twenty-six verbs — and it never fired, because a model does not write Role
     as an imperative. It writes "You are preparing a workflow performance
     review for a Friday sponsor meeting. Your task is to evaluate whether the
     targets…", and every one of those sentences begins with a pronoun. Measured
     on the reported prompt: three sentences, zero dropped.

     So the test is positive. A Role sentence is kept only if it reads as an
     identity clause, and anything else is not deleted — it is re-routed to Task
     by the caller, because the model wrote it for a reason. */
  var IDENTITY_OPENERS = /^(you are|you're|writing (as|for)|written for|acting as|the (writer|author|reader) is)\b/i;
  var TASK_MARKERS = /\b(your task is|your job is|you will (identify|produce|write|deliver|provide|assess|evaluate|determine)|based on this evaluation|the (deliverable|output|result) (is|will be)|you (must|should|need to) (write|produce|deliver|identify|assess|evaluate|determine)|in order to)\b/i;
  function identitySentence(sentence) {
    var text = String(sentence || "").trim();
    if (!text) return false;
    if (!IDENTITY_OPENERS.test(text)) return false;
    if (TASK_MARKERS.test(text)) return false;
    /* An identity clause that runs past a comma into an instruction is an
       instruction with a costume on. */
    if (IMPERATIVE_OPENERS.test(text)) return false;
    return true;
  }

  /* F9: the bar a sentence has to clear to count as a repeat. Cross-field
     repetition is the defect people actually see, so it is held to a lower bar
     than repetition inside one component, where a writer may legitimately
     restate. The numbers are tuned against the captured corpus, never chosen. */
  function crossFieldThreshold(field, priorField) {
    return field === priorField ? WITHIN_FIELD_THRESHOLD : DEDUPE_THRESHOLD;
  }

  /* F9: put the kept sentences back the way the model laid them out. Joining
     everything with a space is what flattened numbered lists into one
     paragraph, so the separator that followed a sentence in the source is the
     separator that follows it here. */
  function rejoin(original, kept) {
    var text = String(original || "");
    var out = "";
    var cursor = 0;
    for (var i = 0; i < kept.length; i += 1) {
      var at = text.indexOf(kept[i], cursor);
      if (at === -1) { out += (out ? " " : "") + kept[i]; continue; }
      if (out) {
        var between = text.slice(cursor, at);
        out += between.indexOf("\n") > -1 ? "\n" : " ";
      }
      out += kept[i];
      cursor = at + kept[i].length;
    }
    return out;
  }

  /* F12: one builder, two readers. The fold produces a table of field -> text
     and per-component text; the prompt joins the table under its labels and the
     field detail reads the same table. They cannot disagree, because there is
     only one of them. Before this the chip rendered the component's raw draft
     while the prompt rendered the folded text, and the two were different by
     construction on every prompt where the fold dropped or reflowed anything. */
  function assembleBlocks(components, traits, options) {
    var rows = componentRows(components);
    var placed = []; /* token sets of every sentence already placed */
    /* T4: assembly varies per product surface while the eight chips stay
       the canon. Agent surfaces read brief-style — the objective first,
       then scope and boundaries, identity last; chat surfaces keep the
       canon order. Field set and headings never change. */
    var surface = options && options.surface;
    var isBrief = surface === "agent surface" || surface === "chat-and-agent"
      || surface === "skill-router" || surface === "grid-and-chat";
    var fieldOrder = isBrief
      ? ["task", "context", "input", "constraints", "format", "examples", "tone", "role"]
      : FIELD_CANON;
    var byField = {};
    var byComponent = {};
    var order = [];
    var reroutedToTask = [];
    fieldOrder.forEach(function (field) {
      var contents = [];
      rows.forEach(function (row) {
        if (!row.include || !row.content) return;
        if (foldTargetFor(row.component_id, traits) !== field) return;
        var labelled = row.component_id === "tool_instructions" && (traits || {}).tools;
        var kept = [];
        splitSentences(row.content).forEach(function (sentence) {
          /* F8: a Role sentence that is not an identity clause is not deleted.
             The model wrote it for a reason, so it is carried to Task, where a
             sentence about what to do belongs. Silent deletion is how a fold
             loses a person's instruction without telling them. */
          if (field === "role" && !identitySentence(sentence)) {
            reroutedToTask.push(sentence);
            return;
          }
          var tokens = sentenceTokens(sentence);
          if (Object.keys(tokens).length >= MIN_COMPARABLE_TOKENS) {
            for (var i = 0; i < placed.length; i += 1) {
              if (overlapShare(tokens, placed[i].tokens)
                >= crossFieldThreshold(field, placed[i].field)) return;
            }
          }
          placed.push({ tokens: tokens, field: field });
          kept.push(sentence);
        });
        byComponent[row.component_id] = kept.length ? rejoin(row.content, kept) : "";
        if (!kept.length) return;
        var body = rejoin(row.content, kept);
        contents.push(labelled ? "Tool instructions:\n" + body : body);
      });
      /* Whatever Role sent over arrives at the head of Task, once, under the
         same dedupe as everything else — so a sentence the model wrote twice
         does not come back through this door. */
      if (field === "task" && reroutedToTask.length) {
        var carried = [];
        reroutedToTask.forEach(function (sentence) {
          var tokens = sentenceTokens(sentence);
          if (Object.keys(tokens).length >= MIN_COMPARABLE_TOKENS) {
            for (var i = 0; i < placed.length; i += 1) {
              if (overlapShare(tokens, placed[i].tokens)
                >= crossFieldThreshold("task", placed[i].field)) return;
            }
          }
          placed.push({ tokens: tokens, field: "task" });
          carried.push(sentence);
        });
        if (carried.length) contents.unshift(carried.join(" "));
      }
      if (!contents.length) return;
      byField[field] = contents.join("\n\n");
      order.push(field);
    });
    var verification = rows.filter(function (row) {
      return row.component_id === "verification" && row.include && row.content;
    }).map(function (row) { return row.content; });
    var legalAcceptance = [];
    if (options && options.legal) {
      rows.forEach(function (row) {
        if (row.component_id !== "acceptance_criteria" || !row.include || !row.content) return;
        row.content.split(/(?<=\.)\s+|\n+/).forEach(function (line) {
          line = line.trim();
          if (line) legalAcceptance.push("Pass or fail: " + line);
        });
      });
    }
    /* T4: the selected tool's double_check entries join the block — the
       dossier's own sentences, display-stripped, never invented here. */
    var dossierChecks = (options && options.double_check_lines) || [];
    var verificationBlock = (verification.length || legalAcceptance.length || dossierChecks.length)
      ? verification.concat(legalAcceptance).concat(dossierChecks).join("\n")
      : "";
    /* R3: where every component actually ended up, decided by the same pass
       that decided the prompt, so no screen has to guess.

       Three states and only three. `field`, its text is under one of the eight
       headings. `verification`, its text is in the closing block, which is
       prompt text and never a chip. `dropped`, nothing of it reached the
       prompt. A component the model marked include:false is `dropped` with the
       model's own reason; a component the fold removed is `dropped` with the
       fold's. Before this the interface had two states and used them for three,
       which is how the panel came to list Method as part of a prompt that did
       not contain a word of it. */
    var placement = {};
    rows.forEach(function (row) {
      var id = row.component_id;
      if (!row.include) {
        placement[id] = { where: "dropped", by: "model", field: null,
          why: "The model left this out of the prompt." };
        return;
      }
      if (!String(row.content || "").trim()) {
        placement[id] = { where: "dropped", by: "model", field: null,
          why: "The model included this but wrote nothing in it." };
        return;
      }
      if (id === "verification") {
        placement[id] = { where: verificationBlock ? "verification" : "dropped",
          by: verificationBlock ? null : "fold", field: null,
          why: verificationBlock
            ? "This is the prompt's closing VERIFICATION block, which is prompt text and never a field."
            : "Nothing reached the closing block." };
        return;
      }
      var target = foldTargetFor(id, traits);
      if (target === null) {
        placement[id] = { where: "dropped", by: "destination", field: null,
          why: id === "method"
            ? "This destination reasons on its own, so O'Mono leaves the method block out. Vendor guidance is that step-by-step orders can make these models worse."
            : "This destination has no field for it." };
        return;
      }
      if (!byComponent[id]) {
        placement[id] = { where: "dropped", by: "repeat", field: target,
          why: "Everything here already appears in another field, so the prompt does not repeat it." };
        return;
      }
      placement[id] = { where: "field", by: null, field: target, why: "" };
    });
    return { byField: byField, byComponent: byComponent, order: order,
      placement: placement, verification: verificationBlock };
  }

  /* R3: the placement table, for the screens that describe the prompt. */
  function componentPlacement(components, traits, options) {
    return assembleBlocks(components, traits, options).placement;
  }
  /* R3: one sentence naming where a component ended up, in the person's terms.
     Used by the reasoning panel and by the component screen so the two cannot
     tell different stories about the same component. */
  function placementLine(place, label) {
    var p = place || {};
    if (p.where === "field") return label + " is in " + legacyLabel(p.field) + ".";
    if (p.where === "verification") return label + " is in the closing VERIFICATION block.";
    return label + " is not in this prompt. " + (p.why || "");
  }

  function assembleFromComponents(components, traits, options) {
    var built = assembleBlocks(components, traits, options);
    var blocks = built.order.map(function (field) {
      return legacyLabel(field).toUpperCase() + "\n" + built.byField[field];
    });
    if (built.verification) blocks.push("VERIFICATION\n" + built.verification);
    return blocks.join("\n\n");
  }

  /* F12: what a chip shows. The folded text for that field, which is the text
     the prompt contains — not the model's raw draft behind it. */
  function fieldDetailText(components, chip, traits, options) {
    if (!chip) return "";
    var built = assembleBlocks(components, traits, options);
    return built.byField[chip.field_id] || "";
  }
  /* The same, for one component inside a folded field. */
  function componentDetailText(components, componentId, traits, options) {
    var built = assembleBlocks(components, traits, options);
    return built.byComponent[componentId] === undefined ? "" : built.byComponent[componentId];
  }

  /* "Before relying" is the required-level half of the verification panel; the
     suggested half is advice. Both come from the generation response, never from
     wording invented here. */
  function beforeRelying(generation) {
    var panel = (generation && Array.isArray(generation.verification_panel))
      ? generation.verification_panel : [];
    return panel.filter(function (row) { return row && row.level === "required"; });
  }

  function alsoWorthChecking(generation) {
    var panel = (generation && Array.isArray(generation.verification_panel))
      ? generation.verification_panel : [];
    return panel.filter(function (row) { return row && row.level !== "required"; });
  }

  function returnRoute(generation) {
    var route = generation && generation.return_instruction;
    if (!route) return null;
    return {
      trigger: String(route.trigger || ""),
      bring_back: String(route.bring_back || ""),
      next_action: String(route.next_action || "")
    };
  }

  /* Source Check is offered when the task depends on something outside the model
     (Contracts §6.1, §6.2). `none` is the only level that does not. */
  function sourceCheckApplies(task) {
    var dependency = task && task.source_dependency;
    return typeof dependency === "string" && dependency !== "" && dependency !== "none";
  }

  var CLAIM_STATUS_LABELS = {
    supported: "Supported", contradicted: "Contradicted", not_found: "Not found",
    incomplete: "Incomplete", requires_different_source: "Needs a different source"
  };
  function claimStatusLabel(status) { return CLAIM_STATUS_LABELS[status] || String(status || ""); }

  /* What Fix This Result accepts. The category is recorded; the material never is
     (Contracts §6.3, §12). This mirrors the frozen list in shared/evidence, which
     the renderer cannot load — it is main-process only and would collide with
     engine.js — so it is stated here as UI vocabulary and nothing else. A test
     holds it against the evidence module so the two cannot drift. */
  var RETURNED_MATERIAL_CATEGORIES = ["sentence", "citation", "claim", "source_passage",
    "error_message", "output_fragment", "other"];
  var RETURNED_MATERIAL_LABELS = {
    sentence: "A sentence that did not hold up",
    citation: "A citation",
    claim: "A claim",
    source_passage: "A passage from a source I verified",
    error_message: "An error message",
    output_fragment: "A fragment of the output",
    other: "Something else"
  };
  function returnedMaterialLabel(id) { return RETURNED_MATERIAL_LABELS[id] || String(id || ""); }

  /* ---------- errors ----------
     A human headline and one action, with the technical detail available and
     never in front (Contracts §3.5.6). A raw parser error is never the message. */
  function errorView(failure) {
    var e = failure && typeof failure === "object" ? failure : {};
    var detail = e.detail && typeof e.detail === "object" ? e.detail : {};
    var technical = [];
    ["phase", "provider", "model", "response_id", "stop_reason", "schema_path", "retry_status", "technical"]
      .forEach(function (key) {
        var value = detail[key];
        if (value !== undefined && value !== null && String(value) !== "") {
          technical.push(key.replace(/_/g, " ") + ": " + String(value));
        }
      });
    return {
      state: e.state || "unknown",
      headline: String(e.headline || "O'Mono could not finish that."),
      action: String(e.next_step || "Try again, or change what you asked for."),
      repairable: e.repairable === true,
      technical: technical
    };
  }

  /* ---------- geometry ----------
     The window grows upward to the compact ceiling the main process reports, and
     then the body scrolls. The renderer never decides the ceiling. */
  function contentHeightFor(measured, chrome, compactMaxHeight, minHeight) {
    /* F1: the floor sits below the slim landing (content ~190). */
    var floor = Number.isFinite(minHeight) ? minHeight : 170;
    var ceiling = Number.isFinite(compactMaxHeight) ? compactMaxHeight : 900;
    var wanted = Math.ceil((Number(measured) || 0) + (Number(chrome) || 0));
    return Math.max(floor, Math.min(ceiling, wanted));
  }

  function scrollsInternally(measured, chrome, compactMaxHeight) {
    return contentHeightFor(measured, chrome, compactMaxHeight) <
      Math.ceil((Number(measured) || 0) + (Number(chrome) || 0));
  }

  /* ---------- theme ---------- */
  var THEME_SOURCES = ["system", "light", "dark"];
  function normalizeThemeSource(value) {
    return THEME_SOURCES.indexOf(value) === -1 ? "system" : value;
  }
  function resolveTheme(report) {
    var r = report && typeof report === "object" ? report : {};
    var source = normalizeThemeSource(r.source);
    var resolved = r.resolved === "dark" ? "dark" : "light";
    return { source: source, resolved: source === "system" ? resolved : source };
  }

  /* ---------- Local Matter Screening ----------
     One function owns the visibility decision, and it answers from the view the
     policy module produced. Nothing about the feature exists on screen before it
     is configured: no control, no status line, no empty box, no sample name, no
     developer enum, no "0 entries" (Contracts §18). */
  function matterScreeningVisible(view) {
    return !!(view && view.configured === true && view.visible === true);
  }

  function matterStatusLine(view) {
    if (!matterScreeningVisible(view)) return null;
    var count = view.status_line ? view.status_line.entry_count : view.entry_count;
    var enabled = view.enabled !== false;
    return (enabled ? "On" : "Paused") + ". " + count +
      (count === 1 ? " name or reference" : " names and references") +
      ", encrypted on this Mac, matched here and never sent.";
  }

  function matterActions(view) {
    return matterScreeningVisible(view) && Array.isArray(view.actions) ? view.actions.slice() : [];
  }

  /* ---------- creator sheet ----------
     The renderer holds no password, no verifier, and nothing derived from one.
     It holds what the sheet must show and what it must collect (Contracts §11). */
  function creatorSheetState(capabilities, elevation, outcome) {
    var caps = capabilities && typeof capabilities === "object" ? capabilities : {};
    var elev = elevation && typeof elevation === "object" ? elevation : {};
    var out = outcome && typeof outcome === "object" ? outcome : null;
    return {
      available: caps.available === true,
      unavailable_reason: caps.available === true ? null
        : (caps.reason || "Creator authority is not available in this build."),
      elevated: elev.elevated === true,
      expires_at: Number.isFinite(elev.expires_at) ? elev.expires_at : null,
      needs_password: caps.available === true && elev.elevated !== true,
      needs_reason: caps.requires_typed_reason !== false,
      needs_warning_acknowledgement: caps.requires_direct_transmission_warning !== false,
      warning: out && out.warning ? out.warning : null,
      denied_reason: out ? out.denied_reason : null,
      preserved_classification: out ? out.preserved_classification : null,
      bypassed_layers: out && Array.isArray(out.bypassed_layers) ? out.bypassed_layers.slice() : []
    };
  }

  function elevationRemaining(expiresAt, now) {
    if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) return null;
    return Math.max(0, Math.round((expiresAt - now) / 1000));
  }

  /* ---------- work event ----------
     Metadata only: no actor, no device, no content, and the canonical ids the
     evidence module accepts (Contracts §12). */
  function workEventFrom(input) {
    var i = input && typeof input === "object" ? input : {};
    var evidence = i.evidence && typeof i.evidence === "object" ? i.evidence : {};
    var task = i.task && typeof i.task === "object" ? i.task : {};
    return {
      transaction_id: i.transaction_id,
      ts: i.ts,
      model_profile: i.model_profile,
      task_family: evidence.task_family || task.family || "other",
      source_dependency: task.source_dependency || "none",
      use_context: task.use_context || "personal",
      purpose: (Array.isArray(i.purpose) ? i.purpose : []).filter(function (p) {
        return purposeIds().indexOf(p) !== -1;
      }),
      competency_ids: Array.isArray(evidence.competency_ids) ? evidence.competency_ids : [],
      risk_ids: Array.isArray(evidence.risk_ids) ? evidence.risk_ids : [],
      lesson_ids: Array.isArray(i.lesson_ids) ? i.lesson_ids : [],
      lesson_type_ids: Array.isArray(i.lesson_type_ids) ? i.lesson_type_ids : [],
      /* v4 (D5): the state is the join of what the teaching panel required
         and what the built prompt carries. Required and present: retained.
         Present only: inserted. Required but absent from the prompt: removed
         — that is the record the removed-then-failed pair is built on. */
      safeguards: (function () {
        var present = Array.isArray(evidence.safeguard_ids) ? evidence.safeguard_ids : [];
        var required = Array.isArray(i.required_safeguard_ids) ? i.required_safeguard_ids : [];
        var rows = present.map(function (id) {
          return { id: id, state: required.indexOf(id) > -1 ? "retained" : "inserted" };
        });
        required.forEach(function (id) {
          if (present.indexOf(id) === -1) rows.push({ id: id, state: "removed" });
        });
        return rows;
      })(),
      destination: i.destination,
      policy_result: i.policy_result || "pass",
      outcome: "not_evaluated",
      content_stored: i.content_stored === true
    };
  }

  /* POSTURE_PLAIN is a flat map of strings — {light: "Light"} — not a map of
     objects. Reading `.label` off it yields undefined, which is how the setup
     chips came to read "light / intermediate / strict" in raw lowercase. Four
     other call sites already treat it as a string, so the renderer is what was
     wrong, not the vocabulary. */
  function postureLabel(plain, id) {
    var key = typeof id === "string" ? id : "";
    var value = plain && typeof plain === "object" ? plain[key] : null;
    return typeof value === "string" && value ? value : key;
  }

  /* The one-line state of a password reveal control. Kept here so the button's
     label, its pressed state, its accessible name and the input's type can never
     drift apart — a toggle that says "Hide" over a still-concealed field is the
     failure this shape prevents. */
  function passwordRevealLabel(revealed, fieldName) {
    var showing = revealed === true;
    var name = (typeof fieldName === "string" && fieldName.trim()) || "password";
    return {
      inputType: showing ? "text" : "password",
      text: showing ? "Hide" : "Show",
      ariaPressed: showing ? "true" : "false",
      ariaLabel: (showing ? "Hide the " : "Show the ") + name
    };
  }

  /* Split a long assumption list into what is shown and what waits behind a
     disclosure. Not a cap: MANUAL.md promises "Each one, listed, so you can
     strike the wrong ones", and everything here stays reachable and strikeable.
     Order is the model's own, which the prompt now asks to be meaningful. */
  function surfacedAssumptions(list, limit) {
    var all = Array.isArray(list) ? list : [];
    var ceiling = typeof limit === "number" && limit > 0 ? limit : 4;
    if (all.length <= ceiling) return { surface: all.slice(), deferred: [] };
    return { surface: all.slice(0, ceiling), deferred: all.slice(ceiling) };
  }

  /* One closing line for the whole interpretation. selectTriggers() already
     ranks by materiality, so triggers[0] is the lesson that matters most here —
     no new selection rule. This is a RESTATEMENT of a lesson already on screen,
     never a fourth trigger: Contracts §7.3 caps the row at three, and a tip that
     added itself to it would breach the cap. Advisory only; it gates nothing. */
  function closingTip(panel) {
    var triggers = panel && Array.isArray(panel.triggers) ? panel.triggers : [];
    if (!triggers.length) return null;
    var top = triggers[0];
    var text = top && top.card ? top.card.be_careful : "";
    if (!text) return null;
    return { label: top.label || "", text: text, lesson_id: top.lesson_id || "" };
  }

  /* The prompt's own anatomy, as a row of controls rather than a collapsed list
     at the foot of the page. Every component appears, included or not: seeing
     that EXAMPLES and INPUT were left out is how a person learns what their
     prompt is missing, and hiding the omissions hides the lesson.

     The name is the component the model actually produced, never the legacy
     eight. Which components exist varies with the assembly profile, so a fixed
     ROLE / TASK / CONTEXT / INPUT row would be a label the prompt does not have —
     legacy_field is a compatibility mapping, not what this prompt is made of. */
  function componentButtons(components) {
    return componentRows(components).map(function (row) {
      var label = row.label;
      return {
        component_id: row.component_id,
        label: label,
        included: row.include,
        verdict: row.verdict,
        /* The visual difference is fill versus outline, which a screen reader
           cannot see, so the state belongs in the name. */
        accessible_name: row.include
          ? label + " — in this prompt. Open it."
          : label + " — left out of this prompt. Open it to see why."
      };
    });
  }

  /* Whether a finished prompt can be reopened, and what to say when it cannot.
     The encrypted snapshots have been written all along; nothing read them, so a
     prompt was listed in History and unreachable. */
  /* Takes plain booleans rather than the ledger row: deciding here whether the
     row was written in a text-free mode would put that mode's name in this
     block, and tests/palette-renderer.test.js holds the line that nothing in
     here reasons about stored-credential shapes. */
  /* ---------- F4: which destinations may be offered ----------
     Two different questions, kept apart. offerableProfiles answers "may this
     engine profile be offered at all" — retired and deprecated never may, on
     any surface. profilesForTool answers "does THIS tool offer a model choice,
     and which" — the dossier's own models[], mapped onto engine profiles. A
     tool whose dossier lists no models has no model choice; its engine seat
     carries the prompt and is named rather than silently replaced by whatever
     sits first in the engine table. */

  /* Dossier ids carry the vendor's public spelling ("gpt-5.6-sol"); engine
     profile ids carry the API's ("gpt-5-6-sol"). Same model, and they were
     failing to match on a dot — the whole difference between Codex offering
     its own models and offering none. */
  function sameModelId(a, b) {
    var key = function (v) { return String(v == null ? "" : v).toLowerCase().replace(/[.\s_]/g, "-"); };
    return key(a) === key(b);
  }

  function offerableProfiles(profiles, today) {
    var day = String(today || "");
    return (Array.isArray(profiles) ? profiles : []).filter(function (p) {
      if (!p) return false;
      if (p.status === "deprecated") return false;
      var retiredOn = p.lifecycle && p.lifecycle.retired_on;
      if (retiredOn && day && retiredOn <= day) return false;
      return true;
    });
  }

  function profilesForTool(dossier, profiles, today, selectable) {
    if (!dossier) return [];
    var pick = typeof selectable === "function" ? selectable : function (d) {
      var root = (typeof globalThis !== "undefined" && globalThis) || {};
      var R = root.OMonoToolRegister;
      return R ? R.selectableModels(d, today) : [];
    };
    var offerable = offerableProfiles(profiles, today);
    var seen = {};
    var out = [];
    pick(dossier).forEach(function (m) {
      for (var i = 0; i < offerable.length; i++) {
        if (!sameModelId(offerable[i].model_id, m && m.id)) continue;
        var key = offerable[i].system_id + " " + offerable[i].model_id;
        if (seen[key]) return;
        seen[key] = true;
        out.push(offerable[i]);
        return;
      }
    });
    return out;
  }

  function engineSeatFor(dossier, profiles) {
    var seat = dossier && dossier.engine_profile;
    if (!seat) return null;
    var list = Array.isArray(profiles) ? profiles : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].system_id === seat.system_id
        && list[i].model_id === seat.model_id) return list[i];
    }
    return null;
  }

  /* C2: THE GENERATE WAIT IS A FIXED CADENCE, NOT A NETWORK REPORT.

     While Generate remains pending, this runs on a clock: six steps across
     sixty-seven seconds. A completed prompt interrupts it immediately, so the
     app records only the complete cards that actually reached the screen.

     The two rotation lessons RESOLVE here: mechanism and consequence, not the
     hook again. The hook was already spent during the interpret wait, and
     repeating it is the difference between a wait that teaches and a wait that
     recites. The third slot is the closing lesson's hook and its recall
     question, held back because its own binding line has not been written yet
     when the wait begins. */
  var GENERATE_CADENCE = [
    { kind: "status", hold: 4000 },
    { kind: "lesson", slot: 0, hold: 20000, form: "full" },
    { kind: "status", hold: 4000 },
    { kind: "lesson", slot: 1, hold: 20000, form: "full" },
    { kind: "status", hold: 4000 },
    { kind: "closing", slot: 2, hold: 15000, form: "hook_recall" }
  ];

  function generateCadence() { return GENERATE_CADENCE.map(function (s) { return s; }); }

  function generateCadenceTotalMs() {
    var total = 0;
    for (var i = 0; i < GENERATE_CADENCE.length; i++) total += GENERATE_CADENCE[i].hold;
    return total;
  }

  /* Which step is on screen at `ms`. Null once the cadence has run out, which
     is the only condition that puts the overrun line up. */
  function generateCadenceStepAt(ms) {
    var t = Number(ms) || 0;
    if (t < 0) t = 0;
    var edge = 0;
    for (var i = 0; i < GENERATE_CADENCE.length; i++) {
      edge += GENERATE_CADENCE[i].hold;
      if (t < edge) {
        return { index: i, step: GENERATE_CADENCE[i], endsAt: edge };
      }
    }
    return null;
  }

  /* What a resolved lesson reads as on the wait line. */
  function waitLessonText(view, form, connection) {
    if (!view) return "";
    if (form === "hook_recall") {
      var recall = String(view.recall || "").trim();
      return recall ? String(view.hook || "") + " " + recall : String(view.hook || "");
    }
    if (form === "full") {
      var parts = [String(view.mechanism || "").trim(), String(view.consequence || "").trim(),
        String(connection || "").trim()];
      var body = parts.filter(function (x) { return x; }).join(" ");
      return body || String(view.hook || "");
    }
    return String(view.hook || view.line || "");
  }

  /* C2: what stands in when no lesson resolves for a slot.

     These never mention lessons. A person who retries and gets a lesson the
     second time must not be able to tell that anything was missing the first
     time, so nothing here can be read as an apology or an absence. Each line
     is about their idea and what is coming, which is the shape the owner's own
     playful and sarcastic lines take. */
  var WAIT_FALLBACK_LINES = {
    straight: [
      "Good idea. The interesting part is next.",
      "That one's worth doing properly. Stay with it.",
      "Solid one. You'll see where this goes."
    ],
    playful: [
      "nice one! you're in for a ride here",
      "good idea. wait until you see what's next",
      "there's a surprise waiting for you, prompt engineer"
    ],
    sarcastic: [
      "a lot of effort there... (sure)",
      "idea's ok. but will you actually read this?",
      "so cool... as cool as a prompt can be"
    ]
  };

  function waitFallbackLine(tone, index) {
    var set = WAIT_FALLBACK_LINES[tone] || WAIT_FALLBACK_LINES.straight;
    var i = Number(index) || 0;
    return set[((i % set.length) + set.length) % set.length];
  }

  /* Clicking the third slot cannot open a card: the closing lesson has no
     written binding line until generate returns. */
  var CLOSING_SLOT_LINE = "it's coming, sit back.";

  /* Past the cadence. Distinct from the fallback lines on purpose: this one
     IS about the wait, because by now the person can see that it is long. */
  var OVERRUN_LINE = "Still going. This one is taking longer than most.";

  /* WHOSE LIMIT IS IT.

     "GPT-5.6 Sol — this tool offers no model choice" is false. ChatGPT offers a
     lineup and its own dossier says so: model_choice reads "Yes". What is
     actually true is that O'Mono holds a verified profile for one of its
     models. The screen was reporting a gap in our records as a fact about
     somebody else's product.

     It said so about six of the eleven tools. Four whose dossier records no
     lineup at all while claiming one exists (ChatGPT, Claude Cowork, Copilot,
     Harvey), and Gemini, whose dossier lists three models and whose profiles
     exist for none of them. Codex is the fifth shape: seven models listed, one
     profiled, so a dropdown appears with a single entry and says nothing about
     the other six.

     Three states, and the difference between the second and the third is the
     whole point. R3's rule, applied to somebody else's product: say what is
     ours and say what is theirs, and never dress one as the other. */
  function modelChoiceState(dossier, profiles, today, selectable) {
    if (!dossier) return { state: "unknown", listed: 0, offered: 0 };
    var offered = profilesForTool(dossier, profiles, today, selectable);
    var pick = typeof selectable === "function" ? selectable : function (d) {
      var root = (typeof globalThis !== "undefined" && globalThis) || {};
      var R = root.OMonoToolRegister;
      return R ? R.selectableModels(d, today) : [];
    };
    var listed = pick(dossier).length;
    /* The dossier's own words. "No" is a finding; "No user choice could be
       established" and "Could not be established" are the absence of one, and
       they must not be reported as the tool's limitation. */
    var claim = String(dossier.model_choice || "").trim().toLowerCase();
    var saysNone = claim === "no" || claim === "no." || claim === "none";
    if (offered.length && offered.length >= listed) {
      return { state: "offered", listed: listed, offered: offered.length };
    }
    if (offered.length) {
      return { state: "partly_profiled", listed: listed, offered: offered.length };
    }
    if (saysNone) return { state: "none", listed: listed, offered: 0 };
    return { state: "unprofiled", listed: listed, offered: 0 };
  }

  /* One sentence, for the screen. `label` is the model the prompt will go to. */
  function modelChoiceLine(state, toolName, label) {
    var tool = toolName || "This tool";
    var to = label || "one model";
    if (!state) return to + ".";
    if (state.state === "none") return to + " — " + tool + " offers no model choice.";
    if (state.state === "partly_profiled") {
      return tool + " offers " + state.listed + " models. O'Mono has a checked "
        + "record for " + state.offered + " of them, so only "
        + (state.offered === 1 ? "that one is" : "those are") + " offered here.";
    }
    if (state.state === "unprofiled") {
      return to + " — O'Mono has a checked record for this model only. " + tool
        + " may offer others; they are not listed here because they have not "
        + "been checked.";
    }
    return to + ".";
  }

  /* THE RECOMMENDATION BRIEF.

     The read phase has always been asked for a model recommendation and has
     never been told what one is. It received a flat six-model candidate list in
     which the four Anthropic entries carried full capability records and the
     ChatGPT and Gemini entries carried "unknown" against every key, alongside a
     standing rule that unknown means unavailable. So it answered the only way
     that list allowed: over three separate twenty-idea corpora, sixty of sixty
     reads named a Claude model.

     That was not a preference. It was arithmetic on the sheet we handed it.

     The sharper half of the defect is that the question was asked globally and
     is consumed locally. destinationForTool honours a preference only when the
     SELECTED TOOL offers it, so on the seven corpus entries whose destination
     was not Anthropic, the recommendation named a model that tool cannot run
     and was discarded without a word. Seven for seven.

     So the question is scoped to the tool now, and the answer is drawn from the
     dossier the owner already wrote and sourced: what the tool is, what it is
     good at, what to avoid, what it can actually do, and which models it can
     actually run. `choice` says whether there is a choice to make at all; on a
     tool that offers no lineup the honest answer is the one engine it runs on,
     not a pick. */
  function recommendationBrief(dossier, profiles, today, selectable) {
    if (!dossier) return null;
    var offered = profilesForTool(dossier, profiles, today, selectable);
    var state = modelChoiceState(dossier, profiles, today, selectable);
    var choice = state.state;
    if (!offered.length) {
      var seat = engineSeatFor(dossier, profiles);
      offered = seat ? [seat] : [];
      if (!seat) choice = "none";
    }
    return {
      tool: {
        id: dossier.id,
        display_name: dossier.display_name,
        maker: dossier.maker,
        surface_type: dossier.surface_type,
        good_at: dossier.good_at,
        avoid: dossier.avoid,
        abilities: dossier.abilities,
        model_choice: dossier.model_choice,
        models_note: dossier.models_note,
        checked_on: dossier.checked && dossier.checked.date
      },
      choice: choice,
      candidate_models: offered.map(function (p) {
        return {
          system_id: p.system_id,
          model_id: p.model_id,
          label: p.label,
          status: p.status,
          capabilities: p.capabilities,
          limitations: p.limitations
        };
      })
    };
  }

  /* R1: the one reconciliation, and the only way a destination is ever chosen.

     The tool is the person's own persisted choice and it decides more than the
     model: the assembly surface, the double-check sentences, the prompt-surface
     guidance. A destination that does not belong to it is not a preference
     O'Mono may act on. So every caller that wants to set a destination states
     which tool it is setting it for and what it would PREFER, and this decides.

     `preferred` is honoured only when the selected tool actually offers it,
     whether as one of its dossier models or as its own engine seat. Otherwise
     the tool keeps the destination it owns and the preference is refused, which
     is what destinationRationale's off-recommendation branch is there to say.

     F4 fixed the chain a person walks by hand (the tool select) and left the
     chain the app walks on the person's behalf (applyRecommendation, the
     restore at boot) resolving against the flat engine table. That is how a
     screen came to show ChatGPT, GPT-5.6 Sol and Opus 5 at the same time. There
     is one chain now and every path runs it. */
  function destinationForTool(dossier, profiles, today, preferred, selectable) {
    if (!dossier) return null;
    var offered = profilesForTool(dossier, profiles, today, selectable);
    var seat = engineSeatFor(dossier, profiles);
    var wanted = preferred && preferred.system_id && preferred.model_id ? preferred : null;
    if (wanted) {
      for (var i = 0; i < offered.length; i++) {
        if (offered[i].system_id === wanted.system_id
          && offered[i].model_id === wanted.model_id) return offered[i];
      }
      if (seat && seat.system_id === wanted.system_id
        && seat.model_id === wanted.model_id) return seat;
    }
    return offered[0] || seat || null;
  }

  /* F3: the reason belongs to the destination it was written about. It is one
     sentence the interpret call authored, naming one model; gluing it to
     whatever label is selected now produced "GPT-5.6 Sol. … Opus 5 has the
     reasoning depth …". Changing the tool or the model does not re-derive it —
     that would cost a second interpretation call — so when the selection moves
     off the recommendation the reason is withheld and the move is named
     instead. Nothing here ever explains one model in another model's words. */
  function destinationRationale(destination, recommendation, profiles, offered) {
    if (!destination) return "No destination is selected.";
    var label = destination.label
      || (destination.system_id + " " + destination.model_id);
    var rec = recommendation && recommendation.model_id ? recommendation : null;
    if (!rec) return label + ".";
    var onRecommendation = rec.system_id === destination.system_id
      && rec.model_id === destination.model_id;
    var because = String(rec.because || "").trim();
    if (onRecommendation) return because ? label + ". " + because : label + ".";
    /* A recommendation the tool cannot run was never an alternative, so the
       person did not turn one down. Saying "you chose this one" in that case
       blames them for a refusal the reconciliation made on its own. Where the
       caller supplies what the tool actually offers, an unofferable
       recommendation is named as impossible rather than as a decision. */
    if (Array.isArray(offered)) {
      var offerable = false;
      for (var j = 0; j < offered.length; j++) {
        if (offered[j] && offered[j].system_id === rec.system_id
          && offered[j].model_id === rec.model_id) { offerable = true; break; }
      }
      if (!offerable) {
        return label + ". O'Mono has no reason to give for this one: the model "
          + "its reading named is not one this tool can run.";
      }
    }
    var list = Array.isArray(profiles) ? profiles : [];
    var recLabel = rec.model_id;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].system_id === rec.system_id && list[i].model_id === rec.model_id) {
        recLabel = list[i].label || recLabel;
        break;
      }
    }
    return label + ". You chose this one; O'Mono had recommended " + recLabel
      + ", so the reason it wrote does not describe this destination.";
  }

  /* F16: why a row cannot be reopened, in the person's terms.

     A prompt that carried a classification is refused a recovery snapshot
     outright, so it can never be reopened — and the row said only "no saved
     copy remains", which reads as something having gone wrong rather than as a
     rule doing exactly what it was written to do. The refusal stands; the
     reason is on screen. */
  function historyRowRestore(hasSnapshot, textKept, classified) {
    if (hasSnapshot === true) return { canOpen: true, note: "" };
    /* S3: a snapshot that exists and cannot be reopened. Only a build before the
       size work could write one — it dropped the canonical half to fit the cap
       and saved the rest, which left a file that made History offer an Open
       button it could not honour. The button is gone and the row says what
       happened, because a control that cannot act is worse than no control. */
    if (hasSnapshot === "incomplete") {
      return { canOpen: false,
        note: "This one was saved before O'Mono could store a prompt this size, "
          + "so only part of it was kept and it cannot be reopened. Prompts made "
          + "since are stored whole." };
    }
    if (classified === true) {
      return { canOpen: false,
        note: "This one carried sensitive material, so O'Mono kept no copy of it "
          + "and it cannot be reopened. That is the rule working, not a fault." };
    }
    if (textKept === false) {
      return { canOpen: false,
        note: "The text of this one was never kept, so it cannot be reopened." };
    }
    return { canOpen: false,
      note: "No saved copy of this prompt remains, so it cannot be reopened." };
  }

  /* Who a protected change will be recorded against. Stated, never asked for:
     the account already knows it, and a name typed at override time could differ
     from the account's, which would make the audit line a claim rather than a
     fact. */
  function signingAsLine(displayName) {
    var name = typeof displayName === "string" ? displayName.trim() : "";
    return name
      ? "Signing as " + name
      : "Signing as the owner of this installation, which has no name set.";
  }

  /* ---------- navigation ----------
     A return-target stack. Every back control used to hardcode a destination,
     and seven of them shared `generation ? "viewResult" : "viewCompose"` — a
     probe of state that outlives the journey it was standing in for, so Back
     from Settings could land on a previous prompt's result. A view is now
     entered from wherever the user was, and Back returns exactly there.

     Preconditions are checked when popping rather than when pushing, because the
     state behind a view can disappear while it sits on the stack. An entry that
     can no longer be rendered is passed over instead of shown empty. */

  var NAV_DEPTH = 12;
  var NAV_REQUIRES = {
    viewResult: "generation",
    viewIntermediary: "interpretation",
    viewComponent: "generation",
    viewSourceCheck: "generation",
    viewFix: "generation",
    viewVerify: "checklist"
  };

  function navPush(stack, view) {
    var list = Array.isArray(stack) ? stack.slice() : [];
    if (typeof view !== "string" || !view) return list;
    /* Re-entering the view you are already on is not a journey. renderIntermediary
       calls show() on every lesson toggle; pushing there would grow without end. */
    if (list.length && list[list.length - 1] === view) return list;
    list.push(view);
    return list.length > NAV_DEPTH ? list.slice(list.length - NAV_DEPTH) : list;
  }

  function navValid(view, facts) {
    var needs = NAV_REQUIRES[view];
    if (!needs) return true;
    return !!(facts && facts[needs]);
  }

  function navBack(stack, facts) {
    var list = Array.isArray(stack) ? stack.slice() : [];
    while (list.length) {
      var candidate = list.pop();
      if (navValid(candidate, facts)) return { view: candidate, stack: list };
    }
    /* Nowhere left to go is the root, not a guess. */
    return { view: null, stack: [] };
  }

  /* Whether choosing a destination should also change the saved default.
     "recommendation" is O'Mono suggesting one and must never persist; "prompt" is
     the user choosing for this prompt and persists only if they asked to
     remember it; "settings" is the picker whose whole purpose is the default. */
  function shouldPersistDestination(source, remember) {
    if (source === "settings") return true;
    if (source === "prompt") return remember === true;
    return false;
  }

  /* ---------- the intermediary draft ----------
     What the user has decided so far, held apart from the DOM that displays it.
     renderIntermediary() is re-entered on every lesson toggle, every Escape-close,
     Rework and resBack; before this existed it rebuilt every control from the
     model's defaults each time, so anything the user had changed was silently
     undone and generate() then read the DOM it had just reset. */

  function draftInit(interpretation, questions, token) {
    var i = interpretation && typeof interpretation === "object" ? interpretation : {};
    var assumptions = {};
    (Array.isArray(i.assumptions) ? i.assumptions : []).forEach(function (a) {
      if (!a || typeof a.id !== "string") return;
      /* Each assumption's own default, never a blanket true. */
      assumptions[a.id] = { accepted: a.accepted_default !== false, note: "" };
    });
    return {
      token: typeof token === "string" ? token : "",
      answers: preselectedAnswers(questions),
      assumptions: assumptions,
      correction: "",
      destination_contest: "",
      remember_destination: false
    };
  }

  function copyDraft(draft) {
    var assumptions = {};
    Object.keys(draft.assumptions || {}).forEach(function (key) {
      assumptions[key] = {
        accepted: draft.assumptions[key].accepted,
        note: draft.assumptions[key].note
      };
    });
    return {
      token: draft.token,
      answers: (draft.answers || []).map(function (a) {
        return { id: a.id, q: a.q, answer: a.answer, answer_label: a.answer_label,
          detail: a.detail || "" };
      }),
      assumptions: assumptions,
      correction: draft.correction,
      destination_contest: draft.destination_contest,
      remember_destination: draft.remember_destination
    };
  }

  function draftApply(draft, action) {
    if (!draft || typeof draft !== "object") return draft;
    var a = action && typeof action === "object" ? action : {};
    var next = copyDraft(draft);
    if (a.type === "answer" && next.answers[a.index]) {
      next.answers[a.index].answer = a.answer;
      next.answers[a.index].answer_label = a.answer_label;
      /* F13: choosing a listed option clears whatever was typed under the
         escape, so a stale sentence cannot ride along behind a chosen answer. */
      if (!isOtherOption(a.answer)) next.answers[a.index].detail = "";
    } else if (a.type === "answer_detail" && next.answers[a.index]) {
      next.answers[a.index].detail = typeof a.detail === "string" ? a.detail : "";
    } else if (a.type === "assumption" && next.assumptions[a.id]) {
      next.assumptions[a.id].accepted = a.accepted === true;
    } else if (a.type === "note" && next.assumptions[a.id]) {
      next.assumptions[a.id].note = typeof a.note === "string" ? a.note : "";
    } else if (a.type === "correction") {
      next.correction = typeof a.value === "string" ? a.value : "";
    } else if (a.type === "contest") {
      next.destination_contest = typeof a.value === "string" ? a.value : "";
    } else if (a.type === "remember") {
      next.remember_destination = a.value === true;
    }
    return next;
  }

  /* A draft belongs to one interpretation. Carrying it into the next one would
     put the previous prompt's typed text under a new reading. */
  function draftMatches(draft, token) {
    return !!(draft && typeof draft === "object" && draft.token && draft.token === token);
  }

  /* {id, text, note} — not a flat array of strings. Throwing the id away meant
     nothing downstream could refer to a particular assumption. */
  /* H1: an assumption the person REJECTED and then corrected in writing is the
     most load-bearing thing on the screen, and it used to be the only thing on
     the screen that reached nothing.

     `if (!accepted) return` dropped the row whole, note and all, so unchecking
     "one message to both recipients" and writing "two separate emails" sent
     neither the rejection nor the correction. What the model received was an
     assumptions list with that item simply absent, which reads as no opinion
     rather than as a correction, and it then guessed. Whether it guessed right
     looked like an effort correlation and was chance.

     A rejected assumption with no note stays out: that is a person removing an
     assumption, and silence is the whole of what they said. A rejected
     assumption WITH a note travels, carrying its rejection and its replacement,
     down the same path the accepted ones use. `accepted` is stated on every row
     so the model never has to infer it from a field's absence. */
  function acceptedAssumptions(draft, interpretation) {
    var i = interpretation && typeof interpretation === "object" ? interpretation : {};
    var out = [];
    (Array.isArray(i.assumptions) ? i.assumptions : []).forEach(function (a) {
      if (!a || typeof a.id !== "string") return;
      var state = draft && draft.assumptions ? draft.assumptions[a.id] : null;
      var accepted = state ? state.accepted : a.accepted_default !== false;
      var note = state && typeof state.note === "string" ? state.note : "";
      if (accepted) {
        out.push({ id: a.id, text: a.text, note: note, accepted: true });
        return;
      }
      if (!note.trim()) return;
      out.push({ id: a.id, text: a.text, note: note, accepted: false });
    });
    return out;
  }

  /* Everything the user typed here, for the local secret scan. Derived from the
     draft's own contents so a field added later cannot escape screening by being
     forgotten in a list somewhere else. */
  function draftFreeText(draft) {
    if (!draft || typeof draft !== "object") return "";
    var parts = [];
    if (draft.correction) parts.push(draft.correction);
    if (draft.destination_contest) parts.push(draft.destination_contest);
    Object.keys(draft.assumptions || {}).forEach(function (key) {
      var note = draft.assumptions[key] && draft.assumptions[key].note;
      if (note) parts.push(note);
    });
    /* F13: an answer's own words. This function is the ONE thing standing
       between what a person types on this screen and the network, and its
       comment claimed it was derived from the draft's contents so a new field
       could not escape it — while it was in fact a hand-written list of three
       keys. A free-text answer added without this line would have bypassed the
       local secret screen entirely, which is the only control in the product
       that runs before a request leaves the machine. */
    (Array.isArray(draft.answers) ? draft.answers : []).forEach(function (answer) {
      if (answer && answer.detail) parts.push(answer.detail);
    });
    return parts.join("\n");
  }

  return {
    PURPOSE_CHIPS: PURPOSE_CHIPS,
    purposeIds: purposeIds,
    postureLabel: postureLabel,
    passwordRevealLabel: passwordRevealLabel,
    shouldPersistDestination: shouldPersistDestination,
    signingAsLine: signingAsLine,
    componentButtons: componentButtons,
    destinationTraits: destinationTraits,
    personaComponentFrom: personaComponentFrom,
    foldTargetFor: foldTargetFor,
    fieldChips: fieldChips,
    assembleFromComponents: assembleFromComponents,
    historyRowRestore: historyRowRestore,
    navPush: navPush,
    navBack: navBack,
    navValid: navValid,
    surfacedAssumptions: surfacedAssumptions,
    closingTip: closingTip,
    draftInit: draftInit,
    draftApply: draftApply,
    draftMatches: draftMatches,
    acceptedAssumptions: acceptedAssumptions,
    draftFreeText: draftFreeText,
    togglePurpose: togglePurpose,
    materialQuestions: materialQuestions,
    dedupeComponentsById: dedupeComponentsById,
    questionOptions: questionOptions,
    isOtherOption: isOtherOption,
    OTHER_OPTION: OTHER_OPTION,
    suggestedOption: suggestedOption,
    preselectedAnswers: preselectedAnswers,
    teachingPanelFor: teachingPanelFor,
    triggerLabels: triggerLabels,
    labelsVary: labelsVary,
    accessibleNamesOk: accessibleNamesOk,
    lessonIds: lessonIds,
    lessonReducer: lessonReducer,
    triggersWithState: triggersWithState,
    openCardCount: openCardCount,
    policyRows: policyRows,
    policyFinal: policyFinal,
    blocksGeneration: blocksGeneration,
    needsConfirmation: needsConfirmation,
    componentRows: componentRows,
    componentLabel: componentLabel,
    legacyLabel: legacyLabel,
    beforeRelying: beforeRelying,
    alsoWorthChecking: alsoWorthChecking,
    returnRoute: returnRoute,
    sourceCheckApplies: sourceCheckApplies,
    claimStatusLabel: claimStatusLabel,
    RETURNED_MATERIAL_CATEGORIES: RETURNED_MATERIAL_CATEGORIES,
    returnedMaterialLabel: returnedMaterialLabel,
    errorView: errorView,
    contentHeightFor: contentHeightFor,
    scrollsInternally: scrollsInternally,
    normalizeThemeSource: normalizeThemeSource,
    resolveTheme: resolveTheme,
    matterScreeningVisible: matterScreeningVisible,
    matterStatusLine: matterStatusLine,
    matterActions: matterActions,
    creatorSheetState: creatorSheetState,
    elevationRemaining: elevationRemaining,
    workEventFrom: workEventFrom,
    DEDUPE_THRESHOLD: DEDUPE_THRESHOLD,
    WITHIN_FIELD_THRESHOLD: WITHIN_FIELD_THRESHOLD,
    MIN_COMPARABLE_TOKENS: MIN_COMPARABLE_TOKENS,
    normalizeMarkup: normalizeMarkup,
    normalizeComponents: normalizeComponents,
    assembleBlocks: assembleBlocks,
    fieldDetailText: fieldDetailText,
    componentDetailText: componentDetailText,
    identitySentence: identitySentence,
    crossFieldThreshold: crossFieldThreshold,
    rejoin: rejoin,
    sentenceTokens: sentenceTokens,
    overlapShare: overlapShare,
    splitSentences: splitSentences,
    personaComponentFrom: personaComponentFrom,
    sameModelId: sameModelId,
    offerableProfiles: offerableProfiles,
    profilesForTool: profilesForTool,
    engineSeatFor: engineSeatFor,
    componentPlacement: componentPlacement,
    placementLine: placementLine,
    destinationForTool: destinationForTool,
    GENERATE_CADENCE: GENERATE_CADENCE,
    generateCadence: generateCadence,
    generateCadenceTotalMs: generateCadenceTotalMs,
    generateCadenceStepAt: generateCadenceStepAt,
    waitLessonText: waitLessonText,
    WAIT_FALLBACK_LINES: WAIT_FALLBACK_LINES,
    waitFallbackLine: waitFallbackLine,
    CLOSING_SLOT_LINE: CLOSING_SLOT_LINE,
    OVERRUN_LINE: OVERRUN_LINE,
    modelChoiceState: modelChoiceState,
    modelChoiceLine: modelChoiceLine,
    recommendationBrief: recommendationBrief,
    destinationRationale: destinationRationale
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = OMonoDesktop;
if (typeof globalThis !== "undefined") globalThis.OMonoDesktop = OMonoDesktop;
/* OMONO-PURE-END */
