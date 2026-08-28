import { useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { confirmAction } from "./ConfirmDialog.js";
import { PaginationControls, usePagination } from "./Pagination.js";
import { getPagePermission } from "/imports/constants/pagePermissions";

const emptyForm = () => ({
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  location: "",
  inviteeIds: [],
});

const statusLabel = {
  pending: "In attesa",
  accepted: "Accettato",
  declined: "Rifiutato",
};

const statusClass = {
  pending: "text-bg-warning",
  accepted: "text-bg-success",
  declined: "text-bg-danger",
};

const formatEventDate = (value) => value
  ? new Intl.DateTimeFormat("it-IT", { dateStyle: "full", timeStyle: "short" }).format(new Date(value))
  : "Data non disponibile";

const formatEventPeriod = (startsAt, endsAt) => {
  if (!endsAt) return formatEventDate(startsAt);
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  if (!sameDay) return `${formatEventDate(startsAt)} – ${formatEventDate(endsAt)}`;
  const date = new Intl.DateTimeFormat("it-IT", { dateStyle: "full" }).format(start);
  const time = new Intl.DateTimeFormat("it-IT", { timeStyle: "short" });
  return `${date}, ${time.format(start)} – ${time.format(end)}`;
};

const EventResponseDonut = ({ invitees }) => {
  const total = invitees.length;
  const accepted = invitees.filter((item) => item.status === "accepted").length;
  const declined = invitees.filter((item) => item.status === "declined").length;
  const pending = invitees.filter((item) => item.status === "pending").length;
  const acceptedEnd = total ? (accepted / total) * 360 : 0;
  const declinedEnd = total ? acceptedEnd + (declined / total) * 360 : 0;
  const background = total
    ? `conic-gradient(var(--bs-success) 0deg ${acceptedEnd}deg, var(--bs-danger) ${acceptedEnd}deg ${declinedEnd}deg, var(--bs-warning) ${declinedEnd}deg 360deg)`
    : "var(--bs-secondary-bg)";
  return <div className="event-response-chart" role="img" aria-label={`${accepted} partecipano, ${declined} non partecipano, ${pending} in attesa`}>
    <div className="event-response-donut" style={{ background }}><div className="event-response-donut-center"><strong>{accepted}</strong><span>su {total}</span></div></div>
    <div className="event-response-legend">
      <span><i className="accepted" />Partecipano <strong>{accepted}</strong></span>
      <span><i className="declined" />Non partecipano <strong>{declined}</strong></span>
      <span><i className="pending" />In attesa <strong>{pending}</strong></span>
    </div>
  </div>;
};

export const Events = ({ events = [], users = [], currentUser, presidentId }) => {
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = ["Presidente", "CAS"].includes(currentUser.role);
  const canRespond = currentUser.role !== "GVP" || getPagePermission(currentUser, "events").edit;
  const organizationUsers = useMemo(() => users.filter((user) =>
    user.id !== currentUser.id &&
    ["CAS", "GVP"].includes(user.role) &&
    (user.presidentId === presidentId || user.associationId === presidentId),
  ), [users, currentUser.id, presidentId]);
  const casUsers = organizationUsers.filter((user) => user.role === "CAS");
  const gvpUsers = organizationUsers.filter((user) => user.role === "GVP");
  const eventPagination = usePagination(events, 12);

  const closeModal = () => {
    setForm(emptyForm());
    setError("");
    setSaving(false);
    setModalOpen(false);
  };
  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };
  const toggleInvitee = (userId) => update(
    "inviteeIds",
    form.inviteeIds.includes(userId)
      ? form.inviteeIds.filter((id) => id !== userId)
      : [...form.inviteeIds, userId],
  );
  const toggleRole = (roleUsers) => {
    const roleIds = roleUsers.map((user) => user.id);
    const allSelected = roleIds.length > 0 && roleIds.every((id) => form.inviteeIds.includes(id));
    update("inviteeIds", allSelected
      ? form.inviteeIds.filter((id) => !roleIds.includes(id))
      : [...new Set([...form.inviteeIds, ...roleIds])]);
  };
  const createEvent = (submitEvent) => {
    submitEvent.preventDefault();
    if (!form.title.trim() || !form.startsAt || !form.endsAt || form.inviteeIds.length === 0) {
      setError("Inserisci titolo, inizio, fine e seleziona almeno un invitato.");
      return;
    }
    if (new Date(form.endsAt) <= new Date(form.startsAt)) {
      setError("La fine dell’evento deve essere successiva all’inizio.");
      return;
    }
    setSaving(true);
    Meteor.call("hlc.createEvent", form, (methodError) => {
      if (methodError) {
        setSaving(false);
        setError(methodError.reason || "Impossibile creare l’evento.");
        return;
      }
      closeModal();
    });
  };
  const respond = (eventId, response) => {
    Meteor.call("hlc.respondToEvent", eventId, response, (methodError) => {
      if (methodError) globalThis.alert(methodError.reason || "Impossibile registrare la risposta.");
    });
  };
  const removeEvent = async (event) => {
    if (!await confirmAction(`Eliminare l’evento “${event.title}”?`)) return;
    Meteor.call("hlc.deleteEvent", event.id, (methodError) => {
      if (methodError) globalThis.alert(methodError.reason || "Impossibile eliminare l’evento.");
    });
  };

  return <>
    <div className="app-content-header">
      <div className="container-fluid d-flex align-items-center justify-content-between gap-3">
        <div><h1 className="mb-1">Eventi</h1><p className="text-secondary mb-0">Crea eventi, gestisci gli invitati e consulta le risposte ricevute.</p></div>
        {canCreate && <button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}>Crea evento</button>}
      </div>
    </div>
    <div className="app-content events-page">
      <div className="container-fluid">
        {modalOpen && <button className="entity-modal-backdrop" type="button" aria-label="Chiudi finestra" onClick={closeModal} />}
        <div className={modalOpen ? "entity-modal-shell" : "d-none"} role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
          <section className="card entity-modal-card event-modal-card">
            <div className="card-header d-flex align-items-center">
              <h2 className="card-title" id="event-modal-title">Nuovo evento</h2>
              <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeModal} />
            </div>
            <form onSubmit={createEvent}>
              <div className="card-body">
                {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                <div className="row g-3">
                  <div className="col-12"><label className="form-label" htmlFor="event-title">Titolo</label><input className="form-control" id="event-title" value={form.title} onChange={(e) => update("title", e.target.value)} maxLength="160" required /></div>
                  <div className="col-12 col-md-6"><label className="form-label" htmlFor="event-start">Inizio</label><input className="form-control" id="event-start" type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} required /></div>
                  <div className="col-12 col-md-6"><label className="form-label" htmlFor="event-end">Fine</label><input className="form-control" id="event-end" type="datetime-local" value={form.endsAt} min={form.startsAt || undefined} onChange={(e) => update("endsAt", e.target.value)} required /></div>
                  <div className="col-12"><label className="form-label" htmlFor="event-location">Luogo / collegamento</label><input className="form-control" id="event-location" value={form.location} onChange={(e) => update("location", e.target.value)} maxLength="300" /></div>
                  <div className="col-12"><label className="form-label" htmlFor="event-description">Descrizione</label><textarea className="form-control" id="event-description" rows="4" value={form.description} onChange={(e) => update("description", e.target.value)} maxLength="4000" /></div>
                </div>
                <div className="event-invite-grid mt-4">
                  {[["CAS", casUsers], ["GVP", gvpUsers]].map(([role, roleUsers]) => {
                    const allSelected = roleUsers.length > 0 && roleUsers.every((user) => form.inviteeIds.includes(user.id));
                    return <fieldset className="event-invite-group" key={role}>
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                        <legend className="h6 mb-0">Invita {role}</legend>
                        <button className="btn btn-outline-primary btn-sm" type="button" disabled={roleUsers.length === 0} onClick={() => toggleRole(roleUsers)}>{allSelected ? "Deseleziona tutti" : `Tutti i ${role}`}</button>
                      </div>
                      {roleUsers.length === 0 ? <p className="small text-secondary mb-0">Nessun {role} disponibile.</p> : <div className="event-invite-list">{roleUsers.map((user) => <label className="form-check" key={user.id}><input className="form-check-input" type="checkbox" checked={form.inviteeIds.includes(user.id)} onChange={() => toggleInvitee(user.id)} /><span className="form-check-label">{user.username}</span></label>)}</div>}
                    </fieldset>;
                  })}
                </div>
              </div>
              <div className="card-footer d-flex justify-content-end gap-2"><button className="btn btn-outline-secondary" type="button" onClick={closeModal}>Annulla</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Creazione…" : "Crea e invia inviti"}</button></div>
            </form>
          </section>
        </div>

        {events.length === 0 ? <section className="card"><div className="card-body text-center text-secondary py-5">Nessun evento disponibile.</div></section> : <><div className="event-card-grid">{eventPagination.pageItems.map((event) => {
          const isOwner = event.createdBy === currentUser.id;
          const invitation = event.invitees?.find((item) => item.userId === currentUser.id);
          const invitees = event.invitees || [];
          return <article className="card event-card" key={event.id}>
            <div className="card-body">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div className="min-w-0"><div className="event-card-heading"><h2 className="h5 mb-0">{event.title}</h2><time dateTime={event.startsAt}>{formatEventPeriod(event.startsAt, event.endsAt)}</time>{event.location && <span className="event-card-location">{event.location}</span>}</div><div className="text-secondary small mt-1">Creato da {event.creatorName}</div></div>
                {invitation && <span className={`badge ${statusClass[invitation.status] || statusClass.pending}`}>{statusLabel[invitation.status] || statusLabel.pending}</span>}
              </div>
              {event.description && <p className="event-description mt-3 mb-0">{event.description}</p>}
              {isOwner && <details className="event-response-details">
                <summary aria-label="Mostra o nascondi l’elenco degli invitati">
                  <EventResponseDonut invitees={invitees} />
                </summary>
                <div className="table-responsive mt-3"><table className="table table-sm align-middle mb-0"><thead><tr><th>Invitato</th><th>Ruolo</th><th>Risposta</th></tr></thead><tbody>{invitees.map((invitee) => <tr key={invitee.userId}><td>{invitee.username}</td><td>{invitee.role}</td><td><span className={`badge ${statusClass[invitee.status] || statusClass.pending}`}>{statusLabel[invitee.status] || statusLabel.pending}</span></td></tr>)}</tbody></table></div>
              </details>}
            </div>
            <div className="card-footer d-flex align-items-center justify-content-end gap-2">
              {isOwner ? <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => removeEvent(event)}>Elimina evento</button> : canRespond ? <><button className={`btn btn-sm ${invitation?.status === "declined" ? "btn-danger" : "btn-outline-danger"}`} type="button" onClick={() => respond(event.id, "declined")}>Non partecipo</button><button className={`btn btn-sm ${invitation?.status === "accepted" ? "btn-success" : "btn-outline-success"}`} type="button" onClick={() => respond(event.id, "accepted")}>Partecipo</button></> : <span className="text-secondary small">Risposta non autorizzata</span>}
            </div>
          </article>;
        })}</div><PaginationControls {...eventPagination} /></>}
      </div>
    </div>
  </>;
};
