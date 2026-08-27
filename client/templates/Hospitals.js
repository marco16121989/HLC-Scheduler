import { useState } from "react";
import { confirmAction } from "./ConfirmDialog.js";
import { normalizeHospital } from "../utils/hospitals.js";

const DEFAULT_DEPARTMENTS = [
  "Anestesiologia", "Cardiochirurgia", "Centro ustioni", "Chirurgia colorettale",
  "Chirurgia dei trapianti", "Chirurgia generale", "Chirurgia orale e maxillo-facciale",
  "Chirurgia ortopedica", "Chirurgia toracica", "Chirurgia traumatologica",
  "Chirurgia vascolare", "Ematologia", "Gastroenterologia", "Ginecologia",
  "Medicina d’urgenza", "Medicina interna", "Medicina ospedaliera", "Medico notturno",
  "Nefrologia", "Neonatologia", "Neurochirurgia", "Oncologia", "Oncologia ginecologica",
  "Ostetricia", "Medico del travaglio", "Perinatologia (gravidanze ad alto rischio)",
  "Otorinolaringoiatria — Chirurgia cervico-facciale", "Pneumologia",
  "Radiologia interventistica", "Terapia intensiva/Rianimazione", "Urologia",
];

export const Hospitals = ({ hospitals, setHospitals, departmentTemplates = [], users = [], presidentId }) => {
  const [name, setName] = useState("");
  const [director, setDirector] = useState("");
  const [departments, setDepartments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [departmentListHospital, setDepartmentListHospital] = useState(null);

  const isEditing = editingId !== null;
  const visibleHospitals = hospitals.filter(
    (hospital) => hospital.presidentId === presidentId,
  );
  const visibleDepartmentTemplates = departmentTemplates.filter(
    (department) => department.presidentId === presidentId,
  );
  const visibleCasUsers = users.filter((user) => !user.disabled && user.role === "CAS" && (user.presidentId === presidentId || user.associationId === presidentId));
  const getDepartmentCasUsers = (hospitalId, departmentId) => visibleCasUsers.filter((casUser) => {
    const assignments = Array.isArray(casUser.hospitalAssignments)
      ? casUser.hospitalAssignments
      : casUser.hospitalId
        ? [{ hospitalId: casUser.hospitalId, departmentIds: casUser.departmentId ? [casUser.departmentId] : [] }]
        : [];
    return assignments.some((assignment) => assignment.hospitalId === hospitalId && (
      !Array.isArray(assignment.departmentIds) || assignment.departmentIds.length === 0 || assignment.departmentIds.includes(departmentId)
    ));
  });
  const getUncoveredDepartmentCount = (hospital) => (hospital.departments || []).filter(
    (department) => getDepartmentCasUsers(hospital.id, department.id).length === 0,
  ).length;
  const resetForm = () => {
    setName("");
    setDirector("");
    setDepartments([]);
    setEditingId(null);
    setError("");
    setModalOpen(false);
    setDepartmentListHospital(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const toggleDepartment = (departmentTemplate) => {
    setDepartments((current) => {
      const selected = current.find(
        (department) => department.templateId === departmentTemplate.id || department.name.toLowerCase() === departmentTemplate.name.toLowerCase(),
      );
      return selected
        ? current.filter((department) => department.id !== selected.id)
        : [...current, { id: crypto.randomUUID(), templateId: departmentTemplate.id, name: departmentTemplate.name, head: "" }];
    });
    setError("");
  };

  const allDefaultDepartmentsSelected = visibleDepartmentTemplates.length > 0 && visibleDepartmentTemplates.every((departmentTemplate) =>
    departments.some(
      (department) => department.templateId === departmentTemplate.id || department.name.toLowerCase() === departmentTemplate.name.toLowerCase(),
    ),
  );

  const toggleAllDepartments = () => {
    setDepartments((current) => {
      if (allDefaultDepartmentsSelected) {
        return current.filter(
          (department) => !visibleDepartmentTemplates.some(
            (template) => template.id === department.templateId || template.name.toLowerCase() === department.name.toLowerCase(),
          ),
        );
      }

      const missingDepartments = visibleDepartmentTemplates
        .filter((template) => !current.some(
          (department) => department.templateId === template.id || department.name.toLowerCase() === template.name.toLowerCase(),
        ))
        .map((template) => ({ id: crypto.randomUUID(), templateId: template.id, name: template.name, head: "" }));
      return [...current, ...missingDepartments];
    });
    setError("");
  };

  const updateDepartment = (id, field, value) => {
    setDepartments((current) =>
      current.map((department) =>
        department.id === id ? { ...department, [field]: value } : department,
      ),
    );
    setError("");
  };

  const removeDepartment = (id) => {
    setDepartments((current) =>
      current.filter((department) => department.id !== id),
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedDirector = director.trim();

    if (!normalizedName || !normalizedDirector) {
      setError("Inserisci ospedale e Direttore sanitario.");
      return;
    }

    const incompleteDepartment = departments.some(
      (department) => !department.name.trim(),
    );

    if (incompleteDepartment) {
      setError("Completa il nome di ogni reparto.");
      return;
    }

    const isDuplicate = hospitals.some(
      (hospital) =>
        hospital.name.toLowerCase() === normalizedName.toLowerCase() &&
        hospital.id !== editingId,
    );

    if (isDuplicate) {
      setError("L'ospedale e gia presente.");
      return;
    }

    const hospitalData = {
      name: normalizedName,
      director: normalizedDirector,
      presidentId,
      departments: departments.map((department) => {
        const template = visibleDepartmentTemplates.find(
          (item) => item.id === department.templateId || item.name.toLowerCase() === department.name.toLowerCase(),
        );
        return {
          ...department,
          ...(template ? { templateId: template.id } : {}),
          name: template?.name || department.name.trim(),
          head: (department.head || "").trim(),
        };
      }),
    };

    if (isEditing) {
      setHospitals((current) =>
        current.map((hospital) =>
          hospital.id === editingId
            ? { ...hospital, ...hospitalData }
            : hospital,
        ),
      );
    } else {
      setHospitals((current) => [
        ...current,
        { id: crypto.randomUUID(), ...hospitalData },
      ]);
    }

    resetForm();
  };

  const handleEdit = (hospital) => {
    const normalizedHospital = normalizeHospital(hospital);
    setDepartmentListHospital(null);
    setEditingId(normalizedHospital.id);
    setName(normalizedHospital.name);
    setDirector(normalizedHospital.director);
    setDepartments(normalizedHospital.departments);
    setError("");
    setModalOpen(true);
  };

  const handleDelete = async () => {
    const hospital = hospitals.find((item) => item.id === editingId);

    if (!hospital || !await confirmAction(`Eliminare ${hospital.name}?`)) {
      return;
    }

    setHospitals((current) =>
      current.filter((item) => item.id !== editingId),
    );
    resetForm();
  };

  return (
    <>
      <div className="app-content-header hospital-page-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div><h1 className="mb-1">Ospedali</h1><p className="text-secondary mb-0">Gestisci le strutture ospedaliere e i relativi reparti.</p></div>
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

      <div className="app-content hospital-page-content">
        <div className="container-fluid">
          <div className="row g-3">
            {departmentListHospital && <>
              <button className="entity-modal-backdrop" type="button" aria-label="Chiudi elenco reparti" onClick={() => setDepartmentListHospital(null)} />
              <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="hospital-department-list-title">
                <section className="card entity-modal-card">
                  <div className="card-header d-flex align-items-center gap-3">
                    <h2 className="card-title mb-0" id="hospital-department-list-title">Reparti — {departmentListHospital.name}</h2>
                    <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={() => setDepartmentListHospital(null)} />
                  </div>
                  <div className="card-body">
                    {departmentListHospital.departments.length > 0 && (() => {
                      const uncoveredCount = departmentListHospital.departments.filter((department) => getDepartmentCasUsers(departmentListHospital.id, department.id).length === 0).length;
                      return <div className={`alert ${uncoveredCount > 0 ? "alert-warning" : "alert-success"} py-2`} role="status"><strong>{uncoveredCount > 0 ? `${uncoveredCount} ${uncoveredCount === 1 ? "reparto scoperto" : "reparti scoperti"}` : "Tutti i reparti sono coperti"}</strong><span className="d-block small">Le assegnazioni sono aggiornate automaticamente dalla sezione CAS.</span></div>;
                    })()}
                    {departmentListHospital.departments.length > 0 ? <div className="list-group">
                      {departmentListHospital.departments.map((department) => {
                        const assignedCasUsers = getDepartmentCasUsers(departmentListHospital.id, department.id);
                        return <div className={`list-group-item hospital-department-coverage ${assignedCasUsers.length === 0 ? "is-uncovered" : ""}`} key={department.id}>
                          <div className="hospital-department-coverage-heading"><strong>{department.name}</strong><span className="text-secondary">{department.head ? `Primario: ${department.head}` : "Primario non indicato"}</span></div>
                          <div className="hospital-department-cas"><span className="hospital-department-cas-label">CAS incaricati</span>{assignedCasUsers.length > 0 ? <div className="d-flex flex-wrap gap-1">{assignedCasUsers.map((casUser) => <span className="badge text-bg-success" key={casUser.id}>{casUser.username}</span>)}</div> : <span className="badge text-bg-warning">Reparto scoperto</span>}</div>
                        </div>;
                      })}
                    </div> : <p className="text-secondary mb-0">Nessun reparto inserito.</p>}
                  </div>
                  <div className="card-footer text-end">
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setDepartmentListHospital(null)}>Chiudi</button>
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
              aria-labelledby="hospital-modal-title"
            >
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title">
                    <span id="hospital-modal-title">
                    {isEditing ? "Modifica ospedale" : "Inserisci ospedale"}
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
                      <label className="form-label" htmlFor="hospital-name">
                        Nome ospedale
                      </label>
                      <input
                        className="form-control"
                        id="hospital-name"
                        type="text"
                        value={name}
                        onChange={(event) => {
                          setName(event.target.value);
                          setError("");
                        }}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="hospital-director">
                        Direttore sanitario
                      </label>
                      <input
                        className="form-control"
                        id="hospital-director"
                        type="text"
                        value={director}
                        onChange={(event) => {
                          setDirector(event.target.value);
                          setError("");
                        }}
                        required
                      />
                    </div>

                    <fieldset className="hospital-departments-fieldset">
                      <legend className="form-label">Reparti</legend>
                      {visibleDepartmentTemplates.length === 0 && <div className="alert alert-info py-2">Inserisci prima almeno un reparto dalla sezione Reparti.</div>}
                      <label className="form-check hospital-select-all-departments mb-3">
                        <input className="form-check-input" type="checkbox" checked={allDefaultDepartmentsSelected} onChange={toggleAllDepartments} disabled={visibleDepartmentTemplates.length === 0} />
                        <span className="form-check-label fw-semibold">Seleziona tutti i reparti</span>
                      </label>
                      <div className="hospital-default-departments">
                        {visibleDepartmentTemplates.map((departmentTemplate) => {
                          const selectedDepartment = departments.find(
                            (department) => department.templateId === departmentTemplate.id || department.name.toLowerCase() === departmentTemplate.name.toLowerCase(),
                          );
                          return <div className={`hospital-default-department ${selectedDepartment ? "selected" : ""}`} key={departmentTemplate.id}>
                            <label className="form-check mb-0">
                              <input className="form-check-input" type="checkbox" checked={Boolean(selectedDepartment)} onChange={() => toggleDepartment(departmentTemplate)} />
                              <span className="form-check-label">{departmentTemplate.name}</span>
                            </label>
                            {selectedDepartment && <input className="form-control form-control-sm mt-2" type="text" value={selectedDepartment.head || ""} onChange={(event) => updateDepartment(selectedDepartment.id, "head", event.target.value)} aria-label={`Primario di ${departmentTemplate.name}`} placeholder="Primario (facoltativo)" />}
                          </div>;
                        })}
                      </div>

                      {departments.filter((department) => !visibleDepartmentTemplates.some((template) => template.id === department.templateId || template.name.toLowerCase() === department.name.toLowerCase())).length > 0 && <div className="mt-3">
                        <div className="form-label">Altri reparti già salvati</div>
                        <div className="hospital-department-list">
                          {departments.filter((department) => !visibleDepartmentTemplates.some((template) => template.id === department.templateId || template.name.toLowerCase() === department.name.toLowerCase())).map((department) => <div className="hospital-department-row" key={department.id}>
                            <input className="form-control form-control-sm" type="text" value={department.name} onChange={(event) => updateDepartment(department.id, "name", event.target.value)} aria-label="Nome reparto" required />
                            <input className="form-control form-control-sm" type="text" value={department.head || ""} onChange={(event) => updateDepartment(department.id, "head", event.target.value)} aria-label={`Primario di ${department.name}`} placeholder="Primario (facoltativo)" />
                            <button className="btn btn-outline-danger btn-sm" type="button" aria-label={`Rimuovi ${department.name}`} onClick={() => removeDepartment(department.id)}>&times;</button>
                          </div>)}
                        </div>
                      </div>}
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
                <div className="card-header hospital-list-header">
                  <h2 className="card-title">Elenco ospedali</h2>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 mobile-card-table hospital-list-table">
                      <thead>
                        <tr>
                          <th>Ospedale</th>
                          <th>Direttore sanitario</th>
                          <th>Reparti</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleHospitals.length === 0 ? (
                          <tr>
                            <td className="text-center text-secondary py-4" colSpan="4">
                              Nessun ospedale inserito.
                            </td>
                          </tr>
                        ) : (
                          visibleHospitals.map((hospital) => {
                            const uncoveredDepartmentCount = getUncoveredDepartmentCount(hospital);
                            return (
                            <tr
                              className="hospital-clickable-row"
                              key={hospital.id}
                              role="button"
                              tabIndex="0"
                              onClick={() => handleEdit(hospital)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  handleEdit(hospital);
                                }
                              }}
                            >
                              <td className="fw-medium" data-label="Ospedale">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span>{hospital.name}</span>
                                  <button className="badge text-bg-primary border-0 hospital-department-count" type="button" onClick={(event) => { event.stopPropagation(); setDepartmentListHospital(normalizeHospital(hospital)); }}>{hospital.departments.length} reparti</button>
                                  {uncoveredDepartmentCount > 0 && <button className="badge text-bg-danger border-0 hospital-department-count" type="button" aria-label={`${uncoveredDepartmentCount} reparti senza CAS in ${hospital.name}`} onClick={(event) => { event.stopPropagation(); setDepartmentListHospital(normalizeHospital(hospital)); }}>{uncoveredDepartmentCount} senza CAS</button>}
                                </div>
                              </td>
                              <td data-label="Direttore">{hospital.director || "-"}</td>
                              <td data-label="Reparti">
                                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={(event) => { event.stopPropagation(); setDepartmentListHospital(normalizeHospital(hospital)); }}>
                                  Visualizza reparti
                                </button>
                              </td>
                              <td className="text-end" data-label="Azioni">
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); handleEdit(hospital); }}
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
