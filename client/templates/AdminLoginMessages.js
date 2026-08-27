import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { confirmAction } from "./ConfirmDialog.js";

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => value ? new Intl.DateTimeFormat("it-IT").format(new Date(`${value}T00:00:00`)) : "-";

export const AdminLoginMessages = ({ messages = [] }) => {
  const [text, setText] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const createMessage = (event) => {
    event.preventDefault();
    if (!text.trim()) {
      setError("Inserisci il messaggio.");
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      setError("Seleziona un periodo valido.");
      return;
    }
    setSaving(true);
    setError("");
    Meteor.call("hlc.createLoginMessage", { text, startDate, endDate }, (methodError) => {
      setSaving(false);
      if (methodError) {
        setError(methodError.reason || "Impossibile salvare il messaggio.");
        return;
      }
      setText("");
      setStartDate(today());
      setEndDate(today());
    });
  };

  const deleteMessage = async (message) => {
    if (!await confirmAction("Eliminare questo messaggio di login? Non verrà più mostrato agli utenti.")) return;
    Meteor.call("hlc.deleteLoginMessage", message.id, (methodError) => {
      if (methodError) globalThis.alert(methodError.reason || "Impossibile eliminare il messaggio.");
    });
  };

  const currentDay = today();
  return <section className="admin-dashboard-card admin-login-messages">
    <div className="admin-card-heading"><div><span className="admin-eyebrow">Comunicazioni</span><h2>Messaggi mostrati al login</h2><p>Visibili a Presidente, CAS e GVP durante il periodo selezionato.</p></div></div>
    <form className="admin-login-message-form" onSubmit={createMessage}>
      {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
      <label className="form-label" htmlFor="admin-login-message-text">Messaggio</label>
      <textarea className="form-control" id="admin-login-message-text" rows="4" maxLength="4000" value={text} onChange={(event) => setText(event.target.value)} placeholder="Scrivi il messaggio da mostrare agli utenti…" />
      <div className="admin-login-message-dates">
        <div><label className="form-label" htmlFor="admin-login-message-start">Data di inizio</label><input className="form-control" id="admin-login-message-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
        <div><label className="form-label" htmlFor="admin-login-message-end">Data di fine</label><input className="form-control" id="admin-login-message-end" type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Pubblica messaggio"}</button>
      </div>
    </form>
    <div className="admin-login-message-list">
      {messages.map((message) => {
        const active = message.startDate <= currentDay && message.endDate >= currentDay;
        return <article key={message.id}><div><div className="d-flex align-items-center gap-2 mb-1"><strong>{formatDate(message.startDate)} – {formatDate(message.endDate)}</strong><span className={`badge ${active ? "text-bg-success" : message.endDate < currentDay ? "text-bg-secondary" : "text-bg-info"}`}>{active ? "Attivo" : message.endDate < currentDay ? "Terminato" : "Programmato"}</span></div><p>{message.text}</p></div><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteMessage(message)}>Elimina</button></article>;
      })}
      {messages.length === 0 && <p className="text-secondary mb-0">Nessun messaggio programmato.</p>}
    </div>
  </section>;
};
