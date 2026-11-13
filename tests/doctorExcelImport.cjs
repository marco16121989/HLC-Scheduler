const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const swc = require("@swc/core");
const XLSX = require("xlsx");
const React = require("react");

const load = (file, customRequire = require) => {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const { code } = swc.transformSync(source, { jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" } });
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)(customRequire, mod, mod.exports);
  return mod.exports;
};
const helpers = load("imports/api/doctorExcelImport.js");
const { getPagePermission, MANAGEABLE_PAGES } = load("imports/constants/pagePermissions.js");
const { parseDoctorImportRows, getDoctorImportIssues, buildDoctorImportRecords, rankDoctorImportOptions, isDoctorImportCellMissing } = helpers;
const hospitals = [
  { id: "h1", presidentId: "p1", name: "Ospedale San Carlo", departments: [{ id: "d1", name: "Cardiologia" }, { id: "d2", name: "Medicina interna" }] },
  { id: "h2", presidentId: "p1", name: "Ospedale Maggiore", departments: [{ id: "d3", name: "Chirurgia" }] },
];
const headers = ["Cognome", "Nome", "Ospedale", "Reparto", "Telefono", "Email", "Note"];
const mario = ["Rossi", "Mario", "Ospedale San Carlo", "Cardiologia", "03331234567", "mario@example.it"];
const parse = (...rows) => parseDoctorImportRows([headers, ...rows], hospitals);
const build = (rows, doctors = []) => buildDoctorImportRecords({ rows, hospitals, doctors, presidentId: "p1", createId: () => "new-id" });

test("matches exact normalized names and keeps original values and Excel row numbers", () => {
  const [row] = parseDoctorImportRows([[], headers, ["Rossi", "Mario", "  OSPEDALE  SAN CARLO ", "Cardiologìa", "03331234567"], [], ["Bianchi", "Anna", "Ospedale Maggiore", "Chirurgia"]], hospitals, 4);
  assert.equal(row.rowNumber, 6);
  assert.equal(row.hospitalId, "h1");
  assert.equal(row.departmentId, "d1");
  assert.equal(row.hospitalName, "OSPEDALE  SAN CARLO");
  assert.equal(row.phone, "03331234567");
});

test("unknown, empty, abbreviated and ambiguous values stay unresolved", () => {
  for (const value of ["", "San Carlo", "Ospedale inesistente"]) {
    const [row] = parse(["Rossi", "Mario", value, "Cardiologia"]);
    assert.equal(row.hospitalId, "");
    assert.ok(getDoctorImportIssues(row, hospitals).length);
  }
  const [unknownDepartment] = parse(["Rossi", "Mario", "Ospedale San Carlo", "Chirurgia"]);
  assert.equal(unknownDepartment.hospitalId, "h1");
  assert.equal(unknownDepartment.departmentId, "");
  const [ambiguous] = parseDoctorImportRows([headers, mario], [...hospitals, { ...hospitals[0], id: "duplicate" }]);
  assert.equal(ambiguous.hospitalId, "");
});

test("manual mapping resolves original unrecognized values and enforces hospital ownership of department", () => {
  const [row] = parse(["Rossi", "Mario", "Nome ospedale sconosciuto", "Reparto sconosciuto"]);
  assert.throws(() => build([row]), /Riga 2/);
  const resolved = { ...row, hospitalId: "h2", departmentId: "d3" };
  assert.deepEqual(getDoctorImportIssues(resolved, hospitals), []);
  assert.deepEqual(build([resolved])[0].departmentIds, ["d3"]);
  assert.equal(resolved.hospitalName, "Nome ospedale sconosciuto");
  assert.throws(() => build([{ ...resolved, hospitalId: "h1" }]), /Reparto/);
});

test("repeated doctors become one doctor with all distinct departments", () => {
  const records = build(parse(mario, ["Rossi", "Mario", "Ospedale Maggiore", "Chirurgia", "03331234567", "mario@example.it"], mario));
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].departmentIds, ["d1", "d3"]);
  assert.equal(records[0].presidentId, "p1");
});

test("blocks incomplete names, invalid headers, existing doctors, reused emails and conflicting contacts", () => {
  assert.throws(() => parse(["Rossi", "", "Ospedale San Carlo", "Cardiologia"]).map((row) => build([row])), /Nome/);
  assert.throws(() => parseDoctorImportRows([["Nome"]], hospitals), /Colonna mancante/);
  assert.throws(() => parseDoctorImportRows([[...headers, "Nome"], mario], hospitals), /duplicate/);
  assert.throws(() => build(parse(mario), [{ presidentId: "p1", firstName: "Mario", lastName: "Rossi" }]), /già presente/);
  assert.throws(() => build(parse(mario), [{ firstName: "Altro", email: "MARIO@example.it" }]), /email/);
  assert.throws(() => build(parse(mario, [...mario.slice(0, 4), "999", "mario@example.it"])), /contatti diversi/);
});

