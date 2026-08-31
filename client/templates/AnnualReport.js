import { useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { AnnualReportsCollection } from "/imports/api/links";
import { createAnnualReportPdf } from "../utils/createAnnualReportPdf.js";
import { confirmAction } from "./ConfirmDialog.js";

const SPECIALIZATION_COLUMNS = [
  ["Anestesiologia", "Cardiochirurgia", "Centro ustioni", "Chirurgia colorettale", "Chirurgia generale", "Chirurgia orale e maxillo-facciale", "Chirurgia ortopedica", "Chirurgia toracica", "Chirurgia traumatologica", "Chirurgia vascolare", "Ematologia", "Gastroenterologia", "Ginecologia", "Ginecologia oncologica", "Medicina d’urgenza", "Medicina interna"],
  ["Medicina ospedaliera", "Medico del travaglio", "Medico notturno", "Nefrologia", "Neonatologia", "Neurochirurgia", "Oncologia", "Ostetricia", "Otorinolaringoiatria e Chirurgia della testa e del collo", "Perinatologia (gravidanze ad alto rischio)", "Pneumologia", "Radiologia interventistica", "Terapia intensiva/Rianimazione", "Trapianti", "Urologia", "Altro"],
];
const normalizeSpecialization = (value) => String(value || "").replaceAll("'", "’").trim().toLocaleLowerCase("it");
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => value ? new Intl.DateTimeFormat("it-IT").format(new Date(`${value}T00:00:00`)) : "-";

export const AnnualReport = ({ presentations, users, currentUser, presidentId }) => {
  const currentYear = new Date().getFullYear();
  const reports = useTracker(() => AnnualReportsCollection.find({ presidentId }, { sort: { year: -1 } }).fetch(), [presidentId]);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingReportId, setEditingReportId] = useState(null);
  const [sentAt, setSentAt] = useState(null);
  const organizationUsers = users.filter((user) => (user.role === "Presidente" ? user.id : user.presidentId || user.associationId) === presidentId && !user.disabled);
  const president = organizationUsers.find((user) => user.role === "Presidente");
  const availableYears = useMemo(() => Array.from(new Set([currentYear, ...presentations.filter((item) => item.presidentId === presidentId && item.presentationDate).map((item) => Number(String(item.presentationDate).slice(0, 4))).filter(Number.isInteger)])).sort((a, b) => b - a), [presentations, presidentId, currentYear]);

  const buildDraft = (year) => {
    const yearText = String(year);
    const yearPresentations = presentations.filter((item) => item.presidentId === presidentId && String(item.presentationDate || "").slice(0, 4) === yearText);
    const specializationTotals = {};
    yearPresentations.forEach((item) => {
      const key = normalizeSpecialization(item.attendeeSpecialization || "Altro");
      specializationTotals[key] = (specializationTotals[key] || 0) + (Number(item.attendeesCount) || 0);
    });
    return {
      year: yearText,
      casName: president?.casMembership || yearPresentations.find((item) => item.casName)?.casName || president?.username || "-",
      casMemberCount: organizationUsers.filter((user) => ["Presidente", "CAS"].includes(user.role)).length,
      gvpMemberCount: organizationUsers.filter((user) => user.role === "GVP").length,
      presentationCount: yearPresentations.length,
      specializationTotals,
      significantIssues: "",
      reportDate: today(),
      casMember: currentUser.username || "",
    };
  };
  const openNew = () => {
    const firstUnsavedYear = availableYears.find((year) => !reports.some((report) => report.year === String(year))) || currentYear;
    setDraft(buildDraft(firstUnsavedYear)); setEditingReportId(null); setSentAt(null); setError(""); setModalOpen(true);
  };
  const openSaved = (report) => {
    setDraft({ year: report.year, casName: report.casName, casMemberCount: report.casMemberCount, gvpMemberCount: report.gvpMemberCount, presentationCount: report.presentationCount, specializationTotals: report.specializationTotals || {}, significantIssues: report.significantIssues || "", reportDate: report.reportDate || today(), casMember: report.casMember || currentUser.username || "" });
    setEditingReportId(report._id); setSentAt(report.sentAt || null); setError(""); setModalOpen(true);
  };
  const closeModal = () => { if (!saving) { setModalOpen(false); setDraft(null); setEditingReportId(null); setSentAt(null); setError(""); } };
  const update = (name, value) => { if (name === "year") setDraft(buildDraft(value)); else setDraft((current) => ({ ...current, [name]: value })); setError(""); };
  const pdfFor = (report) => createAnnualReportPdf({ ...report, specializationColumns: SPECIALIZATION_COLUMNS, totalFor: (specialization) => report.specializationTotals?.[normalizeSpecialization(specialization)] || 0 });
  const download = async (report) => {
    const url = await pdfFor(report);
    const link = document.createElement("a"); link.href = url; link.download = `rapporto-annuale-CAS-${report.year}.pdf`; link.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const saveAndDownload = async () => {
    if (!draft.reportDate || !draft.casMember.trim()) return setError("Completa data e membro CAS.");
    setSaving(true); setError("");
    try {
      await new Promise((resolve, reject) => Meteor.call("hlc.saveAnnualReport", draft, (methodError) => methodError ? reject(methodError) : resolve()));
      await download(draft); setModalOpen(false); setDraft(null);
    } catch (saveError) { setError(saveError.reason || saveError.message || "Impossibile salvare il rapporto."); }
    finally { setSaving(false); }
  };
  const markAsSent = async () => {
    if (!editingReportId || sentAt) return;
    const confirmed = await confirmAction(
      "Confermi che il rapporto è stato inviato alla filiale? Dopo la conferma non sarà più possibile modificarlo.",
      { title: "Conferma invio", confirmLabel: "Conferma invio", tone: "success" },
    );
    if (!confirmed) return;
    setSaving(true); setError("");
    try {
      await new Promise((resolve, reject) => Meteor.call("hlc.markAnnualReportAsSent", editingReportId, (methodError) => methodError ? reject(methodError) : resolve()));
      setSentAt(new Date());
    } catch (sendError) { setError(sendError.reason || sendError.message || "Impossibile contrassegnare il rapporto come inviato."); }
    finally { setSaving(false); }
  };
  const deleteReport = async (report) => {
    if (!await confirmAction(`Eliminare il rapporto annuale ${report.year}?`)) return;
    try {
      await new Promise((resolve, reject) => Meteor.call("hlc.deleteAnnualReport", report._id, (methodError) => methodError ? reject(methodError) : resolve()));
    } catch (deleteError) {
      globalThis.alert(deleteError.reason || deleteError.message || "Impossibile eliminare il rapporto.");
    }
  };

  return <>
    <div className="app-content-header"><div className="container-fluid d-flex align-items-center justify-content-between gap-3"><div><h1 className="mb-1">Rapporto annuale CAS</h1><p className="text-secondary mb-0">Crea e consulta l’archivio dei rapporti annuali.</p></div><button className="btn btn-primary" type="button" onClick={openNew}>Crea rapporto</button></div></div>
    <div className="app-content"><div className="container-fluid"><section className="card"><div className="card-header"><h2 className="card-title">Rapporti salvati</h2></div><div className="card-body p-0"><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Anno</th><th>Data</th><th>Membro CAS</th><th>Inviato alla filiale da</th><th>Ultimo aggiornamento</th><th className="text-end">Azioni</th></tr></thead><tbody>{reports.length ? reports.map((report) => <tr key={report._id}><td><strong>{report.year}</strong></td><td>{formatDate(report.reportDate)}</td><td>{report.casMember}</td><td>{report.sentByName || "-"}</td><td>{report.updatedAt ? new Date(report.updatedAt).toLocaleString("it-IT") : "-"}</td><td className="text-end"><div className="d-inline-flex gap-2"><button className="btn btn-outline-primary btn-sm" type="button" onClick={() => openSaved(report)}>Apri</button><button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => download(report).catch((pdfError) => globalThis.alert(pdfError.message || "Impossibile creare il PDF."))}>Scarica</button><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteReport(report)}>Elimina</button></div></td></tr>) : <tr><td className="text-center text-secondary py-5" colSpan="6">Nessun rapporto salvato. Usa “Crea rapporto” per generare il primo.</td></tr>}</tbody></table></div></div></section></div></div>
    {modalOpen && draft && <><button className="entity-modal-backdrop" type="button" aria-label="Chiudi finestra" onClick={closeModal} /><div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="annual-report-modal-title"><section className="card entity-modal-card annual-report-modal"><div className="card-header d-flex align-items-center"><h2 className="card-title" id="annual-report-modal-title">Rapporto annuale {draft.year}</h2>{sentAt && <span className="badge text-bg-success ms-3">Inviato alla filiale</span>}<button className="btn-close ms-auto" type="button" aria-label="Chiudi" disabled={saving} onClick={closeModal} /></div><div className="card-body">{error && <div className="alert alert-danger py-2">{error}</div>}{sentAt && <div className="alert alert-info py-2">Rapporto inviato alla filiale: non è più modificabile.</div>}<fieldset disabled={Boolean(sentAt)}><div className="row g-3 mb-3"><div className="col-12 col-md-4"><label className="form-label" htmlFor="annual-report-year">Anno</label><select className="form-select" id="annual-report-year" value={draft.year} onChange={(event) => update("year", event.target.value)}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></div></div><article className="annual-report-sheet"><h2>RAPPORTO ANNUALE DEL COMITATO DI ASSISTENZA SANITARIA</h2><section className="annual-report-section"><h3>SEZIONE 1</h3><div className="annual-report-section-one"><div><span>Nome CAS:</span><strong>{draft.casName}</strong></div><div><span>Numero di membri CAS:</span><strong>{draft.casMemberCount}</strong></div><div><span>Numero di presentazioni significative effettuate:</span><strong>{draft.presentationCount}</strong></div><div><span>Numero di membri GVP:</span><strong>{draft.gvpMemberCount}</strong></div></div></section><section className="annual-report-section"><h3>SEZIONE 2 <small>(Totali di medici per specializzazione.)</small></h3><div className="annual-report-specializations">{SPECIALIZATION_COLUMNS.map((column, columnIndex) => <div className="annual-report-specialization-column" key={columnIndex}>{column.map((specialization) => <div className="annual-report-specialization" key={specialization}><span>{specialization}:</span><strong>{draft.specializationTotals[normalizeSpecialization(specialization)] || 0}</strong></div>)}</div>)}</div></section><section className="annual-report-section"><h3>SEZIONE 3 <small>(Questioni significative e azioni intraprese.)</small></h3><div className="p-3"><textarea className="form-control" rows="6" value={draft.significantIssues} onChange={(event) => update("significantIssues", event.target.value)} placeholder="Indica le questioni affrontate e cosa è stato fatto per gestirle. Se non ce ne sono state, scrivi “Nessuna”." /></div></section><section className="annual-report-section"><h3>SEZIONE 4</h3><div className="annual-report-section-four"><label htmlFor="annual-report-date"><span>Data:</span><input className="form-control" id="annual-report-date" type="date" value={draft.reportDate} onChange={(event) => update("reportDate", event.target.value)} /></label><label htmlFor="annual-report-member"><span>Membro CAS:</span><input className="form-control" id="annual-report-member" value={draft.casMember} onChange={(event) => update("casMember", event.target.value)} /></label></div></section></article></fieldset></div><div className="card-footer d-flex flex-wrap justify-content-end gap-2"><button className="btn btn-outline-secondary" type="button" disabled={saving} onClick={closeModal}>Chiudi</button>{!sentAt && <button className="btn btn-outline-success" type="button" disabled={saving || !editingReportId} title={!editingReportId ? "Salva prima il rapporto" : undefined} onClick={markAsSent}>Inviato alla filiale</button>}{!sentAt && <button className="btn btn-primary" type="button" disabled={saving} onClick={saveAndDownload}>{saving ? "Salvataggio…" : "Salva e scarica"}</button>}{sentAt && <button className="btn btn-primary" type="button" disabled={saving} onClick={() => download(draft)}>Scarica</button>}</div></section></div></>}
  </>;
};
