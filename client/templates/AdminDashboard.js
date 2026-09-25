const formatAccessDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data non disponibile" : new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

// La dashboard amministrativa espone volutamente soltanto gli accessi reali:
// nessun dato sanitario o elenco completo degli account viene caricato qui.
export const AdminDashboard = ({ accessLogs = [], users = [] }) => {
  const casByPresidentId = new Map(users.map((user) => [user.id, user.casMembership]));
  const recentAccesses = accessLogs.filter((log) => log.userId && !log.action && log.createdAt);

  return <div className="app-content admin-dashboard">
    <header className="admin-dashboard-header">
      <div>
        <span className="admin-eyebrow">Amministrazione</span>
        <h1>Dashboard</h1>
        <p>Ultimi accessi al gestionale degli ultimi 3 giorni.</p>
      </div>
    </header>
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
