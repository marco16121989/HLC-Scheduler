import { useMemo, useState } from "react";

const pad = (value) => String(value).padStart(2, "0");
const dayKey = (value) => { const d = new Date(value); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (value) => { const d = new Date(value); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const validDate = (value) => value && !Number.isNaN(new Date(value).getTime());
const number = new Intl.NumberFormat("it-IT");
const ROLE_COLORS = { Admin: "#343a40", Presidente: "#0d6efd", CAS: "#198754", GVP: "#fd7e14", Utente: "#6c757d" };

const StatCard = ({ label, value, note, tone, suffix = "" }) => <article className={`admin-stat-card admin-stat-${tone}`}><span>{label}</span><strong>{number.format(value)}{suffix}</strong><small>{note}</small></article>;

const Donut = ({ values }) => {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = values.map((item) => { const start = cursor; cursor += total ? item.value / total * 100 : 0; return `${ROLE_COLORS[item.label] || "#adb5bd"} ${start}% ${cursor}%`; });
  return <div className="admin-donut-wrap"><div className="admin-donut" style={{ background: total ? `conic-gradient(${stops.join(",")})` : "#e9ecef" }}><span><strong>{number.format(total)}</strong><small>accessi</small></span></div><div className="admin-chart-legend">{values.map((item) => <div key={item.label}><i style={{ backgroundColor: ROLE_COLORS[item.label] }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>;
};

const linkedPresidentId = (log, userById) => {
  if (log.presidentId) return log.presidentId;
  const account = userById.get(log.userId);
  if (!account) return "";
  return account.role === "Presidente" ? account.id : account.presidentId || account.associationId || "";
};

export const AdminDashboard = ({ accessLogs = [], users = [] }) => {
  const [presidentFilter, setPresidentFilter] = useState("all");
  const [dashboardPeriod, setDashboardPeriod] = useState("month");
  const presidents = useMemo(() => users.filter((item) => item.role === "Presidente").sort((a, b) => (a.firstName || a.username || "").localeCompare(b.firstName || b.username || "")), [users]);
  const userById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const filteredLogs = useMemo(() => {
    const nonAdminLogs = accessLogs.filter((log) => log.role !== "Admin" && !log.assistanceAccess && !String(log.action || "").startsWith("impersonation-"));
    return presidentFilter === "all"
      ? nonAdminLogs
      : nonAdminLogs.filter((log) => linkedPresidentId(log, userById) === presidentFilter);
  }, [accessLogs, presidentFilter, userById]);
  const scopedUsers = useMemo(() => presidentFilter === "all" ? users.filter((item) => item.role !== "Admin") : users.filter((item) => (item.role === "Presidente" ? item.id : item.presidentId || item.associationId) === presidentFilter), [users, presidentFilter]);

  const report = useMemo(() => {
    const now = new Date();
    const periodStart = dashboardPeriod === "year"
      ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const periodLogs = filteredLogs.filter((item) => validDate(item.createdAt) && new Date(item.createdAt) >= periodStart);
    const days = Array.from({ length: 30 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - index)); const key = dayKey(date); return { key, label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`, value: filteredLogs.filter((item) => validDate(item.createdAt) && dayKey(item.createdAt) === key).length }; });
    const months = Array.from({ length: 12 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1); const key = monthKey(date); return { key, label: date.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }).replace(" ", " ’"), value: filteredLogs.filter((item) => validDate(item.createdAt) && monthKey(item.createdAt) === key).length }; });
    const roles = Object.keys(ROLE_COLORS).map((label) => ({ label, value: periodLogs.filter((item) => (item.role || "Utente") === label).length })).filter((item) => item.value);
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, value: periodLogs.filter((item) => new Date(item.createdAt).getHours() === hour).length }));
    return { periodLogs, days, months, roles, hours, uniquePeriod: new Set(periodLogs.map((item) => item.userId)).size };
  }, [filteredLogs, dashboardPeriod]);

  const accessChartData = dashboardPeriod === "year" ? report.months : report.days;
  const averageAccesses = Math.round(report.periodLogs.length / (dashboardPeriod === "year" ? 12 : 30));
  const maxDay = Math.max(1, ...accessChartData.map((item) => item.value)); const maxHour = Math.max(1, ...report.hours.map((item) => item.value));
  const enabledUsers = scopedUsers.filter((item) => !item.disabled).length;
  const selectedPresident = presidents.find((item) => item.id === presidentFilter);

  return <div className="app-content admin-dashboard">
    <header className="admin-dashboard-header"><div><span className="admin-eyebrow">Amministrazione</span><h1>Dashboard utilizzo gestionale</h1><p>Accessi e attività degli utenti del software.</p></div><div className="admin-dashboard-filters"><label className="admin-president-filter"><span>CAS di appartenenza</span><select className="form-select" value={presidentFilter} onChange={(event) => setPresidentFilter(event.target.value)}><option value="all">Tutti i CAS</option>{presidents.map((item) => <option key={item.id} value={item.id}>{item.casMembership || "CAS non specificato"}</option>)}</select></label><label className="admin-president-filter"><span>Periodo</span><select className="form-select" value={dashboardPeriod} onChange={(event) => setDashboardPeriod(event.target.value)}><option value="month">Ultimo mese</option><option value="year">Ultimo anno</option></select></label></div></header>
    <div className="admin-filter-summary">Dati visualizzati: <strong>{selectedPresident ? selectedPresident.casMembership || "CAS non specificato" : "tutti i CAS"}</strong></div>
    <div className="admin-stat-grid"><StatCard label={`Accessi nell’ultimo ${dashboardPeriod === "year" ? "anno" : "mese"}`} value={report.periodLogs.length} note="sessioni nel periodo selezionato" tone="blue" /><StatCard label={`Utenti attivi nell’ultimo ${dashboardPeriod === "year" ? "anno" : "mese"}`} value={report.uniquePeriod} note={`su ${enabledUsers} utenti abilitati`} tone="violet" /><StatCard label={dashboardPeriod === "year" ? "Media mensile" : "Media giornaliera"} value={averageAccesses} note="accessi medi nel periodo" tone="green" /><StatCard label="Tasso di utilizzo" value={enabledUsers ? Math.round(report.uniquePeriod / enabledUsers * 100) : 0} suffix="%" note="utenti attivi nel periodo" tone="orange" /></div>
    <section className="admin-dashboard-card admin-access-chart"><div className="admin-card-heading"><div><h2>Accessi {dashboardPeriod === "year" ? "nell’ultimo anno" : "nell’ultimo mese"}</h2><p>{dashboardPeriod === "year" ? "Numero di sessioni mensili" : "Numero di sessioni giornaliere"}</p></div></div><div className={`admin-bars ${dashboardPeriod === "year" ? "admin-bars-year" : ""}`}>{accessChartData.map((item, index) => <div className="admin-bar-column" key={item.key} title={`${item.label}: ${item.value} accessi`}><strong>{item.value || ""}</strong><div style={{ height: `${Math.max(item.value ? 8 : 2, item.value / maxDay * 100)}%` }} /><small>{dashboardPeriod === "year" || index % 5 === 0 || index === 29 ? item.label : ""}</small></div>)}</div></section>
    <div className="admin-dashboard-two-columns"><section className="admin-dashboard-card"><h2>Accessi per ruolo nel periodo</h2><Donut values={report.roles} /></section><section className="admin-dashboard-card"><h2>Fasce orarie di utilizzo</h2><div className="admin-hour-chart">{report.hours.map((item) => <div key={item.hour} title={`${pad(item.hour)}:00 — ${item.value} accessi`}><span style={{ height: `${Math.max(2, item.value / maxHour * 100)}%` }} /><small>{item.hour % 3 === 0 ? pad(item.hour) : ""}</small></div>)}</div></section></div>
    <div className="admin-dashboard-two-columns admin-bottom-grid"><section className="admin-dashboard-card"><h2>Utenti dell’organizzazione</h2><div className="admin-resource-list"><div><span>Utenti abilitati</span><strong>{enabledUsers}</strong></div><div><span>Utenti disabilitati</span><strong>{scopedUsers.length - enabledUsers}</strong></div><div><span>Attivi nel periodo</span><strong>{report.uniquePeriod}</strong></div><div><span>Accessi nel periodo</span><strong>{report.periodLogs.length}</strong></div></div></section><section className="admin-dashboard-card"><h2>Accessi recenti</h2><div className="admin-recent-accesses">{report.periodLogs.slice(0, 7).map((item) => <div key={item.id}><span><strong>{item.username}</strong><small>{item.role}</small></span><time>{new Date(item.createdAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></div>)}{!report.periodLogs.length && <p className="admin-empty">Nessun accesso registrato per il filtro selezionato.</p>}</div></section></div>
  </div>;
};
