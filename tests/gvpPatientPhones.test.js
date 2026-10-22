import assert from "assert";
import { gvpPatientProjection, pickGvpPatientFields } from "../imports/api/gvpPatientVisibility.js";

describe("GVP patient phone visibility", function () {
  it("shares patient, elder and additional contacts even with customized sharing", function () {
    const details = { patientPhone: "111", elderName: "Mario", elderPhone: "222", phoneContacts: [{ id: "one", name: "Anna", phone: "333" }] };
    const patient = { _id: "p", details: { ...details, healthProblems: "Riservato" }, casNotes: "Riservato" };
    const visible = pickGvpPatientFields(patient, []);
    assert.deepStrictEqual(visible.details, details);
    assert.strictEqual(visible.casNotes, undefined);
    for (const field of ["patientPhone", "elderName", "elderPhone", "phoneContacts"]) {
      assert.strictEqual(gvpPatientProjection([])[`details.${field}`], 1);
    }
  });
});
