// Le date di accesso e dimissione servono al calendario anche quando i campi facoltativi
// condivisi con il GVP sono stati personalizzati dal Presidente.
const REQUIRED_FIELDS = [
  "presidentId", "casId", "casIds", "gvpId", "gvpIds", "gvpNotes", "transferNotes", "admissionDate", "dischargeDate",
  "details.patientPhone", "details.elderName", "details.elderPhone", "details.phoneContacts",
];

export const gvpPatientProjection = (sharedFields) => Object.fromEntries(
  [...REQUIRED_FIELDS, ...sharedFields].map((field) => [field, 1]),
);

export const pickGvpPatientFields = (patient, sharedFields) => {
  const visible = { _id: patient._id };
  for (const path of [...REQUIRED_FIELDS, ...sharedFields]) {
    const value = path.split(".").reduce((current, part) => current?.[part], patient);
    if (value === undefined) continue;
    const parts = path.split(".");
    let cursor = visible;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) cursor[part] = value;
      else cursor = cursor[part] ||= {};
    });
  }
  return visible;
};
