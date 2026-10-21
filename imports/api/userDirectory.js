export const getGvpUsersSelector = (actorId, presidentId, canViewPermissions) => ({
  $or: [
    { _id: actorId },
    // Il Presidente può coprire reparti, esattamente come gli altri CAS.
    { _id: presidentId },
    ...(canViewPermissions
      ? [{ "profile.presidentId": presidentId }, { "profile.associationId": presidentId }]
      : [
          { "profile.role": "CAS", "profile.presidentId": presidentId },
          { "profile.role": "CAS", "profile.associationId": presidentId },
        ]),
  ],
});
