const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");
const parser = require("@babel/parser");
const babel = require("@babel/core");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const source = fs.readFileSync(require.resolve("../server/main.js"), "utf8");
const ast = parser.parse(source, { sourceType: "module" });
const calls = ast.program.body.filter((node) => node.expression?.callee?.object?.name === "Meteor").map((node) => node.expression);
const methods = calls.find((call) => call.callee.property.name === "methods").arguments[0];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const method = (name, dependencies, args) => {
  const node = methods.properties.find((item) => item.key.value === name);
  return new AsyncFunction(...dependencies, ...args, source.slice(node.body.start + 1, node.body.end - 1));
};
const guard = async (context) => { if (context.role !== "Admin") throw new Error("not-authorized"); };
const Meteor = { Error: class extends Error { constructor(code, message) { super(message); this.error = code; } } };

test("publication sends drafts only to Admin and requires explicit approval for everyone else", async () => {
  const node = calls.find((call) => call.callee.property.name === "publish" && call.arguments[0].value === "hlc-software-updates").arguments[1];
  const publish = new AsyncFunction("Meteor", "SoftwareUpdatesCollection", source.slice(node.body.start + 1, node.body.end - 1));
  for (const role of ["Admin", "Presidente", "CAS", "GVP"]) {
    const selector = await publish.call({ userId: role }, { users: { findOneAsync: async () => ({ profile: { role } }) } }, { find: (query) => query });
    assert.equal(selector.deleted.$ne, true);
    if (role === "Admin") assert.equal("approved" in selector, false);
    else assert.equal(selector.approved, true);
  }
  assert.equal(await publish.call({ ready: () => "ready" }, {}, {}), "ready");
  assert.equal(await publish.call({ userId: "missing", ready: () => "ready" }, { users: { findOneAsync: async () => null } }, {}), "ready");
});

test("only Admin can approve, approval is recorded once and deleted entries cannot be approved", async () => {
  const approve = method("hlc.approveSoftwareUpdate", ["requireAdmin", "check", "SoftwareUpdatesCollection", "Meteor"], ["updateId"]);
  const writes = [];
  let matched = 1;
  let existing = null;
  const collection = { updateAsync: async (...args) => { writes.push(args); return matched; }, findOneAsync: async () => existing };
  const run = (role) => approve.call({ role, userId: "admin-1" }, guard, () => {}, collection, Meteor, "1.0.1");
  for (const role of ["Presidente", "CAS", "GVP", undefined]) await assert.rejects(run(role), /not-authorized/);
  assert.equal(writes.length, 0);
  await run("Admin");
  assert.deepEqual(writes[0][0], { _id: "1.0.1", deleted: { $ne: true }, approved: { $ne: true } });
  assert.equal(writes[0][1].$set.approved, true);
  assert.equal(writes[0][1].$set.approvedBy, "admin-1");
  assert.ok(writes[0][1].$set.approvedAt instanceof Date);
  matched = 0;
  existing = { approved: true };
  await run("Admin");
  existing = null;
  await assert.rejects(run("Admin"), (error) => error.error === "software-update-not-found");
});

test("drafts cannot be marked as read before approval", async () => {
  const mark = method("hlc.markSoftwareUpdatesSeen", ["requireUser", "check", "SoftwareUpdatesCollection", "SoftwareUpdateReadsCollection"], ["updateIds"]);
  let writes = 0;
  await mark.call({ userId: "admin-1" }, () => {}, () => {}, {
    find: (query) => {
      assert.equal(query.approved, true);
      assert.equal(query.deleted.$ne, true);
      return { fetchAsync: async () => [] };
    },
  }, { upsertAsync: async () => { writes += 1; } }, ["draft"]);
  assert.equal(writes, 0);
});

