import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { createPopulatedPatientPdf } from "../utils/populatePatientPdf.js";
import { createSimplifiedPatientPdf } from "../utils/populateSimplifiedPatientPdf.js";

const getToday = () => new Date().toISOString().slice(0, 10);

const getPatientGvpIds = (patient) =>
  Array.isArray(patient?.gvpIds)
    ? patient.gvpIds
    : patient?.gvpId
      ? [patient.gvpId]
      : [];

const getGvpNotes = (patient) => {
  if (Array.isArray(patient?.gvpNotes)) return patient.gvpNotes;
  if (typeof patient?.gvpNotes === "string" && patient.gvpNotes.trim()) {
    return [{ id: "legacy", text: patient.gvpNotes, author: "GVP", authorRole: "GVP", createdAt: null }];
  }
  return [];
};

const getNoteRoleBadgeClass = (role) =>
  role === "Presidente"
    ? "text-bg-primary"
    : role === "CAS"
      ? "text-bg-success"
      : "text-bg-warning";

export const DETAIL_SECTIONS = [
  {
    title: "Notifica emergenza sanitaria",
    fields: [
      ["callDateTime", "Data e ora della chiamata", "datetime-local"],
      ["callAuthor", "Autore della chiamata"],
      ["callAuthorContacts", "Recapiti dell’autore della chiamata", "tel"],
      ["requestedAssistance", "Assistenza richiesta dal paziente", "textarea"],
      ["relationshipToPatient", "Relazione con il paziente"],
    ],
  },
  {
    title: "Informazioni sul paziente e sull’ospedale",
    fields: [
      ["sex", "Sesso", "select", ["Maschile", "Femminile", "Altro / non specificato"]],
      ["age", "Età", "number"],
      ["patientComments", "Commenti sul paziente", "textarea"],
      ["isMinorOrNewborn", "Paziente minore o neonato?", "yesno"],
      ["fatherName", "Nome del padre"],
      ["fatherBaptized", "Padre battezzato?", "yesno"],
      ["fatherGoodStanding", "Padre in buona reputazione?", "yesno"],
      ["fatherDpaComplete", "DPA del padre completo?", "yesno"],
      ["motherName", "Nome della madre"],
      ["motherBaptized", "Madre battezzata?", "yesno"],
      ["familySituation", "Situazione familiare", "textarea"],
      ["hospitalName", "Nome dell’ospedale"],
      ["hospitalRoom", "Stanza"],
      ["hospitalPhone", "Telefono dell’ospedale", "tel"],
      ["congregation", "Congregazione"],
      ["localElders", "Anziani locali contattati"],
      ["localEldersPhones", "Numeri di telefono degli anziani", "tel"],
    ],
  },
  {
    title: "Dati del neonato",
    fields: [
      ["birthWeight", "Peso alla nascita"],
      ["apgarScore", "Punteggio APGAR"],
      ["gestationalAge", "Età gestazionale (settimane)", "number"],
      ["birthType", "Nascita"],
      ["birthDate", "Data di nascita", "date"],
      ["apgarFiveMinutes", "APGAR a 5 minuti"],
    ],
  },
  {
    title: "Quadro clinico",
    fields: [
      ["specificProblem", "Problema specifico / diagnosi attuale e relazione con il sangue", "textarea"],
      ["medicalHistory", "Anamnesi rilevante / causa della crisi attuale", "textarea"],
    ],
  },
  {
    title: "Informazioni per CAS — HLC-7-I semplificato",
    fields: [
      ["patientPhone", "Numero di cellulare del paziente", "tel"],
      ["healthProblems", "Problemi di salute", "textarea"],
      ["spiritualCondition", "Condizione spirituale", "textarea"],
      ["nonWitnessFamily", "Familiari non Testimoni coinvolti", "textarea"],
      ["datCompleted", "DAT compilata?", "yesno"],
      ["datRegistered", "DAT registrata?", "yesno"],
      ["elderName", "Nome dell’anziano"],
      ["elderEmail", "E-mail dell’anziano", "email"],
      ["elderPhone", "Cellulare dell’anziano", "tel"],
      ["simplifiedNotes", "Note per il CAS", "textarea"],
    ],
  },
  ...[1, 2, 3].map((index) => ({
    title: `Valori di laboratorio — analisi ${index}`,
    fields: [
      [`lab${index}DateTime`, "Data e ora dell’analisi", "datetime-local"],
      [`lab${index}Hemoglobin`, "Emoglobina (Hb g/dL)", "number-step"],
      [`lab${index}Hematocrit`, "Ematocrito (Hct %)", "number-step"],
      [`lab${index}Platelets`, "Numero piastrine (Plts/μL)", "number"],
      [`lab${index}Other`, "Altri valori"],
    ],
  })),
  {
    title: "Informazioni sui medici e programma terapeutico",
    fields: [
      ["attendingDoctor", "Medico curante"],
      ["attendingDoctorSpecialization", "Specializzazione del medico curante"],
      ["otherAttendingDoctor", "Altro medico curante"],
      ["otherDoctorSpecialization", "Specializzazione dell’altro medico"],
      ["treatmentPlan", "Esami, procedure o trattamenti proposti", "textarea"],
      ["staffInformed", "Personale informato della richiesta di assistenza del comitato sanitario?", "yesno"],
      ["legalActionThreatened", "È stata minacciata un’azione legale?", "yesno"],
    ],
  },
  {
    title: "Strategie, alternative e articoli medici",
    fields: [
      ["strategies", "Modalità, procedure o tecniche da proporre ai medici", "textarea"],
      ["medicalArticles", "Articoli e documentazione a supporto", "textarea"],
      ["doctorWillCooperate", "Il medico è disposto a cooperare?", "yesno"],
    ],
  },
  {
    title: "Consulto da medico a medico",
    fields: [
      ["consultAvailable", "Il medico curante accetta il consulto con uno specialista?", "yesno"],
      ["consultDoctorName", "Nome del medico da consultare"],
      ["consultContactMethod", "Metodo di contatto preferito"],
      ["consultSpecialization", "Specializzazione"],
      ["consultNotes", "Ulteriori informazioni sul consulto", "textarea"],
    ],
  },
  {
    title: "Richiesta di trasferimento",
    fields: [
      ["transferMethod", "Metodo di trasferimento", "textarea"],
      ["transferArrangementsConfirmed", "Accordi relativi al trasferimento confermati?", "yesno"],
      ["healthInformationContacted", "Reparto Informazione Sanitaria contattato?", "yesno"],
      ["transferHospital", "Nome dell’ospedale di trasferimento"],
      ["transferDoctor", "Medico curante presso l’ospedale di trasferimento"],
      ["transferHospitalPhone", "Numero dell’ospedale di trasferimento", "tel"],
      ["transferNotes", "Ulteriori informazioni sul trasferimento", "textarea"],
    ],
  },
  {
    title: "Risultato e interventi successivi",
    fields: [
      ["outcome", "Risultato ed eventuali interventi successivi", "textarea"],
      ["followUpElders", "Anziani locali contattati per interventi successivi", "textarea"],
    ],
  },
];

