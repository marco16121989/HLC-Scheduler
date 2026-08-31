import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TEMPLATE_URL = "/templates/hlc-30_I.pdf";
const black = rgb(0.05, 0.05, 0.05);
const safeText = (value) => String(value ?? "").replaceAll("’", "'");

const drawFitted = (page, value, { x, y, maxWidth, font, size = 9.4, minSize = 6, align = "left" }) => {
  const text = safeText(value);
  let fittedSize = size;
  while (fittedSize > minSize && font.widthOfTextAtSize(text, fittedSize) > maxWidth) fittedSize -= 0.25;
  const width = font.widthOfTextAtSize(text, fittedSize);
  page.drawText(text, { x: align === "right" ? x + maxWidth - width : x, y, size: fittedSize, font, color: black });
};

const wrapText = (value, font, size, maxWidth) => {
  const lines = [];
  safeText(value || "Nessuna").split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return lines.push("");
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    });
    lines.push(line);
  });
  return lines;
};

export const createAnnualReportPdf = async ({ casName, casMemberCount, gvpMemberCount, presentationCount, specializationColumns, totalFor, significantIssues, reportDate, casMember, year }) => {
  const templateResponse = await fetch(TEMPLATE_URL);
  if (!templateResponse.ok) throw new Error("Modello PDF del rapporto annuale non disponibile.");
  const pdf = await PDFDocument.load(await templateResponse.arrayBuffer());
  const page = pdf.getPage(0);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Sezione 1: valori inseriti negli spazi del modello originale.
  drawFitted(page, casName, { x: 105, y: 733.8, maxWidth: 184, font: bold });
  drawFitted(page, casMemberCount, { x: 410, y: 733.8, maxWidth: 130, font: bold, align: "right" });
  drawFitted(page, presentationCount, { x: 257, y: 718.4, maxWidth: 32, font: bold, align: "right" });
  drawFitted(page, gvpMemberCount, { x: 410, y: 718.4, maxWidth: 130, font: bold, align: "right" });

  // Sezione 2: sedici righe e due colonne, con le coordinate esatte della tabella originale.
  specializationColumns.forEach((column, columnIndex) => column.forEach((specialization, rowIndex) => {
    const y = 668.6 - rowIndex * 15.4356;
    const x = columnIndex === 0 ? 258 : 510;
    drawFitted(page, totalFor(specialization), { x, y, maxWidth: 30, font: bold, size: 9.4, align: "right" });
  }));

  // Sezione 3: testo contenuto nel riquadro già presente nel modello.
  const issueLines = wrapText(significantIssues, regular, 9.3, 486).slice(0, 22);
  issueLines.forEach((line, index) => page.drawText(line, { x: 54, y: 368 - index * 10.2, size: 9.3, font: regular, color: black }));

  // Sezione 4: data e membro CAS sulle righe predisposte dal documento.
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(reportDate || "") ? reportDate.split("-").reverse().join("/") : reportDate || "";
  drawFitted(page, formattedDate, { x: 78, y: 105.4, maxWidth: 205, font: bold, size: 9.4 });
  drawFitted(page, casMember, { x: 369, y: 105.4, maxWidth: 170, font: bold, size: 9.4 });

  pdf.setTitle(`Rapporto annuale ${year || ""} del Comitato di Assistenza Sanitaria`);
  const bytes = await pdf.save();
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
};
