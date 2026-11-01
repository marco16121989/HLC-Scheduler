import { isFollowUpPatient } from "./patientFollowUp.js";

export const CLOSED_PATIENT_HIDDEN_FIELDS = ["firstName", "lastName", "details.maidenName"];

export const shouldMaskPatientIdentity = (patient) => {
  if (!patient || isFollowUpPatient(patient)) return false;
  if (patient.status === "Dimesso" || patient.status === "Deceduto") return true;
  if (patient.status !== "Trasferito") return false;
  const destination = Array.isArray(patient.departmentHistory) ? patient.departmentHistory.at(-1) : null;
  // Solo una destinazione selezionata dall'elenco documenta un trasferimento interno.
  // L'assegnazione iniziale non prova dove sia stato trasferito il paziente.
  return !destination || destination.external === true || destination.initialAssignment === true
    || !destination.toDepartmentId;
};
