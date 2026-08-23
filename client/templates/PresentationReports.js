import { useMemo, useState } from "react";
import { PieChart } from "./PatientReports.js";

const countBy = (items, getLabels) => {
  const counts = {};
  items.forEach((item) => {
    const labels = getLabels(item);
    (Array.isArray(labels) ? labels : [labels || "Non specificato"]).forEach((label) => { counts[label || "Non specificato"] = (counts[label || "Non specificato"] || 0) + 1; });
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

const limitSegments = (segments, limit = 6) => segments.length <= limit ? segments : [...segments.slice(0, limit - 1), { label: "Altro", value: segments.slice(limit - 1).reduce((sum, item) => sum + item.value, 0) }];

export const PresentationReports = ({ presentations = [], presidentId }) => {
  const [year, setYear] = useState("all");
  const organizationPresentations = presentations.filter((item) => item.presidentId === presidentId);
  const years = [...new Set(organizationPresentations.map((item) => item.presentationDate?.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const visible = useMemo(() => organizationPresentations.filter((item) => year === "all" || item.presentationDate?.startsWith(year)), [presentations, presidentId, year]);
  const attendees = visible.reduce((sum, item) => sum + (Number(item.attendeesCount) || 0), 0);
  const average = visible.length ? Math.round(attendees / visible.length) : 0;
  const typeSegments = countBy(visible, (item) => item.presentationTypes?.length ? item.presentationTypes : ["Non specificato"]);
  const recordSegments = countBy(visible, (item) => item.recordType === "update" ? "Aggiornamento" : "Nuova presentazione");
  const specializationSegments = limitSegments(countBy(visible, (item) => item.attendeeSpecialization));
  const locationSegments = limitSegments(countBy(visible, (item) => item.city || item.province || item.country));

  return <>
    <div className="app-content-header"><div className="container-fluid patient-report-header"><div><h1 className="mb-0">Report presentazioni</h1><p className="text-secondary mb-0">Analisi riepilogativa delle presentazioni dell’organizzazione.</p></div><select className="form-select patient-report-year" value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtra presentazioni per anno"><option value="all">Tutti gli anni</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></div></div>
    <div className="app-content"><div className="container-fluid">
      <div className="patient-report-kpis"><article><span>Totale presentazioni</span><strong>{visible.length}</strong></article><article><span>Totale partecipanti</span><strong>{attendees}</strong></article><article><span>Media partecipanti</span><strong>{average}</strong></article><article><span>Con esperienze positive</span><strong>{visible.filter((item) => item.positiveExperiences?.trim()).length}</strong></article></div>
      <div className="patient-report-grid"><PieChart title="Tipi di presentazione" segments={typeSegments} centerLabel="Tipologie" /><PieChart title="Motivo della compilazione" segments={recordSegments} centerLabel="Presentazioni" /><PieChart title="Specializzazione dei presenti" segments={specializationSegments} centerLabel="Presentazioni" /><PieChart title="Distribuzione geografica" segments={locationSegments} centerLabel="Presentazioni" /></div>
    </div></div>
  </>;
};
