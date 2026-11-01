import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { buildPeriodAccesses, filterPeriodAccesses } from "/imports/utils/monthlyAccesses";
import { buildCasActivity } from "/imports/utils/casActivity";
import { sortAdminCasRows } from "/imports/utils/adminCasCounts";
import { DatabaseStorageCard } from "./DatabaseStorageCard.js";

const formatAccessDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data non disponibile" : new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(date);
};

const SortableCasHeader = ({ field, label, order, onChange }) => {
  const active = order.startsWith(`${field}-`);
  const ascending = active && order.endsWith("-asc");
  const nextOrder = ascending ? `${field}-desc` : `${field}-asc`;
  return <th scope="col" className={field === "count" ? "text-end" : undefined} aria-sort={active ? ascending ? "ascending" : "descending" : "none"}>
    <button className="admin-column-sort" type="button" onClick={() => onChange(nextOrder)}
      aria-label={`Ordina ${label}: ${ascending ? "decrescente" : "crescente"}`}>
      <span>{label}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6 8 2 12 6" opacity={active && ascending ? 1 : 0.3} />
        <path d="m4 10 4 4 4-4" opacity={active && !ascending ? 1 : 0.3} />
      </svg>
    </button>
  </th>;
};

// L'attività dei CAS deriva soltanto dagli accessi reali dei loro utenti.
const CasActivityContent = ({ activityDays, onPeriodChange, casActivity, expanded = false }) => {
  const [sortOrder, setSortOrder] = useState("count-desc");
  return <>

      <div className="admin-card-heading flex-wrap">
        <div><p>Riepilogo degli ultimi {activityDays} giorni. Apri un gruppo per vedere i CAS.</p></div>
        <select className="form-select admin-chart-period-filter" aria-label="Periodo attività CAS" value={activityDays} onChange={(event) => onPeriodChange(Number(event.target.value))}>
          <option value={7}>Ultimi 7 giorni</option>
          <option value={30}>Ultimi 30 giorni</option>
          <option value={90}>Ultimi 90 giorni</option>
        </select>
      </div>
      <div className={expanded ? "admin-cas-tables-scroll" : undefined}>
      <div className={expanded ? "admin-cas-groups admin-cas-groups-modal" : "admin-cas-groups"}>
        {[true, false].map((active) => {
          const cases = sortAdminCasRows(casActivity.filter((cas) => cas.active === active), sortOrder, "accessCount");
          return <details className="admin-cas-group" key={String(active)} open={expanded || undefined}>
            <summary className="admin-collapse-summary"><span>CAS {active ? "attivi" : "inattivi"}</span><span className={`badge ${active ? "text-bg-success" : "text-bg-secondary"}`}>{cases.length}</span><span className="admin-collapse-arrow" aria-hidden="true">&#8250;</span></summary>
            <div className="admin-collapse-body">
            <div className="table-responsive"><table className="table align-middle mb-0 admin-cas-table">
              <colgroup><col className="admin-cas-name-column" /><col className="admin-cas-count-column" /><col className="admin-cas-date-column" /></colgroup>
              <thead><tr>
                <SortableCasHeader field="name" label="CAS" order={sortOrder} onChange={setSortOrder} />
                <SortableCasHeader field="count" label="Accessi" order={sortOrder} onChange={setSortOrder} />
                <th scope="col">Ultimo accesso</th>
              </tr></thead>
              <tbody>{cases.length ? cases.map((cas) => <tr key={cas.id}>
                <td><strong>{cas.name}</strong><small className="d-block text-secondary">{cas.president}</small></td>
                <td className="text-end fw-bold">{cas.accessCount}</td>
                <td>{cas.lastAccess ? formatAccessDate(cas.lastAccess) : "Nessun accesso nel periodo disponibile"}</td>
              </tr>) : <tr><td colSpan={3} className="text-secondary">Nessun CAS {active ? "attivo" : "inattivo"} nel periodo.</td></tr>}</tbody>
            </table></div>
            </div>
          </details>;
        })}
      </div>
      </div>

</>;
};

