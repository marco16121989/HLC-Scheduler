import assert from "assert";
import { getDefaultPresidentId } from "../client/templates/Users.js";
import { isUserAssignedToDepartment } from "../client/templates/Hospitals.js";
import { getPagePermission } from "../imports/constants/pagePermissions.js";
import { isProtectedPresidentAccount } from "../imports/constants/userProtection.js";

describe("hlcScheduler", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "hlcScheduler");
  });

  it("defaults the president of a GVP to the CAS president", function () {
    const manager = { id: "cas-1", role: "CAS", associationId: "pres-1" };
    const users = [
      { id: "pres-1", role: "Presidente" },
      { id: "cas-1", role: "CAS", associationId: "pres-1" },
    ];

    assert.strictEqual(getDefaultPresidentId("GVP", manager, users), "pres-1");
  });

  it("defaults the president of a free GVP to the managing president", function () {
    const manager = { id: "pres-1", role: "Presidente" };

    assert.strictEqual(getDefaultPresidentId("GVP", manager, []), "pres-1");
  });

  it("allows only the CAS secretary to access the annual report", function () {
    assert.deepStrictEqual(
      getPagePermission({ role: "CAS", isSecretary: true }, "annual-report"),
      { view: true, edit: true },
    );
    assert.deepStrictEqual(
      getPagePermission({ role: "CAS", isSecretary: false }, "annual-report"),
      { view: false, edit: false },
    );
  });

  it("recognizes a department assigned through the president profile", function () {
    const president = {
      role: "Presidente",
      hospitalAssignments: [{ hospitalId: "hospital-1", departmentIds: ["department-1"] }],
    };

    assert.strictEqual(
      isUserAssignedToDepartment(president, "hospital-1", "department-1"),
      true,
    );
    assert.strictEqual(
      isUserAssignedToDepartment(president, "hospital-1", "department-2"),
      false,
    );
  });

  it("always protects president accounts from deletion", function () {
    assert.strictEqual(isProtectedPresidentAccount({ role: "Presidente" }), true);
    assert.strictEqual(isProtectedPresidentAccount({ profile: { role: "Presidente" } }), true);
    assert.strictEqual(isProtectedPresidentAccount({ role: "CAS" }), false);
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });
  }
});
