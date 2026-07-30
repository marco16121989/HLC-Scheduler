import { useState } from "react";

export const Doctors = ({
  doctors,
  setDoctors,
  hospitals,
  presidentId,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [departmentIds, setDepartmentIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const isEditing = editingId !== null;
  const visibleDoctors = doctors.filter(
    (doctor) => doctor.presidentId === presidentId,
  );
  const visibleHospitals = hospitals.filter(
    (hospital) => hospital.presidentId === presidentId,
  );
  const availableDepartmentIds = new Set(
    visibleHospitals.flatMap((hospital) =>
      hospital.departments.map((department) => department.id),
    ),
  );

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setDepartmentIds([]);
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
    const normalizedPhone = phone.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedNotes = notes.trim();

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedPhone ||
      !normalizedEmail
    ) {
      setError("Inserisci nome, cognome, telefono ed email del medico.");
      return;
    }

    const validDepartmentIds = departmentIds.filter((departmentId) =>
      availableDepartmentIds.has(departmentId),
    );

    if (validDepartmentIds.length === 0) {
      setError("Seleziona almeno un reparto.");
      return;
    }

    const isDuplicate = doctors.some(
      (doctor) =>
        doctor.firstName.toLowerCase() === normalizedFirstName.toLowerCase() &&
        doctor.lastName.toLowerCase() === normalizedLastName.toLowerCase() &&
        doctor.id !== editingId,
    );

    if (isDuplicate) {
      setError("Il medico e gia presente.");
      return;
    }

    const emailExists = doctors.some(
      (doctor) =>
        doctor.email?.toLowerCase() === normalizedEmail &&
        doctor.id !== editingId,
    );

    if (emailExists) {
      setError("L'email e gia associata a un altro medico.");
      return;
    }

    const doctorData = {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      phone: normalizedPhone,
      email: normalizedEmail,
      notes: normalizedNotes,
      presidentId,
      departmentIds: validDepartmentIds,
    };

    if (isEditing) {
      setDoctors((current) =>
        current.map((doctor) =>
          doctor.id === editingId ? { ...doctor, ...doctorData } : doctor,
        ),
      );
    } else {
      setDoctors((current) => [
        ...current,
        { id: crypto.randomUUID(), ...doctorData },
      ]);
    }

    resetForm();
  };

  const handleEdit = (doctor) => {
    setEditingId(doctor.id);
    setFirstName(doctor.firstName);
    setLastName(doctor.lastName);
    setPhone(doctor.phone || "");
    setEmail(doctor.email || "");
    setNotes(doctor.notes || "");
    setDepartmentIds(
      (doctor.departmentIds || []).filter((departmentId) =>
        availableDepartmentIds.has(departmentId),
      ),
    );
    setError("");
    setModalOpen(true);
  };

  const toggleDepartment = (departmentId) => {
    setDepartmentIds((current) =>
      current.includes(departmentId)
        ? current.filter((id) => id !== departmentId)
        : [...current, departmentId],
    );
    setError("");
  };

  const getDepartmentLabels = (doctor) =>
    visibleHospitals.flatMap((hospital) =>
      hospital.departments
        .filter((department) =>
          (doctor.departmentIds || []).includes(department.id),
        )
        .map((department) => `${hospital.name} / ${department.name}`),
    );

  const handleDelete = () => {
    const doctor = doctors.find((item) => item.id === editingId);

    if (
      !doctor ||
      !globalThis.confirm(
        `Eliminare il medico ${doctor.firstName} ${doctor.lastName}?`,
      )
    ) {
      return;
    }

    setDoctors((current) =>
      current.filter((item) => item.id !== editingId),
    );
    resetForm();
  };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <h1 className="mb-0">Medici</h1>
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
          <div className="row g-3">
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
              aria-labelledby="doctor-modal-title"
            >
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title">
                    <span id="doctor-modal-title">
                    {isEditing ? "Modifica medico" : "Inserisci medico"}
                    </span>
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
                      <label className="form-label" htmlFor="doctor-first-name">
                        Nome
                      </label>
                      <input
                        className="form-control"
                        id="doctor-first-name"
                        type="text"
                        value={firstName}
                        onChange={(event) => {
                          setFirstName(event.target.value);
                          setError("");
                        }}
                        required
                      />
                    </div>

                    <div className="mb-0">
                      <label className="form-label" htmlFor="doctor-last-name">
                        Cognome
                      </label>
                      <input
                        className="form-control"
                        id="doctor-last-name"
                        type="text"
                        value={lastName}
                        onChange={(event) => {
                          setLastName(event.target.value);
                          setError("");
                        }}
                        required
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="doctor-phone">
                        Telefono
                      </label>
                      <input
                        className="form-control"
                        id="doctor-phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          setError("");
                        }}
                        autoComplete="tel"
                        required
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="doctor-email">
                        Email
                      </label>
                      <input
                        className="form-control"
                        id="doctor-email"
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setError("");
                        }}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="doctor-notes">
                        Note
                      </label>
                      <textarea
                        className="form-control"
                        id="doctor-notes"
                        rows="3"
                        value={notes}
                        onChange={(event) => {
                          setNotes(event.target.value);
                          setError("");
                        }}
                      />
                    </div>

                    <fieldset className="doctor-departments-fieldset mt-3">
                      <legend className="form-label">Reparti</legend>
                      {visibleHospitals.length === 0 ? (
                        <div className="form-text">
                          Inserisci prima un ospedale con almeno un reparto.
                        </div>
                      ) : (
                        <div className="doctor-department-options">
                          {visibleHospitals.map((hospital) => (
                            <div key={hospital.id}>
                              <div className="doctor-hospital-name">
                                {hospital.name}
                              </div>
                              {hospital.departments.map((department) => (
                                <label
                                  className="form-check"
                                  key={department.id}
                                >
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={departmentIds.includes(
                                      department.id,
                                    )}
                                    onChange={() =>
                                      toggleDepartment(department.id)
                                    }
                                  />
                                  <span className="form-check-label">
                                    {department.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </fieldset>
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

            <div className="col-12">
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">Elenco medici</h2>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Cognome</th>
                          <th>Nome</th>
                          <th>Contatti</th>
                          <th>Reparti</th>
                          <th>Note</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDoctors.length === 0 ? (
                          <tr>
                            <td className="text-center text-secondary py-4" colSpan="6">
                              Nessun medico inserito.
                            </td>
                          </tr>
                        ) : (
                          [...visibleDoctors]
                            .sort((first, second) =>
                              first.lastName.localeCompare(second.lastName),
                            )
                            .map((doctor) => {
                              const departmentLabels =
                                getDepartmentLabels(doctor);

                              return (
                              <tr key={doctor.id}>
                                <td className="fw-medium">{doctor.lastName}</td>
                                <td>{doctor.firstName}</td>
                                <td>
                                  <div className="doctor-contact">
                                    <a href={`tel:${doctor.phone}`}>
                                      {doctor.phone}
                                    </a>
                                    <a href={`mailto:${doctor.email}`}>
                                      {doctor.email}
                                    </a>
                                  </div>
                                </td>
                                <td>
                                  {departmentLabels.length > 0 ? (
                                    <div className="d-flex flex-wrap gap-1">
                                      {departmentLabels.map((label) => (
                                        <span
                                          className="badge text-bg-secondary"
                                          key={label}
                                        >
                                          {label}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="badge text-bg-warning">
                                      Nessun reparto
                                    </span>
                                  )}
                                </td>
                                <td className="doctor-notes-cell">
                                  {doctor.notes || (
                                    <span className="text-secondary">-</span>
                                  )}
                                </td>
                                <td className="text-end">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    type="button"
                                    onClick={() => handleEdit(doctor)}
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
        </div>
      </div>
    </>
  );
};
