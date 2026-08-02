import { useState } from "react";

const roles = ["Admin", "Presidente", "CAS", "GVP"];

const getCasId = (user) =>
  user.role === "GVP" ? user.casId || user.associationId || "" : "";

const getPresidentId = (user, users) => {
  if (user.presidentId) {
    return user.presidentId;
  }

  if (user.role === "CAS") {
    return user.associationId || "";
  }

  if (user.role === "GVP") {
    const casUser = users.find((candidate) => candidate.id === getCasId(user));
    return casUser?.presidentId || casUser?.associationId || "";
  }

  return "";
};

const createEmptyForm = (role, manager, users) => {
  const isPresident = manager?.role === "Presidente";
  const isCas = manager?.role === "CAS";

  return {
    username: "",
    password: "",
    role,
    presidentId: isPresident
      ? manager.id
      : isCas
        ? getPresidentId(manager, users)
        : "",
    casId: isCas ? manager.id : "",
    hospitalId: "",
    departmentId: "",
  };
};

export const Users = ({ users, setUsers, hospitals = [], manager = null }) => {
  const isPresidentManager = manager?.role === "Presidente";
  const isCasManager = manager?.role === "CAS";
  const isTeamManager = isPresidentManager || isCasManager;
  const availableRoles = isPresidentManager
    ? ["CAS", "GVP"]
    : isCasManager
      ? ["GVP"]
      : manager?.role === "Admin"
        ? ["Presidente"]
        : roles;
  const [form, setForm] = useState(() =>
    createEmptyForm(availableRoles[0], manager, users),
  );
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const isEditing = editingId !== null;
  const editingUser = users.find((user) => user.id === editingId);
  const managerPresidentId = isPresidentManager
    ? manager.id
    : isCasManager
      ? getPresidentId(manager, users)
      : "";
  const formPresidentId = isTeamManager
    ? managerPresidentId
    : form.presidentId;
  const availableHospitals = hospitals.filter(
    (hospital) => hospital.presidentId === formPresidentId,
  );
  const presidentCandidates = users.filter(
    (user) => user.role === "Presidente" && user.id !== editingId,
  );
  const casCandidates = users.filter(
    (user) =>
      user.role === "CAS" &&
      user.id !== editingId &&
      getPresidentId(user, users) === form.presidentId,
  );

  const visibleUsers = isPresidentManager
    ? users.filter(
        (user) =>
          (user.role === "CAS" || user.role === "GVP") &&
          getPresidentId(user, users) === manager.id,
      )
    : isCasManager
      ? users.filter(
          (user) => user.role === "GVP" && getCasId(user) === manager.id,
        )
      : manager?.role === "Admin"
        ? users.filter((user) => user.role === "Presidente")
        : users;

  const resetForm = () => {
    setForm(createEmptyForm(availableRoles[0], manager, users));
    setEditingId(null);
    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => {
      if (name === "role") {
        const associations = createEmptyForm(value, manager, users);
        return {
          ...current,
          role: value,
          presidentId: associations.presidentId,
          casId: associations.casId,
        };
      }

      return {
        ...current,
        [name]: value,
        ...(name === "presidentId" ? { casId: "" } : {}),
        ...(name === "hospitalId" ? { departmentId: "" } : {}),
      };
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const username = form.username.trim();
    const role = availableRoles.includes(form.role) ? form.role : availableRoles[0];
    const presidentId = isTeamManager
      ? managerPresidentId
      : role === "CAS" || role === "GVP"
        ? form.presidentId
        : "";
    const validPresidentId = users.some(
      (user) => user.id === presidentId && user.role === "Presidente",
    )
      ? presidentId
      : "";
    const validCasId =
      role === "GVP" &&
      users.some(
        (user) =>
          user.id === form.casId &&
          user.role === "CAS" &&
          getPresidentId(user, users) === validPresidentId,
      )
        ? form.casId
        : "";
    const selectedHospital =
      role === "CAS"
        ? availableHospitals.find(
            (hospital) => hospital.id === form.hospitalId,
          )
        : null;
    const hospitalId = selectedHospital?.id || "";
    const departmentId =
      selectedHospital?.departments.some(
        (department) => department.id === form.departmentId,
      )
        ? form.departmentId
        : "";

    if (!username) {
      setError("Inserisci un nome utente.");
      return;
    }

    if ((role === "CAS" || role === "GVP") && !validPresidentId) {
      setError("Seleziona un Presidente.");
      return;
    }

    const isDuplicate = users.some(
      (user) =>
        user.username.toLowerCase() === username.toLowerCase() &&
        user.id !== editingId,
    );

    if (isDuplicate) {
      setError("Il nome utente esiste gia.");
      return;
    }

    if (!isEditing && !form.password) {
      setError("Inserisci una password.");
      return;
    }

    const updatedUser = {
      username,
      role,
      presidentId: validPresidentId,
      casId: validCasId,
      hospitalId,
      departmentId,
      associationId: role === "CAS" ? validPresidentId : validCasId,
    };

    if (isEditing) {
      setUsers((current) =>
        current.map((user) => {
          if (user.id === editingId) {
            return {
              ...user,
              ...updatedUser,
              ...(form.password ? { password: form.password } : {}),
            };
          }

          if (
            editingUser?.role === "CAS" &&
            user.role === "GVP" &&
            getCasId(user) === editingId
          ) {
            return role === "CAS"
              ? {
                  ...user,
                  presidentId: validPresidentId,
                  casId: editingId,
                  associationId: editingId,
                }
              : {
                  ...user,
                  casId: "",
                  associationId: "",
                };
          }

          return user;
        }),
      );
    } else {
      setUsers((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          ...updatedUser,
          password: form.password,
        },
      ]);
    }

    resetForm();
  };

  const handleEdit = (user) => {
    if (isTeamManager && !visibleUsers.some((item) => item.id === user.id)) {
      return;
    }

    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      role: availableRoles.includes(user.role) ? user.role : availableRoles[0],
      presidentId: getPresidentId(user, users),
      casId: getCasId(user),
      hospitalId: user.hospitalId || "",
      departmentId: user.departmentId || "",
    });
    setError("");
  };

  const handleDelete = (user) => {
    const canDelete =
      manager?.role === "Admin" ||
      (isTeamManager && visibleUsers.some((item) => item.id === user.id));

    if (!canDelete || user.id === manager?.id) {
      return;
    }

    const userIdsToDelete = new Set([user.id]);

    if (user.role === "Presidente") {
      users
        .filter((candidate) => getPresidentId(candidate, users) === user.id)
        .forEach((candidate) => userIdsToDelete.add(candidate.id));
    }

    if (user.role === "CAS") {
      users
        .filter(
          (candidate) =>
            candidate.role === "GVP" && getCasId(candidate) === user.id,
        )
        .forEach((candidate) => userIdsToDelete.add(candidate.id));
    }

    const descendantCount = userIdsToDelete.size - 1;
    const message =
      descendantCount > 0
        ? `Eliminare ${user.username} e ${descendantCount} utenti collegati?`
        : `Eliminare l'utente ${user.username}?`;

    if (!globalThis.confirm(message)) {
      return;
    }

    setUsers((current) =>
      current.filter((item) => !userIdsToDelete.has(item.id)),
    );
    resetForm();
  };

  const getAssociationLabel = (user) => {
    const president = users.find(
      (candidate) => candidate.id === getPresidentId(user, users),
    );

    if (user.role === "CAS") {
      return president?.username || "";
    }

    if (user.role === "GVP") {
      const casUser = users.find((candidate) => candidate.id === getCasId(user));
      return casUser
        ? `${casUser.username} / ${president?.username || "-"}`
        : president?.username || "";
    }

    return null;
  };

  const getHospitalLabel = (user) => {
    if (user.role !== "CAS" || !user.hospitalId) {
      return "";
    }

    const hospital = hospitals.find(
      (candidate) => candidate.id === user.hospitalId,
    );
    const department = hospital?.departments.find(
      (candidate) => candidate.id === user.departmentId,
    );

    return hospital
      ? department
        ? `${hospital.name} / ${department.name}`
        : `${hospital.name} / Intero ospedale`
      : "";
  };

  const orderedUsers = [];
  const addedUserIds = new Set();
  const addUser = (user) => {
    if (user && !addedUserIds.has(user.id)) {
      orderedUsers.push(user);
      addedUserIds.add(user.id);
    }
  };

  const presidents = users.filter((user) => user.role === "Presidente");
  presidents.forEach((president) => {
    if (visibleUsers.some((user) => user.id === president.id)) {
      addUser(president);
    }

    const casUsers = visibleUsers.filter(
      (user) =>
        user.role === "CAS" && getPresidentId(user, users) === president.id,
    );
    casUsers.forEach((casUser) => {
      addUser(casUser);
      visibleUsers
        .filter(
          (user) => user.role === "GVP" && getCasId(user) === casUser.id,
        )
        .forEach(addUser);
    });

    visibleUsers
      .filter(
        (user) =>
          user.role === "GVP" &&
          getPresidentId(user, users) === president.id &&
          !getCasId(user),
      )
      .forEach(addUser);
  });
  visibleUsers.filter((user) => !addedUserIds.has(user.id)).forEach(addUser);

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <h1 className="mb-0">
            {isPresidentManager
              ? "La mia squadra"
              : isCasManager
                ? "I miei GVP"
                : manager?.role === "Admin"
                  ? "Presidenti"
                  : "Utenti"}
          </h1>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <div className="row g-3">
            <div className="col-12 col-lg-5">
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    {isEditing ? "Modifica utente" : "Inserisci utente"}
                  </h2>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="card-body">
                    {error && (
                      <div className="alert alert-danger py-2" role="alert">
                        {error}
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="form-label" htmlFor="user-username">
                        Nome utente
                      </label>
                      <input
                        className="form-control"
                        id="user-username"
                        name="username"
                        type="text"
                        value={form.username}
                        onChange={handleChange}
                        autoComplete="username"
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="user-role">Ruolo</label>
                      <select
                        className="form-select"
                        id="user-role"
                        name="role"
                        value={form.role}
                        onChange={handleChange}
                        required
                      >
                        {availableRoles.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>

                    {!isTeamManager &&
                      (form.role === "CAS" || form.role === "GVP") && (
                        <div className="mb-3">
                          <label className="form-label" htmlFor="user-president">
                            Presidente
                          </label>
                          <select
                            className="form-select"
                            id="user-president"
                            name="presidentId"
                            value={form.presidentId}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Seleziona Presidente</option>
                            {presidentCandidates.map((president) => (
                              <option key={president.id} value={president.id}>
                                {president.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                    {form.role === "GVP" && (
                      <div className="mb-3">
                        <label className="form-label" htmlFor="user-cas">
                          CAS associato
                        </label>
                        <select
                          className="form-select"
                          id="user-cas"
                          name="casId"
                          value={form.casId}
                          onChange={handleChange}
                        >
                          <option value="">Nessun CAS</option>
                          {casCandidates.map((casUser) => (
                            <option key={casUser.id} value={casUser.id}>
                              {casUser.id === manager?.id
                                ? `${casUser.username} (io)`
                                : casUser.username}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {form.role === "CAS" && (
                      <>
                        <div className="mb-3">
                          <label className="form-label" htmlFor="user-hospital">
                            Ospedale
                          </label>
                          <select
                            className="form-select"
                            id="user-hospital"
                            name="hospitalId"
                            value={form.hospitalId}
                            onChange={handleChange}
                          >
                            <option value="">Nessun ospedale</option>
                            {availableHospitals.map((hospital) => (
                              <option key={hospital.id} value={hospital.id}>
                                {hospital.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {form.hospitalId && (
                          <div className="mb-3">
                            <label
                              className="form-label"
                              htmlFor="user-department"
                            >
                              Reparto
                            </label>
                            <select
                              className="form-select"
                              id="user-department"
                              name="departmentId"
                              value={form.departmentId}
                              onChange={handleChange}
                            >
                              <option value="">Intero ospedale</option>
                              {availableHospitals
                                .find(
                                  (hospital) =>
                                    hospital.id === form.hospitalId,
                                )
                                ?.departments.map((department) => (
                                  <option
                                    key={department.id}
                                    value={department.id}
                                  >
                                    {department.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    <div className="mb-0">
                      <label className="form-label" htmlFor="user-password">
                        Password
                      </label>
                      <input
                        className="form-control"
                        id="user-password"
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required={!isEditing}
                      />
                      {isEditing && (
                        <div className="form-text">
                          Lascia vuoto per mantenere la password attuale.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card-footer d-flex align-items-center gap-2">
                    {isEditing && editingUser && (
                      <button
                        className="btn btn-outline-danger me-auto"
                        type="button"
                        disabled={editingUser.id === manager?.id}
                        onClick={() => handleDelete(editingUser)}
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

            <div className="col-12 col-lg-7">
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    {manager?.role === "Admin" ? "Elenco presidenti" : "Elenco utenti"}
                  </h2>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Nome utente</th>
                          <th>Ruolo</th>
                          <th>Associato a</th>
                          <th>Sede</th>
                          <th>Password</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUsers.length === 0 ? (
                          <tr>
                            <td className="text-center text-secondary py-4" colSpan="6">
                              Nessun utente inserito.
                            </td>
                          </tr>
                        ) : (
                          orderedUsers.map((user) => {
                            const associationLabel = getAssociationLabel(user);
                            const hospitalLabel = getHospitalLabel(user);
                            const casId = getCasId(user);
                            const depth =
                              user.role === "CAS" || (user.role === "GVP" && !casId)
                                ? "depth-1"
                                : "depth-2";
                            const requiresPresident =
                              user.role === "CAS" || user.role === "GVP";
                            const isUnassigned =
                              requiresPresident && !getPresidentId(user, users);

                            return (
                              <tr
                                className={isUnassigned ? "user-row-unassigned" : ""}
                                key={user.id}
                              >
                                <td className="fw-medium">
                                  {requiresPresident && (
                                    <span
                                      className={`user-link-arrow ${depth} ${
                                        isUnassigned
                                          ? "is-unassigned"
                                          : "is-associated"
                                      }`}
                                      aria-hidden="true"
                                    >
                                      &rarr;
                                    </span>
                                  )}
                                  {user.username}
                                </td>
                                <td>
                                  <span className="badge text-bg-secondary">
                                    {roles.includes(user.role) ? user.role : "Admin"}
                                  </span>
                                </td>
                                <td>
                                  {associationLabel ? (
                                    <span className="badge text-bg-success association-badge">
                                      {associationLabel}
                                    </span>
                                  ) : requiresPresident ? (
                                    <span className="badge text-bg-warning association-badge">
                                      Senza Presidente
                                    </span>
                                  ) : (
                                    <span className="text-secondary">-</span>
                                  )}
                                </td>
                                <td>
                                  {user.role === "CAS" ? (
                                    hospitalLabel ? (
                                      <span className="badge text-bg-info association-badge">
                                        {hospitalLabel}
                                      </span>
                                    ) : (
                                      <span className="text-secondary">
                                        Nessuna sede
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-secondary">-</span>
                                  )}
                                </td>
                                <td aria-label="Password impostata">********</td>
                                <td className="text-end">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    type="button"
                                    onClick={() => handleEdit(user)}
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
