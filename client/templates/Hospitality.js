import { useState } from "react";
import { confirmAction } from "./ConfirmDialog.js";

const EMPTY_FORM = {
  hostName: "", phone: "", address: "", city: "", hospitalityFor: "both",
  capacity: "1", availability: "", notes: "", active: true,
};

const hospitalityForLabel = (value) => value === "patient"
  ? "Pazienti"
  : value === "relatives" ? "Familiari" : "Pazienti e familiari";

export const Hospitality = ({ offers, setOffers, presidentId, readOnly = false }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const visibleOffers = offers
    .filter((offer) => offer.presidentId === presidentId)
    .filter((offer) => `${offer.hostName || ""} ${offer.city || ""} ${offer.address || ""}`.toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it")))
    .sort((first, second) => (first.hostName || "").localeCompare(second.hostName || "", "it", { sensitivity: "base" }));
  const isEditing = Boolean(editingId);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };
  const closeModal = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(false);
    setError("");
  };
  const openCreate = () => {
    closeModal();
    setModalOpen(true);
  };
  const openEdit = (offer) => {
    setForm({
      hostName: offer.hostName || "", phone: offer.phone || "", address: offer.address || "",
      city: offer.city || "", hospitalityFor: offer.hospitalityFor || "both",
      capacity: String(offer.capacity || 1), availability: offer.availability || "",
      notes: offer.notes || "", active: offer.active !== false,
    });
    setEditingId(offer.id);
    setError("");
    setModalOpen(true);
  };
  const save = (event) => {
    event.preventDefault();
    const hostName = form.hostName.trim();
    if (!hostName) {
      setError("Inserisci il nominativo di chi offre ospitalità.");
      return;
    }
    const record = {
      ...form,
      hostName,
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      availability: form.availability.trim(),
      notes: form.notes.trim(),
      capacity: Math.max(1, Number.parseInt(form.capacity, 10) || 1),
      presidentId,
    };
    if (isEditing) {
      setOffers((current) => current.map((offer) => offer.id === editingId ? { ...offer, ...record } : offer));
    } else {
      setOffers((current) => [...current, { ...record, id: crypto.randomUUID(), createdAt: new Date() }]);
    }
    closeModal();
  };
  const remove = async () => {
    if (!await confirmAction(`Eliminare la disponibilità di “${form.hostName}”?`)) return;
    setOffers((current) => current.filter((offer) => offer.id !== editingId));
    closeModal();
  };

  return <>
    <div className="app-content-header"><div className="container-fluid"><div className="d-flex align-items-start justify-content-between gap-3"><div><h1 className="mb-1">Ospitalità</h1><p className="text-secondary mb-0">Gestisci le persone che offrono la propria casa per ospitare pazienti o familiari.</p></div>{!readOnly && <button className="btn btn-primary" type="button" onClick={openCreate}>Inserisci</button>}</div></div></div>
    <div className="app-content"><div className="container-fluid">
      {modalOpen && <button className="entity-modal-backdrop" type="button" aria-label="Chiudi finestra" onClick={closeModal} />}
      <div className={modalOpen ? "entity-modal-shell" : "d-none"} role="dialog" aria-modal="true" aria-labelledby="hospitality-modal-title">
        <section className="card entity-modal-card"><div className="card-header d-flex align-items-center"><h2 className="card-title" id="hospitality-modal-title">{isEditing ? "Modifica disponibilità" : "Inserisci disponibilità"}</h2><button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeModal} /></div>
          <form onSubmit={save}><div className="card-body">{error && <div className="alert alert-danger py-2">{error}</div>}<div className="row g-3">
            <div className="col-12 col-md-6"><label className="form-label" htmlFor="hospitality-name">Nominativo</label><input className="form-control" id="hospitality-name" value={form.hostName} onChange={(event) => updateField("hostName", event.target.value)} required autoFocus /></div>
            <div className="col-12 col-md-6"><label className="form-label" htmlFor="hospitality-phone">Telefono</label><input className="form-control" id="hospitality-phone" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} /></div>
            <div className="col-12 col-md-8"><label className="form-label" htmlFor="hospitality-address">Indirizzo</label><input className="form-control" id="hospitality-address" value={form.address} onChange={(event) => updateField("address", event.target.value)} /></div>
            <div className="col-12 col-md-4"><label className="form-label" htmlFor="hospitality-city">Comune</label><input className="form-control" id="hospitality-city" value={form.city} onChange={(event) => updateField("city", event.target.value)} /></div>
            <div className="col-12 col-md-6"><label className="form-label" htmlFor="hospitality-for">Ospitalità per</label><select className="form-select" id="hospitality-for" value={form.hospitalityFor} onChange={(event) => updateField("hospitalityFor", event.target.value)}><option value="both">Pazienti e familiari</option><option value="patient">Pazienti</option><option value="relatives">Familiari</option></select></div>
            <div className="col-12 col-md-6"><label className="form-label" htmlFor="hospitality-capacity">Persone ospitabili</label><input className="form-control" id="hospitality-capacity" type="number" min="1" value={form.capacity} onChange={(event) => updateField("capacity", event.target.value)} /></div>
            <div className="col-12"><label className="form-label" htmlFor="hospitality-availability">Disponibilità</label><input className="form-control" id="hospitality-availability" placeholder="Esempio: sempre, solo fine settimana, contattare prima" value={form.availability} onChange={(event) => updateField("availability", event.target.value)} /></div>
            <div className="col-12"><label className="form-label" htmlFor="hospitality-notes">Note</label><textarea className="form-control" id="hospitality-notes" rows="3" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></div>
            <div className="col-12"><label className="form-check"><input className="form-check-input" type="checkbox" checked={form.active} onChange={(event) => updateField("active", event.target.checked)} /><span className="form-check-label">Disponibilità attiva</span></label></div>
          </div></div><div className="card-footer d-flex gap-2">{isEditing && <button className="btn btn-outline-danger me-auto" type="button" onClick={remove}>Elimina</button>}<button className="btn btn-outline-secondary" type="button" onClick={closeModal}>Annulla</button><button className="btn btn-primary" type="submit">{isEditing ? "Salva modifiche" : "Inserisci"}</button></div></form>
        </section>
      </div>
      <section className="card"><div className="card-header d-flex flex-wrap align-items-center gap-3"><h2 className="card-title mb-0">Disponibilità registrate</h2><input className="form-control form-control-sm ms-auto" style={{ maxWidth: "22rem" }} type="search" placeholder="Cerca per nominativo, comune o indirizzo" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0 mobile-card-table"><thead><tr><th>Nominativo</th><th>Contatti e luogo</th><th>Ospitalità</th><th>Disponibilità</th><th>Stato</th>{!readOnly && <th className="text-end">Azioni</th>}</tr></thead><tbody>{visibleOffers.length === 0 ? <tr><td className="text-center text-secondary py-4" colSpan={readOnly ? 5 : 6}>Nessuna disponibilità registrata.</td></tr> : visibleOffers.map((offer) => <tr key={offer.id}><td className="fw-medium" data-label="Nominativo">{offer.hostName}</td><td data-label="Contatti e luogo"><div>{offer.phone || "-"}</div><small className="text-secondary">{[offer.address, offer.city].filter(Boolean).join(", ") || "-"}</small></td><td data-label="Ospitalità">{hospitalityForLabel(offer.hospitalityFor)} · {offer.capacity || 1} {(offer.capacity || 1) === 1 ? "persona" : "persone"}</td><td data-label="Disponibilità">{offer.availability || "-"}{offer.notes && <small className="d-block text-secondary">{offer.notes}</small>}</td><td data-label="Stato"><span className={`badge ${offer.active === false ? "text-bg-secondary" : "text-bg-success"}`}>{offer.active === false ? "Non disponibile" : "Disponibile"}</span></td>{!readOnly && <td className="text-end" data-label="Azioni"><button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openEdit(offer)}>Modifica</button></td>}</tr>)}</tbody></table></div></div></section>
    </div></div>
  </>;
};
