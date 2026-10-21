import assert from "assert";
import { buildUserProfileUpdate, hasUserProfileChanges } from "../imports/api/userProfileUpdates.js";
import { getPagePermission } from "../imports/constants/pagePermissions.js";

describe("individual permissions survive user profile updates", function () {
  for (const role of ["CAS", "GVP"]) {
    it(`retains different ${role} permissions when editing a member of the team`, function () {
      const first = { username: "First", profile: { role, firstName: "First", pagePermissions: { hospitals: { view: true, edit: false } } } };
      const second = { username: "Second", profile: { role, firstName: "Second", pagePermissions: { hospitals: { view: true, edit: true } } } };
      const applyUpdate = (account, modifier) => {
        for (const [path, value] of Object.entries(modifier.$set)) {
          if (path.startsWith("profile.")) account.profile[path.slice(8)] = value;
          else account[path] = value;
        }
      };
      const permissionsBefore = structuredClone([first.profile.pagePermissions, second.profile.pagePermissions]);
      applyUpdate(first, buildUserProfileUpdate("First", { role, firstName: "Updated" }));
      applyUpdate(second, buildUserProfileUpdate("Second", { role, firstName: "Second" }));
      assert.strictEqual(first.profile.firstName, "Updated");
      assert.deepStrictEqual([first.profile.pagePermissions, second.profile.pagePermissions], permissionsBefore);
      assert.deepStrictEqual(getPagePermission(first.profile, "hospitals"), { view: true, edit: false });
      assert.deepStrictEqual(getPagePermission(second.profile, "hospitals"), { view: true, edit: true });
    });
  }

  it("does not overwrite a permission change made after the user form was loaded", function () {
    const staleAccount = { username: "CAS", profile: { role: "CAS", firstName: "Before", pagePermissions: { gvp: { view: true, edit: true } } } };
    const modifier = buildUserProfileUpdate(staleAccount.username, { role: "CAS", firstName: "After" });
    assert.strictEqual(modifier.$set.profile, undefined);
    assert.strictEqual(modifier.$set["profile.pagePermissions"], undefined);
    assert.ok(Object.keys(modifier.$set).every((path) => !path.startsWith("profile.pagePermissions")));
    assert.strictEqual(modifier.$set["profile.firstName"], "After");
  });

  it("does not rewrite unchanged teammates just because their profiles contain permissions or preferences", function () {
    const account = { username: "CAS", profile: { role: "CAS", firstName: "Name", pagePermissions: { permissions: { view: false, edit: false } }, emailNotifications: true } };
    assert.strictEqual(hasUserProfileChanges(account, "CAS", { role: "CAS", firstName: "Name" }), false);
    assert.strictEqual(hasUserProfileChanges(account, "CAS", { role: "CAS", firstName: "Other" }), true);
    assert.strictEqual(hasUserProfileChanges(account, "Other", { role: "CAS", firstName: "Name" }), true);
  });
});
