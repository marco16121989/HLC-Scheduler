export const Settings = ({ theme, onToggleTheme, fontSize, onFontSizeChange, highContrast, onToggleHighContrast, boldText, onToggleBoldText, pushNotifications }) => {
  const darkModeEnabled = theme === "dark";
  const fontSizes = ["xsmall", "small", "normal", "large", "xlarge"];
  const fontSizeLabels = ["Molto piccolo", "Piccolo", "Normale", "Grande", "Molto grande"];
  const fontSizeIndex = Math.max(0, fontSizes.indexOf(fontSize));

  return <>
    <div className="app-content-header"><div className="container-fluid"><h1 className="mb-0">Impostazioni</h1></div></div>
    <div className="app-content"><div className="container-fluid"><div className="row justify-content-center"><div className="col-12 col-lg-8">
      <section className="card settings-card">
        <div className="card-header settings-card-header"><h2 className="card-title mb-1">Aspetto</h2><p className="settings-card-description mb-0">Personalizza la visualizzazione del software.</p></div>
        <div className="card-body settings-grid">
          <section className="settings-panel settings-font-panel" aria-labelledby="font-setting-title">
            <div className="settings-panel-heading"><span className="settings-panel-icon settings-text-icon" aria-hidden="true">Aa</span><div className="settings-panel-copy"><h3 id="font-setting-title">Dimensione del testo</h3><p>Regola la leggibilità di testi e controlli.</p></div><span className="settings-value-badge">{fontSizeLabels[fontSizeIndex]}</span></div>
            <label className="visually-hidden" htmlFor="font-size-setting">Dimensione del testo</label>
            <input className="form-range settings-font-size-range" id="font-size-setting" type="range" min="0" max="4" step="1" value={fontSizeIndex} aria-valuetext={fontSizeLabels[fontSizeIndex]} onChange={(event) => onFontSizeChange(fontSizes[Number(event.target.value)])} />
            <div className="settings-font-size-labels" aria-hidden="true">{fontSizeLabels.map((label) => <span key={label}>{label}</span>)}</div>
          </section>
          <section className="settings-panel settings-theme-panel" aria-labelledby="theme-setting-title">
            <div className="settings-panel-heading"><span className="settings-panel-icon" aria-hidden="true">{darkModeEnabled ? "☾" : "☀"}</span><div className="settings-panel-copy"><h3 id="theme-setting-title">Tema</h3><p>Scegli tra visualizzazione chiara e notturna.</p></div><div className="form-check form-switch settings-theme-switch"><input className="form-check-input" id="dark-mode-setting" type="checkbox" role="switch" checked={darkModeEnabled} onChange={onToggleTheme} /><label className="visually-hidden" htmlFor="dark-mode-setting">Modalità notturna</label></div></div>
            <span className={`settings-value-badge ${darkModeEnabled ? "is-active" : ""}`}>{darkModeEnabled ? "Modalità notturna" : "Modalità chiara"}</span>
          </section>
          <section className="settings-panel settings-contrast-panel" aria-labelledby="contrast-setting-title">
            <div className="settings-panel-heading"><span className="settings-panel-icon settings-contrast-icon" aria-hidden="true">◐</span><div className="settings-panel-copy"><h3 id="contrast-setting-title">Alto contrasto</h3><p>Aumenta la distinzione tra testo, sfondi, bordi e pulsanti.</p></div><div className="form-check form-switch settings-theme-switch"><input className="form-check-input" id="high-contrast-setting" type="checkbox" role="switch" checked={highContrast} onChange={onToggleHighContrast} /><label className="visually-hidden" htmlFor="high-contrast-setting">Modalità ad alto contrasto</label></div></div>
            <span className={`settings-value-badge ${highContrast ? "is-active" : ""}`}>{highContrast ? "Alto contrasto attivo" : "Alto contrasto disattivato"}</span>
          </section>
          <section className="settings-panel settings-bold-panel" aria-labelledby="bold-text-setting-title">
            <div className="settings-panel-heading"><span className="settings-panel-icon settings-bold-icon" aria-hidden="true">B</span><div className="settings-panel-copy"><h3 id="bold-text-setting-title">Testo in grassetto</h3><p>Rende più marcati e leggibili i testi del software.</p></div><div className="form-check form-switch settings-theme-switch"><input className="form-check-input" id="bold-text-setting" type="checkbox" role="switch" checked={boldText} onChange={onToggleBoldText} /><label className="visually-hidden" htmlFor="bold-text-setting">Testo in grassetto</label></div></div>
            <span className={`settings-value-badge ${boldText ? "is-active" : ""}`}>{boldText ? "Testo in grassetto attivo" : "Testo in grassetto disattivato"}</span>
          </section>
          <section className="settings-panel settings-push-panel" aria-labelledby="push-setting-title">
            <div className="settings-panel-heading"><span className="settings-panel-icon" aria-hidden="true">🔔</span><div className="settings-panel-copy"><h3 id="push-setting-title">Notifiche sul dispositivo</h3><p>Ricevi gli avvisi di HLC Scheduler anche quando il gestionale non è aperto.</p></div></div>
            {!pushNotifications?.supported ? <p className="settings-push-message">Questo dispositivo o browser non supporta le notifiche push.</p> : <div className="settings-push-actions"><span className={`settings-value-badge ${pushNotifications.enabled ? "is-active" : ""}`}>{pushNotifications.enabled ? "Notifiche attive" : pushNotifications.permission === "denied" ? "Autorizzazione bloccata" : "Notifiche disattivate"}</span><button className={`btn btn-sm ${pushNotifications.enabled ? "btn-outline-danger" : "btn-primary"}`} type="button" disabled={pushNotifications.busy || pushNotifications.permission === "denied"} onClick={pushNotifications.enabled ? pushNotifications.disable : pushNotifications.enable}>{pushNotifications.busy ? "Attendi…" : pushNotifications.enabled ? "Disattiva" : "Attiva notifiche"}</button></div>}
            {pushNotifications?.permission === "denied" && <p className="settings-push-message text-danger">Le notifiche sono bloccate nelle impostazioni del browser. Devi autorizzarle da lì per poterle attivare.</p>}
            {pushNotifications?.error && <p className="settings-push-message text-danger">{pushNotifications.error}</p>}
          </section>
        </div>
      </section>
    </div></div></div></div>
  </>;
};