for (const bookType of ["xlsx", "biff8"]) {
  test(`reads real ${bookType} workbook preserving text phone numbers`, () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, mario]), "Medici");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType });
    const read = XLSX.read(bytes, { type: "buffer" });
    const rows = parseDoctorImportRows(XLSX.utils.sheet_to_json(read.Sheets.Medici, { header: 1, raw: false, defval: "", blankrows: true }), hospitals);
    assert.equal(rows[0].phone, "03331234567");
    assert.equal(build(rows).length, 1);
  });
}

function componentFixture({ failSave = false, doctors = [], canImport = true } = {}) {
  const state = [];
  let cursor = 0;
  const calls = [];
  const fakeReact = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
  };
  const { DoctorExcelImport } = load("client/templates/DoctorExcelImport.js", (name) => {
    if (name === "react") return fakeReact;
    if (name === "/imports/api/doctorExcelImport.js") return helpers;
    if (name === "meteor/meteor") return { Meteor: { callAsync: async (...args) => { calls.push(args); if (failSave) throw Error("Errore server"); } } };
    return require(name);
  });
  function render() {
    cursor = 0;
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(DoctorExcelImport({ hospitals: [...hospitals, { id: "hidden", presidentId: "other", name: "Privato" }], doctors, presidentId: "p1", canImport, onBack() {} }));
    return { find: (predicate) => nodes.find(predicate), nodes };
  }
  async function upload(data, columnHeaders = headers) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columnHeaders, ...data]), "Medici");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    await render().find((node) => node.props?.id === "doctor-excel-file").props.onChange({ target: { files: [{ name: "medici.xlsx", arrayBuffer: async () => bytes }] } });
  }
  return { render, upload, calls };
}

test("profession conflicts are alerted before import and clear after correction in the grouped preview", async () => {
  const fixture = componentFixture();
  await fixture.upload([
    [...mario, "", "Medico"],
    ["Bianchi", "Anna", "Ospedale Maggiore", "Chirurgia", "", "", "", "Chirurgo"],
    [" ROSSI ", "mario", "Ospedale Maggiore", "Chirurgia", "03331234567", "mario@example.it", "", "Chirurgo"],
  ], [...headers, "Professione"]);
  let view = fixture.render();
  const dataRows = () => fixture.render().nodes.filter((node) => node.type === "tr" && node.key !== null);
  assert.deepEqual(dataRows().map((node) => node.key), ["2", "4", "3"]);
  assert.equal(dataRows().filter((node) => node.props.children[1].at(-1).props.className === "doctor-import-cell-invalid").length, 2);
  assert.ok(dataRows().every((node) => node.props.className === undefined));
  assert.ok(dataRows().every((node) => node.props.children[1][0].props.className === "doctor-import-cell-valid"));
  const alert = view.find((node) => node.props?.role === "alert");
  assert.match(JSON.stringify(alert), /Professioni diverse per Rossi Mario/);
  assert.match(JSON.stringify(alert), /righe Excel: 2, 4/);
  let button = view.find((node) => node.type === "button" && node.props.children === "Importa medici");
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.equal(fixture.calls.length, 0);
  assert.match(JSON.stringify(fixture.render().find((node) => node.type === "dialog")), /Professioni diverse per Rossi Mario/);
  fixture.render().find((node) => node.props?.["aria-label"] === "Chiudi elenco problemi").props.onClick();
  view.find((node) => node.props?.["aria-label"] === "Modifica professione per la riga 4").props.onClick();
  fixture.render().find((node) => node.props?.id === "doctor-import-edit-value").props.onChange({ target: { value: "Medico" } });
  fixture.render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  view = fixture.render();
  assert.equal(view.find((node) => node.props?.role === "alert"), undefined);
  button = view.find((node) => node.type === "button" && node.props.children === "Importa medici");
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0][1].length, 2);
  assert.equal(fixture.calls[0][1][0].professionalRole, "Medico");
  assert.deepEqual(fixture.calls[0][1][0].departmentIds, ["d1", "d3"]);
});

test("matching or empty professions do not conflict and conflicting professions still block record creation", () => {
  const rows = parse(mario, mario, mario);
  rows[0].professionalRole = "Medico";
  rows[1].professionalRole = "Medico";
  assert.equal(helpers.getDoctorImportRoleConflicts(rows).size, 0);
  rows[1].professionalRole = "Anestesista";
  assert.equal(helpers.getDoctorImportRoleConflicts(rows).size, 3);
  assert.throws(() => build(rows), /professioni diverse/);
});

