export const confirmPatientClosure = async (status, confirm) => {
  const discharged = status === "Dimesso";
  const confirmed = await confirm(
    `Impostare il paziente come ${status}? Dopo la conferma il paziente non sarà più modificabile.`,
    { title: discharged ? "Conferma dimissioni" : "Conferma decesso", confirmLabel: "Conferma" },
  );
  if (!confirmed) return null;
  const followUpEnabled = discharged && await confirm(
    "Vuoi attivare il follow up del paziente dopo le dimissioni?",
    { title: "Follow up del paziente", confirmLabel: "Attiva follow up", cancelLabel: "No, grazie", tone: "primary" },
  );
  return { followUpEnabled };
};
