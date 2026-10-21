const normalizeDate = (value) => {
  if (typeof value !== "string") return null;
  const key = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : null;
};

export const getPatientCalendarDateRange = (patient) => {
  const date = normalizeDate(patient.admissionDate);
  if (!date) return null;
  const dischargeDate = normalizeDate(patient.dischargeDate);
  return { date, endDate: dischargeDate && dischargeDate >= date ? dischargeDate : date };
};

export const isCalendarEventOnDate = (event, date) =>
  Boolean(event.date) && event.date <= date && date <= (event.endDate || event.date);