test("UI flags unmapped rows, allows manual mapping and saves only after resolving", async () => {
  const fixture = componentFixture();
  await fixture.upload([["Rossi", "Mario", "Sconosciuto", "Altro reparto"]]);
  let view = fixture.render();
  const importButton = () => fixture.render().find((node) => node.type === "button" && node.props.children === "Importa medici");
  assert.equal(importButton().props.disabled, false);
  const statusCell = view.find((node) => node.type === "tbody").props.children[0].props.children[2];
  const problemLabels = statusCell.props.children[0].props.children;
  assert.equal(statusCell.props.children[0].props.className, "d-flex flex-column align-items-start gap-1");
  assert.deepEqual(problemLabels.map((node) => node.props.children), ["Ospedale non riconosciuto o ambiguo", "Reparto non riconosciuto o ambiguo"]);
  assert.ok(problemLabels.every((node) => node.props.className.includes("text-bg-danger")));
  assert.equal(view.find((node) => node.props?.["aria-label"] === "Reparto per la riga 2").props.disabled, true);
  const hospitalSelect = view.find((node) => node.props?.["aria-label"] === "Ospedale per la riga 2");
  assert.ok(!JSON.stringify(hospitalSelect).includes("Privato"));
  hospitalSelect.props.onChange({ target: { value: "h2" } });
  view = fixture.render();
  assert.deepEqual(view.find((node) => node.type === "tbody").props.children[0].props.children[1].slice(0, 4).map((node) => node.props.className), [
    "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-invalid",
  ]);
  const departmentSelect = view.find((node) => node.props?.["aria-label"] === "Reparto per la riga 2");
  assert.ok(!JSON.stringify(departmentSelect).includes("Cardiologia"));
  departmentSelect.props.onChange({ target: { value: "d3" } });
  assert.ok(fixture.render().find((node) => node.type === "tbody").props.children[0].props.children[1].slice(0, 4).every((node) => node.props.className === "doctor-import-cell-valid"));
  assert.equal(importButton().props.disabled, false);
  await importButton().props.onClick();
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0][0], "hlc.importDoctors");
  assert.deepEqual(fixture.calls[0][1][0].departmentIds, ["d3"]);
  assert.ok(fixture.render().find((node) => node.props?.children === "1 medico importato."));
});

test("selected associations become text and pencil buttons, with modal confirmation and cancellation", async () => {
  const fixture = componentFixture();
  await fixture.upload([[...mario, "", "Dottore"]], [...headers, "Professione"]);
  let view = fixture.render();
  view.find((node) => node.props?.["aria-label"] === "Professione per la riga 2").props.onChange({ target: { value: "Medico" } });
  view = fixture.render();
  for (const label of ["Ospedale", "Reparto", "Professione"]) {
    assert.equal(view.find((node) => node.props?.["aria-label"] === `${label} per la riga 2`), undefined);
    assert.ok(view.find((node) => node.props?.["aria-label"] === `Modifica ${label.toLowerCase()} per la riga 2`));
  }
  const edit = (field) => fixture.render().find((node) => node.props?.["aria-label"] === `Modifica ${field} per la riga 2`).props.onClick();
  const select = (value) => fixture.render().find((node) => node.props?.id === "doctor-import-edit-value").props.onChange({ target: { value } });
  const confirm = () => fixture.render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  edit("professione");
  assert.ok(fixture.render().find((node) => node.type === "dialog"));
  assert.equal(fixture.render().find((node) => node.props?.id === "doctor-import-edit-value").props.value, "Medico");
  select("Anestesista");
  fixture.render().find((node) => node.type === "button" && node.props.children === "Annulla").props.onClick();
  assert.equal(fixture.render().find((node) => node.type === "dialog"), undefined);
  assert.ok(fixture.render().find((node) => node.type === "span" && node.props.children === "Medico"));
  edit("professione");
  select("Chirurgo");
  confirm();
  edit("reparto");
  select("d2");
  confirm();
  assert.ok(fixture.render().find((node) => node.type === "span" && node.props.children === "Medicina interna"));
  edit("ospedale");
  assert.ok(!JSON.stringify(fixture.render().find((node) => node.props?.id === "doctor-import-edit-value")).includes("Privato"));
  select("h2");
  confirm();
  view = fixture.render();
  assert.ok(view.find((node) => node.type === "span" && node.props.children === "Ospedale Maggiore"));
  const departmentSelect = view.find((node) => node.props?.["aria-label"] === "Reparto per la riga 2");
  assert.equal(departmentSelect.props.value, "");
  assert.ok(!JSON.stringify(departmentSelect).includes("Medicina interna"));
  assert.equal(view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.disabled, false);
  departmentSelect.props.onChange({ target: { value: "d3" } });
  view = fixture.render();
  assert.equal(view.find((node) => node.props?.["aria-label"] === "Reparto per la riga 2"), undefined);
  await view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.onClick();
  assert.equal(fixture.calls[0][1][0].professionalRole, "Chirurgo");
  assert.deepEqual(fixture.calls[0][1][0].departmentIds, ["d3"]);
});

