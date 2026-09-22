/* O'Mono canonical engine. One source of truth for both front-ends.
   Platform-neutral pure functions: no DOM, no fs, no fetch. */
"use strict";

const ENGINE_VERSION = "2.17.1";
const ENGINE_DATE = "2026-08-04";

const MODEL_FORMAT_ERROR = "OMONO_MODEL_FORMAT";
const FORMAT_RETRY_INSTRUCTION = `This is one automatic format retry. Recreate the answer from the same request as one complete strict JSON object. Escape every quotation mark, backslash, and line break that appears inside a string value. Use no Markdown fence, comment, trailing comma, or text outside the object. Keep every string concise enough to finish the complete object.`;

const FIELD_ORDER = ["role","task","context","input","constraints","examples","format","tone"];
const FIELD_LABELS = { role:"Role", task:"Task", context:"Context", input:"Input",
  constraints:"Constraints", examples:"Examples", format:"Format", tone:"Tone" };

/* ---------- classification model ----------
   The eight classes are the vocabulary. C1 and C2 carry no flag: they are the unflagged
   default. Values are the class ids themselves so a ledger entry reads directly against the
   classification rule with no translation step. */
const DATA_CLASSES = [
  "c3_confidential",
  "c4_client_privileged",
  "c5_court_filing",
  "c6_regulated_personal",
  "c7_credentials",
  "c8_sensitive_personal"
];
/* What a person sees. The class ids are audit vocabulary and belong in the ledger, not on
   screen: nobody reading a warning knows what C4 means, and they should not have to. */
const CLASS_PLAIN = {
  c1_public:             "anything already public",
  c2_internal:           "ordinary internal work",
  c3_confidential:       "confidential material",
  c4_client_privileged:  "client or privileged material",
  c5_court_filing:       "court or filing material",
  c6_regulated_personal: "someone else's personal data",
  c7_credentials:        "a password, key or token",
  c8_sensitive_personal: "sensitive personal information"
};
function plainLabel(value) {
  const v = normalizeClass(value);
  return CLASS_PLAIN[v] || v.replace(/_/g, " ");
}
const CLASS_LABELS = {
  c1_public:             "C1 public",
  c2_internal:           "C2 internal",
  c3_confidential:       "C3 confidential",
  c4_client_privileged:  "C4 client or privileged",
  c5_court_filing:       "C5 court or filing material",
  c6_regulated_personal: "C6 regulated personal data",
  c7_credentials:        "C7 credentials and secrets",
  c8_sensitive_personal: "C8 health, financial or employment sensitive"
};
/* Entries written before 2.4.0 used a five-value list. They stay readable rather than being
   rewritten; the engine version on each entry says which vocabulary it was written in.
   personal_sensitive covered both C6 and C8, which is why it was split. The two share a
   posture row, so aliasing a legacy value to C6 cannot change a historical decision. */
const CLASS_ALIASES = {
  confidential:       "c3_confidential",
  client_privileged:  "c4_client_privileged",
  court_filing:       "c5_court_filing",
  personal_sensitive: "c6_regulated_personal",
  credentials:        "c7_credentials"
};
function normalizeClass(value) {
  const v = str(value).trim().toLowerCase();
  if (!v) return "";
  if (CLASS_ALIASES[v]) return CLASS_ALIASES[v];
  return v;
}
function classLabel(value) {
  const v = normalizeClass(value);
  return CLASS_LABELS[v] || v.replace(/_/g, " ");
}

/* Who the information is about. The class says what kind of sensitivity; the subject says
   whose consent would be needed. You can decide for yourself and not for anyone else. */
const SUBJECTS = ["self", "third_party", "client", "unknown"];
function normalizeSubject(value) {
  const v = str(value).trim().toLowerCase();
  return SUBJECTS.includes(v) ? v : "unknown";
}

/* Posture is the deployment setting. Light for people doing no legal work, Moderate for
   ordinary practice, Strict for a managed laptop. C7 ignores it. */
const POSTURES = ["light", "moderate", "strict"];
const DEFAULT_POSTURE = "moderate";
const POSTURE_MATRIX = {
  c3_confidential:       { light: "pass",  moderate: "warn",  strict: "block" },
  c4_client_privileged:  { light: "warn",  moderate: "block", strict: "block" },
  c5_court_filing:       { light: "pass",  moderate: "warn",  strict: "block" },
  c6_regulated_personal: { light: "pass",  moderate: "warn",  strict: "block" },
  c7_credentials:        { light: "block", moderate: "block", strict: "block" },
  c8_sensitive_personal: { light: "pass",  moderate: "warn",  strict: "block" }
};
/* Tier is confidence, posture is response. A soft match is never allowed to block on its own
   below Strict, because a false positive that stops work is what gets a control switched off. */
const TIER_MATRIX = {
  hard: { light: "apply", moderate: "apply", strict: "apply" },
  soft: { light: "log",   moderate: "warn",  strict: "apply" }
};
const LEVEL_ORDER = ["log", "pass", "warn", "block"];
function harsher(a, b) {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}
function gentler(a, b) {
  return LEVEL_ORDER.indexOf(a) <= LEVEL_ORDER.indexOf(b) ? a : b;
}

/* The single decision function. Everything that reacts to a class calls this. */
function classOutcome(cls, subject, posture, tier) {
  const c = normalizeClass(cls);
  const p = POSTURES.includes(posture) ? posture : DEFAULT_POSTURE;
  const t = TIER_MATRIX[tier] ? tier : "hard";
  const s = normalizeSubject(subject);

  if (c === "c7_credentials") {
    return { class: c, level: "block", basis: "hard_bar",
      why: "Credentials never enter any AI surface. No posture and no approval can change this." };
  }
  const row = POSTURE_MATRIX[c];
  if (!row) {
    return { class: c, level: "warn", basis: "unknown_class",
      why: "This class is not in the classification rule, so it is treated as unresolved." };
  }
  const gate = TIER_MATRIX[t][p];
  if (gate === "log") {
    return { class: c, level: "log", basis: "soft_below_threshold",
      why: "A low-confidence match on " + p + " posture. Recorded, nothing shown." };
  }
  if (c === "c6_regulated_personal" && s === "self") {
    return { class: c, level: "pass", basis: "self_not_third_party",
      why: "C6 covers third-party personal data. Your own is outside the class." };
  }
  if (c === "c8_sensitive_personal" && s === "self") {
    return { class: c, level: "warn", basis: "self_can_consent",
      why: "Sensitive, and about you. You can decide for yourself, so this is a notice rather than a stop." };
  }
  let level = row[p];
  if (gate === "warn") level = gentler(level, "warn");
  return { class: c, level, basis: "posture", why: CLASS_LABELS[c] + " on " + p + " posture." };
}

/* Aggregate across every declared class. */
function evaluateClasses(classes, subject, posture, tierFor) {
  const list = arr(classes).map(normalizeClass).filter(Boolean);
  const seen = new Set();
  const outcomes = [];
  for (const c of list) {
    if (seen.has(c)) continue;
    seen.add(c);
    outcomes.push(classOutcome(c, subject, posture, tierFor ? (tierFor[c] || "hard") : "hard"));
  }
  let level = "pass";
  for (const o of outcomes) level = harsher(level, o.level);
  if (level === "log") level = "pass";
  return {
    level,
    outcomes,
    blocking: outcomes.filter(o => o.level === "block").map(o => o.class),
    warning: outcomes.filter(o => o.level === "warn").map(o => o.class),
    silent: outcomes.filter(o => o.level === "log").map(o => o.class)
  };
}

/* ---------- local subject detection ----------
   Runs on the machine before the model is asked, so a wrong model answer cannot quietly
   turn someone else's medical record into "mine". Disagreement resolves to the stricter
   reading, which is third party. */
const SELF_MARKERS = /\b(my|mine|myself|i am|i'm|i was|i have|i've|i need|for me\b|on my)\b/i;
const OTHER_MARKERS = /\b(his|her|their|theirs|the (client|employee|candidate|witness|applicant|patient)|our client|they are|he is|she is|on behalf of)\b/i;
function detectSubjectLocal(text) {
  const t = str(text);
  const self = SELF_MARKERS.test(t);
  const other = OTHER_MARKERS.test(t);
  if (self && !other) return "self";
  if (other && !self) return "third_party";
  if (self && other) return "unknown";
  return "unknown";
}
function resolveSubject(localGuess, modelGuess) {
  const l = normalizeSubject(localGuess);
  const m = normalizeSubject(modelGuess);
  if (l === m) return { subject: l, decided_by: l === "unknown" ? "default" : "both" };
  if (l === "unknown") return { subject: m, decided_by: "model" };
  if (m === "unknown") return { subject: l, decided_by: "local" };
  // a genuine disagreement takes the higher reading, per the classification rule
  return { subject: "third_party", decided_by: "conflict_resolved_strict" };
}

/* Returned when the interpretation layer did not give a usable classification.
   Treated as unclassified rather than clean: a garbled answer must never read as safe. */
const UNVERIFIED_CLASS = "unverified";

/* ---------- secret screening (C7 hard bar) ---------- */
const C7_PATTERNS = [
  { id:"anthropic_key", re:/sk-ant-[A-Za-z0-9\-_]{8,}/ },
  { id:"openai_key",    re:/sk-[A-Za-z0-9]{20,}/ },
  { id:"github_token",  re:/gh[pousr]_[A-Za-z0-9]{20,}/ },
  { id:"aws_key",       re:/AKIA[0-9A-Z]{16}/ },
  { id:"private_key",   re:/-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id:"password_field",re:/\b(password|passwd|pwd)\s*[:=]\s*\S+/i },
  { id:"bearer_token",  re:/\bBearer\s+[A-Za-z0-9\-_\.]{16,}/ },
  { id:"totp_hint",     re:/\b(one[- ]time (code|password)|2fa code|verification code)\b\s*[:=]?\s*\d{4,8}/i }
];
function scanSecrets(text) {
  const hits = [];
  const t = String(text || "");
  for (const p of C7_PATTERNS) if (p.re.test(t)) hits.push(p.id);
  return hits;
}
/* The same patterns, but keeping what was matched and where. Needed to tell a live key from
   an example in documentation, and later to redact the span rather than the whole idea. */
function secretSpans(text) {
  const t = String(text || "");
  const out = [];
  for (const p of C7_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    let m;
    while ((m = re.exec(t)) !== null) {
      if (!m[0].length) { re.lastIndex++; continue; }
      out.push({ class: "c7_credentials", tier: "hard", text: m[0], start: m.index,
        end: m.index + m[0].length, pattern: p.id, source: "secret_scan" });
    }
  }
  return out;
}

/* ---------- context truncation transparency ---------- */
const CONTEXT_SEND_CAP = 12000;
function truncationNotice(total) {
  if (total <= CONTEXT_SEND_CAP) return null;
  return "Sending " + CONTEXT_SEND_CAP.toLocaleString() + " of " + total.toLocaleString() +
         " characters. The tail was cut; trim the source yourself if the tail matters.";
}

/* ---------- local pre-screen ----------
   Runs on the machine, before any network call. This is the only layer that can stop
   material from being transmitted at all: everything that needs a model to decide has
   already sent the thing by the time it decides. Approved list of 2026-07-27.

   hard  near-certain markers, mostly document labels
   soft  suggestive and common in ordinary writing, so never blocks on its own below Strict */
const PRESCREEN_PATTERNS = {
  "c3_confidential": {
    hard: ["non-disclosure agreement", "subject to an NDA", "under NDA", "confidential and proprietary", "trade secret", "not for distribution", "internal use only", "do not forward", "embargoed until", "term sheet", "letter of intent", "draft merger agreement", "unreleased"],
    soft: ["NDA", "confidential", "proprietary", "internal only", "private negotiation", "pre-announcement", "under embargo"]
  },
  "c4_client_privileged": {
    hard: ["attorney-client privileged", "attorney client privilege", "privileged and confidential", "privileged & confidential", "attorney work product", "work product doctrine", "prepared in anticipation of litigation", "subject to the attorney-client privilege", "protected by the attorney-client privilege", "common interest privilege", "joint defense agreement", "confidential attorney communication", "legal advice privilege", "litigation privilege", "our client", "my client", "the client's matter", "client matter", "matter number", "matter no.", "client number", "engagement letter", "retainer agreement", "conflicts check", "outside counsel guidelines", "new matter memo", "client intake form", "sigilo profissional", "segredo profissional", "prerrogativa do advogado", "relação advogado-cliente", "contrato de honorários"],
    soft: ["client", "cliente", "representation", "retained us", "we represent", "counsel to", "on behalf of the", "privileged", "confidential communication", "legal opinion for", "advice to", "OCG"]
  },
  "c5_court_filing": {
    hard: ["case no.", "case number", "docket no.", "docket number", "civil action no.", "index no.", "cause no.", "adversary proceeding no.", "appeal no.", "verified complaint", "notice of motion", "memorandum of law", "brief in support", "brief in opposition", "certificate of service", "proposed order", "declaration of", "affidavit of", "certification of", "notice of appeal", "motion to dismiss", "motion for summary judgment", "petition for", "answer and affirmative defenses", "attorneys' eyes only", "attorneys eyes only", "highly confidential", "under seal", "in camera", "subject to protective order", "confidentiality order", "subpoena duces tecum", "deposition transcript", "request for production", "interrogatory", "requests for admission", "privilege log", "comment letter to", "no-action request", "regulatory submission", "filed with the commission", "petição inicial", "agravo de instrumento", "contestação", "processo nº", "autos nº", "segredo de justiça", "vara cível", "vara federal", "juízo da"],
    soft: ["plaintiff", "defendant", "petitioner", "respondent", "appellant", "appellee", "exhibit", "deponent", "the court held", "we will file", "submission deadline", "standing order", "local rule"]
  },
  "c6_regulated_personal": {
    hard: ["social security number", "social security no", "ssn:", "date of birth:", "dob:", "passport number", "driver's license number", "alien registration number", "a-number", "tax identification number", "national insurance number", "NHS number", "medicare number", "CPF", "RG nº", "número do passaporte", "data subject", "data subject request", "right to erasure", "right to delete", "opt out of sale", "consumer report", "background check report", "credit report", "personal data of", "PII of", "employee roster", "customer list", "candidate list", "mailing list of", "contact list of", "attached spreadsheet of names"],
    soft: ["GDPR", "CCPA", "CPRA", "personal data", "PII", "background check", "data processing agreement", "privacy notice", "consent form"]
  },
  "c7_credentials": {
    hard: ["client secret", "client_secret", "api_secret", "-----BEGIN OPENSSH", "xoxb-", "xoxp-", "AIza", "ya29.", "eyJhbGciOi", "id_rsa", ".pem", "keychain password", "recovery code", "seed phrase", "mnemonic phrase"],
    soft: []
  },
  "c8_sensitive_personal": {
    hard: ["medical record", "protected health information", "HIPAA", "diagnosed with", "diagnosis of", "prescription for", "treatment plan for", "mental health record", "psychiatric evaluation", "disability accommodation request", "immigration status", "visa status", "green card", "permanent resident card", "work authorization", "employment authorization document", "asylum application", "USCIS receipt", "I-485", "I-140", "I-765", "H-1B petition", "O-1 petition", "EB-1", "EB-2", "EB-3", "advance parole", "undocumented", "bank account number", "routing number", "account and routing", "credit score", "tax return", "W-2", "1099-", "net worth statement", "salary history", "compensation package", "performance improvement plan", "disciplinary action", "written warning", "termination letter", "severance agreement", "grievance filed", "harassment complaint", "EEOC charge", "whistleblower complaint"],
    soft: ["salary", "compensation", "bonus", "equity grant", "health condition", "medication", "therapy", "sick leave", "FMLA", "accommodation", "visa", "immigration", "performance review", "on a PIP", "laid off", "fired"]
  }
};

/* A soft match promotes to hard when it is shouted or when it sits where headers live. */
const PROMOTE_HEAD_CHARS = 200;
/* Some patterns are labels for an identifier rather than the sensitive thing themselves.
   "matter no." is not what needs removing; "matter no. 4471" is. Redacting the label alone
   leaves the number sitting in the prompt, which is worse than useless because it looks
   handled. These patterns extend their match to take the value that follows. */
const LABEL_PATTERNS = new Set([
  "matter no.", "matter number", "client number",
  "case no.", "case number", "docket no.", "docket number", "civil action no.",
  "index no.", "cause no.", "adversary proceeding no.", "appeal no.",
  "social security number", "social security no", "ssn:", "date of birth:", "dob:",
  "passport number", "driver's license number", "alien registration number", "a-number",
  "tax identification number", "national insurance number", "nhs number", "medicare number",
  "bank account number", "routing number", "credit score", "uscis receipt",
  "processo nº", "autos nº", "rg nº"
]);
/* An optional trailing value: a colon or hash, then the identifier itself. Optional so a
   bare label still matches and can still be flagged. */
/* The value has to contain a digit, or it is not an identifier. Without that guard,
   "our matter number policy" captures the word "policy" and stops a policy question. */
const LABEL_VALUE =
  "(?:\\s*(?:is\\s+|of\\s+)?[:#=]?\\s*(?=[A-Za-z0-9\\-\\/_:.]*\\d)[A-Za-z0-9][A-Za-z0-9\\-\\/_:]*" +
  "(?:\\.[A-Za-z0-9][A-Za-z0-9\\-\\/_:]*)*)?";
/* Token names follow what the thing is, not which class it landed in, so a matter number
   does not come back as [CLIENT_1]. */
