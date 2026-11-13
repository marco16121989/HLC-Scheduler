import { useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { parseDoctorImportRows, getDoctorImportIssues, getDoctorImportRoleConflicts, buildDoctorImportRecords, normalizeImportValue, rankDoctorImportOptions, importProfessionalRoles, isDoctorImportCellMissing } from "/imports/api/doctorExcelImport.js";

export const DoctorExcelImport = ({ onBack, hospitals, doctors, presidentId, canImport = false }) => {
  const [rows, setRows] = useState([]);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetName, setSheetName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importProblems, setImportProblems] = useState(null);
  const workbookRef = useRef(null);
  const readerRef = useRef(null);
  const fileVersion = useRef(0);
  const visibleHospitals = hospitals.filter((hospital) => hospital.presidentId === presidentId);
  const roleConflicts = getDoctorImportRoleConflicts(rows);
  const getRowIssues = (row) => [
    ...getDoctorImportIssues(row, visibleHospitals, doctors, presidentId),
    ...(roleConflicts.has(row.rowNumber) ? [roleConflicts.get(row.rowNumber)] : []),
  ];
  const unresolvedRows = rows.map((row) => ({ rowNumber: row.rowNumber, name: `${row.lastName} ${row.firstName}`.trim(), issues: getRowIssues(row) })).filter((row) => row.issues.length > 0);
  const unresolvedCount = unresolvedRows.length;

  const selectSheet = (name, workbook = workbookRef.current, reader = readerRef.current) => {
    setEditing(null);
    setImportProblems(null);
    setSheetName(name);
    setRows([]);
    setError("");
    setSuccess("");
    try {
      const sheet = workbook.Sheets[name];
      const matrix = reader.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true });
      const firstRow = sheet["!ref"] ? reader.utils.decode_range(sheet["!ref"]).s.r + 1 : 1;
      const rowsByDoctor = new Map();
      for (const row of parseDoctorImportRows(matrix, visibleHospitals, firstRow)) {
        const key = JSON.stringify([normalizeImportValue(row.lastName), normalizeImportValue(row.firstName)]);
        if (!rowsByDoctor.has(key)) rowsByDoctor.set(key, []);
        rowsByDoctor.get(key).push(row);
      }
      setRows([...rowsByDoctor.values()].flat());
    } catch (err) {
      setError(err.message || "Impossibile leggere il foglio.");
    }
  };

  const loadFile = async (event) => {
    setEditing(null);
    setImportProblems(null);
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

  const removeRow = (rowNumber) => {
    if (saving || loading || editing) return;
    setRows((current) => current.filter((row) => row.rowNumber !== rowNumber));
    setImportProblems(null);
    setError("");
    setSuccess("");
  };

  const importDoctors = async () => {
    if (!canImport || saving || loading || editing) return;
    setError("");
    setSuccess("");
    if (unresolvedCount > 0) {
      setImportProblems(unresolvedRows);
      return;
    }
    let records;
    try {
      records = buildDoctorImportRecords({ rows, hospitals: visibleHospitals, doctors, presidentId, createId: () => crypto.randomUUID() });
    } catch (err) {
      setImportProblems([{ issues: [err.message || "Controlla i dati del file."] }]);
      return;
    }
    setSaving(true);
    try {
      await Meteor.callAsync("hlc.importDoctors", records);
      setSuccess(`${records.length} ${records.length === 1 ? "medico importato" : "medici importati"}.`);
      setRows([]);
    } catch (err) {
      setError(err.reason || err.message || "Importazione non riuscita.");
    } finally {
      setSaving(false);
    }
  };
  const editingRow = editing ? rows[editing.index] : null;
  const editingHospital = visibleHospitals.find((item) => item.id === editingRow?.hospitalId);
  const editingOptions = !editing ? [] : editing.field === "hospitalId"
    ? rankDoctorImportOptions(visibleHospitals, editingRow.hospitalName)
    : editing.field === "departmentId"
      ? rankDoctorImportOptions(editingHospital?.departments || [], editingRow.departmentName)
      : importProfessionalRoles.map((role) => ({ id: role, name: role }));
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
            <img className="img-fluid w-100" src="/images/doctor-excel-example.svg" width="2040" height="736" alt="Esempio Excel con le colonne Cognome, Nome, Ospedale, Reparto, Professione, Telefono, Email, Note. Ospedale: nome presente nel gestionale. Reparto: nome del reparto dell’ospedale indicato. Professione: Medico, Chirurgo oppure Anestesista. Mario Rossi compare su due righe per Cardiologia e Medicina interna dell’Ospedale San Carlo; Anna Bianchi per Chirurgia dell’Ospedale Maggiore." />
          </a>
        </figure>
        <section className="card" aria-label="Caricamento file Excel">
          <div className="card-body">
            <label className="form-label" htmlFor="doctor-excel-file">Seleziona un file Excel</label>
            <input className="form-control" id="doctor-excel-file" type="file" accept=".xlsx,.xls" onChange={loadFile} disabled={loading || saving} />
            {sheetNames.length > 1 && <div className="mt-3"><label className="form-label" htmlFor="doctor-excel-sheet">Foglio</label><select className="form-select" id="doctor-excel-sheet" value={sheetName} onChange={(event) => selectSheet(event.target.value)} disabled={saving}>{sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>}
            {loading && <p className="text-secondary mt-3 mb-0" role="status">Lettura del file…</p>}
            {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
            {roleConflicts.size > 0 && <div className="alert alert-danger mt-3 mb-0" role="alert">
              {[...new Set(roleConflicts.values())].map((message) => <div key={message}>{message}</div>)}
            </div>}
            {success && <div className="alert alert-success mt-3 mb-0" role="status">{success}</div>}
          </div>
        </section>
        {rows.length > 0 && <section className="card" aria-labelledby="doctor-import-preview-title">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <h2 className="card-title mb-0" id="doctor-import-preview-title">Anteprima</h2>
            <span className="text-secondary small">{rows.length} righe · {unresolvedCount} da sistemare</span>
          </div>
          <div className="card-body">
            <p className="text-secondary small">Le righe con lo stesso nome e cognome sono mostrate vicine. I numeri di riga si riferiscono al file Excel originale.</p>
            <p className="text-secondary small doctor-import-legend"><span><i className="doctor-import-legend-valid" aria-hidden="true" /> Bordo verde: dato valido</span><span><i className="doctor-import-legend-invalid" aria-hidden="true" /> Bordo rosso: dato mancante o incongruente</span><span>I campi facoltativi vuoti non bloccano l’importazione.</span></p>
            <div className="table-responsive doctor-import-table-wrap">
              <table className="table align-middle doctor-import-table">
                <thead><tr>
                  <th scope="col">Riga</th>
                  {rows[0].sourceColumns.map((column) => <th scope="col" key={column.index} title={column.field ? undefined : "Colonna visualizzata, non importata"}>{column.label}</th>)}
                  <th scope="col">Stato</th>
                  <th scope="col">Azioni</th>
                </tr></thead>
                <tbody>{rows.map((row, index) => {
                  const hospital = visibleHospitals.find((item) => item.id === row.hospitalId);
                  const department = hospital?.departments?.find((item) => item.id === row.departmentId);
                  const issues = getRowIssues(row);
                  const missingCount = row.sourceColumns.filter((column) => isDoctorImportCellMissing(row, column)).length;
                  const invalidFields = new Set();
                  if (!hospital) invalidFields.add("hospitalName");
                  if (!department) invalidFields.add("departmentName");
                  if (!importProfessionalRoles.includes(row.professionalRole) || roleConflicts.has(row.rowNumber)) invalidFields.add("professionalRole");
                  if (row.firstName && row.lastName && doctors.some((doctor) => doctor.presidentId === presidentId && normalizeImportValue(doctor.lastName) === normalizeImportValue(row.lastName) && normalizeImportValue(doctor.firstName) === normalizeImportValue(row.firstName))) {
                    invalidFields.add("firstName");
                    invalidFields.add("lastName");
                  }
                  const selectedValue = (label, field, value, text) => <span className="d-flex align-items-center justify-content-between gap-2 w-100">
                    <span>{text}</span>
                    <button type="button" className="btn btn-sm doctor-import-edit-button flex-shrink-0" aria-label={`Modifica ${label.toLowerCase()} per la riga ${row.rowNumber}`} title={`Modifica ${label.toLowerCase()}`} disabled={saving} onClick={() => setEditing({ index, field, label, value })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2.1 2.1 0 0 0-5-5L3 15z" /></svg>
                    </button>
                  </span>;
                  const renderCell = (column) => {
                    if (column.field === "hospitalName") return hospital ? selectedValue("Ospedale", "hospitalId", hospital.id, hospital.name) : <>
                      {row.hospitalName && <div className="small text-secondary mb-1">{row.hospitalName}</div>}
                      <select className="form-select form-select-sm" aria-label={`Ospedale per la riga ${row.rowNumber}`} value={hospital?.id || ""} disabled={saving} onChange={(event) => updateAssociation(index, "hospitalId", event.target.value)}>
                        <option value="">Associa ospedale</option>
                        {rankDoctorImportOptions(visibleHospitals, row.hospitalName).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </>;
                    if (column.field === "departmentName") return department ? selectedValue("Reparto", "departmentId", department.id, department.name) : <>
                      {row.departmentName && <div className="small text-secondary mb-1">{row.departmentName}</div>}
                      <select className="form-select form-select-sm" aria-label={`Reparto per la riga ${row.rowNumber}`} value={department?.id || ""} disabled={saving || !hospital} onChange={(event) => updateAssociation(index, "departmentId", event.target.value)}>
                        <option value="">Associa reparto</option>
                        {rankDoctorImportOptions(hospital?.departments || [], row.departmentName).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </>;
                    if (column.field === "professionalRole") return importProfessionalRoles.includes(row.professionalRole) ? selectedValue("Professione", "professionalRole", row.professionalRole, row.professionalRole) : <>
                      {row.professionalRole && <div className="small text-secondary mb-1">{row.professionalRole}</div>}
                      <select className="form-select form-select-sm" aria-label={`Professione per la riga ${row.rowNumber}`} value={importProfessionalRoles.includes(row.professionalRole) ? row.professionalRole : ""} disabled={saving} onChange={(event) => updateAssociation(index, "professionalRole", event.target.value)}>
                        <option value="" disabled>Seleziona professione</option>
                        {importProfessionalRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </>;
                    return row.sourceCells[column.index]?.trim() ? row.sourceCells[column.index] : null;
                  };
                  return <tr key={row.rowNumber}>
                    <th scope="row">{row.rowNumber}</th>
                    {row.sourceColumns.map((column) => {
                      const missing = isDoctorImportCellMissing(row, column);
                      const invalid = missing || invalidFields.has(column.field);
                      return <td key={column.index} className={invalid ? "doctor-import-cell-invalid" : "doctor-import-cell-valid"} title={missing ? "Dato mancante" : invalid ? "Dato non riconosciuto o incongruente" : "Dato valido"} style={{ whiteSpace: "pre-wrap" }}>
                        {missing ? <><div className="small text-secondary mb-1">Dato mancante</div>{renderCell(column)}</> : renderCell(column)}
                      </td>;
                    })}
                    <td className="doctor-import-status">
                      {issues.length ? <div className="d-flex flex-column align-items-start gap-1">
                        {issues.map((issue) => <span key={issue} className="badge text-bg-danger text-wrap text-start">{issue}</span>)}
                      </div> : <span className="badge text-bg-success">Pronto</span>}
                      {missingCount > 0 && <div className="small text-secondary mt-1">{missingCount} {missingCount === 1 ? "dato mancante" : "dati mancanti"}</div>}
                    </td>
                    <td>
                      <button className="btn btn-outline-danger btn-sm" type="button" aria-label={`Elimina riga Excel ${row.rowNumber}`} disabled={saving || loading || Boolean(editing)} onClick={() => removeRow(row.rowNumber)}>Elimina riga</button>
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <div className="d-flex flex-wrap align-items-center justify-content-end gap-3 mt-3">
              {unresolvedCount > 0 && <span className="text-secondary small">Controlla le righe segnalate per continuare.</span>}
              <button className="btn btn-primary" type="button" disabled={!canImport || saving || loading || Boolean(editing)} onClick={importDoctors}>{saving ? "Importazione…" : "Importa medici"}</button>
            </div>
          </div>
        </section>}
      </div>
    </div>
    {importProblems && <dialog className="doctor-import-edit-dialog" aria-labelledby="doctor-import-problems-title" aria-describedby="doctor-import-problems-description" ref={(node) => { if (node && !node.open) node.showModal(); }} onCancel={() => setImportProblems(null)}>
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <h2 className="h5 mb-0" id="doctor-import-problems-title">File non pronto per l’importazione</h2>
        <button type="button" className="btn-close" aria-label="Chiudi elenco problemi" onClick={() => setImportProblems(null)} />
      </div>
      <p id="doctor-import-problems-description">Nessun medico importato. Correggi le voci seguenti nell’anteprima o nel file Excel, poi riprova.</p>
      <div className="d-flex flex-column gap-3">
        {importProblems.map((row, index) => <div key={row.rowNumber ?? index}>
          {row.rowNumber != null && <div className="fw-semibold mb-1">Riga Excel {row.rowNumber}{row.name ? ` · ${row.name}` : ""}</div>}
          <div className="d-flex flex-column align-items-start gap-1">
            {row.issues.map((issue) => <span key={issue} className="badge text-bg-danger text-wrap text-start">{issue}</span>)}
          </div>
        </div>)}
      </div>
      <div className="d-flex justify-content-end mt-4">
        <button type="button" className="btn btn-primary" onClick={() => setImportProblems(null)}>Torna all’anteprima</button>
      </div>
    </dialog>}
    {editing && editingRow && <dialog className="doctor-import-edit-dialog" aria-labelledby="doctor-import-edit-title" ref={(node) => { if (node && !node.open) node.showModal(); }} onCancel={() => setEditing(null)}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!editingOptions.some((option) => option.id === editing.value)) return;
        updateAssociation(editing.index, editing.field, editing.value);
        setEditing(null);
      }}>
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
          <h2 className="h5 mb-0" id="doctor-import-edit-title">Modifica {editing.label.toLowerCase()}</h2>
          <button type="button" className="btn-close" aria-label="Chiudi" onClick={() => setEditing(null)} />
        </div>
        <p className="text-secondary">{editingRow.lastName} {editingRow.firstName} · Riga Excel {editingRow.rowNumber}</p>
        {editing.field === "departmentId" && <p className="small">Ospedale: {editingHospital?.name}</p>}
        <label className="form-label" htmlFor="doctor-import-edit-value">{editing.label}</label>
        <select id="doctor-import-edit-value" className="form-select" value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} required>
          <option value="" disabled>Seleziona {editing.label.toLowerCase()}</option>
          {editingOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(null)}>Annulla</button>
          <button type="submit" className="btn btn-primary" disabled={!editingOptions.some((option) => option.id === editing.value)}>Conferma</button>
        </div>
      </form>
    </dialog>}
  </>;
};
