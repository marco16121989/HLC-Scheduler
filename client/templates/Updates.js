import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { SoftwareUpdatesCollection } from "../../imports/api/links.js";
import { SOFTWARE_VERSION } from "../../imports/constants/softwareVersion.js";
import { confirmAction } from "./ConfirmDialog.js";

const formatDate = (date) => new Intl.DateTimeFormat("it-IT", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(`${date}T00:00:00Z`));

export const Updates = ({ currentUser }) => {
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [summary, setSummary] = useState("");
  const [changesText, setChangesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const { ready, updates } = useTracker(() => {
    const subscription = Meteor.subscribe("hlc-software-updates");
    return {
      ready: subscription.ready(),
      updates: SoftwareUpdatesCollection.find({}, { sort: { releaseNumber: -1, date: -1, version: -1 } }).fetch(),
    };
  }, []);
  const editUpdate = (update) => {
    if (currentUser?.role !== "Admin" || saving || deletingId || approvingId) return;
    setError("");
    setEditingId(update._id);
    setSummary(update.summary);
    setChangesText(update.changes.join("\n"));
  };
  const saveUpdate = (event) => {
    event.preventDefault();
    if (currentUser?.role !== "Admin" || !editingId || saving) return;
    setError("");
    const changes = changesText.split(/\r?\n/).map((change) => change.trim()).filter(Boolean);
    if (!summary.trim() || !changes.length) {
      setError("Inserisci un titolo e almeno un punto di riepilogo.");
      return;
    }
    setSaving(true);
    Meteor.call("hlc.editSoftwareUpdate", editingId, { summary, changes }, (methodError) => {
      setSaving(false);
      if (methodError) {
        setError(methodError.reason || "Impossibile salvare l’aggiornamento.");
        return;
      }
      setEditingId(null);
    });
  };
  const approveUpdate = (update) => {
    if (currentUser?.role !== "Admin" || approvingId || deletingId || saving || editingId) return;
    setError("");
    setApprovingId(update._id);
    Meteor.call("hlc.approveSoftwareUpdate", update._id, (methodError) => {
      setApprovingId(null);
      if (methodError) setError(methodError.reason || "Impossibile approvare l’aggiornamento.");
    });
  };
  const deleteUpdate = async (update) => {
    if (currentUser?.role !== "Admin" || deletingId || saving || approvingId) return;
    if (!await confirmAction(`Eliminare la voce della versione ${update.version}? Non sarà più visibile agli utenti.`)) return;
    setError("");
    setDeletingId(update._id);
    Meteor.call("hlc.deleteSoftwareUpdate", update._id, (methodError) => {
      setDeletingId(null);
      if (methodError) setError(methodError.reason || "Impossibile eliminare l’aggiornamento.");
      else if (editingId === update._id) setEditingId(null);
    });
  };
  return <>
  <div className="app-content-header">
    <div className="container-fluid">
      <h1 className="mb-1">Aggiornamenti</h1>
      <p className="text-secondary mb-0">Le novità di HLC Scheduler, dalla versione più recente. Versione attuale: <strong>{SOFTWARE_VERSION}</strong>.</p>
      {currentUser?.role === "Admin" && <p className="text-secondary mt-2 mb-0">Le voci “Da approvare” sono visibili solo agli Admin. Puoi modificarle prima di approvarle e renderle visibili a tutti.</p>}
    </div>
  </div>
  <div className="app-content">
    <div className="container-fluid">
      <div className="row justify-content-center">
        <div className="col-12 col-xl-9">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {!ready ? <p className="text-secondary" role="status">Caricamento aggiornamenti…</p> : updates.length === 0 ? <p className="text-secondary">Nessun aggiornamento disponibile.</p> :
          <ol className="list-unstyled d-grid gap-3" aria-label="Storico degli aggiornamenti">
            {updates.map((update) => <li key={update._id}>
              <article className="card mb-0" aria-labelledby={`update-${update.version}`}>
                <div className="card-header d-flex flex-wrap align-items-center gap-2">
                  <h2 className="h5 mb-0" id={`update-${update.version}`}>Versione {update.version}</h2>
                  {update.version === SOFTWARE_VERSION && <span className="badge text-bg-primary">Versione attuale</span>}
                  {currentUser?.role === "Admin" && <span className={`badge ${update.approved === true ? "text-bg-success" : "text-bg-warning"}`}>{update.approved === true ? "Approvato" : "Da approvare"}</span>}
                  <time className="text-secondary ms-sm-auto" dateTime={update.date}>{formatDate(update.date)}</time>
                  {currentUser?.role === "Admin" && <>
                    {update.approved !== true && <button className="btn btn-success btn-sm" type="button" disabled={Boolean(approvingId) || Boolean(deletingId) || saving || Boolean(editingId)} onClick={() => approveUpdate(update)} aria-label={`Approva aggiornamento versione ${update.version}`}>{approvingId === update._id ? "Approvazione…" : "Approva"}</button>}
                    <button className="btn btn-outline-primary btn-sm" type="button" disabled={Boolean(deletingId) || saving || Boolean(editingId) || Boolean(approvingId)} onClick={() => editUpdate(update)} aria-label={`Modifica aggiornamento versione ${update.version}`}>Modifica</button>
                    <button className="btn btn-outline-danger btn-sm" type="button" disabled={Boolean(deletingId) || saving || Boolean(approvingId)} onClick={() => deleteUpdate(update)} aria-label={`Elimina aggiornamento versione ${update.version}`}>{deletingId === update._id ? "Eliminazione…" : "Elimina"}</button>
                  </>}
                </div>
                <div className="card-body">
                  {currentUser?.role === "Admin" && editingId === update._id ? <form onSubmit={saveUpdate}>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="update-summary">Titolo dell’aggiornamento</label>
                      <input className="form-control" id="update-summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={200} required disabled={saving} autoFocus />
                    </div>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="update-changes">Riepilogo delle modifiche</label>
                      <textarea className="form-control" id="update-changes" rows={6} value={changesText} onChange={(event) => setChangesText(event.target.value)} required disabled={saving} aria-describedby="update-changes-help" />
                      <div className="form-text" id="update-changes-help">Scrivi un punto per riga. Le righe vuote vengono ignorate.</div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</button>
                      <button className="btn btn-outline-secondary" type="button" disabled={saving} onClick={() => { setEditingId(null); setError(""); }}>Annulla</button>
                    </div>
                  </form> : <>
                  <h3 className="h6">{update.summary}</h3>
                  <ul className="mb-0">
                    {update.changes.map((change, changeIndex) => <li className={changeIndex > 0 ? "mt-2" : ""} key={change}>{change}</li>)}
                  </ul>
                  </>}
                </div>
              </article>
            </li>)}
          </ol>}
        </div>
      </div>
    </div>
  </div>
</>;
};
