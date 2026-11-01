import { shouldMaskPatientIdentity } from "./patientPrivacy.js";

// Ripristina le schede chiuse dalla precedente gestione dei trasferimenti interni.
export const recoverInternalTransferPatients = async (patients) => {
  const transferred = await patients.find({ status: "Trasferito" }).fetchAsync();
  let recovered = 0;
  for (const patient of transferred) {
    if (shouldMaskPatientIdentity(patient)) continue;
    recovered += await patients.updateAsync({
      _id: patient._id,
      status: "Trasferito",
      departmentHistory: patient.departmentHistory,
    }, {
      $set: { status: "Ricoverato", updatedAt: new Date() },
    });
  }
  return recovered;
};
