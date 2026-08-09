import { useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";

const emptyForm = () => ({ id: "", startDate: "", endDate: "", note: "" });
const formatDate = (value) => value
  ? new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
  : "-";

const SearchableMemberSelect = ({ id, options, value, allLabel, placeholder, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);
  const selected = options.find((option) => option.id === value);
  const filtered = options.filter((option) =>
    option.username.toLocaleLowerCase("it-IT").includes(search.trim().toLocaleLowerCase("it-IT")),
  );

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const select = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setSearch("");
  };

  return <div className="position-relative" ref={rootRef}>
    <button className="form-select text-start" id={id} type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {selected?.username || allLabel}
    </button>
    {open && <div className="dropdown-menu show w-100 p-2 shadow" style={{ maxHeight: "18rem", overflowY: "auto", zIndex: 1050 }}>
      <input className="form-control mb-2" type="search" value={search} placeholder={placeholder} onChange={(event) => setSearch(event.target.value)} autoFocus />
      <button className={`dropdown-item ${value === "all" ? "active" : ""}`} type="button" onClick={() => select("all")}>{allLabel}</button>
      {filtered.length === 0 ? <div className="small text-secondary p-2">Nessun risultato.</div> : filtered.map((option) =>
        <button className={`dropdown-item ${value === option.id ? "active" : ""}`} type="button" key={option.id} onClick={() => select(option.id)}>{option.username}</button>
      )}
    </div>}
  </div>;
};

export const Absences = ({ absences = [], users = [], currentUser }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [casMemberId, setCasMemberId] = useState("all");
  const [gvpMemberId, setGvpMemberId] = useState("all");
  const isEditing = Boolean(form.id);
  const canViewOrganization = ["Presidente", "CAS"].includes(currentUser?.role);
  const casMemberOptions = users.filter((user) => user.role === "CAS");
  const gvpMemberOptions = users.filter((user) => user.role === "GVP");
  const visibleAbsences = absences.filter((absence) => {
    const selectedMemberId = casMemberId !== "all" ? casMemberId : gvpMemberId !== "all" ? gvpMemberId : "all";
    const matchesMember = selectedMemberId === "all" || absence.userId === selectedMemberId;
    const overlapsStart = !periodFrom || absence.endDate >= periodFrom;
    const overlapsEnd = !periodTo || absence.startDate <= periodTo;
    return matchesMember && overlapsStart && overlapsEnd;
  });
  const getAbsenceUser = (absence) =>
    users.find((user) => user.id === absence.userId) ||
    (absence.userId === currentUser?.id ? currentUser : null);

  const submit = (event) => {
    event.preventDefault();
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) {
      setError("Inserisci un periodo di assenza valido.");
      return;
    }
    Meteor.call("hlc.saveAbsence", {
      ...form,
      id: form.id || crypto.randomUUID(),
      note: form.note.trim(),
    }, (methodError) => {
      if (methodError) {
        setError(methodError.reason || "Impossibile salvare il periodo.");
        return;
      }
      setForm(emptyForm());
      setError("");
    });
  };

  const remove = (absence) => {
    if (!globalThis.confirm("Eliminare questo periodo di assenza?")) return;
    Meteor.call("hlc.deleteAbsence", absence.id, (methodError) => {
      if (methodError) setError(methodError.reason || "Impossibile eliminare il periodo.");
      else if (form.id === absence.id) setForm(emptyForm());
    });
  };

  return <>
    <div className="app-content-header"><div className="container-fluid"><h1 className="mb-0">Periodi di assenza</h1></div></div>
    <div className="app-content"><div className="container-fluid"><div className="row g-3">
      <div className="col-12 col-lg-5"><section className="card">
        <div className="card-header"><h2 className="card-title">{isEditing ? "Modifica assenza" : "Inserisci assenza"}</h2></div>
        <form onSubmit={submit}><div className="card-body">
          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
          <div className="row g-3">
            <div className="col-12 col-sm-6"><label className="form-label" htmlFor="absence-start">Dal</label><input className="form-control" id="absence-start" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required /></div>
            <div className="col-12 col-sm-6"><label className="form-label" htmlFor="absence-end">Al</label><input className="form-control" id="absence-end" type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required /></div>
            <div className="col-12"><label className="form-label" htmlFor="absence-note">Nota</label><textarea className="form-control" id="absence-note" rows="3" maxLength="500" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Motivo o informazioni facoltative" /></div>
          </div>
        </div><div className="card-footer d-flex justify-content-end gap-2">
          {isEditing && <button className="btn btn-outline-secondary" type="button" onClick={() => { setForm(emptyForm()); setError(""); }}>Annulla</button>}
          <button className="btn btn-primary" type="submit">{isEditing ? "Salva modifiche" : "Inserisci"}</button>
        </div></form>
      </section></div>
      <div className="col-12 col-lg-7"><section className="card">
        <div className="card-header"><h2 className="card-title">{canViewOrganization ? "Assenze dell'organizzazione" : "Le mie assenze"}</h2></div>
        {canViewOrganization && <div className="card-body border-bottom"><div className="row g-3">
          <div className="col-12 col-md-3"><label className="form-label" htmlFor="absence-filter-from">Periodo dal</label><input className="form-control" id="absence-filter-from" type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} /></div>
          <div className="col-12 col-md-3"><label className="form-label" htmlFor="absence-filter-to">Periodo al</label><input className="form-control" id="absence-filter-to" type="date" min={periodFrom} value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} /></div>
          <div className="col-12 col-md-3"><label className="form-label" htmlFor="absence-filter-cas">CAS</label><SearchableMemberSelect id="absence-filter-cas" options={casMemberOptions} value={casMemberId} allLabel="Tutti i CAS" placeholder="Cerca CAS..." onChange={(value) => { setCasMemberId(value); if (value !== "all") setGvpMemberId("all"); }} /></div>
          <div className="col-12 col-md-3"><label className="form-label" htmlFor="absence-filter-gvp">GVP</label><SearchableMemberSelect id="absence-filter-gvp" options={gvpMemberOptions} value={gvpMemberId} allLabel="Tutti i GVP" placeholder="Cerca GVP..." onChange={(value) => { setGvpMemberId(value); if (value !== "all") setCasMemberId("all"); }} /></div>
        </div></div>}
        <div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr>{canViewOrganization && <th>Membro</th>}<th>Dal</th><th>Al</th><th>Nota</th><th className="text-end">Azioni</th></tr></thead><tbody>
          {visibleAbsences.length === 0 ? <tr><td className="text-center text-secondary py-4" colSpan={canViewOrganization ? "5" : "4"}>Nessun periodo di assenza corrisponde ai filtri.</td></tr> : visibleAbsences.map((absence) => { const absenceUser = getAbsenceUser(absence); const isOwn = absence.userId === currentUser?.id; return <tr key={absence.id}>{canViewOrganization && <td><div className="fw-medium">{absenceUser?.username || absence.username || "Utente"}</div><span className="badge text-bg-secondary">{absenceUser?.role || "-"}</span></td>}<td>{formatDate(absence.startDate)}</td><td>{formatDate(absence.endDate)}</td><td>{absence.note || <span className="text-secondary">-</span>}</td><td className="text-end">{isOwn && <div className="d-inline-flex gap-2"><button className="btn btn-outline-primary btn-sm" type="button" onClick={() => { setForm({ id: absence.id, startDate: absence.startDate, endDate: absence.endDate, note: absence.note || "" }); setError(""); }}>Modifica</button><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => remove(absence)}>Elimina</button></div>}</td></tr>; })}
        </tbody></table></div></div>
      </section></div>
    </div></div></div>
  </>;
};
