import { PDFDocument, StandardFonts } from "pdf-lib";

const FIELD_NAMES = {
  comments: "900_7_Text_MultiLine_SanSerif",
  presentationDate: "900_8_Text_SanSerif",
  attendeesCount: "900_9_Text_SanSerif",
  event: "900_11_Text_SanSerif",
  coordinator: "900_12_Text_SanSerif",
  coordinatorContacts: "900_13_Text_SanSerif",
  coordinatorContactsAdditional: "900_14_Text_SanSerif",
  additionalInformation: "900_15_Text_SanSerif",
  eventWebsite: "900_16_Text_SanSerif",
  facility: "900_17_Text_SanSerif",
  address: "900_18_Text_SanSerif",
  addressAdditional: "900_19_Text_SanSerif",
  city: "900_20_Text_SanSerif",
  province: "900_21_Text_SanSerif",
  postalCode: "900_22_Text_SanSerif",
  country: "900_23_Text_SanSerif",
  problems: "900_24_Text_MultiLine_SanSerif",
  positiveExperiences: "900_25_Text_MultiLine_SanSerif",
  casName: "900_26_Text_SanSerif",
  declarationDate: "900_27_Text_SanSerif",
  casMember: "900_28_Text_SanSerif",
};

export const createPopulatedPresentationPdf = async (presentation) => {
  const response = await fetch("/documents/hlc-33_I-1.pdf");
  if (!response.ok) throw new Error("Impossibile caricare il modello HLC-33-I.");
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const form = pdf.getForm();

  if (presentation.recordType === "update") form.getCheckBox("900_1_CheckBox").check();
  if (presentation.recordType === "new") form.getCheckBox("900_2_CheckBox").check();
  ["In presenza", "Online", "PowerPoint", "Espositori"].forEach((type, index) => {
    if (presentation.presentationTypes?.includes(type)) {
      form.getCheckBox(`900_${index + 3}_CheckBox`).check();
    }
  });

  Object.entries(FIELD_NAMES).forEach(([key, pdfField]) => {
    form.getTextField(pdfField).setText(String(presentation[key] || ""));
  });
  // The template leaves these fields at font size 0 (automatic), which makes
  // short text render disproportionately large when the form is flattened.
  [FIELD_NAMES.problems, FIELD_NAMES.positiveExperiences].forEach((fieldName) => {
    form.getTextField(fieldName).setFontSize(10);
  });
  const specialization = form.getDropdown("900_10_HLC_Skills");
  const matchingOption = specialization.getOptions().find(
    (option) => option.trim() === presentation.attendeeSpecialization?.trim(),
  );
  if (matchingOption) specialization.select(matchingOption);

  form.updateFieldAppearances(await pdf.embedFont(StandardFonts.Helvetica));
  form.flatten();
  pdf.setTitle(`HLC-33-I - ${presentation.event || presentation.presentationDate}`);
  const bytes = await pdf.save();
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
};
