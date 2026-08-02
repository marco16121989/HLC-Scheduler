import { useState } from "react";
import { createPopulatedPatientPdf } from "../utils/populatePatientPdf.js";

const getToday = () => new Date().toISOString().slice(0, 10);

const DETAIL_SECTIONS = [
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

const PatientDetailField = ({ field, value, onChange }) => {
  const [name, label, type = "text", options = []] = field;
  const common = {
    className: type === "select" || type === "yesno" ? "form-select" : "form-control",
    id: `patient-${name}`,
    value: value || "",
    onChange: (event) => onChange(name, event.target.value),
  };

  return (
    <div className="col-12 col-md-6">
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

export const Patients = ({
  patients,
  setPatients,
  doctors,
  users,
  currentUser,
  presidentId,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionType, setAdmissionType] = useState("emergency");
  const [admissionDate, setAdmissionDate] = useState(getToday);
  const [pathology, setPathology] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [casId, setCasId] = useState(
    currentUser.role === "CAS" ? currentUser.id : "",
  );
  const [notes, setNotes] = useState("");
  const [details, setDetails] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const isEditing = editingId !== null;
  const visiblePatients = patients.filter(
    (patient) => patient.presidentId === presidentId,
  );
  const visibleDoctors = doctors.filter(
    (doctor) => doctor.presidentId === presidentId,
  );
  const visibleCasUsers = users.filter(
    (user) =>
      user.role === "CAS" &&
      (user.presidentId || user.associationId) === presidentId,
  );

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setAdmissionType("emergency");
    setAdmissionDate(getToday());
    setPathology("");
    setDoctorId("");
    setCasId(currentUser.role === "CAS" ? currentUser.id : "");
    setNotes("");
    setDetails({});
    setEditingId(null);
    setError("");
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
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
    setNotes(patient.notes || "");
    setDetails(patient.details || {});
    setError("");
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

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <h1 className="mb-0">Pazienti</h1>
            <button
              className="btn btn-primary"
              type="button"
              onClick={openCreateModal}
            >
              Inserisci
            </button>
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
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
            <section className="card entity-modal-card">
              <div className="card-header d-flex align-items-center">
                <h2 className="card-title" id="patient-modal-title">
                  {isEditing ? "Modifica paziente" : "Inserisci paziente"}
                </h2>
                <button
                  className="btn btn-outline-secondary btn-sm ms-auto me-2"
                  type="button"
                  onClick={handleOpenPdf}
                >
                  Salva e apri HLC-7-I
                </button>
                <button
                  className="btn-close"
                  type="button"
                  aria-label="Chiudi"
                  onClick={resetForm}
                />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="card-body">
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

                  <fieldset className="mt-3">
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

                  <div className="mt-3">
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

                  <hr className="my-4" />
                  <p className="text-secondary mb-3">
                    Campi della scheda HLC-7-I. Compila solo le sezioni pertinenti al caso.
                  </p>
                  {DETAIL_SECTIONS.map((section) => (
                    <fieldset className="patient-detail-section" key={section.title}>
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

                <div className="card-footer d-flex align-items-center gap-2">
                  {isEditing && (
                    <button
                      className="btn btn-outline-danger me-auto"
                      type="button"
                      onClick={handleDelete}
                    >
                      Elimina
                    </button>
                  )}
                  {isEditing && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={resetForm}
                    >
                      Annulla
                    </button>
                  )}
                  <button className="btn btn-primary" type="submit">
                    {isEditing ? "Salva modifiche" : "Inserisci"}
                  </button>
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
                    <tr>
                      <th>Paziente</th>
                      <th>Accesso</th>
                      <th>Data</th>
                      <th>Patologia</th>
                      <th>Medico responsabile</th>
                      <th>CAS</th>
                      <th>Note</th>
                      <th className="text-end">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePatients.length === 0 ? (
                      <tr>
                        <td className="text-center text-secondary py-4" colSpan="8">
                          Nessun paziente inserito.
                        </td>
                      </tr>
                    ) : (
                      [...visiblePatients]
                        .sort((first, second) =>
                          first.lastName.localeCompare(second.lastName),
                        )
                        .map((patient) => {
                          const doctor = doctors.find(
                            (item) => item.id === patient.doctorId,
                          );
                          const casUser = users.find(
                            (item) => item.id === patient.casId,
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
                            <td className="doctor-notes-cell">
                              {patient.notes || (
                                <span className="text-secondary">-</span>
                              )}
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                type="button"
                                onClick={() => handleEdit(patient)}
                              >
                                Modifica
                              </button>
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
