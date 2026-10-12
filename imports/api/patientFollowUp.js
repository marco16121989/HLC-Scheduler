export const isFollowUpPatient = (patient) => patient?.status === "Dimesso"
  && patient.followUpEnabled === true;

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getFollowUpActivationDate = (patient) => {
  if (!isFollowUpPatient(patient)) return null;
  const storedDate = validDate(patient.followUpActivatedAt);
  if (storedDate) return storedDate;
  // Per i follow up già presenti, usa soltanto una data documentata nello storico.
  const activation = [...(Array.isArray(patient.changeHistory) ? patient.changeHistory : [])].reverse().find((entry) =>
    entry.field === "followUpEnabled" && entry.newValue === "true" && entry.oldValue !== "true",
  );
  return validDate(activation?.changedAt);
};

export const withFollowUpActivationDate = (patient, existing, now = new Date()) => ({
  ...patient,
  followUpActivatedAt: !isFollowUpPatient(patient) ? null
    : isFollowUpPatient(existing) ? getFollowUpActivationDate(existing) : now,
});

export const formatFollowUpActivationDate = (value) => {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome",
  }).format(date) : "Non disponibile";
};

export const NON_FOLLOW_UP_PATIENT_SELECTOR = {
  $nor: [{ status: "Dimesso", followUpEnabled: true }],
};

export const getFollowUpPatientSelector = (user) => {
  const profile = user?.profile || user;
  const userId = user?._id || user?.id;
  const role = profile?.role;
  const presidentId = role === "Presidente" ? userId : profile?.presidentId || profile?.associationId;
  if (!userId || !presidentId || !["Presidente", "CAS"].includes(role)) return { _id: null };
  return {
    presidentId, status: "Dimesso", followUpEnabled: true,
    ...(role === "CAS" ? { $or: [{ casIds: userId }, { casId: userId }] } : {}),
  };
};

export const canViewPatientFollowUp = (user, patient) => {
  if (!isFollowUpPatient(patient)) return false;
  const selector = getFollowUpPatientSelector(user);
  if (!selector.presidentId || patient.presidentId !== selector.presidentId) return false;
  if (!selector.$or) return true;
  const userId = user?._id || user?.id;
  return patient.casId === userId || (Array.isArray(patient.casIds) && patient.casIds.includes(userId));
};

export const getPatientsForView = (patients, user, presidentId, followUpOnly) => patients.filter((patient) =>
  patient.presidentId === presidentId && (followUpOnly
    ? canViewPatientFollowUp(user, patient)
    : !isFollowUpPatient(patient) || canViewPatientFollowUp(user, patient)),
);
