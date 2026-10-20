const normalize = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it-IT");

const normalizeTerm = (value) => {
  if (value.startsWith("chirurg")) return "chirurg";
  if (value.startsWith("ortoped")) return "ortoped";
  return value;
};

const oneLine = (value) => String(value || "").replace(/\s+/g, " ").trim();
const departmentKey = (name) => normalize(oneLine(name));

export function getDoctorContactDepartmentOptions({ hospitals = [], presidentId, query = "" }) {
  if (!presidentId) return [];
  const options = new Map();
  for (const hospital of hospitals.filter((item) => item.presidentId === presidentId)) {
    for (const department of hospital.departments || []) {
      const name = oneLine(department.name), key = departmentKey(name);
      if (!key) continue;
      if (!options.has(key)) options.set(key, { key, name });
    }
  }
  const terms = (normalize(query).match(/[\p{L}\p{N}]+/gu) || []).map(normalizeTerm);
  return [...options.values()].filter((option) => terms.every((term) => option.key.includes(term)))
    .sort((a, b) => a.name.localeCompare(b.name, "it-IT"));
}

function buildContactResults({ doctors = [], hospitals = [], presidentId, departmentKeys = [] }, showHospitalDepartments) {
  const selectedDepartments = new Set(departmentKeys);
  const groups = [];
  const matchedDoctors = new Set();
  const visibleDoctors = doctors.filter((doctor) => doctor.presidentId === presidentId)
    .sort((a, b) => ((a.lastName || "") + " " + (a.firstName || "")).localeCompare((b.lastName || "") + " " + (b.firstName || ""), "it-IT"));
  for (const hospital of hospitals) {
    if (!presidentId || hospital.presidentId !== presidentId) continue;
    const departments = (hospital.departments || []).filter((department) => selectedDepartments.has(departmentKey(department.name)));
    if (!departments.length) continue;
    const contacts = [];
    for (const doctor of visibleDoctors) {
      const assignedDepartments = departments.filter((department) => (doctor.departmentIds || []).includes(department.id));
      if (!assignedDepartments.length) continue;
      matchedDoctors.add(doctor);
      contacts.push({
        id: doctor.id,
        name: oneLine((doctor.lastName || "") + " " + (doctor.firstName || "")) || "Medico senza nome",
        role: oneLine(doctor.professionalRole) || "Medico",
        departments: [...new Set(assignedDepartments.map((department) => oneLine(department.name)))],
        phone: oneLine(doctor.phone), email: oneLine(doctor.email),
      });
    }
    if (contacts.length) groups.push({
      id: hospital.id, name: oneLine(hospital.name) || "Ospedale non indicato",
      departments: [...new Set(departments.map((department) => oneLine(department.name)))], contacts,
    });
  }
  groups.sort((a, b) => a.name.localeCompare(b.name, "it-IT"));
  const text = groups.map((group) => {
    const heading = [group.name];
    if (showHospitalDepartments) heading.push("Reparti: " + group.departments.join(", "));
    const contacts = group.contacts.map((contact) => [
      contact.name + " — " + contact.role, "Reparti: " + contact.departments.join(", "),
      "Tel: " + (contact.phone || "non disponibile"), "Email: " + (contact.email || "non disponibile"),
    ].join("\n")).join("\n\n");
    return heading.join("\n") + "\n\n" + contacts;
  }).join("\n\n──────────\n\n");
  return { count: matchedDoctors.size, groups, text };
}

export function buildDoctorContactResults(options = {}) {
  return buildContactResults(options, false);
}

export function buildHospitalContactResults(options = {}) {
  const result = buildContactResults(options, true);
  return { ...result, hospitalCount: result.groups.length };
}
