const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const swc = require("@swc/core");
const XLSX = require("xlsx");
const React = require("react");
const root = path.join(__dirname, "..");
function load(file, overrides = {}) {
  const mod = { exports: {} };
  const { code } = swc.transformSync(fs.readFileSync(path.join(root, file), "utf8"), { jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" } });
  new Function("require", "module", "exports", code)((name) => {
    if (overrides[name]) return overrides[name];
    if (name.startsWith("/imports/")) return load(name.slice(1), overrides);
    if (name.startsWith(".")) return load(path.join(path.dirname(file), name), overrides);
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const helpers = load("imports/api/departmentExcelImport.js");
const { normalizeImportValue } = load("imports/api/doctorExcelImport.js");
const { getPagePermission } = load("imports/constants/pagePermissions.js");

test("parses a single named column, skips empty rows and preserves original row numbers", () => {
  assert.deepEqual(helpers.parseDepartmentImportRows([[], [" Reparto "], [" Cardiologia "], [], ["Chirurgia"]], 3), [
    { rowNumber: 5, name: "Cardiologia" }, { rowNumber: 7, name: "Chirurgia" },
  ]);
  for (const matrix of [[], [["Reparto"]], [["Altro"], ["Cardiologia"]], [["Reparto", "Ospedale"], ["Cardiologia"]], [["Reparto"], ["Cardiologia", "Extra"]]]) {
    assert.throws(() => helpers.parseDepartmentImportRows(matrix));
  }
});
test("marks existing and repeated normalized names as skipped and catches edited empty names", () => {
  const result = helpers.getDepartmentImportPreview([{ name: "  CARDIOLOGIA " }, { name: "Chirurgia" }, { name: "chirurgìa" }, { name: " " }], [{ name: "Cardiologia" }]);
  assert.deepEqual(result.map((row) => row.ready), [false, true, false, false]);
  assert.match(result[3].issue, /mancante/);
});
for (const bookType of ["xlsx", "biff8"]) test(`reads a real ${bookType} workbook`, () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Reparto"], ["Cardiologia"]]), "Reparti");
  const read = XLSX.read(XLSX.write(workbook, { type: "buffer", bookType }), { type: "buffer" });
  assert.equal(helpers.parseDepartmentImportRows(XLSX.utils.sheet_to_json(read.Sheets.Reparti, { header: 1 }))[0].name, "Cardiologia");
});

function componentFixture({ canImport = true, fail = false } = {}) {
  const state = [];
  let cursor = 0;
  const calls = [];
  const fakeReact = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  }, useRef(initial) { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; } };
  const { DepartmentExcelImport } = load("client/templates/DepartmentExcelImport.js", {
    react: fakeReact,
    "meteor/meteor": { Meteor: { callAsync: async (...args) => { calls.push(args); if (fail) throw Error("Erreur serveur"); return { imported: args[1].length, skipped: 0 }; } } },
  });
  function render() {
    cursor = 0;
    const nodes = [];
    function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== "object") return; nodes.push(node); visit(node.props?.children); }
    visit(DepartmentExcelImport({ departments: [{ name: "Cardiologia", presidentId: "p" }, { name: "Chirurgia", presidentId: "other" }], presidentId: "p", canImport, onBack() {} }));
    return nodes;
  }
  async function upload() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Reparto"], ["Cardiologia"], ["Chirurgia"], ["Neurologia"]]), "Reparti");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    await render().find((node) => node.props?.id === "department-excel-file").props.onChange({ target: { files: [{ name: "reparti.xlsx", arrayBuffer: async () => bytes }] } });
  }
  return { render, upload, calls };
}
test("preview supports editing and deleting rows and imports only new remaining departments", async () => {
  const view = componentFixture();
  await view.upload();
  view.render().find((node) => node.props?.["aria-label"] === "Elimina riga Excel 4").props.onClick();
  view.render().find((node) => node.props?.["aria-label"] === "Reparto per la riga 3").props.onChange({ target: { value: "Chirurgia generale" } });
  await view.render().find((node) => node.props?.children === "Importa reparti").props.onClick();
  assert.deepEqual(view.calls, [["hlc.importDepartments", ["Chirurgia generale"]]]);
  assert.ok(view.render().some((node) => node.props?.role === "status"));
});
test("view-only preview cannot import and a failed save keeps the preview for retry", async () => {
  for (const options of [{ canImport: false }, { fail: true }]) {
    const view = componentFixture(options);
    await view.upload();
    const button = view.render().find((node) => node.props?.children === "Importa reparti");
    if (options.canImport === false) assert.equal(button.props.disabled, true);
    await button.props.onClick();
    assert.equal(view.calls.length, options.fail ? 1 : 0);
    assert.ok(view.render().some((node) => node.props?.["aria-label"] === "Reparto per la riga 3"));
  }
});

function serverFixture({ permission = { view: true, edit: true }, presidentId = "p" } = {}) {
  const source = fs.readFileSync(path.join(root, "server/main.js"), "utf8");
  const start = source.indexOf('  async "hlc.importDepartments"');
  const end = source.indexOf('  async "hlc.importDoctors"', start);
  const inserted = [];
  const env = {
    requireUser() {}, check() {}, normalizeImportValue,
    Meteor: { Error: class extends Error { constructor(code, message) { super(message); } }, users: { findOneAsync: async () => ({ profile: { role: "CAS", pagePermissions: { departments: permission } } }) } },
    requirePageEdit(actor, page) { if (!getPagePermission(actor.profile, page).edit) throw Error("Permesso negato"); },
    getActorPresidentId: async () => presidentId,
    DepartmentsCollection: { find: (selector) => { assert.equal(selector.presidentId, "p"); return { fetchAsync: async () => [{ name: "Cardiologia" }] }; }, insertAsync: async (record) => inserted.push(record) },
    Random: { id: () => "new-id" },
  };
  const methods = new Function(...Object.keys(env), `return ({${source.slice(start, end)}});`)(...Object.values(env));
  return { inserted, run: (names) => methods["hlc.importDepartments"].call({ userId: "actor" }, names) };
}
test("server imports within the actor's organization, skips duplicates, and validates before inserting", async () => {
  const view = serverFixture();
  assert.deepEqual(await view.run(["CARDIOLOGIA", " Chirurgia ", "chirurgìa"]), { imported: 1, skipped: 2 });
  assert.deepEqual(view.inserted, [{ _id: "new-id", name: "Chirurgia", presidentId: "p" }]);
  const invalid = serverFixture();
  await assert.rejects(invalid.run(["Neurologia", " "]));
  assert.equal(invalid.inserted.length, 0);
  await assert.rejects(serverFixture({ permission: { view: true, edit: false } }).run(["Chirurgia"]), /Permesso negato/);
  await assert.rejects(serverFixture({ presidentId: "" }).run(["Chirurgia"]), /Organizzazione/);
  assert.deepEqual(getPagePermission({ role: "CAS" }, "departments-import"), getPagePermission({ role: "CAS" }, "departments"));
});
