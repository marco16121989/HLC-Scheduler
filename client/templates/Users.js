import { useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { formatUserName } from "/imports/utils/formatUserName";
import { confirmAction } from "./ConfirmDialog.js";
import { getPagePermission } from "/imports/constants/pagePermissions";

const roles = ["Admin", "Presidente", "CAS", "GVP"];

const CasMultiSelect = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);
  const selectedIds = Array.isArray(value) ? value : [];
  const selectedOptions = options.filter((option) => selectedIds.includes(option.id));
  const filteredOptions = options.filter((option) =>
    option.username.toLocaleLowerCase("it-IT").includes(search.trim().toLocaleLowerCase("it-IT")),
  );

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const toggleOption = (optionId) => {
    onChange(selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId]);
  };

  return (
    <div className="position-relative" ref={rootRef}>
      <button
        className="form-select text-start h-auto"
        id="user-cas"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selectedOptions.length > 0 ? (
          <span className="d-flex flex-wrap gap-1 pe-3">
            {selectedOptions.map((option) => (
              <span className="badge text-bg-primary" key={option.id}>{option.username}</span>
            ))}
          </span>
        ) : <span className="text-secondary">Seleziona uno o più CAS</span>}
      </button>
      {open && (
        <div className="dropdown-menu show w-100 p-2 shadow" style={{ maxHeight: "18rem", overflowY: "auto", zIndex: 1050 }}>
          <input
            className="form-control mb-2"
            type="search"
            placeholder="Cerca CAS..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          {filteredOptions.length === 0 ? (
            <div className="small text-secondary p-2">Nessun CAS trovato.</div>
          ) : filteredOptions.map((option) => (
            <label className="dropdown-item d-flex align-items-center gap-2" key={option.id}>
              <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={selectedIds.includes(option.id)}
                onChange={() => toggleOption(option.id)}
              />
              <span>{option.username}</span>
            </label>
          ))}
          {selectedIds.length > 0 && (
            <button className="btn btn-link btn-sm px-2 mt-1" type="button" onClick={() => onChange([])}>
              Rimuovi tutte le selezioni
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const getCasIds = (user) => {
  if (user.role !== "GVP") return [];
  if (Array.isArray(user.casIds)) return [...new Set(user.casIds.filter(Boolean))];
  const legacyCasId = user.casId || user.associationId || "";
  return legacyCasId ? [legacyCasId] : [];
};

const getCasId = (user) => getCasIds(user)[0] || "";

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
  const isGvp = manager?.role === "GVP";

  return {
    username: "",
    password: "",
    role,
    presidentId: getDefaultPresidentId(role, manager, users),
    casId: isCas ? manager.id : isGvp ? getCasId(manager) : "",
    casIds: isCas ? [manager.id] : isGvp ? getCasIds(manager) : [],
    hospitalAssignments: [],
    canInsertCas: false,
    canInsertGvp: false,
    isSecretary: false,
    casMembership: "",
  };
};

export const Users = ({ users, setUsers, hospitals = [], manager = null, managedRole = null }) => {
  const isPresidentManager = manager?.role === "Presidente";
  const isCasManager = manager?.role === "CAS";
  const isGvpManager = manager?.role === "GVP";
  const isTeamManager = isPresidentManager || isCasManager || isGvpManager;
  const canCreateManagedRole = isPresidentManager ||
    (managedRole === "CAS" && getPagePermission(manager, "cas").edit) ||
    (managedRole === "GVP" && getPagePermission(manager, "gvp").edit) ||
    !managedRole;
  const availableRoles = managedRole
    ? [managedRole]
    : isPresidentManager
    ? ["CAS", "GVP"]
    : isCasManager
      ? ["GVP"]
      : isGvpManager
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
  const [hospitalFilter, setHospitalFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  useEffect(() => {
    const role = managedRole || availableRoles[0];
    setForm(createEmptyForm(role, manager, users));
    setEditingId(null);
    setError("");
    setCasFilter("all");
    setHospitalFilter("all");
    setDepartmentFilter("all");
    setMobileFormOpen(false);
  }, [managedRole, manager?.id]);
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
      : isGvpManager
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
      getPresidentId(user, users) === formPresidentId,
  );

  const organizationUsers = isTeamManager
    ? users.filter((user) =>
        (user.role === "CAS" || user.role === "GVP") &&
        getPresidentId(user, users) === managerPresidentId)
    : [];
  const visibleUsers = managedRole && isTeamManager
    ? managedRole === "GVP"
      ? organizationUsers
      : organizationUsers.filter((user) => user.role === managedRole)
    : isPresidentManager
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

  const closeMobileForm = () => {
    resetForm();
    setMobileFormOpen(false);
  };

  const canEditUser = (user) =>
    isPresidentManager ||
    (isCasManager && getPagePermission(manager, "cas").edit && user.role === "CAS" && user.id !== manager.id) ||
    (isCasManager && getPagePermission(manager, "gvp").edit && user.role === "GVP" && getPresidentId(user, users) === managerPresidentId);
  const canEditManagedUser = (user) =>
    canEditUser(user) ||
    (isGvpManager && getPagePermission(manager, "gvp").edit && user.role === "GVP");

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
        ...(name === "presidentId" ? { casIds: [] } : {}),
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
    const validPresidentId = (
      (isTeamManager && presidentId === managerPresidentId) ||
      users.some((user) => user.id === presidentId && user.role === "Presidente")
    )
      ? presidentId
      : "";
    const requestedCasIds = Array.isArray(form.casIds)
      ? form.casIds
      : form.casId ? [form.casId] : [];
    const validCasIds = role === "GVP"
      ? [...new Set(requestedCasIds)].filter((casId) => users.some(
          (user) => user.id === casId && user.role === "CAS" &&
            getPresidentId(user, users) === (manager?.role === "CAS" ? managerPresidentId : validPresidentId),
        ))
      : [];
    const validCasId = validCasIds[0] || "";
    const hospitalAssignments = ["CAS", "GVP"].includes(role)
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
      casIds: validCasIds,
      hospitalAssignments,
      hospitalId: firstAssignment?.hospitalId || "",
      departmentId: firstAssignment?.departmentIds[0] || "",
      associationId: role === "CAS" ? resolvedPresidentId : validCasId,
      canInsertCas: role === "CAS"
        ? isPresidentManager
          ? Boolean(form.canInsertCas)
          : Boolean(editingUser?.canInsertCas)
        : false,
      canInsertGvp: role === "CAS"
        ? isPresidentManager
          ? Boolean(form.canInsertGvp)
          : Boolean(editingUser?.canInsertGvp)
        : false,
      isSecretary: role === "CAS" ? Boolean(form.isSecretary) : false,
      casMembership: role === "Presidente" ? form.casMembership.trim() : "",
      ...(role === "GVP" ? {
        canInsertGvp: (isPresidentManager || isCasManager)
          ? Boolean(form.canInsertGvp)
          : Boolean(editingUser?.canInsertGvp),
      } : {}),
    };

    if (isEditing) {
      if (role === "CAS") {
        try {
          await Meteor.callAsync("hlc.updateCasHospitalAssignments", editingId, hospitalAssignments);
        } catch (methodError) {
          setError(methodError.reason || "Impossibile salvare ospedali e reparti del CAS.");
          return;
        }
      }
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
            getCasIds(user).includes(editingId)
          ) {
            return role === "CAS"
              ? {
                  ...user,
                  presidentId: validPresidentId,
                  casId: editingId,
                  casIds: [...new Set([...getCasIds(user).filter((id) => id !== editingId), editingId])],
                  associationId: editingId,
                }
              : {
                  ...user,
                  casId: getCasIds(user).filter((id) => id !== editingId)[0] || "",
                  casIds: getCasIds(user).filter((id) => id !== editingId),
                  associationId: getCasIds(user).filter((id) => id !== editingId)[0] || "",
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
    setMobileFormOpen(false);
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
      casIds: getCasIds(user),
      hospitalAssignments: getHospitalAssignments(user),
      canInsertCas: Boolean(user.canInsertCas),
      canInsertGvp: Boolean(user.canInsertGvp),
      isSecretary: Boolean(user.isSecretary),
      casMembership: user.casMembership || "",
    });
    setError("");
    setMobileFormOpen(true);
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

  const handleDelete = async (user) => {
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
            candidate.role === "GVP" && getCasIds(candidate).includes(user.id),
        )
        .forEach((candidate) => userIdsToDelete.add(candidate.id));
    }

    const descendantCount = userIdsToDelete.size - 1;
    const message =
      descendantCount > 0
        ? `Eliminare ${user.username} e ${descendantCount} utenti collegati?`
        : `Eliminare l'utente ${user.username}?`;

    if (!await confirmAction(message)) {
      return;
    }

    setUsers((current) =>
      current.filter((item) => !userIdsToDelete.has(item.id)),
    );
    resetForm();
    setMobileFormOpen(false);
  };

  const togglePresidentActive = async (user) => {
    const willActivate = Boolean(user.disabled);
    const action = willActivate ? "riattivare" : "disattivare";
    if (!await confirmAction(`Vuoi ${action} ${user.username} e tutti i suoi CAS e GVP?`, { title: "Conferma operazione", confirmLabel: willActivate ? "Riattiva" : "Disattiva", tone: willActivate ? "primary" : "danger" })) return;
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
      return users
        .filter((candidate) => getCasIds(user).includes(candidate.id))
        .map((candidate) => candidate.username)
        .join(", ");
    }

    return null;
  };

  const getHospitalLabels = (user) =>
    ["CAS", "GVP"].includes(user.role)
      ? getHospitalAssignments(user).flatMap((assignment) => {
          const hospital = hospitals.find(
            (candidate) => candidate.id === assignment.hospitalId,
          );
          if (!hospital) return [];
          const departments = (hospital.departments || []).filter((department) =>
            assignment.departmentIds.includes(department.id),
          ).sort((first, second) => (first.name || "").localeCompare(second.name || "", "it-IT"));
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
  if (managedRole === "GVP") {
    visibleUsers
      .filter((user) => user.role === "CAS")
      .forEach((casUser) => {
        addUser(casUser);
        visibleUsers
          .filter((user) => user.role === "GVP" && getCasIds(user).includes(casUser.id))
          .forEach((user) => {
            orderedUsers.push({ ...user, _rowKey: `${casUser.id}-${user.id}` });
            addedUserIds.add(user.id);
          });
      });
    visibleUsers
      .filter((user) => user.role === "GVP" && !getCasId(user))
      .forEach((user) => {
        orderedUsers.push({ ...user, _rowKey: `free-${user.id}` });
        addedUserIds.add(user.id);
      });
  }
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
          (user) => user.role === "GVP" && getCasIds(user).includes(casUser.id),
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
  const filterPresidentId = isTeamManager ? managerPresidentId : "";
  const filterCasUsers = users.filter(
    (user) =>
      user.role === "CAS" &&
      (!filterPresidentId || getPresidentId(user, users) === filterPresidentId),
  );
  const selectedFilterCas = filterCasUsers.find((user) => user.id === casFilter);
  const filterableOrderedUsers = managedRole === "GVP"
    ? visibleUsers
        .filter((user) => user.role === "GVP")
        .sort((first, second) => first.username.localeCompare(second.username, "it-IT"))
    : orderedUsers;
  const casFilteredOrderedUsers = !canFilterTeam || casFilter === "all"
    ? filterableOrderedUsers
    : manager?.role === "Admin"
      ? filterableOrderedUsers.filter((user) => {
          const matchesCas = !selectedFilterCas ||
            getPresidentId(selectedFilterCas, users) === user.id;
          return matchesCas;
        })
      : filterableOrderedUsers.filter((user) => {
          if (user.role === "CAS") {
            return casFilter !== "all" && user.id === casFilter;
          }
          if (user.role !== "GVP") return false;
          return casFilter === "none" ? getCasIds(user).length === 0 : getCasIds(user).includes(casFilter);
        });
  const filterHospital = availableHospitals.find((hospital) => hospital.id === hospitalFilter);
  const filterDepartments = hospitalFilter === "all"
    ? availableHospitals.flatMap((hospital) => (hospital.departments || []).map((department) => ({ ...department, hospitalId: hospital.id, hospitalName: hospital.name })))
    : (filterHospital?.departments || []).map((department) => ({ ...department, hospitalId: filterHospital.id, hospitalName: filterHospital.name }));
  const filteredOrderedUsers = !["CAS", "GVP"].includes(managedRole)
    ? casFilteredOrderedUsers
    : casFilteredOrderedUsers.filter((user) => {
        const assignments = getHospitalAssignments(user);
        const matchesHospital = hospitalFilter === "all" || assignments.some((assignment) => assignment.hospitalId === hospitalFilter);
        const selectedDepartment = filterDepartments.find((department) => department.id === departmentFilter);
        const matchesDepartment = departmentFilter === "all" || assignments.some((assignment) =>
          assignment.hospitalId === selectedDepartment?.hospitalId && (
            !assignment.departmentIds?.length || assignment.departmentIds.includes(departmentFilter)
          ),
        );
        return matchesHospital && matchesDepartment;
      });

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div>
              <h1 className="mb-1">
                {managedRole
                  ? managedRole
                  : isPresidentManager
                  ? "La mia squadra"
                  : isCasManager
                    ? "GVP assegnati e liberi"
                    : manager?.role === "Admin"
                      ? "Presidenti"
                      : "Utenti"}
              </h1>
              <p className="text-secondary mb-0">Gestisci gli utenti, i ruoli e le assegnazioni della squadra.</p>
            </div>
            {canCreateManagedRole && (
              <button
                className="btn btn-primary users-mobile-insert"
                type="button"
                onClick={() => {
                  resetForm();
                  setMobileFormOpen(true);
                }}
              >
                Inserisci
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="app-content">
        <div className="container-fluid">
          <div className="row g-3">
            {canCreateManagedRole && <>
              {mobileFormOpen && (
                <button
                  className="users-mobile-modal-backdrop"
                  type="button"
                  aria-label="Chiudi finestra"
                  onClick={closeMobileForm}
                />
              )}
              <div className={`col-12 col-lg-5 users-form-column ${mobileFormOpen ? "is-mobile-open" : ""}`}>
              <section className="card users-form-card" role={mobileFormOpen ? "dialog" : undefined} aria-modal={mobileFormOpen ? "true" : undefined}>
                <div className="card-header users-form-header">
                  <h2 className="card-title">
                    {managedRole
                      ? `${isEditing ? "Modifica" : "Inserisci"} ${managedRole}`
                      : isEditing ? "Modifica utente" : "Inserisci utente"}
                  </h2>
                  <button
                    className="btn-close users-mobile-modal-close"
                    type="button"
                    aria-label="Chiudi"
                    onClick={closeMobileForm}
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

                    {!managedRole && (
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
                    )}

                    {form.role === "Presidente" && (
                      <div className="mb-3">
                        <label className="form-label" htmlFor="user-cas-membership">CAS di appartenenza</label>
                        <input
                          className="form-control"
                          id="user-cas-membership"
                          name="casMembership"
                          type="text"
                          value={form.casMembership || ""}
                          onChange={handleChange}
                          placeholder="Inserisci il CAS di appartenenza"
                        />
                      </div>
                    )}

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
                        <CasMultiSelect
                          options={casCandidates.map((casUser) => ({
                            ...casUser,
                            username: casUser.id === manager?.id ? `${casUser.username} (io)` : casUser.username,
                          }))}
                          value={form.casIds}
                          onChange={(casIds) => setForm((current) => ({ ...current, casIds }))}
                        />
                        <div className="form-text">Puoi selezionare più CAS. Non selezionarne alcuno per lasciare il GVP libero.</div>
                      </div>
                    )}

                    {["CAS", "GVP"].includes(form.role) && (
                      <fieldset className="mb-3">
                        <legend className="form-label">Ospedali e reparti associati</legend>
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
                                      {[...hospital.departments].sort((first, second) => (first.name || "").localeCompare(second.name || "", "it-IT")).map((department) => (
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
                          Se non selezioni reparti, il {form.role} viene associato all'intero ospedale.
                        </div>
                      </fieldset>
                    )}

                    {form.role === "CAS" && isPresidentManager && (
                      <div className="mb-3">
                        <div className="form-check form-switch mb-3">
                          <input
                            className="form-check-input"
                            id="user-is-secretary"
                            type="checkbox"
                            checked={Boolean(form.isSecretary)}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              isSecretary: event.target.checked,
                            }))}
                          />
                          <label className="form-check-label" htmlFor="user-is-secretary">
                            Segretario
                          </label>
                        </div>
                      </div>
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
                        onClick={closeMobileForm}
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
            </div></>}

            <div className={canCreateManagedRole ? "col-12 col-lg-7" : "col-12"}>
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    {manager?.role === "Admin" ? "Elenco presidenti" : managedRole ? `Elenco ${managedRole}` : "Elenco utenti"}
                  </h2>
                </div>
                <div className="card-body p-0">
                  {canFilterTeam && (
                    <div className="row g-3 p-3 border-bottom">
                      {managedRole !== "CAS" && <div className="col-12 col-md-6 col-xl-4">
                        <label className="form-label" htmlFor="users-cas-filter">Filtra per CAS</label>
                        <select
                          className="form-select"
                          id="users-cas-filter"
                          value={casFilter}
                          onChange={(event) => setCasFilter(event.target.value)}
                        >
                          <option value="all">{managedRole === "GVP" ? "Tutti i GVP" : "Tutti i CAS"}</option>
                          {managedRole === "GVP" && <option value="none">GVP non associati</option>}
                          {filterCasUsers.map((casUser) => (
                            <option key={casUser.id} value={casUser.id}>{casUser.username}</option>
                          ))}
                        </select>
                      </div>}
                      {["CAS", "GVP"].includes(managedRole) && <>
                        <div className="col-12 col-md-6 col-xl-4">
                          <label className="form-label" htmlFor="users-hospital-filter">Filtra per ospedale</label>
                          <select className="form-select" id="users-hospital-filter" value={hospitalFilter} onChange={(event) => { setHospitalFilter(event.target.value); setDepartmentFilter("all"); }}>
                            <option value="all">Tutti gli ospedali</option>
                            {availableHospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
                          </select>
                        </div>
                        <div className="col-12 col-md-6 col-xl-4">
                          <label className="form-label" htmlFor="users-department-filter">Filtra per reparto</label>
                          <select className="form-select" id="users-department-filter" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                            <option value="all">Tutti i reparti</option>
                            {filterDepartments.map((department) => <option key={`${department.hospitalId}:${department.id}`} value={department.id}>{department.name} — {department.hospitalName}</option>)}
                          </select>
                        </div>
                      </>}
                    </div>
                  )}
                  <div className="table-responsive">
                    <table className={`table table-hover align-middle mb-0 mobile-card-table ${managedRole === "CAS" ? "cas-list-table" : managedRole === "GVP" ? "gvp-list-table" : ""}`}>
                      <thead>
                        {manager?.role === "Admin" ? (
                        <tr>
                          <th>Presidente</th>
                          <th>CAS di appartenenza</th>
                          <th>Numero CAS</th>
                          <th>Numero GVP</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                        ) : (
                        <tr>
                          <th className="user-name-column">Nome utente</th>
                          {!managedRole && <th>Ruolo</th>}
                          {managedRole !== "CAS" && <th className="text-nowrap">Associato a</th>}
                          <th>Sede</th>
                          {!managedRole && <th>Password</th>}
                          <th className="text-end">Azioni</th>
                        </tr>
                        )}
                      </thead>
                      <tbody>
                        {filteredOrderedUsers.length === 0 ? (
                          <tr>
                            <td className="text-center text-secondary py-4" colSpan={manager?.role === "Admin" ? "5" : managedRole ? "5" : "6"}>
                              {casFilter !== "all" || hospitalFilter !== "all" || departmentFilter !== "all"
                                ? "Nessun utente corrisponde ai filtri selezionati."
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

                            if (managedRole === "GVP" && user.role === "CAS") {
                              return (
                                <tr className="table-light" key={user._rowKey || user.id}>
                                  <td className="fw-semibold" colSpan="5">
                                    CAS: {user.username}
                                  </td>
                                </tr>
                              );
                            }

                            if (manager?.role === "Admin") {
                              return (
                                <tr key={user.id}>
                                  <td className="fw-medium" data-label="Presidente">{user.username} {user.disabled && <span className="badge text-bg-danger ms-2">Disattivato</span>}</td>
                                  <td data-label="CAS di appartenenza">{user.casMembership || <span className="text-secondary">-</span>}</td>
                                  <td data-label="CAS"><span className="badge text-bg-primary user-count-badge">{casCount}</span></td>
                                  <td data-label="GVP"><span className="badge text-bg-info user-count-badge">{gvpCount}</span></td>
                                  <td className="text-end" data-label="Azioni"><div className="d-inline-flex gap-2"><button className={`btn btn-sm ${user.disabled ? "btn-outline-success" : "btn-outline-danger"}`} type="button" onClick={() => togglePresidentActive(user)}>{user.disabled ? "Attiva" : "Disattiva"}</button><button className="btn btn-outline-primary btn-sm" type="button" onClick={() => handleEdit(user)}>Modifica</button></div></td>
                                </tr>
                              );
                            }

                            return (
                              <tr
                                className={`${isUnassigned ? "user-row-unassigned" : ""} ${managedRole === "CAS" ? "cas-clickable-row" : managedRole === "GVP" ? "gvp-clickable-row" : ""}`}
                                key={user._rowKey || user.id}
                                role={["CAS", "GVP"].includes(managedRole) ? "button" : undefined}
                                tabIndex={["CAS", "GVP"].includes(managedRole) ? "0" : undefined}
                                onClick={["CAS", "GVP"].includes(managedRole) ? () => handleEdit(user) : undefined}
                                onKeyDown={["CAS", "GVP"].includes(managedRole) ? (event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleEdit(user);
                                  }
                                } : undefined}
                              >
                                <td className="fw-medium user-name-column" data-label="Utente">
                                  {managedRole === "CAS" && user.isSecretary && (
                                    <span className="cas-secretary-badge" aria-label="Segretario" title="Segretario">S</span>
                                  )}
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
                                {!managedRole && <td data-label="Ruolo">
                                  <span className="badge text-bg-secondary">
                                    {roles.includes(user.role) ? user.role : "Admin"}
                                  </span>
                                </td>}
                                {managedRole !== "CAS" && <td data-label="Associato a">
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
                                </td>}
                                <td data-label="Sede">
                                  {["CAS", "GVP"].includes(user.role) ? (
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
                                {!managedRole && <td aria-label="Password impostata" data-label="Password">********</td>}
                                <td className="text-end" data-label="Azioni">
                                  {canEditManagedUser(user) && <button
                                    className="btn btn-outline-primary btn-sm"
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); handleEdit(user); }}
                                  >
                                    Modifica
                                  </button>
                                  }
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