test("startup inserts pending updates and never replaces an existing approval", async () => {
  const startup = calls.find((call) => call.callee.property.name === "startup").arguments[0];
  const loop = startup.body.body[0];
  const seed = new AsyncFunction("SOFTWARE_UPDATES", "SoftwareUpdatesCollection", source.slice(loop.start, loop.end));
  const rows = new Map([["1.0.0", { approved: true, summary: "Edited by Admin" }]]);
  await seed([{ version: "1.0.0", summary: "Original" }, { version: "1.0.1", approved: true }], {
    upsertAsync: async (id, modifier) => { if (!rows.has(id)) rows.set(id, modifier.$setOnInsert); },
  });
  assert.deepEqual(rows.get("1.0.0"), { approved: true, summary: "Edited by Admin" });
  assert.equal(rows.get("1.0.1").approved, false);
});

const load = (file, dependencies) => {
  const code = babel.transformSync(fs.readFileSync(require.resolve(file), "utf8"), {
    babelrc: false, configFile: false,
    plugins: [["@babel/plugin-transform-react-jsx", { runtime: "automatic" }], "@babel/plugin-transform-modules-commonjs"],
  }).code;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (id) => dependencies[id] || require(id), Intl, Date, console });
  return exports;
};

test("badge keeps Admin drafts pending and makes approved messages unread for other users", () => {
  let entries = [{ _id: "draft", approved: false }];
  let seenIds = [];
  let effects = [];
  const marked = [];
  const { useSoftwareUpdateBadge } = load("../client/templates/useSoftwareUpdateBadge.js", {
    react: { useEffect: (fn) => effects.push(fn) },
    "meteor/meteor": { Meteor: { subscribe: () => ({ ready: () => true }), call: (name, ids) => marked.push(...ids) } },
    "meteor/react-meteor-data": { useTracker: (fn) => fn() },
    "../../imports/api/links.js": {
      SoftwareUpdatesCollection: { find: () => ({ fetch: () => entries }) },
      SoftwareUpdateReadsCollection: { findOne: () => ({ seenIds }) },
    },
  });
  const badge = (view) => { effects = []; const count = useSoftwareUpdateBadge("user", view); effects.forEach((fn) => fn()); return count; };
  assert.equal(badge("updates"), 1);
  assert.deepEqual(marked, []);
  entries = []; // The server does not publish drafts to ordinary users.
  assert.equal(badge("home"), 0);
  entries = [{ _id: "draft", approved: true }];
  assert.equal(badge("home"), 1);
  assert.equal(badge("updates"), 1);
  assert.deepEqual(marked, ["draft"]);
  seenIds = ["draft"];
  assert.equal(badge("home"), 0);
});

test("Admin sees Approva for pending messages and approval is disabled while editing", () => {
  let approved = false;
  let stateIndex = 0;
  let editingId = null;
  const dependencies = {
    react: { useState: () => [["", null, editingId, "Title", "Text", false, null][stateIndex++], () => {}] },
    "meteor/meteor": { Meteor: { subscribe: () => ({ ready: () => true }) } },
    "meteor/react-meteor-data": { useTracker: (fn) => fn() },
    "../../imports/api/links.js": { SoftwareUpdatesCollection: { find: () => ({ fetch: () => [{ _id: "v1", version: "1.0.1", date: "2026-11-06", summary: "Title", changes: ["Text"], approved }] }) } },
    "../../imports/constants/softwareVersion.js": { SOFTWARE_VERSION: "1.0.1" },
    "./ConfirmDialog.js": { confirmAction: async () => true },
  };
  const { Updates } = load("../client/templates/Updates.js", dependencies);
  const render = (role) => { stateIndex = 0; return renderToStaticMarkup(React.createElement(Updates, { currentUser: { role } })); };
  assert.match(render("Admin"), /Approva aggiornamento versione/);
  assert.doesNotMatch(render("GVP"), /Approva aggiornamento versione/);
  editingId = "v1";
  assert.match(render("Admin"), /disabled=""[^>]*aria-label="Approva aggiornamento/);
  editingId = null;
  approved = true;
  assert.doesNotMatch(render("Admin"), /Approva aggiornamento versione/);
  assert.match(render("Admin"), /Approvato/);
});