test("import opens a modal listing every unresolved row and issue, then saves after corrections", async () => {
  const fixture = componentFixture();
  await fixture.upload([
    [...mario, "", "Medico"],
    ["Bianchi", "Anna", "Sconosciuto", "Altro reparto", "", "", "", ""],
  ], [...headers, "Professione"]);
  const importButton = () => fixture.render().find((node) => node.type === "button" && node.props.children === "Importa medici");
  assert.equal(importButton().props.disabled, false);
  await importButton().props.onClick();
  let view = fixture.render();
  const modal = view.find((node) => node.type === "dialog");
  assert.equal(modal.props["aria-labelledby"], "doctor-import-problems-title");
  const items = modal.props.children[2].props.children;
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].props.children[0].props.children, ["Riga Excel ", 3, " · Bianchi Anna"]);
  assert.deepEqual(items[0].props.children[1].props.children.map((node) => node.props.children), [
    "Professione mancante", "Ospedale non riconosciuto o ambiguo", "Reparto non riconosciuto o ambiguo",
  ]);
  assert.equal(fixture.calls.length, 0);
  modal.props.onCancel();
  assert.equal(fixture.render().find((node) => node.type === "dialog"), undefined);
  view.find((node) => node.props?.["aria-label"] === "Ospedale per la riga 3").props.onChange({ target: { value: "h2" } });
  fixture.render().find((node) => node.props?.["aria-label"] === "Reparto per la riga 3").props.onChange({ target: { value: "d3" } });
  fixture.render().find((node) => node.props?.["aria-label"] === "Professione per la riga 3").props.onChange({ target: { value: "Chirurgo" } });
  await importButton().props.onClick();
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0][1].length, 2);
  assert.equal(fixture.render().find((node) => node.type === "dialog"), undefined);
});

test("record validation errors open the problems modal before any server call", async () => {
  const fixture = componentFixture({ doctors: [{ firstName: "Anna", lastName: "Bianchi", presidentId: "p1", email: mario[5] }] });
  await fixture.upload([mario]);
  await fixture.render().find((node) => node.type === "button" && node.props.children === "Importa medici").props.onClick();
  assert.equal(fixture.calls.length, 0);
  assert.match(JSON.stringify(fixture.render().find((node) => node.type === "dialog")), /associata a un altro medico/);
});

test("changing hospital clears an incompatible department", async () => {
  const fixture = componentFixture();
  await fixture.upload([["Rossi", "Mario", "San Carlo", "Cardiologia"]]);
  fixture.render().find((node) => node.props?.["aria-label"] === "Ospedale per la riga 2").props.onChange({ target: { value: "h2" } });
  const select = fixture.render().find((node) => node.props?.["aria-label"] === "Reparto per la riga 2");
  assert.equal(select.props.value, "");
  assert.ok(fixture.render().find((node) => node.props?.children === "Reparto non riconosciuto o ambiguo" && node.props.className.includes("text-bg-danger")));
});

test("server failure keeps the preview for retry and never shows success", async () => {
  const fixture = componentFixture({ failSave: true });
  await fixture.upload([mario]);
  await fixture.render().find((node) => node.type === "button" && node.props.children === "Importa medici").props.onClick();
  const view = fixture.render();
  assert.ok(view.find((node) => node.props?.role === "alert" && node.props.children === "Errore server"));
  assert.ok(view.find((node) => node.props?.id === "doctor-import-preview-title"));
  assert.ok(!view.find((node) => node.props?.children === "1 medico importato."));
});

