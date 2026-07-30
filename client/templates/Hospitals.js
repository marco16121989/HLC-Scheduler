import { useState } from "react";
import { normalizeHospital } from "../utils/hospitals.js";

export const Hospitals = ({ hospitals, setHospitals, presidentId }) => {
  const [name, setName] = useState("");
  const [director, setDirector] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentHead, setDepartmentHead] = useState("");
  const [departments, setDepartments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const isEditing = editingId !== null;
  const visibleHospitals = hospitals.filter(
    (hospital) => hospital.presidentId === presidentId,
  );
  const resetForm = () => {
    setName("");
    setDirector("");
    setDepartmentName("");
    setDepartmentHead("");
    setDepartments([]);
    setEditingId(null);
    setError("");
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const addDepartment = () => {
    const normalizedName = departmentName.trim();
    const normalizedHead = departmentHead.trim();

    if (!normalizedName || !normalizedHead) {
      setError("Inserisci nome del reparto e Primario.");
      return;
    }

    const isDuplicate = departments.some(
      (department) =>
        department.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (isDuplicate) {
      setError("Il reparto e gia presente.");
      return;
    }

    setDepartments((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: normalizedName,
        head: normalizedHead,
      },
    ]);
    setDepartmentName("");
    setDepartmentHead("");
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
      (department) => !department.name.trim() || !department.head.trim(),
    );

    if (incompleteDepartment) {
      setError("Completa nome e Primario di ogni reparto.");
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
      departments: departments.map((department) => ({
        ...department,
        name: department.name.trim(),
        head: department.head.trim(),
      })),
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
    setEditingId(normalizedHospital.id);
    setName(normalizedHospital.name);
    setDirector(normalizedHospital.director);
    setDepartments(normalizedHospital.departments);
    setDepartmentName("");
    setDepartmentHead("");
    setError("");
    setModalOpen(true);
  };

  const handleDelete = () => {
    const hospital = hospitals.find((item) => item.id === editingId);

    if (!hospital || !globalThis.confirm(`Eliminare ${hospital.name}?`)) {
      return;
    }

    setHospitals((current) =>
      current.filter((item) => item.id !== editingId),
    );
    resetForm();
  };

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <h1 className="mb-0">Ospedali</h1>
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
                      <div className="row g-2">
                        <div className="col-12 col-sm-5">
                          <input
                            className="form-control"
                            type="text"
                            value={departmentName}
                            onChange={(event) => {
                              setDepartmentName(event.target.value);
                              setError("");
                            }}
                            placeholder="Nome reparto"
                          />
                        </div>
                        <div className="col-12 col-sm-5">
                          <input
                            className="form-control"
                            type="text"
                            value={departmentHead}
                            onChange={(event) => {
                              setDepartmentHead(event.target.value);
                              setError("");
                            }}
                            placeholder="Primario"
                          />
                        </div>
                        <div className="col-12 col-sm-2 d-grid">
                          <button
                            className="btn btn-outline-primary"
                            type="button"
                            onClick={addDepartment}
                            title="Aggiungi reparto"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {departments.length > 0 && (
                        <div className="hospital-department-list">
                          {departments.map((department) => (
                            <div className="hospital-department-row" key={department.id}>
                              <input
                                className="form-control form-control-sm"
                                type="text"
                                value={department.name}
                                onChange={(event) =>
                                  updateDepartment(
                                    department.id,
                                    "name",
                                    event.target.value,
                                  )
                                }
                                aria-label="Nome reparto"
                                required
                              />
                              <input
                                className="form-control form-control-sm"
                                type="text"
                                value={department.head}
                                onChange={(event) =>
                                  updateDepartment(
                                    department.id,
                                    "head",
                                    event.target.value,
                                  )
                                }
                                aria-label={`Primario di ${department.name}`}
                                placeholder="Primario"
                                required
                              />
                              <button
                                className="btn btn-outline-danger btn-sm"
                                type="button"
                                aria-label={`Rimuovi ${department.name}`}
                                title="Rimuovi reparto"
                                onClick={() => removeDepartment(department.id)}
                              >
                                &times;
                              </button>
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
                  <h2 className="card-title">Elenco ospedali</h2>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Ospedale</th>
                          <th>Direttore sanitario</th>
                          <th>Reparti e primari</th>
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
                          visibleHospitals.map((hospital) => (
                            <tr key={hospital.id}>
                              <td className="fw-medium">{hospital.name}</td>
                              <td>{hospital.director || "-"}</td>
                              <td>
                                {hospital.departments.length > 0 ? (
                                  <div className="hospital-department-summary">
                                    {hospital.departments.map((department) => (
                                      <div key={department.id}>
                                        <strong>{department.name}</strong>
                                        <span>Primario: {department.head || "-"}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-secondary">Nessun reparto</span>
                                )}
                              </td>
                              <td className="text-end">
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  type="button"
                                  onClick={() => handleEdit(hospital)}
                                >
                                  Modifica
                                </button>
                              </td>
                            </tr>
                          ))
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