const LABEL_TOKEN = {
  "matter no.": "MATTER", "matter number": "MATTER", "client number": "CLIENT",
  "case no.": "CASE", "case number": "CASE", "docket no.": "DOCKET", "docket number": "DOCKET",
  "civil action no.": "CASE", "index no.": "CASE", "cause no.": "CASE",
  "adversary proceeding no.": "CASE", "appeal no.": "CASE",
  "processo nº": "CASE", "autos nº": "CASE",
  "social security number": "SSN", "social security no": "SSN", "ssn:": "SSN",
  "date of birth:": "DOB", "dob:": "DOB", "passport number": "PASSPORT",
  "driver's license number": "LICENSE", "alien registration number": "ANUMBER",
  "a-number": "ANUMBER", "tax identification number": "TAXID",
  "national insurance number": "NIN", "nhs number": "NHS", "medicare number": "MEDICARE",
  "bank account number": "ACCOUNT", "routing number": "ROUTING", "credit score": "SCORE",
  "uscis receipt": "USCIS", "rg nº": "RG"
};
/* Words that appear constantly in ordinary work. They still raise a notice, but they never
   promote to hard, so they can never stop a send on their own. "client feedback themes" is
   not a privilege problem. */
const NO_PROMOTE = new Set(["client", "cliente", "confidential", "representation", "exhibit",
  "accommodation", "visa", "immigration", "salary", "compensation", "bonus", "therapy",
  "medication", "personal data", "proprietary", "privileged", "advice to", "counsel to",
  "defendant", "plaintiff", "petitioner", "respondent", "local rule", "standing order"]);
function escapeRe(sIn) { return String(sIn).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function patternRegex(pattern) {
  const body = escapeRe(pattern);
  const isLabel = LABEL_PATTERNS.has(String(pattern).toLowerCase());
  const lead = /^[\p{L}\p{N}]/u.test(pattern) ? "\\b" : "";
  const tail = isLabel ? LABEL_VALUE : (/[\p{L}\p{N}]$/u.test(pattern) ? "\\b" : "");
  return new RegExp(lead + body + tail, "giu");
}
/* Some identifiers are recognizable by shape and carry no label. A docket number in the
   middle of a sentence has to be caught on its own. */
const SHAPE_PATTERNS = [
  { name: "case_number",  cls: "c5_court_filing",       tier: "hard", token: "CASE",
    re: /\b\d{1,2}:\d{2}-[a-z]{2,4}-\d{3,6}(?:-[A-Za-z]{2,4})?\b/g },
  { name: "ssn",          cls: "c6_regulated_personal", tier: "hard", token: "SSN",
    re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: "ein",          cls: "c6_regulated_personal", tier: "hard", token: "TAXID",
    re: /\b\d{2}-\d{7}\b/g },
  { name: "uscis_receipt",cls: "c8_sensitive_personal", tier: "hard", token: "USCIS",
    re: /\b(?:EAC|WAC|LIN|SRC|MSC|IOE|NBC|YSC)\d{10}\b/gi }
];
function scanShapes(text) {
  const t = str(text);
  const out = [];
  for (const p of SHAPE_PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(t)) !== null) {
      if (!m[0].length) { p.re.lastIndex++; continue; }
      out.push({ class: p.cls, tier: p.tier, text: m[0], start: m.index,
        end: m.index + m[0].length, pattern: p.name, source: "shape" });
    }
  }
  return out;
}

let PRESCREEN_COMPILED = null;
function compiledPrescreen(overrides) {
  const source = overrides || PRESCREEN_PATTERNS;
  if (!overrides && PRESCREEN_COMPILED) return PRESCREEN_COMPILED;
  const list = [];
  for (const cls of Object.keys(source)) {
    for (const tier of ["hard", "soft"]) {
      for (const pattern of (source[cls][tier] || [])) {
        list.push({ cls, tier, pattern, re: patternRegex(pattern) });
      }
    }
  }
  list.sort((a, b) => b.pattern.length - a.pattern.length);
  if (!overrides) PRESCREEN_COMPILED = list;
  return list;
}

function scanClasses(text, overrides) {
  const t = str(text);
  if (!t) return [];
  const raw = [];
  for (const entry of compiledPrescreen(overrides)) {
    entry.re.lastIndex = 0;
    let m;
    while ((m = entry.re.exec(t)) !== null) {
      if (!m[0].length) { entry.re.lastIndex++; continue; }
      let tier = entry.tier;
      /* A label that did not pick up an identifier is someone discussing the concept, not
         carrying one. "matter no. 4471" is hard; "our matter number policy" is not, and it
         must not be promoted back up by sitting near the top of the text. */
      const bareLabel = LABEL_PATTERNS.has(entry.pattern.toLowerCase()) && !/\d/.test(m[0]);
      if (bareLabel) tier = "soft";
      if (tier === "soft" && !bareLabel && !NO_PROMOTE.has(entry.pattern.toLowerCase())) {
        const shouted = m[0] === m[0].toUpperCase() && /[\p{Lu}]{3}/u.test(m[0]);
        if (shouted || m.index < PROMOTE_HEAD_CHARS) tier = "hard";
      }
      raw.push({ class: entry.cls, tier, text: m[0], start: m.index, end: m.index + m[0].length,
        pattern: entry.pattern, source: "wordlist" });
    }
  }
  return dedupeSpans(raw.concat(scanShapes(t)));
}

/* Overlapping matches collapse to the longest, so "attorney-client privileged" wins over
   "privileged" and the user is shown one finding rather than three. */
function dedupeSpans(spans) {
  const sorted = spans.slice().sort((a, b) =>
    a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept = [];
  let lastEnd = -1;
  for (const sp of sorted) {
    if (sp.start >= lastEnd) { kept.push(sp); lastEnd = sp.end; }
  }
  return kept;
}

/* The matter list is the only thing that catches a client by name. Entries live encrypted
   on the machine and are matched here; the list itself never reaches a prompt, a snapshot,
   or the ledger. Every kind resolves to C4, and the posture decides what happens next. */
const MATTER_KINDS = ["client", "matter_number", "opposing_party", "case_caption",
  "adverse_party", "prospective_client", "former_client", "nda_third_party"];
/* Your own rule defines C4 as client identity PLUS matter facts, advice, strategy or work
   for the client. A name on its own is not privileged: asking what industry a client is in,
   or reading a vendor's public docs when that vendor is a client, is ordinary work. So a
   matter-list name is a reference until something in the text shows a representation. */
const REPRESENTATION_MARKERS = /\b(advis\w+|represent\w*|retain\w+|engagement|matter|counsel|privileg\w*|work product|litigation|deposition|settlement|negotiat\w+|draft(ing)? (a |the )?(memo|letter|brief|agreement|opinion)|on behalf of|for (the|our|my) client|conflicts?|filing|tribunal|court|opposing|strategy for|legal (advice|opinion|analysis))\b/i;
function hasRepresentationContext(text, otherSpans) {
  if (REPRESENTATION_MARKERS.test(str(text))) return true;
  return arr(otherSpans).some(sp =>
    sp.source === "wordlist" &&
    (sp.class === "c4_client_privileged" || sp.class === "c5_court_filing"));
}

/* Not every C4 pattern means the same thing. A privilege header is a declaration about the
   material. "our client" is a description of a relationship, and the relationship can appear
   in a question that has nothing to do with working on the matter. */
const C4_DECLARATIONS = new Set(["attorney-client privileged", "attorney client privilege",
  "privileged and confidential", "privileged & confidential", "attorney work product",
  "work product doctrine", "prepared in anticipation of litigation",
  "subject to the attorney-client privilege", "protected by the attorney-client privilege",
  "common interest privilege", "joint defense agreement", "confidential attorney communication",
  "legal advice privilege", "litigation privilege", "sigilo profissional", "segredo profissional"]);

/* A question about the user's own position, obligations or safety is not work on a matter,
   even when a client is named in it. "Our client sent me X, I feel harassed, who do I
   contact" is a person asking for help, and stopping it is the worst available outcome.
   Model Rule 1.6(b)(4) recognizes this: a lawyer may reveal information to secure legal
   advice about the lawyer's own compliance with the Rules. */
const SELF_REGARDING_ASK = /\b(who (do|should) i (contact|call|tell|report|speak)|what should i do|what do i do|am i (required|obliged|obligated|allowed|able|supposed)|do i (have to|need to)|should i (report|tell|contact|disclose|resign|withdraw)|what are my (options|obligations|duties|rights)|my (obligation|duty|options|rights)|i feel|i fear|i am (worried|scared|uncomfortable|afraid)|i'm (worried|scared|uncomfortable|afraid)|is (this|that) (ok|okay|allowed|normal|proper|ethical)|can i (report|refuse|withdraw|decline|tell)|how (do|should) i handle|conflict of interest for me|do i report)\b/i;
function isSelfRegardingAsk(text) { return SELF_REGARDING_ASK.test(str(text)); }

function matchMatters(text, entries) {
  const t = str(text);
  if (!t) return [];
  const found = [];
  for (const e of arr(entries)) {
    const value = str(e && e.value).trim();
    if (value.length < 3) continue; // too short to match safely
    const kind = MATTER_KINDS.includes(e.kind) ? e.kind : "client";
    const re = patternRegex(value);
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      if (!m[0].length) { re.lastIndex++; continue; }
      found.push({ class: kind === "nda_third_party" ? "c3_confidential" : "c4_client_privileged",
        tier: "hard", text: m[0], start: m.index, end: m.index + m[0].length,
        pattern: kind, source: "matter_list" });
    }
  }
  return dedupeSpans(found);
}

/* No stop is absolute. There are more legitimate situations than anyone can enumerate in a
   pattern list, and a wall the user cannot argue with just sends the work somewhere with no
   record at all. What changes is the friction: a guess takes a sentence, a declaration takes
   a considered answer, and a live-looking credential takes the most work of all. Every
   override is recorded with its class, its tier and its reason. */
const EXAMPLE_MARKERS = /(example|sample|placeholder|redacted|your[-_ ]?key|xxx+|\.\.\.|<[^>]+>|\bfake\b|\bdummy\b|\btest\b|â€¦|123456)/i;
function looksLikeExample(text) {
  const t = str(text);
  if (!t) return true;
  if (EXAMPLE_MARKERS.test(t)) return true;
  if (/(.)\1{5,}/.test(t)) return true;          // long runs of one character
  const body = t.replace(/^[a-z-]+[-_]/i, "");
  return body.length < 12;                        // too short to be a live secret
}
function overrideTier(findings) {
  const f = findings || {};
  const spans = arr(f.spans);
  const declared = spans.some(sp =>
    sp.source === "wordlist" && C4_DECLARATIONS.has(str(sp.pattern).toLowerCase()));
  const secretMatches = spans.filter(sp => sp.source === "secret_scan").map(sp => sp.text);
  const liveSecret = secretMatches.length > 0 && secretMatches.some(x => !looksLikeExample(x));
  if (liveSecret) {
    return { tier: "confirm", declared, live_secret: true, min_reason: 40,
      ask: "This looks like a live credential. Say what it actually is, and why it is safe to send.",
      warn: "If this is a real key, cancel and remove it. Overriding is recorded permanently." };
  }
  if (declared) {
    return { tier: "confirm", declared: true, live_secret: false, min_reason: 25,
      ask: "The text declares this material privileged. Say why that label does not apply here.",
      warn: "This override is recorded against a declared class, with your reason." };
  }
  return { tier: "reason", declared: false, live_secret: false, min_reason: 8,
    ask: "What is this actually about?",
    warn: "" };
}

/* Everything the machine can decide on its own, before anything is sent. */
function localScreen(text, options) {
  const opts = options || {};
  const secrets = scanSecrets(text);
  const secretMatches = secretSpans(text);
  const wordSpans = scanClasses(text, opts.patterns).concat(secretMatches);
  const matterSpans = matchMatters(text, opts.matters);
  /* A matter reference only becomes client material when the text also shows a
     representation. Otherwise it is a question, answered once, not a wall. */
  const representation = hasRepresentationContext(text, wordSpans);
  for (const sp of matterSpans) {
    if (!representation) {
      sp.class = "matter_reference";
      sp.tier = "soft";
    }
  }
  /* An ethics or personal question that merely names a client is not matter work. Downgrade
     when nothing in the text declares the material itself privileged. */
  const selfAsk = isSelfRegardingAsk(text);
  const declared = wordSpans.some(sp => C4_DECLARATIONS.has(str(sp.pattern).toLowerCase()));
  const personalQuestion = selfAsk && !declared;
  if (personalQuestion) {
    for (const sp of wordSpans.concat(matterSpans)) {
      if (sp.class === "c4_client_privileged") sp.tier = "soft";
    }
  }
  const spans = dedupeSpans(wordSpans.concat(matterSpans));
  const classes = [];
  const tierFor = {};
  const references = [];
  for (const sp of spans) {
    if (sp.class === "matter_reference") {
      if (!references.includes(sp.text)) references.push(sp.text);
      continue;
    }
    if (!classes.includes(sp.class)) classes.push(sp.class);
    if (sp.tier === "hard") tierFor[sp.class] = "hard";
    else if (!tierFor[sp.class]) tierFor[sp.class] = "soft";
  }
  if (secrets.length && !classes.includes("c7_credentials")) {
    classes.push("c7_credentials");
    tierFor.c7_credentials = "hard";
  }
  const subject = detectSubjectLocal(text);
  const verdict = evaluateClasses(classes, subject, opts.posture || DEFAULT_POSTURE, tierFor);
  /* A stop is overridable when it rests on a heuristic rather than a declaration. A pasted
     privilege header or a credential is a statement of fact and stays absolute; a guess from
     a name or an ordinary word is not, and refusing to let the user say "this isn't that"
     just sends them somewhere with no controls at all. */
  const findings = { spans, classes, tierFor, secrets, subject, verdict, references,
    representation, personal_question: personalQuestion };
  findings.override = overrideTier(findings);
  findings.overridable = true; // always, at a price
  return findings;
}

/* ---------- redaction and restore ----------
   A stop with no way forward is a bad control: the workaround is to leave the tool and paste
   the thing somewhere with none. Redaction is the way forward. The sensitive text never goes
   anywhere; a token does, and the token comes back at the end.

   Tokens rather than realistic fake names. "John Doe" reads better but the model writes
   "Mr. Doe" or just "John", a literal replacement misses it, and you never find out. A
   bracketed token has nothing to inflect. */
const REDACT_ACTIONS = ["token", "delete", "generalize", "custom", "false_positive"];
const TOKEN_PREFIXES = {
  client: "CLIENT", matter_number: "MATTER", opposing_party: "PARTY", adverse_party: "PARTY",
  case_caption: "CASE", prospective_client: "CLIENT", former_client: "CLIENT",
  nda_third_party: "PARTY",
  c6_regulated_personal: "PERSON", c8_sensitive_personal: "PERSON",
  c7_credentials: "SECRET", c5_court_filing: "FILING", c4_client_privileged: "CLIENT",
  c3_confidential: "ITEM"
};
function tokenPrefix(span) {
  if (!span) return "REDACTED";
  if (span.source === "matter_list" && TOKEN_PREFIXES[span.pattern]) return TOKEN_PREFIXES[span.pattern];
  if (span.source === "shape") {
    const shape = SHAPE_PATTERNS.find(p => p.name === span.pattern);
    if (shape) return shape.token;
  }
  const labelled = LABEL_TOKEN[str(span.pattern).toLowerCase()];
  if (labelled) return labelled;
  return TOKEN_PREFIXES[normalizeClass(span.class)] || "REDACTED";
}
function defaultRedactAction(span) {
  if (!span) return "token";
  /* A credential should not come back at the end. There is no document that needs the real
     key restored into it, so the default is to remove it outright. */
  if (span.source === "secret_scan") return "delete";
  if (span.source === "matter_list") return "token";
  if (C4_DECLARATIONS.has(str(span.pattern).toLowerCase())) return "delete";
  if (LABEL_PATTERNS.has(str(span.pattern).toLowerCase())) return "token";
  if (span.source === "shape") return "token";
  return span.tier === "hard" ? "delete" : "false_positive";
}

/* One plan per prompt. The same real value always gets the same token inside a prompt, or the
   text stops making sense. */
function buildRedactionPlan(spans) {
  const items = [];
  const assigned = new Map();
  const counters = {};
  for (const sp of arr(spans)) {
    const key = str(sp.text).toLowerCase();
    let token = assigned.get(key);
    if (!token) {
      const prefix = tokenPrefix(sp);
      counters[prefix] = (counters[prefix] || 0) + 1;
      token = "[" + prefix + "_" + counters[prefix] + "]";
      assigned.set(key, token);
    }
    items.push({
      start: sp.start, end: sp.end, text: sp.text, class: sp.class, tier: sp.tier,
      source: sp.source, pattern: sp.pattern, token,
      action: defaultRedactAction(sp), replacement: ""
    });
  }
  items.sort((a, b) => a.start - b.start);
  return items;
}

/* Applies the chosen action to each span, right to left so earlier offsets stay valid. */
function applyRedactions(text, plan) {
  const original = str(text);
  const items = arr(plan).slice().sort((a, b) => b.start - a.start);
  let out = original;
  const map = [];
  const seen = new Set();
  let changed = 0;
  for (const it of items) {
    const action = REDACT_ACTIONS.includes(it.action) ? it.action : "token";
    if (action === "false_positive") continue;
    let replacement;
    if (action === "token") replacement = it.token;
    else if (action === "delete") replacement = "";
    else replacement = str(it.replacement).trim() || it.token;
    out = out.slice(0, it.start) + replacement + out.slice(it.end);
    changed++;
    if (action === "token" && !seen.has(it.token)) {
      seen.add(it.token);
      map.push({ token: it.token, value: it.text, class: it.class });
    }
  }
  return {
    text: out.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1")
             .replace(/^[\s.,;:]+/, "").trim(),
    map, changed,
    kept: items.filter(it => it.action === "false_positive").length
  };
}

/* The last step of the workflow, and the one place a model must never be involved. An exact
   replacement either matches or it does not; a model might paraphrase, miss one, or invent a
   name, and nothing would tell you. */
function restoreText(text, map) {
  let out = str(text);
  let restored = 0;
  const missing = [];
  for (const entry of arr(map)) {
    const token = str(entry.token);
    if (!token) continue;
    const before = out;
    out = out.split(token).join(str(entry.value));
    if (before === out) missing.push(token);
    else restored++;
  }
  /* Anything that still looks like a token, or a fragment of one, is reported rather than
     left to be noticed later by a reader. */
  const residuals = [];
  const leftover = out.match(/\[[A-Z]+_\d+\]/g);
  if (leftover) for (const l of leftover) if (!residuals.includes(l)) residuals.push(l);
  return { text: out, restored, expected: arr(map).length, missing, residuals,
    complete: residuals.length === 0 && missing.length === 0 };
}

/* ---------- Phase A: interpretation ---------- */
const INTERPRET_SYSTEM_PROMPT = `You are O'Mono's interpretation layer. Your only job is to state what the user appears to want, expose every assumption, and ask what cannot be safely inferred. You never write the final prompt.

Rules:
1. Mirror the user's language for all content strings; JSON keys stay in English.
2. restated_intent is one plain sentence: "You want ..." followed by the narrowest honest reading of the request. Example: for "who's lady gaga's manager?" write "You want to know who Lady Gaga's manager is, stated simply." Do not silently upgrade scope.
3. Every leap you would otherwise make silently becomes either an assumption (safe default, user can veto with one tap) or a question (genuinely ambiguous, needs the user's answer). Prefer few, sharp items over many trivial ones. Zero of each is the ideal when the idea is truly unambiguous.
4. Generate every question fresh from this raw idea. Each question must carry 2 to 4 meaningful, question-specific choices that answer that exact question directly. Do not reuse a generic choice set across unrelated ideas. Use Yes and No only when a binary answer fully resolves the ambiguity. Set "suggested" to the value of your best choice so a fast user can confirm in one tap. The "why" explains, in one everyday sentence, what changes depending on the choice.
5. "detail" is null unless one or more choices need a short contextual specification that their labels cannot carry. When it is useful, set "show_for" only to the affected option values and write a prompt that asks for the exact missing detail. Never make the user add a comment when a direct choice already answers the question; "required" must be false.
6. data_flags: report every class the input appears to contain, using the class ids exactly. c3_confidential is non-client material whose disclosure causes real harm or breaks a commitment. c4_client_privileged is anything relating to a representation, or attorney-client privileged or work product. c5_court_filing is anything that will be signed, filed, or submitted to a tribunal or regulator. c6_regulated_personal is THIRD-PARTY personal data protected by privacy law, never the user's own. c7_credentials is authentication material of any kind. c8_sensitive_personal is health, immigration, financial or employment-sensitive material about any person, including the user. Mixed content reports every class present. Say what you saw in "reason" without repeating the sensitive content itself. Report nothing when the input is ordinary public or internal material.
6a. data_subject: who the sensitive information is about. "self" when it is the user's own information, "third_party" when it is another identifiable person's, "client" when it relates to a representation, "unknown" when you cannot tell. This changes what the user is entitled to decide alone, so do not guess: use "unknown" when it is genuinely unclear.
7. task_type: pick one: quick_fact, research_live, deep_reasoning, drafting, legal_analysis, summarization, coding, image, brainstorm.
8. needs: capability tags this task genuinely benefits from, from: live_web, deep_reasoning, fast_cheap, long_context, coding, image_gen, citations.
9. If prior learned interpretations are supplied, apply them and record which ones you used in applied_learnings; do not re-ask what a learning already answers unless it conflicts with this input.
10. If a candidate destination list is supplied, recommend exactly one candidate (its system and model ids verbatim) and write the "because" for THIS task, never a generic line. Name what the task actually is in the user's own terms. Patterns to follow, filled with the real task: "enough for [looking up who manages one artist]: the answer is a single checkable fact, and a heavier model would add weight, not quality." Or: "great for [combing live sources on a moving story] because it searches the web and cites what it finds." One or two sentences, everyday words, executive tone, never mention price or cost. This is a recommendation the user may contest; make the reasoning honest enough to argue with.

Output STRICT JSON only, exactly:
{
  "restated_intent": "...",
  "assumptions": [{"text": "...", "accept_default": true}],
  "questions": [{
    "q": "...",
    "why": "...",
    "options": [
      {"value": "<short_stable_id_1>", "label": "<first answer tailored to this exact question>"},
      {"value": "<short_stable_id_2>", "label": "<second answer tailored to this exact question>"}
    ],
    "suggested": "<one option value>",
    "detail": null
  }],
  "data_flags": {"classes": [], "reason": ""},
  "data_subject": "self|third_party|client|unknown",
  "task_type": "...",
  "needs": ["..."],
  "applied_learnings": ["..."],
  "recommendation": {"system": "...", "model": "...", "because": "..."}
}
Replace every angle-bracket placeholder with content generated for the current raw idea; never return a placeholder verbatim. "detail", when useful, has exactly {"show_for": ["<affected option value>"], "prompt": "<specific detail to add>", "required": false}. "classes" values, when present, are exactly: "c3_confidential", "c4_client_privileged", "c5_court_filing", "c6_regulated_personal", "c7_credentials", "c8_sensitive_personal". Omit "recommendation" only when no candidate list was supplied.`;

function buildInterpretMessage(idea, contextText, manualHits, candidates) {
  let msg = "";
  if (manualHits && manualHits.length) {
    msg += "Prior learned interpretations for this user (apply rule 9):\n";
    for (const h of manualHits) msg += "- When the user says something like \"" + h.pattern + "\", they mean: " + h.meaning + "\n";
    msg += "\n";
  }
  if (candidates && candidates.length) {
    msg += "Candidate destinations, the systems this user actually has (apply rule 10; use ids verbatim):\n";
    for (const c of candidates) {
      msg += "- system=" + c.system + " model=" + c.model + " (" + c.systemLabel + " " + c.modelLabel +
             "; strengths: " + (c.tags.join(", ") || "general") + (c.note ? "; " + c.note : "") + ")\n";
    }
    msg += "\n";
  }
  if (contextText) {
    msg += "Context source (excerpt the final prompt may use):\n\"\"\"\n" + contextText.slice(0, CONTEXT_SEND_CAP) + "\n\"\"\"\n\n";
  }
  msg += "Raw idea:\n" + idea;
  return msg;
}

function optionValue(value, label) {
  return (str(value).trim() || str(label).trim())
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function normalizeOptions(question) {
  if (!Array.isArray(question && question.options)) {
    return [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" }
    ];
  }

  const options = [];
  const values = new Set();
  const labels = new Set();
  for (const raw of question.options) {
    const label = str(typeof raw === "string" ? raw : raw && raw.label).trim();
    const value = optionValue(typeof raw === "string" ? "" : raw && raw.value, label);
    const labelKey = label.toLocaleLowerCase();
    if (!label || !value || values.has(value) || labels.has(labelKey)) continue;
    values.add(value);
    labels.add(labelKey);
    options.push({ value, label });
    if (options.length === 4) break;
  }
  if (options.length < 2) {
    throw new Error("Malformed response: every question needs 2 to 4 distinct choices.");
  }
  return options;
}

function normalizeDetail(detail, options) {
  if (!detail || typeof detail !== "object") return null;
  const validValues = new Set(options.map(o => o.value));
  const showFor = arr(detail.show_for)
    .map(v => optionValue(v, ""))
    .filter((v, i, all) => validValues.has(v) && all.indexOf(v) === i);
  const prompt = str(detail.prompt).trim();
  if (!showFor.length || !prompt) return null;
  return { show_for: showFor, prompt, required: false };
}

function normalizeQuestion(question) {
  const q = question && typeof question === "object" ? question : {};
  const options = normalizeOptions(q);
  const rawSuggested = optionValue(q.suggested, "");
  const suggested = options.some(o => o.value === rawSuggested) ? rawSuggested : options[0].value;
  return {
    q: str(q.q),
    why: str(q.why),
    options,
    suggested,
    detail: normalizeDetail(q.detail, options)
  };
}

/* A missing or malformed data_flags object used to collapse to an empty class list,
   which read downstream as "nothing sensitive here". It now fails closed. */
function parseDataFlags(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.classes)) {
    return {
      classes: [UNVERIFIED_CLASS],
      reason: "The interpretation layer did not return a usable data-class result, so this input is unclassified."
    };
  }
  return {
    classes: arr(raw.classes).map(normalizeClass).filter(Boolean),
    reason: str(raw.reason)
  };
}

