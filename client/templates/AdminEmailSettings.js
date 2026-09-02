import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";

const EMPTY_FORM = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  username: "marco.mattiazzo89@gmail.com",
  password: "",
  fromName: "HLC Scheduler",
  fromEmail: "marco.mattiazzo89@gmail.com",
  replyTo: "",
};

export const AdminEmailSettings = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState("marco.mattiazzo89@gmail.com");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    Meteor.call("hlc.getEmailSettings", (error, settings) => {
      setLoading(false);
      if (error) {
        setMessage({ type: "danger", text: error.reason || "Impossibile caricare la configurazione email." });
        return;
      }
      if (!settings) return;
      setForm({ ...EMPTY_FORM, ...settings, password: "" });
      setHasPassword(settings.hasPassword);
      setTestRecipient(settings.fromEmail || "");
    });
  }, []);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const save = (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    Meteor.call("hlc.saveEmailSettings", { ...form, port: Number(form.port) }, (error, settings) => {
      setSaving(false);
      if (error) {
        setMessage({ type: "danger", text: error.reason || "Impossibile salvare la configurazione email." });
        return;
      }
      setForm((current) => ({ ...current, password: "" }));
      setHasPassword(settings?.hasPassword);
      setTestRecipient((current) => current || settings?.fromEmail || "");
      setMessage({ type: "success", text: "Configurazione email salvata." });
    });
  };

  const sendTest = () => {
    if (!testRecipient || testing) return;
    setTesting(true);
    setMessage(null);
    Meteor.call("hlc.sendEmailSettingsTest", testRecipient, (error) => {
      setTesting(false);
      setMessage(error
        ? { type: "danger", text: error.reason || "Invio dell’email di prova non riuscito." }
        : { type: "success", text: `Email di prova inviata a ${testRecipient.trim()}.` });
    });
  };

  return <section className="admin-dashboard-card admin-email-settings">
    <div className="admin-card-heading">
      <div><span className="admin-eyebrow">Email in uscita</span><h2>Account mittente</h2><p>Configura il server SMTP usato dal gestionale per inviare email.</p></div>
      {hasPassword && <span className="admin-email-status"><span aria-hidden="true" /> Configurato</span>}
    </div>
    {loading ? <p className="text-secondary mt-3 mb-0">Caricamento configurazione…</p> : <form className="admin-email-form" onSubmit={save}>
      <div className="admin-email-grid">
        <div className="admin-email-host"><label className="form-label" htmlFor="email-smtp-host">Server SMTP</label><input className="form-control" id="email-smtp-host" value={form.host} onChange={(event) => update("host", event.target.value)} placeholder="smtp.example.com" autoComplete="off" required /></div>
        <div><label className="form-label" htmlFor="email-smtp-port">Porta</label><input className="form-control" id="email-smtp-port" type="number" min="1" max="65535" value={form.port} onChange={(event) => update("port", event.target.value)} required /></div>
        <label className="admin-email-secure" htmlFor="email-smtp-secure"><input className="form-check-input" id="email-smtp-secure" type="checkbox" checked={form.secure} onChange={(event) => update("secure", event.target.checked)} /><span>Connessione SSL/TLS diretta</span></label>
        <div><label className="form-label" htmlFor="email-smtp-user">Nome utente SMTP</label><input className="form-control" id="email-smtp-user" value={form.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" required /></div>
        <div><label className="form-label" htmlFor="email-smtp-password">Password SMTP</label><input className="form-control" id="email-smtp-password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder={hasPassword ? "Lascia vuoto per non modificarla" : "Password o password per app"} autoComplete="new-password" required={!hasPassword} /></div>
        <div><label className="form-label" htmlFor="email-from-name">Nome mittente</label><input className="form-control" id="email-from-name" value={form.fromName} onChange={(event) => update("fromName", event.target.value)} required /></div>
        <div><label className="form-label" htmlFor="email-from-address">Email mittente</label><input className="form-control" id="email-from-address" type="email" value={form.fromEmail} onChange={(event) => update("fromEmail", event.target.value)} placeholder="nome@example.com" required /></div>
        <div><label className="form-label" htmlFor="email-reply-to">Rispondi a <span className="text-secondary">(facoltativo)</span></label><input className="form-control" id="email-reply-to" type="email" value={form.replyTo} onChange={(event) => update("replyTo", event.target.value)} /></div>
      </div>
      <div className="admin-email-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Salva configurazione"}</button>
      </div>
    </form>}
    {!loading && <div className="admin-email-test">
      <div><label className="form-label" htmlFor="email-test-recipient">Destinatario email di prova</label><div className="input-group"><input className="form-control" id="email-test-recipient" type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="nome@example.com" /><button className="btn btn-outline-primary" type="button" onClick={sendTest} disabled={!hasPassword || !testRecipient || testing}>{testing ? "Invio…" : "Invia prova"}</button></div></div>
    </div>}
    {message && <div className={`alert alert-${message.type} mt-3 mb-0`} role="status">{message.text}</div>}
  </section>;
};
