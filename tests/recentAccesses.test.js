import assert from "assert";
import { filterPeriodAccesses } from "../imports/utils/monthlyAccesses.js";

describe("recent access periods", function () {
  const log = (id, createdAt, extra = {}) => ({ id, userId: "user", createdAt, ...extra });
  const ids = (logs, period, now) => filterPeriodAccesses(logs, period, new Date(now)).map((entry) => entry.id);

  it("defaults to today in Rome and sorts newest accesses first", function () {
    const logs = [log("midnight", "2026-10-31T23:00:00Z"), log("yesterday", "2026-10-31T22:59:59Z"), log("latest", "2026-11-01T10:00:00Z")];
    const original = logs.slice();
    assert.deepStrictEqual(ids(logs, undefined, "2026-11-01T12:00:00Z"), ["latest", "midnight"]);
    assert.deepStrictEqual(logs, original);
  });

  it("uses calendar weeks, months and years rather than rolling durations", function () {
    const logs = [
      log("last-year", "2025-12-31T22:59:59Z"),
      log("year-start", "2025-12-31T23:00:00Z"),
      log("last-month", "2026-10-31T22:59:59Z"),
      log("month-start", "2026-10-31T23:00:00Z"),
      log("week-start", "2026-11-01T23:00:00Z"),
      log("today", "2026-11-04T08:00:00Z"),
    ];
    const now = "2026-11-04T12:00:00Z";
    assert.deepStrictEqual(ids(logs, "week", now), ["today", "week-start"]);
    assert.deepStrictEqual(ids(logs, "month", now), ["today", "week-start", "month-start"]);
    assert.deepStrictEqual(ids(logs, "year", now), ["today", "week-start", "month-start", "last-month", "year-start"]);
  });

  it("includes the part of the current week that falls in the previous year", function () {
    const logs = [log("monday", "2026-12-27T23:00:00Z"), log("sunday", "2026-12-27T22:59:59Z")];
    assert.deepStrictEqual(ids(logs, "week", "2027-01-03T12:00:00Z"), ["monday"]);
  });

  it("handles the longer day when daylight saving time ends", function () {
    const logs = [log("midnight", "2026-10-24T22:00:00Z"), log("before-midnight", "2026-10-24T21:59:59Z"), log("late", "2026-10-25T22:00:00Z")];
    assert.deepStrictEqual(ids(logs, "day", "2026-10-25T22:30:00Z"), ["late", "midnight"]);
  });

  it("ignores non-access actions, missing users or dates, invalid dates and future events", function () {
    const now = "2026-11-01T12:00:00Z";
    const logs = [log("valid", now), log("action", now, { action: "impersonation-start" }), log("missing-user", now, { userId: "" }), log("invalid", "invalid"), log("missing-date", null), log("future", "2026-11-01T12:00:01Z")];
    assert.deepStrictEqual(ids(logs, "day", now), ["valid"]);
  });
});
