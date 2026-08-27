import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { formatUserName } from "/imports/utils/formatUserName";

const formFromUser = (user) => ({
  username: user.username || "",
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  email: user.email || "",
  phone: user.phone || "",
  password: "",
  confirmPassword: "",
  hospitalAssignments: user.hospitalAssignments || (user.hospitalId ? [{
    hospitalId: user.hospitalId,
    departmentIds: user.departmentId ? [user.departmentId] : [],
  }] : []),
});

export const Profile = ({ currentUser, hospitals = [] }) => {
  const [form, setForm] = useState(() => formFromUser(currentUser));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [hospitalModalOpen, setHospitalModalOpen] = useState(false);
  const [assignmentsBeforeEdit, setAssignmentsBeforeEdit] = useState([]);
  const availableHospitals = currentUser.role === "Admin"
    ? hospitals
    : hospitals.filter((hospital) => hospital.presidentId === (
      currentUser.role === "Presidente"
        ? currentUser.id
        : currentUser.presidentId || currentUser.associationId
    ));
  const assignedHospitals = availableHospitals.filter((hospital) =>
    form.hospitalAssignments.some((assignment) => assignment.hospitalId === hospital.id),
  );

  useEffect(() => {
    setForm((current) => ({ ...formFromUser(currentUser), password: current.password, confirmPassword: current.confirmPassword }));
  }, [currentUser]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const toggleHospital = (hospitalId) => {
    setForm((current) => {
      const selected = current.hospitalAssignments.some((item) => item.hospitalId === hospitalId);
      return {
        ...current,
        hospitalAssignments: selected
          ? current.hospitalAssignments.filter((item) => item.hospitalId !== hospitalId)
          : [...current.hospitalAssignments, { hospitalId, departmentIds: [] }],
      };
    });
    setError("");
    setSuccess("");
  };

  const toggleDepartment = (hospitalId, departmentId) => {
    setForm((current) => ({
      ...current,
      hospitalAssignments: current.hospitalAssignments.map((assignment) => {
        if (assignment.hospitalId !== hospitalId) return assignment;
        const selected = assignment.departmentIds.includes(departmentId);
        return {
          ...assignment,
          departmentIds: selected
            ? assignment.departmentIds.filter((id) => id !== departmentId)
            : [...assignment.departmentIds, departmentId],
        };
      }),
    }));
    setError("");
    setSuccess("");
  };

  const openHospitalModal = () => {
    setAssignmentsBeforeEdit(form.hospitalAssignments.map((assignment) => ({
      ...assignment,
      departmentIds: [...assignment.departmentIds],
    })));
    setHospitalModalOpen(true);
  };

  const cancelHospitalModal = () => {
    setForm((current) => ({ ...current, hospitalAssignments: assignmentsBeforeEdit }));
    setHospitalModalOpen(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.username.trim()) {
      setError("Il nome utente è obbligatorio.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }
    setSaving(true);
    Meteor.call("hlc.updateMyProfile", {
      username: formatUserName(form.username),
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      password: form.password,
      hospitalAssignments: form.hospitalAssignments,
    }, (methodError) => {
      setSaving(false);
      if (methodError) {
        setError(methodError.reason || "Impossibile aggiornare il profilo.");
        return;
      }
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
      setSuccess("Profilo aggiornato correttamente.");
    });
  };

  return (
    <>
      <div className="app-content-header"><div className="container-fluid"><h1 className="mb-1">Il mio profilo</h1><p className="text-secondary mb-0">Aggiorna i tuoi dati personali e le strutture di riferimento.</p></div></div>
      <div className="app-content"><div className="container-fluid"><div className="row justify-content-center"><div className="col-12 col-xl-9">
        <section className="card profile-card">
          <div className="card-header d-flex align-items-center gap-3">
            <div className="profile-avatar" aria-hidden="true">{(form.firstName || form.username || "U").charAt(0).toUpperCase()}</div>
            <div><h2 className="card-title mb-1">{[form.firstName, form.lastName].filter(Boolean).join(" ") || form.username}</h2><span className="badge text-bg-primary">{currentUser.role}</span></div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="card-body">
              {error && <div className="alert alert-danger" role="alert">{error}</div>}
              {success && <div className="alert alert-success" role="status">{success}</div>}
              <div className="row g-3">
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-first-name">Nome</label><input className="form-control" id="profile-first-name" name="firstName" value={form.firstName} onChange={update} /></div>
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-last-name">Cognome</label><input className="form-control" id="profile-last-name" name="lastName" value={form.lastName} onChange={update} /></div>
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-username">Nome utente</label><input className="form-control" id="profile-username" name="username" value={form.username} onChange={update} autoComplete="username" required /></div>
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-role">Ruolo</label><input className="form-control" id="profile-role" value={currentUser.role} readOnly disabled /></div>
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-email">E-mail</label><input className="form-control" id="profile-email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" /></div>
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-phone">Telefono</label><input className="form-control" id="profile-phone" name="phone" type="tel" value={form.phone} onChange={update} autoComplete="tel" /></div>
              </div>
              {["Presidente", "CAS"].includes(currentUser.role) && <><hr className="my-4" />
              <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                <h3 className="h6 mb-0">I miei ospedali</h3>
                <button className="btn btn-outline-primary btn-sm" type="button" onClick={openHospitalModal}>Modifica</button>
              </div>
              {assignedHospitals.length === 0 ? (
                <p className="text-secondary mb-0">Nessun ospedale associato al profilo.</p>
              ) : (
                <div className="profile-hospitals">
                  {assignedHospitals.map((hospital) => {
                    const assignment = form.hospitalAssignments.find((item) => item.hospitalId === hospital.id);
                    return (
                      <article className="profile-hospital selected" key={hospital.id}>
                        <h4>{hospital.name}</h4>
                        {hospital.director && <p>Direttore sanitario: {hospital.director}</p>}
                        {assignment.departmentIds.length > 0 && <div className="profile-department-badges">{hospital.departments?.filter((department) => assignment.departmentIds.includes(department.id)).map((department) => <span className="badge text-bg-secondary" key={department.id}>{department.name}</span>)}</div>}
                      </article>
                    );
                  })}
                </div>
              )}
              {hospitalModalOpen && <button className="entity-modal-backdrop" type="button" aria-label="Annulla modifica ospedali" onClick={cancelHospitalModal} />}
              <div className={hospitalModalOpen ? "entity-modal-shell" : "d-none"} role="dialog" aria-modal="true" aria-labelledby="profile-hospitals-modal-title">
                <section className="card entity-modal-card">
                  <div className="card-header d-flex align-items-center"><h3 className="card-title" id="profile-hospitals-modal-title">Modifica ospedali e reparti</h3><button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={cancelHospitalModal} /></div>
                  <div className="card-body">
                    {availableHospitals.length === 0 ? <p className="text-secondary mb-0">Nessun ospedale disponibile per la tua organizzazione.</p> : <div className="profile-hospitals">{availableHospitals.map((hospital) => {
                      const assignment = form.hospitalAssignments.find((item) => item.hospitalId === hospital.id);
                      return <article className={`profile-hospital ${assignment ? "selected" : ""}`} key={hospital.id}>
                        <label className="form-check profile-hospital-title"><input className="form-check-input" type="checkbox" checked={Boolean(assignment)} onChange={() => toggleHospital(hospital.id)} /><span className="form-check-label"><strong>{hospital.name}</strong></span></label>
                        {hospital.director && <p>Direttore sanitario: {hospital.director}</p>}
                        {assignment && hospital.departments?.length > 0 && <fieldset className="profile-departments"><legend>Reparti</legend>{hospital.departments.map((department) => <label className="form-check" key={department.id}><input className="form-check-input" type="checkbox" checked={assignment.departmentIds.includes(department.id)} onChange={() => toggleDepartment(hospital.id, department.id)} /><span className="form-check-label">{department.name}</span></label>)}</fieldset>}
                      </article>;
                    })}</div>}
                  </div>
                  <div className="card-footer d-flex justify-content-end gap-2"><button className="btn btn-outline-secondary" type="button" onClick={cancelHospitalModal}>Annulla</button><button className="btn btn-primary" type="button" onClick={() => setHospitalModalOpen(false)}>Applica</button></div>
                </section>
              </div></>}
              <hr className="my-4" />
              <h3 className="h6">Cambia password</h3><p className="text-secondary small">Lascia entrambi i campi vuoti per mantenere la password attuale.</p>
              <div className="row g-3">
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-password">Nuova password</label><input className="form-control" id="profile-password" name="password" type="password" value={form.password} onChange={update} minLength="4" autoComplete="new-password" /></div>
                <div className="col-12 col-md-6"><label className="form-label" htmlFor="profile-confirm-password">Conferma password</label><input className="form-control" id="profile-confirm-password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} minLength="4" autoComplete="new-password" /></div>
              </div>
            </div>
            <div className="card-footer text-end"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Salva profilo"}</button></div>
          </form>
        </section>
      </div></div></div></div>
    </>
  );
};