function parseInterpretJSON(text) {
  const obj = extractJSON(text);
  return {
    restated_intent: str(obj.restated_intent),
    assumptions: arr(obj.assumptions).map(a => ({ text: str(a && a.text), accept_default: a && a.accept_default !== false })),
    questions: arr(obj.questions).map(normalizeQuestion),
    data_flags: parseDataFlags(obj.data_flags),
    data_subject: normalizeSubject(obj.data_subject),
    task_type: str(obj.task_type) || "drafting",
    needs: arr(obj.needs).map(str).filter(Boolean),
    applied_learnings: arr(obj.applied_learnings).map(str).filter(Boolean),
    recommendation: obj.recommendation && obj.recommendation.system ? {
      system: str(obj.recommendation.system),
      model: str(obj.recommendation.model),
      because: str(obj.recommendation.because)
    } : null
  };
}

/* ---------- destination recommendation ---------- */
/* registry: { as_of, systems: [{ id, label, models: [{ id, label, tags: [], cost: 1..3, note }] }] }
   access:   { systemId: true|false or { systemId: [modelId, ...] } }  */
function accessibleModels(registry, access) {
  const out = [];
  for (const sys of (registry.systems || [])) {
    const a = access ? access[sys.id] : undefined;
    if (!a) continue;
    for (const m of (sys.models || [])) {
      if (Array.isArray(a) && a.length && !a.includes(m.id)) continue;
      out.push({ system: sys.id, systemLabel: sys.label, model: m.id, modelLabel: m.label, tags: m.tags || [], cost: m.cost || 2, note: m.note || "" });
    }
  }
  return out;
}

const NEED_PHRASES = {
  live_web: "it can search the live web, which this task depends on",
  deep_reasoning: "it is built for deep multi-step reasoning, which this task rewards",
  fast_cheap: "it is the more efficient choice for this type of task",
  long_context: "it handles very long context, which this material needs",
  coding: "it is built for code work",
  image_gen: "it generates images, which is the actual deliverable here",
  citations: "it returns sourced answers you can check"
};

const TASK_PHRASES = {
  quick_fact: "a quick factual lookup",
  research_live: "live research over current sources",
  deep_reasoning: "a task that rewards real reasoning depth",
  drafting: "a drafting job",
  legal_analysis: "legal analysis",
  summarization: "a tight summary",
  coding: "code work",
  image: "image generation",
  brainstorm: "a brainstorm"
};

/* Deterministic pick used as the fallback and as the validator's baseline.
   The primary, task-specific "because" comes from the interpretation model
   (rule 9); this one still names the task type so even the fallback explains. */
function recommendDestination(interpretation, registry, access) {
  const candidates = accessibleModels(registry, access);
  if (!candidates.length) return null;
  const needs = interpretation.needs && interpretation.needs.length ? interpretation.needs : ["fast_cheap"];
  let best = null, bestScore = -1;
  for (const c of candidates) {
    let score = 0;
    for (const n of needs) if (c.tags.includes(n)) score += 2;
    const simple = ["quick_fact","summarization"].includes(interpretation.task_type);
    score += simple ? (3 - c.cost) * 0.5 : (c.cost - 1) * 0.1;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best) return null;
  const taskPhrase = TASK_PHRASES[interpretation.task_type] || "this task";
  const matched = needs.filter(n => best.tags.includes(n));
  const phrases = matched.map(n => NEED_PHRASES[n]).filter(Boolean);
  let because;
  if (best.cost === 1 && ["quick_fact","summarization"].includes(interpretation.task_type)) {
    because = best.systemLabel + " " + best.modelLabel + ": enough for " + taskPhrase +
      ". A heavier model would add weight, not quality, because the job needs speed and accuracy, not depth.";
  } else {
    because = best.systemLabel + " " + best.modelLabel + " for " + taskPhrase +
      (phrases.length ? ", because " + phrases.join(", and ") : "") + ".";
  }
  return { system: best.system, systemLabel: best.systemLabel, model: best.model, modelLabel: best.modelLabel, because, source: "fallback" };
}

/* Prefer the model-authored, task-specific recommendation when it names a real
   candidate; otherwise fall back to the deterministic pick. */
function resolveRecommendation(interpretation, registry, access) {
  const candidates = accessibleModels(registry, access);
  const rec = interpretation && interpretation.recommendation;
  if (rec && rec.system && rec.model) {
    const hit = candidates.find(c => c.system === rec.system && c.model === rec.model);
    if (hit && rec.because && rec.because.trim() && !/cheap|cost|price/i.test(rec.because)) {
      return { system: hit.system, systemLabel: hit.systemLabel, model: hit.model, modelLabel: hit.modelLabel, because: rec.because.trim(), source: "model" };
    }
  }
  return recommendDestination(interpretation, registry, access);
}

/* ---------- Phase B: generation ---------- */
const GENERATE_SYSTEM_PROMPT = `You are O'Mono, an elite prompt engineer and a patient teacher. You take a confirmed interpretation of a user's idea and write a production-grade prompt using the RTCI CEFT structure: Role, Task, Context, Input, Constraints, Examples, Format, Tone.

Rules:
1. The confirmed interpretation is controlling. Build the prompt for exactly that reading: honor every accepted assumption, every answered question, and every correction. Do not reintroduce a reading the user vetoed.
2. Write all final prompt content in English regardless of the input language. Field labels stay in English. If the user wants the downstream model's answer in another language, state that requirement in English inside the prompt.
3. "role" content always starts with "You are".
4. Decide, field by field, whether the field earns its place in THIS prompt. A field that adds no signal is noise. Even omitted fields get plausible draft content so the user can opt them back in.
5. Rationale teaches. For every field, included or not, fill the rationale object:
   - verdict: "advisable", "inadvisable", or "optional" for THIS prompt.
   - because: one or two everyday sentences a non-engineer follows. Example: "Role is advisable here because without a persona the model answers as a generic assistant and hedges; naming a music-industry biographer locks the lens."
   - lesson: one transferable rule of thumb the user keeps. Example: "Quick factual lookups rarely need Examples; save them for when format matters more than facts."
6. Tailor the prompt to the destination system AND model version named, when it changes anything material: coding agents want file-level specificity, live-search systems want research framing and source instructions, image models want visual composition language, small fast models want shorter and more literal prompts.
7. If the interpretation flags citations or legal authority, the prompt itself must instruct the destination model to provide verifiable sources and must tell the user's reader that every authority requires independent verification before reliance.
8. Content must be concrete and specific. No filler, no boilerplate, no hedging. Keep each field tight; the assembled prompt should be as short as it can be while complete.

Output STRICT JSON only, exactly:
{
  "overall_reasoning": "2-3 sentences on the construction strategy",
  "fields": {
    "role":        {"include": true,  "content": "...", "rationale": {"verdict": "advisable", "because": "...", "lesson": "..."}},
    "task":        {"include": true,  "content": "...", "rationale": {"verdict": "advisable", "because": "...", "lesson": "..."}},
    "context":     {"include": true,  "content": "...", "rationale": {"verdict": "optional", "because": "...", "lesson": "..."}},
    "input":       {"include": false, "content": "...", "rationale": {"verdict": "inadvisable", "because": "...", "lesson": "..."}},
    "constraints": {"include": true,  "content": "...", "rationale": {"verdict": "advisable", "because": "...", "lesson": "..."}},
    "examples":    {"include": false, "content": "...", "rationale": {"verdict": "inadvisable", "because": "...", "lesson": "..."}},
    "format":      {"include": true,  "content": "...", "rationale": {"verdict": "advisable", "because": "...", "lesson": "..."}},
    "tone":        {"include": true,  "content": "...", "rationale": {"verdict": "optional", "because": "...", "lesson": "..."}}
  }
}`;

function buildGenerateMessage(idea, contextText, interpretation, confirmed, destination) {
  let msg = "Destination system: " + destination.systemLabel + "\nDestination model: " + destination.modelLabel + "\n\n";
  msg += "Output language contract: Write all final prompt field content in English regardless of the raw idea's language. If the desired downstream answer should be in another language, state that requirement in English.\n\n";
  msg += "Confirmed interpretation (controlling):\n";
  msg += "- Intent: " + (confirmed.intent || interpretation.restated_intent) + "\n";
  for (const a of confirmed.assumptions || []) {
    msg += "- Assumption " + (a.accepted ? "ACCEPTED" : "REJECTED") + ": " + a.text + (a.note ? (" (user note: " + a.note + ")") : "") + "\n";
  }
  for (const q of confirmed.answers || []) {
    const answerValue = str(q.answer).trim();
    const sourceQuestion = (interpretation.questions || []).find(item => item.q === q.q);
    const sourceOption = sourceQuestion && (sourceQuestion.options || []).find(option => option.value === answerValue);
    const answerLabel = str(q.answer_label || q.label || (sourceOption && sourceOption.label) || answerValue).trim();
    msg += "- Question: " + q.q + " Selected answer: " + answerLabel + " (value: " + answerValue + ")" +
      (q.note ? (" (context detail: " + q.note + ")") : "") +
      (q.comment ? (" (user comment: " + q.comment + ")") : "") + "\n";
  }
  if (confirmed.correction) msg += "- User correction: " + confirmed.correction + "\n";
  if (confirmed.destination_contest) msg += "- User contested the destination reasoning, saying: " + confirmed.destination_contest + " (honor this reading of what they want)\n";
  msg += "- Task type: " + interpretation.task_type + "\n\n";
  if (contextText) {
    msg += "Context source:\n\"\"\"\n" + contextText.slice(0, CONTEXT_SEND_CAP) + "\n\"\"\"\n\n";
  }
  msg += "Raw idea:\n" + idea;
  return msg;
}

