export const GVP_PATIENT_SUMMARY_FIELDS = [
  ["firstName", "Nome"],
  ["lastName", "Cognome"],
  ["details.sex", "Sesso"],
  ["details.maidenName", "Cognome da nubile"],
  ["details.datCompleted", "DAT compilata?"],
  ["details.datRegistered", "DAT registrata?"],
  ["admissionType", "Tipo di accesso"],
  ["status", "Stato"],
  ["doctorId", "Medico responsabile"],
  ["recommendedDoctorIds", "Medici consigliati"],
  ["details.hospitalRoom", "Numero camera"],
  ["details.hospitalBed", "Numero letto"],
  ["details.anesthesiologistDate", "Visita con l’anestesista"],
  ["details.anesthesiologistTime", "Orario visita"],
  ["details.anesthesiologistName", "Anestesista"],
  ["casIds", "CAS"],
  ["gvpIds", "GVP assegnati"],
  ["details.departmentId", "Reparto"],
  ["details.congregation", "Congregazione"],
  ["details.age", "Età"],
  ["details.patientPhone", "Numero di cellulare del paziente"],
  ["details.healthProblems", "Problemi di salute"],
  ["details.spiritualCondition", "Condizione spirituale"],
  ["details.nonWitnessFamily", "Familiari non Testimoni coinvolti"],
  ["details.elderName", "Nome dell’anziano"],
  ["details.elderEmail", "E-mail dell’anziano"],
  ["details.elderPhone", "Cellulare dell’anziano"],
  ["details.simplifiedNotes", "Note per il CAS"],
];

export const GVP_PATIENT_SHARED_FIELD_PATHS = GVP_PATIENT_SUMMARY_FIELDS.map(([path]) => path);
export const DEFAULT_GVP_PATIENT_SHARED_FIELDS = [...GVP_PATIENT_SHARED_FIELD_PATHS];

export const normalizeGvpPatientSharedFields = (fields) => {
  const allowed = new Set(GVP_PATIENT_SHARED_FIELD_PATHS);
  return [...new Set(Array.isArray(fields) ? fields : DEFAULT_GVP_PATIENT_SHARED_FIELDS)]
    .filter((field) => allowed.has(field));
};
