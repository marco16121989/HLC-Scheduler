import assert from "assert";
import { getDefaultPresidentId } from "../client/templates/Users.js";

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
