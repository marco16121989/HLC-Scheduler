import { Meteor } from "meteor/meteor";
import { useState } from "react";

export const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitting(true);
    Meteor.loginWithPassword(username.trim().toLowerCase(), password, (loginError) => {
      setSubmitting(false);
      setError(loginError ? "Nome utente o password non validi." : "");
    });
  };

  return (
    <div className="page login-page">
      <main className="main login-main">
        <section className="card login-card">
          <img className="login-logo" src="/images/hlc-scheduler-logo.png" alt="HLC Scheduler" />
          <span className="eyebrow">Accedi</span>
          <h1>Benvenuto</h1>
          <p>Accedi per andare alla tua home page.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger py-2 mb-0" role="alert">{error}</div>}
            <label className="field-label">
              Nome utente
              <input
                type="text"
                value={username}
                onChange={(event) => { setUsername(event.target.value); setError(""); }}
                placeholder="Inserisci il nome utente"
                className="login-input"
                autoComplete="username"
                required
              />
            </label>
            <label className="field-label">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Inserisci la password"
                className="login-input"
                autoComplete="current-password"
                required
              />
            </label>
            <div className="login-actions">
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Accesso..." : "Accedi"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};