function parseGenerateJSON(text) {
  const obj = extractJSON(text);
  if (!obj.fields || typeof obj.fields !== "object" || Array.isArray(obj.fields)) {
    throw modelFormatError("Malformed response: missing fields.");
  }
  const fields = {};
  for (const k of FIELD_ORDER) {
    const f = obj.fields[k] || {};
    let rat = f.rationale;
    if (!rat && typeof f.reasoning === "string") {
      rat = { verdict: f.include ? "advisable" : "inadvisable", because: f.reasoning, lesson: "" };
    }
    rat = rat || {};
    fields[k] = {
      include: !!f.include,
      content: str(f.content),
      rationale: {
        verdict: ["advisable","inadvisable","optional"].includes(rat.verdict) ? rat.verdict : (f.include ? "advisable" : "inadvisable"),
        because: str(rat.because) || "Not addressed by the model.",
        lesson: str(rat.lesson)
      }
    };
  }
  const parsed = { overall_reasoning: str(obj.overall_reasoning), fields };
  const hasSemanticContent = FIELD_ORDER.some(k =>
    fields[k].include && /[\p{L}\p{N}]/u.test(fields[k].content)
  );
  if (!hasSemanticContent) {
    throw modelFormatError("Malformed response: assembled prompt is semantically empty.");
  }
  return parsed;
}

/* ---------- assembly ---------- */
function assembled(fields) {
  return FIELD_ORDER
    .filter(k => fields[k] && fields[k].include && (fields[k].content || "").trim())
    .map(k => FIELD_LABELS[k] + ": " + fields[k].content.trim())
    .join("\n\n");
}
function assembledWithReasoning(fields, overall) {
  let out = assembled(fields) + "\n\n---\nREASONING (O'Mono)\n";
  if (overall) out += "\nOverall: " + overall + "\n";
  for (const k of FIELD_ORDER) {
    const f = fields[k]; if (!f) continue;
    const r = f.rationale || {};
    out += "\n" + FIELD_LABELS[k] + " [" + (f.include ? "included" : "omitted") + ", " + (r.verdict || "") + "]: " +
      (r.because || "") + (r.lesson ? (" Rule of thumb: " + r.lesson) : "");
  }
  return out;
}

/* ---------- register snapshot currency ---------- */
const REGISTER_STALE_DAYS = 60;
function registerAgeDays(registerSnapshot, now) {
  const asOf = registerSnapshot && registerSnapshot.as_of;
  if (!asOf) return null;
  const parsed = Date.parse(String(asOf) + "T00:00:00Z");
  if (!Number.isFinite(parsed)) return null;
  return Math.floor((now - parsed) / 86400000);
}

/* ---------- Gate 17, the tool intake gate ----------
   The gate is in force as of standard v2.2. It is a five-condition test and every condition
   is data the register already holds, so the app can run it rather than restate it. */
const GATE17_CONDITIONS = ["row_exists", "status_usable", "class_permitted",
  "intake_current", "harness_present", "no_credentials"];
function gate17(row, classes, options) {
  const opts = options || {};
  const at = Number.isFinite(opts.now) ? opts.now : Date.now();
  const months = Number.isFinite(opts.intakeValidMonths) ? opts.intakeValidMonths : 12;
  const declared = arr(classes).map(normalizeClass).filter(Boolean);
  const failures = [];

  if (!row) {
    failures.push({ condition: "row_exists",
      why: "This destination has no entry in the register of approved systems. Without one, nothing beyond public and internal material may be sent to it." });
    return { pass: false, failures, conditions: GATE17_CONDITIONS };
  }
  const status = str(row.status).toUpperCase();
  if (status !== "APPROVED" && status !== "RESTRICTED") {
    failures.push({ condition: "status_usable",
      why: "Row " + (row.row || "") + " is " + (status || "unset") + ", not APPROVED or RESTRICTED." });
  }
  const permitted = arr(row.permitted).map(normalizeClass);
  const conditional = arr(row.conditional).map(normalizeClass);
  const barred = arr(row.barred).map(normalizeClass);
  for (const c of declared) {
    if (c === "c7_credentials") continue; // reported by its own condition
    if (barred.includes(c)) {
      failures.push({ condition: "class_permitted",
        why: classLabel(c) + " is barred on row " + (row.row || "this destination") + "." });
    } else if (!permitted.includes(c) && !conditional.includes(c)) {
      failures.push({ condition: "class_permitted",
        why: classLabel(c) + " is not covered by row " + (row.row || "this destination") + "." });
    }
  }
  if (!row.intake_date) {
    failures.push({ condition: "intake_current", why: "No intake date recorded." });
  } else {
    const parsed = Date.parse(String(row.intake_date) + "T00:00:00Z");
    const ageMonths = Number.isFinite(parsed) ? (at - parsed) / (30.44 * 86400000) : Infinity;
    if (!(ageMonths <= months)) {
      failures.push({ condition: "intake_current",
        why: "Intake is " + Math.round(ageMonths) + " months old, past the " + months + "-month limit." });
    }
  }
  if (opts.reliedOn && !str(row.harness).trim()) {
    failures.push({ condition: "harness_present",
      why: "This is a relied-on use and the row records no harness verdict." });
  }
  if (declared.includes("c7_credentials")) {
    failures.push({ condition: "no_credentials",
      why: "Credential material is present. No approval can pass C7." });
  }
  return { pass: failures.length === 0, failures, conditions: GATE17_CONDITIONS };
}

/* O'Mono is itself an AI surface with its own row. Screening the destination while never
   screening the surface doing the screening was the gap this closes. */
function selfGate(registerSnapshot, classes, options) {
  const row = registerSnapshot && registerSnapshot.self;
  return gate17(row, classes, Object.assign({
    intakeValidMonths: registerSnapshot && registerSnapshot.intake_valid_months
  }, options || {}));
}

/* ---------- Gate 18, the pre-filing verification gate ----------
   In force since standard v2.2. It attaches to the filing, not to the wording of the request:
   if court or filing material is in play, or the prompt asks for authorities, then every
   authority the model returns has to be checked against a primary source before anything is
   signed. The app cannot do the checking. What it can do is produce the list, hold the record
   of who checked what and when, and refuse to call the work finished until the list is closed. */

