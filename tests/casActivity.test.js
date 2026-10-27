import assert from "assert";
import { buildCasActivity } from "../imports/utils/casActivity.js";

describe("CAS activity from actual accesses", function () {
  const now = new Date("2026-10-27T12:00:00Z");
  const users = [
    { id: "p1", role: "Presidente", casMembership: "Roma" },
    { id: "p2", role: "Presidente", casMembership: "Milano", disabled: true },
    { id: "p3", role: "Presidente", casMembership: "Torino" },
    { id: "c1", role: "CAS", presidentId: "p1" },
  ];
  const access = (presidentId, createdAt, extra = {}) => ({ userId: "member", role: "GVP", presidentId, createdAt, ...extra });

  it("includes inactive CAS with no logs and groups member accesses under their CAS", function () {
    const rows = buildCasActivity(users, [access("p1", "2026-10-26"), access("p2", "2026-10-25")], 30, now);
    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows.find(row => row.id === "p1").active, true);
    assert.strictEqual(rows.find(row => row.id === "p2").active, true);
    assert.strictEqual(rows.find(row => row.id === "p3").active, false);
    assert.strictEqual(rows.find(row => row.id === "p3").lastAccess, null);
  });

  it("uses the latest valid access and the selected time window", function () {
    const logs = [access("p1", "2026-10-01"), access("p1", "2026-10-20T12:00:00Z"), access("p1", "2026-01-01")];
    const row = buildCasActivity(users, logs, 7, now).find(row => row.id === "p1");
    assert.strictEqual(row.lastAccess.toISOString(), "2026-10-20T12:00:00.000Z");
    assert.strictEqual(row.active, true);
    assert.strictEqual(buildCasActivity(users, logs, 6, now).find(row => row.id === "p1").active, false);
  });

  it("ignores support actions, Admin, missing users, invalid dates and future accesses", function () {
    const logs = [
      access("p1", "2026-10-26", { action: "impersonation-start" }),
      access("p1", "2026-10-26", { role: "Admin" }),
      access("p1", "2026-10-26", { userId: "" }),
      access("p1", "invalid"), access("p1", "2026-10-28"),
    ];
    assert.ok(buildCasActivity(users, logs, 30, now).every(row => !row.active));
  });

  it("recognizes a President login even without presidentId", function () {
    const logs = [access("", "2026-10-26", { role: "Presidente", userId: "p1" })];
    assert.strictEqual(buildCasActivity(users, logs, 30, now).find(row => row.id === "p1").active, true);
  });

  it("ranks CAS by accesses in the selected period, combining their users", function () {
    const logs = [
      access("p1", "2026-10-26"),
      access("p1", "2026-10-25", { userId: "cas-user", role: "CAS" }),
      access("p1", "2026-10-20T12:00:00Z", { userId: "p1", role: "Presidente" }),
      access("p2", "2026-10-26"),
      access("p2", "2026-10-01"),
      access("p1", "2026-10-26", { action: "impersonation-start" }),
    ];
    const rows = buildCasActivity(users, logs, 7, now);
    assert.deepStrictEqual(rows.map(row => [row.id, row.accessCount]), [["p1", 3], ["p2", 1], ["p3", 0]]);
    assert.strictEqual(buildCasActivity(users, logs, 30, now).find(row => row.id === "p2").accessCount, 2);
  });
});
