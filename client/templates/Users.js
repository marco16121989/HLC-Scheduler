import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { formatUserName } from "/imports/utils/formatUserName";

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

export const getDefaultPresidentId = (role, manager, users) => {
  if (!manager) {
    return "";
  }

  if (manager.role === "Presidente") {
    return manager.id;
  }

  if (manager.role === "CAS" && (role === "CAS" || role === "GVP")) {
    const directPresidentId = manager.presidentId || manager.associationId || "";
    if (directPresidentId) {
      return directPresidentId;
    }

    const matchingPresident = users.find(
      (candidate) => candidate.role === "Presidente" && candidate.id === manager.id,
    );
    if (matchingPresident) {
      return matchingPresident.id;
    }

    return getPresidentId(manager, users);
  }

  return "";
};

const getHospitalAssignments = (user) =>
  Array.isArray(user.hospitalAssignments)
    ? user.hospitalAssignments
    : user.hospitalId
      ? [{
          hospitalId: user.hospitalId,
          departmentIds: user.departmentId ? [user.departmentId] : [],
        }]
      : [];

const createEmptyForm = (role, manager, users) => {
  const isPresident = manager?.role === "Presidente";
  const isCas = manager?.role === "CAS";

  return {
    username: "",
    password: "",
    role,
    presidentId: getDefaultPresidentId(role, manager, users),
    casId: isCas ? manager.id : "",
    hospitalAssignments: [],
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
  const [casFilter, setCasFilter] = useState("all");
  const [teamTab, setTeamTab] = useState("associated");
  const formHospitalAssignments = Array.isArray(form.hospitalAssignments)
    ? form.hospitalAssignments
    : form.hospitalId
      ? [{
          hospitalId: form.hospitalId,
          departmentIds: form.departmentId ? [form.departmentId] : [],
        }]
      : [];

  const isEditing = editingId !== null;
  const editingUser = users.find((user) => user.id === editingId);
  const managerPresidentId = isPresidentManager
    ? manager.id
    : isCasManager
      ? getDefaultPresidentId("GVP", manager, users)
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
          (user) =>
            user.role === "GVP" &&
            getPresidentId(user, users) === managerPresidentId &&
            (!getCasId(user) || getCasId(user) === manager.id),
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
      };
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const username = formatUserName(form.username);
    const role = availableRoles.includes(form.role) ? form.role : availableRoles[0];
    const presidentId = isTeamManager
      ? managerPresidentId || getDefaultPresidentId(role, manager, users)
      : role === "CAS" || role === "GVP"
        ? form.presidentId || getDefaultPresidentId(role, manager, users)
        : "";
    const validPresidentId = users.some(
      (user) => user.id === presidentId && user.role === "Presidente",
    )
      ? presidentId
      : "";
    const validCasId =
      role === "GVP" &&
      (
        (manager?.role === "CAS" && form.casId === manager.id) ||
        users.some(
          (user) =>
            user.id === form.casId &&
            user.role === "CAS" &&
            (manager?.role === "CAS"
              ? user.id === manager.id
              : getPresidentId(user, users) === validPresidentId),
        )
      )
        ? form.casId
        : "";
    const hospitalAssignments = role === "CAS"
      ? formHospitalAssignments.flatMap((assignment) => {
          const hospital = availableHospitals.find(
            (item) => item.id === assignment.hospitalId,
          );
          if (!hospital) return [];
          const departmentIds = assignment.departmentIds.filter((departmentId) =>
            (hospital.departments || []).some(
              (department) => department.id === departmentId,
            ),
          );
          return [{ hospitalId: hospital.id, departmentIds }];
        })
      : [];
    const firstAssignment = hospitalAssignments[0];

    if (!username) {
      setError("Inserisci un nome utente.");
      return;
    }

    if (role === "CAS" && !validPresidentId) {
      setError("Impossibile determinare il presidente del CAS.");
      return;
    }

    if (role === "GVP" && !validPresidentId) {
      const inheritedPresidentId = getDefaultPresidentId(role, manager, users);
      if (!inheritedPresidentId) {
        setError("Impossibile determinare il presidente del CAS.");
        return;
      }
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

    const resolvedPresidentId = role === "GVP" && !validPresidentId
      ? getDefaultPresidentId(role, manager, users)
      : validPresidentId;
    const updatedUser = {
      username,
      role,
      presidentId: resolvedPresidentId,
      casId: validCasId,
      hospitalAssignments,
      hospitalId: firstAssignment?.hospitalId || "",
      departmentId: firstAssignment?.departmentIds[0] || "",
      associationId: role === "CAS" ? resolvedPresidentId : validCasId,
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
      hospitalAssignments: getHospitalAssignments(user),
    });
    setError("");
  };

  const toggleHospital = (hospitalId) => {
    setForm((current) => {
      const currentAssignments = getHospitalAssignments(current);
      const selected = currentAssignments.some(
        (assignment) => assignment.hospitalId === hospitalId,
      );
      return {
        ...current,
        hospitalAssignments: selected
          ? currentAssignments.filter(
              (assignment) => assignment.hospitalId !== hospitalId,
            )
          : [...currentAssignments, { hospitalId, departmentIds: [] }],
      };
    });
    setError("");
  };

  const toggleDepartment = (hospitalId, departmentId) => {
    setForm((current) => ({
      ...current,
      hospitalAssignments: getHospitalAssignments(current).map((assignment) => {
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

  const togglePresidentActive = (user) => {
    const willActivate = Boolean(user.disabled);
    const action = willActivate ? "riattivare" : "disattivare";
    if (!globalThis.confirm(`Vuoi ${action} ${user.username} e tutti i suoi CAS e GVP?`)) return;
    Meteor.call("hlc.setPresidentActive", user.id, willActivate, (methodError) => {
      if (methodError) globalThis.alert(methodError.reason || "Impossibile aggiornare lo stato.");
    });
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
      return casUser?.username || "";
    }

    return null;
  };

  const getHospitalLabels = (user) =>
    user.role === "CAS"
      ? getHospitalAssignments(user).flatMap((assignment) => {
          const hospital = hospitals.find(
            (candidate) => candidate.id === assignment.hospitalId,
          );
          if (!hospital) return [];
          const departments = (hospital.departments || []).filter((department) =>
            assignment.departmentIds.includes(department.id),
          );
          return departments.length > 0
            ? departments.map((department) => `${hospital.name} / ${department.name}`)
            : [`${hospital.name} / Intero ospedale`];
        })
      : [];

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

  const canFilterTeam = manager?.role === "Admin" || isPresidentManager || isCasManager;
  const filterPresidentId = isPresidentManager ? manager.id : "";
  const filterCasUsers = isCasManager
    ? [manager]
    : users.filter(
        (user) =>
          user.role === "CAS" &&
          (!filterPresidentId || getPresidentId(user, users) === filterPresidentId),
      );
  const selectedFilterCas = filterCasUsers.find((user) => user.id === casFilter);
  const tabbedOrderedUsers = isTeamManager
    ? orderedUsers.filter((user) =>
        teamTab === "free"
          ? user.role === "GVP" && !getCasId(user)
          : user.role === "CAS" || (user.role === "GVP" && Boolean(getCasId(user))),
      )
    : orderedUsers;
  const filteredOrderedUsers = !canFilterTeam || casFilter === "all"
    ? tabbedOrderedUsers
    : manager?.role === "Admin"
      ? tabbedOrderedUsers.filter((user) => {
          const matchesCas = !selectedFilterCas ||
            getPresidentId(selectedFilterCas, users) === user.id;
          return matchesCas;
        })
      : tabbedOrderedUsers.filter((user) => {
          if (user.role === "CAS") {
            return casFilter !== "all" && user.id === casFilter;
          }
          if (user.role !== "GVP") return false;
          return casFilter === "all" || getCasId(user) === casFilter;
        });

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <h1 className="mb-0">
            {isPresidentManager
              ? "La mia squadra"
              : isCasManager
                ? "GVP assegnati e liberi"
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
                      <fieldset className="mb-3">
                        <legend className="form-label">Ospedali e reparti</legend>
                        {availableHospitals.length === 0 ? (
                          <p className="text-secondary small mb-0">
                            Nessun ospedale disponibile.
                          </p>
                        ) : (
                          <div className="profile-hospitals">
                            {availableHospitals.map((hospital) => {
                              const assignment = formHospitalAssignments.find(
                                (item) => item.hospitalId === hospital.id,
                              );
                              return (
                                <article className={`profile-hospital ${assignment ? "selected" : ""}`} key={hospital.id}>
                                  <label className="form-check profile-hospital-title">
                                    <input className="form-check-input" type="checkbox" checked={Boolean(assignment)} onChange={() => toggleHospital(hospital.id)} />
                                    <span className="form-check-label"><strong>{hospital.name}</strong></span>
                                  </label>
                                  {assignment && (hospital.departments || []).length > 0 && (
                                    <div className="profile-departments">
                                      {hospital.departments.map((department) => (
                                        <label className="form-check" key={department.id}>
                                          <input className="form-check-input" type="checkbox" checked={assignment.departmentIds.includes(department.id)} onChange={() => toggleDepartment(hospital.id, department.id)} />
                                          <span className="form-check-label">{department.name}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        )}
                        <div className="form-text">
                          Se non selezioni reparti, il CAS viene associato all'intero ospedale.
                        </div>
                      </fieldset>
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
                  {isTeamManager && (
                    <ul className="nav nav-tabs px-3 pt-3" role="tablist" aria-label="Visualizzazione squadra">
                      <li className="nav-item" role="presentation">
                        <button
                          className={`nav-link ${teamTab === "associated" ? "active" : ""}`}
                          type="button"
                          role="tab"
                          aria-selected={teamTab === "associated"}
                          onClick={() => {
                            setTeamTab("associated");
                            setCasFilter("all");
                          }}
                        >
                          {isPresidentManager ? "CAS e GVP associati" : "GVP associati"}
                        </button>
                      </li>
                      <li className="nav-item" role="presentation">
                        <button
                          className={`nav-link ${teamTab === "free" ? "active" : ""}`}
                          type="button"
                          role="tab"
                          aria-selected={teamTab === "free"}
                          onClick={() => {
                            setTeamTab("free");
                            setCasFilter("all");
                          }}
                        >
                          GVP liberi
                        </button>
                      </li>
                    </ul>
                  )}
                  {canFilterTeam && (!isTeamManager || teamTab === "associated") && (
                    <div className="row g-3 p-3 border-bottom">
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="users-cas-filter">Filtra per CAS</label>
                        <select
                          className="form-select"
                          id="users-cas-filter"
                          value={casFilter}
                          onChange={(event) => setCasFilter(event.target.value)}
                        >
                          <option value="all">Tutti i CAS</option>
                          {filterCasUsers.map((casUser) => (
                            <option key={casUser.id} value={casUser.id}>{casUser.username}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        {manager?.role === "Admin" ? (
                        <tr>
                          <th>Presidente</th>
                          <th>Numero CAS</th>
                          <th>Numero GVP</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                        ) : (
                        <tr>
                          <th className="user-name-column">Nome utente</th>
                          <th>Ruolo</th>
                          <th>Associato a</th>
                          <th>Sede</th>
                          <th>Password</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                        )}
                      </thead>
                      <tbody>
                        {filteredOrderedUsers.length === 0 ? (
                          <tr>
                            <td className="text-center text-secondary py-4" colSpan={manager?.role === "Admin" ? "4" : "6"}>
                              {casFilter !== "all"
                                ? "Nessun utente corrisponde ai filtri selezionati."
                                : isTeamManager && teamTab === "free"
                                  ? "Nessun GVP libero presente."
                                : manager?.role === "Admin"
                                  ? "Nessun presidente inserito."
                                  : "Nessun utente inserito."}
                            </td>
                          </tr>
                        ) : (
                          filteredOrderedUsers.map((user) => {
                            const associationLabel = getAssociationLabel(user);
                            const hospitalLabels = getHospitalLabels(user);
                            const casId = getCasId(user);
                            const depth =
                              user.role === "CAS" || (user.role === "GVP" && !casId)
                                ? "depth-1"
                                : "depth-2";
                            const requiresPresident =
                              user.role === "CAS" || user.role === "GVP";
                            const isUnassigned =
                              requiresPresident && !getPresidentId(user, users);
                            const casCount = users.filter(
                              (candidate) => candidate.role === "CAS" && getPresidentId(candidate, users) === user.id,
                            ).length;
                            const gvpCount = users.filter(
                              (candidate) => candidate.role === "GVP" && getPresidentId(candidate, users) === user.id,
                            ).length;

                            if (manager?.role === "Admin") {
                              return (
                                <tr key={user.id}>
                                  <td className="fw-medium">{user.username} {user.disabled && <span className="badge text-bg-danger ms-2">Disattivato</span>}</td>
                                  <td><span className="badge text-bg-primary user-count-badge">{casCount}</span></td>
                                  <td><span className="badge text-bg-info user-count-badge">{gvpCount}</span></td>
                                  <td className="text-end"><div className="d-inline-flex gap-2"><button className={`btn btn-sm ${user.disabled ? "btn-outline-success" : "btn-outline-danger"}`} type="button" onClick={() => togglePresidentActive(user)}>{user.disabled ? "Attiva" : "Disattiva"}</button><button className="btn btn-outline-primary btn-sm" type="button" onClick={() => handleEdit(user)}>Modifica</button></div></td>
                                </tr>
                              );
                            }

                            return (
                              <tr
                                className={isUnassigned ? "user-row-unassigned" : ""}
                                key={user.id}
                              >
                                <td className="fw-medium user-name-column">
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
                                  ) : user.role === "GVP" && getPresidentId(user, users) ? (
                                    <span className="badge text-bg-light association-badge">
                                      Nessun CAS
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
                                    hospitalLabels.length > 0 ? (
                                      <div className="d-flex flex-wrap gap-1">
                                        {hospitalLabels.map((label) => (
                                          <span className="badge text-bg-info association-badge" key={label}>
                                            {label}
                                          </span>
                                        ))}
                                      </div>
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
