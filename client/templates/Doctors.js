import { useEffect, useRef, useState } from "react";
import { confirmAction } from "./ConfirmDialog.js";
import { PaginationControls, usePagination } from "./Pagination.js";

const doctorTypes = [
  "Consulente",
  "Collaborazione storica",
  "Nuova collaborazione",
  "Non collabora",
];
const doctorTypeBadgeClasses = {
  Consulente: "text-bg-info",
  "Collaborazione storica": "text-bg-primary",
  "Nuova collaborazione": "text-bg-success",
  "Non collabora": "text-bg-danger",
};
const professionalRoles = ["Medico", "Chirurgo", "Anestesista"];

const getDoctorNotes = (doctor) => Array.isArray(doctor?.doctorNotes)
  ? doctor.doctorNotes.filter((note) => !String(note.id || "").startsWith("legacy-"))
  : [];
const getDoctorGeneralNote = (doctor) => doctor?.notes || (Array.isArray(doctor?.doctorNotes)
  ? doctor.doctorNotes.find((note) => String(note.id || "").startsWith("legacy-"))?.text || ""
  : "");

const SearchableDepartmentSelect = ({ options, value, search, onSearchChange, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.id === value);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return <div className="select2-style" ref={rootRef}>
    <button className={`form-select text-start select2-style-control ${open ? "is-open" : ""}`} id="doctor-department-filter" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {value === "all" ? "Tutti i reparti" : selected ? `${selected.name} — ${selected.hospitalName}` : "Reparto selezionato"}
    </button>
    {open && <div className="select2-style-dropdown">
      <input className="form-control select2-style-search" type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Cerca reparto o ospedale" aria-label="Cerca reparto o ospedale" autoFocus />
      <div className="select2-style-options" role="listbox">
        <button className={`select2-style-option ${value === "all" ? "is-selected" : ""}`} type="button" role="option" aria-selected={value === "all"} onClick={() => { onSearchChange(""); onChange("all"); setOpen(false); }}>Tutti i reparti</button>
        {options.map((option) => <button className={`select2-style-option ${value === option.id ? "is-selected" : ""}`} type="button" role="option" aria-selected={value === option.id} key={option.id} onClick={() => { onSearchChange(""); onChange(option.id); setOpen(false); }}><strong>{option.name}</strong><small>{option.hospitalName}</small></button>)}
        {options.length === 0 && <div className="select2-style-empty">Nessun reparto trovato.</div>}
      </div>
    </div>}
  </div>;
};

const DoctorNotePreview = ({ note }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.length > 30;

  useEffect(() => {
    if (!expanded) return undefined;
    const timerId = globalThis.setTimeout(() => setExpanded(false), 10_000);
    return () => globalThis.clearTimeout(timerId);
  }, [expanded]);

  return <span className="doctor-note-preview">
    <span>{isLong && !expanded ? `${note.slice(0, 30)}…` : note}</span>
    {isLong && <button className="doctor-note-more" type="button" aria-label={expanded ? "Riduci nota" : "Mostra nota completa"} aria-expanded={expanded} onClick={(event) => { event.stopPropagation(); setExpanded((current) => !current); }}>…</button>}
  </span>;
};

