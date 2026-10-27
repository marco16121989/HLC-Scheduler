export const buildCasActivity = (users, accessLogs, days = 30, now = new Date()) => {
  const nowTime = now.getTime();
  const cutoff = nowTime - days * 24 * 60 * 60 * 1000;
  const latestByPresident = new Map();
  const countsByPresident = new Map();
  for (const log of accessLogs) {
    if (!log.userId || log.action || !["Presidente", "CAS", "GVP"].includes(log.role)) continue;
    const presidentId = log.presidentId || (log.role === "Presidente" ? log.userId : "");
    const time = new Date(log.createdAt).getTime();
    if (!presidentId || !Number.isFinite(time) || time > nowTime) continue;
    if (time > (latestByPresident.get(presidentId) ?? -Infinity)) latestByPresident.set(presidentId, time);
    if (time >= cutoff) countsByPresident.set(presidentId, (countsByPresident.get(presidentId) || 0) + 1);
  }
  return users.filter((user) => user.role === "Presidente").map((user) => {
    const latest = latestByPresident.get(user.id);
    return {
      id: user.id,
      name: user.casMembership || "CAS non specificato",
      president: user.username || "Presidente non specificato",
      lastAccess: latest === undefined ? null : new Date(latest),
      accessCount: countsByPresident.get(user.id) || 0,
      active: latest !== undefined && latest >= cutoff,
    };
  }).sort((a, b) => b.accessCount - a.accessCount || a.name.localeCompare(b.name, "it-IT") || a.president.localeCompare(b.president, "it-IT"));
};
