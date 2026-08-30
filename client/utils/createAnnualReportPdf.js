import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 1120;
const PAGE_HEIGHT = 712;
const TABLE_X = 112;
const TABLE_WIDTH = 918;
const COLUMN_WIDTH = TABLE_WIDTH / 2;
const black = rgb(0.05, 0.05, 0.05);
const gray = rgb(0.86, 0.86, 0.86);

const safeText = (value) => String(value ?? "").replaceAll("’", "'");

const drawTextFitted = (page, text, { x, y, maxWidth, font, size = 13, minSize = 8 }) => {
  const normalized = safeText(text);
  let fittedSize = size;
  while (fittedSize > minSize && font.widthOfTextAtSize(normalized, fittedSize) > maxWidth) fittedSize -= 0.5;
  page.drawText(normalized, { x, y, size: fittedSize, font, color: black });
};

const drawLine = (page, start, end) => page.drawLine({ start, end, thickness: 1, color: black });

export const createAnnualReportPdf = async ({ casName, casMemberCount, gvpMemberCount, presentationCount, specializationColumns, totalFor }) => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const title = "RAPPORTO ANNUALE DEL COMITATO DI ASSISTENZA SANITARIA";
  const titleSize = 24;
  page.drawText(title, {
    x: (PAGE_WIDTH - bold.widthOfTextAtSize(title, titleSize)) / 2,
    y: 654,
    size: titleSize,
    font: bold,
    color: black,
  });

  const sectionOneTop = 624;
  const sectionOneHeaderHeight = 37;
  const sectionOneRowHeight = 29;
  const sectionOneBottom = sectionOneTop - sectionOneHeaderHeight - sectionOneRowHeight * 2;
  page.drawRectangle({ x: TABLE_X, y: sectionOneTop - sectionOneHeaderHeight, width: TABLE_WIDTH, height: sectionOneHeaderHeight, color: gray, borderColor: black, borderWidth: 1 });
  page.drawText("SEZIONE 1", { x: TABLE_X + 8, y: sectionOneTop - 26, size: 17, font: bold, color: black });
  page.drawRectangle({ x: TABLE_X, y: sectionOneBottom, width: TABLE_WIDTH, height: sectionOneRowHeight * 2, borderColor: black, borderWidth: 1 });
  drawLine(page, { x: TABLE_X + COLUMN_WIDTH, y: sectionOneBottom }, { x: TABLE_X + COLUMN_WIDTH, y: sectionOneTop - sectionOneHeaderHeight });
  drawLine(page, { x: TABLE_X, y: sectionOneBottom + sectionOneRowHeight }, { x: TABLE_X + TABLE_WIDTH, y: sectionOneBottom + sectionOneRowHeight });
  const sectionOneRows = [
    [["Nome CAS:", casName], ["Numero di membri CAS:", casMemberCount]],
    [["Numero di presentazioni significative effettuate:", presentationCount], ["Numero di membri GVP:", gvpMemberCount]],
  ];
  sectionOneRows.forEach((row, rowIndex) => row.forEach(([label, value], columnIndex) => {
    const x = TABLE_X + columnIndex * COLUMN_WIDTH + 8;
    const y = sectionOneTop - sectionOneHeaderHeight - (rowIndex + 1) * sectionOneRowHeight + 9;
    drawTextFitted(page, label, { x, y, maxWidth: COLUMN_WIDTH - 95, font: regular, size: 13 });
    drawTextFitted(page, value, { x: TABLE_X + (columnIndex + 1) * COLUMN_WIDTH - 78, y, maxWidth: 68, font: bold, size: 13 });
  }));

  const sectionTwoTop = 503;
  const sectionTwoHeaderHeight = 37;
  const rowHeight = 28;
  const sectionTwoBottom = sectionTwoTop - sectionTwoHeaderHeight - rowHeight * 16;
  page.drawRectangle({ x: TABLE_X, y: sectionTwoTop - sectionTwoHeaderHeight, width: TABLE_WIDTH, height: sectionTwoHeaderHeight, color: gray, borderColor: black, borderWidth: 1 });
  page.drawText("SEZIONE 2", { x: TABLE_X + 8, y: sectionTwoTop - 26, size: 17, font: bold, color: black });
  page.drawText("(Indicare i totali di medici per specializzazione.)", { x: TABLE_X + 112, y: sectionTwoTop - 25, size: 14, font: regular, color: black });
  page.drawRectangle({ x: TABLE_X, y: sectionTwoBottom, width: TABLE_WIDTH, height: rowHeight * 16, borderColor: black, borderWidth: 1 });
  drawLine(page, { x: TABLE_X + COLUMN_WIDTH, y: sectionTwoBottom }, { x: TABLE_X + COLUMN_WIDTH, y: sectionTwoTop - sectionTwoHeaderHeight });
  for (let index = 1; index < 16; index += 1) {
    const y = sectionTwoBottom + index * rowHeight;
    drawLine(page, { x: TABLE_X, y }, { x: TABLE_X + TABLE_WIDTH, y });
  }
  specializationColumns.forEach((column, columnIndex) => column.forEach((specialization, rowIndex) => {
    const x = TABLE_X + columnIndex * COLUMN_WIDTH + 8;
    const y = sectionTwoTop - sectionTwoHeaderHeight - (rowIndex + 1) * rowHeight + 8;
    drawTextFitted(page, `${specialization}:`, { x, y, maxWidth: COLUMN_WIDTH - 70, font: regular, size: 12.5, minSize: 7.5 });
    drawTextFitted(page, totalFor(specialization), { x: TABLE_X + (columnIndex + 1) * COLUMN_WIDTH - 48, y, maxWidth: 38, font: bold, size: 12.5 });
  }));

  pdf.setTitle("Rapporto annuale del Comitato di Assistenza Sanitaria");
  const bytes = await pdf.save();
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
};
