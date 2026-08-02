import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const safeText = (value) => String(value ?? "")
  .replaceAll("μ", "u")
  .replaceAll("✓", "Si")
  .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "?");

const wrapText = (value, font, size, maxWidth) => {
  const paragraphs = safeText(value).split(/\r?\n/);
  const lines = [];
  for (const paragraph of paragraphs) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
};

export const createPopulatedPatientPdf = async ({ patient, doctorName, casName }) => {
  const response = await fetch("/documents/hlc-7_I.pdf");
  if (!response.ok) throw new Error("Impossibile caricare la scheda HLC-7-I.");

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  if (pages.length < 3) throw new Error("Il modello HLC-7-I non contiene tutte le pagine previste.");

  const ink = rgb(0.02, 0.14, 0.45);
  const d = patient.details || {};
  const draw = (page, value, x, y, width, maxLines = 1, size = 7.2, useBold = false) => {
    if (value === undefined || value === null || value === "") return;
    const activeFont = useBold ? bold : font;
    const lines = wrapText(value, activeFont, size, width).slice(0, maxLines);
    lines.forEach((line, index) => page.drawText(line, {
      x,
      y: y - index * (size + 2),
      size,
      font: activeFont,
      color: ink,
      maxWidth: width,
    }));
  };

  const p1 = pages[0];
  draw(p1, d.callDateTime?.replace("T", " "), 132, 734, 82);
  draw(p1, d.callAuthor, 299, 734, 84);
  draw(p1, d.callAuthorContacts, 390, 724, 170, 2);
  draw(p1, d.requestedAssistance, 42, 704, 170, 2);
  draw(p1, d.relationshipToPatient, 310, 716, 250);

  draw(p1, `${patient.lastName} ${patient.firstName}`, 112, 684, 98, 1, 7.2, true);
  draw(p1, d.sex, 242, 684, 55);
  draw(p1, d.isMinorOrNewborn, 538, 684, 25);
  draw(p1, d.patientComments, 82, 670, 128);
  draw(p1, d.age, 232, 670, 60);
  draw(p1, d.fatherName, 365, 670, 123);
  draw(p1, d.fatherBaptized, 538, 670, 25);
  draw(p1, d.fatherBaptized, 272, 656, 25);
  draw(p1, d.fatherGoodStanding, 292, 646, 25);
  draw(p1, d.fatherDpaComplete, 282, 637, 25);
  draw(p1, d.motherName, 372, 656, 116);
  draw(p1, d.motherBaptized, 538, 656, 25);
  draw(p1, d.familySituation, 306, 630, 252, 2);
  draw(p1, d.hospitalName, 116, 627, 176);
  draw(p1, d.hospitalRoom, 70, 606, 54);
  draw(p1, d.hospitalPhone, 164, 606, 128);
  draw(p1, d.congregation, 100, 586, 190);
  draw(p1, d.localElders, 126, 566, 164);
  draw(p1, d.localEldersPhones, 160, 546, 130);
  draw(p1, d.birthWeight, 368, 586, 108);
  draw(p1, d.apgarScore, 530, 586, 30);
  draw(p1, d.gestationalAge, 410, 566, 65);
  draw(p1, d.birthType, 514, 566, 46);
  draw(p1, d.birthDate, 360, 546, 115);
  draw(p1, d.apgarFiveMinutes, 520, 546, 40);

  draw(p1, d.specificProblem || patient.pathology, 42, 486, 515, 6, 7.5);
  draw(p1, d.medicalHistory, 42, 430, 515, 4, 7.5);
  const labPositions = [
    { prefix: "lab1", x: 42, y: 375 },
    { prefix: "lab2", x: 304, y: 375 },
    { prefix: "lab3", x: 42, y: 315 },
  ];
  labPositions.forEach(({ prefix, x, y }) => {
    draw(p1, d[`${prefix}DateTime`]?.replace("T", " "), x + 80, y, 130);
    draw(p1, d[`${prefix}Hemoglobin`], x + 98, y - 19, 34);
    draw(p1, d[`${prefix}Hematocrit`], x + 204, y - 19, 35);
    draw(p1, d[`${prefix}Platelets`], x + 98, y - 37, 34);
    draw(p1, d[`${prefix}Other`], x + 151, y - 37, 88);
  });
  draw(p1, d.attendingDoctor || doctorName, 112, 238, 178);
  draw(p1, d.attendingDoctorSpecialization, 365, 238, 190);
  draw(p1, d.otherAttendingDoctor, 126, 221, 164);
  draw(p1, d.otherDoctorSpecialization, 365, 221, 190);
  draw(p1, d.treatmentPlan, 42, 165, 515, 6, 7.2);
  draw(p1, d.staffInformed, 505, 180, 50, 1, 7.2, true);

  const p2 = pages[1];
  draw(p2, d.legalActionThreatened, 530, 776, 30, 1, 7.2, true);
  draw(p2, d.strategies, 42, 728, 515, 12, 7.5);
  draw(p2, d.medicalArticles, 42, 548, 515, 10, 7.5);
  draw(p2, d.doctorWillCooperate, 505, 434, 50, 1, 7.2, true);
  draw(p2, d.consultAvailable, 510, 405, 45, 1, 7.2, true);
  draw(p2, d.consultDoctorName, 170, 395, 120);
  draw(p2, d.consultContactMethod, 490, 395, 65);
  draw(p2, d.consultSpecialization, 105, 375, 185);
  draw(p2, d.consultNotes, 118, 355, 437, 2);
  draw(p2, d.transferMethod, 42, 318, 515, 2);
  draw(p2, d.transferArrangementsConfirmed, 245, 311, 42, 1, 7.2, true);
  draw(p2, d.healthInformationContacted, 510, 301, 45, 1, 7.2, true);
  draw(p2, d.transferHospital, 172, 292, 383);
  draw(p2, d.transferDoctor, 222, 272, 333);
  draw(p2, d.transferHospitalPhone, 230, 251, 325);
  draw(p2, d.transferNotes, 118, 231, 437, 2);

  const p3 = pages[2];
  draw(p3, d.outcome, 42, 738, 515, 44, 8);
  draw(p3, d.followUpElders, 225, 753, 330, 2, 7.2);
  draw(p3, casName, 42, 70, 200, 1, 7);

  pdf.setTitle(`HLC-7-I - ${patient.lastName} ${patient.firstName}`);
  pdf.setSubject("Scheda emergenza sanitaria compilata");
  const bytes = await pdf.save();
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
};
