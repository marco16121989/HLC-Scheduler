import { useState } from "react";

export const Departments = ({ departments, setDepartments, hospitals, presidentId }) => {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");

  const visibleDepartments = departments.filter(
    (department) => department.presidentId === presidentId,
  );
  const isEditing = editingId !== null;

  const resetForm = () => {
    setName("");
    setEditingId(null);
    setModalOpen(false);
    setError("");
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEdit = (department) => {
    setName(department.name || "");
    setEditingId(department.id);
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Inserisci il nome del reparto.");
      return;
    }
    const duplicate = visibleDepartments.some(
      (department) => department.id !== editingId &&
        department.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (duplicate) {
      setError("Il reparto è già presente.");
      return;
    }

    if (isEditing) {
      setDepartments((current) => current.map((department) =>
        department.id === editingId ? { ...department, name: normalizedName } : department,
      ));
    } else {
      setDepartments((current) => [
        ...current,
        { id: crypto.randomUUID(), name: normalizedName, presidentId },
      ]);
    }
    resetForm();
  };

  const handleDelete = () => {
    const department = visibleDepartments.find((item) => item.id === editingId);
    if (!department) return;
    const usedBy = hospitals.filter((hospital) =>
      hospital.presidentId === presidentId &&
      hospital.departments?.some((item) =>
        item.templateId === department.id ||
        item.name?.toLowerCase() === department.name.toLowerCase(),
      ),
    );
    if (usedBy.length > 0) {
      setError(`Il reparto è utilizzato da ${usedBy.length} ospedale/i e non può essere eliminato.`);
      return;
    }
    if (!globalThis.confirm(`Eliminare il reparto “${department.name}”?`)) return;
    setDepartments((current) => current.filter((item) => item.id !== editingId));
    resetForm();
  };

  return <>
    <div className="app-content-header">
      <div className="container-fluid">
        <div className="d-flex align-items-center justify-content-between gap-3">
          <h1 className="mb-0">Reparti</h1>
          <button className="btn btn-primary" type="button" onClick={openCreateModal}>Inserisci</button>
        </div>
      </div>
    </div>
    <div className="app-content">
      <div className="container-fluid">
        {modalOpen && <button className="entity-modal-backdrop" type="button" aria-label="Chiudi finestra" onClick={resetForm} />}
        <div className={modalOpen ? "entity-modal-shell" : "d-none"} role="dialog" aria-modal="true" aria-labelledby="department-modal-title">
          <section className="card entity-modal-card">
            <div className="card-header d-flex align-items-center">
              <h2 className="card-title" id="department-modal-title">{isEditing ? "Modifica reparto" : "Inserisci reparto"}</h2>
              <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={resetForm} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="card-body">
                {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                <label className="form-label" htmlFor="department-name">Nome reparto</label>
                <input className="form-control" id="department-name" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} required autoFocus />
              </div>
              <div className="card-footer d-flex align-items-center gap-2">
                {isEditing && <button className="btn btn-outline-danger me-auto" type="button" onClick={handleDelete}>Elimina</button>}
                <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>Annulla</button>
                <button className="btn btn-primary" type="submit">{isEditing ? "Salva modifiche" : "Inserisci"}</button>
              </div>
            </form>
          </section>
        </div>
        <section className="card">
          <div className="card-header mobile-list-header"><h2 className="card-title">Elenco reparti</h2></div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 mobile-card-table department-list-table">
                <thead><tr><th>Reparto</th><th>Ospedali associati</th><th className="text-end">Azioni</th></tr></thead>
                <tbody>{visibleDepartments.length === 0
                  ? <tr><td className="text-center text-secondary py-4" colSpan="3">Nessun reparto inserito.</td></tr>
                  : visibleDepartments.map((department) => {
                    const hospitalCount = hospitals.filter((hospital) => hospital.presidentId === presidentId && hospital.departments?.some((item) => item.templateId === department.id || item.name?.toLowerCase() === department.name.toLowerCase())).length;
                    return <tr className="department-clickable-row" key={department.id} role="button" tabIndex="0" onClick={() => handleEdit(department)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleEdit(department); } }}><td className="fw-medium" data-label="Reparto">{department.name}</td><td data-label="Ospedali">{hospitalCount}</td><td className="text-end" data-label="Azioni"><button className="btn btn-outline-primary btn-sm" type="button" onClick={(event) => { event.stopPropagation(); handleEdit(department); }}>Modifica</button></td></tr>;
                  })}</tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  </>;
};
