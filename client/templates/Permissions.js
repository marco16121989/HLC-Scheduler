import { useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { MANAGEABLE_PAGES, getPagePermission } from "/imports/constants/pagePermissions";

const SearchableUserSelect = ({ casUsers, gvpUsers, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const allUsers = [...casUsers, ...gvpUsers];
  const selectedUser = allUsers.find((user) => user.id === value);
  const selectedLabel = value === "role:CAS"
    ? "Tutti i CAS"
    : value === "role:GVP"
      ? "Tutti i GVP"
      : selectedUser?.username || "Seleziona un utente o un gruppo";
  const normalizedSearch = search.trim().toLocaleLowerCase("it");
  const filterUsers = (items) => items.filter((user) =>
    !normalizedSearch || (user.username || "").toLocaleLowerCase("it").includes(normalizedSearch));
  const filteredCasUsers = filterUsers(casUsers);
  const filteredGvpUsers = filterUsers(gvpUsers);
  const selectValue = (nextValue) => {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
  };

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return <div className="dropdown mb-4" ref={containerRef}>
    <button className="form-select text-start" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{selectedLabel}</button>
    {open && <div className="dropdown-menu show w-100 p-2 shadow" role="listbox">
      <input className="form-control mb-2" type="search" placeholder="Cerca utente per nome" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
      <div className="overflow-auto" style={{ maxHeight: "18rem" }}>
        {!normalizedSearch && <>
          <h6 className="dropdown-header">Applica a tutti</h6>
          <button className={`dropdown-item ${value === "role:CAS" ? "active" : ""}`} type="button" onClick={() => selectValue("role:CAS")}>Tutti i CAS</button>
          <button className={`dropdown-item ${value === "role:GVP" ? "active" : ""}`} type="button" onClick={() => selectValue("role:GVP")}>Tutti i GVP</button>
        </>}
        {filteredCasUsers.length > 0 && <><h6 className="dropdown-header">CAS</h6>{filteredCasUsers.map((user) => <button className={`dropdown-item ${value === user.id ? "active" : ""}`} type="button" role="option" aria-selected={value === user.id} key={user.id} onClick={() => selectValue(user.id)}>{user.username}</button>)}</>}
        {filteredGvpUsers.length > 0 && <><h6 className="dropdown-header">GVP</h6>{filteredGvpUsers.map((user) => <button className={`dropdown-item ${value === user.id ? "active" : ""}`} type="button" role="option" aria-selected={value === user.id} key={user.id} onClick={() => selectValue(user.id)}>{user.username}</button>)}</>}
        {filteredCasUsers.length === 0 && filteredGvpUsers.length === 0 && <div className="text-secondary small px-3 py-2">Nessun utente trovato.</div>}
      </div>
    </div>}
  </div>;
};

export const Permissions = ({ users, presidentId, canEdit = false }) => {
  const managedUsers = users.filter((user) => ["CAS", "GVP"].includes(user.role) && (user.presidentId === presidentId || user.associationId === presidentId));
  const sortByUsername = (first, second) => (first.username || "").localeCompare(second.username || "", "it", { sensitivity: "base" });
  const casUsers = managedUsers.filter((user) => user.role === "CAS").sort(sortByUsername);
  const gvpUsers = managedUsers.filter((user) => user.role === "GVP").sort(sortByUsername);
  const [userId, setUserId] = useState("");
  const [permissions, setPermissions] = useState({});
  const [message, setMessage] = useState("");
  const selectedRole = userId.startsWith("role:") ? userId.slice(5) : "";
  const selectedUser = selectedRole ? { role: selectedRole } : managedUsers.find((user) => user.id === userId);
  useEffect(() => {
    if (!selectedUser) { setPermissions({}); return; }
    setPermissions(Object.fromEntries(MANAGEABLE_PAGES.map(([pageId]) => [pageId, getPagePermission(selectedUser, pageId)])));
    setMessage("");
  }, [userId, selectedUser?.pagePermissions]);
  const toggle = (pageId, field) => setPermissions((current) => {
    const next = { ...current[pageId], [field]: !current[pageId]?.[field] };
    if (field === "view" && !next.view) next.edit = false;
    if (field === "edit" && next.edit) next.view = true;
    return { ...current, [pageId]: next };
  });
  const save = () => Meteor.call(selectedRole ? "hlc.updateRolePagePermissions" : "hlc.updatePagePermissions", selectedRole || userId, permissions, (error) => setMessage(error ? error.reason || "Impossibile salvare i permessi." : selectedRole ? `Permessi applicati a tutti i ${selectedRole}.` : "Permessi salvati."));
  return <><div className="app-content-header"><div className="container-fluid"><h1 className="mb-1">Permessi</h1><p className="text-secondary mb-0">Definisci quali sezioni ogni CAS o GVP può visualizzare e modificare.</p></div></div><div className="app-content"><div className="container-fluid"><section className="card"><div className="card-body">{!canEdit && <div className="alert alert-info py-2">Puoi consultare i permessi, ma non modificarli.</div>}<label className="form-label">Utente o gruppo</label><SearchableUserSelect casUsers={casUsers} gvpUsers={gvpUsers} value={userId} onChange={setUserId} />{selectedUser && <>{selectedRole && canEdit && <div className="alert alert-warning py-2">Le modifiche verranno applicate a tutti gli utenti {selectedRole} dell’organizzazione.</div>}<div className="table-responsive"><table className="table align-middle"><thead><tr><th>Sezione</th><th className="text-center">Visualizza</th><th className="text-center">Modifica</th></tr></thead><tbody>{MANAGEABLE_PAGES.map(([pageId, label]) => <tr key={pageId}><td>{label}</td><td className="text-center"><input className="form-check-input" type="checkbox" checked={Boolean(permissions[pageId]?.view)} disabled={!canEdit} onChange={() => toggle(pageId, "view")} /></td><td className="text-center"><input className="form-check-input" type="checkbox" checked={Boolean(permissions[pageId]?.edit)} disabled={!canEdit} onChange={() => toggle(pageId, "edit")} /></td></tr>)}</tbody></table></div>{canEdit && <div className="d-flex align-items-center justify-content-end gap-3">{message && <span className={message.includes("salvat") || message.includes("applicati") ? "text-success" : "text-danger"}>{message}</span>}<button className="btn btn-primary" type="button" onClick={save}>{selectedRole ? `Applica a tutti i ${selectedRole}` : "Salva permessi"}</button></div>}</>}</div></section></div></div></>;
};