const CITATION_SHAPES = [
  { kind: "us_case_reporter", label: "case citation",
    re: /\b\d{1,4}\s+(?:U\.?\s?S\.?|S\.?\s?Ct\.?|L\.?\s?Ed\.?(?:\s?2d)?|F\.?\s?(?:2d|3d|4th)|F\.?\s?App'?x|F\.?\s?Supp\.?(?:\s?(?:2d|3d))?|B\.?R\.?|T\.?C\.?|F\.?\s?R\.?\s?D\.?|Fed\.?\s?Cl\.?|M\.?J\.?|Vet\.?\s?App\.?|Ct\.?\s?Cl\.?|A\.?(?:2d|3d)|P\.?(?:2d|3d)|N\.?E\.?(?:2d|3d)|N\.?W\.?(?:2d|3d)|S\.?E\.?(?:2d|3d)|S\.?W\.?(?:2d|3d)|So\.?(?:\s?(?:2d|3d))?|Cal\.?\s?(?:App\.?\s?)?(?:2d|3d|4th|5th)|N\.?Y\.?(?:2d|3d)|Ill\.?\s?(?:App\.?\s?)?(?:2d|3d))\s+\d{1,5}\b/g },
  { kind: "westlaw", label: "unreported citation",
    re: /\b(?:19|20)\d{2}\s+(?:WL|U\.?S\.?\s?App\.?\s?LEXIS|U\.?S\.?\s?Dist\.?\s?LEXIS)\s+\d{3,9}\b/g },
  { kind: "case_name", label: "case name",
    re: /\b(?:[A-Z][\w.'’&-]*\.?(?:\s+(?:of|the|and|for|de|da|do)\b)?\s*){1,5}\sv\.?\s(?:[A-Z][\w.'’&-]*\.?(?:\s+(?:of|the|and|for|de|da|do)\b)?\s*){1,5}/g },
  { kind: "us_code", label: "statute",
    re: /\b\d{1,2}\s+U\.?\s?S\.?\s?C\.?\s*(?:§+\s*)?\d[\w().-]*/g },
  { kind: "cfr", label: "regulation",
    re: /\b\d{1,2}\s+C\.?\s?F\.?\s?R\.?\s*(?:§+\s*)?\d[\w().-]*/g },
  { kind: "fed_rule", label: "rule",
    re: /\bFed\.?\s?R\.?\s?(?:Civ|Crim|Evid|App|Bankr)\.?\s?P\.?\s*\d+(?:\([a-z0-9]+\))*/gi },
  { kind: "eu_instrument", label: "EU instrument",
    re: /\b(?:Regulation|Directive)\s+\((?:EU|EC)\)\s+(?:No\s+)?\d{2,4}\/\d{2,4}\b/g },
  { kind: "eu_case", label: "EU case number",
    re: /\bCase\s+[CTF]-\d{1,4}\/\d{2}\b/g },
  { kind: "br_lei", label: "Brazilian statute",
    re: /\b(?:Lei|Decreto|Medida Provisória|LC)\s*(?:Complementar\s*)?n?[ºo°.]?\s*[\d.]{3,12}(?:\/\d{2,4})?/gi },
  { kind: "br_precedent", label: "Brazilian precedent",
    re: /\b(?:S[úu]mula(?:\s+Vinculante)?|REsp|AgRg|RE|ARE|HC|ADI|ADC|ADPF|AI|AgInt)\s*n?[ºo°.]?\s*[\d.]{2,12}(?:\/[A-Z]{2})?/g },
  { kind: "br_artigo", label: "article reference",
    re: /\bart(?:igo|\.)\s*\d{1,4}\s*[ºo°]?(?:\s*,\s*(?:§|inciso|caput|par[áa]grafo)[^,.;]{0,18})?/gi }
];

/* Case-name matching is deliberately loose, so a few ordinary sentences get through.
   Anything that reads as a sentence rather than a caption is dropped here. */
const NOT_A_CASE_NAME = /\b(?:versus the|v\. the (?:same|above|following)|i|we|you|they|it)\b/i;
/* Citation signals sit in front of the caption and are not part of it. */
const CITE_SIGNALS = /^(?:but\s+)?(?:see(?:\s+also|\s+generally)?|cf|accord|compare|contra|citing|quoting|e\.?g|in|per|from|under|the case of|as in|such as|like|read)\b[\s.,:;]*/i;
function trimCaseName(raw) {
  let out = String(raw).trim();
  for (let i = 0; i < 3; i++) {
    const next = out.replace(CITE_SIGNALS, "").trim();
    if (next === out || !next) break;
    out = next;
  }
  // A period followed by a capital ends the caption, unless the word before it is one of the
  // abbreviations captions actually use. "Roe v. Wade. The court held" must not become a case.
  const re = /\.\s+(?=[A-Z])/g;
  let m;
  while ((m = re.exec(out)) !== null) {
    const before = out.slice(0, m.index).split(/[\s(]/).pop().replace(/[^A-Za-z'’.]/g, "");
    if (before.toLowerCase() === "v") continue;
    if (CAPTION_ABBREV.has(before.toLowerCase())) continue;
    out = out.slice(0, m.index);
    break;
  }
  out = out.replace(/\s+(?:v\.?|of|the|and|for|de|da|do)$/i, "").trim();
  return /\sv\.?\s/i.test(out) ? out : String(raw).trim();
}
const CAPTION_ABBREV = new Set(["inc","corp","co","ltd","llc","llp","plc","bros","assn","ass'n",
  "ass’n","dept","dep't","dep’t","univ","nat'l","nat’l","int'l","int’l","mfg","sys","tech","servs",
  "serv","comm'n","comm’n","bd","st","mt","jr","sr","no","u.s","n.y","n.j","cal","tex","fla","pa",
  "va","mass","ill","mich","ga","md","mo","minn","wis","colo","ariz","conn","okla","ark","kan",
  "neb","nev","del","ohio","ky","la","ala","tenn","ore","wash","haw","idaho","ind","iowa","utah",
  "vt","wyo","s.a","ltda","cia","s/a"]);

function extractAuthorities(text) {
  const t = str(text);
  const seen = new Set();
  const out = [];
  for (const shape of CITATION_SHAPES) {
    const re = new RegExp(shape.re.source, shape.re.flags);
    let m;
    while ((m = re.exec(t)) !== null) {
      let raw = m[0].trim().replace(/[,;.\s]+$/, "");
      if (!raw || raw.length < 4) continue;
      if (shape.kind === "case_name") {
        raw = trimCaseName(raw);
        if (NOT_A_CASE_NAME.test(raw)) continue;
      }
      const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: shape.kind, label: shape.label, text: raw, at: m.index });
      if (out.length >= 200) return out;
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/* Six reasons the gate can attach. Any one of them is enough. */
const GATE18_TRIGGERS = {
  court_material: "Court or filing material is present.",
  legal_analysis: "The task is legal analysis.",
  authority_request: "The prompt asks for authorities, citations, or case law.",
  authorities_named: "The prompt already names authorities that would carry into the filing.",
  filing_verb: "The prompt describes preparing something for filing or service.",
  declared: "You marked this work as heading for a filing."
};
const FILING_VERBS = /\b(file|filing|filed|serve|service of process|submit to the court|petition|motion|brief|pleading|memorandum of law|declaration|affidavit|protocol\w*|peticion\w+|ajuiz\w+)\b/i;

function gate18Applies(opts) {
  const o = opts || {};
  const classes = arr(o.classes).map(normalizeClass);
  const text = str(o.text);
  const triggers = [];
  if (classes.includes("c5_court_filing")) triggers.push("court_material");
  if (o.taskType === "legal_analysis") triggers.push("legal_analysis");
  if (AUTHORITY_HINTS.test(text)) triggers.push("authority_request");
  const authorities = extractAuthorities(text);
  if (authorities.length) triggers.push("authorities_named");
  if (FILING_VERBS.test(text)) triggers.push("filing_verb");
  if (o.declaredFiling) triggers.push("declared");
  return {
    applies: triggers.length > 0,
    triggers,
    why: triggers.map(t => GATE18_TRIGGERS[t]),
    authorities
  };
}

/* One block of questions per authority. Phrased as things a person does, not as fields. */
const AUTHORITY_STEPS = [
  { id: "exists", ask: "Found it in a primary source. Record where." },
  { id: "pincite", ask: "The page or paragraph cited actually says what it is cited for." },
  { id: "quote", ask: "Every quoted word matches the source exactly." },
  { id: "good_law", ask: "Still good law. Not reversed, vacated, superseded, or overruled." },
  { id: "fits", ask: "Court, jurisdiction, and date fit the forum this is going to." }
];
/* Closing questions about the document as a whole. */
const DOCUMENT_STEPS = [
  { id: "complete", ask: "Every authority in the finished document appears on this list." },
  { id: "unchanged", ask: "No authority was added or changed after this list was generated." },
  { id: "quotes_swept", ask: "Every quotation in the document was checked, including ones without a citation." },
  { id: "read", ask: "I read the finished document myself, start to finish." }
];

function verificationId(ref, ts) {
  return "V-" + str(ref || "unref").replace(/[^A-Za-z0-9_-]/g, "") + "-" + String(ts || 0);
}

function buildVerificationChecklist(opts) {
  const o = opts || {};
  const ts = Number.isFinite(o.ts) ? o.ts : Date.now();
  const found = arr(o.authorities).length ? arr(o.authorities) : extractAuthorities(o.text);
  return {
    kind: "verification_checklist",
    version: 1,
    id: verificationId(o.ref, ts),
    ref: o.ref || null,
    created_ts: ts,
    engine_version: ENGINE_VERSION,
    destination: o.destination
      ? { system: o.destination.system, model: o.destination.model,
          label: str(o.destination.systemLabel || o.destination.system) + " " +
                 str(o.destination.modelLabel || o.destination.model) }
      : null,
    triggers: arr(o.triggers),
    why: arr(o.why),
    matter: str(o.matter || ""),
    verifier: str(o.verifier || ""),
    started_ts: null,
    closed_ts: null,
    minutes: null,
    items: found.map((a, i) => ({
      n: i + 1, kind: a.kind, label: a.label, text: a.text,
      steps: AUTHORITY_STEPS.map(s => ({ id: s.id, ask: s.ask, done: false, note: "" }))
    })),
    document: DOCUMENT_STEPS.map(s => ({ id: s.id, ask: s.ask, done: false, note: "" }))
  };
}

function verificationSummary(cl) {
  const c = cl || {};
  const items = arr(c.items);
  const doc = arr(c.document);
  let total = doc.length, done = doc.filter(s => s.done).length;
  let itemsDone = 0;
  for (const it of items) {
    const steps = arr(it.steps);
    total += steps.length;
    const d = steps.filter(s => s.done).length;
    done += d;
    if (steps.length && d === steps.length) itemsDone++;
  }
  const outstanding = total - done;
  return {
    authorities: items.length,
    authorities_cleared: itemsDone,
    steps_total: total,
    steps_done: done,
    outstanding,
    complete: total > 0 && outstanding === 0,
    minutes: Number.isFinite(c.minutes) ? c.minutes : null
  };
}

function elapsedMinutes(startTs, endTs) {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs < startTs) return null;
  return Math.round(((endTs - startTs) / 60000) * 10) / 10;
}

function closeVerification(cl, ts) {
  const at = Number.isFinite(ts) ? ts : Date.now();
  const next = Object.assign({}, cl || {});
  next.closed_ts = at;
  next.minutes = elapsedMinutes(next.started_ts, at);
  return next;
}

function fmtTs(ts) {
  if (!Number.isFinite(ts)) return "not recorded";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function renderVerificationChecklist(cl) {
  const c = cl || {};
  const s = verificationSummary(c);
  const L = [];
  L.push("# Verification checklist");
  L.push("");
  L.push("This list exists because the work you are about to sign was drafted with help from an AI system.");
  L.push("Nothing on it can be checked by software. Each line is a thing a person has to do and then say they did.");
  L.push("");
  L.push("Reference: " + (c.id || "unassigned"));
  if (c.ref) L.push("Prompt record: " + c.ref);
  L.push("Generated: " + fmtTs(c.created_ts));
  if (c.destination && c.destination.label) L.push("Drafted with: " + c.destination.label);
  if (c.matter) L.push("Matter: " + c.matter);
  L.push("Verified by: " + (c.verifier || "________________________"));
  L.push("Started: " + (Number.isFinite(c.started_ts) ? fmtTs(c.started_ts) : "________________"));
  L.push("Finished: " + (Number.isFinite(c.closed_ts) ? fmtTs(c.closed_ts) : "________________"));
  L.push("Time spent: " + (Number.isFinite(c.minutes) ? c.minutes + " minutes" : "________________"));
  L.push("");
  if (arr(c.why).length) {
    L.push("## Why this checklist was generated");
    L.push("");
    for (const w of arr(c.why)) L.push("- " + w);
    L.push("");
  }
  L.push("## Authorities to check");
  L.push("");
  if (!arr(c.items).length) {
    L.push("No citation-shaped text was found in the prompt. That does not mean the finished document has none.");
    L.push("If the model returns authorities, add them here by hand before signing.");
    L.push("");
  }
  for (const it of arr(c.items)) {
    L.push(String(it.n) + ". " + it.text + "  (" + it.label + ")");
    for (const st of arr(it.steps)) {
      L.push("   [" + (st.done ? "x" : " ") + "] " + st.ask + (st.note ? "  Note: " + st.note : ""));
    }
    L.push("");
  }
  L.push("## The document as a whole");
  L.push("");
  for (const st of arr(c.document)) {
    L.push("[" + (st.done ? "x" : " ") + "] " + st.ask + (st.note ? "  Note: " + st.note : ""));
  }
  L.push("");
  L.push("## Status");
  L.push("");
  L.push("Authorities listed: " + s.authorities + ". Fully cleared: " + s.authorities_cleared + ".");
  L.push("Checks done: " + s.steps_done + " of " + s.steps_total + ". Outstanding: " + s.outstanding + ".");
  L.push(s.complete
    ? "This checklist is closed. The signature below is the record."
    : "This checklist is open. Do not file while anything above is unchecked.");
  L.push("");
  L.push("Signature: ________________________    Date: ______________");
  L.push("");
  L.push("The person who signs is responsible for the contents of the filing. This list records that the check happened. It is not itself a check.");
  return L.join("\n");
}

function makeVerificationEntry(opts) {
  const o = opts || {};
  const cl = o.checklist || {};
  const s = verificationSummary(cl);
  const e = {
    type: "verification",
    id: o.id,
    ts: o.ts,
    engine_version: ENGINE_VERSION,
    ref: cl.ref || o.ref || undefined,
    verification_id: cl.id,
    event: str(o.event || "generated"),
    triggers: arr(cl.triggers),
    authorities: s.authorities,
    authorities_cleared: s.authorities_cleared,
    steps_total: s.steps_total,
    steps_done: s.steps_done,
    outstanding: s.outstanding,
    complete: s.complete,
    started_ts: Number.isFinite(cl.started_ts) ? cl.started_ts : undefined,
    closed_ts: Number.isFinite(cl.closed_ts) ? cl.closed_ts : undefined,
    minutes: Number.isFinite(cl.minutes) ? cl.minutes : undefined,
    checklist_hash: o.checklistHash || undefined,
    dest_system: cl.destination ? cl.destination.system : undefined,
    dest_model: cl.destination ? cl.destination.model : undefined
  };
  Object.keys(e).forEach(k => e[k] === undefined && delete e[k]);
  return e;
}

/* The verification tax. Time spent checking AI output is the real cost of using it, and it is
   invisible unless something counts it. This reads the ledger and says what the checking cost. */
function verificationTax(events) {
  const closed = arr(events).filter(e => e && e.type === "verification" &&
    e.event === "closed" && Number.isFinite(e.minutes));
  const open = arr(events).filter(e => e && e.type === "verification" &&
    e.event === "generated").length;
  const minutes = closed.map(e => e.minutes).sort((a, b) => a - b);
  const total = minutes.reduce((a, b) => a + b, 0);
  const authorities = closed.reduce((a, e) => a + (Number(e.authorities) || 0), 0);
  const round = (n) => Math.round(n * 10) / 10;
  return {
    checklists_generated: open,
    checklists_closed: closed.length,
    total_minutes: round(total),
    median_minutes: minutes.length
      ? round(minutes.length % 2
          ? minutes[(minutes.length - 1) / 2]
          : (minutes[minutes.length / 2 - 1] + minutes[minutes.length / 2]) / 2)
      : null,
    mean_minutes: minutes.length ? round(total / minutes.length) : null,
    authorities_checked: authorities,
    minutes_per_authority: authorities ? round(total / authorities) : null
  };
}

/* ---------- the register as data ----------
   The register was a document that the app quoted. These read it as a table, so a person can
   see every row, its status, what it permits, and how old its intake is, without opening a file
   they may not have. */
function registerRows(registerSnapshot, now) {
  const snap = registerSnapshot || {};
  const at = Number.isFinite(now) ? now : Date.now();
  const months = Number.isFinite(snap.intake_valid_months) ? snap.intake_valid_months : 12;
  const rows = [];
  const shape = (key, r, isSelf) => {
    const intake = r && r.intake_date;
    const parsed = intake ? Date.parse(String(intake) + "T00:00:00Z") : NaN;
    const ageMonths = Number.isFinite(parsed) ? Math.round(((at - parsed) / (30.44 * 86400000)) * 10) / 10 : null;
    return {
      key,
      self: !!isSelf,
      row: (r && r.row) || null,
      label: (r && r.label) || key,
      status: (r && r.status) || "PENDING INTAKE",
      usable: ["APPROVED", "RESTRICTED"].includes(str(r && r.status).toUpperCase()),
      intake_date: intake || null,
      intake_age_months: ageMonths,
      intake_current: ageMonths === null ? false : ageMonths <= months,
      harness: (r && r.harness) || null,
      max_class: (r && r.max_class) || null,
      permitted: arr(r && r.permitted).map(normalizeClass),
      conditional: arr(r && r.conditional).map(normalizeClass),
      barred: arr(r && r.barred).map(normalizeClass),
      note: (r && r.note) || null,
      open_items: arr(r && r.open_items)
    };
  };
  if (snap.self) rows.push(shape("self", snap.self, true));
  const dests = snap.destinations || {};
  for (const k of Object.keys(dests)) rows.push(shape(k, dests[k], false));
  return rows;
}

function registerRowFor(registerSnapshot, system) {
  const dests = (registerSnapshot && registerSnapshot.destinations) || {};
  const r = dests[system];
  if (!r) return null;
  return Object.assign({ row: r.row }, r);
}

function registerSummary(registerSnapshot, now) {
  const at = Number.isFinite(now) ? now : Date.now();
  const rows = registerRows(registerSnapshot, at);
  const age = registerAgeDays(registerSnapshot, at);
  return {
    as_of: (registerSnapshot && registerSnapshot.as_of) || null,
    age_days: age,
    stale: age === null || age > REGISTER_STALE_DAYS,
    stale_after_days: REGISTER_STALE_DAYS,
    rows: rows.length,
    usable: rows.filter(r => r.usable).length,
    intake_expired: rows.filter(r => r.usable && !r.intake_current).map(r => r.label),
    open_items: rows.reduce((a, r) => a + r.open_items.length, 0)
  };
}

/* ---------- rubric tier 1 (deterministic) ---------- */
const IMPERATIVE_HINTS = /\b(write|draft|produce|analyze|analyze|summarize|summarize|list|explain|compare|create|generate|review|extract|translate|rewrite|design|build|answer|research|find|outline|classify|evaluate|redija|escreva|produza|analise|resuma|explique|compare|crie|gere|revise|extraia|traduza|desenhe|responda|pesquise|encontre|liste)\b/i;
/* "authority" in the citation sense, not the regulator sense. A legal team asks which
   authorities supervise a counterparty all day long, and that is not a request for case law. */
const AUTHORITY_HINTS = /\b(cite|citation|case law|caselaw|statute|precedent|court|ruling|holding|jurisprud|acórd|súmula|lei n|artigo \d|(?:legal|binding|persuasive|controlling|supporting|primary|secondary|relevant|adverse|contrary) authorit|authorit(?:y|ies) (?:for|on point|supporting|to cite|holding|establishing)|cit\w+ authorit)/i;
const VERIFY_HINTS = /\b(verif|check .*source|primary source|confirm .*(cite|citation|source)|do not fabricate|only real|fonte primária|verifiq)/i;

function rubricTier1(fields, interpretation, destination, registerSnapshot, now, posture, options18) {
  const checks = [];
  const at = Number.isFinite(now) ? now : Date.now();
  const stance = POSTURES.includes(posture) ? posture : DEFAULT_POSTURE;
  const task = (fields.task && fields.task.content) || "";
  const all = assembled(fields);

  // R1: task states a deliverable
  if (!task.trim()) checks.push({ id:"R1_task", level:"flag", msg:"No Task content. A prompt without a stated deliverable drifts." });
  else if (!IMPERATIVE_HINTS.test(task)) checks.push({ id:"R1_task", level:"flag", msg:"Task may lack a clear deliverable verb. Say what to produce." });
  else checks.push({ id:"R1_task", level:"pass", msg:"Task states a deliverable." });

  // R2: legal analysis wants a Role
  if (interpretation.task_type === "legal_analysis" && !(fields.role && fields.role.include)) {
    checks.push({ id:"R2_legal_role", level:"flag", msg:"Legal analysis without a Role invites generic, hedged answers. Consider adding the persona back." });
  } else {
    checks.push({ id:"R2_legal_role", level:"pass", msg:"Role posture fits the task type." });
  }

  // R3: authority requests must carry a verification instruction.
  // Court and filing material triggers it on its own: the pre-filing duty attaches to the
  // filing, not to whether the wording happened to sound like a citation request.
  const declared = (interpretation.data_flags && interpretation.data_flags.classes) || [];
  if (AUTHORITY_HINTS.test(all) || interpretation.task_type === "legal_analysis" ||
      declared.map(normalizeClass).includes("c5_court_filing")) {
    if (VERIFY_HINTS.test(all)) checks.push({ id:"R3_verify", level:"pass", msg:"Prompt instructs source verification." });
    else checks.push({ id:"R3_verify", level:"flag", msg:"This prompt asks for authorities but never demands verifiable sources. Add a line like: cite only real, checkable sources; every authority will be independently verified." });
  } else {
    checks.push({ id:"R3_verify", level:"pass", msg:"No authority request detected." });
  }

  // R4: declared classes against the posture, the subject, and the destination ceiling
  const classes = ((interpretation.data_flags && interpretation.data_flags.classes) || []).map(normalizeClass);
  const subject = normalizeSubject(interpretation.data_subject);
  const ceiling = registerSnapshot && registerSnapshot.destinations && registerSnapshot.destinations[destination.system];
  const verdict = evaluateClasses(classes, subject, stance);
  if (verdict.blocking.length) {
    const first = verdict.outcomes.find(o => o.level === "block");
    checks.push({ id:"R4_class", level:"block",
      msg: (first.basis === "hard_bar"
        ? "Credential-shaped content detected. C7 never enters any AI surface. Remove it."
        : classLabel(first.class) + " detected, and " + stance + " posture stops it. " +
          "Redact the identifying material and let the check run again, or stop.") });
  } else if (verdict.warning.length) {
    checks.push({ id:"R4_class", level:"flag",
      msg: verdict.warning.map(classLabel).join(", ") + " detected" +
        (subject === "self" ? ", about you" : "") + ". " +
        (ceiling && ceiling.max_class === "C2"
          ? "The register caps " + (destination.systemLabel || destination.system) +
            " at C1/C2 (as of " + (registerSnapshot.as_of || "snapshot") + "). Reroute or de-identify."
          : "Recorded with your decision.") });
  } else if (classes.includes(UNVERIFIED_CLASS)) {
    checks.push({ id:"R4_class", level:"flag", msg:"The classification did not come back cleanly, so this prompt is unclassified. Treat it as sensitive until you have checked it yourself." });
  } else if (classes.length && ceiling && ceiling.max_class === "C2") {
    checks.push({ id:"R4_class", level:"flag", msg:"Sensitive material flagged, and the register caps " + (destination.systemLabel || destination.system) + " at C1/C2 (as of " + (registerSnapshot.as_of || "snapshot") + "). Reroute or de-identify." });
  } else {
    checks.push({ id:"R4_class", level:"pass", msg:"No data-class conflict with the chosen destination." });
  }

  // R5: secrets scan on the assembled prompt
  const secrets = scanSecrets(all);
  if (secrets.length) checks.push({ id:"R5_secrets", level:"block", msg:"Secret-shaped content in the assembled prompt (" + secrets.join(", ") + "). Blocked." });
  else checks.push({ id:"R5_secrets", level:"pass", msg:"No secret-shaped content." });

  // R7: the tool intake gate, run against the destination's own row
  const destRow = registerSnapshot && registerSnapshot.destinations && registerSnapshot.destinations[destination.system];
  const gate = gate17(destRow ? Object.assign({ row: destRow.row }, destRow) : null, classes, {
    now: at, reliedOn: interpretation.task_type === "legal_analysis",
    intakeValidMonths: registerSnapshot && registerSnapshot.intake_valid_months
  });
  if (gate.pass) {
    checks.push({ id:"R7_gate17", level:"pass", msg:"Tool intake gate passes for this destination and class." });
  } else {
    const hard = gate.failures.some(f => f.condition === "class_permitted" || f.condition === "no_credentials");
    checks.push({ id:"R7_gate17", level: hard ? "block" : "flag",
      msg:"Tool intake gate: " + gate.failures.map(f => f.why).join(" ") });
  }

  // R8: the pre-filing verification gate. It reports, it never blocks: a person can be
  // drafting something that will never be filed, and the app cannot know that. What it can do
  // is say the gate attached and whether a checklist has been closed for this prompt.
  const g18 = gate18Applies({
    classes, taskType: interpretation.task_type, text: all,
    declaredFiling: !!(interpretation.data_flags && interpretation.data_flags.for_filing)
  });
  if (!g18.applies) {
    checks.push({ id:"R8_gate18", level:"pass", msg:"No filing or authority signal. No verification checklist required." });
  } else {
    const state = str((options18 && options18.verification) || "none");
    if (state === "closed") {
      checks.push({ id:"R8_gate18", level:"pass", msg:"Verification checklist closed for this prompt." });
    } else {
      checks.push({ id:"R8_gate18", level:"flag",
        msg: g18.why.join(" ") + " Every authority has to be checked against a primary source before this is signed or filed. " +
          (g18.authorities.length
            ? "Generate the checklist. " + g18.authorities.length + " citation" + (g18.authorities.length === 1 ? "" : "s") + " to check so far."
            : "Generate the checklist, then add the authorities the model returns.") });
    }
  }

  // R9: the regulation watch. Julio's choice on lapse was to degrade rather than block: an
  // out-of-date watch means you know less about whether a control still holds, and that belongs
  // on the prompt, not in the way of it.
  const watch = options18 && options18.watch;
  if (!watch) {
    checks.push({ id:"R9_watch", level:"pass", msg:"No watch state to check." });
  } else if (watch.overdue) {
    const worst = watch.worst;
    checks.push({ id:"R9_watch", level:"flag",
      msg: watch.overdue + " of the sources this app watches " + (watch.overdue === 1 ? "has" : "have") +
        " gone past their interval" +
        (worst ? ", the oldest being " + worst.what + (worst.state === "never" ? ", never checked" : ", " + worst.overdue_by + " days over") : "") +
        ". The rules behind these checks may have moved since anyone last looked." });
  } else if (watch.changed) {
    checks.push({ id:"R9_watch", level:"flag",
      msg: watch.changed + " watched source" + (watch.changed === 1 ? " has" : "s have") +
        " changed since the last look. Read what moved before relying on a control that rests on it." });
  } else {
    checks.push({ id:"R9_watch", level:"pass", msg:"Every watched source is inside its interval." });
  }

  // R6: the register snapshot states its own shelf life. Enforce it rather than printing it.
  const age = registerAgeDays(registerSnapshot, at);
  if (age === null) {
    checks.push({ id:"R6_register", level:"flag", msg:"The destination register snapshot carries no usable date, so its ceilings cannot be treated as current." });
  } else if (age > REGISTER_STALE_DAYS) {
    checks.push({ id:"R6_register", level:"flag", msg:"The register snapshot is " + age + " days old, past the " + REGISTER_STALE_DAYS + "-day rule the file states about itself. Regenerate it before relying on any destination ceiling." });
  } else {
    checks.push({ id:"R6_register", level:"pass", msg:"Register snapshot is " + age + " days old, inside its own " + REGISTER_STALE_DAYS + "-day rule." });
  }

  return checks;
}

/* ---------- translation manual matching ---------- */
function normalizeForMatch(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
}
function manualMatches(idea, manualEntries, max) {
  const n = normalizeForMatch(idea);
  const words = new Set(n.split(" ").filter(w => w.length > 2));
  const scored = [];
  for (const e of manualEntries || []) {
    const p = normalizeForMatch(e.pattern);
    if (!p) continue;
    if (n.includes(p)) { scored.push({ e, s: 100 + p.length }); continue; }
    const pw = p.split(" ").filter(w => w.length > 2);
    if (!pw.length) continue;
    const overlap = pw.filter(w => words.has(w)).length / pw.length;
    if (overlap >= 0.6) scored.push({ e, s: overlap * 10 });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, max || 3).map(x => x.e);
}

/* ---------- ledger entry shaping ---------- */
function classifyForStorage(interpretation) {
  const classes = (interpretation.data_flags && interpretation.data_flags.classes) || [];
  return classes.length ? "sensitive" : "plain";
}
/* The transferable rule from each field, kept so the repeated-lesson ranking has a source.
   Only the rule of thumb is stored, never the task-specific reasoning, because the rule is
   generic by construction and the reasoning is not. */
function lessonsFrom(fields) {
  const out = [];
  for (const k of FIELD_ORDER) {
    const f = fields && fields[k];
    const lesson = f && f.rationale && str(f.rationale.lesson).trim();
    if (lesson) out.push({ field: k, verdict: str(f.rationale.verdict), lesson });
  }
  return out;
}
function makeLedgerEntry(opts) {
  const e = {
    type: "generation",
    id: opts.id,
    ts: opts.ts,
    engine_version: ENGINE_VERSION,
    register_as_of: opts.registerAsOf || undefined,
    idea: opts.storeRaw ? opts.idea : undefined,
    idea_hash: opts.ideaHash,
    idea_chars: (opts.idea || "").length,
    storage_mode: opts.storeRaw ? "raw" : "hash_only",
    dest_system: opts.destination && opts.destination.system,
    dest_model: opts.destination && opts.destination.model,
    recommended: opts.recommended ? { system: opts.recommended.system, model: opts.recommended.model, source: opts.recommended.source } : null,
    overridden: !!opts.overridden,
    contested: opts.contested || undefined,
    context_meta: opts.context_meta || undefined,
    task_type: opts.interpretation && opts.interpretation.task_type,
    data_classes: ((opts.interpretation && opts.interpretation.data_flags && opts.interpretation.data_flags.classes) || []).map(normalizeClass),
    data_subject: opts.interpretation ? normalizeSubject(opts.interpretation.data_subject) : "unknown",
    classified_by: opts.classifiedBy || undefined,
    posture: opts.posture || undefined,
    lessons: opts.storeLessons === false ? undefined : lessonsFrom(opts.fields),
    interpret: {
      /* v3 has one workflow with progressive disclosure, so there is no density to
         record. The field is not written at all rather than written as a constant,
         because a constant would read as a real choice to anything counting them
         later (Contracts §18). Historical v2 entries keep whatever they recorded;
         `OUTCOME_FACTORS.full_form` still reads those. */
      questions: (opts.interpretation && opts.interpretation.questions || []).length,
      corrections: opts.corrections || 0,
      learnings_applied: (opts.interpretation && opts.interpretation.applied_learnings || []).length
    },
    fields_included: FIELD_ORDER.filter(k => opts.fields[k] && opts.fields[k].include),
    rubric: (opts.rubric || []).map(c => ({ id: c.id, level: c.level })),
    status: "generated",
    outcome: null
  };
  // Rework makes a version. The prompt it came from keeps its own entry and its own hash.
  Object.assign(e, versionFields(opts.parentEntry));
  Object.keys(e).forEach(k => e[k] === undefined && delete e[k]);
  return e;
}

/* ---------- Batch F: learning from the record ----------
   Every generated prompt already stores the transferable rule from each field. Stored and never
   read, that is just disk. Read across months, the rules that keep coming back are the things
   this person keeps getting wrong, which is the only honest definition of a curriculum here.

   Two rules govern everything below. Nothing claims cause. Nothing claims significance. A count
   is reported as a count, with how many it is out of, and the language never gets stronger than
   the sample supports. */

const LESSON_STOPWORDS = new Set(["a","an","and","are","as","at","be","but","by","для","for","from",
  "in","into","is","it","its","of","on","or","so","that","the","their","them","then","there","these",
  "they","this","to","was","were","what","when","which","who","will","with","you","your"]);

/* A deliberately crude stem. "state", "states" and "stating" are the same instruction, and
   without this the same rule written twice would count as two different weaknesses. */
function lessonStem(word) {
  let w = String(word);
  if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + "y";
  else if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
  else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 4 && /ly$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 4 && /es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && /(.)\1$/.test(w)) w = w.slice(0, -1);
  return w;
}
function lessonKey(text) {
  const words = str(text).toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !LESSON_STOPWORDS.has(w))
    .map(lessonStem);
  // The key is the sorted stemmed content words, so two phrasings of one rule land together.
  return Array.from(new Set(words)).sort().join(" ");
}

/* How sure the app is allowed to sound. It never gets to sound sure. */
const CONFIDENCE_BANDS = [
  { min: 0,  band: "too few",  words: "too few to say anything" },
  { min: 5,  band: "a hint",   words: "a hint, not a finding" },
  { min: 15, band: "a pattern", words: "a pattern worth noticing" }
];
function confidenceFor(n) {
  let out = CONFIDENCE_BANDS[0];
  for (const b of CONFIDENCE_BANDS) if (n >= b.min) out = b;
  return out;
}

/* The ledger is append-only, so a verdict recorded a week after the prompt is a separate line.
   Reading the record means folding those back on, latest wins. Nothing is rewritten on disk. */
function foldOutcomes(events) {
  const gens = new Map();
  for (const e of arr(events)) {
    if (!e || e.type !== "generation" || !e.ts) continue;
    const prior = gens.get(e.id);
    if (!prior || Number(e.ts) > Number(prior.ts)) gens.set(e.id, Object.assign({}, e, { outcome: null, outcome_ts: null }));
  }
  for (const e of arr(events)) {
    if (!e || e.type !== "outcome") continue;
    const g = gens.get(e.ref);
    if (!g) continue;
    if (g.outcome_ts === null || Number(e.ts) >= Number(g.outcome_ts)) {
      g.outcome = str(e.verdict) || null;
      g.outcome_ts = Number(e.ts) || null;
      g.failed_fields = arr(e.failed_fields);
    }
  }
  return Array.from(gens.values()).sort((a, b) => Number(a.ts) - Number(b.ts));
}
function generationEvents(events) {
  const list = arr(events);
  // Already folded (outcome is a string or null on every entry) or raw. Detect and handle both.
  const hasOutcomeEvents = list.some(e => e && e.type === "outcome");
  if (hasOutcomeEvents) return foldOutcomes(list);
  return list.filter(e => e && e.type === "generation" && e.ts);
}

/* A lesson is fading when it shows up less in the recent half of its own span than the older
   half. That is weak evidence and is labelled as such, but it is the difference between
   "you keep doing this" and "you used to do this". */
/* The horizon is the last prompt in the log, not today. A fortnight away from the app is not
   evidence that anything was learned, and reading it that way would flatter the user. */
function lessonTrend(timestamps, horizon) {
  const ts = arr(timestamps).filter(Number.isFinite).sort((a, b) => a - b);
  if (ts.length < 4) return { trend: "too few", why: "not enough occurrences to see a direction" };
  const at = Number.isFinite(horizon) ? horizon : ts[ts.length - 1];
  const start = ts[0];
  const mid = start + (at - start) / 2;
  const older = ts.filter(t => t < mid).length;
  const recent = ts.length - older;
  if (recent === 0) return { trend: "gone", why: "it has not come back in the recent half" };
  if (recent < older * 0.6) return { trend: "fading", why: "less often lately than it used to be" };
  if (recent > older * 1.6) return { trend: "growing", why: "more often lately than it used to be" };
  return { trend: "steady", why: "about as often lately as before" };
}

function rankLessons(events, options) {
  const o = options || {};
  const gens = generationEvents(events);
  const horizon = gens.length ? Math.max.apply(null, gens.map(e => e.ts)) : null;
  const buckets = new Map();
  for (const e of gens) {
    const seenHere = new Set();
    for (const l of arr(e.lessons)) {
      const text = str(l && l.lesson).trim();
      if (!text) continue;
      const key = lessonKey(text);
      if (!key || seenHere.has(key)) continue; // one prompt counts once for a rule
      seenHere.add(key);
      if (!buckets.has(key)) {
        buckets.set(key, { key, text, variants: new Set([text]), count: 0, ts: [],
          fields: {}, outcomes: { worked: 0, partly: 0, failed: 0, none: 0 } });
      }
      const b = buckets.get(key);
      b.count++;
      b.ts.push(e.ts);
      b.variants.add(text);
      // Keep the shortest phrasing: it is usually the cleanest statement of the rule.
      if (text.length < b.text.length) b.text = text;
      const f = str(l.field);
      if (f) b.fields[f] = (b.fields[f] || 0) + 1;
      const outcome = str(e.outcome);
      if (outcome === "worked" || outcome === "partly" || outcome === "failed") b.outcomes[outcome]++;
      else b.outcomes.none++;
    }
  }
  const out = [];
  for (const b of buckets.values()) {
    const trend = lessonTrend(b.ts, horizon);
    const sorted = b.ts.slice().sort((x, y) => x - y);
    out.push({
      key: b.key,
      text: b.text,
      variants: Array.from(b.variants).slice(0, 5),
      count: b.count,
      share: gens.length ? Math.round((b.count / gens.length) * 1000) / 10 : 0,
      first_ts: sorted[0],
      last_ts: sorted[sorted.length - 1],
      fields: Object.keys(b.fields).sort((x, y) => b.fields[y] - b.fields[x]),
      outcomes: b.outcomes,
      trend: trend.trend,
      trend_why: trend.why,
      confidence: confidenceFor(b.count).band
    });
  }
  out.sort((a, b) => b.count - a.count || b.last_ts - a.last_ts);
  return {
    prompts: gens.length,
    distinct_lessons: out.length,
    lessons: out.slice(0, Number.isFinite(o.max) ? o.max : 40)
  };
}

/* The curriculum. Not everything that repeats: the things that repeat and are not going away. */
function curriculum(events, options) {
  const o = options || {};
  const ranked = rankLessons(events, o);
  const min = Number.isFinite(o.minCount) ? o.minCount : 3;
  const picked = ranked.lessons
    .filter(l => l.count >= min && l.trend !== "fading" && l.trend !== "gone")
    .slice(0, Number.isFinite(o.max) ? o.max : 5);
  return {
    prompts: ranked.prompts,
    distinct_lessons: ranked.distinct_lessons,
    items: picked.map((l, i) => ({
      rank: i + 1,
      text: l.text,
      count: l.count,
      of: ranked.prompts,
      fields: l.fields,
      trend: l.trend,
      confidence: l.confidence,
      line: "“" + l.text + "” came up in " + l.count + " of your " + ranked.prompts +
        " prompts" + (l.fields.length ? ", mostly under " + FIELD_LABELS[l.fields[0]] : "") + ". " +
        (l.trend === "growing" ? "More often lately than before." : "About as often lately as before.")
    })),
    enough_data: ranked.prompts >= 10,
    note: ranked.prompts >= 10
      ? "This is your own record, nothing else. It says what keeps coming back, not why."
      : "Too few prompts to say much yet. Come back after a few weeks of real work."
  };
}

/* ---------- outcome correlation ----------
   Only entries you actually evaluated count. A factor is reported as: of the prompts where this
   was true, this many worked. Never as: this makes prompts work. */
const OUTCOME_FACTORS = [
  { id: "field_role",     label: "a Role was included",        test: e => arr(e.fields_included).includes("role") },
  { id: "field_context",  label: "Context was included",       test: e => arr(e.fields_included).includes("context") },
  { id: "field_examples", label: "Examples were included",     test: e => arr(e.fields_included).includes("examples") },
  { id: "field_format",   label: "a Format was specified",     test: e => arr(e.fields_included).includes("format") },
  { id: "field_constraints", label: "Constraints were included", test: e => arr(e.fields_included).includes("constraints") },
  { id: "answered_questions", label: "you answered the questions it asked",
    test: e => (e.interpret && Number(e.interpret.questions) > 0) },
  { id: "corrected", label: "you corrected the interpretation before generating",
    test: e => (e.interpret && Number(e.interpret.corrections) > 0) },
  /* Historical only. v2 recorded which of its two interpretation densities was used;
     v3 has one workflow and writes no density, so this factor is never true for a v3
     entry and reads only what v2 already wrote. It is kept so a learning report over
     a migrated ledger still explains the correlation it found. */
  { id: "full_form", label: "you used the full interpretation form",
    test: e => (e.interpret && e.interpret.mode === "omode") },
  { id: "clean_rubric", label: "the checks came back clean",
    test: e => arr(e.rubric).every(c => c.level === "pass") },
  { id: "took_recommendation", label: "you took the recommended destination",
    test: e => e.overridden === false }
];

function outcomeCorrelation(events, options) {
  const o = options || {};
  const evaluated = generationEvents(events)
    .filter(e => ["worked", "partly", "failed"].includes(str(e.outcome)));
  const rate = (list) => {
    const n = list.length;
    if (!n) return { n: 0, worked: 0, rate: null };
    const worked = list.filter(e => e.outcome === "worked").length;
    return { n, worked, rate: Math.round((worked / n) * 1000) / 10 };
  };
  const baseline = rate(evaluated);
  const factors = [];
  for (const f of OUTCOME_FACTORS) {
    const yes = evaluated.filter(e => { try { return !!f.test(e); } catch { return false; } });
    const no = evaluated.filter(e => { try { return !f.test(e); } catch { return true; } });
    const y = rate(yes), n = rate(no);
    const gap = (y.rate !== null && n.rate !== null) ? Math.round((y.rate - n.rate) * 10) / 10 : null;
    const smaller = Math.min(y.n, n.n);
    factors.push({
      id: f.id, label: f.label,
      with: y, without: n, gap,
      confidence: confidenceFor(smaller).band,
      line: y.n === 0
        ? "Never happened yet."
        : (n.n === 0
            ? "Always true, so there is nothing to compare it against."
            : "When " + f.label + ", " + y.worked + " of " + y.n + " worked. When not, " +
              n.worked + " of " + n.n + ". " + confidenceFor(smaller).words + ".")
    });
  }
  // Factors that cannot be compared at all sink to the bottom rather than leading the list.
  factors.sort((a, b) => {
    const usable = (f) => (f.gap !== null && f.with.n > 0 && f.without.n > 0) ? 1 : 0;
    if (usable(a) !== usable(b)) return usable(b) - usable(a);
    return (b.gap || 0) - (a.gap || 0);
  });
  return {
    evaluated: evaluated.length,
    unevaluated: generationEvents(events).length - evaluated.length,
    baseline,
    factors: Number.isFinite(o.max) ? factors.slice(0, o.max) : factors,
    caveat: "These are counts from your own log. They show what happened alongside what, never what caused what. " +
      "Small numbers move a lot for no reason."
  };
}

/* Everything the learning view needs, in one call, so the renderer holds no analysis of its own. */
function learningReport(events, options) {
  const o = options || {};
  const now = Number.isFinite(o.now) ? o.now : Date.now();
  const gens = generationEvents(events);
  const evaluated = gens.filter(e => ["worked", "partly", "failed"].includes(str(e.outcome))).length;
  const span = gens.length
    ? Math.max(1, Math.round((now - Math.min(...gens.map(e => e.ts))) / 86400000))
    : 0;
  return {
    prompts: gens.length,
    evaluated,
    span_days: span,
    curriculum: curriculum(events, { now, max: o.max || 5 }),
    lessons: rankLessons(events, { now, max: o.maxLessons || 12 }).lessons,
    correlation: outcomeCorrelation(events, { max: o.maxFactors || 6 }),
    verification: verificationTax(events)
  };
}

/* ---------- Batch G: managed configuration and firm reporting ----------
   Two things a firm needs before it will let a tool near client material: the ability to set the
   floor and the ability to see that the floor held. Both are built here on one principle, which
   is that the firm gets counts and never contents. */

const MANAGED_VERSION = 1;
const REPORT_MODES = ["off", "folder"];

/* A managed profile can raise the floor. It cannot lower a choice the person made for
   themselves. A firm that could push Light onto someone who chose Strict would be using the
   management channel to weaken protection, which is the opposite of why it exists. */
function effectivePosture(userChoice, managed) {
  const user = POSTURES.includes(userChoice) ? userChoice : DEFAULT_POSTURE;
  const m = managed && managed.posture;
  const floor = m && POSTURES.includes(m.value) ? m.value : null;
  if (!floor) return { posture: user, locked: false, source: "you", floor: null };
  const rank = (p) => POSTURES.indexOf(p);
  const chosen = rank(user) >= rank(floor) ? user : floor;
  return {
    posture: chosen,
    // Locked means the control cannot go below the floor. It can always go above it.
    locked: !!m.locked,
    source: chosen === floor && rank(user) < rank(floor) ? "your organization" : "you",
    floor,
    floor_label: floor
  };
}

function normalizeManaged(raw) {
  const r = raw && typeof raw === "object" ? raw : null;
  if (!r) return null;
  if (Number(r.version) !== MANAGED_VERSION) {
    return { version: MANAGED_VERSION, invalid: true,
      why: "The managed profile is version " + str(r.version) + ", which this build does not read. Nothing from it was applied." };
  }
  const mode = str(r.reporting && r.reporting.mode).toLowerCase();
  return {
    version: MANAGED_VERSION,
    invalid: false,
    organization: str(r.organization).slice(0, 120),
    contact: str(r.contact).slice(0, 200),
    posture: r.posture && POSTURES.includes(str(r.posture.value))
      ? { value: str(r.posture.value), locked: !!r.posture.locked }
      : null,
    destinations: Array.isArray(r.destinations && r.destinations.allow)
      ? { allow: r.destinations.allow.map(x => str(x).slice(0, 40)).filter(Boolean),
          locked: !!r.destinations.locked }
      : null,
    matter_list: r.matter_list && str(r.matter_list.path)
      ? { path: str(r.matter_list.path).slice(0, 500), locked: !!r.matter_list.locked }
      : null,
    /* Role and practice group are administrator-set and appear nowhere in the interface. If the
       person could edit them the filter would be self-reported, and a filter nobody can trust is
       worse than no filter, because it still gets used. */
    role: ROLES.includes(str(r.role).toLowerCase()) ? str(r.role).toLowerCase() : null,
    practice_group: str(r.practice_group).slice(0, 80) || null,
    reporting: {
      mode: REPORT_MODES.includes(mode) ? mode : "off",
      path: str(r.reporting && r.reporting.path).slice(0, 500),
      /* The one deliberate exception to counts-only. Off unless the firm turns it on. */
      curriculum: !!(r.reporting && r.reporting.curriculum),
      interval_hours: Number.isFinite(Number(r.reporting && r.reporting.interval_hours))
        ? Math.max(1, Math.min(720, Math.round(Number(r.reporting.interval_hours)))) : 24
    }
  };
}

/* Roles are a fixed vocabulary. A free-text role would fragment the cohort into groups of one,
   which the floor would then suppress, which would read as a bug rather than as a protection.
   The list covers a firm and an in-house department, and it covers the people who are not
   lawyers: a legal assistant, a legal operations manager and a records or IT administrator all
   write prompts, and a cohort built only from fee earners would miss most of the building. */
const ROLES = [
  "partner",           // equity and non-equity
  "counsel",           // of counsel, senior counsel, in-house counsel
  "associate",
  "paralegal",
  "legal_assistant",   // legal secretary, practice assistant
  "legal_operations",  // legal ops, knowledge management, practice innovation
  "administration"     // business services: finance, IT, HR, marketing, records
];
const ROLE_LABELS = {
  partner: "Partners",
  counsel: "Counsel",
  associate: "Associates",
  paralegal: "Paralegals",
  legal_assistant: "Legal assistants",
  legal_operations: "Legal operations",
  administration: "Administration"
};
function roleLabel(v) { return ROLE_LABELS[str(v)] || str(v).replace(/_/g, " "); }

/* What the firm is allowed to be told, stated as an allowlist rather than a denylist, because a
   denylist quietly leaks whatever nobody thought of. */
const REPORT_FIELDS = [
  "schema", "generated_at", "organization", "period_start", "period_end", "engine_version",
  "prompts", "by_destination", "by_class", "by_posture", "blocked", "overrides_by_tier",
  "redactions", "verification", "register", "ledger", "device_id",
  "role", "practice_group", "curriculum", "posture_floor"
];
const REPORT_FORBIDDEN = /idea|prompt_text|content|lesson|matter|client|citation|authority_text|note|reason_text|token|value|caption|verifier/i;

/* The single exception, written as exact paths rather than as a hole in the pattern.
   One field on one node carries model-written text off the device. Everything else that reads
   like free text is still a defect, including the sibling fields on the very same node.
   The per-input `because` string has no path here and cannot acquire one without editing this
   list, which is the whole point of stating it as a list. */
const REPORT_TEXT_ALLOW = [
  "curriculum.items.#.text"
];
/* Array indices carry no meaning for this check, so they collapse to one symbol and a rule
   written once covers every element. */
function reportPath(path) {
  return path.map(p => /^\d+$/.test(String(p)) ? "#" : p).join(".");
}

function bump(map, key) {
  const k = str(key) || "unknown";
  map[k] = (map[k] || 0) + 1;
}

/* The curriculum as the firm sees it. Same ranking the person sees, with two things removed and
   one added. Removed: the rendered sentence, which restates the text a second time, and the
   variant phrasings, which are more text for no more meaning. Added: how many of the occurrences
   came from a prompt whose idea was withheld for carrying client or privileged material.
   That count exists because a lesson drawn from a withheld prompt is the case the exception has
   to answer for, and an exception nobody can measure cannot honestly be disclosed. */
function curriculumForReport(events, options) {
  const o = options || {};
  const base = curriculum(events, o);
  const gens = generationEvents(arr(events).filter(Boolean));
  const withheldByKey = new Map();
  let withheldPrompts = 0;
  for (const e of gens) {
    if (str(e.storage_mode) !== "hash_only") continue;
    withheldPrompts++;
    const seen = new Set();
    for (const l of arr(e.lessons)) {
      const k = lessonKey(str(l && l.lesson).trim());
      if (!k || seen.has(k)) continue;
      seen.add(k);
      withheldByKey.set(k, (withheldByKey.get(k) || 0) + 1);
    }
  }
  return {
    prompts: base.prompts,
    distinct_lessons: base.distinct_lessons,
    withheld_prompts: withheldPrompts,
    items: base.items.map(it => ({
      rank: it.rank,
      text: it.text,
      count: it.count,
      of: it.of,
      fields: it.fields,
      trend: it.trend,
      confidence: it.confidence,
      from_withheld: withheldByKey.get(lessonKey(it.text)) || 0
    }))
  };
}

function buildFirmReport(events, options) {
  const o = options || {};
  const all = arr(events).filter(Boolean);
  const gens = generationEvents(all);
  const since = Number.isFinite(o.since) ? o.since : 0;
  const inWindow = gens.filter(e => Number(e.ts) >= since);
  const byDestination = {}, byClass = {}, byPosture = {};
  let blocked = 0;
  for (const e of inWindow) {
    bump(byDestination, e.dest_system);
    bump(byPosture, e.posture);
    for (const c of arr(e.data_classes)) bump(byClass, c);
    if (arr(e.rubric).some(c => c.level === "block")) blocked++;
  }
  const overrides = {};
  for (const e of all) {
    if (!e || e.type !== "override" || Number(e.ts) < since) continue;
    bump(overrides, e.tier);
  }
  const redactions = all.filter(e => e && e.type === "redaction" && Number(e.ts) >= since);
  const verification = verificationTax(all.filter(e => Number(e.ts) >= since));
  const chain = o.chain || null;
  const report = {
    schema: "omono.firm-report.v1",
    generated_at: new Date(Number.isFinite(o.now) ? o.now : Date.now()).toISOString(),
    organization: str(o.organization) || null,
    period_start: since ? new Date(since).toISOString() : null,
    period_end: new Date(Number.isFinite(o.now) ? o.now : Date.now()).toISOString(),
    engine_version: ENGINE_VERSION,
    device_id: str(o.deviceId) || null,
    role: ROLES.includes(str(o.role)) ? str(o.role) : null,
    practice_group: str(o.practiceGroup).slice(0, 80) || null,
    /* The floor the managed profile set on this machine. Without it a reader cannot tell whether
       a spread of postures is people choosing freely or a profile failing to apply. */
    posture_floor: POSTURES.includes(str(o.postureFloor))
      ? { level: str(o.postureFloor), locked: !!o.postureLocked } : null,
    prompts: inWindow.length,
    by_destination: byDestination,
    by_class: byClass,
    by_posture: byPosture,
    blocked,
    overrides_by_tier: overrides,
    redactions: {
      events: redactions.length,
      substitutions: redactions.reduce((a, e) => a + (Number(e.substitutions) || 0), 0)
    },
    verification: {
      checklists_generated: verification.checklists_generated,
      checklists_closed: verification.checklists_closed,
      authorities_checked: verification.authorities_checked,
      total_minutes: verification.total_minutes
    },
    register: o.register ? {
      as_of: o.register.as_of, age_days: o.register.age_days, stale: o.register.stale,
      rows: o.register.rows, usable: o.register.usable,
      intake_expired: o.register.intake_expired.length
    } : null,
    ledger: chain ? { ok: !!chain.ok, checked: chain.checked, breaks: arr(chain.breaks).length,
      head: str(chain.head).slice(0, 16) } : null,
    /* Absent unless the firm turned it on. An absent key and an empty key say different things,
       and a reader of the file should be able to tell which firm made which choice. */
    curriculum: o.curriculum ? curriculumForReport(inWindow, { minCount: o.minCount, max: o.maxLessons }) : null
  };
  return report;
}

/* Fails closed. If a future change adds a field carrying content, this refuses to hand over the
   report rather than quietly widening what leaves the machine. */
function assertReportSafe(report) {
  const problems = [];
  const walk = (node, path) => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      const dotted = reportPath(path);
      if (REPORT_TEXT_ALLOW.includes(dotted)) return;
      if (path.length > 1 && REPORT_FORBIDDEN.test(path[path.length - 1])) {
        problems.push(dotted + " looks like content, not a count");
      }
      return;
    }
    if (typeof node !== "object") return;
    for (const k of Object.keys(node)) {
      if (path.length === 0 && !REPORT_FIELDS.includes(k)) {
        problems.push(k + " is not on the list of things the firm is told");
      }
      walk(node[k], path.concat(k));
    }
  };
  walk(report, []);
  // Class keys are counts; their names are vocabulary, not content. Everything else that reads
  // like free text is a defect.
  return { safe: problems.length === 0, problems };
}

function renderFirmReport(report) {
  const L = [];
  L.push("O'Mono use report");
  L.push("");
  if (report.organization) L.push("Organization: " + report.organization);
  if (report.device_id) L.push("Device: " + report.device_id);
  L.push("Period: " + (report.period_start ? report.period_start.slice(0, 10) : "all time") +
    " to " + report.period_end.slice(0, 10));
  L.push("");
  L.push("Prompts generated: " + report.prompts);
  L.push("Stopped by a check: " + report.blocked);
  const dest = Object.keys(report.by_destination);
  L.push("Destinations used: " + (dest.length ? dest.map(d => d + " " + report.by_destination[d]).join(", ") : "none"));
  const cls = Object.keys(report.by_class);
  L.push("Sensitive material flagged: " + (cls.length ? cls.map(c => classLabel(c) + " " + report.by_class[c]).join(", ") : "none"));
  L.push("Redactions applied: " + report.redactions.events + " (" + report.redactions.substitutions + " substitutions)");
  const ov = Object.keys(report.overrides_by_tier);
  L.push("Overrides: " + (ov.length ? ov.map(t => t + " " + report.overrides_by_tier[t]).join(", ") : "none"));
  L.push("Verification checklists: " + report.verification.checklists_generated + " generated, " +
    report.verification.checklists_closed + " closed, " + report.verification.authorities_checked +
    " authorities checked, " + report.verification.total_minutes + " minutes spent");
  if (report.register) {
    L.push("Tool register: " + report.register.usable + " of " + report.register.rows + " rows usable, snapshot " +
      report.register.age_days + " days old" + (report.register.stale ? " and stale" : "") +
      (report.register.intake_expired ? ", " + report.register.intake_expired + " with expired intake" : ""));
  }
  if (report.ledger) {
    L.push("Record integrity: " + (report.ledger.ok ? "intact" : "BROKEN, " + report.ledger.breaks + " entries do not verify") +
      " across " + report.ledger.checked + " entries");
  }
  L.push("");
  L.push("This report contains counts only. No prompt text, no client or matter name, no citation, no");
  L.push("redacted value and no note ever leaves the device. Nothing here can be read back into the work.");
  return L.join("\n");
}

/* ---------- the five additions ---------- */

/* 1. Installation and upgrade are events. A record that starts at the first prompt cannot show
   when the tool arrived, which version wrote which entry, or that nothing preceded it. */
function makeInstallEntry(opts) {
  const o = opts || {};
  return {
    type: "install", id: "install-" + o.ts, ts: o.ts,
    engine_version: ENGINE_VERSION, engine_date: ENGINE_DATE,
    app_version: str(o.appVersion) || null,
    platform: str(o.platform) || null,
    device_id: str(o.deviceId) || null,
    managed: !!o.managed,
    organization: o.managed ? (str(o.organization) || null) : null
  };
}
function makeUpgradeEntry(opts) {
  const o = opts || {};
  return {
    type: "upgrade", id: "upgrade-" + o.ts, ts: o.ts,
    from_engine: str(o.from) || null, to_engine: ENGINE_VERSION,
    app_version: str(o.appVersion) || null
  };
}

/* 2. Rework makes a version, not a replacement. The old prompt stays in the record with its own
   hash; the new one says which one it came from. Without this the ledger shows the last thing
   you thought, and none of the thinking. */
function versionFields(parentEntry) {
  if (!parentEntry) return { version: 1, parent_id: undefined, root_id: undefined };
  const parentVersion = Number(parentEntry.version) || 1;
  return {
    version: parentVersion + 1,
    parent_id: parentEntry.id,
    root_id: parentEntry.root_id || parentEntry.id
  };
}
function versionChain(events, id) {
  const byId = new Map();
  for (const e of arr(events)) if (e && e.type === "generation" && e.id) byId.set(e.id, e);
  const start = byId.get(id);
  if (!start) return { chain: [], position: 0, total: 0 };
  const root = start.root_id || start.id;
  const chain = Array.from(byId.values())
    .filter(e => (e.root_id || e.id) === root)
    .sort((a, b) => (Number(a.version) || 1) - (Number(b.version) || 1));
  return {
    chain: chain.map(e => ({ id: e.id, ts: e.ts, version: Number(e.version) || 1,
      dest_system: e.dest_system, dest_model: e.dest_model, outcome: e.outcome || null })),
    position: chain.findIndex(e => e.id === id) + 1,
    total: chain.length,
    root
  };
}

/* 3. Offline is a real state with real consequences, and the honest thing is to name which
   controls still hold and which simply are not running. */
const OFFLINE_CAPABILITIES = {
  works: [
    "The local screen. Passwords, keys, client names, matter numbers and case numbers are still caught before anything is sent, because that check never needed a network.",
    "The matter list, which lives only on this Mac.",
    "Redaction and restoration, both of which run here.",
    "The record, its hash chain, and everything you have already generated.",
    "The verification checklist, which is a list for a person and needs nothing."
  ],
  does_not: [
    "Reading your idea back to you and asking what it cannot infer. That is a model call.",
    "Writing the prompt. That is also a model call.",
    "Checking whether the tool register or any regulation has moved."
  ],
  meaning: "You can still be stopped from sending something you should not send. You cannot have a prompt written for you until the network is back."
};
function offlineReport(online) {
  return Object.assign({ online: !!online }, OFFLINE_CAPABILITIES, {
    headline: online ? "Connected." : "No network. The controls still run. The writing does not."
  });
}

/* ---------- the regulation and terms watch ----------
   A control written against the law of 2026 quietly becomes a control written against nothing.
   The watch does not read the law. It counts days since a person last looked, names what has
   gone unlooked-at too long, and for pages that can be fetched, tells you the page moved.

   Two kinds of check, because two kinds of source. A vendor page has a stable address and can be
   diffed. "What are the AI rules where I work" has no address at all, so the honest check is a
   reminder to go and look, with room to write down what was found. */
const WATCH_KINDS = ["diff", "search", "internal"];
const WATCH_DEFAULTS = [
  { id: "eu_ai_act", what: "EU AI Act, application dates", kind: "diff",
    source: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj", days: 15 },
  { id: "anthropic_terms", what: "Anthropic Commercial Terms", kind: "diff",
    source: "https://www.anthropic.com/legal/commercial-terms", days: 15 },
  { id: "anthropic_privacy", what: "Anthropic privacy policy", kind: "diff",
    source: "https://privacy.claude.com", days: 15 },
  { id: "api_retention", what: "API data retention and Covered Models", kind: "diff",
    source: "https://platform.claude.com/docs", days: 15 },
  { id: "aba_512", what: "ABA Model Rules and Opinion 512", kind: "diff",
    source: "https://www.americanbar.org", days: 15 },
  { id: "cppa_admt", what: "CCPA and CPPA automated decision-making regulations", kind: "diff",
    source: "https://cppa.ca.gov", days: 15 },
  { id: "workplace_rules", what: "AI and data governance rules where you work, in your state and country",
    kind: "search", source: "No single page. Ask your firm, your state bar, and the regulator that covers your work.",
    days: 90 },
  { id: "r11_intake", what: "O'Mono's own register row and its intake age", kind: "internal",
    source: "the register in this app", days: 365 },
  { id: "register_snapshot", what: "Register snapshot age", kind: "internal",
    source: "the register in this app", days: 60 }
];

function normalizeWatchRows(rows) {
  const list = arr(rows).length ? arr(rows) : WATCH_DEFAULTS;
  return list.map((r, i) => ({
    id: str(r.id) || ("watch" + i),
    what: str(r.what).slice(0, 200),
    kind: WATCH_KINDS.includes(str(r.kind)) ? str(r.kind) : "search",
    source: str(r.source).slice(0, 500),
    days: Math.max(1, Math.min(3650, Number(r.days) || 90))
  })).filter(r => r.what);
}

function watchStatus(rows, state, now) {
  const at = Number.isFinite(now) ? now : Date.now();
  const st = (state && typeof state === "object") ? state : {};
  return normalizeWatchRows(rows).map(r => {
    const rec = st[r.id] || {};
    const last = Number(rec.last_checked) || null;
    const since = last === null ? null : Math.floor((at - last) / 86400000);
    const overdueBy = since === null ? null : since - r.days;
    return Object.assign({}, r, {
      last_checked: last,
      last_result: str(rec.last_result) || null,
      last_note: str(rec.note) || null,
      changed_at: Number(rec.changed_at) || null,
      days_since: since,
      state: last === null ? "never" : (overdueBy > 0 ? "overdue" : "current"),
      overdue_by: overdueBy !== null && overdueBy > 0 ? overdueBy : 0,
      due_in: overdueBy !== null && overdueBy <= 0 ? -overdueBy : 0,
      line: last === null
        ? "Never checked. Due every " + r.days + " days."
        : (overdueBy > 0
            ? "Last looked at " + since + " days ago, which is " + overdueBy + " days past the " + r.days + "-day interval."
            : "Checked " + since + " days ago. Next due in " + (-overdueBy) + " days.")
    });
  });
}

function watchSummary(rows, state, now) {
  const list = watchStatus(rows, state, now);
  const overdue = list.filter(r => r.state === "overdue" || r.state === "never");
  const changed = list.filter(r => r.changed_at && (!r.last_checked || r.changed_at >= r.last_checked));
  return {
    total: list.length,
    overdue: overdue.length,
    never: list.filter(r => r.state === "never").length,
    changed: changed.length,
    worst: overdue.sort((a, b) => (b.overdue_by || 0) - (a.overdue_by || 0))[0] || null,
    rows: list,
    // Julio's choice on lapse: degrade rather than block. An out-of-date watch is a reason to
    // know less about whether a control still holds, not a reason to stop working.
    effect: overdue.length
      ? "Prompts still run. The record notes that " + overdue.length +
        " source" + (overdue.length === 1 ? " has" : "s have") + " gone unchecked past their interval."
      : "Everything on the watch has been looked at inside its interval."
  };
}

/* When a page has moved, O'Mono does what O'Mono does: it writes the prompt for finding out what
   moved. It does not summarize the law itself, because that would be the tool asserting a legal
   conclusion, which is the one thing it must never do. */
function watchChangePrompt(row, meta) {
  const m = meta || {};
  return {
    role: "You are a regulatory analyst reading a primary source for a lawyer who will rely on your reading.",
    task: "Identify exactly what changed on this page and what, if anything, it requires a small legal practice using AI tools to do differently.",
    context: "Source: " + str(row.source) + ". Watched as: " + str(row.what) + ". " +
      "A content change was detected on " + (m.changed_at ? new Date(m.changed_at).toISOString().slice(0, 10) : "an unrecorded date") +
      (m.previous_seen ? ", against a version last seen on " + new Date(m.previous_seen).toISOString().slice(0, 10) : "") + ".",
    constraints: "Quote the changed text. Cite the article, section or paragraph. If you cannot see the previous version, say so and describe only the current text. Do not infer an effective date that is not written on the page. Do not give legal advice. State plainly what remains uncertain.",
    format: "1. What the page now says, quoted. 2. What it appears to have replaced, or a statement that you cannot see it. 3. Dates that are actually written on the page. 4. What a practice would have to check next. 5. What you could not determine.",
    note: "O'Mono detected a change and wrote this prompt. It has not read the page and has no view on what the change means."
  };
}

/* ---------- ledger chain integrity ---------- */
/* Canonical serialization: object keys sorted at every depth so the same content always
   hashes to the same value. The main process writes with this and the verifier reads with
   it; one implementation, no drift. */
function canonicalize(obj) {
  const sorted = (v) => {
    if (Array.isArray(v)) return v.map(sorted);
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v).sort()) o[k] = sorted(v[k]);
      return o;
    }
    return v;
  };
  return JSON.stringify(sorted(obj));
}

