export const sortAdminCasRows = (rows, order = "name-asc", countField = "count") => [...rows].sort((first, second) => {
  const byName = String(first.name || "").localeCompare(String(second.name || ""), "it-IT", { sensitivity: "base", numeric: true });
  const byCount = Number(first[countField] || 0) - Number(second[countField] || 0);
  const tie = String(first.id || "").localeCompare(String(second.id || ""));
  if (order === "name-desc") return -byName || tie;
  if (order === "count-asc") return byCount || byName || tie;
  if (order === "count-desc") return -byCount || byName || tie;
  return byName || tie;
});

export const buildAdminCasCounts = (presidents, groups) => {
  const counts = new Map(groups.map((group) => [group._id, group.count]));
  const rows = presidents.map((president) => {
    const count = counts.get(president._id) || 0;
    counts.delete(president._id);
    return { id: president._id, name: president.profile?.casMembership || "CAS non specificato", count };
  }).sort((first, second) => first.name.localeCompare(second.name, "it-IT"));
  const unassigned = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (unassigned) rows.push({ id: "__unassigned", name: "CAS non assegnato o non più disponibile", count: unassigned });
  return rows;
};

export const groupUserCountsByCas = (users) => {
  const byId = new Map(users.map((user) => [user._id, user]));
  const counts = new Map();
  for (const user of users) {
    const profile = user.profile || {};
    let presidentId = null;
    if (profile.role === "Presidente") presidentId = user._id;
    else if (profile.role !== "Admin") {
      presidentId = profile.presidentId || (profile.role === "CAS" ? profile.associationId : null);
      if (!presidentId) {
        const linkedIds = [...(Array.isArray(profile.casIds) ? profile.casIds : []), profile.casId, profile.associationId].filter(Boolean);
        for (const id of linkedIds) {
          const linked = byId.get(id);
          if (linked?.profile?.role === "Presidente") presidentId = id;
          else if (linked?.profile?.role === "CAS") presidentId = linked.profile.presidentId || linked.profile.associationId;
          if (presidentId) break;
        }
      }
    }
    const key = presidentId || null;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([_id, count]) => ({ _id, count }));
};
