import { useMemo, useState } from "react";
import { createAnnualReportPdf } from "../utils/createAnnualReportPdf.js";

const SPECIALIZATION_COLUMNS = [
  [
    "Anestesiologia", "Cardiochirurgia", "Centro ustioni", "Chirurgia colorettale",
    "Chirurgia generale", "Chirurgia orale e maxillo-facciale", "Chirurgia ortopedica",
    "Chirurgia toracica", "Chirurgia traumatologica", "Chirurgia vascolare", "Ematologia",
    "Gastroenterologia", "Ginecologia", "Ginecologia oncologica", "Medicina d’urgenza", "Medicina interna",
  ],
  [
    "Medicina ospedaliera", "Medico del travaglio", "Medico notturno", "Nefrologia", "Neonatologia",
    "Neurochirurgia", "Oncologia", "Ostetricia", "Otorinolaringoiatria e Chirurgia della testa e del collo",
    "Perinatologia (gravidanze ad alto rischio)", "Pneumologia", "Radiologia interventistica",
    "Terapia intensiva/Rianimazione", "Trapianti", "Urologia", "Altro",
  ],
];

const normalizeSpecialization = (value) => String(value || "")
  .replaceAll("'", "’")
  .trim()
  .toLocaleLowerCase("it");

export const AnnualReport = ({ presentations, users, currentUser, presidentId }) => {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [downloading, setDownloading] = useState(false);
  const organizationUsers = users.filter((user) =>
    (user.role === "Presidente" ? user.id : user.presidentId || user.associationId) === presidentId && !user.disabled);
  const president = organizationUsers.find((user) => user.role === "Presidente");
  const filteredPresentations = useMemo(() => presentations.filter((item) => {
    if (item.presidentId !== presidentId || !item.presentationDate) return false;
    return (!startDate || item.presentationDate >= startDate) && (!endDate || item.presentationDate <= endDate);
  }), [presentations, presidentId, startDate, endDate]);
  const specializationTotals = useMemo(() => {
    const totals = new Map();
    filteredPresentations.forEach((item) => {
      const key = normalizeSpecialization(item.attendeeSpecialization || "Altro");
      totals.set(key, (totals.get(key) || 0) + (Number(item.attendeesCount) || 0));
    });
    return totals;
  }, [filteredPresentations]);
  const totalFor = (specialization) => specializationTotals.get(normalizeSpecialization(specialization)) || 0;
  const casMemberCount = organizationUsers.filter((user) => ["Presidente", "CAS"].includes(user.role)).length;
  const gvpMemberCount = organizationUsers.filter((user) => user.role === "GVP").length;
  const casName = president?.casMembership || filteredPresentations.find((item) => item.casName)?.casName || president?.username || "-";
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const url = await createAnnualReportPdf({
        casName,
        casMemberCount,
        gvpMemberCount,
        presentationCount: filteredPresentations.length,
        specializationColumns: SPECIALIZATION_COLUMNS,
        totalFor,
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = `rapporto-annuale-${startDate || "inizio"}-${endDate || "fine"}.pdf`;
      link.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      globalThis.alert(error?.message || "Impossibile creare il PDF del rapporto.");
    } finally {
      setDownloading(false);
    }
  };

  return <>
    <div className="app-content-header annual-report-controls"><div className="container-fluid"><div className="d-flex flex-wrap align-items-start justify-content-between gap-3"><div><h1 className="mb-1">Rapporto annuale CAS</h1><p className="text-secondary mb-0">Genera il rapporto usando i dati registrati nel periodo scelto.</p></div><button className="btn btn-primary" type="button" disabled={downloading} onClick={downloadPdf}>{downloading ? "Creazione PDF…" : "Scarica PDF"}</button></div></div></div>
    <div className="app-content"><div className="container-fluid">
      <section className="card annual-report-filters"><div className="card-body"><div className="row g-3 align-items-end"><div className="col-12 col-md-4"><label className="form-label" htmlFor="annual-report-start">Dal</label><input className="form-control" id="annual-report-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div className="col-12 col-md-4"><label className="form-label" htmlFor="annual-report-end">Al</label><input className="form-control" id="annual-report-end" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div><div className="col-12 col-md-4"><div className="text-secondary">Periodo selezionato</div><strong>{startDate && endDate ? `${new Intl.DateTimeFormat("it-IT").format(new Date(`${startDate}T00:00:00`))} – ${new Intl.DateTimeFormat("it-IT").format(new Date(`${endDate}T00:00:00`))}` : "Intervallo libero"}</strong></div></div></div></section>
      <article className="annual-report-sheet">
        <h2>RAPPORTO ANNUALE DEL COMITATO DI ASSISTENZA SANITARIA</h2>
        <section className="annual-report-section">
          <h3>SEZIONE 1</h3>
          <div className="annual-report-section-one"><div><span>Nome CAS:</span><strong>{casName}</strong></div><div><span>Numero di membri CAS:</span><strong>{casMemberCount}</strong></div><div><span>Numero di presentazioni significative effettuate:</span><strong>{filteredPresentations.length}</strong></div><div><span>Numero di membri GVP:</span><strong>{gvpMemberCount}</strong></div></div>
        </section>
        <section className="annual-report-section">
          <h3>SEZIONE 2 <small>(Indicare i totali di medici per specializzazione.)</small></h3>
          <div className="annual-report-specializations">{SPECIALIZATION_COLUMNS.map((column, columnIndex) => <div className="annual-report-specialization-column" key={columnIndex}>{column.map((specialization) => <div className="annual-report-specialization" key={specialization}><span>{specialization}:</span><strong>{totalFor(specialization)}</strong></div>)}</div>)}</div>
        </section>
        <footer>Periodo: {startDate || "inizio non specificato"} – {endDate || "fine non specificata"} · Generato da {currentUser.username}</footer>
      </article>
    </div></div>
  </>;
};
