import { useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { MANAGEABLE_PAGES, getPagePermission } from "/imports/constants/pagePermissions";

const PERMISSION_DESCRIPTIONS = {
  events: {
    view: "Consente di vedere gli eventi disponibili, aprirne i dettagli e, quando invitati, accettare o rifiutare l’invito.",
    edit: "Consente anche di creare eventi e gestire quelli creati, compresi invitati e informazioni dell’evento.",
  },
  "useful-files": {
    view: "Consente di consultare, aprire e scaricare i file utili dell’organizzazione.",
    edit: "Consente anche di caricare nuovi file e di eliminare quelli caricati personalmente.",
  },
  cas: {
    view: "Consente di consultare l’elenco dei CAS e le relative informazioni e associazioni.",
    edit: "Consente anche di inserire e modificare gli account CAS autorizzati.",
  },
  gvp: {
    view: "Consente di consultare l’elenco dei GVP, i contatti e le associazioni con CAS, ospedali e reparti.",
    edit: "Consente anche di inserire e modificare gli account GVP e le loro associazioni.",
  },
  hospitals: {
    view: "Consente di consultare gli ospedali, i loro dati e l’elenco dei reparti collegati.",
    edit: "Consente anche di inserire, modificare ed eliminare ospedali e di gestirne i reparti.",
  },
  departments: {
    view: "Consente di consultare l’elenco generale dei modelli di reparto.",
    edit: "Consente anche di inserire, rinominare ed eliminare i modelli di reparto non utilizzati.",
  },
  doctors: {
    view: "Consente di consultare l’elenco e la scheda dei medici in sola lettura. Le Note operative restano leggibili e ogni utente può aggiungere note ed eliminare le proprie.",
    edit: "Consente anche di inserire, modificare ed eliminare le anagrafiche dei medici, i contatti e le associazioni con ospedali e reparti.",
  },
  hospitality: {
    view: "Consente di consultare chi offre ospitalità, i contatti, il luogo e le condizioni di disponibilità.",
    edit: "Consente anche di inserire, modificare, disattivare ed eliminare le disponibilità di ospitalità.",
  },
  "patient-gvp-sharing": {
    view: "Mostra nella pagina Pazienti il pulsante per consultare quali informazioni vengono condivise con i GVP, senza poter cambiare i flag.",
    edit: "Consente anche di selezionare le informazioni da condividere e salvare lo schema valido per tutti i pazienti e i GVP assegnati.",
  },
  permissions: {
    view: "Consente di consultare i permessi assegnati agli utenti e ai gruppi, senza poterli cambiare.",
    edit: "Consente anche di modificare e salvare i permessi dei singoli utenti o di tutti i CAS e GVP.",
  },
};

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
  const [infoPageId, setInfoPageId] = useState("");
  const selectedRole = userId.startsWith("role:") ? userId.slice(5) : "";
  const selectedUser = selectedRole ? { role: selectedRole } : managedUsers.find((user) => user.id === userId);
  const permissionInfo = MANAGEABLE_PAGES.find(([pageId]) => pageId === infoPageId);
  useEffect(() => {
    if (!selectedUser) { setPermissions({}); return; }
    setPermissions(Object.fromEntries(MANAGEABLE_PAGES.map(([pageId]) => [pageId, getPagePermission(selectedUser, pageId)])));
  }, [userId, selectedUser?.pagePermissions]);
  useEffect(() => setMessage(""), [userId]);
  const toggle = (pageId, field) => setPermissions((current) => {
    const next = { ...current[pageId], [field]: !current[pageId]?.[field] };
    if (field === "view" && !next.view) next.edit = false;
    if (field === "edit" && next.edit) next.view = true;
    return { ...current, [pageId]: next };
  });
  const save = () => Meteor.call(selectedRole ? "hlc.updateRolePagePermissions" : "hlc.updatePagePermissions", selectedRole || userId, permissions, (error) => setMessage(error ? error.reason || "Impossibile salvare i permessi." : selectedRole ? `Permessi applicati a tutti i ${selectedRole}.` : "Permessi salvati."));
  return <>{permissionInfo && <><button className="entity-modal-backdrop" type="button" aria-label="Chiudi informazioni permesso" onClick={() => setInfoPageId("")} /><div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="permission-info-title"><section className="card entity-modal-card"><div className="card-header d-flex align-items-center"><h2 className="card-title" id="permission-info-title">Permessi — {permissionInfo[1]}</h2><button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={() => setInfoPageId("")} /></div><div className="card-body d-grid gap-3"><section className="border rounded p-3"><h3 className="h6 text-primary">Visualizza</h3><p className="mb-0">{PERMISSION_DESCRIPTIONS[permissionInfo[0]]?.view}</p></section><section className="border rounded p-3"><h3 className="h6 text-primary">Modifica</h3><p className="mb-0">{PERMISSION_DESCRIPTIONS[permissionInfo[0]]?.edit}</p></section></div><div className="card-footer d-flex justify-content-end"><button className="btn btn-outline-secondary" type="button" onClick={() => setInfoPageId("")}>Chiudi</button></div></section></div></>}<div className="app-content-header"><div className="container-fluid"><h1 className="mb-1">Permessi</h1><p className="text-secondary mb-0">Definisci quali sezioni ogni CAS o GVP può visualizzare e modificare.</p></div></div><div className="app-content"><div className="container-fluid"><section className="card"><div className="card-body">{!canEdit && <div className="alert alert-info py-2">Puoi consultare i permessi, ma non modificarli.</div>}<label className="form-label">Utente o gruppo</label><SearchableUserSelect casUsers={casUsers} gvpUsers={gvpUsers} value={userId} onChange={setUserId} />{selectedUser && <>{selectedRole && canEdit && <div className="alert alert-warning py-2">Le modifiche verranno applicate a tutti gli utenti {selectedRole} dell’organizzazione.</div>}<div className="table-responsive"><table className="table align-middle"><thead><tr><th>Sezione</th><th className="text-center">Visualizza</th><th className="text-center">Modifica</th></tr></thead><tbody>{MANAGEABLE_PAGES.map(([pageId, label]) => <tr key={pageId}><td><div className="d-flex align-items-center gap-2"><span>{label}</span><button className="btn btn-outline-secondary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0" style={{ width: "1.6rem", height: "1.6rem" }} type="button" aria-label={`Informazioni sui permessi di ${label}`} title="Cosa permettono questi permessi" onClick={() => setInfoPageId(pageId)}><span aria-hidden="true">i</span></button></div></td><td className="text-center"><input className="form-check-input" type="checkbox" checked={Boolean(permissions[pageId]?.view)} disabled={!canEdit} onChange={() => toggle(pageId, "view")} /></td><td className="text-center"><input className="form-check-input" type="checkbox" checked={Boolean(permissions[pageId]?.edit)} disabled={!canEdit} onChange={() => toggle(pageId, "edit")} /></td></tr>)}</tbody></table></div>{canEdit && <div className="d-flex align-items-center justify-content-end gap-3">{message && <span className={message.includes("salvat") || message.includes("applicati") ? "text-success" : "text-danger"}>{message}</span>}<button className="btn btn-primary" type="button" onClick={save}>{selectedRole ? `Applica a tutti i ${selectedRole}` : "Salva permessi"}</button></div>}</>}</div></section></div></div></>;
};
