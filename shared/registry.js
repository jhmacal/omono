/* Generated from registry.json. Regenerate with: python3 shared/build_data.py. Do not hand-edit. */
"use strict";
const OMONO_REGISTRY = {
  "as_of": "2026-07-27",
  "note": "Model versions change. Claude ids verified directly against platform.claude.com/docs 2026-07-27. OpenAI and Gemini rows verified against secondary reporting on 2026-07-27 and need a vendor-page check before any version label is relied on. Recommendation reasons name capability tags, not benchmarks.",
  "systems": [
    {
      "id": "claude", "label": "Claude",
      "models": [
        { "id": "claude-fable-5",  "label": "Fable 5",   "tags": ["deep_reasoning", "long_context", "citations"], "cost": 3, "note": "maximum reasoning, 1M context; a Covered Model, so 30-day API retention is mandatory" },
        { "id": "claude-opus-5",   "label": "Opus 5",    "tags": ["deep_reasoning", "long_context", "coding"], "cost": 3, "note": "complex agentic coding and enterprise work, 1M context" },
        { "id": "claude-sonnet-5", "label": "Sonnet 5",  "tags": ["deep_reasoning", "fast_cheap", "long_context", "coding"], "cost": 2, "note": "balanced default, best speed to intelligence" },
        { "id": "claude-haiku-4-5","label": "Haiku 4.5", "tags": ["fast_cheap"], "cost": 1, "note": "fastest, 200k context" }
      ]
    },
    {
      "id": "chatgpt", "label": "ChatGPT",
      "models": [
        { "id": "gpt-5-6-sol",   "label": "GPT-5.6 Sol",   "tags": ["deep_reasoning", "long_context", "coding"], "cost": 3, "note": "flagship tier; check availability, it entered limited preview 2026-06-27" },
        { "id": "gpt-5-6-terra", "label": "GPT-5.6 Terra", "tags": ["deep_reasoning", "coding"], "cost": 2, "note": "balanced tier" },
        { "id": "gpt-5-6-luna",  "label": "GPT-5.6 Luna",  "tags": ["fast_cheap"], "cost": 1, "note": "fast tier" },
        { "id": "gpt-5-5",       "label": "GPT-5.5",       "tags": ["deep_reasoning", "coding", "long_context"], "cost": 3, "note": "prior frontier, released 2026-04-23" },
        { "id": "gpt-image",     "label": "Image generation", "tags": ["image_gen"], "cost": 2, "note": "images" }
      ]
    },
    {
      "id": "gemini", "label": "Gemini",
      "models": [
        { "id": "gemini-3-6-flash",      "label": "Gemini 3.6 Flash",      "tags": ["deep_reasoning", "long_context", "fast_cheap"], "cost": 2, "note": "released 2026-07-21" },
        { "id": "gemini-3-5-flash-lite", "label": "Gemini 3.5 Flash-Lite", "tags": ["fast_cheap"], "cost": 1, "note": "high throughput, low latency" },
        { "id": "gemini-3-5-pro",        "label": "Gemini 3.5 Pro",        "tags": ["deep_reasoning", "long_context", "image_gen"], "cost": 3, "note": "partner testing as of 2026-07-21; confirm access before selecting" }
      ]
    },
    {
      "id": "perplexity", "label": "Perplexity",
      "models": [
        { "id": "pplx-search", "label": "search", "tags": ["live_web", "citations", "fast_cheap"], "cost": 1, "note": "live web with sources" }
      ]
    },
    {
      "id": "coding_agent", "label": "Coding agent",
      "models": [
        { "id": "claude-code", "label": "Claude Code", "tags": ["coding", "deep_reasoning"], "cost": 2, "note": "agentic coding" },
        { "id": "codex",       "label": "Codex",       "tags": ["coding"], "cost": 2, "note": "agentic coding" }
      ]
    }
  ]
};
if (typeof module !== "undefined" && module.exports) module.exports = OMONO_REGISTRY;
if (typeof window !== "undefined") window.OMONO_REGISTRY = OMONO_REGISTRY;