export const SIMPLIFIED_FIELDS = [
  ["congregation", "Congregazione"],
  ["age", "Età", "number"],
  ["patientPhone", "Numero di cellulare del paziente", "tel"],
  ["healthProblems", "Problemi di salute", "textarea"],
  ["spiritualCondition", "Condizione spirituale", "textarea"],
  ["nonWitnessFamily", "Familiari non Testimoni coinvolti", "textarea"],
  ["datCompleted", "DAT compilata?", "yesno"],
  ["datRegistered", "DAT registrata?", "yesno"],
  ["elderName", "Nome dell’anziano"],
  ["elderEmail", "E-mail dell’anziano", "email"],
  ["elderPhone", "Cellulare dell’anziano", "tel"],
  ["simplifiedNotes", "Note per il CAS", "textarea"],
];

const PatientDetailField = ({ field, value, onChange, disabled = false }) => {
  const [name, label, type = "text", options = []] = field;
  const common = {
    className: type === "select" || type === "yesno" ? "form-select" : "form-control",
    id: `patient-${name}`,
    value: value || "",
    disabled,
    onChange: (event) => onChange(name, event.target.value),
  };
  const columnClass = type === "textarea"
    ? "col-12"
    : ["date", "datetime-local", "number", "number-step", "yesno", "select"].includes(type)
      ? "col-12 col-sm-6 col-lg-3"
      : "col-12 col-md-6";

  return (
    <div className={columnClass}>
      <label className="form-label" htmlFor={common.id}>{label}</label>
      {type === "textarea" ? (
        <textarea {...common} rows="3" />
      ) : type === "select" || type === "yesno" ? (
        <select {...common}>
          <option value="">Seleziona</option>
          {(type === "yesno" ? ["Sì", "No", "Non noto"] : options).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input {...common} type={type === "number-step" ? "number" : type} step={type === "number-step" ? "0.01" : undefined} min={type === "number" || type === "number-step" ? "0" : undefined} />
      )}
    </div>
  );
};

export const formatSummaryValue = (value) => {
  if (value === null || value === undefined || value === "") return "Non compilato";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return String(value);
};

export const Patients = ({
  patients,
  setPatients,
  doctors,
  users,
  currentUser,
  presidentId,
}) => {
  const isGvp = currentUser.role === "GVP";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionType, setAdmissionType] = useState("emergency");
  const [admissionDate, setAdmissionDate] = useState(getToday);
  const [pathology, setPathology] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [casId, setCasId] = useState(
    currentUser.role === "CAS" ? currentUser.id : "",
  );
  const [gvpIds, setGvpIds] = useState([]);
  const [casFilter, setCasFilter] = useState(
    currentUser.role === "CAS" ? currentUser.id : "all",
  );
  const [gvpPatientScope, setGvpPatientScope] = useState("mine");
  const [notes, setNotes] = useState("");
  const [details, setDetails] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [gvpSelectionModalOpen, setGvpSelectionModalOpen] = useState(false);
  const [gvpSearch, setGvpSearch] = useState("");
  const [notePatient, setNotePatient] = useState(null);
  const [newGvpNote, setNewGvpNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [activeTab, setActiveTab] = useState("insertion");

  const isEditing = editingId !== null;
  const organizationPatients = patients.filter(
    (patient) => patient.presidentId === presidentId,
  );
  const visiblePatients = isGvp
    ? organizationPatients.filter((patient) => {
        const patientGvpIds = getPatientGvpIds(patient);
        const isMine = patientGvpIds.includes(currentUser.id) || patient.casId === currentUser.id;
        return gvpPatientScope === "all" ? true : isMine;
      })
    : currentUser.role === "CAS" && casFilter !== "all"
      ? organizationPatients.filter((patient) => patient.casId === casFilter)
      : organizationPatients;
  const currentNotePatient = notePatient
    ? visiblePatients.find((patient) => patient.id === notePatient.id) || notePatient
    : null;
  const visibleDoctors = doctors.filter(
    (doctor) => doctor.presidentId === presidentId,
  );
  const visibleCasUsers = users.filter(
    (user) =>
      user.role === "CAS" &&
      (user.presidentId || user.associationId) === presidentId,
  );
  const visibleGvpUsers = users.filter(
    (user) =>
      user.role === "GVP" &&
      (user.presidentId || user.associationId) === presidentId,
  );
  const getGvpDisplayName = (user) => {
    const firstName = user.firstName?.trim();
    const lastName = user.lastName?.trim();
    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(" ");
    }
    return user.username || "";
  };
  const normalizedGvpSearch = gvpSearch.trim().toLowerCase();
  const associatedGvpUsers = visibleGvpUsers.filter((user) => gvpIds.includes(user.id)).filter((user) => {
    if (!normalizedGvpSearch) return true;
    return `${getGvpDisplayName(user)}`.toLowerCase().includes(normalizedGvpSearch);
  });
  const unassociatedGvpUsers = visibleGvpUsers.filter((user) => !gvpIds.includes(user.id)).filter((user) => {
    if (!normalizedGvpSearch) return true;
    return `${getGvpDisplayName(user)}`.toLowerCase().includes(normalizedGvpSearch);
  });
  const editingPatientNotes = getGvpNotes(
    patients.find((patient) => patient.id === editingId),
  );

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setAdmissionType("emergency");
    setAdmissionDate(getToday());
    setPathology("");
    setDoctorId("");
    setCasId(currentUser.role === "CAS" ? currentUser.id : "");
    setGvpIds([]);
    setNotes("");
    setNewGvpNote("");
    setDetails({});
    setEditingId(null);
    setError("");
    setActiveTab("insertion");
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openGvpSelectionModal = () => {
    setError("");
    setGvpSelectionModalOpen(true);
  };

  const closeGvpSelectionModal = () => {
    setGvpSelectionModalOpen(false);
  };

  const toggleGvpSelection = (gvpUser) => {
    setGvpIds((current) => current.includes(gvpUser.id)
      ? current.filter((id) => id !== gvpUser.id)
      : [...current, gvpUser.id]);
    setError("");
  };

  const savePatient = () => {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPathology = pathology.trim();
    const normalizedNotes = notes.trim();
    const validDoctorId = visibleDoctors.some(
      (doctor) => doctor.id === doctorId,
    )
      ? doctorId
      : "";
    const validCasId = visibleCasUsers.some((user) => user.id === casId)
      ? casId
      : "";
    const validGvpIds = gvpIds.filter((gvpUserId) => users.some(
      (user) =>
        user.id === gvpUserId &&
        user.role === "GVP" &&
        (user.presidentId || user.associationId) === presidentId,
    ));

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !admissionDate ||
      !normalizedPathology
    ) {
      setError("Completa nome, cognome, patologia e data di ingresso.");
      return false;
    }

    const isDuplicate = patients.some(
      (patient) =>
        patient.firstName.toLowerCase() === normalizedFirstName.toLowerCase() &&
        patient.lastName.toLowerCase() === normalizedLastName.toLowerCase() &&
        patient.presidentId === presidentId &&
        patient.id !== editingId,
    );

    if (isDuplicate) {
      setError("Il paziente e gia presente.");
      return false;
    }

    const patientData = {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      admissionType:
        admissionType === "scheduled" ? "scheduled" : "emergency",
      admissionDate,
      pathology: normalizedPathology,
      doctorId: validDoctorId,
      casId: validCasId,
      gvpIds: validGvpIds,
      gvpId: validGvpIds[0] || "",
      notes: normalizedNotes,
      details,
      presidentId,
    };

    const savedPatient = {
      id: editingId || crypto.randomUUID(),
      ...patientData,
    };

    if (isEditing) {
      setPatients((current) =>
        current.map((patient) =>
          patient.id === editingId ? { ...patient, ...savedPatient } : patient,
        ),
      );
    } else {
      setPatients((current) => [...current, savedPatient]);
    }

    resetForm();
    return savedPatient;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    savePatient();
  };

  const handleOpenPdf = async () => {
    const savedPatient = savePatient();
    if (!savedPatient) return;

    const pdfWindow = globalThis.open("", "_blank");
    try {
      const doctor = doctors.find((item) => item.id === savedPatient.doctorId);
      const casUser = users.find((item) => item.id === savedPatient.casId);
      const pdfUrl = await createPopulatedPatientPdf({
        patient: savedPatient,
        doctorName: doctor ? `${doctor.lastName} ${doctor.firstName}` : "",
        casName: casUser?.username || "",
      });
      if (pdfWindow) {
        pdfWindow.location.href = pdfUrl;
      } else {
        globalThis.location.href = pdfUrl;
      }
      globalThis.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (pdfError) {
      pdfWindow?.close();
      globalThis.alert(pdfError.message || "Impossibile generare il PDF compilato.");
    }
  };

  const handleOpenSimplifiedPdf = async () => {
    const savedPatient = savePatient();
    if (!savedPatient) return;
    const pdfWindow = globalThis.open("", "_blank");
    try {
      const pdfUrl = await createSimplifiedPatientPdf(savedPatient);
      if (pdfWindow) {
        pdfWindow.location.href = pdfUrl;
      } else {
        globalThis.location.href = pdfUrl;
      }
      globalThis.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (pdfError) {
      pdfWindow?.close();
      globalThis.alert(pdfError.message || "Impossibile generare il PDF semplificato.");
    }
  };

  const handleEdit = (patient) => {
    setEditingId(patient.id);
    setFirstName(patient.firstName);
    setLastName(patient.lastName);
    setAdmissionType(
      patient.admissionType === "scheduled" ? "scheduled" : "emergency",
    );
    setAdmissionDate(patient.admissionDate || getToday());
    setPathology(patient.pathology || "");
    setDoctorId(patient.doctorId || "");
    setCasId(patient.casId || "");
    setGvpIds(getPatientGvpIds(patient));
    setNotes(patient.notes || "");
    setDetails(patient.details || {});
    setError("");
    setActiveTab("insertion");
    setModalOpen(true);
  };

  const handleDelete = () => {
    const patient = patients.find((item) => item.id === editingId);

    if (
      !patient ||
      !globalThis.confirm(
        `Eliminare il paziente ${patient.firstName} ${patient.lastName}?`,
      )
    ) {
      return;
    }

    setPatients((current) =>
      current.filter((item) => item.id !== editingId),
    );
    resetForm();
  };

  const openNotes = (patient) => {
    setNotePatient(patient);
    setNewGvpNote("");
    setNoteError("");
  };

  const closeNotes = () => {
    setNotePatient(null);
    setNewGvpNote("");
    setNoteError("");
  };

  const saveGvpNotes = () => {
    if (!notePatient || noteSaving || !newGvpNote.trim()) return;
    setNoteSaving(true);
    setNoteError("");
    Meteor.call("hlc.addPatientNote", notePatient.id, newGvpNote, (methodError) => {
      setNoteSaving(false);
      if (methodError) {
        setNoteError(methodError.reason || "Impossibile salvare le note.");
        return;
      }
      closeNotes();
    });
  };

  const deleteGvpNote = (note) => {
    if (!notePatient || note.authorId !== currentUser.id) return;
    if (!globalThis.confirm("Eliminare questa nota?")) return;
    setNoteError("");
    Meteor.call("hlc.deletePatientNote", notePatient.id, note.id, (methodError) => {
      if (methodError) {
        setNoteError(methodError.reason || "Impossibile eliminare la nota.");
      }
    });
  };

  const doctor = doctors.find((item) => item.id === doctorId);
  const selectedCasUser = users.find((item) => item.id === casId);
  const selectedGvpUsers = users.filter((item) => gvpIds.includes(item.id));

  const summaryEntries = [
    { label: "Nome", value: firstName },
    { label: "Cognome", value: lastName },
    { label: "Tipo di accesso", value: admissionType === "scheduled" ? "Ricovero programmato" : "Emergenza" },
    { label: "Data di accesso", value: admissionDate },
    { label: "Patologia", value: pathology },
    { label: "Medico responsabile", value: doctor ? `${doctor.lastName} ${doctor.firstName}` : "Non assegnato" },
    { label: "Note", value: notes },
    { label: "CAS", value: selectedCasUser?.username || "Non assegnato" },
    { label: "GVP assegnati", value: selectedGvpUsers.length > 0 ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ") : "Nessun GVP assegnato" },
    ...DETAIL_SECTIONS.flatMap((section) =>
      section.fields.map((field) => ({
        label: `${section.title} — ${field[1]}`,
        value: details[field[0]],
      })),
    ),
  ];

  const gvpSummaryEntries = [
    { label: "Nome", value: firstName },
    { label: "Cognome", value: lastName },
    { label: "Congregazione", value: details.congregation },
    { label: "Età", value: details.age },
    { label: "Numero di cellulare del paziente", value: details.patientPhone },
    { label: "Problemi di salute", value: details.healthProblems },
    { label: "Condizione spirituale", value: details.spiritualCondition },
    { label: "Familiari non Testimoni coinvolti", value: details.nonWitnessFamily },
    { label: "DAT compilata?", value: details.datCompleted },
    { label: "DAT registrata?", value: details.datRegistered },
    { label: "Nome dell’anziano", value: details.elderName },
    { label: "E-mail dell’anziano", value: details.elderEmail },
    { label: "Cellulare dell’anziano", value: details.elderPhone },
    { label: "Note per il CAS", value: details.simplifiedNotes },
  ];

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <h1 className="mb-0">Pazienti</h1>
            <div className="d-flex align-items-center gap-2">
              {isGvp && (
                <select className="form-select" aria-label="Filtra pazienti del GVP" value={gvpPatientScope} onChange={(event) => setGvpPatientScope(event.target.value)}>
                  <option value="mine">I miei pazienti</option>
                  <option value="all">Tutti i pazienti</option>
                </select>
              )}
              {!isGvp && currentUser.role === "CAS" && <select className="form-select" aria-label="Filtra pazienti per CAS" value={casFilter} onChange={(event) => setCasFilter(event.target.value)}>
                <option value={currentUser.id}>I miei pazienti</option>
                <option value="all">Tutti i pazienti</option>
                {visibleCasUsers.filter((casUser) => casUser.id !== currentUser.id).map((casUser) => <option key={casUser.id} value={casUser.id}>{casUser.username}</option>)}
              </select>}
              {!isGvp && <button className="btn btn-primary" type="button" onClick={openCreateModal}>Inserisci</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          {notePatient && <>
            <button className="entity-modal-backdrop" type="button" aria-label="Chiudi note" onClick={closeNotes} />
            <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="gvp-notes-title">
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title" id="gvp-notes-title">Note — {notePatient.lastName} {notePatient.firstName}</h2>
                  <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeNotes} />
                </div>
                <div className="card-body">
                  {noteError && <div className="alert alert-danger py-2" role="alert">{noteError}</div>}
                  <h3 className="h6">Note esistenti</h3>
                  {getGvpNotes(currentNotePatient).length === 0 ? <p className="text-secondary">Nessuna nota inserita.</p> : <div className="d-grid gap-2 mb-4">{getGvpNotes(currentNotePatient).map((note) => <article className="border rounded p-3" key={note.id}><div className="d-flex align-items-start justify-content-between gap-3"><p className="mb-1">{note.text}</p>{note.authorId === currentUser.id && <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteGvpNote(note)}>Elimina</button>}</div><div className="d-flex align-items-center gap-2"><span className={`badge ${getNoteRoleBadgeClass(note.authorRole)}`}>{note.authorRole || "GVP"}</span><small className="text-secondary">{note.author || "GVP"}{note.createdAt ? ` · ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(note.createdAt))}` : ""}</small></div></article>)}</div>}
                  <label className="form-label" htmlFor="gvp-patient-notes">Aggiungi una nota</label>
                  <textarea className="form-control" id="gvp-patient-notes" rows="5" value={newGvpNote} onChange={(event) => setNewGvpNote(event.target.value)} maxLength="4000" autoFocus />
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeNotes}>Annulla</button>
                  <button className="btn btn-primary" type="button" onClick={saveGvpNotes} disabled={noteSaving || !newGvpNote.trim()}>{noteSaving ? "Salvataggio…" : "Aggiungi nota"}</button>
                </div>
              </section>
            </div>
          </>}
          {modalOpen && (
            <button
              className="entity-modal-backdrop"
              type="button"
              aria-label="Chiudi finestra"
              onClick={resetForm}
            />
          )}
          <div
            className={modalOpen ? "entity-modal-shell" : "d-none"}
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-modal-title"
          >
            <section className="card entity-modal-card patient-modal-card">
              <div className="card-header">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <h2 className="card-title mb-0" id="patient-modal-title">
                    {isEditing ? "Modifica paziente" : "Inserisci paziente"}
                  </h2>
                  <button
                    className="btn-close"
                    type="button"
                    aria-label="Chiudi"
                    onClick={resetForm}
                  />
                </div>
                {!isGvp && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      onClick={handleOpenPdf}
                    >
                      Salva e apri HLC-7-I
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      onClick={handleOpenSimplifiedPdf}
                    >
                      Salva e apri HLC-7-I semplificato
                    </button>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmit}>
                <div className="card-body">
                  {!isGvp && (
                    <div className="nav nav-tabs mb-3" role="tablist">
                      <button
                        className={`nav-link ${activeTab === "summary" ? "active" : ""}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "summary"}
                        onClick={() => setActiveTab("summary")}
                      >
                        Riepilogo
                      </button>
                      <button
                        className={`nav-link ${activeTab === "insertion" ? "active" : ""}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "insertion"}
                        onClick={() => setActiveTab("insertion")}
                      >
                        Inserimento dati
                      </button>
                    </div>
                  )}

                  {isGvp ? (
                    <div className="patient-form-grid">
                      <div className="alert alert-light border mb-3" role="status">
                        Riepilogo delle informazioni disponibili per il GVP.
                      </div>
                      <div className="patient-summary-grid">
                        {gvpSummaryEntries.map((entry) => (
                          <div className="patient-summary-item" key={`${entry.label}-${entry.value}`}>
                            <div className="patient-summary-label">{entry.label}</div>
                            <div className="patient-summary-value">{formatSummaryValue(entry.value) || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : activeTab === "summary" ? (
                    <div className="patient-form-grid">
                      <div className="alert alert-light border mb-3" role="status">
                        Riepilogo dei dati inseriti per il paziente.
                      </div>
                      <div className="patient-summary-grid">
                        {summaryEntries.map((entry) => (
                          <div className="patient-summary-item" key={`${entry.label}-${entry.value}`}>
                            <div className="patient-summary-label">{entry.label}</div>
                            <div className="patient-summary-value">{formatSummaryValue(entry.value) || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="patient-form-grid">
                      <div className="patient-form-actions">
                        <button className="btn btn-primary" type="submit">
                          {isEditing ? "Salva modifiche" : "Inserisci"}
                        </button>
                      </div>
                      {error && (
                        <div className="alert alert-danger py-2" role="alert">
                          {error}
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="form-label" htmlFor="patient-first-name">
                          Nome
                        </label>
                        <input
                          className="form-control"
                          id="patient-first-name"
                          type="text"
                          value={firstName}
                          onChange={(event) => {
                            setFirstName(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <div>
                        <label className="form-label" htmlFor="patient-last-name">
                          Cognome
                        </label>
                        <input
                          className="form-control"
                          id="patient-last-name"
                          type="text"
                          value={lastName}
                          onChange={(event) => {
                            setLastName(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <fieldset className="mt-3 w-100">
                        <legend className="form-label">Tipo di accesso</legend>
                        <div className="btn-group w-100" role="group">
                          <input
                            className="btn-check"
                            id="patient-emergency"
                            name="admission-type"
                            type="radio"
                            checked={admissionType === "emergency"}
                            onChange={() => setAdmissionType("emergency")}
                          />
                          <label
                            className="btn btn-outline-danger"
                            htmlFor="patient-emergency"
                          >
                            Emergenza
                          </label>
                          <input
                            className="btn-check"
                            id="patient-scheduled"
                            name="admission-type"
                            type="radio"
                            checked={admissionType === "scheduled"}
                            onChange={() => setAdmissionType("scheduled")}
                          />
                          <label
                            className="btn btn-outline-primary"
                            htmlFor="patient-scheduled"
                          >
                            Ricovero programmato
                          </label>
                        </div>
                      </fieldset>

                      <div className="mt-3">
                        <label
                          className="form-label"
                          htmlFor="patient-admission-date"
                        >
                          Data di accesso
                        </label>
                        <input
                          className="form-control"
                          id="patient-admission-date"
                          type="date"
                          value={admissionDate}
                          onChange={(event) => {
                            setAdmissionDate(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <div className="mt-3">
                        <label className="form-label" htmlFor="patient-pathology">
                          Patologia
                        </label>
                        <input
                          className="form-control"
                          id="patient-pathology"
                          type="text"
                          value={pathology}
                          onChange={(event) => {
                            setPathology(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <div className="mt-3">
                        <label className="form-label" htmlFor="patient-doctor">
                          Medico responsabile
                        </label>
                        <select
                          className="form-select"
                          id="patient-doctor"
                          value={doctorId}
                          onChange={(event) => {
                            setDoctorId(event.target.value);
                            setError("");
                          }}
                        >
                          <option value="">Seleziona medico</option>
                          {visibleDoctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                              {doctor.lastName} {doctor.firstName}
                            </option>
                          ))}
                        </select>
                        {visibleDoctors.length === 0 && (
                          <div className="form-text">
                            Inserisci prima almeno un medico.
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <label className="form-label" htmlFor="patient-notes">
                          Note
                        </label>
                        <textarea
                          className="form-control"
                          id="patient-notes"
                          rows="3"
                          value={notes}
                          onChange={(event) => {
                            setNotes(event.target.value);
                            setError("");
                          }}
                        />
                      </div>

                      <div className="patient-assignment-row row g-3 align-items-start">
                        <div className="col-6">
                          <label className="form-label" htmlFor="patient-cas">
                            CAS
                          </label>
                          <select
                            className="form-select"
                            id="patient-cas"
                            value={casId}
                            onChange={(event) => {
                              setCasId(event.target.value);
                              setError("");
                            }}
                          >
                            <option value="">Seleziona CAS</option>
                            {visibleCasUsers.map((casUser) => (
                              <option key={casUser.id} value={casUser.id}>
                                {casUser.username}
                                {casUser.id === currentUser.id ? " (io)" : ""}
                              </option>
                            ))}
                          </select>
                          {visibleCasUsers.length === 0 && (
                            <div className="form-text">
                              Inserisci prima almeno un CAS.
                            </div>
                          )}
                        </div>

                        <div className="col-6">
                          <div className="d-flex align-items-center justify-content-between gap-2">
                            <div className="form-label mb-0">GVP assegnati</div>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              type="button"
                              onClick={openGvpSelectionModal}
                              disabled={visibleGvpUsers.length === 0}
                            >
                              {gvpIds.length > 0 ? "Modifica" : "Seleziona GVP"}
                            </button>
                          </div>
                          <div className="form-text mt-1">
                            {selectedGvpUsers.length > 0
                              ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ")
                              : "Nessun GVP associato."}
                          </div>
                          {gvpSelectionModalOpen && (
                            <>
                              <button
                                className="entity-modal-backdrop"
                                type="button"
                                aria-label="Chiudi selezione GVP"
                                onClick={closeGvpSelectionModal}
                              />
                              <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="gvp-selection-title">
                                <section className="card entity-modal-card">
                                  <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                    <h3 className="card-title mb-0" id="gvp-selection-title">Seleziona GVP</h3>
                                    <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeGvpSelectionModal} />
                                  </div>
                                  <div className="card-body">
                                    {visibleGvpUsers.length > 0 ? (
                                      <>
                                        <div className="mb-3">
                                          <label className="form-label" htmlFor="gvp-search">Cerca per nome</label>
                                          <input
                                            className="form-control"
                                            id="gvp-search"
                                            type="text"
                                            value={gvpSearch}
                                            onChange={(event) => setGvpSearch(event.target.value)}
                                            placeholder="Inserisci il nome"
                                          />
                                        </div>
                                        <div className="mb-3">
                                          <div className="small fw-semibold mb-2">Associati</div>
                                          {associatedGvpUsers.length > 0 ? (
                                            <div className="d-grid gap-2 border rounded p-3">
                                              {associatedGvpUsers.map((gvpUser) => (
                                                <label className="form-check" key={gvpUser.id}>
                                                  <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={gvpIds.includes(gvpUser.id)}
                                                    onChange={() => toggleGvpSelection(gvpUser)}
                                                  />
                                                  <span className="form-check-label">{getGvpDisplayName(gvpUser)}</span>
                                                </label>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="form-text">Nessun GVP associato.</div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="small fw-semibold mb-2">Non associati</div>
                                          {unassociatedGvpUsers.length > 0 ? (
                                            <div className="d-grid gap-2 border rounded p-3">
                                              {unassociatedGvpUsers.map((gvpUser) => (
                                                <label className="form-check" key={gvpUser.id}>
                                                  <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={gvpIds.includes(gvpUser.id)}
                                                    onChange={() => toggleGvpSelection(gvpUser)}
                                                  />
                                                  <span className="form-check-label">{getGvpDisplayName(gvpUser)}</span>
                                                </label>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="form-text">Tutti i GVP disponibili sono già associati.</div>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="form-text">Nessun GVP disponibile per questa presidenza.</div>
                                    )}
                                  </div>
                                  <div className="card-footer d-flex justify-content-end">
                                    <button className="btn btn-primary" type="button" onClick={closeGvpSelectionModal}>Chiudi</button>
                                  </div>
                                </section>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <hr className="my-4" />
                      <p className="text-secondary mb-3">
                        Campi della scheda HLC-7-I. Compila solo le sezioni pertinenti al caso.
                      </p>
                      {DETAIL_SECTIONS.map((section) => (
                        <fieldset className="patient-detail-section w-100" key={section.title}>
                          <legend>{section.title}</legend>
                          <div className="row g-3">
                            {section.fields.map((field) => (
                              <PatientDetailField
                                key={field[0]}
                                field={field}
                                value={details[field[0]]}
                                onChange={(name, value) => {
                                  setDetails((current) => ({ ...current, [name]: value }));
                                  setError("");
                                }}
                              />
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card-footer d-flex align-items-center gap-2">
                  {!isGvp && isEditing && (
                    <button
                      className="btn btn-outline-danger me-auto"
                      type="button"
                      onClick={handleDelete}
                    >
                      Elimina
                    </button>
                  )}
                  {!isGvp && isEditing && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={resetForm}
                    >
                      Annulla
                    </button>
                  )}
                  {isGvp ? (
                    <button className="btn btn-secondary ms-auto" type="button" onClick={resetForm}>Chiudi</button>
                  ) : null}
                </div>
              </form>
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Elenco pazienti</h2>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    {isGvp ? <tr><th>Paziente</th><th className="text-end">Azioni</th></tr> : <tr>
                      <th>Paziente</th>
                      <th>Accesso</th>
                      <th>Data</th>
                      <th>Patologia</th>
                      <th>Medico responsabile</th>
                      <th>CAS</th>
                      <th>GVP</th>
                      <th className="text-end">Azioni</th>
                    </tr>}
                  </thead>
                  <tbody>
                    {visiblePatients.length === 0 ? (
                      <tr>
                        <td className="text-center text-secondary py-4" colSpan={isGvp ? 2 : 8}>
                          Nessun paziente inserito.
                        </td>
                      </tr>
                    ) : (
                      [...visiblePatients]
                        .sort((first, second) =>
                          first.lastName.localeCompare(second.lastName),
                        )
                        .map((patient) => {
                          if (isGvp) {
                            return (
                              <tr key={patient.id}>
                                <td className="fw-medium">{patient.lastName} {patient.firstName}</td>
                                <td className="text-end"><div className="d-inline-flex gap-2"><button className="btn btn-outline-primary btn-sm" type="button" onClick={() => handleEdit(patient)}>Visualizza</button><button className="btn btn-primary btn-sm" type="button" onClick={() => openNotes(patient)}>Note</button></div></td>
                              </tr>
                            );
                          }
                          const doctor = doctors.find(
                            (item) => item.id === patient.doctorId,
                          );
                          const casUser = users.find(
                            (item) => item.id === patient.casId,
                          );
                          const gvpUsers = users.filter((item) =>
                            getPatientGvpIds(patient).includes(item.id),
                          );

                          return (
                          <tr key={patient.id}>
                            <td className="fw-medium">
                              {patient.lastName} {patient.firstName}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  patient.admissionType === "scheduled"
                                    ? "text-bg-primary"
                                    : "text-bg-danger"
                                }`}
                              >
                                {patient.admissionType === "scheduled"
                                  ? "Programmato"
                                  : "Emergenza"}
                              </span>
                            </td>
                            <td>
                              {patient.admissionDate
                                ? new Intl.DateTimeFormat("it-IT").format(
                                    new Date(
                                      `${patient.admissionDate}T00:00:00`,
                                    ),
                                  )
                                : "-"}
                            </td>
                            <td>{patient.pathology || "-"}</td>
                            <td>
                              {doctor
                                ? `${doctor.lastName} ${doctor.firstName}`
                                : <span className="badge text-bg-warning">Non assegnato</span>}
                            </td>
                            <td>
                              {casUser?.username || (
                                <span className="badge text-bg-warning">
                                  Non assegnato
                                </span>
                              )}
                            </td>
                            <td>{gvpUsers.length > 0 ? <div className="d-flex flex-wrap gap-1">{gvpUsers.map((gvpUser) => <span className="badge text-bg-info" key={gvpUser.id}>{getGvpDisplayName(gvpUser)}</span>)}</div> : <span className="text-secondary">-</span>}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                type="button"
                                onClick={() => handleEdit(patient)}
                              >
                                  Modifica
                                </button>
                                {(currentUser.role === "CAS" || currentUser.role === "Presidente") && <button className="btn btn-primary btn-sm ms-2" type="button" onClick={() => openNotes(patient)}>Note</button>}
                            </td>
                          </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