test("existing doctors remain in the preview and are flagged before import", async () => {
  const fixture = componentFixture({ doctors: [{ id: "existing", presidentId: "p1", firstName: " MARIO ", lastName: "rossi" }] });
  await fixture.upload([mario, ["Bianchi", "Anna", "Ospedale Maggiore", "Chirurgia"]]);
  const view = fixture.render();
  assert.equal(view.nodes.filter((node) => node.type === "tbody")[0].props.children.length, 2);
  assert.ok(view.find((node) => node.props?.children === "Medico già presente"));
  assert.ok(view.find((node) => node.props?.children === "Medico già presente" && node.props.className.includes("text-bg-danger")));
  assert.deepEqual(view.find((node) => node.type === "tbody").props.children[0].props.children[1].slice(0, 4).map((node) => node.props.className), [
    "doctor-import-cell-invalid", "doctor-import-cell-invalid", "doctor-import-cell-valid", "doctor-import-cell-valid",
  ]);
  assert.ok(view.find((node) => node.props?.children === "Pronto"));
  assert.equal(view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.disabled, false);
  assert.equal(fixture.calls.length, 0);
});

test("a matching name in a different organization is not flagged as existing", () => {
  const [row] = parse(mario);
  assert.deepEqual(getDoctorImportIssues(row, hospitals, [{ presidentId: "other", firstName: "Mario", lastName: "Rossi" }], "p1"), []);
});

test("ranks hospital names by similarity despite abbreviations, typos and word order", () => {
  assert.equal(rankDoctorImportOptions(hospitals, "Osp. San Carllo")[0].id, "h1");
  assert.equal(rankDoctorImportOptions(hospitals, "Maggiore ospedale")[0].id, "h2");
  assert.equal(rankDoctorImportOptions(hospitals, "OSPEDALE SAN CARLO")[0].id, "h1");
  assert.deepEqual(hospitals.map((item) => item.id), ["h1", "h2"]);
});

test("ranks department typos and prefixes, keeps all options and alphabetizes empty queries", () => {
  const departments = [{ id: "c", name: "Chirurgia" }, { id: "m", name: "Medicina interna" }, { id: "a", name: "Cardiologia" }];
  assert.equal(rankDoctorImportOptions(departments, "Reparto di cardiolgia")[0].id, "a");
  assert.equal(rankDoctorImportOptions(departments, "medicina int")[0].id, "m");
  assert.equal(rankDoctorImportOptions(departments, "interna medicina")[0].id, "m");
  assert.equal(rankDoctorImportOptions(departments, "CARDIÒLOGIA").length, 3);
  assert.deepEqual(rankDoctorImportOptions(departments, "").map((item) => item.id), ["a", "c", "m"]);
});

test("UI suggests nearest options first without selecting unrecognized names", async () => {
  const fixture = componentFixture();
  await fixture.upload([["Rossi", "Mario", "Osp. Magiorre", "Chirurg"]]);
  let select = fixture.render().find((node) => node.props?.["aria-label"] === "Ospedale per la riga 2");
  assert.equal(select.props.children[1][0].props.value, "h2");
  assert.equal(select.props.value, "");
  select.props.onChange({ target: { value: "h1" } });
  select = fixture.render().find((node) => node.props?.["aria-label"] === "Reparto per la riga 2");
  assert.equal(select.props.value, "");
  assert.ok(!JSON.stringify(select).includes("Chirurgia"));
});

test("notes are optional and distinct notes on repeated doctor rows are preserved once", () => {
  const note = "Chiamare al mattino\nPreferisce email";
  const rows = parse([...mario, note], [...mario, note], [...mario, "Su appuntamento"]);
  assert.equal(rows[0].notes, note);
  assert.equal(build(rows)[0].notes, `${note}\nSu appuntamento`);
  const oldFormat = parseDoctorImportRows([headers.slice(0, -1), mario], hospitals);
  assert.equal(build(oldFormat)[0].notes, "");
});

test("notes appear in preview and are included in saved doctor records", async () => {
  const fixture = componentFixture();
  await fixture.upload([[...mario, "Chiamare al mattino"]]);
  const view = fixture.render();
  assert.ok(view.find((node) => node.type === "th" && node.props.children === "Note"));
  assert.ok(view.find((node) => node.type === "td" && node.props.children === "Chiamare al mattino"));
  await view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.onClick();
  assert.equal(fixture.calls[0][1][0].notes, "Chiamare al mattino");
});

test("profession after department is read and saved with contacts and notes in their own columns", async () => {
  const fixture = componentFixture();
  const columns = ["Cognome", "Nome", "Ospedale", "Reparto", "Professione", "Telefono", "Email", "Note"];
  await fixture.upload([[...mario.slice(0, 4), "chirurgo", ...mario.slice(4), "Su appuntamento"]], columns);
  const view = fixture.render();
  assert.ok(view.find((node) => node.type === "span" && node.props.children === "Chirurgo"));
  assert.ok(!view.find((node) => node.props?.["aria-label"] === "Professione per la riga 2"));
  await view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.onClick();
  const record = fixture.calls[0][1][0];
  assert.equal(record.professionalRole, "Chirurgo");
  assert.equal(record.phone, mario[4]);
  assert.equal(record.email, mario[5]);
  assert.equal(record.notes, "Su appuntamento");
});

