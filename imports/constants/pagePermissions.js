export const MANAGEABLE_PAGES = [
  ["events", "Eventi"], ["useful-files", "File utili"], ["support", "Segnalazioni"],
  ["cas", "CAS"], ["gvp", "GVP"],
  ["hospitals", "Ospedali"], ["departments", "Reparti"], ["doctors", "Medici"],
  ["patients", "Pazienti"],
];

export const getPagePermission = (user, pageId) => {
  if (["Admin", "Presidente"].includes(user?.role)) return { view: true, edit: true };
  if (["calendar", "profile", "absences", "donations"].includes(pageId)) return { view: true, edit: true };
  if (["presentations", "patient-reports", "presentation-reports"].includes(pageId)) {
    const view = user?.role === "CAS";
    return { view, edit: pageId === "presentations" && view };
  }
  const configured = user?.pagePermissions?.[pageId];
  if (user?.role === "GVP" && ["events", "useful-files"].includes(pageId)) {
    return configured
      ? { view: Boolean(configured.view), edit: Boolean(configured.view && configured.edit) }
      : { view: true, edit: false };
  }
  if (configured) return { view: Boolean(configured.view), edit: Boolean(configured.view && configured.edit) };
  const defaults = {
    CAS: new Set(["calendar", "events", "absences", "useful-files", "profile", "support", "donations", "cas", "gvp", "hospitals", "departments", "doctors", "patients", "presentations", "patient-reports", "presentation-reports"]),
    GVP: new Set(["calendar", "events", "absences", "useful-files", "profile", "donations", "hospitals", "doctors", "patients"]),
  };
  const view = Boolean(defaults[user?.role]?.has(pageId));
  const readOnlyDefaults = (user?.role === "GVP" && ["hospitals", "doctors", "patients"].includes(pageId)) ||
    (user?.role === "CAS" && ["cas", "gvp"].includes(pageId));
  return { view, edit: view && !readOnlyDefaults };
};
