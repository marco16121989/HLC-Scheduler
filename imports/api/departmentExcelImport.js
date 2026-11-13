import { normalizeImportValue } from "./doctorExcelImport.js";

export const parseDepartmentImportRows = (matrix, firstRow = 1) => {
  const headerIndex = matrix.findIndex((cells) => cells.some((cell) => String(cell ?? "").trim()));
  if (headerIndex < 0) throw new Error("Il foglio è vuoto.");
  if (matrix.slice(headerIndex).some((cells) => cells.slice(1).some((cell) => String(cell ?? "").trim()))) {
    throw new Error("Usa una sola colonna con intestazione Reparto.");
  }
  if (!["reparto", "reparti", "nome reparto"].includes(normalizeImportValue(matrix[headerIndex][0]))) {
    throw new Error("La prima riga deve contenere l'intestazione Reparto.");
  }
  const rows = matrix.slice(headerIndex + 1).flatMap((cells, index) => {
    const name = String(cells[0] ?? "").trim();
    return name ? [{ rowNumber: firstRow + headerIndex + index + 1, name }] : [];
  });
  if (!rows.length) throw new Error("Il foglio non contiene reparti.");
  return rows;
};

export const getDepartmentImportPreview = (rows, departments) => {
  const names = new Set(departments.map((department) => normalizeImportValue(department.name)));
  return rows.map((row) => {
    const name = normalizeImportValue(row.name);
    const issue = !name ? "Nome reparto mancante" : names.has(name) ? "Già presente: non verrà importato" : "";
    names.add(name);
    return { ...row, issue, ready: Boolean(name && !issue) };
  });
};
