import { useEffect, useRef, useState } from "react";
import { buildDoctorContactResults, buildHospitalContactResults, getDoctorContactDepartmentOptions } from "../../imports/api/doctorContactSearch.js";

export const DoctorContactSearch = ({ doctors, hospitals, presidentId, onClose, mode = "doctors" }) => {
  const [query, setQuery] = useState("");
  const [departmentKeys, setDepartmentKeys] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const outputRef = useRef(null);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(globalThis.document?.activeElement);
  const inputRef = useRef(null);
  const departmentOptions = getDoctorContactDepartmentOptions({ hospitals, presidentId });
  const suggestions = getDoctorContactDepartmentOptions({ hospitals, presidentId, query })
    .filter((option) => !departmentKeys.includes(option.key));
  const showSuggestions = suggestionsOpen && Boolean(query.trim());
  const hospitalSearch = mode === "hospitals";
  const { count, hospitalCount, groups, text } = (hospitalSearch ? buildHospitalContactResults : buildDoctorContactResults)({ doctors, hospitals, presidentId, departmentKeys });
  const selectDepartment = (option) => {
    if (!option) return;
    setDepartmentKeys((current) => current.includes(option.key) ? current : [...current, option.key]);
    setQuery("");
    setCopyStatus("");
    setHighlightedIndex(0);
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  };
  const handleSearchKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setSuggestionsOpen(true);
      setHighlightedIndex((current) => Math.max(0, Math.min(suggestions.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (showSuggestions) selectDepartment(suggestions[highlightedIndex]);
    } else if (event.key === "Escape" && showSuggestions) {
      event.stopPropagation();
      setSuggestionsOpen(false);
    }
  };

  useEffect(() => {
    const previouslyFocused = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const selectText = () => {
    outputRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || !outputRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(outputRef.current);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const copyText = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setCopyStatus("Contatti copiati. Puoi incollarli nel messaggio.");
    } catch {
      selectText();
      setCopyStatus("Testo selezionato: premi Ctrl+C o usa Copia dal menu del dispositivo.");
    }
  };
  const handleKeyDown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled),input,textarea,[tabindex='0']")];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return <>
    <button className="entity-modal-backdrop" type="button" aria-label="Chiudi ricerca contatti" onClick={onClose} tabIndex={-1} />
    <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="doctor-contact-search-title" onKeyDown={handleKeyDown} ref={dialogRef}>
      <section className="card entity-modal-card">
        <div className="card-header d-flex align-items-center gap-2">
          <button className="btn btn-outline-info rounded-circle contact-search-info" type="button"
            aria-label="Come funziona la ricerca contatti" title="Come funziona"
            aria-expanded={infoOpen} aria-controls="contact-search-help" onClick={() => setInfoOpen((current) => !current)}>
            <span aria-hidden="true">i</span>
          </button>
          <h2 className="card-title" id="doctor-contact-search-title">{hospitalSearch ? "Cerca ospedali e medici per reparto" : "Cerca e copia contatti medici"}</h2>
          <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={onClose} />
        </div>
        <div className="card-body">
          {infoOpen && <div className="alert alert-info" id="contact-search-help">
            <h3 className="h6">Come funziona</h3>
            <p>Scrivi il nome di un reparto e selezionalo dai suggerimenti. Puoi scegliere più reparti: la ricerca include i medici associati ad almeno uno di quelli selezionati. Per rimuovere un reparto, premi la × accanto al suo nome.</p>
            <p>Gli ospedali sono raggruppati in schede con i medici dei reparti scelti, il telefono e l’email disponibili. Gli ospedali senza medici corrispondenti non vengono mostrati. Se la ricerca non trova contatti, compare “Nessun risultato”.</p>
            <p className="mb-0">Premi “Copia contatti” per copiare tutti i risultati come testo ordinato, senza asterischi, pronto da incollare in WhatsApp, email o altri messaggi.</p>
          </div>}
          <label className="form-label" htmlFor="doctor-contact-query">Reparto <span className="text-danger">*</span></label>
          <div className="select2-style mb-3">
            <input className="form-control" id="doctor-contact-query" type="text" value={query}
              ref={inputRef} role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls="doctor-contact-departments"
              aria-activedescendant={showSuggestions && suggestions[highlightedIndex] ? `doctor-contact-department-${highlightedIndex}` : undefined}
              aria-required={departmentKeys.length === 0}
              onFocus={() => setSuggestionsOpen(true)} onKeyDown={handleSearchKeyDown}
              onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); setHighlightedIndex(0); setCopyStatus(""); }} autoFocus />
            {showSuggestions && <div className="select2-style-dropdown" id="doctor-contact-departments" role="listbox">
              <div className="select2-style-options">
                {suggestions.map((option, index) => <button key={option.key} id={`doctor-contact-department-${index}`} type="button" role="option"
                  tabIndex={-1} aria-selected={index === highlightedIndex} className={`select2-style-option ${index === highlightedIndex ? "is-selected" : ""}`}
                  onMouseDown={(event) => event.preventDefault()} onClick={() => selectDepartment(option)}>{option.name}</button>)}
                {!suggestions.length && <div className="select2-style-empty">Nessun reparto inserito corrisponde alla ricerca.</div>}
              </div>
            </div>}
          </div>
          {departmentKeys.length > 0 && <div className="d-flex flex-wrap gap-2 mb-3">{departmentKeys.map((key) => {
            const name = departmentOptions.find((option) => option.key === key)?.name || key;
            return <button type="button" className="btn btn-outline-primary btn-sm" key={key} aria-label={`Rimuovi reparto ${name}`}
              onClick={() => { setDepartmentKeys((current) => current.filter((item) => item !== key)); setCopyStatus(""); }}>{name} ×</button>;
          })}</div>}
          <p className="text-secondary" role="status">{!departmentKeys.length ? "Seleziona un reparto per cercare i contatti." : !groups.length ? "Nessun risultato" : hospitalSearch
            ? `${hospitalCount} ${hospitalCount === 1 ? "ospedale trovato" : "ospedali trovati"}, ${count} ${count === 1 ? "medico associato" : "medici associati"}.`
            : `${count} ${count === 1 ? "medico trovato" : "medici trovati"}.`}</p>
          {text && <div className="contact-search-results" id="doctor-contact-results" ref={outputRef} tabIndex={0} aria-label="Risultati ricerca contatti">
            {groups.map((group) => <section className="contact-search-hospital" key={group.id}>
              <header className="contact-search-hospital-header">
                <h3>{group.name}</h3>
                <div className="d-flex flex-wrap gap-2">{group.departments.map((department) =>
                  <span className="badge text-bg-light border" key={department}>{department}</span>)}</div>
              </header>
              <div className="contact-search-doctors">
                {group.contacts.map((contact) => <article className="contact-search-doctor" key={contact.id}>
                  <h4>{contact.name}</h4>
                  <p className="text-secondary mb-2">{contact.role} · {contact.departments.join(", ")}</p>
                  <dl className="contact-search-details">
                    <div><dt>Telefono</dt><dd>{contact.phone || "Non disponibile"}</dd></div>
                    <div><dt>Email</dt><dd>{contact.email || "Non disponibile"}</dd></div>
                  </dl>
                </article>)}
              </div>
            </section>)}
          </div>}
          {copyStatus && <p className="mt-3 mb-0" role="status">{copyStatus}</p>}
        </div>
        <div className="card-footer d-flex flex-wrap justify-content-end gap-2">
          <button className="btn btn-outline-secondary" type="button" onClick={onClose}>Chiudi</button>
          <button className="btn btn-primary" type="button" onClick={copyText} disabled={!text}>Copia contatti</button>
        </div>
      </section>
    </div>
  </>;
};
