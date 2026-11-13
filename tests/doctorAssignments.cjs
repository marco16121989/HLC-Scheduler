const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const swc = require("@swc/core");
const React = require("react");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function fixture(initialCasIds) {
  let doctors = [{ id: "d", presidentId: "p", firstName: "Mario", lastName: "Rossi", departmentIds: ["dep"], ...(initialCasIds ? { casIds: initialCasIds } : {}) }];
  const users = [
    { id: "p", role: "Presidente", username: "Presidente" },
    { id: "c1", role: "CAS", presidentId: "p", username: "Anna" },
    { id: "c2", role: "CAS", associationId: "p", username: "Luca" },
    { id: "foreign", role: "CAS", presidentId: "other", username: "Esterno" },
    { id: "g", role: "GVP", presidentId: "p", username: "GVP" },
  ];
  const state = [];
  let cursor = 0;
  const fakeReact = { ...React, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } };
  const mod = { exports: {} };
  const { code } = swc.transformSync(read("client/templates/Doctors.js"), { jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" } });
  new Function("require", "module", "exports", code)((name) => {
    if (name === "react") return fakeReact;
    if (name === "./Pagination.js") return { usePagination: (items) => ({ pageItems: items }), PaginationControls: () => null };
    if (name === "./CasRoleBadge.js") return { formatCasUserLabel: (user) => user.username };
    if (name.startsWith("./")) return {};
    return require(name);
  }, mod, mod.exports);
  function render() {
    cursor = 0;
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(mod.exports.Doctors({ doctors, setDoctors: (update) => { doctors = update(doctors); }, users, hospitals: [{ id: "h", presidentId: "p", name: "Ospedale", departments: [{ id: "dep", name: "Reparto" }] }], presidentId: "p", currentUser: users[0] }));
    return nodes;
  }
  const edit = () => render().find((node) => node.type === "tr" && node.key === "d").props.onClick();
  const select = (id, checked) => render().find((node) => node.props?.id === `doctor-cas-${id}`).props.onChange({ target: { checked } });
  const save = () => render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  return { render, edit, select, save, records: () => doctors };
}

test("assigns multiple CAS, retains selections on reopening, and displays their names", () => {
  const view = fixture();
  assert.ok(view.render().some((node) => node.props?.children === "Non assegnato"));
  view.edit();
  assert.ok(!view.render().some((node) => ["doctor-cas-foreign", "doctor-cas-g"].includes(node.props?.id)));
  view.select("c1", true);
  view.select("c2", true);
  view.save();
  assert.deepEqual(view.records()[0].casIds, ["c1", "c2"]);
  const cell = view.render().find((node) => node.props?.["data-label"] === "CAS assegnato");
  assert.match(JSON.stringify(cell), /Anna/);
  assert.match(JSON.stringify(cell), /Luca/);
  view.edit();
  assert.equal(view.render().find((node) => node.props?.id === "doctor-cas-c1").props.checked, true);
  view.select("c1", false);
  view.save();
  assert.deepEqual(view.records()[0].casIds, ["c2"]);
  view.edit();
  view.select("c2", false);
  view.save();
  assert.deepEqual(view.records()[0].casIds, []);
});

test("server accepts organization CAS and rejects unknown, foreign and GVP assignments", async () => {
  const source = read("server/main.js");
  const block = source.slice(source.indexOf("const validateDoctorAssignments ="), source.indexOf("const validatePatientAssignments ="));
  const users = [
    { _id: "p", profile: { role: "Presidente", presidentId: "p" } },
    { _id: "c1", profile: { role: "CAS", presidentId: "p" } },
    { _id: "c2", profile: { role: "CAS", presidentId: "p" } },
    { _id: "foreign", profile: { role: "CAS", presidentId: "other" } },
    { _id: "gvp", profile: { role: "GVP", presidentId: "p" } },
  ];
  const validate = new Function("Meteor", "check", "publicUserFields", "getActorPresidentId", `${block}; return validateDoctorAssignments;`)(
    { users: { find: (selector) => ({ fetchAsync: async () => users.filter((user) => selector._id.$in.includes(user._id)) }) }, Error: class extends Error { constructor(code, message) { super(message); } } },
    (value) => { assert.ok(Array.isArray(value) && value.every((id) => typeof id === "string")); }, {}, async (user) => user.profile.presidentId,
  );
  await validate([{ presidentId: "p" }, { presidentId: "p", casIds: [] }, { presidentId: "p", casIds: ["p", "c1", "c2", "c1"] }]);
  for (const id of ["foreign", "gvp", "unknown"]) {
    await assert.rejects(validate([{ presidentId: "p", casIds: ["c1", id] }]), /CAS non valido/);
  }
  for (const method of ["hlc.replaceRecords", "hlc.applyRecordChanges"]) {
    const start = source.indexOf(`async "${method}"`);
    const end = source.indexOf('\n  async "', start + 1);
    assert.match(source.slice(start, end), /if \(kind === "doctors"\) await validateDoctorAssignments/);
  }
});
