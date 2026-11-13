const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

function fixture(existingUsername) {
  const source = fs.readFileSync(path.join(__dirname, "../server/main.js"), "utf8");
  const start = source.indexOf('  async "hlc.syncUsers"');
  const end = source.indexOf('\n});', start);
  const created = [];
  const env = {
    requireUser() {}, check() {},
    Meteor: {
      Error: class extends Error { constructor(code, reason) { super(reason); this.error = code; this.reason = reason; } },
      users: { findOneAsync: async (id) => id === "p" ? { _id: "p", profile: { role: "Presidente" } } : null, find: () => ({ fetchAsync: async () => [] }) },
    },
    Accounts: {
      findUserByUsername: async (username) => existingUsername?.toLowerCase() === username.toLowerCase() ? { _id: "hidden-account" } : null,
      createUserAsync: async (data) => { created.push(data); return "new-account"; },
    },
    formatUserName: (value) => value.trim(),
    getPagePermission: () => ({ edit: true }),
    isProtectedPresidentAccount: () => false,
  };
  const methods = new Function(...Object.keys(env), `return ({${source.slice(start, end)}});`)(...Object.values(env));
  return { created, run: (username) => methods["hlc.syncUsers"].call({ userId: "p" }, [{ id: "client-id", username, password: "example-password", role: "GVP", presidentId: "p", firstName: "Anna", email: "anna@example.it" }]) };
}

test("new GVP reports a globally occupied username without attempting account creation", async () => {
  const view = fixture("Test");
  await assert.rejects(view.run("test"), (error) => error.error === "username-exists" && /già in uso/.test(error.reason));
  assert.equal(view.created.length, 0);
});

test("available username creates a GVP with the supplied profile", async () => {
  const view = fixture("Another account");
  await view.run("New GVP");
  assert.equal(view.created.length, 1);
  assert.equal(view.created[0].profile.role, "GVP");
  assert.equal(view.created[0].profile.firstName, "Anna");
  assert.equal(view.created[0].profile.presidentId, "p");
});
