import { useEffect, useState } from "react";

const isInstalled = () =>
  globalThis.matchMedia?.("(display-mode: standalone)").matches ||
  globalThis.navigator?.standalone === true ||
  document.referrer.startsWith("android-app://");

const isMobileOrTablet = () => {
  const userAgent = globalThis.navigator?.userAgent || "";
  const isIPad = globalThis.navigator?.platform === "MacIntel" && globalThis.navigator?.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isIPad;
};

const isAppleMobile = () => {
  const userAgent = globalThis.navigator?.userAgent || "";
  return /iPhone|iPad|iPod/i.test(userAgent) || (globalThis.navigator?.platform === "MacIntel" && globalThis.navigator?.maxTouchPoints > 1);
};

export const InstallAppPrompt = () => {
  const [eligible, setEligible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobileOrTablet() || isInstalled()) return undefined;
    setEligible(true);
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    globalThis.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => globalThis.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  useEffect(() => {
    if (!eligible) return undefined;
    const timer = globalThis.setTimeout(() => setOpen(true), 2200);
    return () => globalThis.clearTimeout(timer);
  }, [eligible]);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    setDeferredPrompt(null);
    setOpen(false);
  };

  if (!open) return null;
  const appleMobile = isAppleMobile();
  return <div className="install-app-backdrop" role="presentation">
    <section className="install-app-dialog" role="dialog" aria-modal="true" aria-labelledby="install-app-title" aria-describedby="install-app-description">
      <button className="install-app-close" type="button" aria-label="Non ora" onClick={() => setOpen(false)}>&times;</button>
      <img className="install-app-icon" src="/images/hlc-app-icon.png" alt="" />
      <h2 id="install-app-title">Installa HLC Scheduler</h2>
      {appleMobile ? (
        <p id="install-app-description">Per usarlo come app, tocca <strong>Condividi</strong> nel browser e poi <strong>“Aggiungi a Home”</strong>.</p>
      ) : deferredPrompt ? (
        <p id="install-app-description">Installa l’app sul dispositivo per un accesso più rapido e un’esperienza a schermo intero.</p>
      ) : (
        <p id="install-app-description">Apri il menu del browser e scegli <strong>“Installa app”</strong> oppure <strong>“Aggiungi a schermata Home”</strong>.</p>
      )}
      <div className="install-app-actions">
        <button className="btn btn-outline-secondary" type="button" onClick={() => setOpen(false)}>Non ora</button>
        {deferredPrompt && <button className="btn btn-primary" type="button" onClick={install}>Installa</button>}
      </div>
    </section>
  </div>;
};
