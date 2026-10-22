export const SPECIALIZATION_COLUMNS = [
  ["Anestesiologia", "Cardiochirurgia", "Centro ustioni", "Chirurgia colorettale", "Chirurgia generale", "Chirurgia orale e maxillo-facciale", "Chirurgia ortopedica", "Chirurgia toracica", "Chirurgia traumatologica", "Chirurgia vascolare", "Ematologia", "Gastroenterologia", "Ginecologia", "Ginecologia oncologica", "Medicina d’urgenza", "Medicina interna"],
  ["Medicina ospedaliera", "Medico del travaglio", "Medico notturno", "Nefrologia", "Neonatologia", "Neurochirurgia", "Oncologia", "Ostetricia", "Otorinolaringoiatria e Chirurgia della testa e del collo", "Perinatologia (gravidanze ad alto rischio)", "Pneumologia", "Radiologia interventistica", "Terapia intensiva/Rianimazione", "Trapianti", "Urologia", "Altro"],
];
export const normalizeSpecialization = (value) => String(value || "").replaceAll("'", "’").trim().toLocaleLowerCase("it");

// Registry department names that differ from the annual form.
const specializationAliases = new Map([
  ["Chirurgia dei trapianti", "Trapianti"],
  ["Oncologia ginecologica", "Ginecologia oncologica"],
  ["Otorinolaringoiatria — Chirurgia cervico-facciale", "Otorinolaringoiatria e Chirurgia della testa e del collo"],
].map(([name, specialization]) => [normalizeSpecialization(name), normalizeSpecialization(specialization)]));
const knownSpecializations = new Set(SPECIALIZATION_COLUMNS.flat().map(normalizeSpecialization));

export const countAnnualReportDoctors = ({ doctors = [], hospitals = [], presidentId }) => {
  if (!presidentId) return {};
  const departments = new Map(hospitals.filter(hospital => hospital.presidentId === presidentId)
    .flatMap(hospital => (hospital.departments || []).map(department => [department.id, department.name])));
  const totals = {};
  doctors.filter(doctor => doctor.presidentId === presidentId).forEach(doctor => {
    const specializations = doctor.professionalRole === "Anestesista"
      ? new Set([normalizeSpecialization("Anestesiologia")])
      : new Set((doctor.departmentIds || []).map(id => departments.get(id)).filter(Boolean).map(name => {
        const key = normalizeSpecialization(name);
        return specializationAliases.get(key) || (knownSpecializations.has(key) ? key : "altro");
      }));
    if (!specializations.size) specializations.add("altro");
    specializations.forEach(key => { totals[key] = (totals[key] || 0) + 1; });
  });
  return totals;
};

export const refreshAnnualReportDoctors = (report, specializationTotals) => report.sentAt
  ? report
  : { ...report, specializationTotals };
