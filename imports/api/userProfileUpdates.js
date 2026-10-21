// Aggiorna solo i campi gestiti dall'anagrafica: un salvataggio della squadra
// non deve cancellare né ripristinare permessi salvati da un'altra schermata.
export const buildUserProfileUpdate = (username, profile) => ({
  $set: Object.fromEntries([
    ["username", username],
    ...Object.entries(profile).map(([field, value]) => [`profile.${field}`, value]),
  ]),
});

export const hasUserProfileChanges = (account, username, profile) =>
  account.username !== username || Object.entries(profile).some(([field, value]) =>
    JSON.stringify(account.profile?.[field]) !== JSON.stringify(value),
  );
