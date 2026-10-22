import assert from "assert";
import { countAnnualReportDoctors, refreshAnnualReportDoctors } from "../imports/api/annualReport.js";

describe("annual report registry totals", function () {
  const hospitals = [
    { presidentId: "p", departments: [
      { id: "s1", name: "Chirurgia generale" },
      { id: "s2", name: "Chirurgia generale" },
      { id: "t", name: "Chirurgia dei trapianti" },
      { id: "g", name: "Oncologia ginecologica" },
      { id: "custom", name: "Reparto personalizzato" },
    ] },
    { presidentId: "other", departments: [{ id: "private", name: "Ematologia" }] },
  ];
  const count = doctors => countAnnualReportDoctors({ doctors, hospitals, presidentId: "p" });

  it("counts anesthesiologists even when assigned to surgical departments", function () {
    assert.deepStrictEqual(count([{ presidentId: "p", professionalRole: "Anestesista", departmentIds: ["s1"] }]), { anestesiologia: 1 });
  });

  it("counts each doctor once per specialization across hospitals and all collaboration types", function () {
    assert.deepStrictEqual(count([
      { presidentId: "p", departmentIds: ["s1", "s2", "s1"], doctorType: "Non collabora" },
      { presidentId: "p", departmentIds: ["s2"] },
      { presidentId: "other", departmentIds: ["s1"] },
    ]), { "chirurgia generale": 2 });
  });

  it("maps registry names to the report and counts distinct specializations", function () {
    assert.deepStrictEqual(count([{ presidentId: "p", departmentIds: ["t", "g"] }]), { trapianti: 1, "ginecologia oncologica": 1 });
  });

  it("includes unknown or missing departments in Altro without using another CAS", function () {
    assert.deepStrictEqual(count([
      { presidentId: "p", departmentIds: ["custom", "missing"] },
      { presidentId: "p", departmentIds: ["private"] },
      { presidentId: "p" },
    ]), { altro: 3 });
    assert.deepStrictEqual(countAnnualReportDoctors({ hospitals }), {});
  });

  it("refreshes saved drafts while preserving sent reports and written content", function () {
    const report = { specializationTotals: { anestesiologia: 0 }, significantIssues: "Testo", year: "2025" };
    assert.deepStrictEqual(refreshAnnualReportDoctors(report, { anestesiologia: 1 }), { ...report, specializationTotals: { anestesiologia: 1 } });
    const sent = { ...report, sentAt: new Date() };
    assert.strictEqual(refreshAnnualReportDoctors(sent, { anestesiologia: 1 }), sent);
  });
});
