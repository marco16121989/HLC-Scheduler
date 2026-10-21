import assert from "assert";
import { getPatientCalendarDateRange, isCalendarEventOnDate } from "../imports/api/calendarPatientDates.js";

describe("patient stays in the calendar", function () {
  it("includes admission, intermediate days and discharge, excluding surrounding days", function () {
    const stay = getPatientCalendarDateRange({ admissionDate: "2026-10-21", dischargeDate: "2026-10-24" });
    assert.deepStrictEqual(stay, { date: "2026-10-21", endDate: "2026-10-24" });
    for (const day of ["21", "22", "23", "24"]) assert.ok(isCalendarEventOnDate(stay, `2026-10-${day}`));
    for (const day of ["20", "25"]) assert.ok(!isCalendarEventOnDate(stay, `2026-10-${day}`));
  });

  it("handles stays crossing months, years and leap days", function () {
    for (const [start, end, middle] of [
      ["2026-10-30", "2026-11-02", "2026-11-01"],
      ["2026-12-30", "2027-01-02", "2027-01-01"],
      ["2028-02-28", "2028-03-01", "2028-02-29"],
    ]) assert.ok(isCalendarEventOnDate(getPatientCalendarDateRange({ admissionDate: start, dischargeDate: end }), middle));
  });

  it("shows one day when discharge is missing, equal to admission, invalid or earlier", function () {
    for (const dischargeDate of [undefined, "", "2026-10-21", "2026-10-20", "2026-02-30", "invalid"]) {
      const stay = getPatientCalendarDateRange({ admissionDate: "2026-10-21", dischargeDate });
      assert.ok(isCalendarEventOnDate(stay, "2026-10-21"));
      assert.ok(!isCalendarEventOnDate(stay, "2026-10-22"));
    }
  });

  it("does not create a stay without a valid admission date", function () {
    for (const admissionDate of [undefined, "", "invalid", "2026-02-30"])
      assert.strictEqual(getPatientCalendarDateRange({ admissionDate, dischargeDate: "2026-10-24" }), null);
  });

  it("keeps appointments, presentations and other single-day events on their own date", function () {
    const appointment = { date: "2026-10-22" };
    assert.ok(isCalendarEventOnDate(appointment, "2026-10-22"));
    assert.ok(!isCalendarEventOnDate(appointment, "2026-10-21"));
    assert.ok(!isCalendarEventOnDate(appointment, "2026-10-23"));
  });
});
