import { useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { parseDoctorImportRows, getDoctorImportIssues, buildDoctorImportRecords, normalizeImportValue, rankDoctorImportOptions, importProfessionalRoles, isDoctorImportCellMissing } from "/imports/api/doctorExcelImport.js";

export const DoctorExcelImport = ({ onBack, hospitals, doctors, presidentId, canImport = false }) => {
  const [rows, setRows] = useState([]);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetName, setSheetName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const workbookRef = useRef(null);
  const readerRef = useRef(null);
  const fileVersion = useRef(0);
  const visibleHospitals = hospitals.filter((hospital) => hospital.presidentId === presidentId);
  const unresolvedCount = rows.filter((row) => getDoctorImportIssues(row, visibleHospitals, doctors, presidentId).length > 0).length;

  const selectSheet = (name, workbook = workbookRef.current, reader = readerRef.current) => {
    setSheetName(name);
    setRows([]);
    setError("");
    setSuccess("");
    try {
      const sheet = workbook.Sheets[name];
      const matrix = reader.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true });
      const firstRow = sheet["!ref"] ? reader.utils.decode_range(sheet["!ref"]).s.r + 1 : 1;
      setRows(parseDoctorImportRows(matrix, visibleHospitals, firstRow));
    } catch (err) {
      setError(err.message || "Impossibile leggere il foglio.");
    }
  };

  const loadFile = async (event) => {
    const file = event.target.files?.[0];
    const version = ++fileVersion.current;
    setRows([]);
    setError("");
    setSuccess("");
    setSheetNames([]);
    setSheetName("");
    workbookRef.current = null;
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setError("Seleziona un file .xlsx o .xls."); return; }
    setLoading(true);
    try {
      const reader = await import("xlsx");
      const workbook = reader.read(await file.arrayBuffer(), { type: "array" });
      if (version !== fileVersion.current) return;
      if (!workbook.SheetNames.length) throw new Error("Il file non contiene fogli.");
      workbookRef.current = workbook;
      readerRef.current = reader;
      setSheetNames(workbook.SheetNames);
      selectSheet(workbook.SheetNames[0], workbook, reader);
    } catch (err) {
      if (version === fileVersion.current) setError(`File non letto: ${err.message || "formato non valido"}`);
    } finally {
      if (version === fileVersion.current) setLoading(false);
    }
  };

  const updateAssociation = (index, field, value) => {
    setError("");
    setRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (field === "hospitalId") {
        const departments = visibleHospitals.find((hospital) => hospital.id === value)?.departments || [];
        const matches = departments.filter((department) => normalizeImportValue(department.name) === normalizeImportValue(row.departmentName));
        return { ...row, hospitalId: value, departmentId: matches.length === 1 ? matches[0].id : "" };
      }
      return { ...row, [field]: value };
    }));
  };

  const importDoctors = async () => {
    if (!canImport || saving || loading) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const records = buildDoctorImportRecords({ rows, hospitals: visibleHospitals, doctors, presidentId, createId: () => crypto.randomUUID() });
      await Meteor.callAsync("hlc.importDoctors", records);
      setSuccess(`${records.length} ${records.length === 1 ? "medico importato" : "medici importati"}.`);
      setRows([]);
    } catch (err) {
      setError(err.reason || err.message || "Importazione non riuscita.");
    } finally {
      setSaving(false);
    }
  };
  return <>
    <div className="app-content-header">
      <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="mb-1">Importa medici da Excel</h1>
          </div>
          <button className="btn btn-outline-primary" type="button" onClick={onBack}>Torna ai medici</button>
        </div>
      </div>
    </div>
    <div className="app-content">
      <div className="container-fluid">
        <figure className="mb-4">
          <a href="/images/doctor-excel-example.svg" target="_blank" rel="noopener noreferrer" aria-label="Apri l’immagine di esempio a dimensione intera">
            <img className="img-fluid w-100" src="/images/doctor-excel-example.svg" width="2040" height="640" alt="Esempio Excel con le colonne Cognome, Nome, Ospedale, Reparto, Professione, Telefono, Email, Note. Professione: Medico, Chirurgo oppure Anestesista. Mario Rossi compare su due righe per Cardiologia e Medicina interna dell’Ospedale San Carlo; Anna Bianchi per Chirurgia dell’Ospedale Maggiore." />
          </a>
        </figure>
        <section className="card" aria-label="Caricamento file Excel">
          <div className="card-body">
            <label className="form-label" htmlFor="doctor-excel-file">Seleziona un file Excel</label>
            <input className="form-control" id="doctor-excel-file" type="file" accept=".xlsx,.xls" onChange={loadFile} disabled={loading || saving} />
            {sheetNames.length > 1 && <div className="mt-3"><label className="form-label" htmlFor="doctor-excel-sheet">Foglio</label><select className="form-select" id="doctor-excel-sheet" value={sheetName} onChange={(event) => selectSheet(event.target.value)} disabled={saving}>{sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>}
            {loading && <p className="text-secondary mt-3 mb-0" role="status">Lettura del file…</p>}
            {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
            {success && <div className="alert alert-success mt-3 mb-0" role="status">{success}</div>}
          </div>
        </section>
        {rows.length > 0 && <section className="card" aria-labelledby="doctor-import-preview-title">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <h2 className="card-title mb-0" id="doctor-import-preview-title">Anteprima</h2>
            <span className="text-secondary small">{rows.length} righe · {unresolvedCount} da sistemare</span>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle">
                <thead className="table-light"><tr>
                  <th scope="col">Riga</th>
                  {rows[0].sourceColumns.map((column) => <th scope="col" key={column.index} title={column.field ? undefined : "Colonna visualizzata, non importata"}>{column.label}</th>)}
                  <th scope="col">Stato</th>
                </tr></thead>
                <tbody>{rows.map((row, index) => {
                  const hospital = visibleHospitals.find((item) => item.id === row.hospitalId);
                  const department = hospital?.departments?.find((item) => item.id === row.departmentId);
                  const hospitalRecognized = hospital && normalizeImportValue(hospital.name) === normalizeImportValue(row.hospitalName);
                  const departmentRecognized = department && normalizeImportValue(department.name) === normalizeImportValue(row.departmentName);
                  const issues = getDoctorImportIssues(row, visibleHospitals, doctors, presidentId);
                  const missingCount = row.sourceColumns.filter((column) => isDoctorImportCellMissing(row, column)).length;
                  const renderCell = (column) => {
                    if (column.field === "hospitalName") return hospitalRecognized ? hospital.name : <>
                      {row.hospitalName && <div className="small text-secondary mb-1">{row.hospitalName}</div>}
                      <select className="form-select form-select-sm" aria-label={`Ospedale per la riga ${row.rowNumber}`} value={hospital?.id || ""} disabled={saving} onChange={(event) => updateAssociation(index, "hospitalId", event.target.value)}>
                        <option value="">Associa ospedale</option>
                        {rankDoctorImportOptions(visibleHospitals, row.hospitalName).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </>;
                    if (column.field === "departmentName") return departmentRecognized ? department.name : <>
                      {row.departmentName && <div className="small text-secondary mb-1">{row.departmentName}</div>}
                      <select className="form-select form-select-sm" aria-label={`Reparto per la riga ${row.rowNumber}`} value={department?.id || ""} disabled={saving || !hospital} onChange={(event) => updateAssociation(index, "departmentId", event.target.value)}>
                        <option value="">Associa reparto</option>
                        {rankDoctorImportOptions(hospital?.departments || [], row.departmentName).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </>;
                    if (column.field === "professionalRole") return importProfessionalRoles.includes(row.professionalRole) ? row.professionalRole : <>
                      {row.professionalRole && <div className="small text-secondary mb-1">{row.professionalRole}</div>}
                      <select className="form-select form-select-sm" aria-label={`Professione per la riga ${row.rowNumber}`} value="" disabled={saving} onChange={(event) => updateAssociation(index, "professionalRole", event.target.value)}>
                        <option value="" disabled>Seleziona professione</option>
                        {importProfessionalRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </>;
                    return row.sourceCells[column.index]?.trim() ? row.sourceCells[column.index] : null;
                  };
                  return <tr key={row.rowNumber} className={issues.length ? "table-danger" : "table-success"}>
                    <th scope="row">{row.rowNumber}</th>
                    {row.sourceColumns.map((column) => isDoctorImportCellMissing(row, column)
                      ? <td key={column.index} style={{ whiteSpace: "pre-wrap" }}><div className="small text-secondary mb-1">Dato mancante</div>{renderCell(column)}</td>
                      : <td key={column.index} style={{ whiteSpace: "pre-wrap" }}>{renderCell(column)}</td>)}
                    <td>
                      {issues.length ? <><span className="badge text-bg-danger">Dato non importato</span><div className="small text-danger mt-1">{issues.join(". ")}</div></> : <span className="badge text-bg-success">Pronto</span>}
                      {missingCount > 0 && <div className="small text-secondary mt-1">{missingCount} {missingCount === 1 ? "dato mancante" : "dati mancanti"}</div>}
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <div className="d-flex flex-wrap align-items-center justify-content-end gap-3 mt-3">
              {unresolvedCount > 0 && <span className="text-secondary small">Controlla le righe segnalate per continuare.</span>}
              <button className="btn btn-primary" type="button" disabled={!canImport || unresolvedCount > 0 || saving || loading} onClick={importDoctors}>{saving ? "Importazione…" : "Importa medici"}</button>
            </div>
          </div>
        </section>}
      </div>
    </div>
  </>;
};
