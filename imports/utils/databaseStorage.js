export const buildDatabaseStorageSummary = (stats, capacityGB = 10, now = new Date()) => {
  const value = (field) => {
    if (stats?.[field] === undefined || stats[field] === null) throw new Error("Statistiche spazio incomplete.");
    const bytes = Number(stats[field]);
    if (!Number.isFinite(bytes) || bytes < 0) throw new Error("Statistiche spazio non valide.");
    return bytes;
  };
  const capacityBytes = Number(capacityGB) * 1e9;
  if (!Number.isFinite(capacityBytes) || capacityBytes <= 0) throw new Error("Capacità del database non valida.");
  const dataBytes = value("dataSize");
  const storageBytes = value("storageSize");
  const indexBytes = value("indexSize");
  const usedBytes = storageBytes + indexBytes;
  return {
    dataBytes, storageBytes, indexBytes, usedBytes, capacityBytes,
    logicalBytes: dataBytes + indexBytes,
    remainingBytes: Math.max(0, capacityBytes - usedBytes),
    percentage: usedBytes / capacityBytes * 100,
    checkedAt: now,
  };
};

export const formatStorageBytes = (bytes) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = bytes > 0 ? Math.max(0, Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3))) : 0;
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(bytes / 1000 ** index)} ${units[index]}`;
};