/* Re-walks an append-ordered event list and recomputes every link.
   hashFn(string) -> hex digest, supplied by the caller so the engine stays dependency-free. */
function verifyChain(events, hashFn) {
  const breaks = [];
  let prev = "";
  let checked = 0;
  for (const e of (events || [])) {
    if (!e || typeof e !== "object") {
      breaks.push({ index: checked, id: null, ts: null, reason: "unreadable entry" });
      checked++;
      continue;
    }
    const body = { ...e };
    delete body.hash;
    delete body.prev_hash;
    const expected = hashFn(prev + canonicalize(body));
    if (str(e.prev_hash) !== prev) {
      breaks.push({ index: checked, id: e.id || e.ref || null, ts: e.ts || null,
        reason: "does not follow the entry above it" });
    } else if (str(e.hash) !== expected) {
      breaks.push({ index: checked, id: e.id || e.ref || null, ts: e.ts || null,
        reason: "contents changed after it was written" });
    }
    prev = str(e.hash);
    checked++;
  }
  return {
    ok: breaks.length === 0,
    checked,
    breaks,
    first_break: breaks.length ? breaks[0] : null,
    head: prev
  };
}

/* ---------- the firm view ----------
   A cohort is a folder. One file per person, and the count of distinct people is the count of
   files, because there is no user model and adding one would turn the record into a personnel
   file. Nothing in this section can name a person or reach a device: the merge drops every
   device id on the way in, and there is no setting that puts one back.

   The floor is fixed in code rather than configurable, so a firm cannot lower it on the day it
   becomes inconvenient. Note what a floor of two actually buys: in a cohort of exactly two, a
   member who subtracts their own numbers reads the other member exactly. Two suppresses the
   cohort of one and nothing beyond that. */