export const Doctors = ({
  doctors,
  setDoctors,
  hospitals,
  presidentId,
  currentUser,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [doctorType, setDoctorType] = useState(doctorTypes[0]);
  const [professionalRole, setProfessionalRole] = useState(professionalRoles[0]);
  const [notes, setNotes] = useState("");
  const [officeInstructions, setOfficeInstructions] = useState("");
  const [departmentIds, setDepartmentIds] = useState([]);
  const [selectedHospitalIds, setSelectedHospitalIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [professionalRoleFilter, setProfessionalRoleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [hospitalFilter, setHospitalFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [departmentSearchFilter, setDepartmentSearchFilter] = useState("");
  const [noteDoctor, setNoteDoctor] = useState(null);
  const [newDoctorNote, setNewDoctorNote] = useState("");
  const [doctorNoteError, setDoctorNoteError] = useState("");

  const isEditing = editingId !== null;
  const visibleDoctors = doctors.filter(
    (doctor) => doctor.presidentId === presidentId,
  );
  const visibleHospitals = hospitals.filter(
    (hospital) => hospital.presidentId === presidentId,
  );
  const normalizedDepartmentSearch = departmentSearchFilter.trim().toLocaleLowerCase("it-IT");
  const filterDepartments = visibleHospitals
    .filter((hospital) => hospitalFilter === "all" || hospital.id === hospitalFilter)
    .flatMap((hospital) => (hospital.departments || []).map((department) => ({
      ...department,
      hospitalName: hospital.name,
    })))
    .filter((department) => !normalizedDepartmentSearch || `${department.name || ""} ${department.hospitalName || ""}`.toLocaleLowerCase("it-IT").includes(normalizedDepartmentSearch))
    .sort((first, second) => (first.name || "").localeCompare(second.name || "", "it-IT"));
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
    const resolvedProfessionalRole = professionalRoles.includes(doctor.professionalRole) ? doctor.professionalRole : professionalRoles[0];
    const matchesProfessionalRole = professionalRoleFilter === "all" || resolvedProfessionalRole === professionalRoleFilter;
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
    const matchesDepartment = departmentFilter === "all" || (doctor.departmentIds || []).includes(departmentFilter);
    const matchesDepartmentSearch = !normalizedDepartmentSearch || visibleHospitals.some((hospital) =>
      (hospitalFilter === "all" || hospital.id === hospitalFilter) &&
      (hospital.departments || []).some((department) =>
        (doctor.departmentIds || []).includes(department.id) &&
        `${department.name || ""} ${hospital.name || ""}`.toLocaleLowerCase("it-IT").includes(normalizedDepartmentSearch),
      ),
    );
    return matchesName && matchesProfessionalRole && matchesType && matchesHospital && matchesDepartment && matchesDepartmentSearch;
  });
  const sortedDoctors = [...filteredDoctors].sort((first, second) =>
    (first.lastName || "").localeCompare(second.lastName || ""),
  );
  const doctorPagination = usePagination(
    sortedDoctors,
    25,
    `${normalizedNameFilter}:${professionalRoleFilter}:${typeFilter}:${hospitalFilter}:${departmentFilter}:${normalizedDepartmentSearch}`,
  );
  const hasActiveFilters = Boolean(normalizedNameFilter) ||
    professionalRoleFilter !== "all" || typeFilter !== "all" || hospitalFilter !== "all" || departmentFilter !== "all" || Boolean(normalizedDepartmentSearch);
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
    setProfessionalRole(professionalRoles[0]);
    setNotes("");
    setOfficeInstructions("");
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
    const normalizedOfficeInstructions = officeInstructions.trim();

    if (
      !normalizedFirstName ||
      !normalizedLastName
    ) {
      setError("Inserisci nome e cognome del medico.");
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

    const emailExists = normalizedEmail && doctors.some(
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
      professionalRole: professionalRoles.includes(professionalRole) ? professionalRole : professionalRoles[0],
      notes: normalizedNotes,
      officeInstructions: normalizedOfficeInstructions,
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
    setProfessionalRole(professionalRoles.includes(doctor.professionalRole) ? doctor.professionalRole : professionalRoles[0]);
    setNotes(getDoctorGeneralNote(doctor));
    setOfficeInstructions(doctor.officeInstructions || "");
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

  const openDoctorNotes = (doctor) => {
    setNoteDoctor(doctor);
    setNewDoctorNote("");
    setDoctorNoteError("");
  };

  const closeDoctorNotes = () => {
    setNoteDoctor(null);
    setNewDoctorNote("");
    setDoctorNoteError("");
  };

  const saveDoctorNote = () => {
    const normalizedNote = newDoctorNote.trim();
    if (!noteDoctor || !normalizedNote) {
      setDoctorNoteError("Inserisci una nota.");
      return;
    }
    const note = {
      id: crypto.randomUUID(),
      text: normalizedNote.slice(0, 4000),
      authorId: currentUser?.id || "",
      author: currentUser?.username || currentUser?.role || "Utente",
      authorRole: currentUser?.role || "",
      createdAt: new Date().toISOString(),
    };
    setDoctors((current) => current.map((doctor) => doctor.id === noteDoctor.id
      ? { ...doctor, doctorNotes: [...(Array.isArray(doctor.doctorNotes) ? doctor.doctorNotes : []), note] }
      : doctor));
    closeDoctorNotes();
  };

  const deleteDoctorNote = async (note) => {
    if (!noteDoctor || note.authorId !== currentUser?.id) return;
    if (!await confirmAction("Eliminare questa nota?")) return;
    const remainingNotes = (Array.isArray(noteDoctor.doctorNotes) ? noteDoctor.doctorNotes : []).filter((item) => item.id !== note.id);
    setDoctors((current) => current.map((doctor) => doctor.id === noteDoctor.id
      ? { ...doctor, doctorNotes: remainingNotes }
      : doctor));
    setNoteDoctor((current) => current ? { ...current, doctorNotes: remainingNotes } : current);
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
            <div><h1 className="mb-1">Medici</h1><p className="text-secondary mb-0">Gestisci i contatti dei medici e le indicazioni sugli studi in cui ricevono.</p></div>
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
          {noteDoctor && <>
            <button className="entity-modal-backdrop" type="button" aria-label="Chiudi note operative" onClick={closeDoctorNotes} />
            <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="doctor-notes-title">
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title" id="doctor-notes-title">Note operative — {noteDoctor.lastName} {noteDoctor.firstName}</h2>
                  <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeDoctorNotes} />
                </div>
                <div className="card-body">
                  {doctorNoteError && <div className="alert alert-danger py-2" role="alert">{doctorNoteError}</div>}
                  <h3 className="h6">Note operative esistenti</h3>
                  {getDoctorNotes(noteDoctor).length === 0 ? <p className="text-secondary">Nessuna nota operativa inserita.</p> : <div className="d-grid gap-2 mb-4">{getDoctorNotes(noteDoctor).map((note) => <article className="border rounded p-3" key={note.id}><div className="d-flex align-items-start justify-content-between gap-3"><p className="mb-1">{note.text}</p>{note.authorId === currentUser?.id && <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteDoctorNote(note)}>Elimina</button>}</div><small className="text-secondary">{note.author || "Utente"}{note.createdAt ? ` · ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(note.createdAt))}` : ""}</small></article>)}</div>}
                  <label className="form-label" htmlFor="new-doctor-note">Aggiungi una nota operativa</label>
                  <textarea className="form-control" id="new-doctor-note" rows="5" value={newDoctorNote} onChange={(event) => { setNewDoctorNote(event.target.value); setDoctorNoteError(""); }} maxLength="4000" autoFocus />
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeDoctorNotes}>Annulla</button>
                  <button className="btn btn-primary" type="button" onClick={saveDoctorNote} disabled={!newDoctorNote.trim()}>Aggiungi nota operativa</button>
                </div>
              </section>
            </div>
          </>}
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
                        Telefono <span className="text-secondary">(facoltativo)</span>
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
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="doctor-email">
                        Email <span className="text-secondary">(facoltativa)</span>
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
                      >
                        {doctorTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="doctor-professional-role">
                        Professione
                      </label>
                      <select
                        className="form-select"
                        id="doctor-professional-role"
                        value={professionalRole}
                        onChange={(event) => {
                          setProfessionalRole(event.target.value);
                          setError("");
                        }}
                        required
                      >
                        {professionalRoles.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="doctor-notes">
                        Note generali del medico
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
                        placeholder="Informazioni generali da conservare nell’anagrafica del medico"
                        maxLength="4000"
                      />
                      <div className="form-text">Queste note fanno parte dell’anagrafica e sono separate dalle Note operative.</div>
                    </div>

                    <div className="mt-3">
                      <label className="form-label" htmlFor="doctor-office-instructions">
                        Studio / sede di ricevimento
                      </label>
                      <textarea
                        className="form-control"
                        id="doctor-office-instructions"
                        rows="5"
                        value={officeInstructions}
                        onChange={(event) => {
                          setOfficeInstructions(event.target.value);
                          setError("");
                        }}
                        placeholder="Es. Ospedale San Carlo, secondo piano, studio 12"
                        maxLength="4000"
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
                    <div className="col-12 col-md-6 col-lg-2">
                      <label className="form-label" htmlFor="doctor-professional-role-filter">
                        Professione
                      </label>
                      <select
                        className="form-select"
                        id="doctor-professional-role-filter"
                        value={professionalRoleFilter}
                        onChange={(event) => setProfessionalRoleFilter(event.target.value)}
                      >
                        <option value="all">Tutte le professioni</option>
                        {professionalRoles.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-6 col-lg-2">
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
                    <div className="col-12 col-md-6 col-lg-2">
                      <label className="form-label" htmlFor="doctor-hospital-filter">
                        Ospedale
                      </label>
                      <select
                        className="form-select"
                        id="doctor-hospital-filter"
                        value={hospitalFilter}
                        onChange={(event) => {
                          const nextHospitalId = event.target.value;
                          setHospitalFilter(nextHospitalId);
                          if (departmentFilter !== "all") {
                            const departmentBelongsToHospital = visibleHospitals
                              .find((hospital) => hospital.id === nextHospitalId)
                              ?.departments?.some((department) => department.id === departmentFilter);
                            if (nextHospitalId !== "all" && !departmentBelongsToHospital) setDepartmentFilter("all");
                          }
                        }}
                      >
                        <option value="all">Tutti gli ospedali</option>
                        {visibleHospitals.map((hospital) => (
                          <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-6 col-lg-2">
                      <label className="form-label" htmlFor="doctor-department-filter">
                        Reparto
                      </label>
                      <SearchableDepartmentSelect
                        options={filterDepartments}
                        value={departmentFilter}
                        search={departmentSearchFilter}
                        onSearchChange={(value) => {
                          setDepartmentSearchFilter(value);
                          setDepartmentFilter("all");
                        }}
                        onChange={setDepartmentFilter}
                      />
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 mobile-card-table doctor-list-table">
                      <thead>
                        <tr>
                          <th>Cognome</th>
                          <th>Nome</th>
                          <th>Professione</th>
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
                            <td className="text-center text-secondary py-4" colSpan="8">
                              {hasActiveFilters
                                ? "Nessun medico corrisponde ai filtri selezionati."
                                : "Nessun medico inserito."}
                            </td>
                          </tr>
                        ) : (
                          doctorPagination.pageItems.map((doctor) => {
                              const departmentLabels =
                                getDepartmentLabels(doctor);
                              const doctorNote = getDoctorGeneralNote(doctor);

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
                                <td data-label="Professione">
                                  <span className={`badge ${doctor.professionalRole === "Anestesista" ? "text-bg-success" : doctor.professionalRole === "Chirurgo" ? "text-bg-primary" : "text-bg-secondary"}`}>
                                    {professionalRoles.includes(doctor.professionalRole) ? doctor.professionalRole : "Medico"}
                                  </span>
                                </td>
                                <td data-label="Tipologia">
                                  <span className={`badge ${doctorTypeBadgeClasses[doctor.doctorType] || "text-bg-secondary"}`}>
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
                                  {doctorNote ? <DoctorNotePreview note={doctorNote} /> : (
                                    <span className="text-secondary">-</span>
                                  )}
                                </td>
                                <td className="text-end" data-label="Azioni">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); openDoctorNotes(doctor); }}
                                  >
                                    Note operative
                                  </button>
                                </td>
                              </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls {...doctorPagination} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
