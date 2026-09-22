"use strict";
/* T1: the tool register, keyed by PRODUCT SURFACE, never by brand or bare
 * model — Claude and Claude Cowork are different entries; ChatGPT and
 * Codex are different entries, because the product wraps the model and
 * changes what a good prompt is.
 *
 * The register serves: the tool-first picker (Tool, then Model only where
 * that tool's dossier lists models), the writing engine's per-surface
 * prompt shaping, the verification checks (double_check), the lesson
 * engine's quirk trigger, and the Tools section in Settings. Expiry (three
 * months from checked.date) yields a gentle, bypassable re-check
 * suggestion — never hiding, never blocking. The finished prompt always
 * leaves O'Mono through Copy; nothing here sends anything anywhere.
 *
 * Browser-safe: IIFE, dual export, loader-free. The founding data arrives
 * from founding-dossiers.js (generated, owner-approved source of record).
 */
var OMonoToolRegister = (function () {

  var SURFACE_TYPES = ["chat app", "agent surface", "in-suite copilot",
    "skill-router", "grid-and-chat", "chat-and-agent", "other"];

  var REQUIRED_STRINGS = ["id", "display_name", "maker", "surface_type",
    "good_at", "avoid", "prompt_shaping", "prompt_surfaces", "double_check"];

  /* F4: an engine_profile that names no real profile is not a typo the picker
     can survive. The fallback chain ends at modelProfiles[0], so a dossier
     pointing at a profile that does not exist silently routes every prompt for
     that tool to whatever happens to be first in the engine table — Claude
     Opus 5, for four of the eleven founding dossiers. This module is
     renderer-loadable and loader-free by contract, so it cannot require the
     profile table; the caller passes it, and validation of the reference is
     performed only when it does. */
  function engineProfileResolves(dossier, profiles) {
    var ep = dossier && dossier.engine_profile;
    if (!ep || !ep.system_id || !ep.model_id) return false;
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i] && profiles[i].system_id === ep.system_id
        && profiles[i].model_id === ep.model_id) return true;
    }
    return false;
  }

  function validateDossier(dossier, profiles) {
    var problems = [];
    var d = dossier || {};
    REQUIRED_STRINGS.forEach(function (key) {
      if (typeof d[key] !== "string" || !d[key].trim()) problems.push(key + " is required");
    });
    if (SURFACE_TYPES.indexOf(d.surface_type) === -1) problems.push("surface_type must be one of the six named types or other");
    if (!d.abilities || typeof d.abilities !== "object") problems.push("abilities is required");
    if (!Array.isArray(d.models)) problems.push("models must be a list (empty where the surface offers no user model choice)");
    if (!d.checked || typeof d.checked.date !== "string" || !Array.isArray(d.checked.sources)) {
      problems.push("checked needs a date and a sources list");
    } else if (d.id !== "other-tool" && !d.checked.sources.length) {
      problems.push("every researched dossier carries at least one source");
    }
    if (!d.engine_profile || !d.engine_profile.system_id || !d.engine_profile.model_id) {
      problems.push("engine_profile needs a system_id and a model_id");
    } else if (Array.isArray(profiles) && !engineProfileResolves(d, profiles)) {
      problems.push("engine_profile " + d.engine_profile.system_id + "/"
        + d.engine_profile.model_id + " does not resolve against the engine profile table");
    }
    return { valid: problems.length === 0, problems: problems };
  }

  /* Loader-free by the shared-source contract: the founding data arrives
     on the shared global (script tag in the renderer; an explicit require
     of founding-dossiers.js by node consumers before this call). */
  function founding() {
    var root = (typeof globalThis !== "undefined" && globalThis) || {};
    var f = root.OMonoFoundingDossiers;
    return f && Array.isArray(f.dossiers) ? f.dossiers : [];
  }

  /* Retired models never show. F4: "retiring 2026-08-31" is a retirement with a
     date on it, and the old prefix test on "retired" let every one of them
     through for as long as the vendor kept that wording — Codex offered two
     such models indefinitely. A dated retirement is honoured the day it lands;
     before that day the model is still real and still offered. `today` is an
     ISO date string or a timestamp; without one, only outright "retired" is
     excluded, because guessing at the clock is worse than offering a model one
     day too long. */
  function retirementDate(status) {
    var match = /^retir(?:ed|ing)\b[^0-9]*(\d{4}-\d{2}-\d{2})/i.exec(String(status || ""));
    return match ? match[1] : "";
  }
  function isoDay(today) {
    if (typeof today === "string" && /^\d{4}-\d{2}-\d{2}/.test(today)) return today.slice(0, 10);
    var ts = typeof today === "number" ? today : Date.parse(today);
    if (!isFinite(ts)) return "";
    return new Date(ts).toISOString().slice(0, 10);
  }
  function selectableModels(dossier, today) {
    var day = isoDay(today);
    return ((dossier && dossier.models) || []).filter(function (m) {
      var status = String((m && m.status) || "");
      if (/^retired\b/i.test(status) && !retirementDate(status)) return false;
      var due = retirementDate(status);
      if (!due) return true;
      if (/^retired\b/i.test(status)) return day ? day < due : false;
      return day ? day < due : true;
    });
  }

  function expiryState(dossier, nowTs) {
    var expires = dossier && dossier.checked && dossier.checked.expires;
    if (!expires) return { expired: false, expires: null };
    var due = Date.parse(expires + "T00:00:00Z");
    return { expired: isFinite(due) && nowTs > due, expires: expires };
  }

  /* Display strips inline citation markers; the register keeps the full
     cited text as the source of record. */
  function displayText(text) {
    return String(text || "")
      .replace(/\s*\[[A-Z]{1,3}\d+\]/g, "")
      .replace(/\s+([.,;:])/g, "$1");
  }

  var api = {
    SURFACE_TYPES: SURFACE_TYPES,
    validateDossier: validateDossier,
    founding: founding,
    selectableModels: selectableModels,
    engineProfileResolves: engineProfileResolves,
    retirementDate: retirementDate,
    expiryState: expiryState,
    displayText: displayText
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoToolRegister;
if (typeof window !== "undefined") window.OMonoToolRegister = OMonoToolRegister;
else if (typeof globalThis !== "undefined") globalThis.OMonoToolRegister = OMonoToolRegister;
