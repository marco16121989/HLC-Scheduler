import { useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { parseDepartmentImportRows, getDepartmentImportPreview } from "/imports/api/departmentExcelImport.js";

export const DepartmentExcelImport = ({ departments, presidentId, onBack, canImport = false }) => {
  const [rows, setRows] = useState([]);
  const [sheetName, setSheetName] = useState("");
  const [sheetNames, setSheetNames] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const workbookRef = useRef(null);
  const readerRef = useRef(null);
  const fileVersion = useRef(0);
  const preview = getDepartmentImportPreview(rows, departments.filter((item) => item.presidentId === presidentId));
  const readyRows = preview.filter((row) => row.ready);

  const selectSheet = (name, workbook = workbookRef.current, reader = readerRef.current) => {
    setSheetName(name);
    setRows([]);
    setError("");
    setSuccess("");
    try {
      const sheet = workbook.Sheets[name];
      const matrix = reader.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true });
      const firstRow = sheet["!ref"] ? reader.utils.decode_range(sheet["!ref"]).s.r + 1 : 1;
      setRows(parseDepartmentImportRows(matrix, firstRow));
    } catch (err) {
      setError(err.message || "Impossibile leggere il foglio.");
    }
  };
  const loadFile = async (event) => {
    const file = event.target.files?.[0];
    const version = ++fileVersion.current;
    setRows([]);
    setSheetNames([]);
    setSheetName("");
    setError("");
    setSuccess("");
    workbookRef.current = null;
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setError("Seleziona un file .xlsx o .xls."); return; }
    setLoading(true);
    try {
      const reader = await import("xlsx");
      const workbook = reader.read(await file.arrayBuffer(), { type: "array" });
      if (version !== fileVersion.current) return;
      if (!workbook.SheetNames.length) throw new Error("Il file non contiene fogli.");
      readerRef.current = reader;
      workbookRef.current = workbook;
      setSheetNames(workbook.SheetNames);
      selectSheet(workbook.SheetNames[0], workbook, reader);
    } catch (err) {
      if (version === fileVersion.current) setError(err.message || "Impossibile leggere il file.");
    } finally {
      if (version === fileVersion.current) setLoading(false);
    }
  };
  const downloadExample = async () => {
    try {
      const reader = await import("xlsx");
      const workbook = reader.utils.book_new();
      reader.utils.book_append_sheet(workbook, reader.utils.aoa_to_sheet([["Reparto"], ["Cardiologia"], ["Chirurgia generale"]]), "Reparti");
      reader.writeFile(workbook, "esempio-reparti.xlsx");
    } catch (err) {
      setError("Impossibile scaricare il file di esempio.");
    }
  };
  const importDepartments = async () => {
    if (!canImport || loading || saving || !readyRows.length || preview.some((row) => !row.name.trim())) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const result = await Meteor.callAsync("hlc.importDepartments", readyRows.map((row) => row.name));
      setSuccess(`${result.imported} reparti importati.${result.skipped ? ` ${result.skipped} già presenti e saltati.` : ""}`);
      setRows([]);
    } catch (err) {
      setError(err.reason || err.message || "Importazione non riuscita.");
    } finally {
      setSaving(false);
    }
  };
  return <>
    <div className="app-content-header"><div className="container-fluid d-flex flex-wrap justify-content-between align-items-center gap-3">
      <h1 className="mb-0">Importa reparti da Excel</h1>
      <button className="btn btn-outline-primary" type="button" onClick={onBack}>Torna ai reparti</button>
    </div></div>
    <div className="app-content"><div className="container-fluid">
      <figure className="mb-4">
        <a href="/images/department-excel-example.svg" target="_blank" rel="noopener noreferrer" aria-label="Apri l'immagine di esempio a dimensione intera">
          <img className="img-fluid w-100" src="/images/department-excel-example.svg" width="1200" height="520" alt="Esempio Excel con una sola colonna A: Reparto nella prima riga, poi Cardiologia, Chirurgia generale, Medicina interna e Neurologia, un nome per riga." />
        </a>
      </figure>
      <section className="card"><div className="card-body">
        <p>Prepara un file Excel con una sola colonna: nella prima riga scrivi <strong>Reparto</strong>, poi inserisci un nome per riga. Verranno aggiunti i modelli generali dei reparti.</p>
        <button className="btn btn-outline-primary mb-3" type="button" onClick={downloadExample}>Scarica Excel di esempio</button>
        <div><label className="form-label" htmlFor="department-excel-file">Seleziona un file Excel</label>
          <input className="form-control" id="department-excel-file" type="file" accept=".xlsx,.xls" disabled={loading || saving} onChange={loadFile} /></div>
        {sheetNames.length > 1 && <div className="mt-3"><label className="form-label" htmlFor="department-excel-sheet">Foglio</label><select className="form-select" id="department-excel-sheet" value={sheetName} onChange={(event) => selectSheet(event.target.value)} disabled={saving}>{sheetNames.map((name) => <option key={name}>{name}</option>)}</select></div>}
        {loading && <p role="status" className="mt-3 mb-0">Lettura del file…</p>}
        {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
        {success && <div className="alert alert-success mt-3 mb-0" role="status">{success}</div>}
      </div></section>
      {rows.length > 0 && <section className="card">
        <div className="card-header d-flex flex-wrap justify-content-between gap-2"><h2 className="card-title mb-0">Anteprima</h2><span>{rows.length} righe · {readyRows.length} da importare</span></div>
        <div className="card-body">
          <p className="text-secondary small">I numeri si riferiscono alle righe originali del file. I reparti già presenti e i duplicati vengono saltati.</p>
          <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Riga</th><th>Reparto</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>{preview.map((row) => <tr key={row.rowNumber}>
              <th scope="row">{row.rowNumber}</th>
              <td><input className="form-control" aria-label={`Reparto per la riga ${row.rowNumber}`} value={row.name} disabled={saving} onChange={(event) => {
                setError("");
                setRows((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, name: event.target.value } : item));
              }} /></td>
              <td>{row.ready ? <span className="badge text-bg-success">Pronto</span> : <span className="text-secondary">{row.issue}</span>}</td>
              <td><button className="btn btn-outline-danger btn-sm" type="button" aria-label={`Elimina riga Excel ${row.rowNumber}`} disabled={saving} onClick={() => { setRows((current) => current.filter((item) => item.rowNumber !== row.rowNumber)); setError(""); }}>Elimina riga</button></td>
            </tr>)}</tbody>
          </table></div>
          <div className="d-flex justify-content-end mt-3"><button className="btn btn-primary" type="button" disabled={!canImport || loading || saving || !readyRows.length || preview.some((row) => !row.name.trim())} onClick={importDepartments}>{saving ? "Importazione…" : "Importa reparti"}</button></div>
        </div>
      </section>}
    </div></div>
  </>;
};
