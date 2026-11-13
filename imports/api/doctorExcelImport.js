export const normalizeImportValue = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("it-IT").replace(/\s+/g, " ");

const similarityText = (value) => {
  const words = normalizeImportValue(value).replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const specificWords = words.filter((word) => !["ospedale", "osp", "reparto", "di", "del", "della", "dell", "dei", "delle"].includes(word));
  return (specificWords.length ? specificWords : words).join(" ");
};

const editSimilarity = (first, second) => {
  if (first === second) return 1;
  if (!first || !second) return 0;
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= second.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[second.length] / Math.max(first.length, second.length);
};

const nameSimilarity = (query, candidate) => {
  if (!query || !candidate) return 0;
  const queryWords = query.split(" ");
  const candidateWords = candidate.split(" ");
  const wordScore = (first, second) => first.reduce((sum, word) => sum + Math.max(...second.map((other) => editSimilarity(word, other))), 0) / first.length;
  const tokenScore = (wordScore(queryWords, candidateWords) + wordScore(candidateWords, queryWords)) / 2;
  const substringScore = candidate.includes(query) || query.includes(candidate)
    ? 0.85 + 0.15 * Math.min(query.length, candidate.length) / Math.max(query.length, candidate.length)
    : 0;
  return Math.max(editSimilarity(query, candidate), tokenScore, substringScore);
};

export const rankDoctorImportOptions = (options, sourceValue) => {
  const query = similarityText(sourceValue);
  const normalizedSource = normalizeImportValue(sourceValue);
  return options.map((option) => ({ option, exact: normalizedSource !== "" && normalizeImportValue(option.name) === normalizedSource, score: nameSimilarity(query, similarityText(option.name)) }))
    .sort((first, second) => Number(second.exact) - Number(first.exact) || second.score - first.score || (first.option.name || "").localeCompare(second.option.name || "", "it-IT") || String(first.option.id).localeCompare(String(second.option.id)))
    .map(({ option }) => option);
};

export const importProfessionalRoles = ["Medico", "Chirurgo", "Anestesista"];
const columns = Object.assign(Object.create(null), { cognome: "lastName", nome: "firstName", ospedale: "hospitalName", reparto: "departmentName", professione: "professionalRole", telefono: "phone", email: "email", note: "notes" });
const uniqueMatch = (items, name) => {
  if (!normalizeImportValue(name)) return "";
  const matches = items.filter((item) => normalizeImportValue(item.name) === normalizeImportValue(name));
  return matches.length === 1 ? matches[0].id : "";
};

export const matchDoctorImportRow = (row, hospitals) => {
  const hospitalId = uniqueMatch(hospitals, row.hospitalName);
  const hospital = hospitals.find((item) => item.id === hospitalId);
  return { ...row, hospitalId, departmentId: uniqueMatch(hospital?.departments || [], row.departmentName) };
};

export const parseDoctorImportRows = (matrix, hospitals, firstRow = 1) => {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));
  if (headerIndex < 0) throw new Error("Il foglio è vuoto.");
  const headers = matrix[headerIndex].map(normalizeImportValue);
  for (const header of ["cognome", "nome", "ospedale", "reparto"]) {
    if (!headers.includes(header)) throw new Error(`Colonna mancante: ${header}.`);
  }
  const knownHeaders = headers.filter((header) => columns[header]);
  if (new Set(knownHeaders).size !== knownHeaders.length) throw new Error("Sono presenti intestazioni duplicate.");
  const columnCount = matrix.slice(headerIndex).reduce((maximum, cells) => Math.max(maximum, cells.length), 0);
  const sourceColumns = Array.from({ length: columnCount }, (_, index) => ({
    index,
    label: String(matrix[headerIndex][index] ?? "").trim() || `Colonna ${index + 1}`,
    field: columns[headers[index]] || "",
  }));
  const rows = [];
  matrix.slice(headerIndex + 1).forEach((cells, index) => {
    if (!cells.some((cell) => String(cell ?? "").trim())) return;
    const row = { rowNumber: firstRow + headerIndex + index + 1, firstName: "", lastName: "", hospitalName: "", departmentName: "", professionalRole: "", phone: "", email: "", notes: "", sourceColumns, sourceCells: Array.from({ length: columnCount }, (_, columnIndex) => String(cells[columnIndex] ?? "")) };
    headers.forEach((header, columnIndex) => {
      if (columns[header]) row[columns[header]] = String(cells[columnIndex] ?? "").trim();
    });
    row.email = row.email.toLowerCase();
    row.professionalRole = importProfessionalRoles.find((role) => normalizeImportValue(role) === normalizeImportValue(row.professionalRole)) || row.professionalRole;
    rows.push(matchDoctorImportRow(row, hospitals));
  });
  if (!rows.length) throw new Error("Il foglio non contiene medici.");
  return rows;
};

