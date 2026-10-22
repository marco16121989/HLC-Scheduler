import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ContactActionIcon = ({ action }) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {action === "call" ? <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z" />
    : action === "edit" ? <><path d="m16 3 5 5L9 20l-5 1 1-5Z" /><path d="m14 5 5 5" /></>
      : action === "view" ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>
      : <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
</svg>;

export const PatientPhoneNumbers = ({ patientName = "Paziente", patientPhone = "", elderName = "", elderPhone = "", contacts = [], assignedDoctor = null, userRole, onPatientPhoneChange, onElderChange, onContactsChange, readOnly = false }) => {
  const items = Array.isArray(contacts) ? contacts : [];
  const visibleDoctor = ["Presidente", "CAS"].includes(userRole) ? assignedDoctor : null;
  const [draft, setDraft] = useState(null);
  const viewingOnly = readOnly || draft?.kind === "doctor";
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deleteDialog = useRef(null);
  const firstInput = useRef(null);
  const trigger = useRef(null);
  const close = () => { if (saving) return; setDraft(null); setError(""); trigger.current?.focus(); };
  const open = value => {
    if (saving) return;
    trigger.current = document.activeElement;
    setError("");
    setDraft(value);
  };
  useEffect(() => {
    if (!draft) return undefined;
    firstInput.current?.focus();
    const onKeyDown = event => {
      if (event.key === "Escape") {
        if (deleteTarget) return;
        event.preventDefault(); event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [Boolean(draft), Boolean(deleteTarget), saving]);

  useEffect(() => {
    if (deleteTarget && deleteDialog.current && !deleteDialog.current.open) deleteDialog.current.showModal();
  }, [deleteTarget]);

  const save = async event => {
    event.preventDefault();
    event.stopPropagation();
    if (viewingOnly || saving) return;
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    if (!name || !phone) { setError("Inserisci nome e numero di telefono."); return; }
    setSaving(true); setError("");
    try {
      if (draft.kind === "patient") await onPatientPhoneChange(phone);
      else if (draft.kind === "elder") await onElderChange({ elderName: name, elderPhone: phone });
      else if (draft.index === null) await onContactsChange([...items, { id: crypto.randomUUID(), name, phone }]);
      else await onContactsChange(items.map((item, index) => index === draft.index ? { ...item, name, phone } : item));
      setDraft(null); trigger.current?.focus();
    } catch (saveError) { setError(saveError.reason || saveError.message || "Impossibile salvare il numero. Riprova."); }
    finally { setSaving(false); }
  };
  const remove = (contact) => {
    if (readOnly || saving || contact.kind === "doctor") return;
    setError("");
    setDeleteTarget(contact);
  };
  const confirmRemove = async () => {
    if (readOnly || saving || !deleteTarget || deleteTarget.kind === "doctor") return;
    const contact = deleteTarget;
    setSaving(true); setError("");
    try {
      if (contact.kind === "patient") await onPatientPhoneChange("", true);
      else if (contact.kind === "elder") await onElderChange({ elderPhone: "" }, true);
      else await onContactsChange(items.filter((_, index) => index !== contact.index), true);
      setDeleteTarget(null); setDraft(null); trigger.current?.focus();
    } catch (saveError) { setError(saveError.reason || saveError.message || "Impossibile rimuovere il numero. Riprova."); }
    finally { setSaving(false); }
  };
  const callButton = (name, phone) => phone && <a className="btn btn-outline-primary btn-sm" href={`tel:${String(phone).replace(/[^\d+*#]/g, "")}`} aria-label={`Chiama ${name}`} title="Chiama"><ContactActionIcon action="call" /></a>;
  const viewButton = (name, value) => <button className="btn btn-outline-secondary btn-sm patient-phone-view-action" type="button" disabled={saving} onClick={() => open(value)} aria-label={`${readOnly || value.kind === "doctor" ? "Visualizza" : "Modifica"} numero di ${name}`} title={readOnly || value.kind === "doctor" ? "Visualizza numero" : "Modifica numero"}><ContactActionIcon action={value.kind === "doctor" ? "view" : "edit"} /></button>;
  const row = (name, phone, value, referenceLabel) => <>
    <span className="patient-phone-info">
    <span className="patient-phone-contact-name">
    {readOnly ? <strong>{name}</strong> : <button className="btn btn-link p-0 text-start text-decoration-none fw-semibold patient-phone-name" type="button" disabled={saving} onClick={() => open(value)} aria-label={`Modifica numero di ${name}`}>{name}</button>}
    {referenceLabel && <span className="badge text-bg-secondary patient-phone-reference">{referenceLabel}</span>}
    </span>
    <span className="patient-phone-separator" aria-hidden="true">—</span>
    {phone ? <a className="patient-phone-number" href={`tel:${String(phone).replace(/[^\d+*#]/g, "")}`}>{phone}</a> : <span className="patient-phone-number text-secondary">Numero non inserito</span>}
    </span>
    <span className="patient-phone-actions">
      {callButton(name, phone)}
      {viewButton(name, value)}
      {!readOnly && <><button className="btn btn-outline-secondary btn-sm patient-phone-edit-action" type="button" disabled={saving} onClick={() => open(value)} aria-label={`Modifica contatto ${name}`} title="Modifica"><ContactActionIcon action="edit" /></button>
        {(phone || value.kind === "contact") && <button className="btn btn-outline-danger btn-sm patient-phone-delete-action" type="button" disabled={saving} onClick={() => remove(value)} aria-label={`Elimina numero di ${name}`} title="Elimina"><ContactActionIcon action="delete" /></button>}</>}
    </span>
  </>;

  return <div className="w-100">
    {error && !draft && !deleteTarget && <div className="alert alert-danger py-2" role="alert">{error}</div>}
    <ul className="list-unstyled mb-3 patient-phone-list">
      <li>{row(patientName, patientPhone, { kind: "patient", name: patientName, phone: patientPhone }, "Numero paziente")}</li>
      {(elderName || elderPhone) && <li>{row(elderName || "Anziano", elderPhone, { kind: "elder", name: elderName || "Anziano", phone: elderPhone }, "Anziano di riferimento")}</li>}
      {visibleDoctor && <li>
        <span className="patient-phone-info">
        <strong>{[visibleDoctor.firstName, visibleDoctor.lastName].filter(Boolean).join(" ") || "Medico assegnato"}</strong>
        <span className="badge text-bg-secondary">Medico assegnato</span>
        <span className="patient-phone-separator" aria-hidden="true">—</span>
        {visibleDoctor.phone ? <a className="patient-phone-number" href={`tel:${String(visibleDoctor.phone).replace(/[^\d+*#]/g, "")}`}>{visibleDoctor.phone}</a> : <span className="patient-phone-number text-secondary">Numero non inserito</span>}
        </span>
        <span className="patient-phone-actions">{callButton("il medico assegnato", visibleDoctor.phone)}{viewButton("il medico assegnato", { kind: "doctor", name: [visibleDoctor.firstName, visibleDoctor.lastName].filter(Boolean).join(" ") || "Medico assegnato", phone: visibleDoctor.phone || "" })}</span>
      </li>}
      {items.map((contact, index) => <li key={contact.id || index}>{row(contact.name, contact.phone, { kind: "contact", index, name: contact.name || "", phone: contact.phone || "" })}</li>)}
    </ul>
    {!readOnly && <button className="btn btn-outline-primary" type="button" disabled={saving} onClick={() => open({ kind: "contact", index: null, name: "", phone: "" })}>Aggiungi numero</button>}
    {draft && createPortal(<>
      <button className="entity-modal-backdrop patient-phone-editor-backdrop" type="button" aria-label="Chiudi numero di telefono" onClick={close} />
      <div className="entity-modal-shell patient-phone-editor-shell" role="dialog" aria-modal="true" aria-labelledby="patient-phone-editor-title">
        <section className="card entity-modal-card entity-modal-card-sm">
          <div className="card-header d-flex align-items-center gap-2"><h3 className="card-title mb-0" id="patient-phone-editor-title">{draft.index === null && !viewingOnly ? "Aggiungi numero" : "Numero di telefono"}</h3><button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={close} disabled={saving} /></div>
          <form onSubmit={save}>
            <div className="card-body">
              {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
              <div className="mb-3"><label className="form-label" htmlFor="patient-phone-editor-name">Nome</label><input ref={draft.kind === "patient" || viewingOnly ? undefined : firstInput} className="form-control" id="patient-phone-editor-name" value={draft.name} readOnly={draft.kind === "patient" || viewingOnly} disabled={saving} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} autoComplete="off" required /></div>
              <div><label className="form-label" htmlFor="patient-phone-editor-number">Numero di telefono</label><input ref={draft.kind === "patient" || viewingOnly ? firstInput : undefined} className="form-control" id="patient-phone-editor-number" type="tel" value={draft.phone} readOnly={viewingOnly} disabled={saving} onChange={event => setDraft(current => ({ ...current, phone: event.target.value }))} autoComplete="off" required /></div>
            </div>
            <div className="card-footer d-flex flex-wrap justify-content-end gap-2">
              {!viewingOnly && ((draft.kind === "contact" && draft.index !== null) || (draft.kind === "patient" && patientPhone) || (draft.kind === "elder" && elderPhone)) && <button className="btn btn-outline-danger me-auto" type="button" disabled={saving} onClick={() => remove(draft)}>Elimina</button>}
              {!viewingOnly && <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Salvataggio…" : draft.index === null ? "Aggiungi" : "Conferma"}</button>}
            </div>
          </form>
        </section>
      </div>
    </>, document.body)}
    {deleteTarget && !readOnly && createPortal(<dialog ref={deleteDialog} className="patient-phone-delete-dialog" aria-labelledby="phone-delete-title" aria-describedby="phone-delete-description" onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!saving) setDeleteTarget(null); }}>
      <div className="card border-0 mb-0">
        <div className="card-header d-flex align-items-center gap-2"><h3 className="card-title mb-0" id="phone-delete-title">Elimina numero di telefono</h3><button className="btn-close ms-auto" type="button" autoFocus aria-label="Chiudi conferma eliminazione" disabled={saving} onClick={() => setDeleteTarget(null)} /></div>
        <div className="card-body"><p id="phone-delete-description">Vuoi eliminare il numero di <strong>{deleteTarget.name}</strong>?</p><p className="mb-0">{deleteTarget.phone}</p>{error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}</div>
        <div className="card-footer d-flex justify-content-end gap-2"><button className="btn btn-danger" type="button" disabled={saving} onClick={confirmRemove}>{saving ? "Eliminazione…" : "Elimina numero"}</button></div>
      </div>
    </dialog>, document.body)}

  </div>;
};
