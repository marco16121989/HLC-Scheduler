import { useState } from "react";
import { confirmAction } from "./ConfirmDialog.js";

const doctorTypes = [
  "Consulente",
  "Collaborazione storica",
  "Nuova collaborazione",
];

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
  const [doctorType, setDoctorType] = useState(doctorTypes[0]);
  const [notes, setNotes] = useState("");
  const [departmentIds, setDepartmentIds] = useState([]);
  const [selectedHospitalIds, setSelectedHospitalIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [hospitalFilter, setHospitalFilter] = useState("all");

  const isEditing = editingId !== null;
  const visibleDoctors = doctors.filter(
    (doctor) => doctor.presidentId === presidentId,
  );
  const visibleHospitals = hospitals.filter(
    (hospital) => hospital.presidentId === presidentId,
  );
  const normalizedNameFilter = nameFilter.trim().toLowerCase().replace(/\s+/g, " ");
  const filteredDoctors = visibleDoctors.filter((doctor) => {
    const normalizedFirstName = (doctor.firstName || "").trim().toLowerCase();
    const normalizedLastName = (doctor.lastName || "").trim().toLowerCase();
    const searchableNames = [
      normalizedFirstName,
      normalizedLastName,
      `${normalizedFirstName} ${normalizedLastName}`,
      `${normalizedLastName} ${normalizedFirstName}`,
    ];
    const matchesName = !normalizedNameFilter || searchableNames.some(
      (value) => value.includes(normalizedNameFilter),
    );
    const matchesType = typeFilter === "all" || doctor.doctorType === typeFilter;
    const selectedHospital = visibleHospitals.find(
      (hospital) => hospital.id === hospitalFilter,
    );
    const hospitalDepartmentIds = new Set(
      (selectedHospital?.departments || []).map((department) => department.id),
    );
    const matchesHospital = hospitalFilter === "all" ||
      (doctor.departmentIds || []).some((departmentId) =>
        hospitalDepartmentIds.has(departmentId),
      );
    return matchesName && matchesType && matchesHospital;
  });
  const hasActiveFilters = Boolean(normalizedNameFilter) ||
    typeFilter !== "all" || hospitalFilter !== "all";
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
    setDoctorType(doctorTypes[0]);
    setNotes("");
    setDepartmentIds([]);
    setSelectedHospitalIds([]);
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
      doctorType: doctorTypes.includes(doctorType) ? doctorType : doctorTypes[0],
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
    setDoctorType(
      doctorTypes.includes(doctor.doctorType)
        ? doctor.doctorType
        : doctorTypes[0],
    );
    setNotes(doctor.notes || "");
    setDepartmentIds(
      (doctor.departmentIds || []).filter((departmentId) =>
        availableDepartmentIds.has(departmentId),
      ),
    );
    setSelectedHospitalIds(visibleHospitals.filter((hospital) =>
      (hospital.departments || []).some((department) =>
        (doctor.departmentIds || []).includes(department.id),
      )).map((hospital) => hospital.id));
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

  const toggleHospital = (hospital) => {
    const selected = selectedHospitalIds.includes(hospital.id);
    setSelectedHospitalIds((current) => selected
      ? current.filter((id) => id !== hospital.id)
      : [...current, hospital.id]);
    if (selected) {
      const hospitalDepartmentIds = new Set((hospital.departments || []).map((department) => department.id));
      setDepartmentIds((current) => current.filter((id) => !hospitalDepartmentIds.has(id)));
    }
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

  const handleDelete = async () => {
    const doctor = doctors.find((item) => item.id === editingId);

    if (
      !doctor ||
      !await confirmAction(
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
                      <label className="form-label" htmlFor="doctor-type">
                        Tipologia
                      </label>
                      <select
                        className="form-select"
                        id="doctor-type"
                        value={doctorType}
                        onChange={(event) => {
                          setDoctorType(event.target.value);
                          setError("");
                        }}
                        required
                      >
                        {doctorTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
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
                      <legend className="form-label">Ospedali e reparti</legend>
                      {visibleHospitals.length === 0 ? (
                        <div className="form-text">
                          Inserisci prima un ospedale con almeno un reparto.
                        </div>
                      ) : (
                        <div className="profile-hospitals">
                          {visibleHospitals.map((hospital) => {
                            const selected = selectedHospitalIds.includes(hospital.id);
                            return <article className={`profile-hospital ${selected ? "selected" : ""}`} key={hospital.id}>
                              <label className="form-check profile-hospital-title">
                                <input className="form-check-input" type="checkbox" checked={selected} onChange={() => toggleHospital(hospital)} />
                                <span className="form-check-label"><strong>{hospital.name}</strong></span>
                              </label>
                              {selected && (hospital.departments || []).length > 0 && (
                                <div className="profile-departments">
                                  {hospital.departments.map((department) => (
                                    <label className="form-check" key={department.id}>
                                      <input className="form-check-input" type="checkbox" checked={departmentIds.includes(department.id)} onChange={() => toggleDepartment(department.id)} />
                                      <span className="form-check-label">{department.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </article>;
                          })}
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
                <div className="card-header mobile-list-header">
                  <h2 className="card-title">Elenco medici</h2>
                </div>
                <div className="card-body p-0">
                  <div className="row g-3 p-3 border-bottom doctor-list-filters">
                    <div className="col-12 col-lg-4">
                      <label className="form-label" htmlFor="doctor-name-filter">
                        Cerca medico
                      </label>
                      <input
                        className="form-control"
                        id="doctor-name-filter"
                        type="search"
                        value={nameFilter}
                        onChange={(event) => setNameFilter(event.target.value)}
                        placeholder="Nome, cognome o nome completo"
                      />
                    </div>
                    <div className="col-12 col-md-6 col-lg-4">
                      <label className="form-label" htmlFor="doctor-type-filter">
                        Tipologia
                      </label>
                      <select
                        className="form-select"
                        id="doctor-type-filter"
                        value={typeFilter}
                        onChange={(event) => setTypeFilter(event.target.value)}
                      >
                        <option value="all">Tutte le tipologie</option>
                        {doctorTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-6 col-lg-4">
                      <label className="form-label" htmlFor="doctor-hospital-filter">
                        Ospedale
                      </label>
                      <select
                        className="form-select"
                        id="doctor-hospital-filter"
                        value={hospitalFilter}
                        onChange={(event) => setHospitalFilter(event.target.value)}
                      >
                        <option value="all">Tutti gli ospedali</option>
                        {visibleHospitals.map((hospital) => (
                          <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 mobile-card-table doctor-list-table">
                      <thead>
                        <tr>
                          <th>Cognome</th>
                          <th>Nome</th>
                          <th>Tipologia</th>
                          <th>Contatti</th>
                          <th>Reparti</th>
                          <th>Note</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDoctors.length === 0 ? (
                          <tr>
                            <td className="text-center text-secondary py-4" colSpan="7">
                              {hasActiveFilters
                                ? "Nessun medico corrisponde ai filtri selezionati."
                                : "Nessun medico inserito."}
                            </td>
                          </tr>
                        ) : (
                          [...filteredDoctors]
                            .sort((first, second) =>
                              first.lastName.localeCompare(second.lastName),
                            )
                            .map((doctor) => {
                              const departmentLabels =
                                getDepartmentLabels(doctor);

                              return (
                              <tr
                                className="doctor-clickable-row"
                                key={doctor.id}
                                role="button"
                                tabIndex="0"
                                onClick={() => handleEdit(doctor)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleEdit(doctor);
                                  }
                                }}
                              >
                                <td className="fw-medium" data-label="Cognome">{doctor.lastName}</td>
                                <td data-label="Nome">{doctor.firstName}</td>
                                <td data-label="Tipologia">
                                  <span className="badge text-bg-info">
                                    {doctor.doctorType || "Non specificata"}
                                  </span>
                                </td>
                                <td data-label="Contatti">
                                  <div className="doctor-contact">
                                    <a href={`tel:${doctor.phone}`}>
                                      {doctor.phone}
                                    </a>
                                    <a href={`mailto:${doctor.email}`}>
                                      {doctor.email}
                                    </a>
                                  </div>
                                </td>
                                <td data-label="Reparti">
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
                                <td className="doctor-notes-cell" data-label="Note">
                                  {doctor.notes || (
                                    <span className="text-secondary">-</span>
                                  )}
                                </td>
                                <td className="text-end" data-label="Azioni">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); handleEdit(doctor); }}
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
