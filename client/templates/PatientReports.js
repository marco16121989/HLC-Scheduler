import { useMemo, useState } from "react";

const COLORS = ["#0d6efd", "#198754", "#dc3545", "#fd7e14", "#6f42c1", "#0dcaf0", "#6c757d"];

const countBy = (items, getLabel) => Object.entries(items.reduce((counts, item) => {
  const label = getLabel(item) || "Non specificato";
  counts[label] = (counts[label] || 0) + 1;
  return counts;
}, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

const limitSegments = (segments, limit = 6) => segments.length <= limit
  ? segments
  : [...segments.slice(0, limit - 1), { label: "Altro", value: segments.slice(limit - 1).reduce((sum, item) => sum + item.value, 0) }];

export const PieChart = ({ title, segments, emptyText = "Nessun dato disponibile", centerLabel = "Pazienti" }) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;
  return <section className="card patient-report-chart-card">
    <div className="card-header"><h2 className="card-title mb-0">{title}</h2></div>
    <div className="card-body">
      {total === 0 ? <p className="text-secondary mb-0">{emptyText}</p> : <div className="patient-pie-layout">
        <div className="patient-pie-wrap">
          <svg className="patient-pie" viewBox="0 0 42 42" role="img" aria-label={`${title}: ${total} ${centerLabel.toLowerCase()}`}>
            <circle className="patient-pie-base" cx="21" cy="21" r="15.9155" />
            {segments.map((segment, index) => {
              const percentage = segment.value / total * 100;
              const circle = <circle key={segment.label} cx="21" cy="21" r="15.9155" fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="8" pathLength="100" strokeDasharray={`${percentage} ${100 - percentage}`} strokeDashoffset={-offset} />;
              offset += percentage;
              return circle;
            })}
          </svg>
          <div className="patient-pie-total"><strong>{total}</strong><span>{centerLabel}</span></div>
        </div>
        <div className="patient-pie-legend">{segments.map((segment, index) => <div className="patient-pie-legend-row" key={segment.label}><span className="patient-pie-dot" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="patient-pie-label">{segment.label}</span><strong>{segment.value}</strong><span className="text-secondary">{Math.round(segment.value / total * 100)}%</span></div>)}</div>
      </div>}
    </div>
  </section>;
};

export const PatientReports = ({ patients = [], hospitals = [], users = [], currentUser, presidentId }) => {
  const [year, setYear] = useState("all");
  const [casFilter, setCasFilter] = useState("all");
  const availableYears = [...new Set(patients.map((patient) => patient.admissionDate?.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const casUsers = users.filter((user) => user.role === "CAS" && (user.presidentId || user.associationId) === presidentId).sort((a, b) => (a.username || "").localeCompare(b.username || "", "it-IT"));
  const visiblePatients = useMemo(() => patients.filter((patient) => {
    if (patient.presidentId !== presidentId) return false;
    if (currentUser.role === "GVP") {
      const ids = Array.isArray(patient.gvpIds) ? patient.gvpIds : patient.gvpId ? [patient.gvpId] : [];
      if (!ids.includes(currentUser.id)) return false;
    }
    const patientCasIds = [...new Set([...(patient.casIds || []), patient.casId].filter(Boolean))];
    if (casFilter === "none" && patientCasIds.length > 0) return false;
    if (!["all", "none"].includes(casFilter) && !patientCasIds.includes(casFilter)) return false;
    return year === "all" || patient.admissionDate?.startsWith(year);
  }), [patients, presidentId, currentUser, year, casFilter]);

  const departmentNames = new Map(hospitals.flatMap((hospital) => (hospital.departments || []).map((department) => [department.id, `${department.name} — ${hospital.name}`])));
  const statusSegments = countBy(visiblePatients, (patient) => patient.status || "In attesa di ricovero");
  const accessSegments = countBy(visiblePatients, (patient) => patient.admissionType === "scheduled" ? "Ricovero programmato" : "Emergenza");
  const sexSegments = countBy(visiblePatients, (patient) => patient.details?.sex || "Non specificato");
  const departmentSegments = limitSegments(countBy(visiblePatients, (patient) => departmentNames.get(patient.details?.departmentId) || patient.details?.hospitalDepartment || "Nessun reparto"));
  const activeCount = visiblePatients.filter((patient) => ["Ricoverato", "In attesa di ricovero"].includes(patient.status)).length;
  const completedCount = visiblePatients.filter((patient) => ["Dimesso", "Trasferito", "Deceduto"].includes(patient.status)).length;

  return <>
    <div className="app-content-header"><div className="container-fluid patient-report-header"><div><h1 className="mb-0">Report pazienti</h1><p className="text-secondary mb-0">Analisi riepilogativa dei pazienti visibili.</p></div><div className="patient-report-filters"><select className="form-select" value={casFilter} onChange={(event) => setCasFilter(event.target.value)} aria-label="Filtra report per CAS"><option value="all">Tutti i CAS</option><option value="none">Senza CAS</option>{casUsers.map((cas) => <option value={cas.id} key={cas.id}>{cas.username}</option>)}</select><select className="form-select patient-report-year" value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtra report per anno"><option value="all">Tutti gli anni</option>{availableYears.map((item) => <option value={item} key={item}>{item}</option>)}</select></div></div></div>
    <div className="app-content"><div className="container-fluid">
      <div className="patient-report-kpis"><article><span>Totale pazienti</span><strong>{visiblePatients.length}</strong></article><article><span>In gestione</span><strong>{activeCount}</strong></article><article><span>Conclusi</span><strong>{completedCount}</strong></article><article><span>Con reparto</span><strong>{visiblePatients.filter((patient) => patient.details?.departmentId).length}</strong></article></div>
      <div className="patient-report-grid"><PieChart title="Pazienti per stato" segments={statusSegments} /><PieChart title="Tipo di accesso" segments={accessSegments} /><PieChart title="Distribuzione per sesso" segments={sexSegments} /><PieChart title="Pazienti per reparto" segments={departmentSegments} /></div>
    </div></div>
  </>;
};
