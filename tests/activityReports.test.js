import assert from "assert";
import { activityReportYears, buildActivityReport } from "../imports/api/activityReports.js";
import { getPagePermission, MANAGEABLE_PAGES } from "../imports/constants/pagePermissions.js";

describe("patient activity reports", function () {
  it("combines CAS assignment and year filters for totals and chart periods", function () {
    const cases = [
      { presidentId: "p", admissionDate: "2026-01-01", status: "Dimesso", casIds: ["p", "cas"] },
      { presidentId: "p", admissionDate: "2026-02-01", status: "Deceduto", casId: "cas" },
      { presidentId: "p", admissionDate: "2025-01-01", status: "Trasferito", casIds: ["cas"] },
      { presidentId: "p", admissionDate: "2026-01-01", status: "Ricoverato", casIds: ["other"] },
      { presidentId: "foreign", admissionDate: "2026-01-01", status: "Deceduto", casIds: ["cas"] },
    ];
    const report = casId => buildActivityReport({ patients: cases, presidentId: "p", year: "2026", casId });
    assert.deepStrictEqual(report("cas").totals, { total: 2, discharged: 1, deceased: 1, transferred: 0 });
    assert.strictEqual(report("cas").periods[0].total, 1);
    assert.strictEqual(report("cas").periods[1].deceased, 1);
    assert.strictEqual(report("p").totals.total, 1);
    assert.strictEqual(report("all").totals.total, 3);
    assert.strictEqual(report("missing").totals.total, 0);
    assert.strictEqual(buildActivityReport({ patients: cases, presidentId: "p", year: "2025", casId: "cas" }).totals.transferred, 1);
  });
  const patients = [
    { presidentId: "p", admissionDate: "2026-01-12", status: "Dimesso" },
    { presidentId: "p", admissionDate: "2025-12-20", status: "Deceduto" },
    { presidentId: "p", admissionDate: "2026-02-01", status: "Trasferito" },
    { presidentId: "p", admissionDate: "2026-01-20", status: "Ricoverato", dischargeDate: "2026-02-01" },
    { presidentId: "p", admissionDate: "2026-02-30", status: "Dimesso" },
    { presidentId: "p", status: "Deceduto" },
    { presidentId: "other", admissionDate: "2026-01-01", status: "Deceduto" },
  ];
  const build = overrides => buildActivityReport({ patients, presidentId: "p", ...overrides });

  it("counts all patients by actual status, including those without valid dates", function () {
    const report = build();
    assert.deepStrictEqual(report.totals, { total: 6, discharged: 2, deceased: 2, transferred: 1 });
    assert.strictEqual(report.selectedPatients.length, 6);
    assert.strictEqual(report.undatedCount, 2);
    assert.deepStrictEqual(report.periods.map(period => period.label), ["2025", "2026"]);
    assert.strictEqual(report.periods.reduce((sum, period) => sum + period.total, 0), 4);
  });

  it("filters by admission year and uses the current status rather than discharge dates", function () {
    const report = build({ year: "2026" });
    assert.deepStrictEqual(report.totals, { total: 3, discharged: 1, deceased: 0, transferred: 1 });
    assert.strictEqual(report.periods.length, 12);
    assert.deepStrictEqual(report.periods[0], { label: "0", total: 2, discharged: 1, deceased: 0, transferred: 0 });
    assert.strictEqual(report.periods[1].transferred, 1);
    assert.strictEqual(report.undatedCount, 0);
  });

  it("keeps previous-year cohorts separate and fills missing months with zeros", function () {
    const report = build({ year: 2025 });
    assert.deepStrictEqual(report.totals, { total: 1, discharged: 0, deceased: 1, transferred: 0 });
    assert.strictEqual(report.periods[11].deceased, 1);
    assert.strictEqual(report.periods[0].total, 0);
  });

  it("lists only valid admission years of this CAS plus the current year", function () {
    assert.deepStrictEqual(activityReportYears({ patients: [...patients, { presidentId: "other", admissionDate: "2020-01-01" }], presidentId: "p", currentYear: 2027 }), ["2027", "2026", "2025"]);
    assert.deepStrictEqual(build({ presidentId: null }).totals, { total: 0, discharged: 0, deceased: 0, transferred: 0 });
    assert.deepStrictEqual(build({ patients: [] }).periods, []);
  });

  it("filters personal GVP cases using both current and legacy assignments", function () {
    const cases = [
      { presidentId: "p", admissionDate: "2026-01-01", status: "Dimesso", gvpIds: ["gvp", "other"], casIds: ["cas"] },
      { presidentId: "p", admissionDate: "2026-02-01", status: "Deceduto", gvpId: "gvp" },
      { presidentId: "p", admissionDate: "2026-02-01", gvpIds: ["other"] },
      { presidentId: "p", admissionDate: "2025-01-01", gvpId: "gvp" },
      { presidentId: "foreign", admissionDate: "2026-01-01", gvpId: "gvp" },
    ];
    const options = { patients: cases, presidentId: "p", year: "2026" };
    assert.strictEqual(buildActivityReport(options).totals.total, 3);
    const personal = buildActivityReport({ ...options, gvpId: "gvp" });
    assert.deepStrictEqual(personal.totals, { total: 2, discharged: 1, deceased: 1, transferred: 0 });
    assert.strictEqual(personal.periods[0].discharged, 1);
    assert.strictEqual(personal.periods[1].deceased, 1);
  });

  it("makes reports configurable and read-only for presidents, CAS and GVP", function () {
    assert.ok(MANAGEABLE_PAGES.some(([id]) => id === "reports"));
    for (const role of ["Presidente", "CAS", "GVP"]) {
      assert.deepStrictEqual(getPagePermission({ role }, "reports"), { view: true, edit: false });
      assert.deepStrictEqual(getPagePermission({ role, pagePermissions: { reports: { view: false, edit: true } } }, "reports"), { view: false, edit: false });
    }
    assert.deepStrictEqual(getPagePermission({ role: "GVP", pagePermissions: { reports: { view: true } } }, "reports"), { view: true, edit: false });
  });
});
