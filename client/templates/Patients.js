import { useState } from "react";

const getToday = () => new Date().toISOString().slice(0, 10);

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
    setEditingId(null);
    setError("");
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
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
      !normalizedPathology ||
      !validDoctorId ||
      !validCasId
    ) {
      setError("Completa paziente, patologia, medico responsabile e CAS.");
      return;
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
      return;
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
      presidentId,
    };

    if (isEditing) {
      setPatients((current) =>
        current.map((patient) =>
          patient.id === editingId ? { ...patient, ...patientData } : patient,
        ),
      );
    } else {
      setPatients((current) => [
        ...current,
        { id: crypto.randomUUID(), ...patientData },
      ]);
    }

    resetForm();
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
                  className="btn-close ms-auto"
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
                      required
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
                      required
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
