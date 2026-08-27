import { useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";

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
  const [assistanceModalOpen, setAssistanceModalOpen] = useState(false);
  const [assistancePresidentId, setAssistancePresidentId] = useState("");
  const [assistanceRole, setAssistanceRole] = useState("Presidente");
  const [assistanceUserId, setAssistanceUserId] = useState("");
  const [startingAssistance, setStartingAssistance] = useState(false);
  const presidents = useMemo(() => users.filter((item) => item.role === "Presidente").sort((a, b) => (a.firstName || a.username || "").localeCompare(b.firstName || b.username || "")), [users]);
  const userById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const filteredLogs = useMemo(() => {
    const nonAdminLogs = accessLogs.filter((log) => log.role !== "Admin");
    return presidentFilter === "all"
      ? nonAdminLogs
      : nonAdminLogs.filter((log) => linkedPresidentId(log, userById) === presidentFilter);
  }, [accessLogs, presidentFilter, userById]);
  const scopedUsers = useMemo(() => presidentFilter === "all" ? users.filter((item) => item.role !== "Admin") : users.filter((item) => (item.role === "Presidente" ? item.id : item.presidentId || item.associationId) === presidentFilter), [users, presidentFilter]);

  const report = useMemo(() => {
    const now = new Date(); const today = dayKey(now); const currentMonth = monthKey(now);
    const todayLogs = filteredLogs.filter((item) => validDate(item.createdAt) && dayKey(item.createdAt) === today);
    const monthLogs = filteredLogs.filter((item) => validDate(item.createdAt) && monthKey(item.createdAt) === currentMonth);
    const days = Array.from({ length: 30 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - index)); const key = dayKey(date); return { key, label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`, value: filteredLogs.filter((item) => validDate(item.createdAt) && dayKey(item.createdAt) === key).length }; });
    const roles = Object.keys(ROLE_COLORS).map((label) => ({ label, value: monthLogs.filter((item) => (item.role || "Utente") === label).length })).filter((item) => item.value);
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, value: monthLogs.filter((item) => new Date(item.createdAt).getHours() === hour).length }));
    return { todayLogs, monthLogs, days, roles, hours, uniqueMonth: new Set(monthLogs.map((item) => item.userId)).size, activeToday: new Set(todayLogs.map((item) => item.userId)).size };
  }, [filteredLogs]);

  const maxDay = Math.max(1, ...report.days.map((item) => item.value)); const maxHour = Math.max(1, ...report.hours.map((item) => item.value));
  const enabledUsers = scopedUsers.filter((item) => !item.disabled).length;
  const selectedPresident = presidents.find((item) => item.id === presidentFilter);
  const assistanceOrganizationUsers = users.filter((item) => {
    if (!assistancePresidentId || item.disabled || item.role === "Admin") return false;
    if (item.role === "Presidente") return item.id === assistancePresidentId;
    if (item.presidentId === assistancePresidentId || item.associationId === assistancePresidentId) return true;
    const linkedCasIds = [...new Set([...(item.casIds || []), item.casId, item.associationId].filter(Boolean))];
    return linkedCasIds.some((casId) => {
      const cas = userById.get(casId);
      return cas?.role === "CAS" && (cas.presidentId === assistancePresidentId || cas.associationId === assistancePresidentId);
    });
  });
  const assistanceUsers = assistanceOrganizationUsers.filter((item) => item.role === assistanceRole).sort((a, b) => (a.username || "").localeCompare(b.username || "", "it-IT"));
  const openAssistanceModal = () => {
    setAssistancePresidentId("");
    setAssistanceRole("Presidente");
    setAssistanceUserId("");
    setAssistanceModalOpen(true);
  };
  const closeAssistanceModal = () => {
    if (startingAssistance) return;
    setAssistanceModalOpen(false);
  };
  const startAssistance = () => {
    if (!assistanceUserId || startingAssistance) return;
    setStartingAssistance(true);
    Meteor.call("hlc.startImpersonation", assistanceUserId, (error, result) => {
      if (error) {
        setStartingAssistance(false);
        globalThis.alert(error.reason || "Impossibile avviare la modalità assistenza.");
        return;
      }
      Accounts.callLoginMethod({
        methodArguments: [{ hlcImpersonationToken: result?.impersonationToken }],
        userCallback: (loginError) => {
          setStartingAssistance(false);
          if (loginError) {
            globalThis.alert(loginError.reason || "Impossibile avviare la modalità assistenza.");
            return;
          }
          globalThis.sessionStorage?.setItem("hlc-impersonation", JSON.stringify({ targetUsername: result?.targetUsername || "Utente" }));
          globalThis.dispatchEvent(new CustomEvent("hlc-impersonation-changed"));
        },
      });
    });
  };

  return <div className="app-content admin-dashboard">
    <header className="admin-dashboard-header"><div><span className="admin-eyebrow">Amministrazione</span><h1>Dashboard utilizzo gestionale</h1><p>Accessi e attività degli utenti del software.</p></div><label className="admin-president-filter"><span>CAS di appartenenza</span><select className="form-select" value={presidentFilter} onChange={(event) => setPresidentFilter(event.target.value)}><option value="all">Tutti i CAS</option>{presidents.map((item) => <option key={item.id} value={item.id}>{item.casMembership || "CAS non specificato"}</option>)}</select></label></header>
    <div className="admin-filter-summary">Dati visualizzati: <strong>{selectedPresident ? selectedPresident.casMembership || "CAS non specificato" : "tutti i CAS"}</strong></div>
    <div className="admin-stat-grid"><StatCard label="Accessi oggi" value={report.todayLogs.length} note={`${report.activeToday} utenti distinti`} tone="blue" /><StatCard label="Accessi del mese" value={report.monthLogs.length} note="sessioni nel mese corrente" tone="violet" /><StatCard label="Utenti attivi nel mese" value={report.uniqueMonth} note={`su ${enabledUsers} utenti abilitati`} tone="green" /><StatCard label="Tasso di utilizzo" value={enabledUsers ? Math.round(report.uniqueMonth / enabledUsers * 100) : 0} suffix="%" note="utenti attivi nel mese" tone="orange" /></div>
    <section className="admin-dashboard-card admin-assistance-card"><div><span className="admin-eyebrow">Modalità assistenza</span><h2>Accedi come un utente</h2><p>Controlla ciò che vede l’utente e aiutalo senza conoscere o modificare la sua password. Ogni accesso viene registrato.</p></div><button className="btn btn-primary" type="button" onClick={openAssistanceModal}>Apri accesso assistenza</button></section>
    {assistanceModalOpen && <><button className="entity-modal-backdrop" type="button" aria-label="Chiudi modalità assistenza" onClick={closeAssistanceModal} /><div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="assistance-modal-title"><section className="card entity-modal-card admin-assistance-modal"><div className="card-header d-flex align-items-center"><div><span className="admin-eyebrow">Modalità assistenza</span><h2 className="card-title mb-0" id="assistance-modal-title">{assistancePresidentId ? "Scegli l’utente" : "Scegli il CAS"}</h2></div><button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeAssistanceModal} /></div><div className="card-body">{!assistancePresidentId ? <div className="d-grid gap-2">{presidents.filter((item) => !item.disabled).map((president) => <button className="btn btn-outline-primary text-start p-3" type="button" key={president.id} onClick={() => { setAssistancePresidentId(president.id); setAssistanceRole("Presidente"); setAssistanceUserId(president.id); }}><strong className="d-block">{president.casMembership || "CAS non specificato"}</strong><small className="text-secondary">Presidente: {president.username}</small></button>)}</div> : <><div className="nav nav-tabs mb-3" role="tablist" aria-label="Ruolo utente da assistere">{["Presidente","CAS","GVP"].map((role) => <button className={`nav-link ${assistanceRole === role ? "active" : ""}`} type="button" role="tab" key={role} aria-selected={assistanceRole === role} onClick={() => { setAssistanceRole(role); const firstUser = assistanceOrganizationUsers.find((item) => item.role === role); setAssistanceUserId(firstUser?.id || ""); }}>{role}</button>)}</div><label className="form-label" htmlFor="assistance-user">Utente</label><select className="form-select" id="assistance-user" value={assistanceUserId} onChange={(event) => setAssistanceUserId(event.target.value)}><option value="">Seleziona un utente</option>{assistanceUsers.map((item) => <option key={item.id} value={item.id}>{item.username}</option>)}</select>{assistanceUsers.length === 0 && <p className="text-secondary mt-3 mb-0">Nessun utente disponibile per questo ruolo.</p>}</>}</div><div className="card-footer d-flex justify-content-between gap-2">{assistancePresidentId ? <button className="btn btn-outline-secondary" type="button" onClick={() => { setAssistancePresidentId(""); setAssistanceUserId(""); }}>Indietro</button> : <span />}<div className="d-flex gap-2"><button className="btn btn-outline-secondary" type="button" onClick={closeAssistanceModal}>Annulla</button>{assistancePresidentId && <button className="btn btn-primary" type="button" disabled={!assistanceUserId || startingAssistance} onClick={startAssistance}>{startingAssistance ? "Accesso…" : "Accedi come utente"}</button>}</div></div></section></div></>}
    <section className="admin-dashboard-card admin-access-chart"><div className="admin-card-heading"><div><h2>Accessi negli ultimi 30 giorni</h2><p>Numero di sessioni giornaliere</p></div></div><div className="admin-bars">{report.days.map((item, index) => <div className="admin-bar-column" key={item.key} title={`${item.label}: ${item.value} accessi`}><strong>{item.value || ""}</strong><div style={{ height: `${Math.max(item.value ? 8 : 2, item.value / maxDay * 100)}%` }} /><small>{index % 5 === 0 || index === 29 ? item.label : ""}</small></div>)}</div></section>
    <div className="admin-dashboard-two-columns"><section className="admin-dashboard-card"><h2>Accessi del mese per ruolo</h2><Donut values={report.roles} /></section><section className="admin-dashboard-card"><h2>Fasce orarie di utilizzo</h2><div className="admin-hour-chart">{report.hours.map((item) => <div key={item.hour} title={`${pad(item.hour)}:00 — ${item.value} accessi`}><span style={{ height: `${Math.max(2, item.value / maxHour * 100)}%` }} /><small>{item.hour % 3 === 0 ? pad(item.hour) : ""}</small></div>)}</div></section></div>
    <div className="admin-dashboard-two-columns admin-bottom-grid"><section className="admin-dashboard-card"><h2>Utenti dell’organizzazione</h2><div className="admin-resource-list"><div><span>Utenti abilitati</span><strong>{enabledUsers}</strong></div><div><span>Utenti disabilitati</span><strong>{scopedUsers.length - enabledUsers}</strong></div><div><span>Attivi oggi</span><strong>{report.activeToday}</strong></div><div><span>Attivi nel mese</span><strong>{report.uniqueMonth}</strong></div></div></section><section className="admin-dashboard-card"><h2>Accessi recenti</h2><div className="admin-recent-accesses">{filteredLogs.slice(0, 7).map((item) => <div key={item.id}><span><strong>{item.username}</strong><small>{item.role}</small></span><time>{new Date(item.createdAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></div>)}{!filteredLogs.length && <p className="admin-empty">Nessun accesso registrato per il filtro selezionato.</p>}</div></section></div>
  </div>;
};
