import assert from "assert";
import { filterEventsByPeriod, filterEventsByResponse, getEventEndTime } from "../imports/api/eventFilters.js";

describe("event period filters", function () {
  const now = new Date("2026-10-12T18:00:00+02:00").getTime();
  const ongoing = { id: "ongoing", startsAt: "2026-10-12T17:00:00+02:00", endsAt: "2026-10-12T20:30:00+02:00" };
  const future = { id: "future", startsAt: "2026-10-13T18:00:00+02:00", endsAt: "2026-10-13T20:30:00+02:00" };
  const past = { id: "past", startsAt: "2026-10-11T18:00:00+02:00", endsAt: "2026-10-11T20:30:00+02:00" };

  it("keeps ongoing and future events visible and hides completed events", function () {
    assert.deepStrictEqual(filterEventsByPeriod([past, ongoing, future], "upcoming", now), [ongoing, future]);
    assert.deepStrictEqual(filterEventsByPeriod([past, ongoing, future], "past", now), [past]);
  });

  it("moves an event to the past at its end time", function () {
    const end = getEventEndTime(ongoing);
    assert.deepStrictEqual(filterEventsByPeriod([ongoing], "upcoming", end - 1), [ongoing]);
    assert.deepStrictEqual(filterEventsByPeriod([ongoing], "upcoming", end), []);
    assert.deepStrictEqual(filterEventsByPeriod([ongoing], "past", end), [ongoing]);
  });

  it("compares actual instants across time zones and overnight events", function () {
    const overnight = { startsAt: "2026-10-11T23:00:00+02:00", endsAt: "2026-10-12T03:00:00+02:00" };
    const beforeEnd = new Date("2026-10-12T00:30:00Z").getTime();
    assert.deepStrictEqual(filterEventsByPeriod([overnight], "upcoming", beforeEnd), [overnight]);
  });

  it("uses the start date for legacy events without an end date", function () {
    assert.deepStrictEqual(filterEventsByPeriod([{ ...past, endsAt: null }], "upcoming", now), []);
    assert.strictEqual(getEventEndTime({}), Infinity);
  });

  it("shows only events created by the current user across all periods", function () {
    const ownPast = { ...past, createdBy: "cas-1" };
    const ownFuture = { ...future, createdBy: "cas-1" };
    const others = { ...ongoing, createdBy: "cas-2" };
    assert.deepStrictEqual(filterEventsByPeriod([ownPast, ownFuture, others], "mine", now, "cas-1"), [ownPast, ownFuture]);
    assert.deepStrictEqual(filterEventsByPeriod([ownPast, ownFuture, others], "mine", now, "cas-2"), [others]);
    assert.deepStrictEqual(filterEventsByPeriod([ownPast, ownFuture, others], "mine", now), []);
  });
});

describe("event response filters", function () {
  const accepted = { id: "yes", endsAt: "2026-10-13T20:00:00+02:00", invitees: [{ userId: "gvp-1", status: "accepted" }] };
  const declined = { id: "no", endsAt: "2026-10-11T20:00:00+02:00", invitees: [{ userId: "gvp-1", status: "declined" }] };
  const pending = { id: "pending", invitees: [{ userId: "gvp-1", status: "pending" }, { userId: "gvp-2", status: "accepted" }] };
  const records = [accepted, declined, pending, { id: "owned" }];

  it("filters by the current user's response, excluding other invitees' responses", function () {
    assert.deepStrictEqual(filterEventsByResponse(records, "accepted", "gvp-1"), [accepted]);
    assert.deepStrictEqual(filterEventsByResponse(records, "declined", "gvp-1"), [declined]);
    assert.deepStrictEqual(filterEventsByResponse(records, "pending", "gvp-1"), [pending]);
    assert.deepStrictEqual(filterEventsByResponse(records, "accepted", "gvp-2"), [pending]);
    assert.deepStrictEqual(filterEventsByResponse(records, "all", "gvp-1"), records);
  });

  it("combines response and period filters", function () {
    const now = new Date("2026-10-12T18:00:00+02:00").getTime();
    assert.deepStrictEqual(filterEventsByResponse(filterEventsByPeriod(records, "past", now), "declined", "gvp-1"), [declined]);
    assert.deepStrictEqual(filterEventsByResponse(filterEventsByPeriod(records, "upcoming", now), "declined", "gvp-1"), []);
  });
});
