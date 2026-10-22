import assert from "assert";
import { MANAGEABLE_PAGES, getPagePermission } from "../imports/constants/pagePermissions.js";

describe("presentation permissions", function () {
  it("includes presentations in configurable permissions", function () {
    assert.ok(MANAGEABLE_PAGES.some(([id]) => id === "presentations"));
  });

  it("respects hidden and read-only settings for presidents and CAS members", function () {
    for (const role of ["Presidente", "CAS"]) {
      for (const [configured, expected] of [
        [{ view: false, edit: true }, { view: false, edit: false }],
        [{ view: true, edit: false }, { view: true, edit: false }],
        [{ view: true, edit: true }, { view: true, edit: true }],
      ]) {
        assert.deepStrictEqual(getPagePermission({ role, pagePermissions: { presentations: configured } }, "presentations"), expected);
      }
    }
  });

  it("allows presidents to view and manage presentations", function () {
    assert.deepStrictEqual(getPagePermission({ role: "Presidente" }, "presentations"), { view: true, edit: true });
  });

  it("keeps presentation management available to CAS members", function () {
    assert.deepStrictEqual(getPagePermission({ role: "CAS" }, "presentations"), { view: true, edit: true });
  });

  it("keeps presentations unavailable to GVP and unauthenticated users", function () {
    for (const user of [{ role: "GVP" }, null]) {
      assert.deepStrictEqual(getPagePermission(user, "presentations"), { view: false, edit: false });
    }
  });
});
