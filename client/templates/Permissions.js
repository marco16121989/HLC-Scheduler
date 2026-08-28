import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { MANAGEABLE_PAGES, getPagePermission } from "/imports/constants/pagePermissions";

export const Permissions = ({ users, presidentId }) => {
  const managedUsers = users.filter((user) => ["CAS", "GVP"].includes(user.role) && (user.presidentId === presidentId || user.associationId === presidentId));
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
  return <><div className="app-content-header"><div className="container-fluid"><h1 className="mb-1">Permessi</h1><p className="text-secondary mb-0">Definisci quali sezioni ogni CAS o GVP può visualizzare e modificare.</p></div></div><div className="app-content"><div className="container-fluid"><section className="card"><div className="card-body"><label className="form-label" htmlFor="permissions-user">Utente o gruppo</label><select className="form-select mb-4" id="permissions-user" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Seleziona un utente o un gruppo</option><optgroup label="Applica a tutti"><option value="role:CAS">Tutti i CAS</option><option value="role:GVP">Tutti i GVP</option></optgroup><optgroup label="Singoli utenti">{managedUsers.map((user) => <option key={user.id} value={user.id}>{user.username} — {user.role}</option>)}</optgroup></select>{selectedUser && <>{selectedRole && <div className="alert alert-warning py-2">Le modifiche verranno applicate a tutti gli utenti {selectedRole} dell’organizzazione.</div>}<div className="table-responsive"><table className="table align-middle"><thead><tr><th>Sezione</th><th className="text-center">Visualizza</th><th className="text-center">Modifica</th></tr></thead><tbody>{MANAGEABLE_PAGES.map(([pageId, label]) => <tr key={pageId}><td>{label}</td><td className="text-center"><input className="form-check-input" type="checkbox" checked={Boolean(permissions[pageId]?.view)} onChange={() => toggle(pageId, "view")} /></td><td className="text-center"><input className="form-check-input" type="checkbox" checked={Boolean(permissions[pageId]?.edit)} onChange={() => toggle(pageId, "edit")} /></td></tr>)}</tbody></table></div><div className="d-flex align-items-center justify-content-end gap-3">{message && <span className={message.includes("salvat") || message.includes("applicati") ? "text-success" : "text-danger"}>{message}</span>}<button className="btn btn-primary" type="button" onClick={save}>{selectedRole ? `Applica a tutti i ${selectedRole}` : "Salva permessi"}</button></div></>}</div></section></div></div></>;
};
