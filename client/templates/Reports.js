import { useEffect, useMemo, useRef, useState } from "react";
import { activityReportYears, buildActivityReport } from "/imports/api/activityReports.js";

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const number = value => new Intl.NumberFormat("it-IT").format(value);
const SERIES = [
  { key: "total", label: "Totale pazienti", color: "#4f7df3" },
  { key: "discharged", label: "Dimessi", color: "#15a68b" },
  { key: "transferred", label: "Trasferiti", color: "#e9a23b", dash: "7 4" },
  { key: "deceased", label: "Deceduti", color: "#dc6289", dash: "2 5" },
];

// Horizontal tangents smooth the curves without exceeding recorded values.
const smoothPath = points => points.reduce((path, point, index) => {
  if (!index) return `M ${point.x} ${point.y}`;
  const previous = points[index - 1];
  const control = (point.x - previous.x) * .4;
  return `${path} C ${previous.x + control} ${previous.y}, ${point.x - control} ${point.y}, ${point.x} ${point.y}`;
}, "");

const PatientTrendChart = ({ periods, year }) => {
  const container = useRef(null);
  const [width, setWidth] = useState(880);
  const [activeIndex, setActiveIndex] = useState(null);
  useEffect(() => {
    const element = container.current;
    const resize = () => setWidth(Math.max(280, element.clientWidth));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setActiveIndex(null), [year]);
  const labels = periods.map(period => year === "all" ? period.label : MONTHS[Number(period.label)]);
  const ceiling = Math.max(4, Math.ceil(Math.max(0, ...periods.map(period => period.total)) / 4) * 4);
  const left = 38;
  const right = width - 20;
  const baseline = 260;
  const x = index => periods.length === 1 ? (left + right) / 2 : left + index * (right - left) / Math.max(1, periods.length - 1);
  const y = value => baseline - value / ceiling * 220;
  const paths = SERIES.map(series => ({ ...series, path: smoothPath(periods.map((period, index) => ({ x: x(index), y: y(period[series.key]) }))) }));
  const active = activeIndex === null ? null : periods[activeIndex];
  const hasData = periods.some(period => period.total > 0);

  return <section className="card activity-trend-card patient-combined-chart">
    <div className="patient-combined-heading"><div><span className="patient-chart-eyebrow">ANDAMENTO PAZIENTI</span><h2>{year === "all" ? "Uno sguardo nel tempo" : `I pazienti nel ${year}`}</h2><p>{year === "all" ? "Distribuzione per anno di accesso" : "Distribuzione mese per mese"}</p></div><span className="patient-chart-period">{year === "all" ? "Tutti gli anni" : year}</span></div>
    <div className="activity-chart-legend">{SERIES.map(series => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}</div>
    <div className="patient-chart-canvas" ref={container} onMouseLeave={() => setActiveIndex(null)}>
      {!hasData ? <p className="activity-chart-empty">Nessun paziente con data di accesso nel periodo selezionato.</p> : <>
        <svg className="activity-trend" viewBox={`0 0 ${width} 300`} role="group" aria-labelledby="patient-trend-title patient-trend-description">
          <title id="patient-trend-title">Andamento dei pazienti: totale, dimessi, trasferiti e deceduti</title>
          <desc id="patient-trend-description">Quattro linee per data di accesso e stato attuale. Seleziona un periodo per leggere i valori oppure apri la tabella sotto il grafico.</desc>
          <defs><linearGradient id="patient-total-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f7df3" stopOpacity=".16" /><stop offset="100%" stopColor="#4f7df3" stopOpacity="0" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map(step => <g key={step}><line x1={left} x2={right} y1={y(ceiling * step / 4)} y2={y(ceiling * step / 4)} className="activity-grid-line" /><text x={left - 10} y={y(ceiling * step / 4) + 4} textAnchor="end">{number(ceiling * step / 4)}</text></g>)}
          <path d={`${paths[0].path} L ${x(periods.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`} fill="url(#patient-total-fill)" />
          {paths.map(series => <path className="patient-trend-series" key={series.key} d={series.path} fill="none" stroke={series.color} strokeWidth={series.key === "total" ? 3.5 : 2.5} strokeDasharray={series.dash} strokeLinecap="round" strokeLinejoin="round" />)}
          {periods.length === 1 && SERIES.map(series => <circle key={series.key} cx={x(0)} cy={y(periods[0][series.key])} r="4" fill={series.color} />)}
          {active && <g><line x1={x(activeIndex)} x2={x(activeIndex)} y1="30" y2={baseline} stroke="currentColor" strokeDasharray="3 5" opacity=".25" />{SERIES.map(series => <circle key={series.key} cx={x(activeIndex)} cy={y(active[series.key])} r="4" fill={series.color} stroke="var(--bs-body-bg)" strokeWidth="2" />)}</g>}
          {labels.map((label, index) => <text key={label} x={x(index)} y="287" textAnchor="middle" className={width < 500 && index % 2 && index !== labels.length - 1 ? "patient-chart-label-hidden" : undefined}>{label}</text>)}
          {periods.map((period, index) => {
            const step = (right - left) / Math.max(1, periods.length - 1);
            const start = index === 0 ? left : x(index) - step / 2;
            const end = index === periods.length - 1 ? right : x(index) + step / 2;
            return <rect key={period.label} x={start} y="25" width={Math.max(1, end - start)} height="240" fill="transparent" tabIndex="0" role="button" aria-label={`${labels[index]}: ${SERIES.map(series => `${series.label} ${period[series.key]}`).join(", ")}`} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} onClick={() => setActiveIndex(index)} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setActiveIndex(index); } }} />;
          })}
        </svg>
        {active && <div className="patient-chart-tooltip" style={{ left: `${Math.min(100 - 190 / width * 100, Math.max(2, x(activeIndex) / width * 100 - 15))}%` }}><strong>{labels[activeIndex]}{year !== "all" ? ` ${year}` : ""}</strong>{SERIES.map(series => <span key={series.key}><i style={{ background: series.color }} />{series.label}<b>{number(active[series.key])}</b></span>)}</div>}
      </>}
    </div>
    <details className="activity-chart-data"><summary>Consulta i valori {year === "all" ? "annuali" : "mensili"}</summary><div className="table-responsive"><table className="table table-sm mb-0"><caption className="visually-hidden">Valori del grafico dei pazienti</caption><thead><tr><th scope="col">{year === "all" ? "Anno" : "Mese"}</th>{SERIES.map(series => <th scope="col" key={series.key}>{series.label}</th>)}</tr></thead><tbody>{periods.map((period, index) => <tr key={period.label}><th scope="row">{labels[index]}</th>{SERIES.map(series => <td key={series.key}>{number(period[series.key])}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
};

export const Reports = ({ patients = [], presidentId }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const years = activityReportYears({ patients, presidentId, currentYear });
  const report = useMemo(() => buildActivityReport({ patients, presidentId, year }), [patients, presidentId, year]);
  const previous = useMemo(() => buildActivityReport({ patients, presidentId, year: year === "all" ? "all" : Number(year) - 1 }), [patients, presidentId, year]);
  const kpis = [["Totale pazienti", "total"], ["Pazienti dimessi", "discharged"], ["Pazienti deceduti", "deceased"], ["Pazienti trasferiti", "transferred"]];

  return <>
    <div className="app-content-header"><div className="container-fluid patient-report-header"><div><h1 className="mb-1">Report</h1><p className="text-secondary mb-0">Pazienti del CAS: numeri, stati e andamento nel tempo.</p></div><div className="activity-year-filter"><label htmlFor="activity-report-year">Anno di accesso</label><select className="form-select" id="activity-report-year" value={year} onChange={event => setYear(event.target.value)}><option value="all">Tutti gli anni</option>{years.map(value => <option key={value}>{value}</option>)}</select></div></div></div>
    <div className="app-content"><div className="container-fluid activity-reports">
      <div className="patient-report-kpis">{kpis.map(([label, key]) => <article key={key}><span>{label}</span><strong>{number(report.totals[key])}</strong>{year !== "all" && <small className="text-secondary">Accessi {Number(year) - 1}: {number(previous.totals[key])}</small>}</article>)}</div>
      <PatientTrendChart periods={report.periods} year={year} />
      <p className="activity-report-note mt-3">Il totale comprende tutti i pazienti registrati nel periodo, inclusi quelli in attesa. Il filtro e il grafico usano la data di accesso; dimessi, deceduti e trasferiti sono conteggiati secondo lo stato attuale, non la data dell’esito.</p>
      {report.undatedCount > 0 && <p className="activity-report-note">{number(report.undatedCount)} pazienti senza una data di accesso valida sono inclusi nei totali, ma non nel grafico temporale.</p>}
    </div></div>
  </>;
};