test("unknown profession is flagged and can be corrected manually", async () => {
  const fixture = componentFixture();
  await fixture.upload([[...mario, "", "Dottore"]], [...headers, "Professione"]);
  let view = fixture.render();
  assert.ok(view.find((node) => node.props?.children === "Professione non riconosciuta"));
  assert.equal(view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.disabled, false);
  view.find((node) => node.props?.["aria-label"] === "Professione per la riga 2").props.onChange({ target: { value: "Anestesista" } });
  view = fixture.render();
  assert.equal(view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.disabled, false);
  await view.find((node) => node.type === "button" && node.props.children === "Importa medici").props.onClick();
  assert.equal(fixture.calls[0][1][0].professionalRole, "Anestesista");
});

test("recognized hospitals and departments appear as text without selection menus", async () => {
  const fixture = componentFixture();
  await fixture.upload([mario]);
  const view = fixture.render();
  assert.ok(view.find((node) => node.type === "span" && node.props.children === "Ospedale San Carlo"));
  assert.ok(view.find((node) => node.type === "span" && node.props.children === "Cardiologia"));
  assert.ok(!view.find((node) => node.props?.["aria-label"] === "Ospedale per la riga 2"));
  assert.ok(!view.find((node) => node.props?.["aria-label"] === "Reparto per la riga 2"));
});

test("recognized hospital stays plain text while an unknown department can be associated", async () => {
  const fixture = componentFixture();
  await fixture.upload([["Rossi", "Mario", "Ospedale San Carlo", "Cardiolgia"]]);
  const view = fixture.render();
  assert.ok(!view.find((node) => node.props?.["aria-label"] === "Ospedale per la riga 2"));
  const select = view.find((node) => node.props?.["aria-label"] === "Reparto per la riga 2");
  assert.equal(select.props.disabled, false);
  select.props.onChange({ target: { value: "d1" } });
  assert.equal(fixture.render().find((node) => node.type === "button" && node.props.children === "Importa medici").props.disabled, false);
});

test("preview preserves every Excel column in source order, including extra columns and raw contacts", async () => {
  const fixture = componentFixture();
  const columns = ["Email", "Nome", "Cognome", "Telefono", "Ospedale", "Reparto", "Professione", "Note", "Riferimento interno"];
  await fixture.upload([
    ["MARIO@example.it", "Mario", "Rossi", "0039 03331234567", "Ospedale San Carlo", "Cardiologia", "Medico", "Nota su due\nrighe", "ABC-001"],
    ["anna@example.it", "Anna", "Bianchi", "03339876543", "Sconosciuto", "Chirurgia", "Chirurgo", "", "ABC-002"],
  ], columns);
  const view = fixture.render();
  assert.deepEqual(view.nodes.filter((node) => node.type === "th" && node.props.scope === "col").map((node) => node.props.children), ["Riga", ...columns, "Stato"]);
  const tableRows = view.find((node) => node.type === "tbody").props.children;
  assert.equal(tableRows[0].props.className, undefined);
  assert.ok(tableRows[0].props.children[1].every((node) => node.props.className === "doctor-import-cell-valid"));
  assert.equal(tableRows[1].props.className, undefined);
  assert.deepEqual(tableRows[1].props.children[1].map((node) => node.props.className), [
    "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-invalid", "doctor-import-cell-invalid", "doctor-import-cell-valid", "doctor-import-cell-invalid", "doctor-import-cell-valid",
  ]);
  const cells = view.nodes.filter((node) => node.type === "td");
  for (const value of ["Mario", "Rossi", "MARIO@example.it", "0039 03331234567", "Nota su due\nrighe", "ABC-001"]) {
    assert.ok(cells.some((cell) => cell.props.children === value), `Missing source value: ${value}`);
  }
  assert.ok(view.find((node) => node.props?.["aria-label"] === "Ospedale per la riga 3"));
  assert.ok(!view.find((node) => node.props?.["aria-label"] === "Ospedale per la riga 2"));
});

test("unnamed Excel columns are also retained in the preview", () => {
  const [row] = parseDoctorImportRows([[...headers, ""], [...mario, "", "Valore aggiuntivo"]], hospitals);
  assert.equal(row.sourceColumns.at(-1).label, "Colonna 8");
  assert.equal(row.sourceCells.at(-1), "Valore aggiuntivo");
  assert.equal(build([row])[0].sourceCells, undefined);
});

