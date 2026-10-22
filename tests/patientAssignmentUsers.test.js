import assert from "assert";
import { getPatientAssignmentGvpUsers, getPatientAssignmentGvpLabel } from "../imports/api/patientAssignmentUsers.js";

describe("patient GVP assignment users", function () {
  const users = [
    { id: "p", role: "Presidente" },
    { id: "cas", role: "CAS", presidentId: "p" },
    { id: "legacy-cas", role: "CAS", associationId: "p" },
    { id: "direct", role: "GVP", presidentId: "p" },
    { id: "via-cas", role: "GVP", associationId: "cas" },
    { id: "via-cas-id", role: "GVP", casId: "legacy-cas" },
    { id: "via-cas-ids", role: "GVP", casIds: ["cas", "legacy-cas"] },
    { id: "via-president", role: "GVP", associationId: "p" },
    { id: "other", role: "GVP", presidentId: "other-president", casIds: ["cas"] },
    { id: "unlinked", role: "GVP" },
  ];
  const visible = getPatientAssignmentGvpUsers(users, "p");

  it("shows only GVP accounts, never the president or CAS", function () {
    assert.ok(visible.every(user => user.role === "GVP"));
    assert.ok(!visible.some(user => ["p", "cas", "legacy-cas"].includes(user.id)));
  });

  it("includes all GVP of the presidency regardless of department or CAS recommendation", function () {
    assert.deepStrictEqual(visible.map(user => user.id), ["direct", "via-cas", "via-cas-id", "via-cas-ids", "via-president"]);
  });

  it("does not include users with an explicit different presidency or no association", function () {
    assert.ok(!visible.some(user => ["other", "unlinked"].includes(user.id)));
    assert.deepStrictEqual(getPatientAssignmentGvpUsers(users, ""), []);
  });

  it("does not duplicate a GVP associated with several CAS", function () {
    assert.strictEqual(visible.filter(user => user.id === "via-cas-ids").length, 1);
  });

  it("uses the same username as the GVP directory even if profile names differ", function () {
    const gvp = { id: "direct", role: "GVP", presidentId: "p", username: "Franco Y.", firstName: "Alessandro", lastName: "Arcidiacono" };
    const options = getPatientAssignmentGvpUsers([...users.filter(user => user.id !== "direct"), gvp], "p");
    assert.strictEqual(getPatientAssignmentGvpLabel(options.find(user => user.id === "direct")), "Franco Y.");
    assert.ok(!options.some(user => user.role === "Presidente"));
  });

  it("falls back to profile names only when no username is available", function () {
    assert.strictEqual(getPatientAssignmentGvpLabel({ firstName: " Giovanni ", lastName: "Rossi" }), "Giovanni Rossi");
    assert.strictEqual(getPatientAssignmentGvpLabel({ username: " Giovanni Rossi ", firstName: "Altro" }), "Giovanni Rossi");
    assert.strictEqual(getPatientAssignmentGvpLabel(null), "");
  });
});
