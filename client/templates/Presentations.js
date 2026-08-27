import { useState } from "react";
import { confirmAction } from "./ConfirmDialog.js";
import { createPopulatedPresentationPdf } from "../utils/populatePresentationPdf.js";
import { PaginationControls, usePagination } from "./Pagination.js";

const PRESENTATION_TYPES = ["In presenza", "Online", "PowerPoint", "Espositori"];
const SPECIALIZATIONS = [
  "Anestesiologia", "Centro ustioni", "Cardiochirurgia", "Chirurgia colorettale",
  "Chirurgia generale", "Chirurgia orale e maxillo-facciale", "Chirurgia ortopedica",
  "Chirurgia toracica", "Chirurgia traumatologica", "Chirurgia vascolare",
  "Ematologia", "Gastroenterologia", "Ginecologia", "Ginecologia oncologica",
  "Medicina d'urgenza", "Medicina interna", "Medicina ospedaliera",
  "Medico del travaglio", "Medico notturno", "Nefrologia", "Neonatologia",
  "Neurochirurgia", "Oncologia", "Ostetricia",
  "Otorinolaringoiatria e Chirurgia della testa e del collo",
  "Perinatologia (gravidanze ad alto rischio)", "Pneumologia",
  "Radiologia interventistica", "Terapia intensiva/Rianimazione", "Trapianti",
  "Urologia", "Altro",
];

const emptyPresentation = (currentUser) => ({
  recordType: "new",
  presentationTypes: [],
  comments: "",
  presentationDate: "",
  attendeesCount: "",
  attendeeSpecialization: "",
  event: "",
  coordinator: "",
  coordinatorContacts: "",
  coordinatorContactsAdditional: "",
  additionalInformation: "",
  eventWebsite: "",
  facility: "",
  address: "",
  addressAdditional: "",
  city: "",
  province: "",
  postalCode: "",
  country: "Italia",
  problems: "",
  positiveExperiences: "",
  casName: "",
  declarationDate: new Date().toISOString().slice(0, 10),
  casMember: currentUser.role === "CAS" ? currentUser.username : "",
});

const Field = ({ label, name, value, onChange, type = "text", required = false, options = [] }) => (
  <div className={type === "textarea" ? "col-12" : "col-12 col-md-6"}>
    <label className="form-label" htmlFor={`presentation-${name}`}>{label}</label>
    {type === "textarea" ? (
      <textarea className="form-control" id={`presentation-${name}`} rows="4" value={value} onChange={(event) => onChange(name, event.target.value)} required={required} />
    ) : type === "select" ? (
      <select className="form-select" id={`presentation-${name}`} value={value} onChange={(event) => onChange(name, event.target.value)} required={required}>
        <option value="">Seleziona</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    ) : (
      <input className="form-control" id={`presentation-${name}`} type={type} value={value} onChange={(event) => onChange(name, event.target.value)} required={required} min={type === "number" ? "0" : undefined} />
    )}
  </div>
);