test("every Excel column reports empty or whitespace-only cells, including extra columns", () => {
  const columns = ["Cognome", "Nome", "Ospedale", "Reparto", "Professione", "Telefono", "Email", "Note", "Extra"];
  const values = ["Rossi", "Mario", "Ospedale San Carlo", "Cardiologia", "Medico", "03331234567", "mario@example.it", "Nota", "Altro"];
  for (let index = 0; index < columns.length; index += 1) {
    const cells = [...values];
    cells[index] = "   ";
    const [row] = parseDoctorImportRows([columns, cells], hospitals);
    assert.equal(isDoctorImportCellMissing(row, row.sourceColumns[index]), true, columns[index]);
    assert.equal(row.sourceColumns.filter((column) => isDoctorImportCellMissing(row, column)).length, 1);
  }
});

test("preview blocks a missing profession while leaving optional data empty and no profession preselected", async () => {
  const fixture = componentFixture();
  const columns = ["Cognome", "Nome", "Ospedale", "Reparto", "Professione", "Telefono", "Email", "Note", "Extra"];
  await fixture.upload([["Rossi", "Mario", "Ospedale San Carlo", "Cardiologia", "", " ", "", "", ""]], columns);
  const view = fixture.render();
  assert.equal(view.nodes.filter((node) => node.props?.children === "Dato mancante").length, 5);
  assert.equal(view.nodes.filter((node) => node.props?.className?.includes("table-warning")).length, 0);
  assert.equal(view.find((node) => node.props?.["aria-label"] === "Professione per la riga 2").props.value, "");
  assert.deepEqual(view.find((node) => node.type === "tbody").props.children[0].props.children[1].map((node) => node.props.className), [
    "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-valid", "doctor-import-cell-invalid", "doctor-import-cell-invalid", "doctor-import-cell-invalid", "doctor-import-cell-invalid", "doctor-import-cell-invalid",
  ]);
  assert.ok(view.find((node) => node.props?.children === "Professione mancante"));
  const button = view.find((node) => node.type === "button" && node.props.children === "Importa medici");
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.equal(fixture.calls.length, 0);
  assert.match(JSON.stringify(fixture.render().find((node) => node.type === "dialog")), /Professione mancante/);
  fixture.render().find((node) => node.props?.["aria-label"] === "Chiudi elenco problemi").props.onClick();
  view.find((node) => node.props?.["aria-label"] === "Professione per la riga 2").props.onChange({ target: { value: "Medico" } });
  const corrected = fixture.render();
  assert.equal(corrected.nodes.filter((node) => node.props?.children === "Dato mancante").length, 4);
  assert.equal(corrected.find((node) => node.type === "tbody").props.children[0].props.children[1][4].props.className, "doctor-import-cell-valid");
  assert.ok(corrected.find((node) => node.type === "tbody").props.children[0].props.children[1].slice(5).every((node) => node.props.className === "doctor-import-cell-invalid"));
  assert.equal(corrected.find((node) => node.type === "button" && node.props.children === "Importa medici").props.disabled, false);
});

test("empty and whitespace-only profession cells block record creation even for repeated doctors", () => {
  for (const value of ["", "   "]) {
    const rows = parseDoctorImportRows([[...headers, "Professione"], [...mario, "", "Medico"], [...mario, "", value]], hospitals);
    assert.ok(getDoctorImportIssues(rows[1], hospitals).includes("Professione mancante"));
    assert.throws(() => build(rows), /Riga 3: Professione mancante/);
  }
});

test("selecting a missing profession clears its missing-data indication", async () => {
  const fixture = componentFixture();
  await fixture.upload([[...mario, "Nota", ""]], [...headers, "Professione"]);
  let view = fixture.render();
  assert.ok(view.find((node) => node.props?.children === "Dato mancante"));
  view.find((node) => node.props?.["aria-label"] === "Professione per la riga 2").props.onChange({ target: { value: "Chirurgo" } });
  view = fixture.render();
  assert.ok(!view.find((node) => node.props?.children === "Dato mancante"));
  assert.ok(view.find((node) => node.type === "tbody").props.children[0].props.children[1].every((node) => node.props.className === "doctor-import-cell-valid"));
});

