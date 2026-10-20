import assert from "assert";
import { buildDoctorContactResults, buildHospitalContactResults, getDoctorContactDepartmentOptions } from "../imports/api/doctorContactSearch.js";

describe("doctor contact search by selected departments", function () {
  const hospitals = [
    { id: "h1", presidentId: "p", name: "Ospedale San Carlo", departments: [
      { id: "surgery", name: "Chirurgia generale" }, { id: "orthopedics", name: "Ortopedia" },
      { id: "cardiology", name: "Cardiologia" },
    ] },
    { id: "h2", presidentId: "p", name: "Ospedale Centrale", departments: [{ id: "orthopedics-2", name: "Chirurgia ortopedica" }] },
    { id: "private", presidentId: "other", name: "Ospedale riservato", departments: [{ id: "private-department", name: "Chirurgia riservata" }] },
  ];
  const doctors = [
    { id: "s", presidentId: "p", firstName: "Mario", lastName: "Rossi", professionalRole: "Chirurgo", phone: "+39 333 1234567", email: "rossi@example.test", departmentIds: ["surgery"], notes: "Nota da non condividere" },
    { id: "o", presidentId: "p", firstName: "Anna", lastName: "Bianchi", professionalRole: "Medico", phone: "011 123456", email: "bianchi@example.test", departmentIds: ["orthopedics", "orthopedics-2"] },
    { id: "c", presidentId: "p", firstName: "Luca", lastName: "Verdi", professionalRole: "Chirurgo", departmentIds: ["cardiology"] },
    { id: "hidden", presidentId: "other", firstName: "Privato", lastName: "Medico", professionalRole: "Chirurgo", phone: "numero-riservato", departmentIds: ["private-department"] },
  ];
  const search = (departmentKeys, overrides = {}) => buildDoctorContactResults({ doctors, hospitals, presidentId: "p", departmentKeys, ...overrides });
  const suggest = (query, overrides = {}) => getDoctorContactDepartmentOptions({ hospitals, presidentId: "p", query, ...overrides });

  it("completes typed prefixes using only existing department names", function () {
    assert.deepStrictEqual(suggest("chirurg").map(d => d.name), ["Chirurgia generale", "Chirurgia ortopedica"]);
    assert.ok(suggest("orto").some(d => d.name === "Ortopedia"));
    assert.deepStrictEqual(suggest("chirurgia orto").map(d => d.name), ["Chirurgia ortopedica"]);
    assert.deepStrictEqual(suggest("CHIRÙRG").map(d => d.name), ["Chirurgia generale", "Chirurgia ortopedica"]);
    assert.deepStrictEqual(suggest("Nome non inserito"), []);
  });

  it("requires a chosen department: free text, prefixes and contact details cannot return contacts", function () {
    assert.deepStrictEqual(search([]), { count: 0, groups: [], text: "" });
    assert.deepStrictEqual(buildDoctorContactResults({ doctors, hospitals, presidentId: "p", query: "chirurgo ortopedico" }), { count: 0, groups: [], text: "" });
    assert.deepStrictEqual(search(["chirurg"]), { count: 0, groups: [], text: "" });
    assert.deepStrictEqual(search(["rossi@example.test"]), { count: 0, groups: [], text: "" });
  });

  it("matches only assigned departments and never a doctor's professional role", function () {
    const result = search(["chirurgia generale"]);
    assert.strictEqual(result.count, 1);
    assert.ok(result.text.includes("Rossi Mario"));
    assert.ok(!result.text.includes("Verdi Luca"), "The surgeon assigned to Cardiology must not match Surgery");
    assert.ok(!result.text.includes("Bianchi Anna"));
    assert.ok(result.text.includes("Tel: +39 333 1234567"));
    assert.ok(result.text.includes("Email: rossi@example.test"));
    assert.ok(!result.text.includes("Nota da non condividere"));
  });

  it("combines multiple selected departments without counting a doctor twice", function () {
    const result = search(["chirurgia generale", "ortopedia", "chirurgia ortopedica"]);
    assert.strictEqual(result.count, 2);
    assert.ok(result.text.includes("Ospedale San Carlo"));
    assert.ok(result.text.includes("Ospedale Centrale"));
    assert.strictEqual((result.text.match(/Bianchi Anna/g) || []).length, 2, "Once for each selected hospital affiliation");
  });

  it("exports only the hospitals and departments matching the selection", function () {
    const result = search(["ortopedia"]);
    assert.strictEqual(result.count, 1);
    assert.ok(result.text.includes("Ospedale San Carlo"));
    assert.ok(!result.text.includes("Ospedale Centrale"));
    assert.ok(!result.text.includes("Chirurgia ortopedica"));
  });

  it("groups the same department name across hospitals and removes duplicate suggestions", function () {
    const sameNameHospitals = [...hospitals, { id: "h3", presidentId: "p", name: "Terzo ospedale", departments: [{ id: "ortho-3", name: " ORTOPEDIA " }] }];
    assert.strictEqual(suggest("ortopedia", { hospitals: sameNameHospitals }).filter(d => d.key === "ortopedia").length, 1);
    const result = search(["ortopedia"], { hospitals: sameNameHospitals,
      doctors: doctors.map(d => d.id === "o" ? { ...d, departmentIds: [...d.departmentIds, "ortho-3", "ortho-3"] } : d) });
    assert.strictEqual(result.count, 1);
    assert.strictEqual((result.text.match(/Bianchi Anna/g) || []).length, 2);
  });

  it("does not leak contacts or suggestions from another president", function () {
    assert.ok(!suggest("chirurg").some(d => d.name.includes("riservata")));
    assert.deepStrictEqual(search(["chirurgia riservata"]), { count: 0, groups: [], text: "" });
    assert.deepStrictEqual(search(["chirurgia generale"], { presidentId: null }), { count: 0, groups: [], text: "" });
    assert.deepStrictEqual(suggest("chirurg", { presidentId: null }), []);
  });

  it("labels missing phone/email but excludes doctors without an assigned selected department", function () {
    const result = search(["cardiologia"]);
    assert.strictEqual(result.count, 1);
    assert.ok(result.text.includes("Tel: non disponibile"));
    assert.ok(result.text.includes("Email: non disponibile"));
    assert.deepStrictEqual(search(["cardiologia"], { hospitals: [] }), { count: 0, groups: [], text: "" });
  });

  it("does not mutate hospitals or doctors", function () {
    const before = JSON.stringify({ doctors, hospitals });
    suggest("orto"); search(["ortopedia"]);
    assert.strictEqual(JSON.stringify({ doctors, hospitals }), before);
  });

  const searchHospitals = (departmentKeys, overrides = {}) => buildHospitalContactResults({ doctors, hospitals, presidentId: "p", departmentKeys, ...overrides });

  it("provides structured display data and a plain message without WhatsApp markers", function () {
    for (const result of [search(["chirurgia generale"]), searchHospitals(["chirurgia generale"])]) {
      assert.strictEqual(result.groups[0].name, "Ospedale San Carlo");
      assert.deepStrictEqual(result.groups[0].departments, ["Chirurgia generale"]);
      assert.deepStrictEqual(result.groups[0].contacts[0], {
        id: "s", name: "Rossi Mario", role: "Chirurgo", departments: ["Chirurgia generale"],
        phone: "+39 333 1234567", email: "rossi@example.test",
      });
      assert.ok(!result.text.includes("*"));
      assert.ok(result.text.startsWith("Ospedale San Carlo\n"));
      assert.ok(result.text.includes("Rossi Mario — Chirurgo\nReparti: Chirurgia generale\nTel: +39 333 1234567\nEmail: rossi@example.test"));
    }
  });

  it("lists only hospitals with doctors in the selected departments", function () {
    const hospitalWithoutDoctors = { id: "empty", presidentId: "p", name: "Ospedale senza medici", departments: [{ id: "empty-ortho", name: "Ortopedia" }] };
    const result = searchHospitals(["ortopedia"], { hospitals: [...hospitals, hospitalWithoutDoctors] });
    assert.strictEqual(result.hospitalCount, 1);
    assert.strictEqual(result.count, 1);
    assert.ok(!result.text.includes("Ospedale senza medici"));
    assert.deepStrictEqual(result.groups.map((group) => group.id), ["h1"]);
    assert.ok(result.text.includes("Bianchi Anna"));
    assert.ok(result.text.includes("Email: bianchi@example.test"));
    assert.ok(!result.text.includes("Ospedale Centrale"));
    assert.ok(!result.text.includes("Rossi Mario"));
    assert.ok(!result.text.includes("Cardiologia"));
  });

  it("counts each hospital and doctor once across selected departments", function () {
    const result = searchHospitals(["ortopedia", "chirurgia ortopedica", "chirurgia generale"]);
    assert.strictEqual(result.hospitalCount, 2);
    assert.strictEqual(result.count, 2);
    assert.strictEqual((result.text.match(/Bianchi Anna/g) || []).length, 2);
    assert.strictEqual((result.text.match(/Ospedale San Carlo/g) || []).length, 1);
    assert.ok(result.text.indexOf("Ospedale Centrale") < result.text.indexOf("Ospedale San Carlo"));
  });

  it("requires a department and respects visibility when searching hospitals", function () {
    const empty = { count: 0, hospitalCount: 0, groups: [], text: "" };
    assert.deepStrictEqual(searchHospitals([]), empty);
    assert.deepStrictEqual(searchHospitals(["chirurgia riservata"]), empty);
    assert.deepStrictEqual(searchHospitals(["chirurgia generale"], { presidentId: null }), empty);
    assert.deepStrictEqual(searchHospitals(["ortopedia"], { doctors: [] }), empty);
    assert.deepStrictEqual(searchHospitals(["ortopedia"], { doctors: doctors.filter((doctor) => doctor.id !== "o") }), empty);
    const before = JSON.stringify({ doctors, hospitals });
    searchHospitals(["chirurgia generale"]);
    assert.strictEqual(JSON.stringify({ doctors, hospitals }), before);
  });
});
