/* Generated from register_snapshot.json. Regenerate with: python3 shared/build_data.py. Do not hand-edit. */
"use strict";
const OMONO_REGISTER_SNAPSHOT = {
  "as_of": "2026-07-03",
  "source": "JHMACAL MASTER FOLDER/ai-governance/legal-ai-overlay/AI_TOOL_REGISTER.md, adopted rows of 2026-07-03",
  "staleness_rule": "Advisory snapshot. If older than 60 days, or the register changed, regenerate before trusting R4 advisories.",
  "intake_valid_months": 12,
  "self": {
    "row": "R11",
    "label": "Anthropic API via O'Mono",
    "status": "RESTRICTED",
    "intake_date": "2026-07-03",
    "permitted": ["c1_public", "c2_internal", "c3_confidential"],
    "conditional": ["c5_court_filing", "c6_regulated_personal", "c8_sensitive_personal"],
    "barred": ["c4_client_privileged", "c7_credentials"],
    "harness": "Engine unit tests ship with O'Mono; model-level harness required before relied-on legal research",
    "note": "C3 task-required and minimized. C5 assist only, under the pre-filing verification duty. C6 and C8 minimized. C4 barred pending the Legal AI Use Policy. C7 never, screened by the app.",
    "open_items": ["DPA unread: retention, data location and subprocessors remain open", "API key custody is localStorage pending Run 2"]
  },
  "destinations": {
    "claude":       { "max_class": "C3", "row": "R1", "status": "RESTRICTED", "intake_date": "2026-07-03", "harness": "not required for permitted uses", "permitted": ["c1_public","c2_internal","c3_confidential"], "conditional": ["c5_court_filing","c6_regulated_personal","c8_sensitive_personal"], "barred": ["c4_client_privileged","c7_credentials"], "note": "R1 adopted RESTRICTED: C3 task-required, minimized; C4 barred pending policy" },
    "chatgpt":      { "max_class": "C2", "row": "R4", "status": "RESTRICTED", "intake_date": "2026-07-03", "harness": "required before any citable-research use", "permitted": ["c1_public","c2_internal"], "conditional": [], "barred": ["c3_confidential","c4_client_privileged","c5_court_filing","c6_regulated_personal","c7_credentials","c8_sensitive_personal"], "note": "R4 adopted RESTRICTED: C1/C2 only" },
    "gemini":       { "max_class": "C2", "row": null, "status": "PENDING INTAKE", "intake_date": null, "harness": null, "permitted": ["c1_public","c2_internal"], "conditional": [], "barred": ["c7_credentials"], "note": "No register row yet; interim default C1/C2" },
    "perplexity":   { "max_class": "C2", "row": null, "status": "PENDING INTAKE", "intake_date": null, "harness": null, "permitted": ["c1_public","c2_internal"], "conditional": [], "barred": ["c7_credentials"], "note": "No register row yet; interim default C1/C2" },
    "coding_agent": { "max_class": "C3", "row": "R3", "status": "RESTRICTED", "intake_date": "2026-07-03", "harness": "required before autonomous relied-on output", "permitted": ["c1_public","c2_internal","c3_confidential"], "conditional": [], "barred": ["c4_client_privileged","c7_credentials"], "note": "R3 Codex adopted RESTRICTED: C3-internal folder material; no client data, no secrets in reachable environments" }
  }
};
if (typeof module !== "undefined" && module.exports) module.exports = OMONO_REGISTER_SNAPSHOT;
if (typeof window !== "undefined") window.OMONO_REGISTER_SNAPSHOT = OMONO_REGISTER_SNAPSHOT;
