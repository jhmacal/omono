(function () {
  "use strict";
  var R = window.OMonoBrowserRuntime;
  if (!R || !R.storage) throw new Error("The O'Mono browser runtime must load before its UI adapter.");
  var bridge = window.omono = window.omono || {};
  var themeListeners = [];
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  async function themeReport() {
    var source = await R.storage.get("ui.theme");
    if (["light", "dark", "system"].indexOf(source) === -1) source = "system";
    return { source: source, resolved: source === "system" ? (media.matches ? "dark" : "light") : source };
  }
  async function notifyTheme() {
    var report = await themeReport();
    themeListeners.forEach(function (listener) { listener(report); });
  }
  bridge.theme = themeReport;
  bridge.setTheme = async function (source) {
    if (["system", "light", "dark"].indexOf(source) === -1) source = "system";
    await R.storage.set("ui.theme", source);
    await notifyTheme();
    return themeReport();
  };
  bridge.onThemeChanged = function (listener) { if (typeof listener === "function") themeListeners.push(listener); };
  if (media.addEventListener) media.addEventListener("change", notifyTheme);
  else if (media.addListener) media.addListener(notifyTheme);

  function phone() { return window.innerWidth <= 640; }
  function availableHeight() { return Math.max(180, window.innerHeight - (phone() ? 0 : 48)); }
  bridge.resize = function (height) {
    /* A phone gives the palette the whole viewport, so there is no window to
       size to the content; the stylesheet fills it and this measurement would
       only fight it. */
    if (phone()) return;
    var bounded = Math.max(180, Math.min(Number(height) || 220, availableHeight()));
    document.body.style.setProperty("--browser-palette-height", Math.ceil(bounded) + "px");
  };
  bridge.windowState = async function () { return { compactMaxHeight: availableHeight(), user_resized: false }; };
  bridge.windowBounds = async function () {
    var rect = document.body.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  bridge.hide = function () { return false; };
  bridge.onShown = function () {};
  bridge.onPrepareQuit = function () {};
  bridge.recoveryFlushed = function () {};
  bridge.onCreatorInvoke = function () {};

  bridge.setupState = async function () { return { needed: (await R.storage.get("ui.setup-version")) !== 1 }; };
  bridge.setupDone = async function () {
    await R.storage.set("ui.setup-version", 1);
    return { ok: true };
  };
  /* Copying the prompt is the point of the whole app, so it does not depend on
     one API. The clipboard object is withheld from a page served over plain
     http, and writeText can be refused even where it exists, so a selection
     copy stands behind it. */
  function copyBySelection(value) {
    var field = document.createElement("textarea");
    field.value = String(value);
    field.readOnly = true;
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    var done = false;
    try {
      field.select();
      field.setSelectionRange(0, field.value.length);
      done = document.execCommand && document.execCommand("copy");
    } catch (error) { done = false; }
    field.remove();
    return !!done;
  }
  bridge.copy = async function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(String(text)); return true; }
      catch (error) { /* fall through to the selection copy */ }
    }
    return copyBySelection(text);
  };
  bridge.openExternal = async function (address) {
    var url;
    try { url = new URL(String(address)); } catch (error) { return false; }
    if (url.protocol !== "https:") return false;
    var link = document.createElement("a");
    link.href = url.href; link.target = "_blank"; link.rel = "noopener noreferrer";
    document.body.appendChild(link); link.click(); link.remove();
    return true;
  };
  bridge.saveText = async function (name, text) {
    if (!window.URL || !URL.createObjectURL || typeof Blob === "undefined") return { saved: false };
    var url = null;
    var link = null;
    try {
      url = URL.createObjectURL(new Blob([String(text)], { type: "text/plain;charset=utf-8" }));
      link = document.createElement("a");
      link.href = url;
      link.download = String(name || "omono-record.txt").replace(/[\\/\u0000-\u001f]/g, "_");
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return { saved: true, download_requested: true };
    } catch (error) {
      if (link && link.parentNode) link.remove();
      if (url) URL.revokeObjectURL(url);
      return { saved: false };
    }
  };
  R.downloadText = bridge.saveText;

  bridge.pickContextFile = function () {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,image/png,image/jpeg,image/webp,image/gif";
      input.hidden = true;
      var finished = false;
      function finish(value) {
        if (finished) return;
        finished = true; input.remove(); resolve(value);
      }
      input.addEventListener("cancel", function () { finish(null); });
      input.addEventListener("change", async function () {
        var file = input.files && input.files[0];
        if (!file) { finish(null); return; }
        if (file.size > 8 * 1024 * 1024) { finish({ tooBig: true }); return; }
        var mediaType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "");
        if (["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"].indexOf(mediaType) === -1) {
          finish(null); return;
        }
        try {
          var bytes = new Uint8Array(await file.arrayBuffer());
          var chunks = [];
          for (var i = 0; i < bytes.length; i += 32768) {
            chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)));
          }
          finish({ label: file.name, media: mediaType, data: btoa(chunks.join("")), bytes: file.size });
        } catch (error) { finish(null); }
      });
      document.body.appendChild(input);
      input.click();
    });
  };

  /* Taking a file in. A page cannot look in a folder, so this is the phone's
     half of catching up with the Mac: the ordinary file picker, which on iOS
     opens straight onto iCloud Drive. Text only, and small — a record this
     size is already far larger than any carry file ought to be. */
  var CARRY_MAX_BYTES = 12 * 1024 * 1024;
  bridge.pickTextFile = function () {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json,text/plain";
      input.hidden = true;
      var finished = false;
      function finish(value) { if (finished) return; finished = true; input.remove(); resolve(value); }
      input.addEventListener("cancel", function () { finish(null); });
      input.addEventListener("change", async function () {
        var file = input.files && input.files[0];
        if (!file) { finish(null); return; }
        if (file.size > CARRY_MAX_BYTES) { finish({ tooBig: true }); return; }
        try { finish({ label: file.name, text: await file.text() }); }
        catch (error) { finish(null); }
      });
      document.body.appendChild(input);
      input.click();
    });
  };

  function hideControl(id, container) {
    var node = document.getElementById(id);
    if (!node) return;
    (container ? node.closest(container) || node : node).classList.add("browser-unavailable");
  }
  function prepareBrowserUi() {
    hideControl("modeSelect", ".srow");
    hideControl("regEditList", ".panel");
    hideControl("pendingLessonsEnterpriseSlot", ".panel");
    /* The watch stays on: owner ruling, 2026-09-21. A browser cannot fetch
       other sites, so the fetch-them-all button is not offered; each row opens
       its page instead. */
    hideControl("wchCheckAll");
    ["matterSlot", "matterSetupRow", "advancedNote", "legacyKeyNote", "legacyScrubRow", "ownerNote"].forEach(function (id) {
      hideControl(id);
    });
    var modeControl = document.getElementById("modeSelect");
    var modePanel = modeControl && modeControl.closest(".panel");
    var modeHeading = modePanel && modePanel.querySelector("h3");
    if (modeHeading) modeHeading.textContent = "Strictness";
    /* Said in the words the reason stands for, because the reason itself is a
       wire value and reads like one. */
    function refusalNote(result) {
      var reason = result && result.reason ? String(result.reason) : "";
      if (reason === "fetched_recently") return "You asked a moment ago. Try again in a few minutes.";
      if (reason === "no_credential") return "Enter your Anthropic key first.";
      if (reason === "not_due") return "There are already enough new lessons waiting.";
      if (result && result.error && result.error.headline) return result.error.headline;
      return "No new lessons this time.";
    }
    /* Said as a count of things, because "done" tells you nothing about
       whether you are actually current. */
    function carrySentence(result) {
      if (!result || !result.merged) {
        if (result && result.reason === "not_a_carry_file") return "That is not an O'Mono record file.";
        if (result && result.reason === "unreadable") return "That file could not be read. Nothing changed.";
        if (result && result.reason === "nothing_usable") return "There was nothing usable in that file. Nothing changed.";
        return "Nothing was taken from that file.";
      }
      if (!result.total_added) return "Already up to date. Nothing new to take.";
      var parts = [];
      if (result.added.work) parts.push(result.added.work + (result.added.work === 1 ? " entry" : " entries") + " of work");
      if (result.added.lessons) parts.push(result.added.lessons + " lesson" + (result.added.lessons === 1 ? "" : "s"));
      var seen = (result.added.emissions || 0) + (result.added.engagement || 0);
      if (seen) parts.push(seen + " record" + (seen === 1 ? "" : "s") + " of lessons you were shown");
      var sentence = "Took " + parts.join(", ") + ".";
      if (result.total_known) sentence += " " + result.total_known + " were already here.";
      if (result.newest_ts) sentence += " Newest: " + new Date(result.newest_ts).toLocaleDateString() + ".";
      return sentence;
    }
    function wireCarry(id, run) {
      var control = document.getElementById(id);
      if (!control) return;
      control.addEventListener("click", async function () {
        var note = document.getElementById("carryNote");
        if (control.disabled) return;
        control.disabled = true;
        var label = control.textContent;
        control.textContent = "Working…";
        try { if (note) note.textContent = await run(); }
        catch (error) { if (note) note.textContent = "That did not finish. Nothing changed."; }
        finally { control.disabled = false; control.textContent = label; }
      });
    }
    wireCarry("carryImportBtn", async function () {
      var picked = await bridge.pickTextFile();
      if (!picked) return "No file chosen. Nothing changed.";
      if (picked.tooBig) return "That file is too large to be an O'Mono record. Nothing changed.";
      return carrySentence(await bridge.carryImport(picked.text));
    });
    wireCarry("carryExportBtn", async function () {
      var result = await bridge.carryExport();
      if (!result || !result.saved) return "The file could not be handed over.";
      var counts = result.carried || {};
      return "Handed over " + (counts.work || 0) + " entries of work and "
        + (counts.lessons || 0) + " lessons. Save it in the O'Mono folder in iCloud and the Mac will pick it up.";
    });

    var button = document.getElementById("browserRefreshLessons");
    if (button) button.addEventListener("click", async function () {
      var note = document.getElementById("browserRefreshNote");
      if (typeof bridge.refreshRun !== "function") {
        note.textContent = "Lesson updates are unavailable in this browser."; return;
      }
      button.disabled = true;
      note.textContent = "Updating lessons…";
      try {
        /* New lessons already arrive on their own when O'Mono opens. Pressing
           this asks for more now, which is the running-low request, not a
           second opening — otherwise the shared service would answer that it
           had already refreshed this session and nothing would happen. */
        var result = await bridge.refreshRun({ user_initiated: true, reason: "needs_more" });
        if (result && result.refreshed) {
          if (typeof window.refreshLessonCaches === "function") window.refreshLessonCaches();
          if (typeof window.renderPendingLessons === "function") window.renderPendingLessons();
          note.textContent = "Lesson update completed. Open Learning to review the result.";
        } else {
          note.textContent = refusalNote(result);
        }
      } catch (error) { note.textContent = "The lesson update did not finish. Try again."; }
      finally { button.disabled = false; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepareBrowserUi);
  else prepareBrowserUi();
  window.addEventListener("resize", async function () {
    bridge.resize(document.body.getBoundingClientRect().height);
    if (typeof window.refreshWindowFacts === "function") await window.refreshWindowFacts();
    if (typeof window.fitHeight === "function") window.fitHeight();
  });
})();
