import { useState } from "react";
import { buildPeriodAccesses } from "/imports/utils/monthlyAccesses";
import { buildCasActivity } from "/imports/utils/casActivity";

const formatAccessDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data non disponibile" : new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

// L'attività dei CAS deriva soltanto dagli accessi reali dei loro utenti.
export const AdminDashboard = ({ accessLogs = [], users = [] }) => {
  const [period, setPeriod] = useState("year");
  const [activityDays, setActivityDays] = useState(30);
  const casByPresidentId = new Map(users.map((user) => [user.id, user.casMembership]));
  const now = new Date();
  const casActivity = buildCasActivity(users, accessLogs, activityDays, now);
  const recentAccesses = accessLogs.filter((log) => log.userId && !log.action && new Date(log.createdAt).getTime() >= now.getTime() - 3 * 24 * 60 * 60 * 1000);
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
        <p>Andamento degli accessi al gestionale e ultimi accessi degli ultimi 3 giorni.</p>
      </div>
    </header>
    <section className="admin-dashboard-card mb-3">
      <div className="admin-card-heading">
        <div><h2>Attività dei CAS</h2><p>Un CAS è attivo se almeno un suo utente (Presidente, CAS o GVP) ha effettuato un accesso negli ultimi {activityDays} giorni.</p></div>
        <select className="form-select admin-chart-period-filter" aria-label="Periodo attività CAS" value={activityDays} onChange={(event) => setActivityDays(Number(event.target.value))}>
          <option value={7}>Ultimi 7 giorni</option>
          <option value={30}>Ultimi 30 giorni</option>
          <option value={90}>Ultimi 90 giorni</option>
        </select>
      </div>
      <p className="text-secondary small mt-2">CAS ordinati per numero di accessi negli ultimi {activityDays} giorni, dal più attivo al meno attivo. Il conteggio somma gli accessi di tutti gli utenti del CAS. Ultimo accesso disponibile nei log degli ultimi dodici mesi.</p>
      <div className="row g-3 mt-1">
        {[true, false].map((active) => {
          const cases = casActivity.filter((cas) => cas.active === active);
          return <div className="col-12 col-lg-6" key={String(active)}>
            <h3 className="h6">CAS {active ? "attivi" : "inattivi"} <span className={`badge ${active ? "text-bg-success" : "text-bg-secondary"}`}>{cases.length}</span></h3>
            {cases.length ? <div className="table-responsive"><table className="table align-middle mb-0">
              <thead><tr><th>CAS</th><th className="text-end">Accessi</th><th>Ultimo accesso</th></tr></thead>
              <tbody>{cases.map((cas) => <tr key={cas.id}>
                <td><strong>{cas.name}</strong><small className="d-block text-secondary">{cas.president}</small></td>
                <td className="text-end fw-bold">{cas.accessCount}</td>
                <td>{cas.lastAccess ? formatAccessDate(cas.lastAccess) : "Nessun accesso nel periodo disponibile"}</td>
              </tr>)}</tbody>
            </table></div> : <p className="admin-empty">Nessun CAS {active ? "attivo" : "inattivo"} nel periodo.</p>}
          </div>;
        })}
      </div>
    </section>
    <section className="admin-dashboard-card admin-access-chart">
      <div className="admin-card-heading">
        <div><h2>Accessi per {period === "year" ? "mese" : "giorno"}</h2><p>{periodLabel}, in corso. Totale: {totalAccesses} accessi registrati.</p></div>
        <select className="form-select admin-chart-period-filter" aria-label="Periodo del grafico accessi" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="year">Anno corrente</option>
          <option value="month">Mese corrente</option>
          <option value="week">Settimana corrente</option>
        </select>
      </div>
      <div className="admin-monthly-chart-scroll">
        <svg className={`admin-access-line-chart ${period === "month" ? "admin-access-line-chart-month" : ""}`} viewBox={`0 0 ${chartWidth} 310`} role="img" aria-label={`Grafico a linea degli accessi: ${periodLabel}`}>
          <title>{periodLabel}: {totalAccesses} accessi registrati</title>
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
              <title>{point.label}: {point.count} accessi</title>
            </circle>
            <text x={point.x} y={point.y - 12} textAnchor="middle" className="admin-line-value">{point.count}</text>
            <text x={point.x} y="290" textAnchor="middle" className="admin-line-label">{point.label}</text>
          </g>)}
        </svg>
      </div>
      {!totalAccesses && <p className="admin-empty">Nessun accesso registrato nel periodo.</p>}
    </section>
    <section className="admin-dashboard-card">
      <div className="admin-card-heading">
        <div><h2>Ultimi accessi</h2><p>Utente, CAS di appartenenza e data/ora di accesso.</p></div>
      </div>
      {recentAccesses.length ? <div className="table-responsive mt-3">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Utente</th><th>Ruolo</th><th>CAS di appartenenza</th><th>Accesso</th></tr></thead>
          <tbody>{recentAccesses.map((access) => <tr key={access.id}>
            <td>{access.username || "Utente"}</td><td>{access.role || "Utente"}</td><td>{access.casMembership || casByPresidentId.get(access.presidentId) || "CAS non specificato"}</td><td>{formatAccessDate(access.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="admin-empty">Nessun accesso utente registrato negli ultimi 3 giorni.</p>}
    </section>
  </div>;
};
