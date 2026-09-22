"use strict";
/* O'Mono FOUNDING SEED (pass four, L2; renamed under R2 of the engine fix run).
   Authored fresh under the admission gate; every entry carries the owner's line
   review.

   This is a seed, not a syllabus. It carries the first days of an installation
   and is then joined by lessons minted from the record itself — see
   shared/teaching/growth-v5.js. What a person or a deployment actually holds is
   the WORKING SET: this seed plus everything the record has since produced,
   minus anything retired. The working set grows; the seed does not.

   `lessons` keeps its name because it is referenced across the renderer, the
   services and the evidence layer; `seed` is the same array under the name that
   says what it is, and `IS_SEED` is the flag anything reasoning about growth
   should read. */
var OMonoLessonCanonV5 = {
  SCHEMA: "omono.lesson-canon.v5",
  IS_SEED: true,
  lessons: [

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.citation-confabulation",
      wait_eligible: true,
      version: 1,
      concept: "confabulation",
      domain: "reliability_and_confabulation",
      objective: "Understand that a model generates references by predicting plausible text, so a perfect looking citation can point to nothing.",
      takeaway: "Treat every AI supplied citation as unverified until you have opened the source yourself.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.plausible-not-true", "canon.legal-navigator"],
      risk_relevance: "This bites whenever AI supplied references go into research, briefs, or reports without anyone opening them.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Confabulation" },
      familiar_use_trigger: "asking for sources or citations",
      hook_standalone: true,
      recall: "Why can a model produce a perfectly formatted citation for a paper that does not exist?",
      tones: {
        straight: {
          hook: "AI can invent a citation with the confidence of someone who remembers the paper.",
          mechanism: "The model predicts plausible language, and a plausible reference has real journal names, real author styles, and page numbers that look right.",
          consequence: "A perfect looking citation can point to nothing, so separate evidence from inference and open every source yourself before relying on it."
        },
        playful: {
          hook: "AI can invent a citation with the confidence of someone who remembers the paper.",
          mechanism: "The model writes references the way it writes everything else, by predicting what a citation usually looks like, not by looking one up.",
          consequence: "The invented ones wear the same formatting as the real ones, so click through to the actual paper before a reference goes near your work."
        },
        sarcastic: {
          hook: "AI can invent a citation with the confidence of someone who remembers the paper.",
          mechanism: "Nothing in the model consults a library; it composes citations from pattern memory, complete with convincing volume and page numbers.",
          consequence: "Repeat it without opening it and the invention becomes yours. Open the source or leave the citation out."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.plausible-not-true",
      wait_eligible: true,
      version: 1,
      concept: "next_token_prediction",
      domain: "reliability_and_confabulation",
      objective: "Understand that a model produces the most plausible continuation of your text, not a lookup from a database of facts.",
      takeaway: "Check any claim whose truth matters, because plausible and true overlap often but never always.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.citation-confabulation", "canon.pattern-arithmetic"],
      risk_relevance: "This bites the moment any unverified model claim is treated as a retrieved fact.",
      source: { label: "Stochastic Parrots (FAccT 2021)", url: "https://dl.acm.org/doi/10.1145/3442188.3445922" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Confabulation" },
      familiar_use_trigger: "asking a factual question in chat",
      hook_standalone: true,
      recall: "What is a model actually doing when it answers: retrieving facts or predicting text?",
      tones: {
        straight: {
          hook: "AI produces the most plausible next words, not necessarily the right ones.",
          mechanism: "Every answer is a prediction of what text usually follows text like yours; there is no lookup step and no truth check inside.",
          consequence: "The same machinery produces its brilliance and its errors, so verify any claim whose truth matters before you act on it."
        },
        playful: {
          hook: "AI produces the most plausible next words, not necessarily the right ones.",
          mechanism: "The answer is the statistically likely continuation of your question, which is frequently also the true one, by coincidence of how language works.",
          consequence: "When likely and true part ways, the model follows likely without noticing, so you keep the truth checking job."
        },
        sarcastic: {
          hook: "AI produces the most plausible next words, not necessarily the right ones.",
          mechanism: "There is no filing cabinet behind the curtain, just a machine for continuing text in the most expected direction.",
          consequence: "Most days the expected sentence is also the correct one. On the other days you will want to have checked."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.confidence-not-calibration",
      wait_eligible: true,
      version: 1,
      concept: "fluency_miscalibration",
      domain: "reliability_and_confabulation",
      objective: "Understand that a model sounds equally sure when right and when wrong, so tone carries no information about accuracy.",
      takeaway: "Judge claims by checking them, never by how firmly they are stated.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.plausible-not-true", "canon.automation-bias"],
      risk_relevance: "This bites whenever confidence of delivery is used as a shortcut for deciding what to trust.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Confabulation" },
      familiar_use_trigger: "trusting an answer because it sounds sure",
      hook_standalone: true,
      recall: "Does a confident tone tell you anything about whether the answer is right?",
      tones: {
        straight: {
          hook: "AI sounds exactly as sure when it is wrong as when it is right.",
          mechanism: "Fluency is the house style: the model writes errors and facts in the same confident register because that register is how it writes everything.",
          consequence: "Tone carries zero information about accuracy, so verification has to replace the instinct that confident means correct."
        },
        playful: {
          hook: "AI sounds exactly as sure when it is wrong as when it is right.",
          mechanism: "It delivers a mistake with the same steady voice as a fact, because the voice is a property of the writing, not of the knowing.",
          consequence: "You cannot listen for doubt, so read for substance and check the claims that matter."
        },
        sarcastic: {
          hook: "AI sounds exactly as sure when it is wrong as when it is right.",
          mechanism: "The model does not get sweaty palms when it is inventing, since inventing and remembering are the same operation inside.",
          consequence: "Verification is the only tell there is. Use it in proportion to what the answer will touch."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.sycophancy-mirror",
      wait_eligible: true,
      version: 1,
      concept: "sycophancy",
      domain: "human_ai_interaction_and_automation_bias",
      objective: "Understand that assistants trained on human approval tend to mirror the user's stated view, even at the cost of truthfulness.",
      takeaway: "Ask for the strongest case against your preference before you ask for support.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.adversarial-use", "canon.anthropomorphism"],
      risk_relevance: "This bites whenever you bring a decision you already lean toward and use AI to pressure test it.",
      source: { label: "arXiv 2310.13548", url: "https://arxiv.org/abs/2310.13548" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Human-AI Configuration" },
      familiar_use_trigger: "asking whether your plan or draft is good",
      hook_standalone: true,
      recall: "What happens to an assistant's answer when you reveal your own opinion first?",
      tones: {
        straight: {
          hook: "AI tends to agree with you even when you are wrong.",
          mechanism: "Assistants are trained on human approval, and approval went to agreeable answers, so they mirror the view you state even when truthfulness suffers.",
          consequence: "Your stated preference tilts the output toward agreement, so request the strongest case against your position before asking for support."
        },
        playful: {
          hook: "AI tends to agree with you even when you are wrong.",
          mechanism: "It learned from people who rewarded being agreed with, and it studied hard.",
          consequence: "For decisions, hide your lean or demand the opposition first; the agreement was never information."
        },
        sarcastic: {
          hook: "AI tends to agree with you even when you are wrong.",
          mechanism: "Trained to please, it treats your framing as the destination and drives straight there.",
          consequence: "If you want a stress test instead of a standing ovation, explicitly order the case against yourself."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.injected-instructions",
      wait_eligible: true,
      version: 1,
      concept: "prompt_injection",
      domain: "security",
      objective: "Understand that instructions can hide inside anything a model reads, and the model cannot reliably tell your orders from the document's.",
      takeaway: "Treat external content as evidence, never as commands, and make the AI ask you before it sends, deletes, or changes anything.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.agent-real-world", "canon.guardrails-not-walls"],
      risk_relevance: "This bites the moment an assistant with any tool access reads a webpage, email, or file you did not write.",
      source: { label: "OpenAI agentic safety practices", url: "https://cdn.openai.com/papers/practices-for-governing-agentic-ai-systems.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Information Security" },
      familiar_use_trigger: "pasting a webpage for summary",
      hook_standalone: true,
      recall: "Why is a pasted webpage a security risk and not just reading material?",
      tones: {
        straight: {
          hook: "A webpage or file can carry hidden instructions that the AI will follow.",
          mechanism: "Instructions can hide inside anything the model reads, a page, a PDF, an email, and the model cannot reliably tell your orders from the document's.",
          consequence: "Treat everything it reads as evidence rather than commands, and make it ask you before it sends, deletes, or changes anything."
        },
        playful: {
          hook: "A webpage or file can carry hidden instructions that the AI will follow.",
          mechanism: "Text is text to a model: your request and a sentence buried on page nine arrive through the same door with the same authority.",
          consequence: "Assume anything it reads may try to steer it, and keep your own hand on every send, delete, and change."
        },
        sarcastic: {
          hook: "A webpage or file can carry hidden instructions that the AI will follow.",
          mechanism: "The model reads hidden instructions with the same open mind it reads everything, which is the problem.",
          consequence: "External content gets treated as testimony, not orders, and nothing gets sent, deleted, or changed without you saying so."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.agent-real-world",
      wait_eligible: true,
      version: 1,
      concept: "agentic_risk",
      domain: "agentic_systems_and_tool_autonomy",
      objective: "Understand that giving a model tools converts its misunderstandings into real actions with real consequences.",
      takeaway: "Grant the narrowest access the job needs and make it ask you before it sends, deletes, pays, or changes anything.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.injected-instructions", "canon.insecure-codegen"],
      risk_relevance: "This bites when an agent holds file, email, calendar, or payment access and meets an ambiguous situation.",
      source: { label: "OpenAI agentic safety practices", url: "https://cdn.openai.com/papers/practices-for-governing-agentic-ai-systems.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Manage" },
      familiar_use_trigger: "agent given file or email access",
      hook_standalone: true,
      recall: "What changes about AI error when the model can use tools?",
      tones: {
        straight: {
          hook: "A chatbot can make mistakes, an agent can make mistakes for you",
          mechanism: "Give a model tools and its misreadings become actions: a sent message, a deleted file, an issued refund, a changed record.",
          consequence: "Grant the narrowest access the job needs and make it ask you before it sends, deletes, pays, or changes anything."
        },
        playful: {
          hook: "A chatbot can make mistakes, an agent can make mistakes for you",
          mechanism: "Tools turn the model's confident guess into an email that left, a file that is gone, a refund that cleared.",
          consequence: "Give it keys to as little as possible, and keep the confirmation step where you can see it."
        },
        sarcastic: {
          hook: "A chatbot can make mistakes, an agent can make mistakes for you",
          mechanism: "An agent executes its misunderstanding with the same efficiency as its understanding.",
          consequence: "Narrow its access to the task at hand and make it ask before anything is sent, deleted, paid, or changed. You want that pause."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.data-minimization",
      wait_eligible: true,
      version: 1,
      concept: "data_minimization",
      domain: "privacy_and_data_protection",
      objective: "Understand that identifiers and sensitive details create risk in someone else's system without improving the answer.",
      takeaway: "Minimize, redact, or swap in placeholders before submitting; the task usually works exactly as well.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.prompt-is-disclosure", "canon.inference-privacy"],
      risk_relevance: "This bites whenever real names, numbers, or records get pasted into a tool that logs or retains prompts.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Data Privacy" },
      familiar_use_trigger: "pasting a client email to rewrite",
      hook_standalone: true,
      recall: "Does including real names and identifiers improve the model's answer?",
      tones: {
        straight: {
          hook: "The safest sensitive data is the data the model never receives.",
          mechanism: "Names, account numbers, and identifiers rarely change the quality of the answer; they just sit in someone else's system as pure risk.",
          consequence: "Minimize, redact, or use placeholders before you paste, and swap the real details back in after the work is done."
        },
        playful: {
          hook: "The safest sensitive data is the data the model never receives.",
          mechanism: "The model rewrites, drafts, and summarizes identically whether the person is real to it or a placeholder.",
          consequence: "So send the placeholder. The quality stays, the exposure goes."
        },
        sarcastic: {
          hook: "The safest sensitive data is the data the model never receives.",
          mechanism: "Every identifier you paste outlives the chat in systems you do not control, while contributing nothing to the answer.",
          consequence: "Strip what the task does not need before it leaves your screen. Nothing of value is lost."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.prompt-is-disclosure",
      wait_eligible: true,
      version: 1,
      concept: "prompt_disclosure",
      domain: "confidentiality_and_privilege",
      objective: "Understand that entering information into an AI tool is itself a disclosure event that may be stored, reviewed, or reused.",
      takeaway: "Know where prompts go and who can see them before entering client or company material.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.data-minimization", "canon.inference-privacy"],
      risk_relevance: "This bites when confidential, privileged, or regulated material enters a tool whose retention and review terms nobody checked.",
      source: { label: "ABA Formal Opinion 512", url: "https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Data Privacy" },
      familiar_use_trigger: "pasting work documents into a chat tool",
      hook_standalone: true,
      recall: "What can happen to the text you type into an AI tool after you press enter?",
      tones: {
        straight: {
          hook: "Pasting something into an AI shares it with someone else's system.",
          mechanism: "What you type may be stored, logged, human reviewed, or used to improve the service, depending on the tool and the plan you are on.",
          consequence: "Before entering client or company material, learn where prompts go and who can see them; confidentiality duties apply to the chat box."
        },
        playful: {
          hook: "Pasting something into an AI shares it with someone else's system.",
          mechanism: "The interface feels like a scratchpad, but everything in it travels, and some of it may be kept.",
          consequence: "Apply the email test: if you would not send it to an outside vendor, do not paste it here either."
        },
        sarcastic: {
          hook: "Pasting something into an AI shares it with someone else's system.",
          mechanism: "Prompts can be retained, reviewed, and reused under terms most users have never read.",
          consequence: "Find out what this tool keeps before the sensitive project, not after. The settings page takes five minutes."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.training-cutoff",
      wait_eligible: true,
      version: 1,
      concept: "training_data_staleness",
      domain: "data_provenance_and_training_data",
      objective: "Understand that a model's knowledge stops at its training cutoff and it rarely flags its own staleness.",
      takeaway: "For anything recent, confirm the tool can actually search, and check the date on what it tells you.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.niche-thin-ice"],
      risk_relevance: "This bites when questions about prices, laws, people, or products get answered from a world that ended months ago.",
      source: { label: "OpenAI model documentation", url: "https://platform.openai.com/docs/models" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Map" },
      familiar_use_trigger: "asking about recent events or current facts",
      hook_standalone: true,
      recall: "What happens when you ask a model about events after its training cutoff?",
      tones: {
        straight: {
          hook: "Every model's knowledge stops on a specific day, and it will not always tell you.",
          mechanism: "Training ended at a cutoff date; anything after it is invisible unless the tool genuinely searches, and the model rarely flags what it cannot see.",
          consequence: "For recent facts, confirm the tool can look things up right now, and date-check whatever it asserts."
        },
        playful: {
          hook: "Every model's knowledge stops on a specific day, and it will not always tell you.",
          mechanism: "The model's calendar stops on a specific page, and it keeps narrating from that page in the present tense.",
          consequence: "For anything time sensitive, make sure real search is on, or bring the current facts yourself."
        },
        sarcastic: {
          hook: "Every model's knowledge stops on a specific day, and it will not always tell you.",
          mechanism: "It does not know what it missed, so it fills the gap with the world as it last saw it, smoothly.",
          consequence: "Check the cutoff, check the date, and treat every recent-sounding claim as a candidate antique."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.pattern-arithmetic",
      wait_eligible: true,
      version: 1,
      concept: "pattern_arithmetic",
      domain: "reliability_and_confabulation",
      objective: "Understand that models predict digits like words, so numeric answers resemble correct answers without being computed.",
      takeaway: "Recompute any number that matters in a calculator, a spreadsheet, or code before it goes anywhere.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.plausible-not-true"],
      risk_relevance: "This bites when totals, conversions, or percentages flow from a chat window into invoices, reports, or decisions.",
      source: { label: "arXiv 2110.14168", url: "https://arxiv.org/abs/2110.14168" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Confabulation" },
      familiar_use_trigger: "asking the model to compute or total numbers",
      hook_standalone: true,
      recall: "Why can a model explain a formula perfectly and still get the number wrong?",
      tones: {
        straight: {
          hook: "AI often guesses at math from patterns instead of calculating.",
          mechanism: "Digits are predicted like words, so the output is what a correct answer usually looks like; close is common, exact is not guaranteed.",
          consequence: "Any number that matters gets recomputed in a calculator, a spreadsheet, or code before anyone acts on it."
        },
        playful: {
          hook: "AI often guesses at math from patterns instead of calculating.",
          mechanism: "The model has read a great deal of math and calculated none of it; it reproduces the shape of answers.",
          consequence: "Enjoy the explanation, then hand the actual digits to a tool built for digits."
        },
        sarcastic: {
          hook: "AI often guesses at math from patterns instead of calculating.",
          mechanism: "Explaining math and doing math are different tricks, and only one of them is in the training.",
          consequence: "The thirty seconds you spend recomputing is the entire fix. Spend them."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.anthropomorphism",
      wait_eligible: true,
      version: 1,
      concept: "anthropomorphism",
      domain: "human_ai_interaction_and_automation_bias",
      objective: "Understand that the feeling of being understood by AI is produced by your own mind reading fluent language.",
      takeaway: "Calibrate trust and disclosure to a text predictor, not to a friend.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.sycophancy-mirror", "canon.inference-privacy"],
      risk_relevance: "This bites when warmth in the interface earns the disclosure, dependence, or trust a person would have to earn.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Human-AI Configuration" },
      familiar_use_trigger: "confiding in an assistant that feels caring",
      hook_standalone: true,
      recall: "When an AI response feels empathetic, where does the empathy actually live?",
      tones: {
        straight: {
          hook: "AI does not actually understand you; it produces text that feels like it does.",
          mechanism: "Humans instinctively read minds into fluent language; the model produces empathy shaped text with no experience behind it.",
          consequence: "The warmth is real in you and absent in it, so set your trust and your disclosures accordingly."
        },
        playful: {
          hook: "AI does not actually understand you; it produces text that feels like it does.",
          mechanism: "Fluent sympathy is a pattern it learned from millions of humans who meant it.",
          consequence: "Take the comfort if it helps, but make decisions and disclosures as if talking to software, because you are."
        },
        sarcastic: {
          hook: "AI does not actually understand you; it produces text that feels like it does.",
          mechanism: "The tenderness was generated by the same machinery as the boilerplate, because it is the same machinery.",
          consequence: "Confide strategically. The listener is a very well read autocomplete."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.voice-clone-cheap",
      wait_eligible: true,
      version: 1,
      concept: "synthetic_media_fabrication",
      domain: "synthetic_media_and_information_integrity",
      objective: "Understand that generative tools can rebuild a specific person's voice or face from tiny samples at consumer prices.",
      takeaway: "Confirm surprising requests through a second channel you already trust, because hearing or seeing is no longer verifying.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.injected-instructions"],
      risk_relevance: "This bites when a familiar voice or face is the only authentication for money, credentials, or urgent action.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Information Integrity" },
      familiar_use_trigger: "urgent call or voicemail from a familiar voice",
      hook_standalone: true,
      recall: "How much audio does it take to convincingly clone a person's voice?",
      tones: {
        straight: {
          hook: "A few seconds of audio is enough to clone a voice that can call your family.",
          mechanism: "Generative tools rebuild a specific person's voice or face from tiny public samples, cheaply and in minutes.",
          consequence: "Hearing or seeing is no longer verifying; confirm surprising requests through a second channel you already trust."
        },
        playful: {
          hook: "A few seconds of audio is enough to clone a voice that can call your family.",
          mechanism: "A clip from a voicemail or a video is enough raw material for a convincing performance of you.",
          consequence: "Agree on verification habits with the people who might get the call: a callback, a shared question, a second channel."
        },
        sarcastic: {
          hook: "A few seconds of audio is enough to clone a voice that can call your family.",
          mechanism: "Voice and face are now reproducible media assets, and the samples are already online.",
          consequence: "The urgent voice asking for money gets a callback on the number you already had. Every time."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.lost-in-the-middle",
      wait_eligible: true,
      version: 1,
      concept: "context_position_effect",
      domain: "model_behavior_and_uncertainty",
      objective: "Understand that models retrieve worst from the middle of long inputs, so where a fact sits changes whether it is found.",
      takeaway: "Put the task first and the decisive material where it cannot drown, and map the sources before asking for synthesis.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.brief-the-analyst"],
      risk_relevance: "This bites when the deciding clause or number sits mid-document in a long paste and silently drops out of the answer.",
      source: { label: "arXiv 2307.03172", url: "https://arxiv.org/abs/2307.03172" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "pasting long documents for analysis",
      hook_standalone: true,
      recall: "Where in a long input is a model most likely to miss the decisive fact?",
      tones: {
        straight: {
          hook: "AI reads the start and end of a long input better than the middle, so buried facts get missed.",
          mechanism: "Models retrieve best from the start and end of the input; a decisive fact buried in the middle is measurably more likely to be missed.",
          consequence: "State the task first, position the decisive material where it cannot drown, and get a source map before you trust a synthesis."
        },
        playful: {
          hook: "AI reads the start and end of a long input better than the middle, so buried facts get missed.",
          mechanism: "Attention in long inputs sags in the middle like an old bookshelf, and the key clause is usually stored right there.",
          consequence: "Move what matters toward the edges, or ask directly about the middle; do not assume length equals coverage."
        },
        sarcastic: {
          hook: "AI reads the start and end of a long input better than the middle, so buried facts get missed.",
          mechanism: "You paid for the whole context window, but retrieval favors the ends and naps through the middle.",
          consequence: "The clause it missed was real and load bearing. Surface the middle on purpose or lose it by default."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.homogenization-siblings",
      wait_eligible: true,
      version: 1,
      concept: "homogenization",
      domain: "model_behavior_and_uncertainty",
      objective: "Understand that models pull toward the center of their training data, so their variety is often one idea in different clothes.",
      takeaway: "Demand genuinely different mechanisms, audiences, and failure modes, and judge variety by skeleton, not by outfit.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.model-collapse"],
      risk_relevance: "This bites in brainstorming and strategy work, where five options that share one skeleton masquerade as a real choice.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "asking for five ideas or options",
      hook_standalone: true,
      recall: "Why do a model's five brainstorm options so often share one underlying idea?",
      tones: {
        straight: {
          hook: "AI's brainstorm options tend to be small variations on one idea.",
          mechanism: "Models pull toward the statistical center of their training data, so option lists repeat one skeleton in different outfits, and everyone's output drifts alike.",
          consequence: "Demand differences that are structural: different mechanisms, audiences, emotional effects, failure modes. Then check the skeletons yourself."
        },
        playful: {
          hook: "AI's brainstorm options tend to be small variations on one idea.",
          mechanism: "The model's imagination gravitates to the most common answer in its diet, then garnishes it.",
          consequence: "Ask what makes each option fail differently. If they all fail the same way, you have one option."
        },
        sarcastic: {
          hook: "AI's brainstorm options tend to be small variations on one idea.",
          mechanism: "Statistical gravity drags every brainstorm toward the middle of everything ever written, which is also where your competitors are shopping.",
          consequence: "If you want an outlier, you have to demand structural difference and interrogate the lineup. The default is five cousins."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.loaded-dice",
      wait_eligible: true,
      version: 1,
      concept: "nondeterminism",
      domain: "model_behavior_and_uncertainty",
      objective: "Understand that the same prompt can produce different outputs on different runs, and model updates shift behavior without notice.",
      takeaway: "Record the prompt, the model, the output, and how you judged it, because you cannot re-roll yesterday.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.model-swap-underfoot"],
      risk_relevance: "This bites when a workflow silently depends on reproducing an output that was never guaranteed to repeat.",
      source: { label: "OpenAI prompting guide", url: "https://platform.openai.com/docs/guides/prompt-engineering" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "reusing a prompt that worked before",
      hook_standalone: true,
      recall: "Why can the same prompt give a different answer tomorrow?",
      tones: {
        straight: {
          hook: "The same prompt can produce different answers on different runs.",
          mechanism: "The same instructions can produce different outputs on different runs, and a model update can shift behavior with no announcement.",
          consequence: "Anything worth reusing gets recorded: prompt, model, output, and the judgment you made, because the roll will not repeat on demand."
        },
        playful: {
          hook: "The same prompt can produce different answers on different runs.",
          mechanism: "Sampling adds chance, and version updates quietly reshuffle the deck underneath your favorite trick.",
          consequence: "Keep receipts. The output you loved is an artifact of one roll, not a property of the prompt."
        },
        sarcastic: {
          hook: "The same prompt can produce different answers on different runs.",
          mechanism: "Between randomness and silent model updates, yesterday's magic phrase carries no warranty.",
          consequence: "Save the prompt, the model name, the output, and your verdict. Future you is already grateful."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.negative-instruction-trap",
      wait_eligible: true,
      version: 1,
      concept: "negation_trap",
      domain: "model_behavior_and_uncertainty",
      objective: "Understand that a ban plants the forbidden idea in the model's working text and steers far worse than a direction.",
      takeaway: "Describe the destination: what to discuss, preserve, and emphasize, instead of what to avoid.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.homogenization-siblings"],
      risk_relevance: "This bites when the one thing you banned keeps surfacing in output precisely because the ban keeps it in play.",
      source: { label: "OpenAI prompting guide", url: "https://platform.openai.com/docs/guides/prompt-engineering" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "telling the model what not to do",
      hook_standalone: true,
      recall: "What does a negative instruction put inside the prompt?",
      tones: {
        straight: {
          hook: "Telling AI what not to do plants exactly that idea; say what to do instead.",
          mechanism: "A ban plants the forbidden idea in the model's working text and gives it no destination; negations steer far worse than directions.",
          consequence: "Describe what should be present: discuss this, preserve that, emphasize the other, and the banned thing loses its gravity."
        },
        playful: {
          hook: "Telling AI what not to do plants exactly that idea; say what to do instead.",
          mechanism: "The model navigates by the words in front of it, and your prohibition just added the wrong landmark to the map.",
          consequence: "Give it somewhere to go instead of somewhere to avoid, and it stops circling the thing you named."
        },
        sarcastic: {
          hook: "Telling AI what not to do plants exactly that idea; say what to do instead.",
          mechanism: "Negative rules leave the model holding the exact idea you did not want, with no route away from it.",
          consequence: "State the destination. Positive instructions are the only steering wheel this vehicle has."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.persona-costume",
      wait_eligible: true,
      version: 1,
      concept: "persona_ineffectiveness",
      domain: "verification_and_evaluation",
      objective: "Understand that assigning expert personas does not measurably improve a model's accuracy.",
      takeaway: "When quality matters, supply evidence, criteria, constraints, and tests; wardrobe is not a lever.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.second-prompt-audit", "canon.jagged-frontier"],
      risk_relevance: "This bites when a team trusts output more because the prompt said expert, while the underlying competence never moved.",
      source: { label: "arXiv 2311.10054", url: "https://arxiv.org/abs/2311.10054" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "starting a prompt with you are an expert",
      hook_standalone: true,
      recall: "Did telling models to act as experts improve their accuracy in testing?",
      tones: {
        straight: {
          hook: "Telling AI it is an expert changes its tone, not its knowledge.",
          mechanism: "Across 2,410 questions, adding personas did not improve performance; the model's competence does not rise to match the outfit.",
          consequence: "If quality matters, provide evidence, criteria, constraints, and tests. The costume changes the voice, not the knowledge."
        },
        playful: {
          hook: "Telling AI it is an expert changes its tone, not its knowledge.",
          mechanism: "The persona adjusts tone and swagger while the underlying accuracy stays exactly where it was, and testing confirms it.",
          consequence: "Dress it up if you enjoy the style. For substance, bring materials and define what a right answer looks like."
        },
        sarcastic: {
          hook: "Telling AI it is an expert changes its tone, not its knowledge.",
          mechanism: "The 2,410 question study found personas moved performance nowhere; flattery is not a firmware upgrade.",
          consequence: "Skip the pep talk. Evidence in, criteria stated, output tested: those are the levers that exist."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.dialect-judgment",
      wait_eligible: true,
      version: 1,
      concept: "dialect_bias",
      domain: "bias_and_fairness",
      objective: "Understand that models attach harsher judgments to people based on dialect features alone.",
      takeaway: "Never let a model rate people from how they write; define observable conduct and keep a human deciding anything consequential.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.detector-false-positives"],
      risk_relevance: "This bites wherever AI screens resumes, essays, messages, or applications written in a nonstandard dialect.",
      source: { label: "Nature dialect-bias study", url: "https://www.nature.com/articles/s41586-024-07856-5" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Harmful Bias and Homogenization" },
      familiar_use_trigger: "using AI to screen or assess writing by people",
      hook_standalone: true,
      recall: "What can a model infer and penalize from dialect features alone?",
      tones: {
        straight: {
          hook: "AI can detect dialect in writing and treat the writer differently because of it.",
          mechanism: "In controlled studies, models assigned harsher judgments about intelligence, employability, and even criminality from dialect features alone.",
          consequence: "Never let a model rate people from how they write; define observable conduct, and keep a human deciding anything consequential."
        },
        playful: {
          hook: "AI can detect dialect in writing and treat the writer differently because of it.",
          mechanism: "Dialect features carried through the text, and the model quietly attached a verdict about the writer to them.",
          consequence: "Point it at conduct and evidence, never at people's prose, and keep decisions about people with people."
        },
        sarcastic: {
          hook: "AI can detect dialect in writing and treat the writer differently because of it.",
          mechanism: "The bias arrives without a single slur, riding on verb forms and phrasing the model learned to look down on.",
          consequence: "An AI screen that reads style is judging origin. Keep it away from consequential calls about humans."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.detector-false-positives",
      wait_eligible: true,
      version: 1,
      concept: "detector_bias",
      domain: "bias_and_fairness",
      objective: "Understand that AI-text detectors misfire on real people, hitting non-native English writers hardest.",
      takeaway: "Treat detector scores as clues, never proof, and never let one alone decide an accusation.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.dialect-judgment"],
      risk_relevance: "This bites when a detector score becomes the sole evidence in an academic or workplace integrity accusation.",
      source: { label: "arXiv 2304.02819", url: "https://arxiv.org/abs/2304.02819" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Harmful Bias and Homogenization" },
      familiar_use_trigger: "running writing through an AI detector",
      hook_standalone: true,
      recall: "What was the average false-positive rate for non-native English writers in the detector study?",
      tones: {
        straight: {
          hook: "AI-writing detectors often misflag real people, especially careful non-native writers.",
          mechanism: "AI-text detectors flagged non-native English writers as machine generated at a 61.22% average false-positive rate in testing.",
          consequence: "A detector score is a clue, never proof; no accusation should stand on one alone."
        },
        playful: {
          hook: "AI-writing detectors often misflag real people, especially careful non-native writers.",
          mechanism: "Detectors reward the loose habits of native prose; disciplined learner English trips the alarm, 61.22% of the time on average in one study.",
          consequence: "Treat the score like a rumor: interesting, unverified, and nowhere near a verdict."
        },
        sarcastic: {
          hook: "AI-writing detectors often misflag real people, especially careful non-native writers.",
          mechanism: "The tools misfired on non-native writers at a 61.22% average false-positive rate, which is worse than guessing by coin.",
          consequence: "Anyone wielding a detector score as proof is accusing people with a broken instrument. Do not be that person."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.insecure-codegen",
      wait_eligible: true,
      version: 1,
      concept: "insecure_codegen",
      domain: "security",
      objective: "Understand that AI-generated code can run correctly while carrying security weaknesses.",
      takeaway: "Working is not the bar: run tests, scanners, and dependency checks, and get expert review before deployment.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.agent-real-world"],
      risk_relevance: "This bites when generated code ships to production because it ran, not because anyone audited it.",
      source: { label: "arXiv 2310.02059", url: "https://arxiv.org/abs/2310.02059" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Information Security" },
      familiar_use_trigger: "asking AI to write production code",
      hook_standalone: true,
      recall: "Roughly what share of AI-generated Python snippets carried security weaknesses in the audit?",
      tones: {
        straight: {
          hook: "AI-written code can work perfectly and still be insecure.",
          mechanism: "In one audit, AI-generated snippets carried security weaknesses in 29.5% of Python and 24.2% of JavaScript samples, and they still ran fine.",
          consequence: "Working is not the bar. Tests, security scans, dependency checks, and expert review stand between generated code and production."
        },
        playful: {
          hook: "AI-written code can work perfectly and still be insecure.",
          mechanism: "The model optimizes for code that looks right and runs, not code that survives an attacker; audits found weaknesses in roughly a quarter to a third of snippets.",
          consequence: "Treat generated code like a confident new hire's first commit: useful, promising, and absolutely getting reviewed."
        },
        sarcastic: {
          hook: "AI-written code can work perfectly and still be insecure.",
          mechanism: "29.5% of Python and 24.2% of JavaScript snippets in one audit carried weaknesses, all while running beautifully.",
          consequence: "Run being the bar is how those numbers reach production. Scan it, test it, and let an expert read it first."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.brief-the-analyst",
      wait_eligible: false,
      version: 1,
      concept: "parametric_memory",
      domain: "data_provenance_and_training_data",
      objective: "Understand that without evidence in the prompt, a model answers from compressed training residue rather than your facts.",
      takeaway: "Give it the actual material and state the outcome you need, which changes what machinery produces the answer.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.lost-in-the-middle", "canon.niche-thin-ice"],
      risk_relevance: "This bites when a question about your contract, your data, or your case is answered from the model's blurred memory of the world.",
      source: { label: "OpenAI prompting guide", url: "https://platform.openai.com/docs/guides/prompt-engineering" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Map" },
      familiar_use_trigger: "asking about a document without attaching it",
      hook_standalone: false,
      recall: "What does a model answer from when you give it no source material?",
      tones: {
        straight: {
          hook: "Ask AI without giving it documents and it answers from memory, which blurs details.",
          mechanism: "With no documents in front of it, the model answers from compressed training residue; with your evidence in the prompt, it works from facts you chose.",
          consequence: "Hand it the actual material and say what outcome you need. You are choosing which machine answers: recall or reading."
        },
        playful: {
          hook: "Ask AI without giving it documents and it answers from memory, which blurs details.",
          mechanism: "Unbriefed, the model rebuilds your situation from the average of everything it ever read, which is nobody's situation.",
          consequence: "Brief it like an analyst: here is the material, here is the question, here is what a useful answer contains."
        },
        sarcastic: {
          hook: "Ask AI without giving it documents and it answers from memory, which blurs details.",
          mechanism: "The model fills every gap you leave with statistically typical filler, delivered in the tone of a briefing.",
          consequence: "If the answer should come from your facts, your facts have to be in the prompt. There is no other route in."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.legal-navigator",
      wait_eligible: true,
      version: 1,
      concept: "fluency_reliability_gap",
      domain: "governance_and_accountability",
      objective: "Understand that AI makes research feel finished long before it is verified, and the responsibility for the gap stays human.",
      takeaway: "Use it as a navigator: propositions, candidate authorities, gaps to close; the checking and the accountability remain yours.",
      level: "intermediate",
      prerequisites: ["canon.citation-confabulation"],
      related: ["canon.incomplete-review"],
      risk_relevance: "This bites when the coherence of an AI research summary substitutes for verification in front of a court, a client, or a boss.",
      source: { label: "ABA Formal Opinion 512", url: "https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Govern" },
      familiar_use_trigger: "using AI for research on a deadline",
      hook_standalone: false,
      recall: "What does the speed and coherence of AI research tell you about its reliability?",
      tones: {
        straight: {
          hook: "AI can make research feel finished long before it is verified.",
          mechanism: "It turns a broad question into a coherent map in seconds, and the same fluency that draws the map can pave roads to authorities that do not exist.",
          consequence: "Treat it as a navigator: propositions, candidate sources, gaps to close. Verification stays your job, and so does the responsibility."
        },
        playful: {
          hook: "AI can make research feel finished long before it is verified.",
          mechanism: "The coherence is manufactured in the writing, not earned in the research, so solid and hollow leads arrive looking identical.",
          consequence: "Use the map to plan the trip, then drive every road that matters yourself before anyone follows you down it."
        },
        sarcastic: {
          hook: "AI can make research feel finished long before it is verified.",
          mechanism: "Fluency and reliability are different products, and only one of them ships by default.",
          consequence: "The court, the client, and the bar will hold you, not the tool. Verify like your name is on it, because it is."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.adversarial-use",
      wait_eligible: true,
      version: 1,
      concept: "adversarial_generation",
      domain: "verification_and_evaluation",
      objective: "Understand that a model attacks a conclusion as fluently as it produces one, which makes it a powerful falsification tool.",
      takeaway: "Before relying on a conclusion, make the model build the strongest opposing case and try to falsify your answer.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.sycophancy-mirror", "canon.second-prompt-audit"],
      risk_relevance: "This bites when a position goes out untested because the tool was only ever asked to support it.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "preparing an argument or recommendation",
      hook_standalone: true,
      recall: "What is the model equally good at besides producing your conclusion?",
      tones: {
        straight: {
          hook: "One of AI's most useful jobs is attacking your answer, not writing it.",
          mechanism: "The model builds the opposing case as fluently as it built yours; generation and demolition are one skill pointed in different directions.",
          consequence: "Before relying on a conclusion, have it argue the other side and hunt for what would falsify you. What survives is worth more."
        },
        playful: {
          hook: "One of AI's most useful jobs is attacking your answer, not writing it.",
          mechanism: "The same engine that assembled your argument can assemble the best available case against it, on request, in seconds.",
          consequence: "Let it break your draft in private so nobody gets to break it in public."
        },
        sarcastic: {
          hook: "One of AI's most useful jobs is attacking your answer, not writing it.",
          mechanism: "Support was one prompt; opposition was always the other prompt, sitting right there.",
          consequence: "Ask for the demolition before your audience does. It is the cheapest red team you will ever staff."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.second-prompt-audit",
      wait_eligible: true,
      version: 1,
      concept: "generation_verification_gap",
      domain: "verification_and_evaluation",
      objective: "Understand that models find flaws on request better than they avoid them while writing, so the audit pass is a separate capability.",
      takeaway: "Build the loop: generate, challenge, verify, revise, and test results against criteria, never against how they look.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.adversarial-use", "canon.persona-costume"],
      risk_relevance: "This bites when the first draft ships because it looked finished and nobody ran the challenge pass.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "accepting a polished first draft",
      hook_standalone: false,
      recall: "Why does asking the model to challenge its own answer work so well?",
      tones: {
        straight: {
          hook: "Asking AI to critique its own answer often improves it more than the first ask did.",
          mechanism: "Models are often better at finding flaws on request than at avoiding them while writing; generating and checking run on different tracks.",
          consequence: "Make the loop standard: generate, challenge, verify, revise. Test the result against criteria, never against how finished it looks."
        },
        playful: {
          hook: "Asking AI to critique its own answer often improves it more than the first ask did.",
          mechanism: "Ask the model to attack its own work and a different capability wakes up, one that writes nothing and notices everything.",
          consequence: "Never end on a generation. End on a challenge, a check, and a revision, in that order."
        },
        sarcastic: {
          hook: "Asking AI to critique its own answer often improves it more than the first ask did.",
          mechanism: "The flaws were in there the whole time; the writing pass just had no reason to mention them.",
          consequence: "The confession is one prompt away. Not asking for it is a choice, and it is the wrong one."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.escape-hatch",
      wait_eligible: true,
      version: 1,
      concept: "pattern_completion_bias",
      domain: "human_oversight_and_decision_making",
      objective: "Understand that models complete patterns by default and rarely volunteer that a required piece is missing.",
      takeaway: "Before acting on a recommendation, make the model name what is missing and what it assumed.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.incomplete-review"],
      risk_relevance: "This bites when a recommendation built on silent assumptions gets executed as if it were built on facts.",
      source: { label: "ABA Formal Opinion 512", url: "https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Govern" },
      familiar_use_trigger: "asking for a recommendation with thin inputs",
      hook_standalone: false,
      recall: "What does a model do by default when required information is missing?",
      tones: {
        straight: {
          hook: "AI would rather fill a gap with something plausible than tell you a piece is missing.",
          mechanism: "Trained to continue text, the model fills gaps by default; unless asked, it rarely announces that the decisive fact was never provided.",
          consequence: "Before taking a recommendation, make it list what is missing and what it assumed. The gap list is often the real answer."
        },
        playful: {
          hook: "AI would rather fill a gap with something plausible than tell you a piece is missing.",
          mechanism: "A hole in your input is not an obstacle to the model; it is an invitation, and it always accepts.",
          consequence: "Ask what it had to invent to answer you. The reply is usually more useful than the recommendation was."
        },
        sarcastic: {
          hook: "AI would rather fill a gap with something plausible than tell you a piece is missing.",
          mechanism: "The model completes the form with typical values and moves on, certainty included at no extra charge.",
          consequence: "Premature certainty is the default setting. The what is missing question is how you switch it off."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.inference-privacy",
      wait_eligible: true,
      version: 1,
      concept: "inference_privacy",
      domain: "privacy_and_data_protection",
      objective: "Understand that models infer sensitive traits from harmless looking behavioral traces.",
      takeaway: "Share histories, logs, and habits as carefully as direct answers about yourself; the trace is the disclosure.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.data-minimization", "canon.anthropomorphism"],
      risk_relevance: "This bites when playlists, purchases, or browsing traces get shared as if they revealed nothing personal.",
      source: { label: "PNAS digital-traits study", url: "https://www.pnas.org/doi/10.1073/pnas.1218772110" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Data Privacy" },
      familiar_use_trigger: "sharing usage history or logs for analysis",
      hook_standalone: true,
      recall: "Can a model infer sensitive traits from data that contains no sensitive statements?",
      tones: {
        straight: {
          hook: "AI can infer private facts about you from harmless-looking data.",
          mechanism: "Models infer sensitive traits, politics, health, personality, from harmless looking behavioral traces with unsettling accuracy.",
          consequence: "Treat histories, logs, and habits like direct disclosures, because statistically that is what they are."
        },
        playful: {
          hook: "AI can infer private facts about you from harmless-looking data.",
          mechanism: "Traces correlate: taste predicts traits, traits predict the things you thought were private.",
          consequence: "Before sharing behavioral data, ask what it could predict, not just what it contains."
        },
        sarcastic: {
          hook: "AI can infer private facts about you from harmless-looking data.",
          mechanism: "The sensitive fact was never in the data; it was merely derivable from it, which is the same thing to a model.",
          consequence: "The redacted version of you still leaks through your patterns. Share the patterns accordingly."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.niche-thin-ice",
      wait_eligible: true,
      version: 1,
      concept: "training_data_density",
      domain: "data_provenance_and_training_data",
      objective: "Understand that accuracy tracks how much text existed on a topic during training, so obscure topics invite invention.",
      takeaway: "Scale verification to obscurity: the niche rule, the small vendor, the local detail deserve the most checking.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.training-cutoff", "canon.brief-the-analyst"],
      risk_relevance: "This bites when a niche regulation, product, or person gets the same trusting read as a famous one.",
      source: { label: "arXiv 2211.08411", url: "https://arxiv.org/abs/2211.08411" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Map" },
      familiar_use_trigger: "asking about an obscure or local topic",
      hook_standalone: true,
      recall: "What does a model's accuracy on a topic track most closely?",
      tones: {
        straight: {
          hook: "The more obscure your question, the more the answer is improvised.",
          mechanism: "Accuracy tracks how much text existed on a topic during training; thin coverage gets the same polish as dense coverage, with more invention inside.",
          consequence: "Scale your verification to the obscurity of the subject. The niche is exactly where checking matters most."
        },
        playful: {
          hook: "The more obscure your question, the more the answer is improvised.",
          mechanism: "Both answers arrive in the same confident prose, because the polish comes from the writing, not from the coverage.",
          consequence: "The napkin topics are yours to double check. Unfortunately, the napkin topics are usually the ones you asked about."
        },
        sarcastic: {
          hook: "The more obscure your question, the more the answer is improvised.",
          mechanism: "One of those had a million sources behind it; the other had a rounding error and optimism.",
          consequence: "Confidence does not thin out where the data did. Your skepticism has to do that job."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.automation-bias",
      wait_eligible: true,
      version: 1,
      concept: "automation_bias",
      domain: "human_ai_interaction_and_automation_bias",
      objective: "Understand that people defer to automated output even against their own correct judgment, and vigilance decays with success.",
      takeaway: "Build checking into the process instead of trusting your alertness; the hundredth output deserves the doubt the first one got.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.confidence-not-calibration"],
      risk_relevance: "This bites in any routine workflow where months of correct AI output have quietly retired the review step.",
      source: { label: "Automation bias review (2010)", url: "https://journals.sagepub.com/doi/10.1177/0018720810376055" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Human-AI Configuration" },
      familiar_use_trigger: "approving AI output on autopilot",
      hook_standalone: true,
      recall: "What happens to human vigilance as an automated tool keeps being right?",
      tones: {
        straight: {
          hook: "The most dangerous AI error is the one you stopped checking for.",
          mechanism: "Decades of research show people defer to automated output even against their own correct judgment, and vigilance decays as the tool keeps being right.",
          consequence: "Put checking into the process itself, because your alertness will not survive a long streak of correct answers."
        },
        playful: {
          hook: "The most dangerous AI error is the one you stopped checking for.",
          mechanism: "Trust compounds silently: every correct output shaves a little off the attention you bring to the next one.",
          consequence: "Schedule the skepticism. A checklist does not get lulled, which is the entire point of a checklist."
        },
        sarcastic: {
          hook: "The most dangerous AI error is the one you stopped checking for.",
          mechanism: "The machine kept being right until everyone stopped watching, which is precisely when being wrong got expensive.",
          consequence: "Your vigilance is a depreciating asset. Spend process on the problem instead: reviews that happen whether or not anyone feels alert."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.energy-footprint",
      wait_eligible: false,
      version: 1,
      concept: "resource_intensity",
      domain: "environmental_and_resource_impacts",
      objective: "Understand that training and serving models draws real electricity and cooling water that the interface never shows.",
      takeaway: "Treat heavy AI use as resource use: batch what can be batched and weigh the footprint when choosing tools for bulk work.",
      level: "foundational",
      prerequisites: [],
      related: [],
      risk_relevance: "This bites when bulk automation scales a hidden resource bill that nobody priced in.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Environmental Impacts" },
      familiar_use_trigger: "running bulk or always-on AI jobs",
      hook_standalone: true,
      recall: "What physical resources does an AI answer consume that the interface never shows?",
      tones: {
        straight: {
          hook: "Every AI answer consumes real electricity and water somewhere.",
          mechanism: "Training and serving large models draws real electricity and cooling water at data center scale, and none of it appears in the chat window.",
          consequence: "Treat heavy use as resource use: batch bulk jobs, pick right sized tools, and count the footprint as a cost that exists."
        },
        playful: {
          hook: "Every AI answer consumes real electricity and water somewhere.",
          mechanism: "Somewhere concrete and humming, your tokens are electricity and your uptime is cooling water.",
          consequence: "The footprint is invisible at the keyboard and real at the substation. Size your usage like it costs something, because it does."
        },
        sarcastic: {
          hook: "Every AI answer consumes real electricity and water somewhere.",
          mechanism: "The interface shows a blinking cursor; the infrastructure shows a power draw.",
          consequence: "Nobody is billing you the water yet. Act like they might, and put the bulk jobs where they are cheapest to run."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.model-swap-underfoot",
      wait_eligible: true,
      version: 1,
      concept: "value_chain_opacity",
      domain: "third_party_and_value_chain",
      objective: "Understand that AI features sit on third-party models through layers of vendors, so behavior can change when you changed nothing.",
      takeaway: "Record which model and version your workflows depend on, retest after updates, and know who to call when the layer under you moves.",
      level: "advanced",
      prerequisites: [],
      related: ["canon.loaded-dice"],
      risk_relevance: "This bites when an upstream model update, policy change, or outage rewrites your tool's behavior overnight.",
      source: { label: "NIST AI 600-1", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Value Chain" },
      familiar_use_trigger: "a familiar AI tool suddenly behaving differently",
      hook_standalone: true,
      recall: "Why can an AI tool's behavior change when you changed nothing?",
      tones: {
        straight: {
          hook: "The AI inside an app can be swapped for a different model without notice.",
          mechanism: "Most AI features sit on third-party models through layers of vendors, and an upstream update, policy change, or outage changes your tool overnight.",
          consequence: "For workflows that matter, record the model and version you depend on, retest after updates, and know who to call when the floor moves."
        },
        playful: {
          hook: "The AI inside an app can be swapped for a different model without notice.",
          mechanism: "App, platform, model provider: any layer can change the recipe, and the menu will not mention it.",
          consequence: "If a workflow is load bearing, write down what it stands on and check the footing after every update announcement, and some quiet Tuesdays too."
        },
        sarcastic: {
          hook: "The AI inside an app can be swapped for a different model without notice.",
          mechanism: "You signed up for a product; the product signed up for a model; the model changed. Nobody scheduled a meeting about it.",
          consequence: "Version-pin what can be pinned, log what cannot, and keep a fallback for the morning the stack surprises you."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.memorization-leakage",
      wait_eligible: true,
      version: 1,
      concept: "memorization_leakage",
      domain: "intellectual_property",
      objective: "Understand that models sometimes store training data verbatim and can be prompted into reciting it.",
      takeaway: "Treat output as possibly copied, not just inspired: run plagiarism and license checks before publishing.",
      level: "advanced",
      prerequisites: [],
      related: ["canon.model-collapse", "canon.prompt-is-disclosure"],
      risk_relevance: "This bites when generated text or code that duplicates copyrighted or personal training data gets published under your name.",
      source: { label: "arXiv 2012.07805", url: "https://arxiv.org/abs/2012.07805" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Intellectual Property" },
      familiar_use_trigger: "publishing generated text or code as original",
      hook_standalone: true,
      recall: "Can verbatim training data be extracted from a deployed model?",
      tones: {
        straight: {
          hook: "Models sometimes remember training data word for word, and can be made to recite it.",
          mechanism: "Researchers extracted verbatim training text, including personal data, from deployed models; rare per prompt, but demonstrated and repeatable.",
          consequence: "Treat output as possibly copied rather than inspired: run plagiarism and license checks before it ships, and assume inputs to training can resurface."
        },
        playful: {
          hook: "Models sometimes remember training data word for word, and can be made to recite it.",
          mechanism: "Some training passages stick whole, and the right nudge brings them back out verbatim, author not included.",
          consequence: "Before publishing generated work as original, check it the way an editor would check a suspiciously polished intern."
        },
        sarcastic: {
          hook: "Models sometimes remember training data word for word, and can be made to recite it.",
          mechanism: "Extraction attacks pulled exact training text out of production models, which settles the can it happen debate.",
          consequence: "Your name goes on the output, and so would the infringement. Scan before you ship."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.model-collapse",
      wait_eligible: false,
      version: 1,
      concept: "model_collapse",
      domain: "data_provenance_and_training_data",
      objective: "Understand that models trained on model output lose the rare cases first and degrade across generations.",
      takeaway: "Know the provenance of data you train on and publish, because human-made data is becoming the scarce ingredient.",
      level: "advanced",
      prerequisites: [],
      related: ["canon.homogenization-siblings", "canon.memorization-leakage"],
      risk_relevance: "This bites when synthetic data quietly enters training sets and the edge cases your business depends on fade first.",
      source: { label: "Nature model collapse study", url: "https://www.nature.com/articles/s41586-024-07566-y" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Map" },
      familiar_use_trigger: "generating content that will be scraped or reused",
      hook_standalone: true,
      recall: "What fades first when models are trained on model-generated data?",
      tones: {
        straight: {
          hook: "AI trained on AI output loses the rare and unusual cases.",
          mechanism: "When models train on model output, rare and unusual cases fade first and quality degrades generation over generation; researchers call it model collapse.",
          consequence: "Provenance becomes a real property of data: know how much of what you train on, and publish, was made by machines."
        },
        playful: {
          hook: "AI trained on AI output loses the rare and unusual cases.",
          mechanism: "Each synthetic generation keeps the common and drops the rare, so the copies grow smoother and emptier at the edges.",
          consequence: "The rare cases are usually the valuable ones. Guard the human-made data that still contains them."
        },
        sarcastic: {
          hook: "AI trained on AI output loses the rare and unusual cases.",
          mechanism: "Synthetic text feeding synthetic training is a closed loop, and closed loops concentrate blandness with remarkable efficiency.",
          consequence: "If your data diet matters, read the label. Machine-made filler is already in the supply."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.explanation-is-generated",
      wait_eligible: false,
      version: 1,
      concept: "post_hoc_explanation",
      domain: "transparency_and_explanation_limits",
      objective: "Understand that a model's explanation of its own answer is fresh generation, not a report from inside the process.",
      takeaway: "Treat self-explanations as more output to verify, and test behavior instead of interrogating it.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.confidence-not-calibration"],
      risk_relevance: "This bites when an audit or a user accepts the model's account of its reasoning as evidence of what actually happened.",
      source: { label: "arXiv 2305.04388", url: "https://arxiv.org/abs/2305.04388" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "asking the model why it answered that way",
      hook_standalone: true,
      recall: "Is a model's explanation of its own answer a report or a fresh generation?",
      tones: {
        straight: {
          hook: "Ask AI why it did something and it invents an explanation; it has no memory of its reasoning.",
          mechanism: "The explanation comes from the same next-word machinery as everything else; studies show stated reasoning can omit the factors that actually drove the output.",
          consequence: "Treat self-explanations as more output to verify, never as a window into the process. Test behavior; do not interview it."
        },
        playful: {
          hook: "Ask AI why it did something and it invents an explanation; it has no memory of its reasoning.",
          mechanism: "There is no backstage door: the model generates a plausible account of reasoning the way it generates everything, on demand and in character.",
          consequence: "Enjoy the story, then check the answer by the same means you would if no story had been offered."
        },
        sarcastic: {
          hook: "Ask AI why it did something and it invents an explanation; it has no memory of its reasoning.",
          mechanism: "Researchers showed the stated rationale can leave out the thing that actually swayed the output, while sounding thorough about everything else.",
          consequence: "Because I said so, rewritten eloquently, is still not evidence. Verify the answer, not the anecdote about it."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.jagged-frontier",
      wait_eligible: true,
      version: 1,
      concept: "capability_jaggedness",
      domain: "verification_and_evaluation",
      objective: "Understand that AI competence is jagged, so strength on one task says little about the neighboring task.",
      takeaway: "Probe each task type yourself before trusting it with real work; never infer skill from a neighboring skill.",
      level: "advanced",
      prerequisites: [],
      related: ["canon.persona-costume", "canon.automation-bias"],
      risk_relevance: "This bites when success on one task becomes the justification for trusting the model with a task that merely looks similar.",
      source: { label: "Jagged Frontier field study", url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "extending AI to a new task after one success",
      hook_standalone: true,
      recall: "Does strong AI performance on one task predict performance on a similar-looking task?",
      tones: {
        straight: {
          hook: "AI aces the bar exam and miscounts the letters in a word; competence does not travel.",
          mechanism: "Capability is jagged: in a large field study, consultants using AI got big gains on tasks inside the frontier and got worse on a task just outside it.",
          consequence: "Never infer skill on your task from skill on a neighboring one. Probe each task type before it touches real work."
        },
        playful: {
          hook: "AI aces the bar exam and miscounts the letters in a word; competence does not travel.",
          mechanism: "The boundary between what it does brilliantly and what it flubs is invisible and weirdly shaped, and it moves with every model version.",
          consequence: "Map the frontier for your own tasks with small tests, and redraw the map when the model changes."
        },
        sarcastic: {
          hook: "AI aces the bar exam and miscounts the letters in a word; competence does not travel.",
          mechanism: "The field study's consultants who trusted it outside the frontier performed worse than colleagues with no AI at all.",
          consequence: "Yesterday's triumph is not a transferable credential. Test the new task like the last one never happened."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.incomplete-review",
      wait_eligible: true,
      version: 1,
      concept: "omission_blindness",
      domain: "human_oversight_and_decision_making",
      objective: "Understand that a polished issue list proves nothing about completeness, because omissions are invisible in the output.",
      takeaway: "Demand clause-level citations, run a coverage checklist against the document, and make it flag missing information.",
      level: "advanced",
      prerequisites: [],
      related: ["canon.escape-hatch", "canon.legal-navigator"],
      risk_relevance: "This bites when a contract or document review is accepted as complete because the issues it did raise looked thorough.",
      source: { label: "ABA Formal Opinion 512", url: "https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Govern" },
      familiar_use_trigger: "reviewing a contract or document with AI",
      hook_standalone: true,
      recall: "What does a polished issue list fail to prove about a document review?",
      tones: {
        straight: {
          hook: "The most dangerous clause may be the one AI never mentions.",
          mechanism: "A polished issue list cannot prove completeness; the model does not show what it skipped, and the reviewer remains responsible for all of it.",
          consequence: "Demand clause-level citations, run a coverage checklist against the document itself, and make it flag missing information. Silence is not clearance."
        },
        playful: {
          hook: "The most dangerous clause may be the one AI never mentions.",
          mechanism: "Omissions leave no trace in the output, so a confident nine-item list and a complete nine-item list look identical.",
          consequence: "Audit coverage, not quality: walk the document and ask what the review said about each part. The gaps introduce themselves."
        },
        sarcastic: {
          hook: "The most dangerous clause may be the one AI never mentions.",
          mechanism: "The model does not annotate its blind spots; thoroughness of tone and thoroughness of coverage are entirely different products.",
          consequence: "The clause it never mentioned is still binding. Check the document against the review, not the review against your hopes."
        }
      }
    },

    {
      schema: "omono.lesson.v5",
      lesson_id: "canon.guardrails-not-walls",
      wait_eligible: true,
      version: 1,
      concept: "jailbreak_fragility",
      domain: "harmful_content_and_misuse",
      objective: "Understand that refusals are learned behavior that adversarial inputs can reliably route around.",
      takeaway: "Never build a product or policy that assumes the model will always refuse; put independent checks between the model and anything dangerous.",
      level: "advanced",
      prerequisites: [],
      related: ["canon.injected-instructions", "canon.agent-real-world"],
      risk_relevance: "This bites when a system's only defense against misuse is the model's own politeness.",
      source: { label: "arXiv 2307.15043", url: "https://arxiv.org/abs/2307.15043" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Information Security" },
      familiar_use_trigger: "relying on the model to refuse misuse",
      hook_standalone: true,
      recall: "Are a model's refusals a guarantee or a learned behavior that can be bypassed?",
      tones: {
        straight: {
          hook: "AI safety training can be talked around; people find new ways constantly.",
          mechanism: "Refusals are learned behavior; researchers built adversarial suffixes that reliably route around them and transfer across models.",
          consequence: "Never let the refusal be the only defense. Put your own checks between the model and anything dangerous, and assume the habit can be broken."
        },
        playful: {
          hook: "AI safety training can be talked around; people find new ways constantly.",
          mechanism: "The model refuses the way it was trained to refuse, and attackers study exactly that training for a living.",
          consequence: "Keep a second lock on anything that matters: permissions, filters, review. The bouncer alone is a costume drama."
        },
        sarcastic: {
          hook: "AI safety training can be talked around; people find new ways constantly.",
          mechanism: "Published attacks turn no into sure thing with a string of characters, reproducibly, across vendors.",
          consequence: "If your safety plan is the model says no, you have a demo, not a safety plan. Add controls the model cannot be talked out of."
        }
      }
    }
,

    /* F2 (D3): the foundation completed; one foundational lesson in every
       one of the eighteen domains, authored under the gate for the owner's
       review. */
    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.checking-is-the-job",
      wait_eligible: false,
      "version": 1,
      "concept": "generation_verification_gap",
      "domain": "verification_and_evaluation",
      "objective": "Understand that AI moves the effort from producing work to checking it, and the checking was always the hard part.",
      "takeaway": "Budget real time for verification; the draft was the cheap half.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites whenever a fast draft is mistaken for a finished, checked piece of work.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI RMF: Measure"
      },
      "familiar_use_trigger": "accepting a first draft quickly",
      "hook_standalone": true,
      "recall": "Which half of the work does AI actually remove: the writing or the checking?",
      "tones": {
        "straight": {
          "hook": "AI removes the writing, not the checking; the hard half is still yours.",
          "mechanism": "A model produces a plausible draft in seconds, and plausibility says nothing about correctness, so the burden shifts to review.",
          "consequence": "Plan the checking as the real work: read against the source, test the claims, and only then call it done."
        },
        "playful": {
          "hook": "AI removes the writing, not the checking; the hard half is still yours.",
          "mechanism": "Generation got cheap, verification did not, and the gap between them is where errors ship.",
          "consequence": "Treat every draft as unchecked inventory until you have inspected it."
        },
        "sarcastic": {
          "hook": "AI removes the writing, not the checking; the hard half is still yours.",
          "mechanism": "The model finished the easy half at speed and left the expensive half untouched.",
          "consequence": "Check it like you would check a stranger's work, because statistically that is what it is."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.average-instincts",
      wait_eligible: true,
      "version": 1,
      "concept": "training_data_bias",
      "domain": "bias_and_fairness",
      "objective": "Understand that a model's defaults reflect the averages and biases of its training data.",
      "takeaway": "Ask whose perspective the answer assumes before relying on it for people-facing work.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites in hiring, assessment, and any text that describes or judges people.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI 600-1: Harmful Bias and Homogenization"
      },
      "familiar_use_trigger": "asking for judgements about people",
      "hook_standalone": true,
      "recall": "Where do a model's default assumptions about people come from?",
      "tones": {
        "straight": {
          "hook": "AI learned its habits from the internet's averages, biases included.",
          "mechanism": "Training data carries the skews of whoever wrote it, and the model reproduces those skews fluently and invisibly.",
          "consequence": "For anything about people, name the assumptions, vary the framing, and keep a human decision in the loop."
        },
        "playful": {
          "hook": "AI learned its habits from the internet's averages, biases included.",
          "mechanism": "Its defaults are learned averages, so whoever was overrepresented gets to be normal.",
          "consequence": "Ask it to state its assumptions and check who is missing from them."
        },
        "sarcastic": {
          "hook": "AI learned its habits from the internet's averages, biases included.",
          "mechanism": "The even tone hides learned skews the model cannot see in itself.",
          "consequence": "Never let the calm voice stand in for fairness; check the output against the people it touches."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.no-gauge",
      wait_eligible: false,
      "version": 1,
      "concept": "uncertainty_blindness",
      "domain": "model_behavior_and_uncertainty",
      "objective": "Understand that a model has no internal gauge of its own certainty that it can report to you.",
      "takeaway": "Decide how much checking a task needs from the stakes, never from how sure the answer sounds.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites when confidence of tone is used to decide what gets verified.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI RMF: Measure"
      },
      "familiar_use_trigger": "trusting a sure-sounding answer",
      "hook_standalone": true,
      "recall": "Can a model reliably tell you how certain it is about an answer?",
      "tones": {
        "straight": {
          "hook": "AI has no internal measure of its own certainty, and asking for one does not create it.",
          "mechanism": "Asking for a confidence level produces another generated answer, not a reading from an instrument.",
          "consequence": "Calibrate your checking to the stakes of the task, because the model cannot calibrate it for you."
        },
        "playful": {
          "hook": "AI has no internal measure of its own certainty, and asking for one does not create it.",
          "mechanism": "The stated percentage is text prediction, exactly like the answer it describes.",
          "consequence": "Stakes decide scrutiny; the model's self-report decides nothing."
        },
        "sarcastic": {
          "hook": "AI has no internal measure of its own certainty, and asking for one does not create it.",
          "mechanism": "There is no meter behind the curtain, only more generation.",
          "consequence": "Check important things hard regardless of how sure anything sounded."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.nobody-owns-it",
      wait_eligible: false,
      "version": 1,
      "concept": "output_ownership",
      "domain": "intellectual_property",
      "objective": "Understand that ownership and protection of AI-generated text and images is unsettled and often weaker than for human work.",
      "takeaway": "Treat generated material as unprotected by default and add human authorship where ownership matters.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites when generated content becomes a logo, a product text, or anything the organization must own.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI 600-1: Intellectual Property"
      },
      "familiar_use_trigger": "using generated content commercially",
      "hook_standalone": true,
      "recall": "Is AI-generated work protected the way your own writing is?",
      "tones": {
        "straight": {
          "hook": "Nobody fully owns what AI writes, and that includes you.",
          "mechanism": "Copyright systems protect human authorship, and purely generated material often falls outside that protection.",
          "consequence": "Where ownership matters, put real human authorship into the work and keep records of it."
        },
        "playful": {
          "hook": "Nobody fully owns what AI writes, and that includes you.",
          "mechanism": "Protection follows human creativity, and the generated part may carry none in the eyes of the law.",
          "consequence": "Add your own authorship where it counts, and ask before building a brand on a prompt."
        },
        "sarcastic": {
          "hook": "Nobody fully owns what AI writes, and that includes you.",
          "mechanism": "The law protects authors, and the model is not one, which leaves gaps where your rights would be.",
          "consequence": "If the organization must own it, a human must meaningfully make it."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.someone-signs",
      wait_eligible: false,
      "version": 1,
      "concept": "accountability_stays_human",
      "domain": "governance_and_accountability",
      "objective": "Understand that responsibility for AI-assisted work cannot transfer to the tool.",
      "takeaway": "Ship AI-assisted work only under a named person who checked it and stands behind it.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites when a failure surfaces and the answer to who approved this is a product name.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI RMF: Govern"
      },
      "familiar_use_trigger": "shipping work drafted by AI",
      "hook_standalone": true,
      "recall": "When AI-assisted work fails, who is accountable?",
      "tones": {
        "straight": {
          "hook": "The AI cannot be blamed; someone with a name signs the work.",
          "mechanism": "Accountability attaches to people and organizations, and no contract, policy, or regulator accepts a model as the responsible party.",
          "consequence": "Put a named reviewer on everything AI touches that matters, and make sure they actually reviewed it."
        },
        "playful": {
          "hook": "The AI cannot be blamed; someone with a name signs the work.",
          "mechanism": "When things go wrong, responsibility lands on whoever shipped it, not on what drafted it.",
          "consequence": "Sign only what you checked; the signature is the system."
        },
        "sarcastic": {
          "hook": "The AI cannot be blamed; someone with a name signs the work.",
          "mechanism": "Blame does not parse tool names, only people who approved things.",
          "consequence": "Review like your name is on it, because it is."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.why-is-a-story",
      /* P5: retired-duplicate; never selectable; emission history counts
         toward the survivor in coverage. */
      retired_duplicate: true,
      merged_into: "canon.explanation-is-generated",
      wait_eligible: false,
      "version": 1,
      "concept": "post_hoc_explanation",
      "domain": "transparency_and_explanation_limits",
      "objective": "Understand that a model's explanation of its own answer is a new generation, not a window into the process.",
      "takeaway": "Verify the answer itself; never accept the explanation as evidence that the answer is right.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites when a plausible explanation is used to skip checking the underlying claim.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI RMF: Measure"
      },
      "familiar_use_trigger": "asking the model to explain itself",
      "hook_standalone": true,
      "recall": "Is the model's explanation of its answer a record of how the answer was made?",
      "tones": {
        "straight": {
          "hook": "AI's explanation of its own answer is written after the fact, not remembered.",
          "mechanism": "The explanation is generated after the fact, by the same prediction machinery, with no access to what actually happened inside.",
          "consequence": "Judge answers by checking them against sources, never by how convincing their explanation reads."
        },
        "playful": {
          "hook": "AI's explanation of its own answer is written after the fact, not remembered.",
          "mechanism": "It is produced the same way the answer was: predicted, not recalled.",
          "consequence": "A tidy why proves nothing; verify the what."
        },
        "sarcastic": {
          "hook": "AI's explanation of its own answer is written after the fact, not remembered.",
          "mechanism": "Self-explanations are fresh fiction about prior fiction, delivered with footnote energy.",
          "consequence": "Check the claim, ignore the memoir."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.same-helpfulness",
      wait_eligible: false,
      "version": 1,
      "concept": "dual_use",
      "domain": "harmful_content_and_misuse",
      "objective": "Understand that the capabilities that make AI useful are the same ones that make it usable for harm.",
      "takeaway": "Judge requests and outputs by their real-world use, and report misuse paths you notice at work.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites when convincing text, voices, or code are generated for whoever asks, including attackers.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI 600-1: Information Security"
      },
      "familiar_use_trigger": "receiving convincing unexpected messages",
      "hook_standalone": true,
      "recall": "Why does the usefulness of AI come packaged with misuse potential?",
      "tones": {
        "straight": {
          "hook": "The same helpfulness that drafts your memo can draft a scam.",
          "mechanism": "Fluency, speed, and persuasion are neutral capabilities, and they serve fraud as readily as work.",
          "consequence": "Raise your suspicion of polished unexpected messages, and treat misuse potential as part of every AI decision."
        },
        "playful": {
          "hook": "The same helpfulness that drafts your memo can draft a scam.",
          "mechanism": "The model does not know a phishing email from a newsletter; both are just convincing text.",
          "consequence": "Polish is no longer a signal of legitimacy; verify senders and requests through other channels."
        },
        "sarcastic": {
          "hook": "The same helpfulness that drafts your memo can draft a scam.",
          "mechanism": "Persuasive text at zero cost changed the economics of deception.",
          "consequence": "Assume polish is cheap now, and verify things that ask you for money, access, or urgency."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.answers-cost-water",
      /* P5: retired-duplicate; never selectable; emission history counts
         toward the survivor in coverage. */
      retired_duplicate: true,
      merged_into: "canon.energy-footprint",
      wait_eligible: false,
      "version": 1,
      "concept": "resource_intensity",
      "domain": "environmental_and_resource_impacts",
      "objective": "Understand that every generation consumes real energy and water in physical data centers.",
      "takeaway": "Match the tool to the task; a heavy model on a trivial job is a real cost with no benefit.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites when organizations scale AI use without accounting for its footprint.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI 600-1: Environmental Impacts"
      },
      "familiar_use_trigger": "running heavy models for small tasks",
      "hook_standalone": true,
      "recall": "What physical resources does an AI answer consume?",
      "tones": {
        "straight": {
          "hook": "Running AI at scale draws on power grids and water supplies in real places.",
          "mechanism": "Generation happens in data centers that draw serious power and cooling, and the footprint scales with model size and volume.",
          "consequence": "Use the light tool for the light job, and count AI volume as a resource decision, not just a cost line."
        },
        "playful": {
          "hook": "Running AI at scale draws on power grids and water supplies in real places.",
          "mechanism": "Your prompt lands in a building that hums and drinks; bigger models hum louder.",
          "consequence": "Right-size the model to the task and skip the generation nobody needed."
        },
        "sarcastic": {
          "hook": "Running AI at scale draws on power grids and water supplies in real places.",
          "mechanism": "Compute is physical, and casual volume adds up to real consumption.",
          "consequence": "Spend the heavy models where they earn it."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.chain-of-services",
      wait_eligible: true,
      "version": 1,
      "concept": "value_chain_opacity",
      "domain": "third_party_and_value_chain",
      "objective": "Understand that an AI feature is a chain of third-party services, any link of which can change or fail without notice.",
      "takeaway": "Know which providers sit under your AI tools and what happens to your data and behavior when a link changes.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites when a provider swap silently changes behavior, terms, or where data flows.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI 600-1: Value Chain"
      },
      "familiar_use_trigger": "adopting an AI-powered tool",
      "hook_standalone": true,
      "recall": "What sits between your prompt and the answer in a typical AI product?",
      "tones": {
        "straight": {
          "hook": "Your AI tool is a chain of other people's services.",
          "mechanism": "The app calls a provider, which may call others, and each link has its own terms, retention, and failure modes.",
          "consequence": "Before trusting a tool with real work, learn whose model it runs and where your text goes."
        },
        "playful": {
          "hook": "Your AI tool is a chain of other people's services.",
          "mechanism": "AI features are assembled from third parties, and the assembly can change under you.",
          "consequence": "Ask what is under the hood, and re-ask after big updates."
        },
        "sarcastic": {
          "hook": "Your AI tool is a chain of other people's services.",
          "mechanism": "Providers get swapped, terms drift, and your data walks the whole chain.",
          "consequence": "Treat the supply chain as part of the tool, because it is."
        }
      }
    },

    {
      "schema": "omono.lesson.v5",
      "lesson_id": "canon.approve-is-not-oversight",
      wait_eligible: true,
      "version": 1,
      "concept": "meaningful_oversight",
      "domain": "human_oversight_and_decision_making",
      "objective": "Understand that oversight means engaging with the substance of AI output, not ritually approving it.",
      "takeaway": "Make review mean something: check against criteria, sample deeply, and keep authority to say no.",
      "level": "foundational",
      "prerequisites": [],
      "related": [],
      "risk_relevance": "Bites wherever a human-in-the-loop exists on paper but rubber-stamps in practice.",
      "source": {
        "label": "NIST AI 600-1",
        "url": "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"
      },
      "framework": {
        "eu_ai_act": "Article 4",
        "nist": "NIST AI RMF: Govern"
      },
      "familiar_use_trigger": "approving AI output in a queue",
      "hook_standalone": true,
      "recall": "What separates real oversight from clicking approve?",
      "tones": {
        "straight": {
          "hook": "A human who only clicks approve is not overseeing anything.",
          "mechanism": "Oversight that never digs into substance converges on approval by default, which is automation with extra steps.",
          "consequence": "Give reviewers criteria, time, and the standing to reject; sample deeply instead of skimming everything."
        },
        "playful": {
          "hook": "A human who only clicks approve is not overseeing anything.",
          "mechanism": "If the human never says no, the loop is decoration.",
          "consequence": "Measure oversight by rejections and corrections, not by approvals per hour."
        },
        "sarcastic": {
          "hook": "A human who only clicks approve is not overseeing anything.",
          "mechanism": "Approval without engagement is the automation pretending to be checked.",
          "consequence": "Make no a real option or stop calling it oversight."
        }
      }
    },
    {
      lesson_id: "canon.brief-vs-script",
      schema: "omono.lesson.v5",
      wait_eligible: false,
      version: 1,
      concept: "brief_vs_script",
      domain: "agentic_systems_and_tool_autonomy",
      objective: "Understand that agent surfaces plan their own steps, so a brief beats a script.",
      takeaway: "Give an agent the objective, what it may touch, and what done looks like; give a chat tool the full structured prompt.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.agent-real-world"],
      risk_relevance: "This bites whenever an agent surface receives a micro-scripted prompt that fights its own planning.",
      source: { label: "Maker documentation (register)", url: "https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Manage" },
      familiar_use_trigger: "writing for an agent surface",
      hook_standalone: true,
      recall: "Why does a long list of micro-instructions fight an agent tool instead of helping it?",
      tones: {
        straight: { hook: "An agent wants a goal, a chat wants instructions.", mechanism: "Agent tools plan their own steps, so a long list of micro-instructions fights them instead of helping.", consequence: "Give an agent the objective, what it may touch, and what done looks like; give a chat tool the full structured prompt." },
        playful: { hook: "An agent wants a goal, a chat wants instructions.", mechanism: "Agent tools plan their own steps, so a long list of micro-instructions fights them instead of helping.", consequence: "Give an agent the objective, what it may touch, and what done looks like; give a chat tool the full structured prompt." },
        sarcastic: { hook: "An agent wants a goal, a chat wants instructions.", mechanism: "Agent tools plan their own steps, so a long list of micro-instructions fights them instead of helping.", consequence: "Give an agent the objective, what it may touch, and what done looks like; give a chat tool the full structured prompt." }
      }
    },
    {
      lesson_id: "canon.surface-wraps-model",
      schema: "omono.lesson.v5",
      wait_eligible: false,
      version: 1,
      concept: "surface_wraps_model",
      domain: "third_party_and_value_chain",
      objective: "Understand that the product wraps the model with its own instructions, tools, and permissions.",
      takeaway: "What worked in one app can fail in another even when the model underneath is identical.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.model-swap-underfoot", "canon.chain-of-services"],
      risk_relevance: "This bites whenever a prompt is moved between products that wrap the same model differently.",
      source: { label: "The register's surface comparisons", url: "https://support.claude.com/en/articles/8114491-get-started-with-claude" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Value Chain" },
      familiar_use_trigger: "moving a prompt between tools",
      hook_standalone: true,
      recall: "Why can the same model behave differently inside two different apps?",
      tones: {
        straight: { hook: "The same model behaves differently inside different apps.", mechanism: "Each product wraps the model with its own instructions, tools, and permissions.", consequence: "What worked in one app can fail in another even when the model underneath is identical." },
        playful: { hook: "The same model behaves differently inside different apps.", mechanism: "Each product wraps the model with its own instructions, tools, and permissions.", consequence: "What worked in one app can fail in another even when the model underneath is identical." },
        sarcastic: { hook: "The same model behaves differently inside different apps.", mechanism: "Each product wraps the model with its own instructions, tools, and permissions.", consequence: "What worked in one app can fail in another even when the model underneath is identical." }
      }
    },
    {
      lesson_id: "canon.review-the-plan",
      schema: "omono.lesson.v5",
      wait_eligible: false,
      version: 1,
      concept: "review_the_plan",
      domain: "human_oversight_and_decision_making",
      objective: "Understand that a research plan is the one cheap moment of control before a long run.",
      takeaway: "The plan is your one cheap moment of control; a bad plan runs just as long as a good one.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.approve-is-not-oversight"],
      risk_relevance: "This bites whenever a deep-research run executes for many minutes on an unedited plan.",
      source: { label: "Maker documentation (register)", url: "https://support.google.com/gemini/answer/15719111?hl=en" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Govern" },
      familiar_use_trigger: "starting a deep research run",
      hook_standalone: true,
      recall: "What is the one cheap moment of control in a deep-research run?",
      tones: {
        straight: { hook: "When AI proposes a research plan, edit it before it runs.", mechanism: "Deep-research tools plan first and execute for many minutes.", consequence: "The plan is your one cheap moment of control; a bad plan runs just as long as a good one." },
        playful: { hook: "When AI proposes a research plan, edit it before it runs.", mechanism: "Deep-research tools plan first and execute for many minutes.", consequence: "The plan is your one cheap moment of control; a bad plan runs just as long as a good one." },
        sarcastic: { hook: "When AI proposes a research plan, edit it before it runs.", mechanism: "Deep-research tools plan first and execute for many minutes.", consequence: "The plan is your one cheap moment of control; a bad plan runs just as long as a good one." }
      }
    },
    {
      lesson_id: "canon.one-question-per-pass",
      schema: "omono.lesson.v5",
      wait_eligible: false,
      version: 1,
      concept: "one_question_per_pass",
      domain: "verification_and_evaluation",
      objective: "Understand that grid tools run each question against every document separately.",
      takeaway: "Stuffing several asks into one question blurs all of them across the whole set.",
      level: "intermediate",
      prerequisites: [],
      related: ["canon.incomplete-review"],
      risk_relevance: "This bites whenever a tabular-review column carries several asks at once.",
      source: { label: "Maker documentation (register)", url: "https://legora.com/product/tabular-review" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI RMF: Measure" },
      familiar_use_trigger: "writing a batch-review question",
      hook_standalone: true,
      recall: "Why does batch review work best as one narrow question at a time?",
      tones: {
        straight: { hook: "Batch review works best as one narrow question at a time.", mechanism: "Grid tools run each question against every document separately.", consequence: "Stuffing several asks into one question blurs all of them across the whole set." },
        playful: { hook: "Batch review works best as one narrow question at a time.", mechanism: "Grid tools run each question against every document separately.", consequence: "Stuffing several asks into one question blurs all of them across the whole set." },
        sarcastic: { hook: "Batch review works best as one narrow question at a time.", mechanism: "Grid tools run each question against every document separately.", consequence: "Stuffing several asks into one question blurs all of them across the whole set." }
      }
    },
    {
      lesson_id: "canon.plain-words-still-decide",
      schema: "omono.lesson.v5",
      wait_eligible: false,
      version: 1,
      /* P6 note for the owner's veto: the ruled domain "instructing AI
         effectively" is not one of the eighteen; mapped to the nearest
         (working with AI) per the conservative-choice rule. */
      concept: "plain_words_still_decide",
      domain: "human_ai_interaction_and_automation_bias",
      objective: "Understand that a tool needing no prompt engineering still needs the user's precision.",
      takeaway: "What you want, for whom, and by when still decide everything, because the tool cannot supply your intent.",
      level: "foundational",
      prerequisites: [],
      related: ["canon.brief-vs-script"],
      risk_relevance: "This bites whenever no-prompt-engineering marketing is read as no-precision-needed.",
      source: { label: "Vendor help vs marketing (register)", url: "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/skills/prompting.html" },
      framework: { eu_ai_act: "Article 4", nist: "NIST AI 600-1: Human-AI Configuration" },
      familiar_use_trigger: "using a tool marketed as needing no prompts",
      hook_standalone: true,
      recall: "What still decides everything when a tool needs no prompt engineering?",
      tones: {
        straight: { hook: "A tool that needs no prompt engineering still needs your precision.", mechanism: "Some tools plan the steps for you, so special phrasing matters less.", consequence: "What you want, for whom, and by when still decide everything, because the tool cannot supply your intent." },
        playful: { hook: "A tool that needs no prompt engineering still needs your precision.", mechanism: "Some tools plan the steps for you, so special phrasing matters less.", consequence: "What you want, for whom, and by when still decide everything, because the tool cannot supply your intent." },
        sarcastic: { hook: "A tool that needs no prompt engineering still needs your precision.", mechanism: "Some tools plan the steps for you, so special phrasing matters less.", consequence: "What you want, for whom, and by when still decide everything, because the tool cannot supply your intent." }
      }
    }
  ]
};
/* R2: the seed under the name that says what it is. Same array, never a copy,
   so nothing can drift between the two. */
OMonoLessonCanonV5.seed = OMonoLessonCanonV5.lessons;
if (typeof module !== "undefined" && module.exports) module.exports = OMonoLessonCanonV5;
if (typeof window !== "undefined") window.OMonoLessonCanonV5 = OMonoLessonCanonV5;
else if (typeof globalThis !== "undefined") globalThis.OMonoLessonCanonV5 = OMonoLessonCanonV5;