test("Excel import is a separate configurable permission", () => {
  assert.ok(MANAGEABLE_PAGES.some(([id, label]) => id === "doctors-import" && label === "Importazione Medici Exel"));
  assert.deepEqual(getPagePermission({ role: "CAS", pagePermissions: { doctors: { view: true, edit: true }, "doctors-import": { view: false, edit: false } } }, "doctors-import"), { view: false, edit: false });
  assert.deepEqual(getPagePermission({ role: "GVP", pagePermissions: { doctors: { view: true, edit: false }, "doctors-import": { view: true, edit: true } } }, "doctors-import"), { view: true, edit: true });
  assert.deepEqual(getPagePermission({ role: "CAS", pagePermissions: { "doctors-import": { view: true, edit: false } } }, "doctors-import"), { view: true, edit: false });
  assert.deepEqual(getPagePermission({ role: "GVP" }, "doctors-import"), { view: false, edit: false });
  assert.deepEqual(getPagePermission({ role: "CAS" }, "doctors-import"), { view: false, edit: false });
  assert.deepEqual(getPagePermission({ role: "CAS", isSecretary: true }, "doctors-import"), { view: true, edit: true });
  assert.deepEqual(getPagePermission({ role: "Presidente" }, "doctors-import"), { view: true, edit: true });
  assert.deepEqual(getPagePermission({ role: "GVP", isSecretary: true }, "doctors-import"), { view: false, edit: false });
  assert.deepEqual(getPagePermission(null, "doctors-import"), { view: false, edit: false });
});

test("view-only users can preview the Excel file but cannot submit an import", async () => {
  const fixture = componentFixture({ canImport: false });
  await fixture.upload([mario]);
  const button = fixture.render().find((node) => node.type === "button" && node.props.children === "Importa medici");
  assert.equal(button.props.disabled, true);
  await button.props.onClick();
  assert.equal(fixture.calls.length, 0);
});

function serverImportFixture(pagePermissions, profile = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "server/main.js"), "utf8");
  const start = source.indexOf('  async "hlc.importDoctors"');
  const end = source.indexOf('  async "hlc.applyRecordChanges"', start);
  const inserted = [];
  const actor = { _id: "user", profile: { role: "CAS", presidentId: "p1", pagePermissions, ...profile } };
  let counter = 0;
  const env = {
    requireUser(context) { if (!context.userId) throw Error("Login richiesto"); },
    check() {},
    Meteor: { Error: class extends Error { constructor(code, message) { super(message); this.error = code; } }, users: { findOneAsync: async () => actor } },
    requirePageEdit(user, page) { if (!getPagePermission({ ...user.profile }, page).edit) throw Error("Permesso negato"); },
    getActorPresidentId: async () => "p1",
    HospitalsCollection: { find: () => ({ fetchAsync: async () => hospitals }) },
    DoctorsCollection: { find: () => ({ fetchAsync: async () => [] }), insertAsync: async (record) => inserted.push(record) },
    normalizeImportValue: helpers.normalizeImportValue,
    importProfessionalRoles: helpers.importProfessionalRoles,
    Random: { id: () => `server-id-${++counter}` },
    cleanRecord: (record) => ({ ...record, _id: record.id }),
  };
  const methods = new Function(...Object.keys(env), `return ({${source.slice(start, end)}});`)(...Object.values(env));
  return { inserted, run: (records) => methods["hlc.importDoctors"].call({ userId: actor._id }, records) };
}

test("server refuses import when only the regular doctors edit permission is granted", async () => {
  const fixture = serverImportFixture({ doctors: { view: true, edit: true }, "doctors-import": { view: false, edit: false } });
  await assert.rejects(fixture.run(build(parse(mario))), /Permesso negato/);
  assert.equal(fixture.inserted.length, 0);
});

test("server accepts import permission independently of regular doctors editing", async () => {
  const fixture = serverImportFixture({ doctors: { view: true, edit: false }, "doctors-import": { view: true, edit: true } });
  assert.equal(await fixture.run(build(parse(mario))), 1);
  assert.equal(fixture.inserted.length, 1);
  assert.equal(fixture.inserted[0].presidentId, "p1");
  assert.equal(fixture.inserted[0]._id, "server-id-1");
});

test("server rejects out-of-organization imports and invalid departments before inserting", async () => {
  const fixture = serverImportFixture({ "doctors-import": { view: true, edit: true } });
  const [record] = build(parse(mario));
  await assert.rejects(fixture.run([{ ...record, presidentId: "other" }]), /fuori dalla tua organizzazione/);
  await assert.rejects(fixture.run([record, { ...record, firstName: "Anna", departmentIds: ["foreign"] }]), /non validi/);
  assert.equal(fixture.inserted.length, 0);
});

test("server denies ordinary CAS by default and allows the secretary", async () => {
  const ordinaryCas = serverImportFixture();
  await assert.rejects(ordinaryCas.run(build(parse(mario))), /Permesso negato/);
  assert.equal(ordinaryCas.inserted.length, 0);
  const secretary = serverImportFixture(undefined, { isSecretary: true });
  assert.equal(await secretary.run(build(parse(mario))), 1);
});
