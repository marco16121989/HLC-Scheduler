import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { confirmAction } from "./ConfirmDialog.js";

const emptyForm = () => ({ id: "", startDate: "", endDate: "", note: "" });
const formatDate = (value, dateStyle = "long") => value
  ? new Intl.DateTimeFormat("it-IT", { dateStyle, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
  : "-";

export const Absences = ({ absences = [], users = [], currentUser }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const isEditing = Boolean(form.id);
  const canViewAllAbsences = ["Presidente", "CAS"].includes(currentUser?.role);
  const visibleAbsences = canViewAllAbsences
    ? absences
    : absences.filter((absence) => absence.userId === currentUser?.id);
  const getAbsenceUser = (absence) =>
    users.find((user) => user.id === absence.userId) ||
    (absence.userId === currentUser?.id ? currentUser : null);

  const submit = (event) => {
    event.preventDefault();
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) {
      setError("Inserisci un periodo di assenza valido.");
      return;
    }
    Meteor.call("hlc.saveAbsence", {
      ...form,
      id: form.id || crypto.randomUUID(),
      note: form.note.trim(),
    }, (methodError) => {
      if (methodError) {
        setError(methodError.reason || "Impossibile salvare il periodo.");
        return;
      }
      setForm(emptyForm());
      setError("");
    });
  };

  const remove = async (absence) => {
    if (!await confirmAction("Eliminare questo periodo di assenza?")) return;
    Meteor.call("hlc.deleteAbsence", absence.id, (methodError) => {
      if (methodError) setError(methodError.reason || "Impossibile eliminare il periodo.");
      else if (form.id === absence.id) setForm(emptyForm());
    });
  };

  return <>
    <div className="app-content-header"><div className="container-fluid"><h1 className="mb-1">Periodi di assenza</h1><p className="text-secondary mb-0">Registra e consulta i periodi in cui gli utenti non sono disponibili.</p></div></div>
    <div className="app-content"><div className="container-fluid"><div className="row g-3">
      <div className="col-12 col-lg-5"><section className="card">
        <div className="card-header"><h2 className="card-title">{isEditing ? "Modifica assenza" : "Inserisci assenza"}</h2></div>
        <form onSubmit={submit}><div className="card-body">
          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
          <div className="row g-3">
            <div className="col-12 col-sm-6"><label className="form-label" htmlFor="absence-start">Dal</label><input className="form-control" id="absence-start" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required /></div>
            <div className="col-12 col-sm-6"><label className="form-label" htmlFor="absence-end">Al</label><input className="form-control" id="absence-end" type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required /></div>
            <div className="col-12"><label className="form-label" htmlFor="absence-note">Nota</label><textarea className="form-control" id="absence-note" rows="3" maxLength="500" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Motivo o informazioni facoltative" /></div>
          </div>
        </div><div className="card-footer d-flex justify-content-end gap-2">
          {isEditing && <button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(emptyForm()); setError(""); }}>Annulla</button>}
          <button className="btn btn-primary" type="submit">{isEditing ? "Salva modifiche" : "Inserisci"}</button>
        </div></form>
      </section></div>
      <div className="col-12 col-lg-7"><section className="card">
        <div className="card-header"><h2 className="card-title">{canViewAllAbsences ? "Assenze degli utenti" : "Le mie assenze"}</h2></div>
        <div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0 mobile-card-table absence-list-table"><thead><tr>{canViewAllAbsences && <th>Utente</th>}<th>Dal</th><th>Al</th><th>Nota</th><th className="text-end">Azioni</th></tr></thead><tbody>
          {visibleAbsences.length === 0 ? <tr><td className="text-center text-secondary py-4" colSpan={canViewAllAbsences ? "5" : "4"}>Nessun periodo di assenza inserito.</td></tr> : visibleAbsences.map((absence) => { const absenceUser = getAbsenceUser(absence); const isOwn = absence.userId === currentUser?.id; return <tr key={absence.id}>{canViewAllAbsences && <td data-label="Utente"><div className="fw-medium">{absenceUser?.username || absence.username || "Utente"}</div><span className="badge text-bg-secondary">{absenceUser?.role || "-"}</span></td>}<td data-label="Dal"><span className="absence-desktop-date">{formatDate(absence.startDate)}</span><span className="absence-mobile-period"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18" /></svg><span>{formatDate(absence.startDate, "medium")} <span className="absence-date-arrow" aria-label="fino al">→</span> {formatDate(absence.endDate, "medium")}</span></span></td><td data-label="Al">{formatDate(absence.endDate)}</td><td data-label="Nota">{absence.note?.trim() ? absence.note : <span className="text-secondary">Nessuna nota presente</span>}</td><td className="text-end" data-label="Azioni">{isOwn && <div className="d-inline-flex gap-2"><button className="btn btn-outline-primary btn-sm" type="button" onClick={() => { setForm({ id: absence.id, startDate: absence.startDate, endDate: absence.endDate, note: absence.note || "" }); setError(""); }}>Modifica</button><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => remove(absence)}>Elimina</button></div>}</td></tr>; })}
        </tbody></table></div></div>
      </section></div>
    </div></div></div>
  </>;
};
