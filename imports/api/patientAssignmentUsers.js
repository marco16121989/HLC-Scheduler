export const getPatientAssignmentGvpLabel = (user) =>
  String(user?.username || "").trim() ||
  [user?.firstName, user?.lastName].map(value => String(value || "").trim()).filter(Boolean).join(" ");

export const getPatientAssignmentGvpUsers = (users, presidentId) => {
  if (!presidentId) return [];
  const casIds = new Set(users.filter(user => user.role === "CAS" &&
    (user.presidentId || user.associationId) === presidentId).map(user => user.id));
  casIds.add(presidentId);
  return users.filter(user => {
    if (user.role !== "GVP") return false;
    if (user.presidentId) return user.presidentId === presidentId;
    const linkedIds = [...(Array.isArray(user.casIds) ? user.casIds : []), user.casId, user.associationId].filter(Boolean);
    return linkedIds.some(id => casIds.has(id));
  });
};

// Include older GVP accounts linked through a CAS, without an explicit presidency.
export const legacyGvpOrganizationSelector = (presidentId, casIds) => ({
  "profile.role": "GVP",
  "profile.presidentId": { $in: [null, ""] },
  $or: [
    { "profile.casIds": { $in: [presidentId, ...casIds] } },
    { "profile.casId": { $in: [presidentId, ...casIds] } },
    { "profile.associationId": { $in: [presidentId, ...casIds] } },
  ],
});
