import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { formatStorageBytes } from "../../imports/utils/databaseStorage.js";

export const DatabaseStorageCard = () => {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Meteor.call("hlc.getAdminDatabaseStorage", (methodError, result) => {
      if (!active) return;
      setLoading(false);
      if (methodError) {
        setUsage(null);
        setError(methodError.reason || "Impossibile leggere lo spazio del database.");
      } else setUsage(result);
    });
    return () => { active = false; };
  }, [refreshKey]);
  const percentage = usage ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(usage.percentage) : "";
  return <section className="admin-dashboard-card" aria-labelledby="database-storage-title" aria-busy={loading}>
    <div className="admin-card-heading">
      <div><h2 id="database-storage-title">Spazio del database</h2><p>Occupazione del database del gestionale su MongoDB Atlas.</p></div>
      <button className="btn btn-outline-primary btn-sm" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>
        {loading ? "Aggiornamento…" : "Aggiorna"}
      </button>
    </div>
    {error && <p className="alert alert-warning mt-3 mb-0" role="alert">{error}</p>}
    {!usage && loading && <p className="text-secondary mt-3 mb-0" role="status">Lettura dello spazio occupato…</p>}
    {usage && <>
      <dl className="row g-3 mt-1 mb-3">
        <div className="col-12 col-md-4"><dt>Spazio allocato, indici inclusi</dt><dd className="h5 mb-0">{formatStorageBytes(usage.usedBytes)}</dd></div>
        <div className="col-12 col-md-4"><dt>Residuo stimato</dt><dd className="h5 mb-0">{formatStorageBytes(usage.remainingBytes)}</dd></div>
        <div className="col-12 col-md-4"><dt>Capacità di riferimento</dt><dd className="h5 mb-0">{formatStorageBytes(usage.capacityBytes)}</dd></div>
      </dl>
      <div className="progress" role="progressbar" aria-label="Percentuale di spazio allocato" aria-valuenow={Math.min(100, usage.percentage)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${percentage}% della capacità di riferimento`}>
        <div className={`progress-bar ${usage.percentage >= 95 ? "bg-danger" : usage.percentage >= 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, usage.percentage)}%` }} />
      </div>
      <p className="small text-secondary mt-2 mb-0">{percentage}% allocato. Aggiornato: {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(usage.checkedAt))}.</p>
      <details className="mt-3">
        <summary>Dettagli dello spazio</summary>
        <dl className="row mt-2 mb-0">
          <dt className="col-8">Dati non compressi</dt><dd className="col-4 text-end">{formatStorageBytes(usage.dataBytes)}</dd>
          <dt className="col-8">Spazio allocato ai dati</dt><dd className="col-4 text-end">{formatStorageBytes(usage.storageBytes)}</dd>
          <dt className="col-8">Indici</dt><dd className="col-4 text-end">{formatStorageBytes(usage.indexBytes)}</dd>
          <dt className="col-8">Totale logico: dati e indici</dt><dd className="col-4 text-end">{formatStorageBytes(usage.logicalBytes)}</dd>
        </dl>
      </details>
      <p className="small text-secondary mt-3 mb-0">Il residuo è stimato sul solo database del gestionale rispetto alla capacità di riferimento indicata. Non include gli altri consumi del cluster. Il piano Atlas può applicare un criterio di conteggio diverso.</p>
    </>}
  </section>;
};
