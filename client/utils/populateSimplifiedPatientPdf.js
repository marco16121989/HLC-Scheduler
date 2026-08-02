import { PDFDocument, StandardFonts } from "pdf-lib";

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("it-IT").format(new Date(`${value.slice(0, 10)}T00:00:00`))
  : "";

const dropdownValue = (value) => {
  if (value === "Sì") return "Si";
  if (value === "No") return "No";
  if (value === "Non noto") return "Non so";
  return "-";
};

export const createSimplifiedPatientPdf = async (patient) => {
  const response = await fetch("/documents/informazioni-cas-semplificato.pdf");
  if (!response.ok) throw new Error("Impossibile caricare il modello semplificato.");
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const form = pdf.getForm();
  const details = patient.details || {};
  const healthProblems = details.healthProblems
    || [details.specificProblem, details.medicalHistory, patient.pathology].filter(Boolean).join("\n");

  const values = {
    "Nome e Cognome": `${patient.lastName} ${patient.firstName}`,
    "Nome Congregazione": details.congregation || "",
    "Età": details.age || "",
    "Numero Cellulare": details.patientPhone || "",
    "Problemi di salute": healthProblems,
    "Condizione spirituale": details.spiritualCondition || "",
    "Familiari no TdG": details.nonWitnessFamily || details.familySituation || "",
    "Data": formatDate(new Date().toISOString().slice(0, 10)),
    "Nome Anziano": details.elderName || details.localElders || "",
    "Emali Anziano": details.elderEmail || "",
    "Cell Anziano": details.elderPhone || details.localEldersPhones || "",
    "Note": details.simplifiedNotes || patient.notes || "",
  };
  Object.entries(values).forEach(([name, value]) => form.getTextField(name).setText(String(value)));
  form.getDropdown("Dat").select(dropdownValue(details.datCompleted));
  form.getDropdown("Dat registrata").select(dropdownValue(details.datRegistered));
  form.updateFieldAppearances(await pdf.embedFont(StandardFonts.Helvetica));
  form.flatten();
  pdf.setTitle(`HLC-7-I semplificato - ${patient.lastName} ${patient.firstName}`);
  const bytes = await pdf.save();
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
};
