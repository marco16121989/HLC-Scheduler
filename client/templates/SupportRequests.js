import { useState } from "react";
import { Meteor } from "meteor/meteor";

const initialForm = { type: "Richiesta", subject: "", priority: "Normale", phone: "", message: "" };
const statusClass = { Inviata: "text-bg-secondary", "In lavorazione": "text-bg-primary", Risolta: "text-bg-success", Chiusa: "text-bg-dark" };

export const SupportRequests = ({ requests, currentUser }) => {
  const emptyForm = { ...initialForm, phone: currentUser.phone || "" };
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [sending, setSending] = useState(false);
  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFeedback({ type: "", message: "" });
  };
  const submit = (event) => {
    event.preventDefault();
    setSending(true);
    Meteor.call("hlc.createSupportRequest", form, (error) => {
      setSending(false);
      if (error) {
        setFeedback({ type: "danger", message: error.reason || "Impossibile inviare la richiesta." });
        return;
      }
      setForm(emptyForm);
      setFeedback({ type: "success", message: "Richiesta inviata correttamente." });
    });
  };
  const updateStatus = (id, status) => Meteor.call("hlc.updateSupportRequestStatus", id, status, (error) => {
    if (error) globalThis.alert(error.reason || "Impossibile aggiornare lo stato.");
  });

  return <>
    <div className="app-content-header"><div className="container-fluid"><h1 className="mb-1">Segnalazioni e richieste</h1><p className="text-secondary mb-0">Invia richieste di assistenza e monitora le segnalazioni aperte.</p></div></div>
    <div className="app-content"><div className="container-fluid"><div className="row g-3">
      {currentUser.role !== "Admin" && <div className="col-12 col-xl-5"><section className="card"><div className="card-header"><h2 className="card-title">Nuovo messaggio</h2></div><form onSubmit={submit}>
        <div className="card-body">{feedback.message && <div className={`alert alert-${feedback.type}`} role="status">{feedback.message}</div>}<div className="row g-3">
          <div className="col-6"><label className="form-label" htmlFor="support-type">Tipo</label><select className="form-select" id="support-type" name="type" value={form.type} onChange={update}><option>Richiesta</option><option>Segnalazione</option></select></div>
          <div className="col-6"><label className="form-label" htmlFor="support-priority">Priorità</label><select className="form-select" id="support-priority" name="priority" value={form.priority} onChange={update}><option>Bassa</option><option>Normale</option><option>Alta</option><option>Urgente</option></select></div>
          <div className="col-12"><label className="form-label" htmlFor="support-subject">Oggetto</label><input className="form-control" id="support-subject" name="subject" value={form.subject} onChange={update} maxLength="150" required /></div>
          <div className="col-12"><label className="form-label" htmlFor="support-phone">Numero di telefono</label><input className="form-control" id="support-phone" name="phone" type="tel" value={form.phone} onChange={update} autoComplete="tel" placeholder="Numero per essere ricontattato" /></div>
          <div className="col-12"><label className="form-label" htmlFor="support-message">Descrizione</label><textarea className="form-control" id="support-message" name="message" rows="7" value={form.message} onChange={update} required /></div>
        </div></div><div className="card-footer text-end"><button className="btn btn-primary" type="submit" disabled={sending}>{sending ? "Invio…" : "Invia"}</button></div>
      </form></section></div>}
      <div className={currentUser.role === "Admin" ? "col-12" : "col-12 col-xl-7"}><section className="card"><div className="card-header"><h2 className="card-title">{currentUser.role === "Admin" ? "Tutte le segnalazioni" : "Le mie segnalazioni"}</h2></div><div className="card-body">
        {requests.length === 0 ? <p className="text-secondary mb-0">Nessuna segnalazione o richiesta inviata.</p> : <div className="support-request-list">{requests.map((request) => <article className="support-request" key={request.id}>
          <div className="d-flex justify-content-between gap-3"><div><div className="d-flex flex-wrap gap-2 mb-2"><span className="badge text-bg-light">{request.type}</span><span className={`badge ${request.priority === "Urgente" ? "text-bg-danger" : request.priority === "Alta" ? "text-bg-warning" : "text-bg-light"}`}>{request.priority}</span><span className={`badge ${statusClass[request.status] || "text-bg-secondary"}`}>{request.status}</span></div><h3>{request.subject}</h3></div><time>{request.createdAt ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(request.createdAt)) : ""}</time></div>
          <p>{request.message}</p>{currentUser.role === "Admin" && <div className="d-flex align-items-center justify-content-between gap-3"><small>Inviata da: {request.createdByUsername}{request.phone ? ` · Tel: ${request.phone}` : ""}</small><select className="form-select form-select-sm support-status-select" value={request.status} onChange={(event) => updateStatus(request.id, event.target.value)}><option>Inviata</option><option>In lavorazione</option><option>Risolta</option><option>Chiusa</option></select></div>}
        </article>)}</div>}
      </div></section></div>
    </div></div></div>
  </>;
};
