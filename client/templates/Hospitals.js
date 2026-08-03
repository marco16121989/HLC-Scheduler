import { useState } from "react";
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

export const Hospitals = ({ hospitals, setHospitals, presidentId }) => {
  const [name, setName] = useState("");
  const [director, setDirector] = useState("");
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
    setDepartments([]);
    setEditingId(null);
    setError("");
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const toggleDepartment = (departmentName) => {
    setDepartments((current) => {
      const selected = current.find(
        (department) => department.name.toLowerCase() === departmentName.toLowerCase(),
      );
      return selected
        ? current.filter((department) => department.id !== selected.id)
        : [...current, { id: crypto.randomUUID(), name: departmentName, head: "" }];
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
      departments: departments.map((department) => ({
        ...department,
        name: department.name.trim(),
        head: (department.head || "").trim(),
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
                      <div className="hospital-default-departments">
                        {DEFAULT_DEPARTMENTS.map((departmentName) => {
                          const selectedDepartment = departments.find(
                            (department) => department.name.toLowerCase() === departmentName.toLowerCase(),
                          );
                          return <div className={`hospital-default-department ${selectedDepartment ? "selected" : ""}`} key={departmentName}>
                            <label className="form-check mb-0">
                              <input className="form-check-input" type="checkbox" checked={Boolean(selectedDepartment)} onChange={() => toggleDepartment(departmentName)} />
                              <span className="form-check-label">{departmentName}</span>
                            </label>
                            {selectedDepartment && <input className="form-control form-control-sm mt-2" type="text" value={selectedDepartment.head || ""} onChange={(event) => updateDepartment(selectedDepartment.id, "head", event.target.value)} aria-label={`Primario di ${departmentName}`} placeholder="Primario (facoltativo)" />}
                          </div>;
                        })}
                      </div>

                      {departments.filter((department) => !DEFAULT_DEPARTMENTS.some((name) => name.toLowerCase() === department.name.toLowerCase())).length > 0 && <div className="mt-3">
                        <div className="form-label">Altri reparti già salvati</div>
                        <div className="hospital-department-list">
                          {departments.filter((department) => !DEFAULT_DEPARTMENTS.some((name) => name.toLowerCase() === department.name.toLowerCase())).map((department) => <div className="hospital-department-row" key={department.id}>
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
