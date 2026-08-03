export const Settings = ({ theme, onToggleTheme }) => {
  const darkModeEnabled = theme === "dark";

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <h1 className="mb-0">Impostazioni</h1>
        </div>
      </div>
      <div className="app-content">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-12 col-lg-8">
              <section className="card">
                <div className="card-header">
                  <h2 className="card-title">Aspetto</h2>
                </div>
                <div className="card-body">
                  <div className="form-check form-switch d-flex align-items-center gap-2">
                    <input
                      className="form-check-input"
                      id="dark-mode-setting"
                      type="checkbox"
                      role="switch"
                      checked={darkModeEnabled}
                      onChange={onToggleTheme}
                    />
                    <label className="form-check-label" htmlFor="dark-mode-setting">
                      Modalità notturna
                    </label>
                  </div>
                  <div className="form-text mt-2">
                    {darkModeEnabled
                      ? "La modalità notturna è attiva."
                      : "La modalità notturna è disattivata."}
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
