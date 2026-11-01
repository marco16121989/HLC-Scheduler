import assert from "assert";
import { buildAdminCasCounts, groupUserCountsByCas, sortAdminCasRows } from "../imports/utils/adminCasCounts.js";

describe("Admin counts grouped by CAS", function () {
  it("sorts alphabetically and numerically in both directions without changing the source", function () {
    const rows = [{ id: "b", name: "Roma", count: 2 }, { id: "a", name: "Ancona", count: 10 }, { id: "c", name: "Milano", count: 2 }];
    const original = rows.slice();
    const ids = (order) => sortAdminCasRows(rows, order).map((row) => row.id);
    assert.deepStrictEqual(ids("name-asc"), ["a", "c", "b"]);
    assert.deepStrictEqual(ids("name-desc"), ["b", "c", "a"]);
    assert.deepStrictEqual(ids("count-asc"), ["c", "b", "a"]);
    assert.deepStrictEqual(ids("count-desc"), ["a", "c", "b"]);
    assert.deepStrictEqual(rows, original);
  });

  it("uses access counts for CAS activity tables and handles empty tables", function () {
    const rows = [{ id: "a", name: "Ancona", accessCount: 2 }, { id: "b", name: "Roma", accessCount: 10 }];
    assert.deepStrictEqual(sortAdminCasRows(rows, "count-desc", "accessCount").map((row) => row.id), ["b", "a"]);
    assert.deepStrictEqual(sortAdminCasRows([], "count-desc"), []);
  });
  const user = (_id, role, profile = {}) => ({ _id, username: "Private username", profile: { role, ...profile } });
  const presidents = [user("p1", "Presidente", { casMembership: "Roma" }), user("p2", "Presidente", { casMembership: "Milano" })];

  it("returns only CAS labels and counts, including zeros and unassigned records", function () {
    const rows = buildAdminCasCounts(presidents, [{ _id: "p1", count: 3 }, { _id: "old", count: 2 }, { _id: null, count: 1 }]);
    assert.strictEqual(rows.find((row) => row.id === "p1").count, 3);
    assert.strictEqual(rows.find((row) => row.id === "p2").count, 0);
    assert.strictEqual(rows.find((row) => row.id === "__unassigned").count, 3);
    assert.strictEqual(rows.reduce((sum, row) => sum + row.count, 0), 6);
    assert.ok(rows.every((row) => Object.keys(row).sort().join() === "count,id,name"));
    assert.ok(!JSON.stringify(rows).includes("Private username"));
  });

  it("counts each account once, including Presidents, direct assignments and legacy GVP links", function () {
    const accounts = [...presidents,
      user("cas1", "CAS", { presidentId: "p1" }),
      user("cas2", "CAS", { associationId: "p2" }),
      user("gvp1", "GVP", { presidentId: "p1" }),
      user("gvp2", "GVP", { casId: "cas1" }),
      user("gvp3", "GVP", { associationId: "p2" }),
      user("gvp4", "GVP", { casIds: ["missing", "cas2", "cas1"] }),
      user("admin", "Admin"), user("unassigned", "GVP"),
    ];
    const rows = buildAdminCasCounts(presidents, groupUserCountsByCas(accounts));
    assert.strictEqual(rows.find((row) => row.id === "p1").count, 4);
    assert.strictEqual(rows.find((row) => row.id === "p2").count, 4);
    assert.strictEqual(rows.find((row) => row.id === "__unassigned").count, 2);
    assert.strictEqual(rows.reduce((sum, row) => sum + row.count, 0), accounts.length);
  });
});
