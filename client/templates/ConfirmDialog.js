import { useEffect, useRef, useState } from "react";

let openConfirmation = null;

export const confirmAction = (message, options = {}) => new Promise((resolve) => {
  if (!openConfirmation) { resolve(false); return; }
  openConfirmation({ message, title: options.title || "Conferma eliminazione", confirmLabel: options.confirmLabel || "Elimina", tone: options.tone || "danger", resolve });
});

export const ConfirmDialogHost = () => {
  const [dialog, setDialog] = useState(null);
  const confirmButtonRef = useRef(null);
  useEffect(() => { openConfirmation = setDialog; return () => { openConfirmation = null; }; }, []);
  useEffect(() => {
    if (!dialog) return undefined;
    confirmButtonRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === "Escape") { dialog.resolve(false); setDialog(null); } };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);
  if (!dialog) return null;
  const close = (confirmed) => { dialog.resolve(confirmed); setDialog(null); };
  return <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(false); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"><button className="confirm-dialog-close" type="button" aria-label="Chiudi" onClick={() => close(false)}>×</button><div className={`confirm-dialog-icon confirm-dialog-icon-${dialog.tone}`} aria-hidden="true"><span>!</span></div><h2 id="confirm-dialog-title">{dialog.title}</h2><p id="confirm-dialog-message">{dialog.message}</p><div className="confirm-dialog-actions"><button className="btn btn-outline-secondary" type="button" onClick={() => close(false)}>Annulla</button><button ref={confirmButtonRef} className={`btn btn-${dialog.tone}`} type="button" onClick={() => close(true)}>{dialog.confirmLabel}</button></div></section></div>;
};
