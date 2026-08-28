import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { confirmAction } from "./ConfirmDialog.js";
import { getPagePermission } from "/imports/constants/pagePermissions";

const MAX_FILE_SIZE = 6 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "odt", "rtf", "txt",
  "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp", "zip",
]);
const formatSize = (size) => `${(size / (1024 * 1024)).toLocaleString("it-IT", { maximumFractionDigits: 2 })} MB`;

export const UsefulFiles = ({ files, currentUser }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const canModifyFiles = getPagePermission(currentUser, "useful-files").edit;
  const canUpload = ["Presidente", "CAS", "GVP"].includes(currentUser.role) && canModifyFiles;

  const uploadFile = () => {
    if (!selectedFile) return;
    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setError("Inserisci un nome per il file.");
      return;
    }
    const extension = selectedFile.name.includes(".")
      ? selectedFile.name.split(".").pop().toLowerCase()
      : "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      setError("Formato file non supportato.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("Il file non può superare 6 MB.");
      return;
    }
    setUploading(true);
    setError("");
    const reader = new FileReader();
    reader.onerror = () => {
      setUploading(false);
      setError("Impossibile leggere il file selezionato.");
    };
    reader.onload = () => Meteor.call("hlc.uploadUsefulFile", {
      name: selectedFile.name,
      displayName: normalizedDisplayName,
      type: selectedFile.type || "application/octet-stream",
      size: selectedFile.size,
      dataUrl: selectedFile.type
        ? reader.result
        : String(reader.result).replace("data:;base64,", "data:application/octet-stream;base64,"),
    }, (methodError) => {
      setUploading(false);
      if (methodError) {
        setError(methodError.reason || "Impossibile caricare il file.");
        return;
      }
      setSelectedFile(null);
      setDisplayName("");
      const input = document.getElementById("useful-file-input");
      if (input) input.value = "";
    });
    reader.readAsDataURL(selectedFile);
  };

  const deleteFile = async (file) => {
    if (!await confirmAction(`Eliminare ${file.name}?`)) return;
    Meteor.call("hlc.deleteUsefulFile", file.id, (methodError) => {
      if (methodError) setError(methodError.reason || "Impossibile eliminare il file.");
    });
  };

  const openFile = (file) => {
    try {
      const [header, encodedData] = file.dataUrl.split(",", 2);
      const mimeType = header.match(/^data:([^;]+);base64$/i)?.[1] || file.type || "application/octet-stream";
      const binary = globalThis.atob(encodedData);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      const openedWindow = globalThis.open(objectUrl, "_blank");
      if (!openedWindow) {
        URL.revokeObjectURL(objectUrl);
        setError("Il browser ha bloccato la nuova scheda. Abilita i popup per questo sito.");
        return;
      }
      openedWindow.opener = null;
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setError("Impossibile aprire il file.");
    }
  };

  return <>
    <div className="app-content-header"><div className="container-fluid"><h1 className="mb-1">File Utili</h1><p className="text-secondary mb-0">Carica, consulta e scarica i documenti utili all’attività.</p></div></div>
    <div className="app-content"><div className="container-fluid"><div className="row g-3">
      {canUpload && <div className="col-12"><section className="card"><div className="card-header"><h2 className="card-title">Carica file</h2></div><div className="card-body">
        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-5"><label className="form-label" htmlFor="useful-file-input">File</label><input className="form-control" id="useful-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.zip" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setDisplayName(file ? file.name.replace(/\.[^.]+$/, "") : ""); setError(""); }} /></div>
          <div className="col-12 col-md"><label className="form-label" htmlFor="useful-file-name">Nome visualizzato</label><input className="form-control" id="useful-file-name" type="text" value={displayName} maxLength="120" onChange={(event) => { setDisplayName(event.target.value); setError(""); }} placeholder="Nome del file" /></div>
          <div className="col-12 col-md-auto"><button className="btn btn-primary" type="button" disabled={!selectedFile || !displayName.trim() || uploading} onClick={uploadFile}>{uploading ? "Caricamento…" : "Carica"}</button></div>
        </div>
        <div className="form-text">PDF, immagini, documenti, fogli di calcolo, presentazioni, file di testo e ZIP. Dimensione massima: 6 MB.</div>
      </div></section></div>}
      <div className="col-12"><section className="card"><div className="card-header"><h2 className="card-title">Archivio file</h2></div><div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0 mobile-card-table"><thead><tr><th>Nome file</th><th>Dimensione</th><th>Caricato da</th><th>Data</th><th className="text-end">Azioni</th></tr></thead><tbody>
        {files.length === 0 ? <tr><td className="text-center text-secondary py-4" colSpan="5">Nessun file caricato.</td></tr> : files.map((file) => {
          const canDelete = canModifyFiles && (currentUser.role === "Presidente" || (["CAS", "GVP"].includes(currentUser.role) && file.createdBy === currentUser.id));
          return <tr key={file.id}><td data-label="File"><button className="btn btn-link fw-medium p-0 text-start" type="button" onClick={() => openFile(file)} title={`Apri ${file.displayName || file.name}`}>{file.displayName || file.name}</button><div className="small text-secondary">{file.name}</div></td><td data-label="Dimensione">{formatSize(file.size)}</td><td data-label="Caricato da">{file.createdByUsername || "-"}</td><td data-label="Data">{file.createdAt ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(file.createdAt)) : "-"}</td><td className="text-end" data-label="Azioni"><div className="d-inline-flex gap-2"><a className="btn btn-outline-primary btn-sm" href={file.dataUrl} download={file.name}>Scarica</a>{canDelete && <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteFile(file)}>Elimina</button>}</div></td></tr>;
        })}
      </tbody></table></div></div></section></div>
    </div></div></div>
  </>;
};
