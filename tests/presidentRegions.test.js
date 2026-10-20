import assert from "assert";
import { getCasRegion, groupPresidentsByRegion, ITALIAN_REGIONS, UNKNOWN_REGION } from "../imports/utils/presidentRegions.js";

describe("presidents grouped by CAS region", function () {
  it("can include all twenty regions even without presidents", function () {
    assert.strictEqual(ITALIAN_REGIONS.length, 20);
    const empty = groupPresidentsByRegion([], { includeAllRegions: true });
    assert.deepStrictEqual(empty.map((group) => group.region), ITALIAN_REGIONS);
    assert.ok(empty.every((group) => group.users.length === 0));
    const groups = groupPresidentsByRegion([{ id: "1", username: "Alfa", casMembership: "Torino" },
      { id: "2", username: "Beta" }], { includeAllRegions: true });
    assert.strictEqual(groups.length, 21);
    assert.strictEqual(groups.find((group) => group.region === "Piemonte").users[0].id, "1");
    assert.strictEqual(groups.at(-1).region, UNKNOWN_REGION);
  });
  it("recognizes cities, CAS prefixes, numbers and accents", function () {
    for (const [name, region] of [["Torino", "Piemonte"], ["CAS di Milano", "Lombardia"],
      ["CAS Roma 1", "Lazio"], ["Forlì", "Emilia-Romagna"], ["Reggio Emilia", "Emilia-Romagna"],
      ["Reggio Calabria", "Calabria"], ["CAS di L’Aquila", "Abruzzo"]]) {
      assert.strictEqual(getCasRegion(name), region, name);
    }
  });

  it("keeps missing, unknown and conflicting memberships unclassified", function () {
    for (const name of [undefined, "", "CAS non specificato", "Torino / Roma"])
      assert.strictEqual(getCasRegion(name), UNKNOWN_REGION);
  });

  it("groups without losing presidents, sorts regions and names, and preserves input", function () {
    const presidents = [
      { id: "1", username: "Zeta", casMembership: "Torino" },
      { id: "2", username: "Beta", casMembership: "Milano" },
      { id: "3", username: "Alfa", casMembership: "CAS Torino 2" },
      { id: "4", username: "Senza CAS" },
    ];
    const before = JSON.stringify(presidents);
    const result = groupPresidentsByRegion(presidents);
    assert.deepStrictEqual(result.map((group) => group.region), ["Lombardia", "Piemonte", UNKNOWN_REGION]);
    assert.deepStrictEqual(result[1].users.map((user) => user.id), ["3", "1"]);
    assert.strictEqual(result.flatMap((group) => group.users).length, presidents.length);
    assert.strictEqual(JSON.stringify(presidents), before);
    assert.deepStrictEqual(groupPresidentsByRegion([]), []);
    assert.strictEqual(groupPresidentsByRegion(presidents.filter((user) => user.username === "Beta"))[0].region, "Lombardia");
  });
});