const FIRM_FLOOR = 2;
const FIRM_VIEW_NAME = "Firm Curriculum";

function cell() { return { count: 0, people: new Set() }; }
function bumpCell(map, key, person, n) {
  const k = str(key) || "unknown";
  if (!map[k]) map[k] = cell();
  map[k].count += Number.isFinite(n) ? n : 1;
  map[k].people.add(person);
}
/* Every cell answers the floor for itself. A total that clears the floor says nothing about a
   category inside it that only one person ever touched, and that category is exactly the one a
   reader would try to put a name to. */
function seal(map) {
  const out = {};
  for (const k of Object.keys(map)) {
    const c = map[k];
    out[k] = c.people.size >= FIRM_FLOOR
      ? { count: c.count, people: c.people.size, shown: true }
      : { shown: false, why: "fewer than " + FIRM_FLOOR + " people" };
  }
  return out;
}

function mergeFirmReports(reports, options) {
  const o = options || {};
  const files = arr(reports).filter(r => r && typeof r === "object");
  const bad = files.filter(r => str(r.schema) !== "omono.firm-report.v1");
  const good = files.filter(r => str(r.schema) === "omono.firm-report.v1");

  /* Identity inside the merge is the file, never the device id, and the id does not survive into
     the result. Two reports from one machine would count once and that is the correct answer for
     a per-person view. */
  const idOf = (r, i) => str(r.device_id) || "file-" + i;
  const people = new Set(good.map(idOf));

  const byClass = {}, byDestination = {}, byPosture = {}, byRole = {}, byGroup = {}, overrides = {};
  let prompts = 0, blocked = 0, redactionEvents = 0, substitutions = 0;
  let checklists = 0, closed = 0, authorities = 0, minutes = 0;
  let ledgerOk = 0, ledgerBroken = 0, ledgerUnknown = 0;
  let withCurriculum = 0, withheldPrompts = 0;
  const floors = {};
  let belowFloor = 0, floorLocked = 0, withFloor = 0;
  let periodStart = null, periodEnd = null;
  const versions = {};

  good.forEach((r, i) => {
    const p = idOf(r, i);
    prompts += Number(r.prompts) || 0;
    blocked += Number(r.blocked) || 0;
    bump(versions, r.engine_version);
    for (const k of Object.keys(r.by_class || {})) bumpCell(byClass, k, p, r.by_class[k]);
    for (const k of Object.keys(r.by_destination || {})) bumpCell(byDestination, k, p, r.by_destination[k]);
    for (const k of Object.keys(r.by_posture || {})) bumpCell(byPosture, k, p, r.by_posture[k]);
    for (const k of Object.keys(r.overrides_by_tier || {})) bumpCell(overrides, k, p, r.overrides_by_tier[k]);
    if (r.role) bumpCell(byRole, r.role, p, Number(r.prompts) || 0);
    if (r.practice_group) bumpCell(byGroup, r.practice_group, p, Number(r.prompts) || 0);
    redactionEvents += Number(r.redactions && r.redactions.events) || 0;
    substitutions += Number(r.redactions && r.redactions.substitutions) || 0;
    checklists += Number(r.verification && r.verification.checklists_generated) || 0;
    closed += Number(r.verification && r.verification.checklists_closed) || 0;
    authorities += Number(r.verification && r.verification.authorities_checked) || 0;
    minutes += Number(r.verification && r.verification.total_minutes) || 0;
    if (!r.ledger) ledgerUnknown++;
    else if (r.ledger.ok) ledgerOk++;
    else ledgerBroken++;
    if (r.curriculum) { withCurriculum++; withheldPrompts += Number(r.curriculum.withheld_prompts) || 0; }
    const pf = r.posture_floor;
    if (pf && POSTURES.includes(str(pf.level))) {
      withFloor++;
      bump(floors, pf.level);
      if (pf.locked) floorLocked++;
      /* A prompt written below the floor is not a person disobeying. It is a report written
         before the profile arrived, or a profile that did not apply. Either way it is the number
         an administrator actually wants, and it is the one nobody thinks to ask for. */
      const rank = POSTURES.indexOf(str(pf.level));
      for (const k of Object.keys(r.by_posture || {})) {
        if (POSTURES.indexOf(k) > -1 && POSTURES.indexOf(k) < rank) belowFloor += r.by_posture[k];
      }
    }
    if (r.period_start && (!periodStart || r.period_start < periodStart)) periodStart = r.period_start;
    if (r.period_end && (!periodEnd || r.period_end > periodEnd)) periodEnd = r.period_end;
  });

  /* The weakness map is the eight prompt fields and nothing else. It is a prompt-anatomy map
     rather than a map of legal skill, and a reader who expects the second will misread it. */
  const fieldWeight = {};
  /* The curriculum merges on the stemmed key, so two people who wrote the same rule in different
     words count as the same rule. The text kept is the shortest phrasing anyone produced. */
  const lessons = new Map();
  good.forEach((r, i) => {
    const p = idOf(r, i);
    for (const it of arr(r.curriculum && r.curriculum.items)) {
      const text = str(it.text).trim();
      const key = lessonKey(text);
      if (!key) continue;
      if (!lessons.has(key)) {
        lessons.set(key, { key, text, count: 0, people: new Set(), fields: {},
          trends: {}, from_withheld: 0 });
      }
      const b = lessons.get(key);
      if (text.length < b.text.length) b.text = text;
      b.count += Number(it.count) || 0;
      b.people.add(p);
      b.from_withheld += Number(it.from_withheld) || 0;
      for (const f of arr(it.fields)) {
        b.fields[f] = (b.fields[f] || 0) + 1;
        /* The field cell has to carry the people who actually met the rule. Counting the cohort
           as one contributor would put every field below the floor and read as an empty map. */
        bumpCell(fieldWeight, f, p, Number(it.count) || 0);
      }
      if (it.trend) b.trends[it.trend] = (b.trends[it.trend] || 0) + 1;
    }
  });
  const ranked = Array.from(lessons.values())
    .map(b => ({
      text: b.text,
      count: b.count,
      people: b.people.size,
      fields: Object.keys(b.fields).sort((x, y) => b.fields[y] - b.fields[x]),
      trend: Object.keys(b.trends).sort((x, y) => b.trends[y] - b.trends[x])[0] || "steady",
      from_withheld: b.from_withheld,
      shown: b.people.size >= FIRM_FLOOR
    }))
    .sort((a, b) => b.people - a.people || b.count - a.count);
  const shownLessons = ranked.filter(l => l.shown);
  const suppressed = ranked.length - shownLessons.length;

  const enough = people.size >= FIRM_FLOOR;
  return {
    schema: "omono.firm-cohort.v1",
    view: FIRM_VIEW_NAME,
    generated_at: new Date(Number.isFinite(o.now) ? o.now : Date.now()).toISOString(),
    organization: str(o.organization) || str(good[0] && good[0].organization) || null,
    floor: FIRM_FLOOR,
    people: people.size,
    files_read: files.length,
    files_rejected: bad.length,
    enough,
    /* An empty panel says why it is empty. A panel that renders a partial result instead is the
       failure this floor exists to prevent. */
    why_empty: enough ? null : "This cohort has " + people.size + " " +
      (people.size === 1 ? "person" : "people") + ". Nothing renders below " + FIRM_FLOOR + ".",
    period_start: periodStart,
    period_end: periodEnd,
    engine_versions: versions,
    prompts: enough ? prompts : null,
    blocked: enough ? blocked : null,
    by_class: enough ? seal(byClass) : {},
    by_destination: enough ? seal(byDestination) : {},
    by_posture: enough ? seal(byPosture) : {},
    overrides_by_tier: enough ? seal(overrides) : {},
    by_role: enough ? seal(byRole) : {},
    by_practice_group: enough ? seal(byGroup) : {},
    posture_floor: withFloor ? {
      /* One value only when every machine agrees. Two firms' profiles in one folder is a fact
         about the folder, and hiding it behind the commonest value would be a guess. */
      level: Object.keys(floors).length === 1 ? Object.keys(floors)[0] : null,
      values: floors,
      consistent: Object.keys(floors).length === 1 && withFloor === good.length,
      set_on: withFloor,
      of: good.length,
      locked: floorLocked,
      below_floor_prompts: belowFloor
    } : null,
    redactions: enough ? { events: redactionEvents, substitutions } : null,
    verification: enough
      ? { checklists_generated: checklists, checklists_closed: closed,
          authorities_checked: authorities,
          // Summing fifty already-rounded values reintroduces the float error each one dropped.
          total_minutes: Math.round(minutes * 10) / 10 }
      : null,
    ledger: { intact: ledgerOk, broken: ledgerBroken, not_reported: ledgerUnknown },
    curriculum: {
      reporting: withCurriculum,
      of: good.length,
      items: enough ? shownLessons : [],
      suppressed,
      field_weight: enough ? seal(fieldWeight) : {},
      withheld_prompts: withheldPrompts,
      from_withheld: shownLessons.reduce((a, l) => a + l.from_withheld, 0)
    }
  };
}