export const Presentations = ({ presentations, setPresentations, currentUser, presidentId }) => {
  const [form, setForm] = useState(() => emptyPresentation(currentUser));
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const isEditing = editingId !== null;
  const visiblePresentations = presentations.filter((item) => item.presidentId === presidentId);
  const sortedPresentations = [...visiblePresentations].sort((first, second) =>
    (second.presentationDate || "").localeCompare(first.presentationDate || ""),
  );
  const presentationPagination = usePagination(sortedPresentations, 20);

  const resetForm = () => {
    setForm(emptyPresentation(currentUser));
    setEditingId(null);
    setError("");
    setModalOpen(false);
  };
  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };
  const toggleType = (type) => update(
    "presentationTypes",
    form.presentationTypes.includes(type)
      ? form.presentationTypes.filter((item) => item !== type)
      : [...form.presentationTypes, type],
  );

  const savePresentation = () => {
    if (!form.presentationDate || !form.event.trim() || !form.casName.trim() || !form.casMember.trim()) {
      setError("Completa data, evento, nome CAS e membro CAS.");
      return null;
    }
    if (form.presentationTypes.length === 0) {
      setError("Seleziona almeno un tipo di presentazione.");
      return null;
    }
    const saved = {
      ...form,
      id: editingId || crypto.randomUUID(),
      event: form.event.trim(),
      casName: form.casName.trim(),
      casMember: form.casMember.trim(),
      presidentId,
    };
    if (isEditing) {
      setPresentations((current) => current.map((item) => item.id === editingId ? saved : item));
    } else {
      setPresentations((current) => [...current, saved]);
    }
    resetForm();
    return saved;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    savePresentation();
  };
  const handleSaveAndOpen = async () => {
    const saved = savePresentation();
    if (!saved) return;
    const pdfWindow = globalThis.open("", "_blank");
    try {
      const pdfUrl = await createPopulatedPresentationPdf(saved);
      if (pdfWindow) pdfWindow.location.href = pdfUrl;
      else globalThis.location.href = pdfUrl;
      globalThis.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (pdfError) {
      pdfWindow?.close();
      globalThis.alert(pdfError.message || "Impossibile generare il PDF compilato.");
    }
  };
  const handleEdit = (presentation) => {
    setForm({ ...emptyPresentation(currentUser), ...presentation });
    setEditingId(presentation.id);
    setError("");
    setModalOpen(true);
  };
  const handleDelete = async () => {
    const item = presentations.find((presentation) => presentation.id === editingId);
    if (!item || !await confirmAction(`Eliminare la presentazione “${item.event}”?`)) return;
    setPresentations((current) => current.filter((presentation) => presentation.id !== editingId));
    resetForm();
  };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid d-flex align-items-center justify-content-between gap-3">
          <div><h1 className="mb-1">Presentazioni</h1><p className="text-secondary mb-0">Programma e consulta le presentazioni dell’organizzazione.</p></div>
          <button className="btn btn-primary" type="button" onClick={() => { resetForm(); setModalOpen(true); }}>Crea presentazione</button>
        </div>
      </div>
      <div className="app-content">
        <div className="container-fluid">
          {modalOpen && <button className="entity-modal-backdrop" type="button" aria-label="Chiudi finestra" onClick={resetForm} />}
          <div className={modalOpen ? "entity-modal-shell" : "d-none"} role="dialog" aria-modal="true" aria-labelledby="presentation-modal-title">
            <section className="card entity-modal-card">
              <div className="card-header d-flex align-items-center">
                <h2 className="card-title" id="presentation-modal-title">{isEditing ? "Modifica presentazione" : "Nuova presentazione"}</h2>
                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={resetForm} />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="card-body">
                  {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                  <fieldset className="patient-detail-section mt-0">
                    <legend>Sezione 1 — Tipo di presentazione</legend>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label">Motivo della compilazione</label>
                        <div className="d-flex flex-wrap gap-3">
                          {[['new', 'Nuova presentazione'], ['update', 'Aggiornamento di una presentazione']].map(([value, label]) => (
                            <label className="form-check" key={value}><input className="form-check-input" type="radio" name="record-type" checked={form.recordType === value} onChange={() => update("recordType", value)} /> <span className="form-check-label">{label}</span></label>
                          ))}
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Tipi di presentazione</label>
                        <div className="d-flex flex-wrap gap-3">
                          {PRESENTATION_TYPES.map((type) => <label className="form-check" key={type}><input className="form-check-input" type="checkbox" checked={form.presentationTypes.includes(type)} onChange={() => toggleType(type)} /> <span className="form-check-label">{type}</span></label>)}
                        </div>
                      </div>
                      <Field label="Commenti" name="comments" type="textarea" value={form.comments} onChange={update} />
                    </div>
                  </fieldset>
                  <fieldset className="patient-detail-section">
                    <legend>Sezione 2 — Informazioni sulla presentazione</legend>
                    <div className="row g-3">
                      <Field label="Data della presentazione" name="presentationDate" type="date" value={form.presentationDate} onChange={update} required />
                      <Field label="Numero di presenti" name="attendeesCount" type="number" value={form.attendeesCount} onChange={update} />
                      <Field label="Specializzazione dei presenti" name="attendeeSpecialization" type="select" options={SPECIALIZATIONS} value={form.attendeeSpecialization} onChange={update} />
                      <Field label="Evento" name="event" value={form.event} onChange={update} required />
                      <Field label="Coordinatore dell’evento" name="coordinator" value={form.coordinator} onChange={update} />
                      <Field label="Recapiti del coordinatore" name="coordinatorContacts" value={form.coordinatorContacts} onChange={update} />
                      <Field label="Recapiti aggiuntivi" name="coordinatorContactsAdditional" value={form.coordinatorContactsAdditional} onChange={update} />
                      <Field label="Ulteriori informazioni" name="additionalInformation" value={form.additionalInformation} onChange={update} />
                      <Field label="Sito web dell’evento" name="eventWebsite" type="url" value={form.eventWebsite} onChange={update} />
                      <Field label="Struttura" name="facility" value={form.facility} onChange={update} />
                      <Field label="Indirizzo" name="address" value={form.address} onChange={update} />
                      <Field label="Dettagli aggiuntivi dell’indirizzo" name="addressAdditional" value={form.addressAdditional} onChange={update} />
                      <Field label="Città" name="city" value={form.city} onChange={update} />
                      <Field label="Provincia" name="province" value={form.province} onChange={update} />
                      <Field label="CAP" name="postalCode" value={form.postalCode} onChange={update} />
                      <Field label="Nazione" name="country" value={form.country} onChange={update} />
                      <Field label="Problemi incontrati" name="problems" type="textarea" value={form.problems} onChange={update} />
                      <Field label="Esperienze positive" name="positiveExperiences" type="textarea" value={form.positiveExperiences} onChange={update} />
                    </div>
                  </fieldset>
                  <fieldset className="patient-detail-section">
                    <legend>Sezione 3 — Dichiarazione CAS</legend>
                    <p className="text-secondary small">Con il salvataggio si dichiara che le persone indicate hanno consentito alla raccolta e alla gestione dei propri dati personali da parte del CAS.</p>
                    <div className="row g-3">
                      <Field label="Nome CAS" name="casName" value={form.casName} onChange={update} required />
                      <Field label="Data della dichiarazione" name="declarationDate" type="date" value={form.declarationDate} onChange={update} required />
                      <Field label="Membro CAS" name="casMember" value={form.casMember} onChange={update} required />
                    </div>
                  </fieldset>
                </div>
                <div className="card-footer d-flex align-items-center gap-2 flex-wrap">
                  {isEditing && <button className="btn btn-outline-danger me-auto" type="button" onClick={handleDelete}>Elimina</button>}
                  {isEditing && <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>Annulla</button>}
                  <button className="btn btn-outline-primary" type="button" onClick={handleSaveAndOpen}>Salva e apri HLC-33-I</button>
                  <button className="btn btn-primary" type="submit">{isEditing ? "Salva modifiche" : "Crea"}</button>
                </div>
              </form>
            </section>
          </div>
          <section className="card">
            <div className="card-header mobile-list-header"><h2 className="card-title">Elenco presentazioni</h2></div>
            <div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0 mobile-card-table presentation-list-table">
              <thead><tr><th>Data</th><th>Evento</th><th>Tipo</th><th>Presenti</th><th>Struttura</th><th className="text-end">Azioni</th></tr></thead>
              <tbody>{visiblePresentations.length === 0 ? <tr><td className="text-center text-secondary py-4" colSpan="6">Nessuna presentazione inserita.</td></tr> : presentationPagination.pageItems.map((item) => (
                <tr className="presentation-clickable-row" key={item.id} role="button" tabIndex="0" onClick={() => handleEdit(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleEdit(item); } }}><td data-label="Data">{item.presentationDate ? new Intl.DateTimeFormat("it-IT").format(new Date(`${item.presentationDate}T00:00:00`)) : "-"}</td><td className="fw-medium" data-label="Evento">{item.event}</td><td data-label="Tipo">{item.presentationTypes?.join(", ") || "-"}</td><td data-label="Presenti">{item.attendeesCount || "-"}</td><td data-label="Struttura">{item.facility || "-"}</td><td className="text-end" data-label="Azioni"><button className="btn btn-outline-primary btn-sm" type="button" onClick={(event) => { event.stopPropagation(); handleEdit(item); }}>Modifica</button></td></tr>
              ))}</tbody>
            </table></div><PaginationControls {...presentationPagination} /></div>
          </section>
        </div>
      </div>
    </>
  );
};
