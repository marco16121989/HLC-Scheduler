import { useMemo, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { AdminLoginMessages } from "./AdminLoginMessages.js";

export const AdminTools = ({ users = [], loginMessages = [] }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [presidentId, setPresidentId] = useState("");
  const [role, setRole] = useState("Presidente");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);
  const presidents = useMemo(() => users.filter((item) => item.role === "Presidente").sort((a, b) => (a.firstName || a.username || "").localeCompare(b.firstName || b.username || "", "it-IT")), [users]);
  const userById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);

  const organizationUsers = users.filter((item) => {
    if (!presidentId || item.disabled || item.role === "Admin") return false;
    if (item.role === "Presidente") return item.id === presidentId;
    if (item.presidentId === presidentId || item.associationId === presidentId) return true;
    const casIds = [...new Set([...(item.casIds || []), item.casId, item.associationId].filter(Boolean))];
    return casIds.some((casId) => {
      const cas = userById.get(casId);
      return cas?.role === "CAS" && (cas.presidentId === presidentId || cas.associationId === presidentId);
    });
  });
  const selectedUser = userById.get(userId);
  const availableUsers = [...organizationUsers, ...(selectedUser && !organizationUsers.some((item) => item.id === selectedUser.id) ? [selectedUser] : [])]
    .filter((item) => item.role === role)
    .sort((a, b) => (a.username || "").localeCompare(b.username || "", "it-IT"));
  const searchResults = search.trim().length < 2 ? [] : users
    .filter((item) => !item.disabled && ["Presidente", "CAS", "GVP"].includes(item.role) && (item.username || "").toLocaleLowerCase("it-IT").includes(search.trim().toLocaleLowerCase("it-IT")))
    .sort((a, b) => (a.username || "").localeCompare(b.username || "", "it-IT"))
    .slice(0, 12);

  const findPresidentId = (account) => {
    if (account.role === "Presidente") return account.id;
    const directId = account.presidentId || account.associationId;
    if (userById.get(directId)?.role === "Presidente") return directId;
    const casIds = [...new Set([...(account.casIds || []), account.casId, account.associationId].filter(Boolean))];
    const cas = casIds.map((id) => userById.get(id)).find((item) => item?.role === "CAS");
    return cas?.presidentId || cas?.associationId || "";
  };
  const chooseSearchResult = (account) => {
    setPresidentId(findPresidentId(account) || "search-result");
    setRole(account.role);
    setUserId(account.id);
  };
  const openModal = () => {
    setPresidentId("");
    setRole("Presidente");
    setUserId("");
    setSearch("");
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!starting) setModalOpen(false);
  };
  const startAssistance = () => {
    if (!userId || starting) return;
    setStarting(true);
    Meteor.call("hlc.startImpersonation", userId, (error, result) => {
      if (error) {
        setStarting(false);
        globalThis.alert(error.reason || "Impossibile avviare la modalità assistenza.");
        return;
      }
      Accounts.callLoginMethod({
        methodArguments: [{ hlcImpersonationToken: result?.impersonationToken }],
        userCallback: (loginError) => {
          setStarting(false);
          if (loginError) {
            globalThis.alert(loginError.reason || "Impossibile avviare la modalità assistenza.");
            return;
          }
          globalThis.sessionStorage?.setItem("hlc-impersonation", JSON.stringify({ sessionToken: result?.sessionToken, targetUsername: result?.targetUsername || "Utente" }));
          globalThis.dispatchEvent(new CustomEvent("hlc-impersonation-changed"));
        },
      });
    });
  };

  return <div className="app-content admin-dashboard">
    <header className="admin-dashboard-header">
      <div><span className="admin-eyebrow">Amministrazione</span><h1>Strumenti</h1><p>Assistenza agli utenti e comunicazioni mostrate al login.</p></div>
    </header>
    <section className="admin-dashboard-card admin-assistance-card">
      <div><span className="admin-eyebrow">Modalità assistenza</span><h2>Accedi come un utente</h2><p>Controlla ciò che vede l’utente e aiutalo senza conoscere o modificare la sua password. Ogni accesso viene registrato.</p></div>
      <button className="btn btn-primary" type="button" onClick={openModal}>Apri accesso assistenza</button>
    </section>
    <AdminLoginMessages messages={loginMessages} />

    {modalOpen && <>
      <button className="entity-modal-backdrop" type="button" aria-label="Chiudi modalità assistenza" onClick={closeModal} />
      <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="assistance-modal-title">
        <section className="card entity-modal-card admin-assistance-modal">
          <div className="card-header d-flex align-items-center">
            <div><span className="admin-eyebrow">Modalità assistenza</span><h2 className="card-title mb-0" id="assistance-modal-title">{presidentId ? "Scegli l’utente" : "Scegli il CAS"}</h2></div>
            <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeModal} />
          </div>
          <div className="card-body">{!presidentId ? <>
            <label className="form-label" htmlFor="assistance-user-search">Cerca per nome utente</label>
            <input className="form-control" id="assistance-user-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Scrivi almeno 2 caratteri…" autoComplete="off" />
            {search.trim().length >= 2 && <div className="admin-assistance-search-results">
              {searchResults.map((item) => <button className="admin-assistance-search-result" type="button" key={item.id} onClick={() => chooseSearchResult(item)}><span><strong>{item.username}</strong><small>{item.role}</small></span><span aria-hidden="true">›</span></button>)}
              {searchResults.length === 0 && <p className="text-secondary mb-0">Nessun utente trovato.</p>}
            </div>}
            <div className="admin-assistance-divider"><span>oppure scegli il CAS</span></div>
            <div className="d-grid gap-2">{presidents.filter((item) => !item.disabled).map((president) => <button className="btn btn-outline-primary text-start p-3" type="button" key={president.id} onClick={() => { setPresidentId(president.id); setRole("Presidente"); setUserId(president.id); }}><strong className="d-block">{president.casMembership || "CAS non specificato"}</strong><small className="text-secondary">Presidente: {president.username}</small></button>)}</div>
          </> : <>
            <div className="nav nav-tabs mb-3" role="tablist" aria-label="Ruolo utente da assistere">{["Presidente", "CAS", "GVP"].map((itemRole) => <button className={`nav-link ${role === itemRole ? "active" : ""}`} type="button" role="tab" key={itemRole} aria-selected={role === itemRole} onClick={() => { setRole(itemRole); setUserId(organizationUsers.find((item) => item.role === itemRole)?.id || ""); }}>{itemRole}</button>)}</div>
            <label className="form-label" htmlFor="assistance-user">Utente</label>
            <select className="form-select" id="assistance-user" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Seleziona un utente</option>{availableUsers.map((item) => <option key={item.id} value={item.id}>{item.username}</option>)}</select>
            {availableUsers.length === 0 && <p className="text-secondary mt-3 mb-0">Nessun utente disponibile per questo ruolo.</p>}
          </>}</div>
          <div className="card-footer d-flex justify-content-between gap-2">
            {presidentId ? <button className="btn btn-outline-secondary" type="button" onClick={() => { setPresidentId(""); setUserId(""); }}>Indietro</button> : <span />}
            <div className="d-flex gap-2"><button className="btn btn-outline-secondary" type="button" onClick={closeModal}>Annulla</button>{presidentId && <button className="btn btn-primary" type="button" disabled={!userId || starting} onClick={startAssistance}>{starting ? "Accesso…" : "Accedi come utente"}</button>}</div>
          </div>
        </section>
      </div>
    </>}
  </div>;
};