export const AdminDashboard = ({ accessLogs = [], users = [] }) => {
  const [period, setPeriod] = useState("year");
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [activityDays, setActivityDays] = useState(30);
  const [casModalOpen, setCasModalOpen] = useState(false);
  const [countsKind, setCountsKind] = useState(null);
  const [countsSortOrder, setCountsSortOrder] = useState("name-asc");
  const countsLabel = { patients: "Pazienti", users: "Utenti", doctors: "Medici" }[countsKind];
  const [entityCounts, setEntityCounts] = useState(null);
  const [entityCountsError, setEntityCountsError] = useState("");
  const [totals, setTotals] = useState(null);
  const [totalsError, setTotalsError] = useState("");
  useEffect(() => {
    if (!countsKind) return undefined;
    let active = true;
    setEntityCounts(null);
    setEntityCountsError("");
    Meteor.call("hlc.getAdminCountsByCas", countsKind, (error, result) => {
      if (!active) return;
      if (error) setEntityCountsError(error.reason || "Impossibile caricare i conteggi per CAS.");
      else setEntityCounts(result);
    });
    return () => { active = false; };
  }, [countsKind]);
  useEffect(() => {
    let active = true;
    Meteor.call("hlc.getAdminDashboardTotals", (error, result) => {
      if (!active) return;
      if (error) setTotalsError(error.reason || "Impossibile caricare i totali.");
      else setTotals(result);
    });
    return () => { active = false; };
  }, []);
  const casByPresidentId = new Map(users.map((user) => [user.id, user.casMembership]));
  const now = new Date();
  const casActivity = buildCasActivity(users, accessLogs, activityDays, now);
  const todayAccesses = filterPeriodAccesses(accessLogs, "day", now);
  const monthlyAccesses = buildPeriodAccesses(accessLogs, period, now);
  const periodLabel = period === "year" ? "Anno corrente" : period === "month" ? "Mese corrente" : "Settimana corrente (lunedì–domenica)";
  const maxAccesses = Math.max(1, ...monthlyAccesses.map((month) => month.count));
  const totalAccesses = monthlyAccesses.reduce((total, month) => total + month.count, 0);
  const chartWidth = period === "month" ? 1240 : 840;
  const chartTop = 35;
  const chartBottom = 260;
  const chartMax = Math.max(4, Math.ceil(maxAccesses / 4) * 4);
  const points = monthlyAccesses.map((bucket, index) => ({
    ...bucket,
    x: 50 + index * (chartWidth - 80) / (monthlyAccesses.length - 1),
    y: chartBottom - bucket.count / chartMax * (chartBottom - chartTop),
  }));
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return <div className="app-content admin-dashboard">
    <header className="admin-dashboard-header">
      <div>
        <span className="admin-eyebrow">Amministrazione</span>
        <h1>Dashboard</h1>
        <p>Andamento degli accessi al gestionale e dettaglio degli accessi per periodo.</p>
      </div>
    </header>
    <section className="admin-dashboard-card admin-access-chart">
      <div className="admin-card-heading">
        <div><h2>{period === "year" ? "Accessi dell’anno" : period === "month" ? "Accessi del mese" : "Accessi della settimana"}</h2><p>{periodLabel}, in corso. Totale: {totalAccesses} accessi registrati.</p></div>
        <select className="form-select admin-chart-period-filter" aria-label="Periodo del grafico accessi" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="year">Anno corrente</option>
          <option value="month">Mese corrente</option>
          <option value="week">Settimana corrente</option>
        </select>
      </div>
      <div className="admin-monthly-chart-scroll">
        <svg className={`admin-access-line-chart ${period === "month" ? "admin-access-line-chart-month" : ""}`} viewBox={`0 0 ${chartWidth} 310`} role="img" aria-label={`Grafico a linea degli accessi: ${periodLabel}`}>
          <title>{`${periodLabel}: ${totalAccesses} accessi registrati`}</title>
          <desc>{points.map((point) => `${point.label}: ${point.count}`).join("; ")}</desc>
          {[0, 1, 2, 3, 4].map((index) => {
            const y = chartBottom - index / 4 * (chartBottom - chartTop);
            return <g key={index} className="admin-line-grid">
              <line x1="50" x2={chartWidth - 30} y1={y} y2={y} />
              <text x="38" y={y + 4} textAnchor="end">{chartMax * index / 4}</text>
            </g>;
          })}
          <polygon points={`50,${chartBottom} ${linePoints} ${chartWidth - 30},${chartBottom}`} className="admin-line-area" />
          <polyline points={linePoints} className="admin-access-line" />
          {points.map((point) => <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" className="admin-line-point" tabIndex="0" aria-label={`${point.label}: ${point.count} accessi`}>
              <title>{`${point.label}: ${point.count} accessi`}</title>
            </circle>
            <text x={point.x} y={point.y - 12} textAnchor="middle" className="admin-line-value">{point.count}</text>
            <text x={point.x} y="290" textAnchor="middle" className="admin-line-label">{point.label}</text>
          </g>)}
        </svg>
      </div>
      {!totalAccesses && <p className="admin-empty">Nessun accesso registrato nel periodo.</p>}
    </section>
    <section aria-label="Riepilogo del gestionale">
      <h2 className="h6 mb-3">Riepilogo del gestionale</h2>
      {totalsError && <p className="alert alert-danger" role="alert">{totalsError}</p>}
        <div className="admin-stat-grid" aria-busy={!totals && !totalsError}>
          {[
            ["patients", "Pazienti caricati", "blue"],
            ["users", "Utenti caricati", "violet"],
            ["doctors", "Medici caricati", "green"],
            ["cas", "CAS caricati", "orange"],
          ].map(([key, label, color]) => {
            return <button className={`admin-stat-card admin-stat-${color}`} key={key}
              type="button"
              onClick={key === "cas" ? () => setCasModalOpen(true) : () => setCountsKind(key)}
              aria-haspopup="dialog"
              aria-expanded={key === "cas" ? casModalOpen : countsKind === key}>
              <span>{label}</span>
              <strong>{totals ? new Intl.NumberFormat("it-IT").format(totals[key]) : totalsError ? "—" : "…"}</strong>
            </button>;
          })}
          <button className="admin-stat-card admin-stat-blue" type="button" aria-haspopup="dialog" aria-expanded={accessModalOpen}
            onClick={() => setAccessModalOpen(true)}>
            <span>Accessi di oggi</span>
            <strong>{new Intl.NumberFormat("it-IT").format(todayAccesses.length)}</strong>
          </button>
        </div>
    </section>
    <DatabaseStorageCard />
    {accessModalOpen && <>
      <button className="entity-modal-backdrop" type="button" aria-label="Chiudi accessi" onClick={() => setAccessModalOpen(false)} />
      <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="admin-access-list-title"
        onKeyDown={(event) => { if (event.key === "Escape") setAccessModalOpen(false); }}>
        <section className="card entity-modal-card">
          <div className="card-header d-flex align-items-center">
            <h2 className="card-title mb-0" id="admin-access-list-title">Ultimi accessi</h2>
            <button className="btn-close ms-auto" type="button" aria-label="Chiudi" autoFocus onClick={() => setAccessModalOpen(false)} />
          </div>
          <div className="card-body">
      <div className="admin-card-heading">
        <div><p>Accessi registrati oggi: utente, CAS di appartenenza e data/ora di accesso. Totale: {todayAccesses.length}.</p></div>
      </div>
      {todayAccesses.length ? <div className="table-responsive mt-3">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Utente</th><th>Ruolo</th><th>CAS di appartenenza</th><th>Accesso</th></tr></thead>
          <tbody>{todayAccesses.map((access) => <tr key={access.id}>
            <td>{access.username || "Utente"}</td><td>{access.role || "Utente"}</td><td>{access.casMembership || casByPresidentId.get(access.presidentId) || "CAS non specificato"}</td><td>{formatAccessDate(access.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="admin-empty">Nessun accesso utente registrato oggi.</p>}

          </div>
          <div className="card-footer d-flex justify-content-end">
            <button className="btn btn-secondary" type="button" onClick={() => setAccessModalOpen(false)}>Chiudi</button>
          </div>
        </section>
      </div>
    </>}

    {countsKind && <>
      <button className="entity-modal-backdrop" type="button" aria-label={`Chiudi ${countsLabel?.toLowerCase()} per CAS`} onClick={() => setCountsKind(null)} />
      <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="admin-entity-counts-title"
        onKeyDown={(event) => { if (event.key === "Escape") setCountsKind(null); }}>
        <section className="card entity-modal-card">
          <div className="card-header d-flex align-items-center">
            <h2 className="card-title mb-0" id="admin-entity-counts-title">{countsLabel} per CAS</h2>
            <button className="btn-close ms-auto" type="button" aria-label="Chiudi" autoFocus onClick={() => setCountsKind(null)} />
          </div>
          <div className="card-body">
            {entityCountsError ? <p className="alert alert-danger" role="alert">{entityCountsError}</p> : entityCounts === null ?
              <p role="status">Caricamento dei conteggi…</p> : <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead><tr>
                    <SortableCasHeader field="name" label="CAS" order={countsSortOrder} onChange={setCountsSortOrder} />
                    <SortableCasHeader field="count" label={countsLabel} order={countsSortOrder} onChange={setCountsSortOrder} />
                  </tr></thead>
                  <tbody>{entityCounts.length ? sortAdminCasRows(entityCounts, countsSortOrder).map((row) => <tr key={row.id}>
                    <td>{row.name}</td><td className="text-end fw-bold">{new Intl.NumberFormat("it-IT").format(row.count)}</td>
                  </tr>) : <tr><td colSpan={2} className="text-secondary">Nessun CAS presente.</td></tr>}</tbody>
                </table>
              </div>}
          </div>
          <div className="card-footer d-flex justify-content-end">
            <button className="btn btn-secondary" type="button" onClick={() => setCountsKind(null)}>Chiudi</button>
          </div>
        </section>
      </div>
    </>}
    {casModalOpen && <>
      <button className="entity-modal-backdrop" type="button" aria-label="Chiudi attività dei CAS" onClick={() => setCasModalOpen(false)} />
      <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="admin-cas-activity-title"
        onKeyDown={(event) => { if (event.key === "Escape") setCasModalOpen(false); }}>
        <section className="card entity-modal-card">
          <div className="card-header d-flex align-items-center">
            <h2 className="card-title mb-0" id="admin-cas-activity-title">Attività dei CAS</h2>
            <button className="btn-close ms-auto" type="button" aria-label="Chiudi" autoFocus onClick={() => setCasModalOpen(false)} />
          </div>
          <div className="card-body">
            <CasActivityContent activityDays={activityDays} onPeriodChange={setActivityDays} casActivity={casActivity} expanded />
          </div>
          <div className="card-footer d-flex justify-content-end">
            <button className="btn btn-secondary" type="button" onClick={() => setCasModalOpen(false)}>Chiudi</button>
          </div>
        </section>
      </div>
    </>}
  </div>;
};
