import assert from "assert";
import { gvpPatientProjection, pickGvpPatientFields } from "../imports/api/gvpPatientVisibility.js";
import { DEFAULT_GVP_PATIENT_SHARED_FIELDS, normalizeGvpPatientSharedFields } from "../imports/constants/gvpPatientSharing.js";
import { getPatientCalendarDateRange, isCalendarEventOnDate } from "../imports/api/calendarPatientDates.js";

describe("assigned GVP patient calendar data", function () {
  const patient = {
    _id: "patient-1", presidentId: "pres-1", gvpIds: ["gvp-1"],
    firstName: "Mario", lastName: "Rossi", admissionDate: "2026-10-21", dischargeDate: "2026-10-24",
    pathology: "Private information", changeHistory: [{ field: "pathology" }],
    details: { anesthesiologistDate: "2026-10-22", healthProblems: "Private details" },
  };

  for (const [label, fields] of [
    ["default sharing", DEFAULT_GVP_PATIENT_SHARED_FIELDS],
    ["existing customized sharing", normalizeGvpPatientSharedFields(["firstName", "lastName"])],
    ["no optional shared fields", []],
  ]) {
    it(`preserves the calendar date with ${label}`, function () {
      const projection = gvpPatientProjection(fields);
      assert.strictEqual(projection.admissionDate, 1);
      assert.strictEqual(projection.dischargeDate, 1);
      const visible = pickGvpPatientFields(patient, fields);
      assert.strictEqual(visible.admissionDate, patient.admissionDate);
      assert.strictEqual(visible.dischargeDate, patient.dischargeDate);
      const stay = getPatientCalendarDateRange(visible);
      assert.ok(isCalendarEventOnDate(stay, "2026-10-22"));
      assert.ok(isCalendarEventOnDate(stay, "2026-10-24"));
      assert.ok(!isCalendarEventOnDate(stay, "2026-10-25"));
      assert.strictEqual(visible.admissionDate.slice(0, 10), "2026-10-21");
      assert.deepStrictEqual(visible.gvpIds, ["gvp-1"]);
      assert.strictEqual(visible.pathology, undefined);
      assert.strictEqual(visible.changeHistory, undefined);
      assert.strictEqual(projection.pathology, undefined);
    });
  }

  it("preserves shared anesthesiologist visits without exposing unshared details", function () {
    const fields = ["details.anesthesiologistDate"];
    const visible = pickGvpPatientFields(patient, fields);
    assert.strictEqual(gvpPatientProjection(fields)["details.anesthesiologistDate"], 1);
    assert.deepStrictEqual(visible.details, { anesthesiologistDate: "2026-10-22" });
    assert.strictEqual(visible.admissionDate, "2026-10-21");
  });

  it("does not invent a calendar date when no admission date exists", function () {
    const visible = pickGvpPatientFields({ _id: "undated", gvpId: "gvp-1" }, []);
    assert.strictEqual(visible.admissionDate, undefined);
    assert.strictEqual(visible.gvpId, "gvp-1");
  });
});