/* A cohort report that carried a device id would be a drill-down with extra steps. This refuses
   the render rather than trusting that nobody looks. */
function assertCohortAnonymous(cohort) {
  const problems = [];
  const walk = (node, path) => {
    if (node === null || node === undefined || typeof node !== "object") return;
    for (const k of Object.keys(node)) {
      if (/device|user|person_id|email|hostname|machine/i.test(k)) {
        problems.push(path.concat(k).join(".") + " could identify a person");
      }
      walk(node[k], path.concat(k));
    }
  };
  walk(cohort, []);
  return { safe: problems.length === 0, problems };
}

/* ---------- json plumbing ---------- */
/* Find the first complete object without treating braces inside JSON strings as structure.
   Parsing stays strict. When the model drops punctuation, leaves a string unescaped, or truncates
   the object, the renderer may request one fresh response; this layer never guesses at content. */
function modelFormatError(message, detail) {
  const error = new Error(message);
  error.code = MODEL_FORMAT_ERROR;
  if (detail) error.detail = String(detail);
  return error;
}

function isModelFormatError(error) {
  return !!error && error.code === MODEL_FORMAT_ERROR;
}

function extractJSON(text) {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  let start = -1, depth = 0, inString = false, escaped = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (start === -1) {
      if (ch === "{") { start = i; depth = 1; }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = t.slice(start, i + 1);
        try { return JSON.parse(candidate); }
        catch (error) {
          throw modelFormatError("The model did not return valid JSON.", error.message);
        }
      }
    }
  }
  if (start === -1) throw modelFormatError("The model did not return a JSON object.");
  throw modelFormatError("The model returned an incomplete JSON object.");
}
function str(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }
function arr(v) { return Array.isArray(v) ? v : []; }

const OMonoEngine = {
  ENGINE_VERSION, ENGINE_DATE, FIELD_ORDER, FIELD_LABELS, CONTEXT_SEND_CAP,
  UNVERIFIED_CLASS, REGISTER_STALE_DAYS, registerAgeDays,
  DATA_CLASSES, CLASS_LABELS, CLASS_ALIASES, normalizeClass, classLabel,
  PRESCREEN_PATTERNS, MATTER_KINDS, scanClasses, matchMatters, localScreen, dedupeSpans,
  LABEL_PATTERNS, LABEL_TOKEN, SHAPE_PATTERNS, scanShapes,
  CLASS_PLAIN, plainLabel, NO_PROMOTE, hasRepresentationContext,
  C4_DECLARATIONS, isSelfRegardingAsk, overrideTier, looksLikeExample,
  REDACT_ACTIONS, buildRedactionPlan, applyRedactions, restoreText, defaultRedactAction,
  GATE17_CONDITIONS, gate17, selfGate,
  CITATION_SHAPES, extractAuthorities, GATE18_TRIGGERS, gate18Applies,
  AUTHORITY_STEPS, DOCUMENT_STEPS, buildVerificationChecklist, renderVerificationChecklist,
  verificationSummary, closeVerification, elapsedMinutes, makeVerificationEntry, verificationTax,
  registerRows, registerRowFor, registerSummary,
  WATCH_KINDS, WATCH_DEFAULTS, normalizeWatchRows, watchStatus, watchSummary, watchChangePrompt,
  makeInstallEntry, makeUpgradeEntry, versionFields, versionChain,
  OFFLINE_CAPABILITIES, offlineReport,
  MANAGED_VERSION, REPORT_MODES, REPORT_FIELDS, REPORT_TEXT_ALLOW, ROLES, ROLE_LABELS, roleLabel,
  normalizeManaged, effectivePosture,
  buildFirmReport, assertReportSafe, renderFirmReport, curriculumForReport,
  FIRM_FLOOR, FIRM_VIEW_NAME, mergeFirmReports, assertCohortAnonymous,
  foldOutcomes, lessonKey, lessonStem, lessonTrend, rankLessons, curriculum, confidenceFor, CONFIDENCE_BANDS,
  OUTCOME_FACTORS, outcomeCorrelation, learningReport,
  SUBJECTS, normalizeSubject, detectSubjectLocal, resolveSubject,
  POSTURES, DEFAULT_POSTURE, POSTURE_MATRIX, TIER_MATRIX,
  classOutcome, evaluateClasses, lessonsFrom,
  canonicalize, verifyChain,
  INTERPRET_SYSTEM_PROMPT, GENERATE_SYSTEM_PROMPT, FORMAT_RETRY_INSTRUCTION,
  MODEL_FORMAT_ERROR, modelFormatError, isModelFormatError,
  scanSecrets, secretSpans, truncationNotice,
  buildInterpretMessage, parseInterpretJSON,
  accessibleModels, recommendDestination, resolveRecommendation,
  buildGenerateMessage, parseGenerateJSON,
  assembled, assembledWithReasoning,
  rubricTier1, manualMatches, normalizeForMatch,
  makeLedgerEntry, extractJSON
};

if (typeof module !== "undefined" && module.exports) module.exports = OMonoEngine;
if (typeof window !== "undefined") window.OMonoEngine = OMonoEngine;
