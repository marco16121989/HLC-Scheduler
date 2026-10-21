import assert from "assert";
import { Mongo } from "meteor/mongo";
import { getGvpUsersSelector } from "../imports/api/userDirectory.js";
import { isUserAssignedToDepartment } from "../client/templates/Hospitals.js";

describe("hospital coverage in the GVP directory", function () {
  const departments = Array.from({ length: 48 }, (_, index) => `department-${index}`);
  const records = [
    { _id: "pres-1", profile: { role: "Presidente", hospitalAssignments: [{ hospitalId: "hospital-1", departmentIds: departments.slice(42) }] } },
    { _id: "cas-1", profile: { role: "CAS", presidentId: "pres-1", hospitalAssignments: [{ hospitalId: "hospital-1", departmentIds: departments.slice(0, 42) }] } },
    { _id: "cas-legacy", profile: { role: "CAS", associationId: "pres-1" } },
    { _id: "gvp-1", profile: { role: "GVP", presidentId: "pres-1" } },
    { _id: "gvp-2", profile: { role: "GVP", presidentId: "pres-1" } },
    { _id: "pres-2", profile: { role: "Presidente" } },
    { _id: "cas-other", profile: { role: "CAS", presidentId: "pres-2" } },
  ];
  const uncoveredCount = (users) => departments.filter((departmentId) => !users.some((user) =>
    !user.profile.disabled && ["Presidente", "CAS"].includes(user.profile.role) &&
    isUserAssignedToDepartment(user.profile, "hospital-1", departmentId),
  )).length;

  for (const canViewPermissions of [false, true]) {
    it(`includes president coverage with permissions access ${canViewPermissions}`, async function () {
      const users = new Mongo.Collection(null);
      for (const record of records) await users.insertAsync(record);
      const published = await users.find(getGvpUsersSelector("gvp-1", "pres-1", canViewPermissions)).fetchAsync();

      assert.strictEqual(uncoveredCount(records.slice(1, 2)), 6);
      assert.strictEqual(uncoveredCount(published), 0);
      assert.strictEqual(uncoveredCount(published), uncoveredCount(records.slice(0, 2)));
      assert.ok(published.some((user) => user._id === "pres-1"));
      assert.ok(published.some((user) => user._id === "cas-legacy"));
      assert.ok(published.some((user) => user._id === "gvp-1"));
      assert.strictEqual(published.some((user) => user._id === "gvp-2"), canViewPermissions);
      assert.ok(!published.some((user) => ["pres-2", "cas-other"].includes(user._id)));

      const withoutPresidentCoverage = published.map((user) => user._id === "pres-1"
        ? { ...user, profile: { ...user.profile, hospitalAssignments: [] } }
        : user);
      assert.strictEqual(uncoveredCount(withoutPresidentCoverage), 6);
      const disabledPresident = published.map((user) => user._id === "pres-1"
        ? { ...user, profile: { ...user.profile, disabled: true } }
        : user);
      assert.strictEqual(uncoveredCount(disabledPresident), 6);
    });
  }
});
