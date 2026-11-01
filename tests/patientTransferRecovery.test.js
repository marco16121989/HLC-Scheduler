import assert from "assert";
import { recoverInternalTransferPatients } from "../imports/api/patientTransferRecovery.js";

describe("previous internal transfers", function () {
  const internal = { toDepartmentId: "cas-department" };
  const external = { external: true, toDepartmentId: "" };
  const makePatients = (records, beforeUpdate = () => {}) => ({
    find: (selector) => ({ fetchAsync: async () => records.filter((record) => record.status === selector.status).map((record) => ({ ...record })) }),
    updateAsync: async (selector, update) => {
      beforeUpdate();
      const record = records.find((item) => item._id === selector._id && item.status === selector.status
        && JSON.stringify(item.departmentHistory) === JSON.stringify(selector.departmentHistory));
      if (!record) return 0;
      Object.assign(record, update.$set);
      return 1;
    },
  });

  it("reopens existing internal transfers while preserving patient data and history", async function () {
    const record = { _id: "internal", status: "Trasferito", firstName: "Mario", transferNotes: "Destinazione", details: { departmentId: "cas-department" }, departmentHistory: [internal] };
    const records = [record,
      { _id: "external", status: "Trasferito", departmentHistory: [internal, external] },
      { _id: "unknown", status: "Trasferito" },
      { _id: "initial", status: "Trasferito", departmentHistory: [{ ...internal, initialAssignment: true }] },
      { _id: "discharged", status: "Dimesso", departmentHistory: [internal] },
      { _id: "deceased", status: "Deceduto", departmentHistory: [internal] },
    ];
    const original = JSON.parse(JSON.stringify(records));
    const patients = makePatients(records);
    assert.strictEqual(await recoverInternalTransferPatients(patients), 1);
    assert.strictEqual(record.status, "Ricoverato");
    assert.strictEqual(record.firstName, original[0].firstName);
    assert.strictEqual(record.transferNotes, original[0].transferNotes);
    assert.deepStrictEqual(record.details, original[0].details);
    assert.deepStrictEqual(record.departmentHistory, original[0].departmentHistory);
    assert.deepStrictEqual(records.slice(1), original.slice(1));
    assert.strictEqual(await recoverInternalTransferPatients(patients), 0);
  });

  it("does not reopen a patient transferred externally during recovery", async function () {
    const record = { _id: "patient", status: "Trasferito", departmentHistory: [internal] };
    const patients = makePatients([record], () => { record.departmentHistory = [internal, external]; });
    assert.strictEqual(await recoverInternalTransferPatients(patients), 0);
    assert.strictEqual(record.status, "Trasferito");
  });
});
