"use strict";
/* O'Mono v4 practice rules (D7) — the weekday streak and the rare landmarks,
 * as pure functions. Personal mode only; the renderer enforces the mode gate.
 * No points exist here or anywhere: a streak is a count of consecutive active
 * weekdays and a landmark is a named moment, never a score.
 *
 * Browser-safe: IIFE, dual export, no require. */
var OMonoPracticeV4 = (function () {

  var DAY_MS = 24 * 3600 * 1000;

  function dayString(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
      + "-" + String(d.getDate()).padStart(2, "0");
  }
  function isWeekend(ts) {
    var day = new Date(ts).getDay();
    return day === 0 || day === 6;
  }

  /* The streak counts weekday active use only: a generation or a recorded
     verification, never a mere open. Weekends neither count toward it nor
     break it: Friday to Monday is consecutive. A missed weekday ends it. */
  function weekdayStreak(activeTimestamps, nowTs) {
    var activeDays = {};
    (activeTimestamps || []).forEach(function (ts) {
      if (!isWeekend(ts)) activeDays[dayString(ts)] = true;
    });
    var streak = 0;
    var cursor = nowTs;
    /* Walk backwards from today, skipping weekends. Today itself counts when
       active but an inactive today does not break yesterday's streak. */
    var first = true;
    for (var guard = 0; guard < 3660; guard += 1) {
      if (isWeekend(cursor)) { cursor -= DAY_MS; continue; }
      if (activeDays[dayString(cursor)]) {
        streak += 1;
      } else if (first) {
        /* today, quietly not yet active */
      } else {
        break;
      }
      first = false;
      cursor -= DAY_MS;
    }
    return streak;
  }

  /* Landmarks (D7): rare, each paired with one concrete check. Gaps in use
     are never mentioned, so no landmark can fire on absence. */
  var VERIFIED_LANDMARKS = [7, 30, 100];

  function landmarksDue(state, seen) {
    var s = state || {};
    var done = seen || [];
    var due = [];
    VERIFIED_LANDMARKS.forEach(function (n) {
      if ((s.verified_count || 0) >= n && done.indexOf("verified_" + n) === -1) {
        due.push({
          id: "verified_" + n,
          line: n + " prompts answered with how they actually went.",
          check: "Open History and read the oldest Failed one again: does the fix you made then still hold?"
        });
      }
    });
    if (s.first_repair === true && done.indexOf("first_repair") === -1) {
      due.push({
        id: "first_repair",
        line: "First failure diagnosed and repaired.",
        check: "Run the repaired prompt once more and confirm the failure is actually gone."
      });
    }
    if (s.first_quiet_category && done.indexOf("quiet_" + s.first_quiet_category) === -1) {
      due.push({
        id: "quiet_" + s.first_quiet_category,
        line: "A failure category stayed quiet for a whole month.",
        check: "Keep its safeguard in place for one more prompt and verify the result before trusting the quiet."
      });
    }
    return due;
  }

  /* First month a failure category never returns: the category failed in some
     earlier month and has a full completed month of zero since. Input:
     { category: { "YYYY-MM": count } }, evaluated at nowTs. */
  function firstQuietCategory(byMonth, nowTs) {
    var now = new Date(nowTs);
    var thisMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    var last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var lastMonth = last.getFullYear() + "-" + String(last.getMonth() + 1).padStart(2, "0");
    var categories = Object.keys(byMonth || {});
    for (var i = 0; i < categories.length; i += 1) {
      var months = byMonth[categories[i]] || {};
      var failedBefore = Object.keys(months).some(function (m) {
        return m < lastMonth && months[m] > 0;
      });
      var quietLastMonth = !months[lastMonth];
      var quietThisMonth = !months[thisMonth];
      if (failedBefore && quietLastMonth && quietThisMonth) return categories[i];
    }
    return null;
  }

  var api = {
    VERIFIED_LANDMARKS: VERIFIED_LANDMARKS.slice(),
    dayString: dayString,
    isWeekend: isWeekend,
    weekdayStreak: weekdayStreak,
    landmarksDue: landmarksDue,
    firstQuietCategory: firstQuietCategory
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = OMonoPracticeV4;
if (typeof window !== "undefined") window.OMonoPracticeV4 = OMonoPracticeV4;
else if (typeof globalThis !== "undefined") globalThis.OMonoPracticeV4 = OMonoPracticeV4;
