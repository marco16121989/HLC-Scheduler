import assert from "assert";
import { buildDatabaseStorageSummary, formatStorageBytes } from "../imports/utils/databaseStorage.js";

describe("database storage summary", function () {
  it("includes allocated data and indexes and compares them with the 10 GB reference", function () {
    const now = new Date("2026-11-01T10:00:00Z");
    const usage = buildDatabaseStorageSummary({ dataSize: 4e9, storageSize: 2e9, indexSize: 5e8, fsUsedSize: 99e9 }, 10, now);
    assert.strictEqual(usage.usedBytes, 2.5e9);
    assert.strictEqual(usage.logicalBytes, 4.5e9);
    assert.strictEqual(usage.capacityBytes, 10e9);
    assert.strictEqual(usage.remainingBytes, 7.5e9);
    assert.strictEqual(usage.percentage, 25);
    assert.strictEqual(usage.checkedAt, now);
    assert.strictEqual(usage.fsUsedSize, undefined);
  });

  it("handles empty databases and use above the reference capacity", function () {
    const empty = buildDatabaseStorageSummary({ dataSize: 0, storageSize: 0, indexSize: 0 });
    assert.strictEqual(empty.remainingBytes, 10e9);
    assert.strictEqual(empty.percentage, 0);
    const full = buildDatabaseStorageSummary({ dataSize: 14e9, storageSize: 11e9, indexSize: 1e9 });
    assert.strictEqual(full.remainingBytes, 0);
    assert.strictEqual(full.percentage, 120);
  });

  it("supports a different reference capacity", function () {
    const usage = buildDatabaseStorageSummary({ dataSize: 1e9, storageSize: 1e9, indexSize: 0 }, "20");
    assert.strictEqual(usage.capacityBytes, 20e9);
    assert.strictEqual(usage.percentage, 5);
  });

  it("rejects unavailable statistics instead of reporting zero usage", function () {
    for (const stats of [{}, { dataSize: 0, storageSize: -1, indexSize: 0 }, { dataSize: null, storageSize: 0, indexSize: 0 }, { dataSize: 0, storageSize: NaN, indexSize: 0 }]) {
      assert.throws(() => buildDatabaseStorageSummary(stats));
    }
    for (const capacity of [0, -1, "invalid"]) {
      assert.throws(() => buildDatabaseStorageSummary({ dataSize: 0, storageSize: 0, indexSize: 0 }, capacity));
    }
  });

  it("formats decimal bytes without shrinking small values to zero GB", function () {
    assert.strictEqual(formatStorageBytes(0), "0 B");
    assert.strictEqual(formatStorageBytes(1000), "1 KB");
    assert.strictEqual(formatStorageBytes(125e6), "125 MB");
    assert.strictEqual(formatStorageBytes(2.5e9), "2,5 GB");
  });
});
