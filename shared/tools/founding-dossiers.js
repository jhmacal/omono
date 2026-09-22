"use strict";
/* THE FOUNDING TOOL DOSSIERS — GENERATED, NEVER HAND-EDITED.
 * Source of record: omono_tool_dossiers.md (owner-approved, checked
 * 2026-08-17). Regenerate with: node palette/tools/v4/load-dossiers.js
 * The prose fields are verbatim card text including citation markers; the
 * app strips markers at display and keeps sources behind one disclosure.
 * Browser-safe: plain data, dual export. */
var OMonoFoundingDossiers = { dossiers: [
  {
    "id": "claude",
    "display_name": "Claude",
    "maker": "Anthropic",
    "surface_type": "chat app",
    "identity": "Claude, Anthropic, chat app. This card covers the Claude web, desktop, and mobile chat product. [C1]",
    "good_at": "Claude supports conversational drafting, synthesis, uploaded-document analysis, web-backed answers, extended research, and code-backed data or file creation. [C2][C3][C4] Its paid Research mode can run multiple searches across the public web and connected internal sources, while its sandbox can execute Python or JavaScript and create editable documents, spreadsheets, slides, and PDFs. [C2][C3] In a 2026 independent test of the Claude Pro web interface on 331 periodontal exam questions, Claude Sonnet 4.0 reached 87.4 percent accuracy and the lowest citation-hallucination rate in that test, 5.59 percent, although performance varied by topic and declined across the sequence. That narrow clinical test does not establish the quality of Claude's current model lineup across general work. [C5]",
    "avoid": "Do not treat Claude as the sole authority for high-stakes facts, quotations, or citations, because Anthropic says it can produce convincing but false statements and advises users to check original sources. [C6] Do not assume Claude read every visual in an uploaded office document: it extracts text from many non-PDF documents, while PDF visual processing follows separate limits. [C4] Do not expose sensitive data or connected tools to untrusted web or file content during code execution, because Anthropic identifies prompt injection and data exfiltration as risks. [C3]",
    "prompt_shaping": "Use a full structured prompt. Put the task and desired result first, then provide the relevant context or source material, audience, constraints, output format, and any example that materially defines success. For long material, label sections clearly and place source documents before the final question. Explicitly request web search or Research when current information matters, name any sources or sites to prioritize, and instruct Claude to flag anything it cannot verify. [C1][C7]",
    "prompt_surfaces": "The ordinary prompt door is the message box in Claude on web, desktop, or mobile. [C1] The plus button beside the box adds files or photos and exposes Search and Research tools; Project chats use the same chat door with Project knowledge available as context. [C2][C4][C8] The model selector sits beside the send button. [C9]",
    "double_check": "Verify every load-bearing fact, quotation, link, and citation against the original source. Check whether Claude actually used the requested current-web mode and whether every cited page supports the nearby claim. Review later items in long batches with extra care, because the independent clinical test found declining accuracy across its question sequence. Verify figures, formulas, code, and generated files before reuse. [C3][C5][C6]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**. Reads uploaded files: **yes**. Runs tools or code: **yes**. Plans multi-step work: **yes**, through Research. Availability can depend on plan, administrator settings, and enabled tools. [C2][C3][C4][C8]",
    "models": [
      {
        "id": "claude-haiku-4-5",
        "name": "Claude Haiku 4.5",
        "status": "available"
      },
      {
        "id": "claude-sonnet-5",
        "name": "Claude Sonnet 5",
        "status": "available"
      },
      {
        "id": "claude-opus-5",
        "name": "Claude Opus 5",
        "status": "available"
      },
      {
        "id": "claude-fable-5",
        "name": "Claude Fable 5",
        "status": "available"
      }
    ],
    "models_note": "Claude Haiku 4.5, Claude Sonnet 5, Claude Opus 5, and Claude Fable 5. Access varies by plan and administrator policy. Anthropic does not publish one exhaustive plan-by-plan list of every legacy model that may appear under More models, so universal access to older models could not be established. [C9][C10][C11]",
    "model_choice": "Yes",
    "engine_profile": {
      "system_id": "claude",
      "model_id": "claude-opus-5"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "C1, Anthropic, Get started with Claude",
          "url": "https://support.claude.com/en/articles/8114491-get-started-with-claude"
        },
        {
          "label": "C2, Anthropic, Use Research on Claude",
          "url": "https://support.claude.com/en/articles/11088861-use-research-on-claude"
        },
        {
          "label": "C3, Anthropic, Create and edit files with Claude",
          "url": "https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude"
        },
        {
          "label": "C4, Anthropic, Upload files to Claude",
          "url": "https://support.claude.com/en/articles/8241126-upload-files-to-claude"
        },
        {
          "label": "C5, PLOS Digital Health, independent periodontal examination study",
          "url": "https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0001072"
        },
        {
          "label": "C6, Anthropic, Incorrect or misleading responses",
          "url": "https://support.claude.com/en/articles/8525154-claude-is-providing-incorrect-or-misleading-responses-what-s-going-on"
        },
        {
          "label": "C7, Anthropic, Prompting best practices",
          "url": "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
        },
        {
          "label": "C8, Anthropic, Enable and use web search",
          "url": "https://support.claude.com/en/articles/10684626-enable-and-use-web-search"
        },
        {
          "label": "C9, Anthropic, Change model, effort, and thinking settings",
          "url": "https://support.claude.com/en/articles/8664678-change-the-model-effort-and-thinking-settings"
        },
        {
          "label": "C10, Anthropic, Claude product overview",
          "url": "https://claude.com/product/overview"
        },
        {
          "label": "C11, Anthropic, Claude Fable 5 on your plan",
          "url": "https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "claude-cowork",
    "display_name": "Claude Cowork",
    "maker": "Anthropic",
    "surface_type": "agent surface",
    "identity": "Claude Cowork, Anthropic, agent surface. Cowork uses Claude Code's agentic architecture for nonterminal knowledge work and operates separately from ordinary Claude chat. [CW1]",
    "good_at": "Cowork handles long-running, multi-step work across files, research, data, websites, and office deliverables. It analyzes a request, makes a plan, decomposes the work, runs code and shell commands in an isolated environment, may coordinate parallel workstreams, and returns reviewable files. [CW1] In an independent WIRED hands-on test, Cowork correctly grouped desktop screenshots into folders by content, which provides a useful small-sample example rather than a benchmark. [CW2]",
    "avoid": "Do not give Cowork a broad sensitive folder, account, or network scope when the task needs only a narrow subset. Do not let it perform irreversible, external, or high-stakes actions without review, because Anthropic warns that it can make mistakes, follow malicious instructions embedded in files or websites, or expand beyond the intended scope. [CW3] Do not assume computer-use automation will match direct connectors for speed or reliability on complex workflows. [CW4]",
    "prompt_shaping": "Write a brief, not a procedure script. State the objective first; identify the folders, applications, accounts, sources, or sites it may touch; state what it must not touch or do; specify which actions require approval; name each deliverable and destination; and define done with concrete checks. Include relevant examples and source priorities, but let Cowork plan its own sequence. Put stable preferences in Global instructions and project-specific context in folder instructions instead of repeating those rules in every task. [CW1][CW3]",
    "prompt_surfaces": "On desktop, web, and mobile, Chat and Cowork share the home message box; select Cowork at the lower left, describe the task, review its approach, and let it run. [CW1][CW5] The Claude in Chrome side panel can start Cowork directly. Scheduled-task prompts start with `/schedule` in a Cowork task or through Scheduled in the sidebar; include the persistent task instructions, frequency, permissions, and completion criteria. [CW6] Desktop provides the full local-file and browser experience, while web and mobile local access require an open Desktop bridge. [CW5]",
    "double_check": "Inspect the plan before execution and inspect the actual files, changes, citations, calculations, and external actions afterward. Confirm that Cowork stayed within the named folders, sites, accounts, and approval boundaries, because Anthropic identifies prompt injection, scope creep, and action errors as core risks. Recheck browser and computer-use steps manually when the workflow is complex. [CW3][CW4][CW7]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**. Reads uploaded or local files: **yes**. Runs tools or code: **yes**. Plans multi-step work: **yes**. Local files, browser control, and computer control require the Desktop bridge, and availability can vary by plan and administrator controls. [CW1][CW5]",
    "models": [],
    "models_note": "User model choice exists, and Claude Fable 5 is explicitly selectable in Cowork on the current Desktop version. The complete Cowork model-picker lineup for every paid plan could not be established from Anthropic's public documentation. [CW8][CW9]",
    "model_choice": "Yes, but the complete lineup could not be established",
    "engine_profile": {
      "system_id": "claude",
      "model_id": "claude-opus-5"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "CW1, Anthropic, Get started with Claude Cowork",
          "url": "https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork"
        },
        {
          "label": "CW2, WIRED, independent hands-on Cowork test",
          "url": "https://www.wired.com/story/anthropic-claude-cowork-agent/"
        },
        {
          "label": "CW3, Anthropic, Use Claude Cowork safely",
          "url": "https://support.claude.com/en/articles/13364135-use-claude-cowork-safely"
        },
        {
          "label": "CW4, Anthropic, Let Claude use your computer in Cowork",
          "url": "https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork"
        },
        {
          "label": "CW5, Anthropic, Use Cowork on web, desktop, and mobile",
          "url": "https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile"
        },
        {
          "label": "CW6, Anthropic, Schedule recurring tasks in Cowork",
          "url": "https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork"
        },
        {
          "label": "CW7, Cloud Security Alliance, independent Cowork security-risk synthesis",
          "url": "https://cloudsecurityalliance.org/blog/2026/07/08/top-6-claude-cowork-security-risks-to-watch"
        },
        {
          "label": "CW8, Anthropic, Claude Fable 5 on your plan",
          "url": "https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan"
        },
        {
          "label": "CW9, Anthropic, Set a default model for your organization",
          "url": "https://support.claude.com/en/articles/15330088-set-a-default-model-for-your-organization"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "chatgpt",
    "display_name": "ChatGPT",
    "maker": "OpenAI",
    "surface_type": "chat app",
    "identity": "ChatGPT, OpenAI, chat app. This card covers the ChatGPT web, desktop, and mobile product. [G1]",
    "good_at": "ChatGPT supports brainstorming, drafting, planning, math, coding, and analysis of images and files in conversation. [G1] It can run quick web search with citations, perform code-backed spreadsheet and data analysis, and use Deep research to gather from uploaded files, selected websites, the public web, and connected apps before returning a sourced report. [G2][G3][G4]",
    "avoid": "Do not use a fluent answer as the final authority for facts, quotations, legal or medical conclusions, or citations, because OpenAI says ChatGPT can fabricate facts, quotations, studies, and references while sounding confident. [G5] Do not use image-only values or poorly structured spreadsheets for exact analysis; OpenAI advises one table per sheet, clear headers, and no necessary values embedded in images. [G3] Do not assume a citation proves the nearby claim without opening it. [G5][G6]",
    "prompt_shaping": "Use a full structured prompt. Start with the exact result, then add the outcome-changing context, intended audience or use, source material, boundaries, required format, length, tone, and final checks. Ask explicitly for web search when freshness matters and for citations when verification matters. For Deep research, specify the question, desired outcome, allowed or preferred sources, exclusions, time range, and constraints, then review its proposed research plan before it runs. [G4][G7][G8]",
    "prompt_surfaces": "Ordinary prompts go in the ChatGPT message box on web, desktop, or mobile. [G1] Search can run automatically or through View all tools, Search, or `/Search`. [G2] Deep research starts through the plus or tools menu, `/Deepresearch`, or the sidebar. [G4] Files attach in the prompt window, and Project chats use their project context. [G9]",
    "double_check": "Verify every important fact, quotation, data point, and reference against the original source. Review Python code, assumptions, calculations, chart axes, and row coverage in data work. Check that large or messy files were processed completely and that image-only table values were not skipped. A 2026 independent study of ChatGPT Deep Research for dermatology literature review found frequent citation-support errors, so linked sources do not remove the need for claim-level review. [G3][G5][G6]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**. Reads uploaded files: **yes**. Runs tools or code: **yes**. Plans multi-step work: **yes**, through Deep research. [G2][G3][G4][G9]",
    "models": [],
    "models_note": "The standard ChatGPT picker exposes speed and reasoning choices. Eligible paid plans show Instant, Medium, High, and Extra High, powered by GPT-5.6 Sol, plus Pro, powered by GPT-5.6 Sol Pro where the plan includes it. Free and Go show Instant and Think, powered by GPT-5.6 Luna. OpenAI o3 remains a conditional legacy option for paid users through model settings until 2026-08-26. Availability varies by plan, rollout, and managed-workspace settings. [G10][G11]",
    "model_choice": "Yes",
    "engine_profile": {
      "system_id": "chatgpt",
      "model_id": "gpt-5-6-sol"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "G1, OpenAI, What is ChatGPT",
          "url": "https://help.openai.com/en/articles/12677804-what-is-chatgpt-faq"
        },
        {
          "label": "G2, OpenAI, ChatGPT Search",
          "url": "https://help.openai.com/en/articles/9237897-chatgpt-search"
        },
        {
          "label": "G3, OpenAI, Data analysis with ChatGPT",
          "url": "https://help.openai.com/en/articles/8437071-chatgpt-data-analysis"
        },
        {
          "label": "G4, OpenAI, Deep research",
          "url": "https://help.openai.com/en/articles/10500283-deep-research-faq"
        },
        {
          "label": "G5, OpenAI, Does ChatGPT tell the truth",
          "url": "https://help.openai.com/en/articles/8313428-does-chatgpt-tell-the-truth"
        },
        {
          "label": "G6, independent dermatology Deep Research study",
          "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13109748/"
        },
        {
          "label": "G7, OpenAI, ChatGPT prompting",
          "url": "https://learn.chatgpt.com/docs/prompting"
        },
        {
          "label": "G8, OpenAI, Prompt engineering best practices",
          "url": "https://help.openai.com/en/articles/6654000-chatgpt-prompts-guide"
        },
        {
          "label": "G9, OpenAI, File uploads in ChatGPT",
          "url": "https://help.openai.com/en/articles/8982896-how-does-the-new-file-uploads-capability-work"
        },
        {
          "label": "G10, OpenAI, GPT-5.6 in ChatGPT",
          "url": "https://help.openai.com/en/articles/20001354-gpt-56-in-chatgpt/"
        },
        {
          "label": "G11, OpenAI, Model release notes",
          "url": "https://help.openai.com/en/articles/9624314-model-release-notes"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "codex",
    "display_name": "Codex",
    "maker": "OpenAI",
    "surface_type": "agent surface",
    "identity": "Codex, OpenAI, agent surface for coding and repository work. It spans the Codex desktop experience, web and cloud tasks, command-line interface, and integrated-development-environment extension. [X1]",
    "good_at": "Codex explores repositories, explains code, implements focused changes, debugs, runs local tools and tests, reviews changes and pull requests, and can hand longer work to cloud environments. [X1][X2] An independent 2026 study of 7,156 agent-authored pull requests found Codex acceptance rates from 59.6 to 88.6 percent across nine task categories, while no agent led every category. [X3] A second large GitHub study found 82.59 percent of 21,799 Codex pull requests merged, with stronger results for documentation, continuous-integration, build, test, fix, feature, and refactor tasks than performance tasks. [X4]",
    "avoid": "Do not send a vague request to improve an entire repository or prescribe a long, brittle implementation sequence. [X2] Do not authorize repository-wide edits, deployments, account actions, or destructive commands unless the task requires them. Do not merge solely because tests pass: the independent GitHub study found that rejected agent pull requests tended to touch more files and lines, fail continuous integration more often, duplicate work, implement unwanted features, or misalign with repository expectations. [X4]",
    "prompt_shaping": "Write a coding brief. Start with the objective and user-visible or technical outcome; identify the repository, files, systems, or paths in scope; provide reproduction steps, logs, examples, or screenshots; state invariants, forbidden changes, and permission boundaries; define the required artifacts; and specify how Codex must prove completion through the smallest relevant tests, lint, build, visual check, or reproduction. Leave the implementation sequence to Codex unless the process itself is mandatory. Use `/plan` for exploration before edits and `/goal` for a durable long-running objective. [X2]",
    "prompt_surfaces": "In desktop or web, use the Codex composer after choosing a project or local environment. [X1] In the command-line interface, use the interactive composer after `codex` or pass a prompt to noninteractive `codex exec`; mention paths with `@` or `/mention`. [X2][X5] In the extension, use its chat composer, which can include open files and selected code as context. [X6] A cloud task attaches to a configured repository and environment, and follow-up prompts continue that task. [X7] A GitHub comment containing `@codex review` requests pull-request review only. [X1]",
    "double_check": "Inspect the changed-file list, actual changes, command transcript, test output, and any untested claims before merging or deploying. Confirm that the work stayed within scope, preserved interfaces and data, and did not add unnecessary files or broad refactors. Rerun the original reproduction and project-native checks for high-risk changes, because independent evidence links larger change surfaces and continuous-integration failures with nonmerge outcomes. [X2][X4]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**, where search or Browser is enabled and permissions allow. Reads uploaded or local files: **yes**. Runs tools or code: **yes**. Plans multi-step work: **yes**. The built-in Browser is available in desktop and web, not in the command-line interface or extension. [X1][X2][X5][X8]",
    "models": [
      {
        "id": "gpt-5.6-sol",
        "name": "GPT-5.6 Sol",
        "status": "available"
      },
      {
        "id": "gpt-5.6-terra",
        "name": "GPT-5.6 Terra",
        "status": "available"
      },
      {
        "id": "gpt-5.6-luna",
        "name": "GPT-5.6 Luna",
        "status": "available"
      },
      {
        "id": "gpt-5.3-codex-spark",
        "name": "GPT-5.3 Codex Spark",
        "status": "research preview"
      },
      {
        "id": "gpt-5.5",
        "name": "GPT-5.5",
        "status": "available"
      },
      {
        "id": "gpt-5.4",
        "name": "GPT-5.4",
        "status": "retiring 2026-08-31"
      },
      {
        "id": "gpt-5.4-mini",
        "name": "GPT-5.4 Mini",
        "status": "retiring 2026-08-31"
      }
    ],
    "models_note": "GPT-5.6 Sol (`gpt-5.6-sol`), GPT-5.6 Terra (`gpt-5.6-terra`), GPT-5.6 Luna (`gpt-5.6-luna`), GPT-5.3 Codex Spark (`gpt-5.3-codex-spark`, ChatGPT Pro research preview), GPT-5.5 (`gpt-5.5`), GPT-5.4 (`gpt-5.4`), and GPT-5.4 Mini (`gpt-5.4-mini`). GPT-5.4 and GPT-5.4 Mini retire from Codex on 2026-08-31. Desktop, command-line, and extension users can switch models; Codex cloud does not currently offer model switching. [X9]",
    "model_choice": "Yes, except Codex cloud",
    "engine_profile": {
      "system_id": "chatgpt",
      "model_id": "gpt-5-6-sol"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "X1, OpenAI, Codex overview",
          "url": "https://learn.chatgpt.com/docs/overview"
        },
        {
          "label": "X2, OpenAI, Codex prompting",
          "url": "https://learn.chatgpt.com/docs/prompting"
        },
        {
          "label": "X3, independent MSR study of agent-authored pull requests",
          "url": "https://arxiv.org/abs/2602.08915"
        },
        {
          "label": "X4, independent GitHub study of Codex pull requests",
          "url": "https://imranraad07.github.io/posts/documents/papers/MSR_Challenge_2026.pdf"
        },
        {
          "label": "X5, OpenAI, Codex command-line interface",
          "url": "https://learn.chatgpt.com/docs/cli"
        },
        {
          "label": "X6, OpenAI, Codex extension",
          "url": "https://learn.chatgpt.com/docs/ide"
        },
        {
          "label": "X7, OpenAI, Codex cloud",
          "url": "https://learn.chatgpt.com/docs/cloud"
        },
        {
          "label": "X8, OpenAI, Codex Browser",
          "url": "https://learn.chatgpt.com/docs/browser"
        },
        {
          "label": "X9, OpenAI, Codex models",
          "url": "https://learn.chatgpt.com/docs/models"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "gemini",
    "display_name": "Gemini",
    "maker": "Google",
    "surface_type": "chat app",
    "identity": "Gemini, Google, chat app. This card covers the Gemini web and mobile chat product, not the Gemini application programming interface, AI Studio, Antigravity, or a bare Gemini model. [GM1]",
    "good_at": "Gemini supports general drafting, explanation, brainstorming, and analysis of documents, spreadsheets, images, audio, video, code folders, and GitHub repositories. [GM2] Deep Research creates an editable research plan, searches selected sources, and produces a sourced report. [GM3] In an independent 42-prompt expert-consulting benchmark, Gemini 3.1 Pro Deep Research ranked second on the authors' strict score and led the structural-compliance prompt category. [GM4] Canvas provides a focused workspace for creating and iteratively editing documents, slides, applications, and code. [GM5]",
    "avoid": "Do not use an answer as professional advice or final factual authority, because Google says Gemini can present inaccurate information as fact. [GM6] Do not assume ordinary search-enabled chat searched or cited the web completely: an independent analysis of about 14,000 search-enabled LMArena logs found no explicit fetch in 34 percent of Gemini responses and no clickable citation in 92 percent. [GM7] Do not ask a very large upload to support a detail-complete review without dividing it into smaller parts, because Google's file help warns that large uploads can cause Gemini to miss connections or details. [GM2]",
    "prompt_shaping": "For ordinary chat, use a complete structured prompt in this order: task, relevant context or source material, scope and constraints, output format, and verification requirements. Name the artifact or format and ask Gemini to separate supported facts, uncertainties, and inferences when reliability matters. For Deep Research, give the research question, jurisdiction or market, date range, inclusions and exclusions, acceptable source types, and output structure, then inspect and edit the proposed plan before starting. For connected Google services, type `@`, select the service, and identify the file or item with keywords; every new conversation must invoke the service again. In Canvas, name whether the result is a document, slide deck, application, or code artifact, then make later prompts local and concrete. [GM3][GM5][GM8]",
    "prompt_surfaces": "Main chat uses the text box at gemini.google.com or in the mobile app, with Add files for attachments. [GM1][GM2] Deep Research starts through Add Files, Deep Research, then uses the same text box for the research brief, optional uploads, and selected sources; Gemini proposes a plan before Start research. [GM3] Canvas starts through Add Files, Canvas, then uses the text box for the initial document, slide, application, or code request; later prompts and Select and ask revise the artifact. [GM5] Gems have standing instructions and knowledge in Gem manager, plus a normal chat box for each use. [GM9]",
    "double_check": "Open every cited source and verify that it supports the nearby claim, including dates, quotations, and jurisdiction. Compare file-analysis answers against the original pages or cells, especially when the upload is long or facts are scattered. Test Canvas code and generated applications, and check code licensing, because Google states that users remain responsible for generated code and that open-source licenses may cover it. [GM2][GM6][GM7]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**. Reads uploaded files: **yes**. Runs tools or code: **yes**, through connected applications and Canvas previews. Plans multi-step work: **yes**, through Deep Research. A general unrestricted code-execution environment in ordinary chat could not be established. [GM2][GM3][GM5][GM8]",
    "models": [
      {
        "id": "gemini-flash-lite",
        "name": "Gemini Flash-Lite",
        "status": "available"
      },
      {
        "id": "gemini-flash",
        "name": "Gemini Flash",
        "status": "available"
      },
      {
        "id": "gemini-pro",
        "name": "Gemini Pro",
        "status": "available"
      }
    ],
    "models_note": "Gemini Flash-Lite, Gemini Flash, and Gemini Pro. Signed-in access depends on plan, quota, account, region, and rollout. Standard, Extended, and Deep Think are thinking levels, not separate models. Google's current support pages do not consistently identify the exact backend version behind each generic selector label, so that mapping could not be established. [GM10][GM11]",
    "model_choice": "Yes",
    "engine_profile": {
      "system_id": "gemini",
      "model_id": "gemini-3-6-flash"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "GM1, Google, Get started with Gemini Apps",
          "url": "https://support.google.com/android/answer/13275745?co=GENIE.Platform%3DAndroid&hl=en"
        },
        {
          "label": "GM2, Google, Upload and analyze files in Gemini Apps",
          "url": "https://support.google.com/gemini/answer/14903178?co=GENIE.Platform%3DDesktop&hl=en"
        },
        {
          "label": "GM3, Google, Use Deep Research in Gemini Apps",
          "url": "https://support.google.com/gemini/answer/15719111?hl=en"
        },
        {
          "label": "GM4, independent expert-consulting Deep Research benchmark",
          "url": "https://arxiv.org/abs/2605.17554"
        },
        {
          "label": "GM5, Google, Create documents and code with Canvas",
          "url": "https://support.google.com/gemini/answer/16047321?co=GENIE.Platform%3DDesktop&hl=en"
        },
        {
          "label": "GM6, Google, Gemini Apps limitations",
          "url": "https://support.google.com/gemini/answer/16279220?hl=en"
        },
        {
          "label": "GM7, Social Science Research Council, independent search and citation audit",
          "url": "https://www.ssrc.org/publications/the-attribution-crisis-in-llm-search-results/"
        },
        {
          "label": "GM8, Google, Use connected apps in Gemini",
          "url": "https://support.google.com/gemini/answer/14959807?co=GENIE.Platform%3DDesktop&hl=en-GB"
        },
        {
          "label": "GM9, Google, Create and use Gems",
          "url": "https://support.google.com/gemini/answer/15146780?co=GENIE.Platform%3DAndroid&hl=en-CA"
        },
        {
          "label": "GM10, Google, Choose a Gemini model",
          "url": "https://support.google.com/gemini/answer/16275805?hl=en"
        },
        {
          "label": "GM11, Google, Switch models in Gemini Apps",
          "url": "https://support.google.com/gemini/answer/14517446?co=GENIE.Platform%3DDesktop&hl=en-SN"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "microsoft-365-copilot",
    "display_name": "Microsoft 365 Copilot",
    "maker": "Microsoft",
    "surface_type": "in-suite copilot",
    "identity": "Microsoft 365 Copilot, Microsoft, in-suite copilot. This card covers Copilot Chat, Word, Excel, Outlook, and Teams, not consumer Microsoft Copilot, Copilot Studio, Security Copilot, or Microsoft 365 Copilot Cowork. [M1]",
    "good_at": "Microsoft 365 Copilot works with material already present in Microsoft 365 to summarize documents and conversations, prepare first drafts, extract meeting actions, and edit Word or Excel content in place. [M1][M2][M3][M4] In the Australian Government's independent trial, respondents reported quality improvements most often for summarizing existing information at 69 percent, meeting minutes at 60 percent, first drafts at 58 percent, and information search at 54 percent. [M5] Word and Excel add reviewable in-app editing, while Outlook and Teams can use the current mailbox, calendar, chat, channel, or meeting context according to license and permissions. [M2][M3][M4][M6]",
    "avoid": "Do not use Copilot as final authority for legal, financial, medical, or other high-stakes decisions, because Microsoft warns that it can make mistakes and the Australian trial found that most focus-group participants encountered inaccuracies or hallucinations. [M5][M7] Do not use Excel's `COPILOT` function for calculations or any result that must be accurate or reproducible; Microsoft directs users to native formulas and says the function does not suit legal, regulatory, or compliance work. [M8] Do not assume Copilot can see every firm file or message, because grounding depends on the active app, selected source, license, tenant settings, and the user's existing permissions. [M1][M6]",
    "prompt_shaping": "Use Microsoft's goal, context, source, and expectations pattern. Start with an action verb and exact outcome, explain the business context and audience, identify the file, thread, meeting, table, or range, then specify format, length, tone, and limits. In Word, state whether Copilot may change the selected passage or whole document and what it must preserve. In Excel, name the worksheet, table, columns, ranges, calculations, and expected artifact; use plan mode before consequential changes, edit mode for direct changes, and chat mode when the answer should remain in the pane. In Outlook, identify sender, recipient, purpose, thread facts, tone, and length. In Teams, name the chat, channel, or meeting, date range, and whether the output must include decisions, unresolved issues, owners, or actions. [M2][M3][M4][M9]",
    "prompt_surfaces": "Copilot Chat uses the Message Copilot box at m365.cloud.microsoft/chat and in the Microsoft 365 Copilot app, Edge side pane, Outlook pane, and Teams pane; Add content uploads files or opens work content, while `/` opens ContextIQ references. [M1][M10] Word uses the Copilot chat and edit pane from the Dynamic Action Button or Home, Copilot; selected-text Rewrite is a narrower local-rewrite door. [M2] Excel uses Home, Copilot with edit, plan, and chat modes; the separate `=COPILOT(prompt, context)` worksheet function remains a preview feature for eligible programs and serves semantic or exploratory cell output, not deterministic calculations. [M3][M8] Outlook provides Draft with Copilot in compose and Copilot Chat from the navigation header; Summary, Coaching, Schedule, and meeting preparation are dedicated controls, not general prompt doors. [M11] Teams provides a Copilot compose box within a selected chat, channel, or meeting; its summary button is a fixed shortcut. [M4]",
    "double_check": "Open cited sources and confirm that they support the claim, and confirm that Copilot used the intended Work or Web grounding. Compare Word drafts with source documents for omitted qualifications and tone; the Australian trial reported a substantial edit burden for many users. [M5] In Excel, inspect every formula, range, inserted value, chart, filter, and direct edit, and replace generated arithmetic with native formulas where accuracy matters. In Teams, compare summaries and actions against the transcript or chat, because Teams Copilot cannot summarize images, Loop components, or files shared in a chat thread and uses a 30-day history by default unless the user specifies otherwise. [M4][M8]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**. Reads uploaded files: **yes**. Runs tools or code: **yes**, through app-scoped editing, Excel operations, optional Python analysis, and configured agents. Plans multi-step work: **yes**, including Excel plan mode and advanced agents. A general unrestricted code environment could not be established. [M1][M3][M10]",
    "models": [],
    "models_note": "User model choice: **yes for eligible Premium or commercial users on supported surfaces; no full model choice for Basic or standard users**. Copilot Chat exposes Auto, Quick response, and Think deeper, which act as routing or reasoning modes. Official materials identify GPT-5.2 behind a released selector experience and identify GPT-5.5 Instant and GPT-5.6 in current availability or rollout materials. Eligible Word and Excel pages also describe Auto and supported ChatGPT or Claude choices, but Microsoft does not publish one stable exact lineup across Copilot Chat, Word, Excel, Outlook, and Teams. Separate native model pickers in Outlook and Teams, apart from embedded Copilot Chat, could not be established. [M1][M12][M13][M14]",
    "model_choice": "Yes for eligible users and surfaces; no full choice for Basic or standard users",
    "engine_profile": {
      "system_id": "chatgpt",
      "model_id": "gpt-5-6-sol"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "M1, Microsoft, Copilot overview",
          "url": "https://learn.microsoft.com/en-us/copilot/overview"
        },
        {
          "label": "M2, Microsoft, Copilot in Word",
          "url": "https://support.microsoft.com/en-US/Word/welcome-to-copilot-in-word"
        },
        {
          "label": "M3, Microsoft, Copilot in Excel",
          "url": "https://support.microsoft.com/en-US/excel/copilot/get-started-with-copilot-in-excel"
        },
        {
          "label": "M4, Microsoft, Copilot in Teams chats and channels",
          "url": "https://support.microsoft.com/en-us/teams/copilot/how-to-use-microsoft-365-copilot-in-teams-chats-and-channels"
        },
        {
          "label": "M5, Australian Government, independent Microsoft 365 Copilot evaluation",
          "url": "https://www.digital.gov.au/initiatives/copilot-trial/microsoft-365-copilot-evaluation-report-full/productivity"
        },
        {
          "label": "M6, Microsoft, Microsoft 365 Copilot architecture",
          "url": "https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-architecture"
        },
        {
          "label": "M7, Microsoft, Copilot license levels",
          "url": "https://support.microsoft.com/en-US/Microsoft-365-Copilot/what-copilot-license-do-i-have"
        },
        {
          "label": "M8, Microsoft, COPILOT function",
          "url": "https://support.microsoft.com/en-us/excel/functions/copilot-function"
        },
        {
          "label": "M9, Microsoft, Craft effective prompts",
          "url": "https://learn.microsoft.com/en-us/training/paths/craft-effective-prompts-copilot-microsoft-365/"
        },
        {
          "label": "M10, Microsoft, Add content to Copilot Chat prompts",
          "url": "https://support.microsoft.com/en-US/Microsoft-365-Copilot/add-content-to-microsoft-365-copilot-chat-prompts"
        },
        {
          "label": "M11, Microsoft, Draft with Copilot in Outlook",
          "url": "https://support.microsoft.com/en-US/Outlook/copilot-pages/draft-an-email-message-with-copilot-in-outlook"
        },
        {
          "label": "M12, Microsoft, Copilot release notes",
          "url": "https://learn.microsoft.com/en-us/microsoft-365/copilot/release-notes"
        },
        {
          "label": "M13, Microsoft, Microsoft 365 roadmap",
          "url": "https://www.microsoft.com/en-us/microsoft-365/roadmap"
        },
        {
          "label": "M14, Microsoft, Edit with Copilot in Excel",
          "url": "https://support.microsoft.com/en-us/office/edit-with-copilot-in-excel-a2fd6fe4-97ac-416b-b89a-22f4d1357c7a"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "cocounsel",
    "display_name": "CoCounsel",
    "maker": "Thomson Reuters",
    "surface_type": "skill-router",
    "identity": "CoCounsel Legal, Thomson Reuters, skill-router with chat, a prompt and workflow library, and Microsoft 365 add-ins. [CC1]",
    "good_at": "CoCounsel routes research, document review, drafting, comparison, summarization, timeline, and database-search requests to legal-specific skills, while workflows combine skills for layered work. [CC1] Its research skills can ground answers in Westlaw primary authority or Practical Law guidance and return linked citations. [CC1] In the independent 2025 Vals benchmark, the tested CoCounsel version scored highly on all four tasks it entered, earned 89.6 percent on document question answering, and led the participating products on document summarization. [CC2]",
    "avoid": "Do not treat research, drafting, or document analysis as final legal work without checking the sources and underlying documents. Do not use Search a Database for an exhaustive document survey or combine several distinct concepts in one query, because Thomson Reuters says the skill returns relevant material rather than necessarily every responsive document and loses precision with multiple concepts. [CC3] Do not assume it accurately understands tables or the non-textual meaning of embedded images, because its file guidance identifies both as limitations. [CC4]",
    "prompt_shaping": "In CoCounsel Chat, state the purpose, then the material context, then the precise instruction; add jurisdiction, time period, source set, and output format when relevant. Keep database-search prompts concise, material, and limited to one concept per run. When a task matches a Library item, choose the skill, expert prompt, or workflow first and supply only the requested variables or documents. For reusable custom prompts, define the instruction once, add manual-entry, multiple-choice, or file variables, and bind the prompt to the skill that should run it. Thomson Reuters markets the rebuilt product as requiring no prompt engineering, but its operational help still requires intent, context, and instruction; the defensible reading is that CoCounsel needs no special syntax, while context and precision still matter. [CC3][CC5][CC6][CC7]",
    "prompt_surfaces": "The main web door is the CoCounsel Chat text box. The Library opens from that box and contains expert prompts, organization prompts, skills, and workflows; an item either places a prompt in chat or launches a guided experience, and some expert prompts run a skill without new free text. [CC1][CC5] Manage Library contains the custom-prompt builder. [CC6] Outlook has a chat panel for queries and uploads, but supports only a limited set of skills and, as of February 2026, lacks the prompt library and multilingual support. [CC8] Teams has a chat field and View Prompts entry point. [CC9] Word has natural-language chat for its Transactional Drafting Agent and menu-driven contract-review and playbook tools; drafting chat can act on selected text or the open document. [CC10] SharePoint and other document systems act as sources or integrations, not independent prompt boxes. [CC1]",
    "double_check": "Open every cited authority and confirm the proposition, quoted language, jurisdiction, date, and later treatment. For database searches, determine whether the task required exhaustive review and independently account for all documents when it did. Inspect tables, images, totals, dates, names, and drafted provisions against the originals. Apply attorney judgment before sending, filing, negotiating from, or relying on the output. [CC3][CC4]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**, through Web Search. Reads uploaded files: **yes**. Runs tools or code: **yes**, through skills and workflows. Plans multi-step work: **yes**, through workflows and the current agentic product. Public documentation does not establish a general code-execution surface. [CC1][CC4]",
    "models": [],
    "models_note": "No user model choice. Thomson Reuters documents automatic use and updating of underlying AI technology but does not document an ordinary-user model selector. [CC1]",
    "model_choice": "No",
    "engine_profile": {
      "system_id": "claude",
      "model_id": "claude-opus-5"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "CC1, Thomson Reuters, Skills, prompts, and workflows",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/skills/skills-prompts-workflows"
        },
        {
          "label": "CC2, Legal IT Insider, independent report on the Vals benchmark",
          "url": "https://legaltechnology.com/harvey-and-cocounsel-receive-top-scores-in-first-major-industry-genai-benchmarking-study/"
        },
        {
          "label": "CC3, Thomson Reuters, Search a database",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/skills/skills-prompts-workflows/search-a-database.html"
        },
        {
          "label": "CC4, Thomson Reuters, Upload files to CoCounsel",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/navigation/about/upload-files"
        },
        {
          "label": "CC5, Thomson Reuters, The CoCounsel Library",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/skills/cocounsel-library"
        },
        {
          "label": "CC6, Thomson Reuters, Create a custom prompt",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/skills/cocounsel-library/create-a-custom-prompt.html"
        },
        {
          "label": "CC7, Thomson Reuters, Prompting CoCounsel",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/skills/prompting.html"
        },
        {
          "label": "CC8, Thomson Reuters, CoCounsel for Outlook skills",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/integrations/microsoft-365-integration/cocounsel-for-outlook/skills"
        },
        {
          "label": "CC9, Thomson Reuters, Use CoCounsel in Teams",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/integrations/microsoft-365-integration/cocounsel-for-teams/use-cocounsel-in-teams"
        },
        {
          "label": "CC10, Thomson Reuters, Transactional drafting",
          "url": "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/cocounsel-for-microsoft-word/about-transactional-drafting"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "harvey",
    "display_name": "Harvey",
    "maker": "Harvey AI",
    "surface_type": "grid-and-chat",
    "identity": "Harvey, Harvey AI, grid-and-chat legal workspace with workflow agents and Microsoft Office add-ins. [H1][H2]",
    "good_at": "Assistant handles questions, drafting, document analysis, file creation, and source-backed research, while Vault organizes and analyzes large document sets through aggregate questions, review tables, workflows, and drafts. [H1][H2] Workflow agents guide users through structured multi-step work, and the Word and Outlook add-ins bring drafting, redlining, email analysis, and replies into those applications. [H3][H4][H5] In the independent 2025 Vals benchmark, Harvey earned the highest overall result and led participating products on five of the six tasks it entered, although chronology, redlining, and transcript analysis proved harder across products. [H6]",
    "avoid": "Do not rely on Harvey as final authority for a legal conclusion, citation, extracted fact, or redline. Do not request an exact page count, because Harvey says it cannot generate to a specified number of pages; request a concise, detailed, or thorough answer instead. [H7] Do not refer vaguely to page numbers or document numbers when naming source material, and do not place an unwieldy multi-part task into one Assistant prompt when focused follow-ups can separate it. [H7]",
    "prompt_shaping": "In Assistant, provide the request, relevant context, jurisdiction, audience, source documents, and desired form. For multi-source work, state how Harvey should use each source. Break complex analysis into focused follow-ups and identify source documents and sections by name. In a Vault review table, use one narrow extraction or classification question per column and define the expected cell format, because each cell runs that column question against one row document. For a Workflow agent, follow its guided inputs. When building an agent, describe the repeatable task, jurisdiction, practice area, inputs, decision logic, boundaries, outputs, and approval points, then test the generated structure. [H2][H3][H7][H8]",
    "prompt_surfaces": "Assistant has the primary web prompt box for typed questions, uploads, knowledge sources, and follow-ups. Library stores saved prompts, examples, and Workflow agents; a saved prompt populates Assistant, while an agent opens a guided sequence. [H1][H9] Vault supports an Assistant query across vault documents, one prompt per review-table column, predefined workflows, and draft creation. [H2] Agent Builder accepts a high-level workflow description and exposes prompt text within AI Action blocks; this configures reusable work. [H8] Word has an Assistant box for selected text or the full document in Ask, Edit, or Draft mode, plus Workflow agents and playbooks. [H4] Outlook has an Assistant panel on an open thread for typed or dictated prompts, attachment analysis, drafting, and revision. [H5] SharePoint imports files into Assistant or Vault and serves as a document source, not a SharePoint prompt box. [H10]",
    "double_check": "Verify every legal authority, quotation, extracted term, numerical result, and current-law statement against the source. Harvey says citations may be absent when it uses many sources or draws a general inference, so confirm that the cited set covers every material claim. [H1] Review every proposed Word change and every Vault cell against the document and governing playbook. When restricting web queries by domain, inspect the returned citations because Harvey says results can still include outside sources if the requested domains lack indexed or relevant material. [H11]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**, when an administrator enables Web Search. Reads uploaded files: **yes**. Runs tools or code: **yes**, through Workflow agents, Agent Builder actions, file-generation tools, and document-editing actions. Plans multi-step work: **yes**. Public documentation does not describe a general-purpose code console. [H1][H3][H8][H11]",
    "models": [],
    "models_note": "User model choice: **yes**, when a workspace administrator enables Model Selector. Harvey documents these model families: Anthropic Sonnet and Opus 4 suite; OpenAI GPT-5 suite; OpenAI o3 suite; OpenAI GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, and 4o suite; and Google Gemini 2.5 Pro suite. The exact names currently shown in the selector could not be established from public documentation. [H12][H13]",
    "model_choice": "Yes when an administrator enables it",
    "engine_profile": {
      "system_id": "claude",
      "model_id": "claude-opus-5"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "H1, Harvey, Getting started with Assistant",
          "url": "https://help.harvey.ai/articles/getting-started-with-assist-and-draft-modes"
        },
        {
          "label": "H2, Harvey, Vault",
          "url": "https://help.harvey.ai/articles/vault"
        },
        {
          "label": "H3, Harvey, Workflow agents",
          "url": "https://help.harvey.ai/articles/assistant-workflows"
        },
        {
          "label": "H4, Harvey, Harvey for Word",
          "url": "https://help.harvey.ai/articles/harvey-for-word"
        },
        {
          "label": "H5, Harvey, Harvey for Outlook",
          "url": "https://help.harvey.ai/articles/harvey-for-outlook"
        },
        {
          "label": "H6, Legal IT Insider, independent report on the Vals benchmark",
          "url": "https://legaltechnology.com/harvey-and-cocounsel-receive-top-scores-in-first-major-industry-genai-benchmarking-study/"
        },
        {
          "label": "H7, Harvey, Prompt writing techniques",
          "url": "https://help.harvey.ai/articles/prompt-writing-techniques"
        },
        {
          "label": "H8, Harvey, Agent Builder",
          "url": "https://help.harvey.ai/articles/workflow-builder"
        },
        {
          "label": "H9, Harvey, Library",
          "url": "https://help.harvey.ai/articles/library"
        },
        {
          "label": "H10, Harvey, SharePoint integration",
          "url": "https://help.harvey.ai/release-notes/sharepoint-integration"
        },
        {
          "label": "H11, Harvey, Web Search",
          "url": "https://help.harvey.ai/articles/web-search"
        },
        {
          "label": "H12, Harvey, Choose an AI model",
          "url": "https://help.harvey.ai/articles/multi-model"
        },
        {
          "label": "H13, Harvey, Models used by Harvey",
          "url": "https://help.harvey.ai/articles/what-ai-models-does-harvey-use"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "legora",
    "display_name": "Legora",
    "maker": "Legora",
    "surface_type": "grid-and-chat",
    "identity": "Legora, Legora, grid-and-chat legal workspace with an agent surface, workflows, and Microsoft Word and Outlook add-ins. [L1][L2][L3]",
    "good_at": "Assistant supports sourced research, document analysis, drafting, database search, deep research, and web search, while Tabular Review turns documents into rows and prompt questions into extraction columns. [L1][L2] Legora Agent can plan and execute multi-step work across documents, research sources, Tabular Review, drafting, and other tools. [L3] In a reported Sheppard Mullin evaluation, the firm found Legora particularly useful for ad hoc diligence and said a table generated from an earlier diligence report and new documents came back very close to the requested result, although it remained imperfect. [L4]",
    "avoid": "Do not place a memo-length instruction into a Tabular Review column when the column needs one repeated fact, classification, or short analysis for each document. [L2] Do not let Agent operate across a matter without defining permitted documents, tools, boundaries, decision points, and final work product. [L3] Do not treat cited output, redlines, or autonomous actions as approved legal work; Legora's terms place responsibility for reviewing and validating Agent actions and outputs on the subscriber. [L5]",
    "prompt_shaping": "In Assistant, use a full structured prompt with the task, legal and factual context, jurisdiction, selected sources, constraints, and required output. In Tabular Review, write one atomic extraction or classification request per column, define the cell format, and state how to report missing or ambiguous information; this matches its document-as-row and prompt-as-column design. [L1][L2] For Agent, use a brief: state the objective, matter territory, authorized files and tools, boundaries, checkpoints, and exact conditions for a finished deliverable, then let Agent plan its sequence. [L3] In Word, identify the selected clause or whole-document scope, requested draft or redline, governing playbook or precedent, and treatment of citations and tracked changes. [L6] For reusable Workflows, provide the required documents and run-specific context instead of restating the workflow logic. [L7]",
    "prompt_surfaces": "Assistant has the principal chat composer; its Sources menu selects Legal Research, Web Search, Database Search, or Deep Research, while Create can open Tabular Review and Workflow Library supplies saved prompts and workflows. [L1] Agent has a high-level task prompt and can call other Legora tools, create a Tabular Review, and produce work product. [L3] Tabular Review has a prompt behind each column and an embedded Assistant chat for questions about the resulting grid. [L2] Word contains Agent and a flexible chat interface for drafting, redlining, review, and saved prompts, plus fixed Actions and playbooks. [L6][L8] Outlook supports thread summarization, reply drafting, and sending emails or attachments into Legora, but its exact free-text composer behavior could not be established from public documentation. [L9] Editor accepts requests to refine a working document, but its exact prompt-box controls could not be established. [L10]",
    "double_check": "Open every citation and confirm that it supports the proposition, remains current law, and carries the correct authority and jurisdiction. Review every Tabular Review cell against the source passage, especially missing-information, ambiguity, and inference cases. Inspect Agent plans, tool calls, generated documents, and Word or Outlook changes before approval. Compare output against the governing playbook, precedent, and matter facts because the independent user evidence reports useful but imperfect results. [L2][L4][L5]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**. Reads uploaded files: **yes**. Runs tools or code: **yes**, through platform tools and connected workflows. Plans multi-step work: **yes**. Public documentation does not establish a general code-execution surface. [L1][L2][L3][L7]",
    "models": [],
    "models_note": "No user model choice could be established. Legora describes an agentic harness that handles model selection and publicly discusses multiple underlying models, but its public product documentation does not establish an ordinary-user selector or current selectable lineup. [L11]",
    "model_choice": "No user choice could be established",
    "engine_profile": {
      "system_id": "claude",
      "model_id": "claude-opus-5"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "L1, Legora, New Assistant experience",
          "url": "https://legora.com/blog/a-new-assistant-experience-in-legora"
        },
        {
          "label": "L2, Legora, Tabular Review",
          "url": "https://legora.com/product/tabular-review"
        },
        {
          "label": "L3, Legora, Agent",
          "url": "https://legora.com/product/agent"
        },
        {
          "label": "L4, Legal IT Insider, independent Sheppard Mullin evaluation report",
          "url": "https://legaltechnology.com/legal-tech-insights-sheppard-mullins-legora-selection-and-ai-roadmap/"
        },
        {
          "label": "L5, Legora, General terms",
          "url": "https://legora.com/legal/cbp-general-terms-and-conditions"
        },
        {
          "label": "L6, Legora, Word add-in",
          "url": "https://legora.com/product/word-add-in"
        },
        {
          "label": "L7, Legora, Workflows",
          "url": "https://legora.com/product/workflows"
        },
        {
          "label": "L8, Legora, Word Actions",
          "url": "https://legora.com/blog/introducing-legora-word-actions"
        },
        {
          "label": "L9, Legora, Outlook add-in",
          "url": "https://legora.com/product/outlook-add-in"
        },
        {
          "label": "L10, Legora, Editor",
          "url": "https://legora.com/product/editor"
        },
        {
          "label": "L11, Legora, aOS",
          "url": "https://legora.com/product/aos"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "wordsmith",
    "display_name": "Wordsmith",
    "maker": "Wordsmith AI Ltd",
    "surface_type": "chat-and-agent",
    "identity": "Wordsmith, Wordsmith AI Ltd, chat-and-agent legal workspace for in-house teams, with Microsoft Word and business-channel integrations. [W1][W2]",
    "good_at": "Assistant handles one-prompt tasks such as legal research, document analysis, drafting, transcription, translation, questionnaire completion, and reusable template creation. [W1] Wordsmith Agents handle defined recurring workflows by combining instructions, knowledge, skills, memory, tools, channels, and escalation rules. [W2] The Word add-in supports in-document review, redlining, drafting, research, translation, repository queries, prompt-library access, and playbooks. [W3] No independent public benchmark establishing the current product's accuracy could be found.",
    "avoid": "Do not rely on Wordsmith output as accurate, complete, current, or final legal advice; its terms withhold those guarantees and make the customer responsible for review. [W4] Do not treat an Agent as a general chat box that needs a new master prompt for every run, because its remit, sources, skills, channels, autonomy, and escalation rules belong in configuration. [W2] Do not let an Agent send, approve, or resolve high-risk work unless configured guardrails and human review authorize that action. [W2]",
    "prompt_shaping": "For Assistant, give one self-contained task with the request, business and jurisdiction context, relevant documents or repositories, decision criteria, and output format; use a reusable template when the task repeats. [W1] For an Agent, write a configuration brief that defines remit, triggers, intake channels, permitted knowledge, playbooks, tools, actions, risk boundaries, escalation conditions, approvers, and finished output, then allow routine requests to enter through configured channels. [W2] In Word, anchor the instruction to the selected clause or open document, identify the playbook or repository, and state the required redline, explanation, draft, research answer, or translation. [W3] In Slack, Teams, or email, make the run-specific request concise because the configured Agent already carries standing rules and institutional context. [W2][W5]",
    "prompt_surfaces": "The web Assistant or Chat surface accepts typed prompts, uploaded materials, repository references, and follow-ups; completed tasks can become shared templates. [W1] Agent setup holds standing instructions for remit, knowledge, skills, memory, tools, channels, guardrails, and escalation. After setup, Agents receive requests through Slack, Teams, email, intake flows, or scheduled triggers. [W2] The Word sidebar accepts direct queries and `@` references to repositories, prompt-library items, and approved clauses, while playbooks provide a guided alternative. [W3] Slack accepts natural-language requests and document uploads. [W5] Public documentation describes Outlook and Gmail use for summaries, grounded replies, and attachment review, but their exact free-text prompt-box behavior could not be established. [W6]",
    "double_check": "Verify every cited legal source, clause reference, extracted value, date, translation, and redline against the original document and current authority. Compare recommendations against the approved playbook, fallback position, and business risk threshold. Review Agent routing, autonomy, escalation, and approval behavior before production use and after configuration changes. Treat fluent output as a draft because no independent public benchmark establishes current Wordsmith accuracy. [W2][W4]",
    "abilities": {
      "browses_web": "yes",
      "reads_files": "uploaded",
      "runs_tools": "yes",
      "plans_multi_step": "yes"
    },
    "abilities_text": "Browses the web: **yes**, through Smart Web Search and curated live sources. Reads uploaded files: **yes**. Runs tools or code: **yes**, through Agent tools and integrations. Plans multi-step work: **yes**. Public documentation does not establish a general code-execution console. [W1][W2][W7]",
    "models": [],
    "models_note": "No user model choice. Wordsmith says its governance framework automatically selects models from providers including Anthropic, OpenAI, and Google DeepMind; public documentation does not describe an ordinary-user selector. [W8]",
    "model_choice": "No",
    "engine_profile": {
      "system_id": "claude",
      "model_id": "claude-opus-5"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": [
        {
          "label": "W1, Wordsmith, AI Legal Assistant",
          "url": "https://www.wordsmith.ai/products/assistant"
        },
        {
          "label": "W2, Wordsmith, AI Legal Agents",
          "url": "https://www.wordsmith.ai/product/agents"
        },
        {
          "label": "W3, Wordsmith, Wordsmith for Word",
          "url": "https://www.wordsmith.ai/integrations/word"
        },
        {
          "label": "W4, Wordsmith, Terms of Service",
          "url": "https://www.wordsmith.ai/terms-of-service"
        },
        {
          "label": "W5, Wordsmith, Wordsmith for Slack",
          "url": "https://www.wordsmith.ai/integrations/slack"
        },
        {
          "label": "W6, Wordsmith, Integrations",
          "url": "https://www.wordsmith.ai/integrations"
        },
        {
          "label": "W7, Wordsmith, Research",
          "url": "https://www.wordsmith.ai/products/research"
        },
        {
          "label": "W8, Wordsmith, Responsible guide to using language models at work",
          "url": "https://www.wordsmith.ai/articles/a-responsible-guide-to-using-llms-at-work"
        }
      ]
    },
    "firm_notes": ""
  },
  {
    "id": "other-tool",
    "display_name": "Other tool",
    "maker": "unknown maker",
    "surface_type": "other",
    "identity": "Other tool, unknown maker, unknown chat-style AI tool. This card contains generic advice for an unresearched tool.",
    "good_at": "Could not be established because the product has not been researched. Treat every capability as unknown until the user verifies it in the product's current documentation.",
    "avoid": "Do not send confidential, privileged, personal, or regulated material until the product's data handling, retention, access, and training terms have been verified. Do not assume that the tool browses, reads attachments, runs code, remembers earlier chats, cites sources, or completes actions. Do not rely on its output for high-stakes decisions without independent verification.",
    "prompt_shaping": "Generic advice for an unresearched chat-style AI tool: give one self-contained prompt containing the task, necessary background, source text or inputs, constraints, required output format, and verification instructions. Ask the tool to distinguish supported facts, inferences, and unknowns, and do not depend on product-specific commands or hidden tools.",
    "prompt_surfaces": "Use the main chat text box only. Any attachment area, research mode, system-instruction field, agent builder, or other prompt door could not be established.",
    "double_check": "Verify every factual, legal, numerical, and cited claim against an authoritative source. Confirm that the tool used every attachment and followed each material instruction. Treat missing citations, unexplained certainty, and unsupported quotations as unresolved.",
    "abilities": {
      "browses_web": "could not be established",
      "reads_files": "uploaded",
      "runs_tools": "could not be established",
      "plans_multi_step": "could not be established"
    },
    "abilities_text": "Browses the web: **could not be established**. Reads uploaded files: **could not be established**. Runs tools or code: **could not be established**. Plans multi-step work: **could not be established**.",
    "models": [],
    "models_note": "Could not be established.",
    "model_choice": "Could not be established",
    "engine_profile": {
      "system_id": "claude",
      "model_id": "claude-opus-5"
    },
    "checked": {
      "date": "2026-08-17",
      "expires": "2026-11-17",
      "sources": []
    },
    "firm_notes": ""
  }
] };

if (typeof module !== "undefined" && module.exports) module.exports = OMonoFoundingDossiers;
if (typeof window !== "undefined") window.OMonoFoundingDossiers = OMonoFoundingDossiers;
else if (typeof globalThis !== "undefined") globalThis.OMonoFoundingDossiers = OMonoFoundingDossiers;
