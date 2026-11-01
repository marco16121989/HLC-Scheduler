import assert from "assert";
import { shouldMaskPatientIdentity } from "../imports/api/patientPrivacy.js";
import { gvpPatientProjection, pickGvpPatientFields } from "../imports/api/gvpPatientVisibility.js";

describe("patient transfer privacy", function () {
  const internal = { toDepartmentId: "department-2", toHospitalName: "Ospedale CAS" };
  const external = { external: true, toDepartmentId: "", toHospitalName: "Ospedale esterno" };
  const transferred = (...departmentHistory) => ({ status: "Trasferito", departmentHistory });

  it("keeps identity visible after transfer to a listed department", function () {
    assert.strictEqual(shouldMaskPatientIdentity(transferred(internal)), false);
  });

  it("masks an external transfer even when the original department is still assigned", function () {
    assert.strictEqual(shouldMaskPatientIdentity({
      ...transferred(internal, external), details: { departmentId: "department-1" },
    }), true);
  });

  it("uses the latest registered destination", function () {
    assert.strictEqual(shouldMaskPatientIdentity(transferred(external, internal)), false);
    assert.strictEqual(shouldMaskPatientIdentity(transferred({ ...internal, external: true })), true);
  });

  it("keeps undocumented destinations masked, including an initial assignment only", function () {
    assert.strictEqual(shouldMaskPatientIdentity({ status: "Trasferito" }), true);
    assert.strictEqual(shouldMaskPatientIdentity(transferred()), true);
    assert.strictEqual(shouldMaskPatientIdentity(transferred({ ...internal, initialAssignment: true })), true);
    assert.strictEqual(shouldMaskPatientIdentity(transferred({ toHospitalName: "Destinazione libera" })), true);
  });

  it("preserves privacy for discharge and death and visibility for follow up", function () {
    for (const status of ["Dimesso", "Deceduto"]) {
      assert.strictEqual(shouldMaskPatientIdentity({ status, departmentHistory: [internal] }), true);
    }
    assert.strictEqual(shouldMaskPatientIdentity({ status: "Dimesso", followUpEnabled: true }), false);
    assert.strictEqual(shouldMaskPatientIdentity({ status: "Ricoverato" }), false);
  });

  it("includes privacy context even with customized GVP sharing", function () {
    for (const destination of [internal, external]) {
      const patient = { _id: "patient", ...transferred(destination) };
      const visible = pickGvpPatientFields(patient, []);
      assert.strictEqual(shouldMaskPatientIdentity(visible), shouldMaskPatientIdentity(patient));
    }
    assert.strictEqual(gvpPatientProjection([]).status, 1);
    assert.strictEqual(gvpPatientProjection([]).departmentHistory, 1);
  });
});
