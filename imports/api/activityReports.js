const dateParts = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? { year: value.slice(0, 4), month: Number(value.slice(5, 7)) - 1 } : null;
};

const emptyTotals = () => ({ total: 0, discharged: 0, deceased: 0, transferred: 0 });
const statusMetric = { Dimesso: "discharged", Deceduto: "deceased", Trasferito: "transferred" };

export const activityReportYears = ({ patients = [], presidentId, currentYear }) =>
  [...new Set([String(currentYear), ...patients.filter(item => presidentId && item.presidentId === presidentId)
    .map(item => dateParts(item.admissionDate)?.year).filter(Boolean)])].sort((a, b) => b.localeCompare(a));

export const buildActivityReport = ({ patients = [], presidentId, year = "all", casId = "all", gvpId = null }) => {
  const organizationPatients = patients.filter(item => presidentId && item.presidentId === presidentId &&
    (casId === "all" || item.casId === casId || (Array.isArray(item.casIds) && item.casIds.includes(casId))) &&
    (!gvpId || item.gvpId === gvpId || (Array.isArray(item.gvpIds) && item.gvpIds.includes(gvpId))));
  const selectedPatients = organizationPatients.filter(item => year === "all" || dateParts(item.admissionDate)?.year === String(year));
  const labels = year === "all"
    ? [...new Set(selectedPatients.map(item => dateParts(item.admissionDate)?.year).filter(Boolean))].sort()
    : Array.from({ length: 12 }, (_, index) => String(index));
  const periods = labels.map(label => ({ label, ...emptyTotals() }));
  const totals = emptyTotals();
  let undatedCount = 0;
  selectedPatients.forEach(patient => {
    const key = statusMetric[patient.status];
    totals.total++;
    if (key) totals[key]++;
    const date = dateParts(patient.admissionDate);
    if (!date) { undatedCount++; return; }
    const period = periods.find(item => item.label === (year === "all" ? date.year : String(date.month)));
    period.total++;
    if (key) period[key]++;
  });
  return { periods, totals, selectedPatients, undatedCount };
};