export const isDoctorImportCellMissing = (row, column) => {
  if (String(row.sourceCells[column.index] ?? "").trim()) return false;
  if (column.field === "hospitalName" && row.hospitalId) return false;
  if (column.field === "departmentName" && row.departmentId) return false;
  if (column.field === "professionalRole" && row.professionalRole) return false;
  return true;
};

export const getDoctorImportRoleConflicts = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    if (!row.firstName || !row.lastName) continue;
    const key = JSON.stringify([normalizeImportValue(row.lastName), normalizeImportValue(row.firstName)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const conflicts = new Map();
  for (const group of groups.values()) {
    const roles = new Set(group.map((row) => normalizeImportValue(row.professionalRole)).filter(Boolean));
    if (roles.size < 2) continue;
    const message = `Professioni diverse per ${group[0].lastName} ${group[0].firstName} (righe Excel: ${group.map((row) => row.rowNumber).join(", ")}). Uniforma la professione per continuare.`;
    for (const row of group) conflicts.set(row.rowNumber, message);
  }
  return conflicts;
};

export const getDoctorImportIssues = (row, hospitals, doctors = [], presidentId) => {
  const issues = [];
  if (!row.firstName || !row.lastName) issues.push("Nome o cognome mancante");
  if (!normalizeImportValue(row.professionalRole) && row.sourceColumns?.some((column) => column.field === "professionalRole")) issues.push("Professione mancante");
  if (row.professionalRole && !importProfessionalRoles.includes(row.professionalRole)) issues.push("Professione non riconosciuta");
  if (row.firstName && row.lastName && doctors.some((doctor) => doctor.presidentId === presidentId && normalizeImportValue(doctor.lastName) === normalizeImportValue(row.lastName) && normalizeImportValue(doctor.firstName) === normalizeImportValue(row.firstName))) {
    issues.push("Medico già presente");
  }
  const hospital = hospitals.find((item) => item.id === row.hospitalId);
  if (!hospital) issues.push("Ospedale non riconosciuto o ambiguo");
  if (!hospital?.departments?.some((item) => item.id === row.departmentId)) issues.push("Reparto non riconosciuto o ambiguo");
  return issues;
};

export const buildDoctorImportRecords = ({ rows, hospitals, doctors, presidentId, createId }) => {
  if (!rows.length) throw new Error("Seleziona un file con almeno un medico.");
  const groups = new Map();
  const notesByDoctor = new Map();
  const rolesByDoctor = new Map();
  for (const row of rows) {
    const issues = getDoctorImportIssues(row, hospitals, doctors, presidentId);
    if (issues.length) throw new Error(`Riga ${row.rowNumber}: ${issues.join(". ")}.`);
    const key = JSON.stringify([normalizeImportValue(row.lastName), normalizeImportValue(row.firstName)]);
    let doctor = groups.get(key);
    if (!doctor) {
      doctor = { id: createId(), firstName: row.firstName, lastName: row.lastName, phone: row.phone, email: row.email, departmentIds: [], presidentId, doctorType: "Non indicato", professionalRole: "Medico", notes: "", officeInstructions: "" };
      groups.set(key, doctor);
    }
    for (const field of ["phone", "email"]) {
      if (doctor[field] && row[field] && doctor[field] !== row[field]) throw new Error(`Riga ${row.rowNumber}: contatti diversi per ${row.lastName} ${row.firstName}. Verifica eventuali omonimi nel file.`);
      if (row[field]) doctor[field] = row[field];
    }
    if (row.professionalRole) {
      if (rolesByDoctor.has(key) && rolesByDoctor.get(key) !== row.professionalRole) throw new Error(`Riga ${row.rowNumber}: professioni diverse per ${row.lastName} ${row.firstName}.`);
      rolesByDoctor.set(key, row.professionalRole);
      doctor.professionalRole = row.professionalRole;
    }
    const note = (row.notes || "").trim();
    if (note) {
      if (!notesByDoctor.has(key)) notesByDoctor.set(key, new Set());
      notesByDoctor.get(key).add(note);
      doctor.notes = [...notesByDoctor.get(key)].join("\n");
    }
    if (!doctor.departmentIds.includes(row.departmentId)) doctor.departmentIds.push(row.departmentId);
  }
  const records = [...groups.values()];
  const emails = new Set(doctors.map((doctor) => normalizeImportValue(doctor.email)).filter(Boolean));
  for (const doctor of records) {
    const email = normalizeImportValue(doctor.email);
    if (email && emails.has(email)) throw new Error(`L’email ${doctor.email} è già associata a un altro medico.`);
    if (email) emails.add(email);
  }
  return records;
};
