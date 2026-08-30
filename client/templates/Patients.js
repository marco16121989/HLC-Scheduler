import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { createPopulatedPatientPdf } from "../utils/populatePatientPdf.js";
import { createSimplifiedPatientPdf } from "../utils/populateSimplifiedPatientPdf.js";
import { confirmAction } from "./ConfirmDialog.js";
import { getPagePermission } from "/imports/constants/pagePermissions";
import {
  DEFAULT_GVP_PATIENT_SHARED_FIELDS,
  GVP_PATIENT_SUMMARY_FIELDS,
} from "/imports/constants/gvpPatientSharing";
import { PaginationControls, usePagination } from "./Pagination.js";

const getToday = () => new Date().toISOString().slice(0, 10);
const MASKED_VALUE = "********";
const CLOSED_PATIENT_HIDDEN_FIELDS = ["firstName", "lastName"];
const CLOSED_PATIENT_STATUSES = ["Dimesso", "Deceduto", "Trasferito"];
const TRANSFERRED_PATIENT_PRIVACY_NOTE = "Come da istruzioni dello schiavo il nome e cognome del paziente sono stati eliminati.";
const maskClosedPatientForDisplay = (patient) => {
  if (!CLOSED_PATIENT_STATUSES.includes(patient?.status)) return patient;
  const masked = { ...patient, details: { ...(patient.details || {}) } };
  CLOSED_PATIENT_HIDDEN_FIELDS.forEach((path) => {
    const parts = path.split(".");
    let cursor = masked;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) cursor[part] = MASKED_VALUE;
      else cursor = cursor[part] ||= {};
    });
  });
  return masked;
};
const ADMISSION_TYPES = ["emergency", "scheduled", "consultation"];
const admissionTypeLabel = (value, compact = false) => value === "scheduled"
  ? (compact ? "Programmato" : "Ricovero programmato")
  : value === "consultation" ? "Consulto" : "Emergenza";

const formatPatientListName = (patient) => {
  const isFemale = ["Femmina", "Femminile"].includes(patient.details?.sex);
  const maidenName = patient.details?.maidenName?.trim();
  if (isFemale && maidenName) {
    return `${patient.firstName} ${maidenName} (${patient.lastName})`;
  }
  return `${patient.firstName} ${patient.lastName}`;
};

const NoteButtonContent = ({ unreadCount = 0, label = "Note GVP" }) => <span className="patient-note-content">
  <svg className="patient-note-icon patient-note-mobile-icon" viewBox="0 0 52 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h40a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H37l-7 5v-5H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z" />
    <text x="26" y="18.2" fill="currentColor" stroke="none" textAnchor="middle" fontSize="10.5" fontWeight="800">{label.replace("Note ", "")}</text>
  </svg>
  <svg className="patient-note-icon patient-note-desktop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.35-.66L4 20l1.55-4.1A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.5" />
  </svg>
  <span className="patient-note-desktop-label">{label}</span>
  {unreadCount > 0 && <span className="patient-note-unread" aria-label={`${unreadCount} nuove ${label}`}>{unreadCount}</span>}
</span>;

const PatientMobileLocation = ({ patient, departmentName, hospitalName }) => <span className="patient-mobile-location">
  <span><strong>Ospedale:</strong> {hospitalName || patient.details?.hospitalName || "-"}</span>
  <span><strong>Reparto:</strong> {patient.details?.departmentId === MASKED_VALUE ? MASKED_VALUE : departmentName || patient.details?.hospitalDepartment || "-"}</span>
  <span><strong>Camera:</strong> {patient.details?.hospitalRoom || "-"}</span>
  <span><strong>Letto:</strong> {patient.details?.hospitalBed || "-"}</span>
</span>;

const PATIENT_STATUSES = [
  "In attesa di ricovero",
  "Ricoverato",
  "Dimesso",
  "Deceduto",
];
const PATIENT_RECORD_STATUSES = [...PATIENT_STATUSES, "Trasferito"];

const getPatientGvpIds = (patient) =>
  Array.isArray(patient?.gvpIds)
    ? patient.gvpIds
    : patient?.gvpId
      ? [patient.gvpId]
      : [];

const getPatientCasIds = (patient) => [...new Set([
  ...(Array.isArray(patient?.casIds) ? patient.casIds : []),
  patient?.casId,
].filter(Boolean))];

const getGvpNotes = (patient) => {
  if (Array.isArray(patient?.gvpNotes)) return patient.gvpNotes;
  if (typeof patient?.gvpNotes === "string" && patient.gvpNotes.trim()) {
    return [{ id: "legacy", text: patient.gvpNotes, author: "GVP", authorRole: "GVP", createdAt: null }];
  }
  return [];
};

const getCasNotes = (patient) => Array.isArray(patient?.casNotes) ? patient.casNotes : [];

const getNoteRoleBadgeClass = (role) =>
  role === "Presidente"
    ? "text-bg-primary"
    : role === "CAS"
      ? "text-bg-success"
      : "text-bg-warning";

export const DETAIL_SECTIONS = [
  {
    title: "NOTIFICA",
    fields: [
      ["callDateTime", "Data e ora della chiamata", "datetime-local"],
      ["callAuthor", "Autore della chiamata"],
      ["callAuthorContacts", "Recapiti dell’autore della chiamata", "tel"],
      ["requestedAssistance", "Assistenza richiesta dal paziente", "textarea"],
      ["relationshipToPatient", "Relazione con il paziente"],
    ],
  },
  {
    title: "INFORMAZIONI SUL PAZIENTE/OSPEDALE",
    fields: [
      ["sex", "Sesso", "select", ["Maschio", "Femmina"]],
      ["age", "Età", "number"],
      ["patientComments", "Commenti sul paziente", "textarea"],
      ["isMinorOrNewborn", "Paziente minore o neonato?", "yesno"],
      ["fatherName", "Nome del padre"],
      ["fatherBaptized", "Padre battezzato?", "yesno"],
      ["fatherGoodStanding", "Padre in buona reputazione?", "yesno"],
      ["fatherDpaComplete", "DPA del padre completo?", "yesno"],
      ["motherName", "Nome della madre"],
      ["motherBaptized", "Madre battezzata?", "yesno"],
      ["familySituation", "Situazione familiare", "textarea"],
      ["hospitalName", "Nome dell’ospedale"],
      ["hospitalRoom", "Numero camera"],
      ["hospitalBed", "Numero letto"],
      ["hospitalPhone", "Telefono dell’ospedale", "tel"],
      ["congregation", "Congregazione"],
      ["localElders", "Anziani locali contattati"],
      ["localEldersPhones", "Numeri di telefono degli anziani", "tel"],
      ["birthWeight", "Peso alla nascita"],
      ["apgarScore", "Punteggio APGAR"],
      ["gestationalAge", "Età gestazionale (settimane)", "number"],
      ["birthType", "Nascita"],
      ["birthDate", "Data di nascita", "date"],
      ["apgarFiveMinutes", "APGAR a 5 minuti"],
    ],
  },
  {
    title: "INFORMAZIONI SUL QUADRO CLINICO",
    fields: [
      ["specificProblem", "Problema specifico / diagnosi attuale e relazione con il sangue", "textarea"],
      ["medicalHistory", "Anamnesi rilevante / causa della crisi attuale", "textarea"],
    ],
  },
  {
    title: "COMPILAZIONE DEL PDF SEMPLIFICATO",
    fields: [
      ["patientPhone", "Numero di cellulare del paziente", "tel"],
      ["healthProblems", "Problemi di salute", "textarea"],
      ["spiritualCondition", "Condizione spirituale", "textarea"],
      ["nonWitnessFamily", "Familiari non Testimoni coinvolti", "textarea"],
      ["datCompleted", "DAT compilata?", "yesno"],
      ["datRegistered", "DAT registrata?", "yesno"],
      ["elderName", "Nome dell’anziano"],
      ["elderEmail", "E-mail dell’anziano", "email"],
      ["elderPhone", "Cellulare dell’anziano", "tel"],
      ["simplifiedNotes", "Note per il CAS", "textarea"],
    ],
  },
  {
    title: "VALORI DI LABORATORIO",
    fields: [1, 2, 3].flatMap((index) => [
      [`lab${index}DateTime`, `Analisi ${index} — Data e ora`, "datetime-local"],
      [`lab${index}Hemoglobin`, `Analisi ${index} — Emoglobina (Hb g/dL)`, "number-step"],
      [`lab${index}Hematocrit`, `Analisi ${index} — Ematocrito (Hct %)`, "number-step"],
      [`lab${index}Platelets`, `Analisi ${index} — Numero piastrine (Plts/μL)`, "number"],
      [`lab${index}Other`, `Analisi ${index} — Altri valori`],
    ]),
  },
  {
    title: "INFORMAZIONI SUL MEDICO",
    fields: [
      ["attendingDoctor", "Medico curante"],
      ["attendingDoctorSpecialization", "Specializzazione del medico curante"],
      ["otherAttendingDoctor", "Altro medico curante"],
      ["otherDoctorSpecialization", "Specializzazione dell’altro medico"],
    ],
  },
  {
    title: "PROGRAMMA TERAPEUTICO DEL MEDICO",
    description: "Esami, procedure o trattamenti proposti.",
    fields: [
      ["treatmentPlan", "Esami, procedure o trattamenti proposti", "textarea"],
      ["staffInformed", "Personale informato della richiesta di assistenza del comitato sanitario?", "yesno"],
      ["legalActionThreatened", "È stata minacciata un’azione legale?", "yesno"],
    ],
  },
  {
    title: "STRATEGIE/ALTERNATIVE",
    description: "Specificare le modalità, le procedure o le tecniche da proporre ai medici.",
    fields: [
      ["strategies", "Modalità, procedure o tecniche da proporre ai medici", "textarea"],
    ],
  },
  {
    title: "ARTICOLI MEDICI",
    description: "Specificare articoli e documentazione per il personale medico in supporto alle strategie/alternative suggerite.",
    fields: [
      ["medicalArticles", "Articoli e documentazione a supporto", "textarea"],
      ["doctorWillCooperate", "Il medico è disposto a cooperare?", "yesno"],
    ],
  },
  {
    title: "CONSULTO DA MEDICO A MEDICO",
    description: "Il medico curante è disposto a consultare uno specialista esperto in terapie alternative all’uso di sangue?",
    fields: [
      ["consultAvailable", "Il medico curante accetta il consulto con uno specialista?", "yesno"],
      ["consultDoctorName", "Nome del medico da consultare"],
      ["consultContactMethod", "Metodo di contatto preferito"],
      ["consultSpecialization", "Specializzazione"],
      ["consultNotes", "Ulteriori informazioni sul consulto", "textarea"],
    ],
  },
  {
    title: "RICHIESTA DI TRASFERIMENTO",
    description: "Questa decisione spetta al paziente e/o alla sua famiglia. Descrivere il metodo di trasferimento.",
    fields: [
      ["transferMethod", "Metodo di trasferimento", "textarea"],
      ["transferArrangementsConfirmed", "Accordi relativi al trasferimento confermati?", "yesno"],
      ["healthInformationContacted", "Reparto Informazione Sanitaria contattato?", "yesno"],
      ["transferHospital", "Nome dell’ospedale di trasferimento"],
      ["transferDoctor", "Medico curante presso l’ospedale di trasferimento"],
      ["transferHospitalPhone", "Numero dell’ospedale di trasferimento", "tel"],
      ["transferNotes", "Ulteriori informazioni sul trasferimento", "textarea"],
    ],
  },
  {
    title: "RISULTATO/INTERVENTI SUCCESSIVI",
    description: "Descrivere il risultato e gli eventuali interventi successivi.",
    fields: [
      ["outcome", "Risultato ed eventuali interventi successivi", "textarea"],
      ["followUpElders", "Anziani locali contattati per interventi successivi", "textarea"],
    ],
  },
].sort((first, second) =>
  Number(first.title === "COMPILAZIONE DEL PDF SEMPLIFICATO") -
  Number(second.title === "COMPILAZIONE DEL PDF SEMPLIFICATO"),
);

export const SIMPLIFIED_FIELDS = [
  ["congregation", "Congregazione"],
  ["age", "Età", "number"],
  ["patientPhone", "Numero di cellulare del paziente", "tel"],
  ["healthProblems", "Problemi di salute", "textarea"],
  ["spiritualCondition", "Condizione spirituale", "textarea"],
  ["nonWitnessFamily", "Familiari non Testimoni coinvolti", "textarea"],
  ["datCompleted", "DAT compilata?", "yesno"],
  ["datRegistered", "DAT registrata?", "yesno"],
  ["elderName", "Nome dell’anziano"],
  ["elderEmail", "E-mail dell’anziano", "email"],
  ["elderPhone", "Cellulare dell’anziano", "tel"],
  ["simplifiedNotes", "Note per il CAS", "textarea"],
];

const PATIENT_FORM_TABS = [
  ["summary", "Riepilogo"],
  ["main", "Info Principali"],
  ["insertion", "Info Complete"],
  ["departments", "Trasferimenti"],
  ["history", "Storico modifiche"],
];

const SIMPLIFIED_FIELD_NAMES = new Set(SIMPLIFIED_FIELDS.map(([name]) => name));
const PARENT_FIELD_NAMES = new Set([
  "fatherName",
  "fatherBaptized",
  "fatherGoodStanding",
  "fatherDpaComplete",
  "motherName",
  "motherBaptized",
]);

const PatientDetailField = ({ field, value, onChange, disabled = false, columnClassName }) => {
  const [name, label, type = "text", options = []] = field;
  const common = {
    className: type === "select" || type === "yesno" ? "form-select" : "form-control",
    id: `patient-${name}`,
    value: value || "",
    disabled,
    onChange: (event) => onChange(name, event.target.value),
  };
  const columnClass = columnClassName || (type === "textarea"
    ? "col-12"
    : ["date", "datetime-local", "number", "number-step", "yesno", "select"].includes(type)
      ? "col-12 col-sm-6 col-lg-3"
      : "col-12 col-md-6");

  return (
    <div className={columnClass}>
      <label className="form-label" htmlFor={common.id}>{label}</label>
      {type === "textarea" ? (
        <textarea {...common} rows="3" />
      ) : type === "select" || type === "yesno" ? (
        <select {...common}>
          <option value="">Seleziona</option>
          {(type === "yesno" ? ["Sì", "No", "Non noto"] : options).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input {...common} type={type === "number-step" ? "number" : type} step={type === "number-step" ? "0.01" : undefined} min={type === "number" || type === "number-step" ? "0" : undefined} />
      )}
    </div>
  );
};

export const formatSummaryValue = (value) => {
  if (value === null || value === undefined || value === "") return "Non compilato";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return String(value);
};

const PATIENT_HISTORY_FIELD_LABELS = new Map([
  ["__created", "Creazione paziente"],
  ["firstName", "Nome"], ["lastName", "Cognome"], ["admissionType", "Tipo di accesso"],
  ["status", "Stato"], ["transferNotes", "Note del trasferimento"],
  ["admissionDate", "Data di accesso"], ["dischargeDate", "Data di dimissione"],
  ["pathology", "Patologia"], ["doctorId", "Medico responsabile"],
  ["recommendedDoctorIds", "Medici consigliati"], ["casId", "CAS principale"],
  ["casIds", "CAS assegnati"], ["gvpId", "GVP principale"], ["gvpIds", "GVP assegnati"],
  ["notes", "Note generali"], ["gvpNotes", "Note GVP"], ["casNotes", "Note CAS"],
  ["departmentHistory", "Trasferimenti di reparto"],
  ["details.departmentId", "Reparto"], ["details.hospitalName", "Ospedale"],
  ["details.hospitalDepartment", "Reparto ospedaliero"], ["details.isMinorOrNewborn", "Minorenne o neonato"],
  ...DETAIL_SECTIONS.flatMap((section) => section.fields.map(([name, label]) => [`details.${name}`, label])),
  ...SIMPLIFIED_FIELDS.map(([name, label]) => [`details.${name}`, label]),
]);

const formatPatientHistoryValue = (value) => {
  if (value === undefined || value === null || value === "") return "Non compilato";
  if (value === MASKED_VALUE) return MASKED_VALUE;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed.join(", ") : "Nessun valore";
    if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
  } catch {
    // Il valore non è JSON: viene mostrato così com'è.
  }
  return String(value);
};

const getPatientHistoryFieldLabel = (field) => PATIENT_HISTORY_FIELD_LABELS.get(field)
  || field.replace(/^details\./, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

export const Patients = ({
  patients,
  setPatients,
  doctors,
  hospitals = [],
  users,
  currentUser,
  presidentId,
  absences = [],
  notifications = [],
}) => {
  const isGvp = currentUser.role === "GVP";
  const canEditPatients = getPagePermission(currentUser, "patients").edit;
  const canViewGvpSharing = getPagePermission(currentUser, "patient-gvp-sharing").view;
  const canEditGvpSharing = getPagePermission(currentUser, "patient-gvp-sharing").edit;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionType, setAdmissionType] = useState("emergency");
  const [patientStatus, setPatientStatus] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [admissionDate, setAdmissionDate] = useState(getToday);
  const [dischargeDate, setDischargeDate] = useState("");
  const [pathology, setPathology] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [recommendedDoctorIds, setRecommendedDoctorIds] = useState([]);
  const [casId, setCasId] = useState(
    currentUser.role === "CAS" ? currentUser.id : "",
  );
  const [casIds, setCasIds] = useState(
    currentUser.role === "CAS" ? [currentUser.id] : [],
  );
  const [gvpIds, setGvpIds] = useState([]);
  const [casFilter, setCasFilter] = useState(
    currentUser.role === "CAS" ? currentUser.id : "all",
  );
  const [gvpPatientScope, setGvpPatientScope] = useState("mine");
  const [statusFilter, setStatusFilter] = useState("Ricoverato");
  const [notes, setNotes] = useState("");
  const [details, setDetails] = useState({ isMinorOrNewborn: "No" });
  const [departmentHistory, setDepartmentHistory] = useState([]);
  const [changeHistory, setChangeHistory] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const isGvpReadOnly = isGvp && !canEditPatients;
  const isTransferredReadOnly = editingId !== null && patientStatus === "Trasferito";
  const isPatientReadOnly = isGvpReadOnly || isTransferredReadOnly;
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [doctorSelectionModalOpen, setDoctorSelectionModalOpen] = useState(false);
  const [doctorModalTab, setDoctorModalTab] = useState("department");
  const [recommendedDoctorsModalOpen, setRecommendedDoctorsModalOpen] = useState(false);
  const [recommendedDoctorModalTab, setRecommendedDoctorModalTab] = useState("department");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [departmentSelectionModalOpen, setDepartmentSelectionModalOpen] = useState(false);
  const [departmentChangeReasonModalOpen, setDepartmentChangeReasonModalOpen] = useState(false);
  const [departmentChangeMode, setDepartmentChangeMode] = useState(null);
  const [departmentTransferScopeModalOpen, setDepartmentTransferScopeModalOpen] = useState(false);
  const [externalDepartmentTransferModalOpen, setExternalDepartmentTransferModalOpen] = useState(false);
  const [externalDepartmentTransferDestination, setExternalDepartmentTransferDestination] = useState("");
  const [externalDepartmentTransferError, setExternalDepartmentTransferError] = useState("");
  const [transferAutoSavePending, setTransferAutoSavePending] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentChangeDate, setDepartmentChangeDate] = useState(getToday);
  const [casSelectionModalOpen, setCasSelectionModalOpen] = useState(false);
  const [casModalTab, setCasModalTab] = useState("recommended");
  const [casSearch, setCasSearch] = useState("");
  const [gvpSelectionModalOpen, setGvpSelectionModalOpen] = useState(false);
  const [gvpModalTab, setGvpModalTab] = useState("recommended");
  const [gvpSearch, setGvpSearch] = useState("");
  const [notePatient, setNotePatient] = useState(null);
  const [newGvpNote, setNewGvpNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [casNotePatient, setCasNotePatient] = useState(null);
  const [newCasNote, setNewCasNote] = useState("");
  const [casNoteSaving, setCasNoteSaving] = useState(false);
  const [casNoteError, setCasNoteError] = useState("");
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferDraft, setTransferDraft] = useState("");
  const [transferError, setTransferError] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [sharedGvpFields, setSharedGvpFields] = useState(DEFAULT_GVP_PATIENT_SHARED_FIELDS);
  const [sharingDraft, setSharingDraft] = useState(DEFAULT_GVP_PATIENT_SHARED_FIELDS);
  const [sharingSaving, setSharingSaving] = useState(false);
  const [sharingMessage, setSharingMessage] = useState("");

  useEffect(() => {
    if (currentUser.role !== "GVP" && !canViewGvpSharing) return;
    Meteor.call("hlc.getGvpPatientSharingSettings", (methodError, fields) => {
      if (methodError || !Array.isArray(fields)) return;
      setSharedGvpFields(fields);
      setSharingDraft(fields);
    });
  }, [currentUser.role, canViewGvpSharing]);

  const isEditing = editingId !== null;
  const transferTargetPatient = transferTarget?.type === "patient"
    ? patients.find((patient) => patient.id === transferTarget.patientId)
    : null;
  const canDeleteTransfer = transferTarget?.type === "form"
    ? patientStatus === "Trasferito"
    : transferTargetPatient?.status === "Trasferito";
  const organizationPatients = patients
    .filter((patient) => patient.presidentId === presidentId)
    .map(maskClosedPatientForDisplay);
  const roleFilteredPatients = isGvp
    ? organizationPatients.filter((patient) => {
        const patientGvpIds = getPatientGvpIds(patient);
        const isMine = patientGvpIds.includes(currentUser.id) || getPatientCasIds(patient).includes(currentUser.id);
        return gvpPatientScope === "all" ? true : isMine;
      })
    : currentUser.role === "CAS" && casFilter !== "all"
      ? organizationPatients.filter((patient) => getPatientCasIds(patient).includes(casFilter))
      : organizationPatients;
  const visiblePatients = statusFilter === "all"
    ? roleFilteredPatients
    : roleFilteredPatients.filter(
        (patient) => (patient.status || "") === statusFilter,
      );
  const sortedVisiblePatients = [...visiblePatients].sort((first, second) =>
    (first.lastName || "").localeCompare(second.lastName || ""),
  );
  const patientPagination = usePagination(
    sortedVisiblePatients,
    25,
    `${statusFilter}:${casFilter}:${gvpPatientScope}`,
  );
  const currentNotePatient = notePatient;
  const visibleDoctors = doctors.filter(
    (doctor) => doctor.presidentId === presidentId,
  );
  const visibleHospitals = hospitals.filter(
    (hospital) => hospital.presidentId === presidentId,
  );
  const availableDepartments = visibleHospitals
    .flatMap((hospital) => (hospital.departments || []).map((department) => ({
      ...department,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
    })));
  const filteredDepartments = availableDepartments.filter((department) =>
    `${department.hospitalName || ""} ${department.name || ""}`
      .toLowerCase()
      .includes(departmentSearch.trim().toLowerCase()),
  );
  const selectedDepartment = availableDepartments.find((department) => department.id === details.departmentId);
  const visibleCasUsers = users.filter(
    (user) =>
      user.role === "CAS" &&
      (user.presidentId || user.associationId) === presidentId,
  );
  const isCasAssignedToDepartment = (user, department) => {
    if (!department) return false;
    const assignments = Array.isArray(user.hospitalAssignments)
      ? user.hospitalAssignments
      : user.hospitalId
        ? [{ hospitalId: user.hospitalId, departmentIds: user.departmentId ? [user.departmentId] : [] }]
        : [];
    return assignments.some((assignment) => {
      const assignmentDepartmentIds = Array.isArray(assignment.departmentIds)
        ? assignment.departmentIds
        : [];
      return assignment.hospitalId === department.hospitalId &&
        (assignmentDepartmentIds.length === 0 || assignmentDepartmentIds.includes(department.id));
    });
  };
  const departmentCasUsers = selectedDepartment
    ? visibleCasUsers.filter((user) => isCasAssignedToDepartment(user, selectedDepartment))
    : [];
  const departmentDoctors = selectedDepartment
    ? visibleDoctors.filter((availableDoctor) =>
        (Array.isArray(availableDoctor.departmentIds)
          ? availableDoctor.departmentIds
          : availableDoctor.departmentId ? [availableDoctor.departmentId] : []
        ).includes(selectedDepartment.id),
      )
    : [];
  const filteredDoctors = departmentDoctors.filter((doctor) =>
    `${doctor.lastName || ""} ${doctor.firstName || ""}`
      .toLowerCase()
      .includes(doctorSearch.trim().toLowerCase()),
  );
  const searchedVisibleDoctors = visibleDoctors.filter((doctor) =>
    `${doctor.lastName || ""} ${doctor.firstName || ""}`
      .toLowerCase()
      .includes(doctorSearch.trim().toLowerCase()),
  );
  const doctorsByHospital = visibleHospitals.map((hospital) => {
    const hospitalDepartmentIds = new Set((hospital.departments || []).map((department) => department.id));
    return {
      hospital,
      doctors: searchedVisibleDoctors.filter((doctor) =>
        (Array.isArray(doctor.departmentIds)
          ? doctor.departmentIds
          : doctor.departmentId ? [doctor.departmentId] : []
        ).some((departmentId) => hospitalDepartmentIds.has(departmentId)),
      ),
    };
  }).filter((group) => group.doctors.length > 0);
  const assignedDoctorIds = new Set(doctorsByHospital.flatMap((group) => group.doctors.map((doctor) => doctor.id)));
  const doctorsWithoutHospital = searchedVisibleDoctors.filter((doctor) => !assignedDoctorIds.has(doctor.id));
  const visibleGvpUsers = users.filter(
    (user) =>
      user.role === "GVP" &&
      (user.presidentId || user.associationId) === presidentId,
  );
  const getAbsenceOnAdmissionDate = (userId) => Boolean(admissionDate) && absences.find(
    (absence) => absence.userId === userId &&
      absence.startDate <= admissionDate && absence.endDate >= admissionDate,
  );
  const isAbsentOnAdmissionDate = (userId) => Boolean(getAbsenceOnAdmissionDate(userId));
  const formatAbsenceDate = (value) => new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
  const getAbsenceLabel = (userId) => {
    const absence = getAbsenceOnAdmissionDate(userId);
    return absence
      ? `Assente dal ${formatAbsenceDate(absence.startDate)} al ${formatAbsenceDate(absence.endDate)}`
      : "";
  };
  const availableFirst = (first, second) =>
    Number(isAbsentOnAdmissionDate(first.id)) - Number(isAbsentOnAdmissionDate(second.id)) ||
    (first.username || "").localeCompare(second.username || "", "it-IT");
  const orderedCasUsers = [...visibleCasUsers].sort(availableFirst);
  const recommendedCasUsers = [...departmentCasUsers].sort(availableFirst);
  const filteredCasUsers = (casModalTab === "recommended" ? recommendedCasUsers : orderedCasUsers).filter((user) =>
    (user.username || "").toLowerCase().includes(casSearch.trim().toLowerCase()),
  );
  const getGvpDisplayName = (user) => {
    const firstName = user.firstName?.trim();
    const lastName = user.lastName?.trim();
    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(" ");
    }
    return user.username || "";
  };
  const parseHistoryValue = (value) => {
    try { return JSON.parse(value); } catch { return value; }
  };
  const formatResolvedHistoryValue = (field, value) => {
    if (value === undefined || value === null || value === "") return "Non compilato";
    if (value === MASKED_VALUE) return MASKED_VALUE;
    const parsed = parseHistoryValue(value);
    const resolveDoctor = (doctorIdValue) => {
      const resolvedDoctor = visibleDoctors.find((item) => item.id === doctorIdValue);
      return resolvedDoctor ? `${resolvedDoctor.lastName} ${resolvedDoctor.firstName}` : "Medico non più disponibile";
    };
    const resolveUser = (userIdValue) => {
      const resolvedUser = users.find((item) => item.id === userIdValue);
      if (!resolvedUser) return "Utente non più disponibile";
      return resolvedUser.role === "GVP" ? getGvpDisplayName(resolvedUser) : resolvedUser.username || `${resolvedUser.firstName || ""} ${resolvedUser.lastName || ""}`.trim();
    };
    if (field === "admissionType") return admissionTypeLabel(String(parsed));
    if (field === "doctorId") return parsed ? resolveDoctor(parsed) : "Non assegnato";
    if (field === "recommendedDoctorIds") return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(resolveDoctor).join(", ") : "Nessun medico consigliato";
    if (["casId", "gvpId"].includes(field)) return parsed ? resolveUser(parsed) : "Non assegnato";
    if (["casIds", "gvpIds"].includes(field)) return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(resolveUser).join(", ") : "Nessun utente assegnato";
    if (field === "details.departmentId") {
      const department = availableDepartments.find((item) => item.id === parsed);
      return department ? `${department.hospitalName} / ${department.name}` : "Reparto non più disponibile";
    }
    if (field === "departmentHistory" && Array.isArray(parsed)) {
      return parsed.length > 0
        ? parsed.map((movement) => [movement.toHospitalName, movement.toDepartmentName, movement.date].filter(Boolean).join(" / ")).join("; ")
        : "Nessun trasferimento registrato";
    }
    if (["gvpNotes", "casNotes"].includes(field) && Array.isArray(parsed)) return `${parsed.length} note`;
    if (parsed === true || parsed === "true") return "Sì";
    if (parsed === false || parsed === "false") return "No";
    return formatPatientHistoryValue(value);
  };
  const normalizedGvpSearch = gvpSearch.trim().toLowerCase();
  const isGvpAssignedToCas = (user, selectedCasId) => Boolean(selectedCasId) && [
    ...(Array.isArray(user.casIds) ? user.casIds : []),
    user.casId,
    user.associationId,
  ].filter(Boolean).includes(selectedCasId);
  const isGvpAssignedToDepartment = (user, department) => {
    if (!department) return false;
    const assignments = Array.isArray(user.hospitalAssignments)
      ? user.hospitalAssignments
      : user.hospitalId
        ? [{ hospitalId: user.hospitalId, departmentIds: user.departmentId ? [user.departmentId] : [] }]
        : [];
    return assignments.some((assignment) => {
      const assignmentDepartmentIds = Array.isArray(assignment.departmentIds)
        ? assignment.departmentIds
        : [];
      return assignment.hospitalId === department.hospitalId &&
        (assignmentDepartmentIds.length === 0 || assignmentDepartmentIds.includes(department.id));
    });
  };
  const recommendedGvpUsers = visibleGvpUsers.filter((user) =>
    casIds.some((selectedCasId) => isGvpAssignedToCas(user, selectedCasId)) || isGvpAssignedToDepartment(user, selectedDepartment),
  );
  const gvpUsersForActiveTab = gvpModalTab === "recommended" ? recommendedGvpUsers : visibleGvpUsers;
  const associatedGvpUsers = gvpUsersForActiveTab.filter((user) => gvpIds.includes(user.id)).filter((user) => {
    if (!normalizedGvpSearch) return true;
    return `${getGvpDisplayName(user)}`.toLowerCase().includes(normalizedGvpSearch);
  }).sort(availableFirst);
  const unassociatedGvpUsers = gvpUsersForActiveTab.filter((user) => !gvpIds.includes(user.id)).filter((user) => {
    if (!normalizedGvpSearch) return true;
    return `${getGvpDisplayName(user)}`.toLowerCase().includes(normalizedGvpSearch);
  }).sort(availableFirst);
  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setAdmissionType("emergency");
    setPatientStatus("");
    setTransferNotes("");
    setAdmissionDate(getToday());
    setDischargeDate("");
    setPathology("");
    setDoctorId("");
    setRecommendedDoctorIds([]);
    setCasId(currentUser.role === "CAS" ? currentUser.id : "");
    setCasIds(currentUser.role === "CAS" ? [currentUser.id] : []);
    setGvpIds([]);
    setNotes("");
    setNewGvpNote("");
    setDetails({ isMinorOrNewborn: "No" });
    setDepartmentHistory([]);
    setChangeHistory([]);
    setEditingId(null);
    setError("");
    setActiveTab("main");
    setDoctorSelectionModalOpen(false);
    setRecommendedDoctorsModalOpen(false);
    setDepartmentSelectionModalOpen(false);
    setDepartmentChangeReasonModalOpen(false);
    setDepartmentChangeMode(null);
    setDepartmentTransferScopeModalOpen(false);
    setExternalDepartmentTransferModalOpen(false);
    setExternalDepartmentTransferDestination("");
    setExternalDepartmentTransferError("");
    setTransferAutoSavePending(false);
    setDepartmentChangeDate(getToday());
    setCasSelectionModalOpen(false);
    setGvpSelectionModalOpen(false);
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openGvpSelectionModal = () => {
    setError("");
    setGvpSearch("");
    setGvpModalTab("recommended");
    setGvpSelectionModalOpen(true);
  };

  const openCasSelectionModal = () => {
    if (!selectedDepartment) return;
    setError("");
    setCasSearch("");
    setCasModalTab("recommended");
    setCasSelectionModalOpen(true);
  };

  const closeCasSelectionModal = () => setCasSelectionModalOpen(false);

  const openDoctorSelectionModal = () => {
    if (!selectedDepartment) return;
    setError("");
    setDoctorSearch("");
    setDoctorModalTab("department");
    setDoctorSelectionModalOpen(true);
  };

  const closeDoctorSelectionModal = () => setDoctorSelectionModalOpen(false);

  const openRecommendedDoctorsModal = () => {
    if (!selectedDepartment) return;
    setError("");
    setDoctorSearch("");
    setRecommendedDoctorModalTab("department");
    setRecommendedDoctorsModalOpen(true);
  };

  const closeRecommendedDoctorsModal = () => setRecommendedDoctorsModalOpen(false);

  const toggleRecommendedDoctor = (selectedDoctorId) => {
    setRecommendedDoctorIds((current) => current.includes(selectedDoctorId)
      ? current.filter((id) => id !== selectedDoctorId)
      : [...current, selectedDoctorId]);
    setError("");
  };

  const openDepartmentSelectionModal = () => {
    setError("");
    setDepartmentSearch("");
    setDepartmentChangeDate(getToday());
    if (isEditing && selectedDepartment) {
      setDepartmentChangeReasonModalOpen(true);
      return;
    }
    setDepartmentChangeMode(null);
    setDepartmentSelectionModalOpen(true);
  };

  const continueDepartmentChange = (mode) => {
    setDepartmentChangeMode(mode);
    setDepartmentChangeReasonModalOpen(false);
    setDepartmentSelectionModalOpen(true);
  };

  const openDepartmentTransferScope = () => {
    setDepartmentChangeReasonModalOpen(false);
    setDepartmentTransferScopeModalOpen(true);
  };

  const continueInternalDepartmentTransfer = () => {
    setDepartmentTransferScopeModalOpen(false);
    continueDepartmentChange("transfer");
  };

  const openExternalDepartmentTransfer = () => {
    setDepartmentTransferScopeModalOpen(false);
    setExternalDepartmentTransferDestination("");
    setExternalDepartmentTransferError("");
    setExternalDepartmentTransferModalOpen(true);
  };

  const saveExternalDepartmentTransfer = () => {
    const destination = externalDepartmentTransferDestination.trim();
    if (!destination) {
      setExternalDepartmentTransferError("Indica dove viene trasferito il paziente.");
      return;
    }
    setDepartmentHistory((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        date: departmentChangeDate || getToday(),
        changedById: currentUser.id,
        changedByName: currentUser.username || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.role,
        changedByRole: currentUser.role,
        toDepartmentId: "",
        toDepartmentName: "Trasferimento esterno",
        toHospitalName: destination,
        external: true,
      },
    ]);
    setPatientStatus("Trasferito");
    setTransferNotes(destination);
    setTransferAutoSavePending(true);
    setExternalDepartmentTransferModalOpen(false);
    setExternalDepartmentTransferDestination("");
    setExternalDepartmentTransferError("");
  };

  const selectPatientDepartment = (department) => {
    if (selectedDepartment?.id === department.id) {
      closeDepartmentSelectionModal();
      return;
    }

    if (isEditing && selectedDepartment && departmentChangeMode === "transfer") {
      setPatientStatus("Trasferito");
      setTransferNotes(`${department.hospitalName} / ${department.name}`);
      setDepartmentHistory((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          date: departmentChangeDate || getToday(),
          changedById: currentUser.id,
          changedByName: currentUser.username || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.role,
          changedByRole: currentUser.role,
          toDepartmentId: department.id,
          toDepartmentName: department.name,
          toHospitalName: department.hospitalName,
        },
      ]);
    } else if (isEditing && selectedDepartment && departmentChangeMode === "correction") {
      setDepartmentHistory((current) => current.map((movement, index) => index === current.length - 1
        ? {
            ...movement,
            toDepartmentId: department.id,
            toDepartmentName: department.name,
            toHospitalName: department.hospitalName,
            correctedAt: new Date(),
            correctedById: currentUser.id,
          }
        : movement));
    }

    setDetails((current) => ({
      ...current,
      departmentId: department.id,
      hospitalName: department.hospitalName,
      hospitalDepartment: department.name,
    }));

    setCasId("");
    setCasIds([]);

    const eligibleDoctors = visibleDoctors.filter((availableDoctor) =>
      (Array.isArray(availableDoctor.departmentIds)
        ? availableDoctor.departmentIds
        : availableDoctor.departmentId ? [availableDoctor.departmentId] : []
      ).includes(department.id),
    );
    setDoctorId(eligibleDoctors[0]?.id || "");
    setRecommendedDoctorIds(eligibleDoctors.map((availableDoctor) => availableDoctor.id));
    if (departmentChangeMode === "transfer") setTransferAutoSavePending(true);
    setError("");
    closeDepartmentSelectionModal();
  };

  const closeDepartmentSelectionModal = () => {
    setDepartmentSelectionModalOpen(false);
    setDepartmentChangeMode(null);
  };

  const closeGvpSelectionModal = () => {
    setGvpSelectionModalOpen(false);
  };

  const toggleGvpSelection = (gvpUser) => {
    setGvpIds((current) => current.includes(gvpUser.id)
      ? current.filter((id) => id !== gvpUser.id)
      : [...current, gvpUser.id]);
    setError("");
  };

  const savePatient = () => {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPathology = pathology.trim();
    const normalizedNotes = notes.trim();
    const validDoctorId = selectedDepartment && visibleDoctors.some(
      (doctor) => doctor.id === doctorId,
    )
      ? doctorId
      : "";
    const validRecommendedDoctorIds = selectedDepartment
      ? recommendedDoctorIds.filter((selectedDoctorId) =>
          visibleDoctors.some((doctor) => doctor.id === selectedDoctorId),
        )
      : [];
    const validCasIds = selectedDepartment
      ? casIds.filter((selectedCasId) => visibleCasUsers.some((user) => user.id === selectedCasId))
      : [];
    const validCasId = validCasIds[0] || "";
    const validGvpIds = gvpIds.filter((gvpUserId) => users.some(
      (user) =>
        user.id === gvpUserId &&
        user.role === "GVP" &&
        (user.presidentId || user.associationId) === presidentId,
    ));
    const resolvedDepartmentHistory = departmentHistory.length > 0 || !selectedDepartment
      ? departmentHistory
      : [{
          id: crypto.randomUUID(),
          date: admissionDate || getToday(),
          changedById: currentUser.id,
          changedByName: currentUser.username || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.role,
          changedByRole: currentUser.role,
          toDepartmentId: selectedDepartment.id,
          toDepartmentName: selectedDepartment.name,
          toHospitalName: selectedDepartment.hospitalName,
          initialAssignment: true,
        }];

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !admissionDate ||
      !normalizedPathology
    ) {
      setError("Completa nome, cognome, patologia e data di ingresso.");
      setActiveTab(!normalizedFirstName || !normalizedLastName ? "main" : "insertion");
      return false;
    }

    if (patientStatus === "Trasferito" && !transferNotes.trim()) {
      setError("Indica dove è stato trasferito il paziente.");
      setActiveTab("main");
      return false;
    }

    const patientData = {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      admissionType: ADMISSION_TYPES.includes(admissionType) ? admissionType : "emergency",
      status: PATIENT_RECORD_STATUSES.includes(patientStatus) ? patientStatus : "",
      transferNotes: patientStatus === "Trasferito" ? transferNotes.trim() : "",
      admissionDate,
      dischargeDate,
      pathology: normalizedPathology,
      doctorId: validDoctorId,
      recommendedDoctorIds: validRecommendedDoctorIds,
      casId: validCasId,
      casIds: validCasIds,
      gvpIds: validGvpIds,
      gvpId: validGvpIds[0] || "",
      notes: normalizedNotes,
      details,
      departmentHistory: resolvedDepartmentHistory,
      presidentId,
    };

    const savedPatient = {
      id: editingId || crypto.randomUUID(),
      ...patientData,
    };

    if (isEditing) {
      setPatients((current) =>
        current.map((patient) =>
          patient.id === editingId ? { ...patient, ...savedPatient } : patient,
        ),
      );
    } else {
      setPatients((current) => [...current, savedPatient]);
      if (statusFilter !== "all" && statusFilter !== savedPatient.status) {
        setStatusFilter(savedPatient.status);
      }
    }

    resetForm();
    return savedPatient;
  };

  useEffect(() => {
    if (!transferAutoSavePending) return;
    setTransferAutoSavePending(false);
    savePatient();
  }, [transferAutoSavePending]);

  const handleSubmit = (event) => {
    event.preventDefault();
    savePatient();
  };

  const handleOpenPdf = async () => {
    const savedPatient = savePatient();
    if (!savedPatient) return;

    const pdfWindow = globalThis.open("", "_blank");
    try {
      const doctor = doctors.find((item) => item.id === savedPatient.doctorId);
      const casUser = users.find((item) => item.id === savedPatient.casId);
      const pdfUrl = await createPopulatedPatientPdf({
        patient: savedPatient,
        doctorName: doctor ? `${doctor.lastName} ${doctor.firstName}` : "",
        casName: casUser?.username || "",
      });
      if (pdfWindow) {
        pdfWindow.location.href = pdfUrl;
      } else {
        globalThis.location.href = pdfUrl;
      }
      globalThis.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (pdfError) {
      pdfWindow?.close();
      globalThis.alert(pdfError.message || "Impossibile generare il PDF compilato.");
    }
  };

  const handleOpenSimplifiedPdf = async () => {
    const savedPatient = savePatient();
    if (!savedPatient) return;
    const pdfWindow = globalThis.open("", "_blank");
    try {
      const pdfUrl = await createSimplifiedPatientPdf(savedPatient);
      if (pdfWindow) {
        pdfWindow.location.href = pdfUrl;
      } else {
        globalThis.location.href = pdfUrl;
      }
      globalThis.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (pdfError) {
      pdfWindow?.close();
      globalThis.alert(pdfError.message || "Impossibile generare il PDF semplificato.");
    }
  };

  const populatePatientForm = (patient) => {
    setEditingId(patient.id);
    setFirstName(patient.firstName);
    setLastName(patient.lastName);
    setAdmissionType(ADMISSION_TYPES.includes(patient.admissionType) ? patient.admissionType : "emergency");
    setPatientStatus(
      PATIENT_RECORD_STATUSES.includes(patient.status) ? patient.status : "",
    );
    setTransferNotes(patient.transferNotes || "");
    setAdmissionDate(patient.admissionDate || getToday());
    setDischargeDate(patient.dischargeDate || "");
    setPathology(patient.pathology || "");
    setDoctorId(patient.doctorId || "");
    setRecommendedDoctorIds(Array.isArray(patient.recommendedDoctorIds) ? patient.recommendedDoctorIds : []);
    setCasId(patient.casId || "");
    setCasIds(getPatientCasIds(patient));
    setGvpIds(getPatientGvpIds(patient));
    setNotes(patient.notes || "");
    setDetails({
      ...(patient.details || {}),
      sex: patient.details?.sex === "Maschile"
        ? "Maschio"
        : patient.details?.sex === "Femminile"
          ? "Femmina"
          : patient.details?.sex || "",
      isMinorOrNewborn: patient.details?.isMinorOrNewborn || "No",
    });
    setDepartmentHistory(Array.isArray(patient.departmentHistory) ? patient.departmentHistory : []);
    setChangeHistory(Array.isArray(patient.changeHistory) ? patient.changeHistory : []);
    setError("");
    setActiveTab("summary");
    setModalOpen(true);
  };

  const handleEdit = (patient) => {
    Meteor.call("hlc.getPatientDetails", patient.id, (methodError, fullPatient) => {
      if (methodError || !fullPatient) {
        globalThis.alert(methodError?.reason || "Impossibile caricare la scheda del paziente.");
        return;
      }
      populatePatientForm({ ...fullPatient, id: fullPatient._id || patient.id });
    });
  };

  const handleDelete = async () => {
    const patient = patients.find((item) => item.id === editingId);

    if (
      !patient ||
      !await confirmAction(
        `Eliminare il paziente ${patient.firstName} ${patient.lastName}?`,
      )
    ) {
      return;
    }

    setPatients((current) =>
      current.filter((item) => item.id !== editingId),
    );
    resetForm();
  };

  const updatePatientStatus = (patientId, status) => {
    if (status !== "" && !PATIENT_STATUSES.includes(status)) return;
    if (status === "Trasferito") {
      const patient = patients.find((item) => item.id === patientId);
      if (!patient) return;
      setTransferTarget({ type: "patient", patientId });
      setTransferDraft(patient.transferNotes || "");
      setTransferError("");
      return;
    }
    setPatients((current) => current.map((patient) =>
      patient.id === patientId ? { ...patient, status, transferNotes: "" } : patient,
    ));
  };

  const requestFormStatusChange = (status) => {
    if (status === "Trasferito") {
      setTransferTarget({ type: "form" });
      setTransferDraft(transferNotes);
      setTransferError("");
      return;
    }
    setPatientStatus(status);
    setTransferNotes("");
    setError("");
  };

  const closeTransferModal = () => {
    setTransferTarget(null);
    setTransferDraft("");
    setTransferError("");
  };

  const saveTransfer = () => {
    const normalizedTransferNotes = transferDraft.trim();
    if (!normalizedTransferNotes) {
      setTransferError("Indica dove è stato trasferito il paziente.");
      return;
    }
    if (transferTarget?.type === "form" && editingId && patientStatus === "Trasferito") {
      Meteor.call("hlc.updateTransferredPatientNotes", editingId, normalizedTransferNotes, (methodError, savedNotes) => {
        if (methodError) {
          setTransferError(methodError.reason || "Impossibile aggiornare le note del trasferimento.");
          return;
        }
        setTransferNotes(savedNotes);
        setPatients((current) => current.map((patient) => patient.id === editingId
          ? { ...patient, transferNotes: savedNotes }
          : patient));
        closeTransferModal();
      });
      return;
    }
    if (transferTarget?.type === "form") {
      setPatientStatus("Trasferito");
      setTransferNotes(normalizedTransferNotes);
    } else if (transferTarget?.type === "patient") {
      setPatients((current) => current.map((patient) =>
        patient.id === transferTarget.patientId
          ? { ...patient, status: "Trasferito", transferNotes: normalizedTransferNotes }
          : patient,
      ));
    }
    closeTransferModal();
  };

  const deleteTransfer = () => {
    if (!canDeleteTransfer) return;
    if (transferTarget?.type === "form") {
      setPatientStatus("Ricoverato");
      setTransferNotes("");
    } else if (transferTarget?.type === "patient") {
      setPatients((current) => current.map((patient) =>
        patient.id === transferTarget.patientId
          ? { ...patient, status: "Ricoverato", transferNotes: "" }
          : patient,
      ));
    }
    closeTransferModal();
  };

  const openNotes = (patient) => {
    const isAssigned = currentUser.role === "CAS"
      ? getPatientCasIds(patient).includes(currentUser.id)
      : currentUser.role === "GVP" && getPatientGvpIds(patient).includes(currentUser.id);
    if (isAssigned) {
      notifications
        .filter((notification) =>
          notification.type === "patient-note" &&
          notification.patientId === patient.id &&
          !notification.readAt,
        )
        .forEach((notification) => Meteor.call("hlc.markNotificationAsRead", notification.id));
    }
    setNotePatient(patient);
    setNewGvpNote("");
    setNoteError("");
    Meteor.call("hlc.getPatientDetails", patient.id, (methodError, fullPatient) => {
      if (methodError || !fullPatient) {
        setNoteError(methodError?.reason || "Impossibile caricare le note.");
        return;
      }
      setNotePatient({ ...fullPatient, id: fullPatient._id || patient.id });
    });
  };

  const closeNotes = () => {
    setNotePatient(null);
    setNewGvpNote("");
    setNoteError("");
  };

  const getUnreadNoteCount = (patient) => {
    const isAssigned = currentUser.role === "CAS"
      ? getPatientCasIds(patient).includes(currentUser.id)
      : currentUser.role === "GVP" && getPatientGvpIds(patient).includes(currentUser.id);
    if (!isAssigned) return 0;
    return notifications.filter((notification) =>
      notification.type === "patient-note" &&
      notification.patientId === patient.id &&
      !notification.readAt,
    ).length;
  };

  const saveGvpNotes = () => {
    if (!notePatient || noteSaving || !newGvpNote.trim()) return;
    setNoteSaving(true);
    setNoteError("");
    Meteor.call("hlc.addPatientNote", notePatient.id, newGvpNote, (methodError) => {
      setNoteSaving(false);
      if (methodError) {
        setNoteError(methodError.reason || "Impossibile salvare le note.");
        return;
      }
      closeNotes();
    });
  };

  const deleteGvpNote = async (note) => {
    if (!notePatient || note.authorId !== currentUser.id) return;
    if (!await confirmAction("Eliminare questa nota?")) return;
    setNoteError("");
    Meteor.call("hlc.deletePatientNote", notePatient.id, note.id, (methodError) => {
      if (methodError) {
        setNoteError(methodError.reason || "Impossibile eliminare la nota.");
        return;
      }
      setNotePatient((current) => current
        ? { ...current, gvpNotes: getGvpNotes(current).filter((item) => item.id !== note.id) }
        : current);
    });
  };

  const openCasNotes = (patient) => {
    notifications
      .filter((notification) => notification.type === "patient-cas-note" && notification.patientId === patient.id && !notification.readAt)
      .forEach((notification) => Meteor.call("hlc.markNotificationAsRead", notification.id));
    setCasNotePatient(patient);
    setNewCasNote("");
    setCasNoteError("");
    Meteor.call("hlc.getPatientDetails", patient.id, (methodError, fullPatient) => {
      if (methodError || !fullPatient) {
        setCasNoteError(methodError?.reason || "Impossibile caricare le note CAS.");
        return;
      }
      setCasNotePatient({ ...fullPatient, id: fullPatient._id || patient.id });
    });
  };

  const closeCasNotes = () => {
    setCasNotePatient(null);
    setNewCasNote("");
    setCasNoteError("");
  };

  const getUnreadCasNoteCount = (patient) => notifications.filter((notification) =>
    notification.type === "patient-cas-note" && notification.patientId === patient.id && !notification.readAt,
  ).length;

  const saveCasNote = () => {
    if (!casNotePatient || casNoteSaving || !newCasNote.trim()) return;
    setCasNoteSaving(true);
    setCasNoteError("");
    Meteor.call("hlc.addPatientCasNote", casNotePatient.id, newCasNote, (methodError) => {
      setCasNoteSaving(false);
      if (methodError) {
        setCasNoteError(methodError.reason || "Impossibile salvare la nota CAS.");
        return;
      }
      closeCasNotes();
    });
  };

  const deleteCasNote = async (note) => {
    if (!casNotePatient || note.authorId !== currentUser.id) return;
    if (!await confirmAction("Eliminare questa nota CAS?")) return;
    setCasNoteError("");
    Meteor.call("hlc.deletePatientCasNote", casNotePatient.id, note.id, (methodError) => {
      if (methodError) {
        setCasNoteError(methodError.reason || "Impossibile eliminare la nota CAS.");
        return;
      }
      setCasNotePatient((current) => current
        ? { ...current, casNotes: getCasNotes(current).filter((item) => item.id !== note.id) }
        : current);
    });
  };

  const doctor = doctors.find((item) => item.id === doctorId);
  const recommendedDoctors = visibleDoctors.filter((item) => recommendedDoctorIds.includes(item.id));
  const selectedCasUsers = users.filter((item) => casIds.includes(item.id));
  const selectedCasUser = selectedCasUsers[0];
  const selectedGvpUsers = users.filter((item) => gvpIds.includes(item.id));
  const sharingOptions = GVP_PATIENT_SUMMARY_FIELDS;

  const openSharingModal = () => {
    setSharingDraft(sharedGvpFields);
    setSharingMessage("");
    setSharingModalOpen(true);
  };

  const toggleSharingField = (field) => {
    setSharingDraft((current) => current.includes(field)
      ? current.filter((item) => item !== field)
      : [...current, field]);
    setSharingMessage("");
  };

  const saveSharingSettings = () => {
    setSharingSaving(true);
    setSharingMessage("");
    Meteor.call("hlc.updateGvpPatientSharingSettings", sharingDraft, (methodError, fields) => {
      setSharingSaving(false);
      if (methodError) {
        setSharingMessage(methodError.reason || "Impossibile salvare le informazioni condivise.");
        return;
      }
      setSharedGvpFields(fields);
      setSharingDraft(fields);
      setSharingMessage("Impostazioni salvate.");
    });
  };

  const summaryEntries = [
    { label: "Nome", value: firstName },
    { label: "Cognome", value: lastName },
    { label: "Sesso", value: details.sex },
    ...(details.sex === "Femmina" ? [{ label: "Cognome da nubile", value: details.maidenName }] : []),
    { label: "DAT compilata?", value: details.datCompleted },
    { label: "DAT registrata?", value: details.datRegistered },
    { label: "Tipo di accesso", value: admissionType === MASKED_VALUE ? MASKED_VALUE : admissionTypeLabel(admissionType) },
    { label: "Stato", value: patientStatus },
    ...(patientStatus === "Trasferito" ? [{ label: "Dove è stato trasferito", value: transferNotes }] : []),
    { label: "Medico responsabile", value: doctor ? `${doctor.lastName} ${doctor.firstName}` : "Non assegnato" },
    { label: "Medici consigliati", value: recommendedDoctors.length > 0 ? recommendedDoctors.map((item) => `${item.lastName} ${item.firstName}`).join("\n") : "Nessun medico consigliato" },
    { label: "Reparto", value: selectedDepartment ? `${selectedDepartment.hospitalName} / ${selectedDepartment.name}` : "Non assegnato" },
    { label: "CAS", value: selectedCasUsers.length > 0 ? selectedCasUsers.map((user) => user.username).join(", ") : "Non assegnato" },
    { label: "GVP assegnati", value: selectedGvpUsers.length > 0 ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ") : "Nessun GVP assegnato" },
    ...DETAIL_SECTIONS.flatMap((section) =>
      section.fields.map((field) => ({
        label: `${section.title} — ${field[1]}`,
        value: details[field[0]],
      })),
    ),
  ];

  const getSharingSummaryValue = (field) => {
    if (CLOSED_PATIENT_STATUSES.includes(patientStatus) && CLOSED_PATIENT_HIDDEN_FIELDS.includes(field)) return MASKED_VALUE;
    if (field === "firstName") return firstName;
    if (field === "lastName") return lastName;
    if (field === "admissionType") return admissionTypeLabel(admissionType);
    if (field === "status") return patientStatus;
    if (field === "transferNotes") return transferNotes;
    if (field === "doctorId") return doctor ? `${doctor.lastName} ${doctor.firstName}` : "Non assegnato";
    if (field === "recommendedDoctorIds") return recommendedDoctors.length > 0 ? recommendedDoctors.map((item) => `${item.lastName} ${item.firstName}`).join("\n") : "Nessun medico consigliato";
    if (field === "details.departmentId") return selectedDepartment ? `${selectedDepartment.hospitalName} / ${selectedDepartment.name}` : "Non assegnato";
    if (field === "casIds") return selectedCasUsers.length > 0 ? selectedCasUsers.map((user) => user.username).join(", ") : "Non assegnato";
    if (field === "gvpIds") return selectedGvpUsers.length > 0 ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ") : "Nessun GVP assegnato";
    return field.startsWith("details.") ? details[field.slice(8)] : "";
  };
  const gvpSummaryEntries = sharingOptions
    .filter(([field]) => sharedGvpFields.includes(field))
    .map(([field, label]) => ({ label, value: getSharingSummaryValue(field) }));
  if (patientStatus === "Trasferito") {
    gvpSummaryEntries.push({ label: "Destinazione del trasferimento", value: transferNotes });
  }

  const mainSummaryEntries = [
    { label: "Nome", value: firstName },
    { label: "Cognome", value: lastName },
    { label: "Sesso", value: details.sex },
    ...(details.sex === "Femmina" ? [{ label: "Cognome da nubile", value: details.maidenName }] : []),
    { label: "DAT compilata?", value: details.datCompleted },
    { label: "DAT registrata?", value: details.datRegistered },
    { label: "Tipo di accesso", value: admissionType === MASKED_VALUE ? MASKED_VALUE : admissionTypeLabel(admissionType) },
    { label: "Stato", value: patientStatus },
    ...(patientStatus === "Trasferito" ? [{ label: "Destinazione del trasferimento", value: transferNotes }] : []),
    { label: "Medico responsabile", value: doctor ? `${doctor.lastName} ${doctor.firstName}` : "Non assegnato" },
    { label: "Medici consigliati", value: recommendedDoctors.length > 0 ? recommendedDoctors.map((item) => `${item.lastName} ${item.firstName}`).join("\n") : "Nessun medico consigliato" },
    { label: "Numero camera", value: details.hospitalRoom },
    { label: "Numero letto", value: details.hospitalBed },
    { label: "Visita con l’anestesista", value: details.anesthesiologistDate },
    { label: "Orario visita", value: details.anesthesiologistTime },
    { label: "Anestesista", value: details.anesthesiologistName },
    { label: "CAS", value: selectedCasUsers.length > 0 ? selectedCasUsers.map((user) => user.username).join(", ") : "Non assegnato" },
    { label: "GVP assegnati", value: selectedGvpUsers.length > 0 ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ") : "Nessun GVP assegnato" },
    { label: "Reparto", value: selectedDepartment ? `${selectedDepartment.hospitalName} / ${selectedDepartment.name}` : "Non assegnato" },
    ...SIMPLIFIED_FIELDS
      .filter(([name]) => !["datCompleted", "datRegistered"].includes(name))
      .map(([name, label]) => ({ label, value: details[name] })),
  ];

  return (
    <>
      <div className="app-content-header patient-page-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div><h1 className="mb-1">Pazienti</h1><p className="text-secondary mb-0">Gestisci le informazioni, le assegnazioni e lo storico dei pazienti.</p></div>
            <div className="d-flex align-items-center gap-2 flex-nowrap patient-header-actions">
              <select
                className="form-select w-auto flex-shrink-0"
                aria-label="Filtra pazienti per stato"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Tutti gli stati</option>
                <option value="">Senza stato</option>
                {PATIENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {isGvp && (
                <select className="form-select w-auto flex-shrink-0" aria-label="Filtra pazienti del GVP" value={gvpPatientScope} onChange={(event) => setGvpPatientScope(event.target.value)}>
                  <option value="mine">I miei pazienti</option>
                  <option value="all">Tutti i pazienti</option>
                </select>
              )}
              {!isGvp && currentUser.role === "CAS" && <select className="form-select w-auto flex-shrink-0" aria-label="Filtra pazienti per CAS" value={casFilter} onChange={(event) => setCasFilter(event.target.value)}>
                <option value={currentUser.id}>I miei pazienti</option>
                <option value="all">Tutti i pazienti</option>
                {visibleCasUsers.filter((casUser) => casUser.id !== currentUser.id).map((casUser) => <option key={casUser.id} value={casUser.id}>{casUser.username}</option>)}
              </select>}
              {canViewGvpSharing && <button className="btn btn-outline-primary" type="button" onClick={openSharingModal}>Scegli info da condividere con GVP</button>}
              {canEditPatients && <button className="btn btn-primary" type="button" onClick={openCreateModal}>Inserisci</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="app-content patient-page-content">
        <div className="container-fluid">
          {sharingModalOpen && <>
            <button className="entity-modal-backdrop" type="button" aria-label="Chiudi scelta informazioni" onClick={() => setSharingModalOpen(false)} />
            <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="gvp-sharing-title">
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center gap-3">
                  <div className="flex-grow-1">
                    <h2 className="card-title mb-1" id="gvp-sharing-title">Scegli info da condividere con GVP</h2>
                    <p className="text-secondary small mb-0 patient-sharing-description">La scelta vale per tutti i pazienti e per tutti i GVP assegnati.</p>
                  </div>
                  <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={() => setSharingModalOpen(false)} />
                </div>
                <div className="card-body">
                  {canEditGvpSharing && <div className="d-flex justify-content-end gap-2 mb-3">
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setSharingDraft([])}>Deseleziona tutto</button>
                    <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => setSharingDraft(sharingOptions.map(([field]) => field))}>Seleziona tutto</button>
                  </div>}
                  <div className="patient-sharing-list">
                    {sharingOptions.map(([field, label]) => (
                      <label className="patient-sharing-row" key={field}>
                        <span>{label}</span>
                        <span className="form-check d-flex align-items-center gap-2 mb-0">
                          <input className="form-check-input mt-0" type="checkbox" checked={sharingDraft.includes(field)} disabled={!canEditGvpSharing} onChange={() => toggleSharingField(field)} />
                          <span>Condividi</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="card-footer d-flex align-items-center justify-content-end gap-3">
                  {sharingMessage && <span className={sharingMessage === "Impostazioni salvate." ? "text-success" : "text-danger"}>{sharingMessage}</span>}
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setSharingModalOpen(false)}>Chiudi</button>
                  {canEditGvpSharing && <button className="btn btn-primary" type="button" disabled={sharingSaving} onClick={saveSharingSettings}>{sharingSaving ? "Salvataggio..." : "Salva"}</button>}
                </div>
              </section>
            </div>
          </>}
          {notePatient && <>
            <button className="entity-modal-backdrop" type="button" aria-label="Chiudi note GVP" onClick={closeNotes} />
            <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="gvp-notes-title">
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title" id="gvp-notes-title">Note GVP — {notePatient.lastName} {notePatient.firstName}</h2>
                  <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeNotes} />
                </div>
                <div className="card-body">
                  {noteError && <div className="alert alert-danger py-2" role="alert">{noteError}</div>}
                  <h3 className="h6">Note GVP esistenti</h3>
                  {getGvpNotes(currentNotePatient).length === 0 ? <p className="text-secondary">Nessuna nota inserita.</p> : <div className="d-grid gap-2 mb-4">{getGvpNotes(currentNotePatient).map((note) => <article className="border rounded p-3" key={note.id}><div className="d-flex align-items-start justify-content-between gap-3"><p className="mb-1">{note.text}</p>{note.authorId === currentUser.id && <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteGvpNote(note)}>Elimina</button>}</div><div className="d-flex align-items-center gap-2"><span className={`badge ${getNoteRoleBadgeClass(note.authorRole)}`}>{note.authorRole || "GVP"}</span><small className="text-secondary">{note.author || "GVP"}{note.createdAt ? ` · ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(note.createdAt))}` : ""}</small></div></article>)}</div>}
                  <label className="form-label" htmlFor="gvp-patient-notes">Aggiungi una nota GVP</label>
                  <textarea className="form-control" id="gvp-patient-notes" rows="5" value={newGvpNote} onChange={(event) => setNewGvpNote(event.target.value)} maxLength="4000" autoFocus />
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeNotes}>Annulla</button>
                  <button className="btn btn-primary" type="button" onClick={saveGvpNotes} disabled={noteSaving || !newGvpNote.trim()}>{noteSaving ? "Salvataggio…" : "Aggiungi nota"}</button>
                </div>
              </section>
            </div>
          </>}
          {casNotePatient && <>
            <button className="entity-modal-backdrop" type="button" aria-label="Chiudi note CAS" onClick={closeCasNotes} />
            <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="cas-notes-title">
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title" id="cas-notes-title">Note CAS — {casNotePatient.lastName} {casNotePatient.firstName}</h2>
                  <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeCasNotes} />
                </div>
                <div className="card-body">
                  {casNoteError && <div className="alert alert-danger py-2" role="alert">{casNoteError}</div>}
                  <h3 className="h6">Note CAS esistenti</h3>
                  {getCasNotes(casNotePatient).length === 0 ? <p className="text-secondary">Nessuna nota CAS inserita.</p> : <div className="d-grid gap-2 mb-4">{getCasNotes(casNotePatient).map((note) => <article className="border rounded p-3" key={note.id}><div className="d-flex align-items-start justify-content-between gap-3"><p className="mb-1">{note.text}</p>{note.authorId === currentUser.id && <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteCasNote(note)}>Elimina</button>}</div><div className="d-flex align-items-center gap-2"><span className={`badge ${getNoteRoleBadgeClass(note.authorRole)}`}>{note.authorRole || "CAS"}</span><small className="text-secondary">{note.author || "CAS"}{note.createdAt ? ` · ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(note.createdAt))}` : ""}</small></div></article>)}</div>}
                  <label className="form-label" htmlFor="cas-patient-notes">Aggiungi una nota CAS</label>
                  <textarea className="form-control" id="cas-patient-notes" rows="5" value={newCasNote} onChange={(event) => setNewCasNote(event.target.value)} maxLength="4000" autoFocus />
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeCasNotes}>Annulla</button>
                  <button className="btn btn-primary" type="button" onClick={saveCasNote} disabled={casNoteSaving || !newCasNote.trim()}>{casNoteSaving ? "Salvataggio…" : "Aggiungi nota CAS"}</button>
                </div>
              </section>
            </div>
          </>}
          {modalOpen && (
            <button
              className="entity-modal-backdrop"
              type="button"
              aria-label="Chiudi finestra"
              onClick={resetForm}
            />
          )}
          <div
            className={modalOpen ? "entity-modal-shell" : "d-none"}
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-modal-title"
          >
            <section className="card entity-modal-card patient-modal-card">
              <div className="card-header">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <h2 className="card-title mb-0" id="patient-modal-title">
                    {isEditing ? "Modifica paziente" : "Inserisci paziente"}
                  </h2>
                  <div className="d-flex align-items-center gap-2 ms-auto patient-header-status">
                    <label className="form-label mb-0" htmlFor="patient-header-status">Stato</label>
                    <select
                      className="form-select form-select-sm w-auto"
                      id="patient-header-status"
                      value={patientStatus}
                      disabled={isPatientReadOnly}
                      onChange={(event) => requestFormStatusChange(event.target.value)}
                    >
                      <option value="">Nessuno stato</option>
                      {patientStatus === "Trasferito" && <option value="Trasferito">Trasferito</option>}
                      {PATIENT_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn-close"
                    type="button"
                    aria-label="Chiudi"
                    onClick={resetForm}
                  />
                </div>
                {canEditPatients && !isPatientReadOnly && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      onClick={handleOpenPdf}
                    >
                      Salva e apri HLC-7-I
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      onClick={handleOpenSimplifiedPdf}
                    >
                      Salva e apri HLC-7-I semplificato
                    </button>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmit}>
                <div className="card-body">
                  {!isGvp && (
                    <div className="nav nav-tabs patient-form-tabs mb-3" role="tablist" aria-label="Sezioni scheda paziente">
                      {PATIENT_FORM_TABS.filter(([tabId]) => !["summary", "departments", "history"].includes(tabId) || isEditing).map(([tabId, label]) => <button
                        className={`nav-link ${tabId === "departments" ? "patient-departments-tab" : ""} ${activeTab === tabId ? "active" : ""}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tabId}
                        onClick={() => setActiveTab(tabId)}
                        key={tabId}
                      >
                        {label}
                      </button>)}
                    </div>
                  )}

                  {isGvpReadOnly ? (
                    <div className="patient-form-grid">
                      <div className={`alert border mb-3 ${patientStatus === "Trasferito" ? "alert-warning border-warning" : "alert-light"}`} role="status">
                        {patientStatus === "Trasferito" ? (
                          <>
                            <div>Paziente trasferito: la scheda è bloccata e non può più essere modificata.</div>
                            <div className="mt-2 fw-semibold">{TRANSFERRED_PATIENT_PRIVACY_NOTE}</div>
                          </>
                        ) : "Riepilogo delle informazioni disponibili per il GVP."}
                      </div>
                      <div className="patient-summary-grid">
                        {gvpSummaryEntries.map((entry) => (
                          <div className="patient-summary-item" key={`${entry.label}-${entry.value}`}>
                            <div className="patient-summary-label">{entry.label}</div>
                            <div className="patient-summary-value">{formatSummaryValue(entry.value) || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {isTransferredReadOnly && (
                        <div className="alert alert-warning border-warning mb-3" role="status">
                          <div>Paziente trasferito: puoi consultare tutte le informazioni, ma la scheda non può più essere modificata.</div>
                          <div className="mt-2 fw-semibold">{TRANSFERRED_PATIENT_PRIVACY_NOTE}</div>
                          {canEditPatients && (
                            <button className="btn btn-outline-primary btn-sm mt-3" type="button" onClick={() => {
                              setTransferTarget({ type: "form" });
                              setTransferDraft(transferNotes);
                              setTransferError("");
                            }}>
                              Modifica note trasferimento
                            </button>
                          )}
                        </div>
                      )}
                      <fieldset className="border-0 p-0 m-0 w-100" disabled={isTransferredReadOnly}>
                      {activeTab === "main" ? (
                    <div className="patient-form-grid">
                      <div className="patient-form-actions">
                        <button className="btn btn-primary" type="submit">
                          {isEditing ? "Salva modifiche" : "Inserisci"}
                        </button>
                      </div>
                      {error && (
                        <div className="alert alert-danger py-2" role="alert">
                          {error}
                        </div>
                      )}
                      <div className="patient-assignment-row row g-2 w-100">
                        <div className={`col-12 ${details.sex === "Femmina" ? "col-md-3" : "col-md-4"}`}>
                          <label className="form-label" htmlFor="patient-main-row-first-name">Nome</label>
                          <input
                            className="form-control"
                            id="patient-main-row-first-name"
                            type="text"
                            value={firstName}
                            onChange={(event) => {
                              setFirstName(event.target.value);
                              setError("");
                            }}
                            required
                          />
                        </div>
                        <div className={`col-12 ${details.sex === "Femmina" ? "col-md-3" : "col-md-4"}`}>
                          <label className="form-label" htmlFor="patient-main-row-last-name">Cognome</label>
                          <input
                            className="form-control"
                            id="patient-main-row-last-name"
                            type="text"
                            value={lastName}
                            onChange={(event) => {
                              setLastName(event.target.value);
                              setError("");
                            }}
                            required
                          />
                        </div>
                        <div className={`col-12 ${details.sex === "Femmina" ? "col-md-3" : "col-md-4"}`}>
                          <label className="form-label" htmlFor="patient-main-sex">Sesso</label>
                          <select
                            className="form-select"
                            id="patient-main-sex"
                            value={details.sex || ""}
                            onChange={(event) => {
                              const sex = event.target.value;
                              setDetails((current) => ({
                                ...current,
                                sex,
                                ...(sex === "Femmina" ? {} : { maidenName: "" }),
                              }));
                              setError("");
                            }}
                          >
                            <option value="">Seleziona</option>
                            <option value="Maschio">Maschio</option>
                            <option value="Femmina">Femmina</option>
                          </select>
                        </div>
                        {details.sex === "Femmina" && <div className="col-12 col-md-3">
                          <label className="form-label" htmlFor="patient-main-maiden-name">Cognome da nubile</label>
                          <input
                            className="form-control"
                            id="patient-main-maiden-name"
                            type="text"
                            value={details.maidenName || ""}
                            onChange={(event) => {
                              setDetails((current) => ({ ...current, maidenName: event.target.value }));
                              setError("");
                            }}
                          />
                        </div>}
                      </div>
                      <div className="patient-assignment-row row g-2 w-100">
                        <div className="col-12 col-md-6">
                          <label className="form-label" htmlFor="patient-main-admission-date">
                            Data del ricovero
                          </label>
                          <input
                            className="form-control"
                            id="patient-main-admission-date"
                            type="date"
                            value={admissionDate}
                            onChange={(event) => {
                              setAdmissionDate(event.target.value);
                              setError("");
                            }}
                            required
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label" htmlFor="patient-main-discharge-date">
                            Data dimissioni
                          </label>
                          <input
                            className="form-control"
                            id="patient-main-discharge-date"
                            type="date"
                            min={admissionDate || undefined}
                            value={dischargeDate}
                            onChange={(event) => {
                              setDischargeDate(event.target.value);
                              setError("");
                            }}
                          />
                        </div>
                      </div>
                      <fieldset className="patient-anesthesiologist-box w-100">
                        <legend>Visita con l’anestesista</legend>
                        <div className="row g-2">
                          <PatientDetailField
                            field={["anesthesiologistDate", "Data", "date"]}
                            value={details.anesthesiologistDate}
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                            columnClassName="col-12 col-md-4"
                          />
                          <PatientDetailField
                            field={["anesthesiologistTime", "Orario", "time"]}
                            value={details.anesthesiologistTime}
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                            columnClassName="col-12 col-md-4"
                          />
                          <PatientDetailField
                            field={["anesthesiologistName", "Anestesista"]}
                            value={details.anesthesiologistName}
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                            columnClassName="col-12 col-md-4"
                          />
                        </div>
                      </fieldset>
                      <div className="patient-assignment-row row g-2 w-100">
                        <div className="col-12 col-md-4">
                          <label className="form-label" htmlFor="patient-main-pathology">Patologia</label>
                          <input
                            className="form-control"
                            id="patient-main-pathology"
                            type="text"
                            value={pathology}
                            onChange={(event) => {
                              setPathology(event.target.value);
                              setError("");
                            }}
                            required
                          />
                        </div>
                        {SIMPLIFIED_FIELDS.slice(6, 8).map((field) => (
                          <PatientDetailField
                            key={field[0]}
                            field={field}
                            value={details[field[0]]}
                            columnClassName="col-12 col-md-4"
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                          />
                        ))}
                      </div>
                      <div className="d-none">
                        <label className="form-label" htmlFor="patient-main-first-name">Nome</label>
                        <input
                          className="form-control"
                          id="patient-main-first-name"
                          type="text"
                          value={firstName}
                          onChange={(event) => {
                            setFirstName(event.target.value);
                            setError("");
                          }}
                          disabled
                        />
                      </div>
                      <div className="d-none">
                        <label className="form-label" htmlFor="patient-main-last-name">Cognome</label>
                        <input
                          className="form-control"
                          id="patient-main-last-name"
                          type="text"
                          value={lastName}
                          onChange={(event) => {
                            setLastName(event.target.value);
                            setError("");
                          }}
                          disabled
                        />
                      </div>
                      <fieldset className="w-100">
                        <legend className="form-label">Tipo di accesso</legend>
                        <div className="btn-group w-100" role="group">
                          <input
                            className="btn-check"
                            id="patient-main-emergency"
                            name="admission-type"
                            type="radio"
                            checked={admissionType === "emergency"}
                            onChange={() => setAdmissionType("emergency")}
                          />
                          <label className="btn btn-outline-danger" htmlFor="patient-main-emergency">
                            Emergenza
                          </label>
                          <input
                            className="btn-check"
                            id="patient-main-scheduled"
                            name="admission-type"
                            type="radio"
                            checked={admissionType === "scheduled"}
                            onChange={() => setAdmissionType("scheduled")}
                          />
                          <label className="btn btn-outline-primary" htmlFor="patient-main-scheduled">
                            Ricovero programmato
                          </label>
                          <input
                            className="btn-check"
                            id="patient-main-consultation"
                            name="admission-type"
                            type="radio"
                            checked={admissionType === "consultation"}
                            onChange={() => setAdmissionType("consultation")}
                          />
                          <label className="btn btn-outline-success" htmlFor="patient-main-consultation">
                            Consulto
                          </label>
                        </div>
                      </fieldset>
                      {patientStatus === "Trasferito" && (
                        <div className="w-100 alert alert-warning border-warning mb-0" role="status">
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge text-bg-warning border border-warning-subtle">TRASFERITO</span>
                            <strong>Paziente trasferito</strong>
                          </div>
                          <div className="fw-semibold">Destinazione del trasferimento</div>
                          <div className="fs-6">{transferNotes || "Informazione non disponibile"}</div>
                        </div>
                      )}
                      <div className="patient-assignment-row row g-3 w-100">
                        <div className="col-12 col-md-6 col-xl d-flex flex-column">
                          <div className="form-label">Ospedale e reparto</div>
                          {isEditing && selectedDepartment ? (
                            <button
                              className="btn btn-outline-primary w-100 flex-grow-1 text-start d-flex flex-column align-items-start"
                              type="button"
                              onClick={openDepartmentSelectionModal}
                              disabled={availableDepartments.length === 0}
                              aria-label={`Ospedale attuale: ${selectedDepartment.hospitalName}, reparto: ${selectedDepartment.name}. Clicca per trasferire il paziente o correggere i dati.`}
                              title="Clicca sull'ospedale per trasferire il paziente oppure per cambiare reparto"
                            >
                              <strong>{selectedDepartment.hospitalName}</strong>
                              <span>{selectedDepartment.name}</span>
                              <small className="mt-2 text-primary-emphasis">Clicca sull’ospedale per trasferire il paziente oppure per cambiare reparto</small>
                            </button>
                          ) : (
                            <button className="btn btn-outline-primary w-100 flex-grow-1" type="button" onClick={openDepartmentSelectionModal} disabled={availableDepartments.length === 0}>
                              {selectedDepartment ? `${selectedDepartment.hospitalName} / ${selectedDepartment.name}` : "Seleziona reparto"}
                            </button>
                          )}
                        </div>
                        <div className="col-12 col-md-6 col-xl d-flex flex-column">
                          <div className="form-label">Medico responsabile</div>
                          <button className="btn btn-outline-primary w-100 flex-grow-1" type="button" onClick={openDoctorSelectionModal} disabled={!selectedDepartment || visibleDoctors.length === 0}>
                            {!selectedDepartment ? "Seleziona prima il reparto" : doctor ? `${doctor.lastName} ${doctor.firstName}` : "Seleziona medico"}
                          </button>
                        </div>
                        <div className="col-12 col-md-6 col-xl d-flex flex-column">
                          <div className="form-label">Medici consigliati</div>
                          <button className={`btn btn-outline-primary w-100 flex-grow-1 ${recommendedDoctors.length > 0 ? "d-flex flex-column align-items-start gap-1 text-start" : ""}`} type="button" onClick={openRecommendedDoctorsModal} disabled={!selectedDepartment || visibleDoctors.length === 0}>
                            {!selectedDepartment ? "Seleziona prima il reparto" : recommendedDoctors.length > 0
                              ? recommendedDoctors.map((item) => <span className="d-block" key={item.id}>{item.lastName} {item.firstName}</span>)
                              : "Seleziona medici"}
                          </button>
                        </div>
                        <div className="col-12 col-md-6 col-xl d-flex flex-column">
                          <div className="form-label">CAS</div>
                          <button className="btn btn-outline-primary w-100 flex-grow-1" type="button" onClick={openCasSelectionModal} disabled={!selectedDepartment || visibleCasUsers.length === 0}>
                            {!selectedDepartment ? "Seleziona prima il reparto" : selectedCasUsers.length > 0 ? selectedCasUsers.map((user) => user.username).join(", ") : "Seleziona CAS"}
                          </button>
                        </div>
                        <div className="col-12 col-md-6 col-xl d-flex flex-column">
                          <div className="form-label">GVP assegnati</div>
                          <button className="btn btn-outline-primary w-100 flex-grow-1" type="button" onClick={openGvpSelectionModal} disabled={visibleGvpUsers.length === 0}>
                            {selectedGvpUsers.length > 0
                              ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ")
                              : "Seleziona GVP"}
                          </button>
                        </div>
                      </div>
                      <div className="row g-3 w-100">
                        <PatientDetailField
                          field={["hospitalRoom", "Numero camera"]}
                          value={details.hospitalRoom}
                          onChange={(name, value) => {
                            setDetails((current) => ({ ...current, [name]: value }));
                            setError("");
                          }}
                          columnClassName="col-12 col-sm-6"
                        />
                        <PatientDetailField
                          field={["hospitalBed", "Numero letto"]}
                          value={details.hospitalBed}
                          onChange={(name, value) => {
                            setDetails((current) => ({ ...current, [name]: value }));
                            setError("");
                          }}
                          columnClassName="col-12 col-sm-6"
                        />
                      </div>
                      <div className="d-none">
                        <div className="form-label">Medico responsabile</div>
                        <button className="btn btn-outline-primary w-100" type="button" onClick={openDoctorSelectionModal} disabled={visibleDoctors.length === 0}>
                          {doctor ? `Medico: ${doctor.lastName} ${doctor.firstName}` : "Seleziona medico"}
                        </button>
                        {visibleDoctors.length === 0 && (
                          <div className="form-text">Inserisci prima almeno un medico.</div>
                        )}
                      </div>
                      <div className="d-none">
                        <label className="form-label" htmlFor="patient-main-doctor">
                          Medico responsabile
                        </label>
                        <select
                          className="form-select"
                          id="patient-main-doctor"
                          value={doctorId}
                          onChange={(event) => {
                            setDoctorId(event.target.value);
                            setError("");
                          }}
                        >
                          <option value="">Seleziona medico</option>
                          {visibleDoctors.map((availableDoctor) => (
                            <option key={availableDoctor.id} value={availableDoctor.id}>
                              {availableDoctor.lastName} {availableDoctor.firstName}
                            </option>
                          ))}
                        </select>
                        {visibleDoctors.length === 0 && (
                          <div className="form-text">Inserisci prima almeno un medico.</div>
                        )}
                      </div>
                      <div className="d-none">
                        <div className="col-12 col-md-6">
                          <div className="form-label">CAS</div>
                          <button className="btn btn-outline-primary w-100" type="button" onClick={openCasSelectionModal} disabled={visibleCasUsers.length === 0}>
                            {selectedCasUser ? `CAS: ${selectedCasUser.username}` : "Seleziona CAS"}
                          </button>
                        </div>
                        <div className="col-12 col-md-6">
                          <div className="form-label">GVP assegnati</div>
                          <button className="btn btn-outline-primary w-100" type="button" onClick={openGvpSelectionModal} disabled={visibleGvpUsers.length === 0}>
                            {gvpIds.length > 0 ? `GVP selezionati: ${gvpIds.length}` : "Seleziona GVP"}
                          </button>
                        </div>
                      </div>
                      <div className="d-none">
                        <label className="form-label" htmlFor="patient-main-cas">CAS</label>
                        <select
                          className="form-select"
                          id="patient-main-cas"
                          value={casId}
                          onChange={(event) => {
                            setCasId(event.target.value);
                            setError("");
                          }}
                        >
                          <option value="">Seleziona CAS</option>
                          {orderedCasUsers.map((casUser) => (
                            <option key={casUser.id} value={casUser.id}>
                              {casUser.username}
                              {casUser.id === currentUser.id ? " (io)" : ""}
                              {isAbsentOnAdmissionDate(casUser.id) ? ` â€” ${getAbsenceLabel(casUser.id)}` : ""}
                            </option>
                          ))}
                        </select>
                        {casId && isAbsentOnAdmissionDate(casId) && (
                          <div className="mt-2">
                            <span className="badge text-bg-danger">
                              {selectedCasUser?.username || "CAS"} â€” {getAbsenceLabel(casId)}
                            </span>
                          </div>
                        )}
                        {visibleCasUsers.length === 0 && (
                          <div className="form-text">Inserisci prima almeno un CAS.</div>
                        )}
                      </div>
                      <fieldset className="d-none">
                        <legend className="form-label">GVP assegnati</legend>
                        {visibleGvpUsers.length > 0 ? (
                          <div className="d-grid gap-2 border rounded p-3">
                            {[...visibleGvpUsers].sort(availableFirst).map((gvpUser) => (
                              <label className="form-check" key={gvpUser.id}>
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={gvpIds.includes(gvpUser.id)}
                                  onChange={() => toggleGvpSelection(gvpUser)}
                                />
                                <span className="form-check-label">
                                  {getGvpDisplayName(gvpUser)}
                                  {isAbsentOnAdmissionDate(gvpUser.id) && (
                                    <span className="badge text-bg-warning ms-2">{getAbsenceLabel(gvpUser.id)}</span>
                                  )}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="form-text">Nessun GVP disponibile per questa presidenza.</div>
                        )}
                      </fieldset>
                      {departmentChangeReasonModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Annulla cambio ospedale" onClick={() => setDepartmentChangeReasonModalOpen(false)} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="department-change-reason-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center gap-2">
                                <h3 className="card-title mb-0" id="department-change-reason-title">Perché stai cambiando ospedale?</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={() => setDepartmentChangeReasonModalOpen(false)} />
                              </div>
                              <div className="card-body">
                                <p className="text-secondary">Indica se il paziente è stato trasferito oppure se stai correggendo un dato inserito per errore.</p>
                                <div className="d-grid gap-3">
                                  <button className="btn btn-outline-primary text-start p-3" type="button" onClick={openDepartmentTransferScope}>
                                    <strong className="d-block">È un trasferimento</strong>
                                    <small>Il nuovo ospedale e reparto verranno aggiunti ai Trasferimenti.</small>
                                  </button>
                                  <button className="btn btn-outline-secondary text-start p-3" type="button" onClick={() => continueDepartmentChange("correction")}>
                                    <strong className="d-block">È una correzione</strong>
                                    <small>Il dato verrà corretto senza registrare un trasferimento.</small>
                                  </button>
                                </div>
                              </div>
                              <div className="card-footer d-flex justify-content-end">
                                <button className="btn btn-outline-secondary" type="button" onClick={() => setDepartmentChangeReasonModalOpen(false)}>Annulla</button>
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      {departmentTransferScopeModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Annulla trasferimento" onClick={() => setDepartmentTransferScopeModalOpen(false)} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="department-transfer-scope-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center gap-2">
                                <h3 className="card-title mb-0" id="department-transfer-scope-title">Dove viene trasferito?</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={() => setDepartmentTransferScopeModalOpen(false)} />
                              </div>
                              <div className="card-body">
                                <div className="d-grid gap-3">
                                  <button className="btn btn-outline-primary text-start p-3" type="button" onClick={continueInternalDepartmentTransfer}>
                                    <strong className="d-block">In un ospedale del CAS</strong>
                                    <small>Scegli l’ospedale e il reparto dall’elenco disponibile.</small>
                                  </button>
                                  <button className="btn btn-outline-secondary text-start p-3" type="button" onClick={openExternalDepartmentTransfer}>
                                    <strong className="d-block">Al di fuori degli ospedali del CAS</strong>
                                    <small>Inserisci manualmente la destinazione del trasferimento.</small>
                                  </button>
                                </div>
                              </div>
                              <div className="card-footer d-flex justify-content-end">
                                <button className="btn btn-outline-secondary" type="button" onClick={() => setDepartmentTransferScopeModalOpen(false)}>Annulla</button>
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      {externalDepartmentTransferModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Annulla trasferimento esterno" onClick={() => setExternalDepartmentTransferModalOpen(false)} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="external-department-transfer-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center gap-2">
                                <h3 className="card-title mb-0" id="external-department-transfer-title">Trasferimento esterno</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={() => setExternalDepartmentTransferModalOpen(false)} />
                              </div>
                              <div className="card-body">
                                {externalDepartmentTransferError && <div className="alert alert-danger py-2" role="alert">{externalDepartmentTransferError}</div>}
                                <label className="form-label" htmlFor="external-department-transfer-date">Data del trasferimento</label>
                                <input className="form-control mb-3" id="external-department-transfer-date" type="date" value={departmentChangeDate} onChange={(event) => setDepartmentChangeDate(event.target.value)} />
                                <label className="form-label" htmlFor="external-department-transfer-destination">Dove viene trasferito?</label>
                                <textarea className="form-control" id="external-department-transfer-destination" rows="4" value={externalDepartmentTransferDestination} onChange={(event) => { setExternalDepartmentTransferDestination(event.target.value); setExternalDepartmentTransferError(""); }} placeholder="Indica ospedale, struttura, reparto ed eventuali informazioni utili" maxLength="4000" autoFocus />
                              </div>
                              <div className="card-footer d-flex justify-content-end gap-2">
                                <button className="btn btn-outline-secondary" type="button" onClick={() => setExternalDepartmentTransferModalOpen(false)}>Annulla</button>
                                <button className="btn btn-primary" type="button" onClick={saveExternalDepartmentTransfer}>Registra trasferimento</button>
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      {departmentSelectionModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Chiudi selezione reparto" onClick={closeDepartmentSelectionModal} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="department-selection-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                <h3 className="card-title mb-0" id="department-selection-title">{departmentChangeMode === "transfer" ? "Registra trasferimento" : departmentChangeMode === "correction" ? "Correggi ospedale o reparto" : "Seleziona reparto"}</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeDepartmentSelectionModal} />
                              </div>
                              <div className="card-body">
                                {isEditing && selectedDepartment && departmentChangeMode === "transfer" && (
                                  <div className="mb-3">
                                    <label className="form-label" htmlFor="department-change-date">Data del cambio reparto</label>
                                    <input className="form-control" id="department-change-date" type="date" value={departmentChangeDate} onChange={(event) => setDepartmentChangeDate(event.target.value)} required />
                                  </div>
                                )}
                                <label className="form-label" htmlFor="department-search">Cerca ospedale o reparto</label>
                                <input className="form-control mb-3" id="department-search" type="search" value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder="Inserisci ospedale o reparto" autoFocus />
                                <div className="d-grid gap-2">
                                  {filteredDepartments.map((department) => (
                                    <button
                                      className={`btn text-start ${details.departmentId === department.id ? "btn-primary" : "btn-outline-secondary"}`}
                                      type="button"
                                      key={`${department.hospitalId}-${department.id}`}
                                      onClick={() => selectPatientDepartment(department)}
                                    >
                                      <strong>{department.name}</strong>
                                      <span className="d-block small">{department.hospitalName}</span>
                                    </button>
                                  ))}
                                  {filteredDepartments.length === 0 && <div className="text-secondary">Nessun reparto trovato.</div>}
                                </div>
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      {doctorSelectionModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Chiudi selezione medico" onClick={closeDoctorSelectionModal} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="doctor-selection-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                <h3 className="card-title mb-0" id="doctor-selection-title">Seleziona medico</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeDoctorSelectionModal} />
                              </div>
                              <div className="card-body">
                                <div className="nav nav-tabs mb-3" role="tablist" aria-label="Tipologia elenco medici">
                                  <button className={`nav-link ${doctorModalTab === "department" ? "active" : ""}`} type="button" role="tab" aria-selected={doctorModalTab === "department"} onClick={() => setDoctorModalTab("department")}>Medici del reparto</button>
                                  <button className={`nav-link ${doctorModalTab === "all" ? "active" : ""}`} type="button" role="tab" aria-selected={doctorModalTab === "all"} onClick={() => setDoctorModalTab("all")}>Tutti i medici</button>
                                </div>
                                <label className="form-label" htmlFor="doctor-search">Cerca per nome</label>
                                <input className="form-control mb-3" id="doctor-search" type="search" value={doctorSearch} onChange={(event) => setDoctorSearch(event.target.value)} placeholder="Inserisci nome o cognome" autoFocus />
                                {doctorModalTab === "department" ? (
                                  <div className="d-grid gap-2">
                                    {filteredDoctors.map((availableDoctor) => (
                                      <button className={`btn text-start ${doctorId === availableDoctor.id ? "btn-primary" : "btn-outline-secondary"}`} type="button" key={availableDoctor.id} onClick={() => { setDoctorId(availableDoctor.id); closeDoctorSelectionModal(); }}>
                                        {availableDoctor.lastName} {availableDoctor.firstName}
                                      </button>
                                    ))}
                                    {filteredDoctors.length === 0 && <div className="text-secondary border rounded p-3">Nessun medico associato a questo reparto. Puoi sceglierne uno dalla tab “Tutti i medici”.</div>}
                                  </div>
                                ) : (
                                  <div className="d-grid gap-3">
                                    {doctorsByHospital.map(({ hospital, doctors: hospitalDoctors }) => (
                                      <section className="border rounded p-3" key={hospital.id}>
                                        <h4 className="h6 mb-2">{hospital.name}</h4>
                                        <div className="d-grid gap-2">
                                          {hospitalDoctors.map((availableDoctor) => (
                                            <button className={`btn text-start ${doctorId === availableDoctor.id ? "btn-primary" : "btn-outline-secondary"}`} type="button" key={availableDoctor.id} onClick={() => { setDoctorId(availableDoctor.id); closeDoctorSelectionModal(); }}>
                                              {availableDoctor.lastName} {availableDoctor.firstName}
                                            </button>
                                          ))}
                                        </div>
                                      </section>
                                    ))}
                                    {doctorsWithoutHospital.length > 0 && <section className="border rounded p-3"><h4 className="h6 mb-2">Senza ospedale associato</h4><div className="d-grid gap-2">{doctorsWithoutHospital.map((availableDoctor) => <button className={`btn text-start ${doctorId === availableDoctor.id ? "btn-primary" : "btn-outline-secondary"}`} type="button" key={availableDoctor.id} onClick={() => { setDoctorId(availableDoctor.id); closeDoctorSelectionModal(); }}>{availableDoctor.lastName} {availableDoctor.firstName}</button>)}</div></section>}
                                    {doctorsByHospital.length === 0 && doctorsWithoutHospital.length === 0 && <div className="text-secondary">Nessun medico trovato.</div>}
                                  </div>
                                )}
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      {recommendedDoctorsModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Chiudi selezione medici consigliati" onClick={closeRecommendedDoctorsModal} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="recommended-doctors-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                <h3 className="card-title mb-0" id="recommended-doctors-title">Medici consigliati</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeRecommendedDoctorsModal} />
                              </div>
                              <div className="card-body">
                                <div className="nav nav-tabs mb-3" role="tablist" aria-label="Tipologia elenco medici consigliati">
                                  <button className={`nav-link ${recommendedDoctorModalTab === "department" ? "active" : ""}`} type="button" role="tab" aria-selected={recommendedDoctorModalTab === "department"} onClick={() => setRecommendedDoctorModalTab("department")}>Medici del reparto</button>
                                  <button className={`nav-link ${recommendedDoctorModalTab === "all" ? "active" : ""}`} type="button" role="tab" aria-selected={recommendedDoctorModalTab === "all"} onClick={() => setRecommendedDoctorModalTab("all")}>Tutti i medici</button>
                                </div>
                                <label className="form-label" htmlFor="recommended-doctor-search">Cerca per nome</label>
                                <input className="form-control mb-3" id="recommended-doctor-search" type="search" value={doctorSearch} onChange={(event) => setDoctorSearch(event.target.value)} placeholder="Inserisci nome o cognome" autoFocus />
                                {recommendedDoctorModalTab === "department" ? (
                                  <div className="d-grid gap-2 border rounded p-3">
                                    {filteredDoctors.map((availableDoctor) => <label className="form-check" key={availableDoctor.id}><input className="form-check-input" type="checkbox" checked={recommendedDoctorIds.includes(availableDoctor.id)} onChange={() => toggleRecommendedDoctor(availableDoctor.id)} /><span className="form-check-label">{availableDoctor.lastName} {availableDoctor.firstName}</span></label>)}
                                    {filteredDoctors.length === 0 && <div className="text-secondary">Nessun medico associato a questo reparto. Puoi usare la tab “Tutti i medici”.</div>}
                                  </div>
                                ) : (
                                  <div className="d-grid gap-3">
                                    {doctorsByHospital.map(({ hospital, doctors: hospitalDoctors }) => {
                                      const selectableDoctors = hospitalDoctors;
                                      return selectableDoctors.length > 0 && <section className="border rounded p-3" key={hospital.id}><h4 className="h6 mb-2">{hospital.name}</h4><div className="d-grid gap-2">{selectableDoctors.map((availableDoctor) => <label className="form-check" key={availableDoctor.id}><input className="form-check-input" type="checkbox" checked={recommendedDoctorIds.includes(availableDoctor.id)} onChange={() => toggleRecommendedDoctor(availableDoctor.id)} /><span className="form-check-label">{availableDoctor.lastName} {availableDoctor.firstName}</span></label>)}</div></section>;
                                    })}
                                    {doctorsWithoutHospital.length > 0 && <section className="border rounded p-3"><h4 className="h6 mb-2">Senza ospedale associato</h4><div className="d-grid gap-2">{doctorsWithoutHospital.map((availableDoctor) => <label className="form-check" key={availableDoctor.id}><input className="form-check-input" type="checkbox" checked={recommendedDoctorIds.includes(availableDoctor.id)} onChange={() => toggleRecommendedDoctor(availableDoctor.id)} /><span className="form-check-label">{availableDoctor.lastName} {availableDoctor.firstName}</span></label>)}</div></section>}
                                    {searchedVisibleDoctors.length === 0 && <div className="text-secondary">Nessun medico trovato.</div>}
                                  </div>
                                )}
                              </div>
                              <div className="card-footer d-flex justify-content-end">
                                <button className="btn btn-primary" type="button" onClick={closeRecommendedDoctorsModal}>Conferma</button>
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      {casSelectionModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Chiudi selezione CAS" onClick={closeCasSelectionModal} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="cas-selection-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                <h3 className="card-title mb-0" id="cas-selection-title">Seleziona CAS</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeCasSelectionModal} />
                              </div>
                              <div className="card-body">
                                <div className="nav nav-tabs mb-3" role="tablist" aria-label="Tipologia elenco CAS">
                                  <button className={`nav-link ${casModalTab === "recommended" ? "active" : ""}`} type="button" role="tab" aria-selected={casModalTab === "recommended"} onClick={() => setCasModalTab("recommended")}>CAS consigliati</button>
                                  <button className={`nav-link ${casModalTab === "all" ? "active" : ""}`} type="button" role="tab" aria-selected={casModalTab === "all"} onClick={() => setCasModalTab("all")}>Tutti i CAS</button>
                                </div>
                                <label className="form-label" htmlFor="cas-search">Cerca per nome</label>
                                <input className="form-control mb-3" id="cas-search" type="search" value={casSearch} onChange={(event) => setCasSearch(event.target.value)} placeholder="Inserisci il nome" autoFocus />
                                <div className="d-grid gap-2">
                                  {filteredCasUsers.map((casUser) => (
                                    <label className="form-check border rounded p-2 ps-5" key={casUser.id}>
                                      <input className="form-check-input" type="checkbox" checked={casIds.includes(casUser.id)} onChange={() => {
                                        const nextCasIds = casIds.includes(casUser.id) ? casIds.filter((id) => id !== casUser.id) : [...casIds, casUser.id];
                                        setCasIds(nextCasIds);
                                        setCasId(nextCasIds[0] || "");
                                      }} />
                                      <span className="form-check-label">{casUser.username}{casUser.id === currentUser.id ? " (io)" : ""}{isAbsentOnAdmissionDate(casUser.id) ? ` — ${getAbsenceLabel(casUser.id)}` : ""}</span>
                                    </label>
                                  ))}
                                  {filteredCasUsers.length === 0 && <div className="text-secondary">{casModalTab === "recommended" ? "Nessun CAS associato a questo reparto. Puoi usare la tab “Tutti i CAS”." : "Nessun CAS trovato."}</div>}
                                </div>
                              </div>
                              <div className="card-footer d-flex justify-content-end">
                                <button className="btn btn-primary" type="button" onClick={closeCasSelectionModal}>Conferma</button>
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      {gvpSelectionModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Chiudi selezione GVP" onClick={closeGvpSelectionModal} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="main-gvp-selection-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                <h3 className="card-title mb-0" id="main-gvp-selection-title">Seleziona GVP</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeGvpSelectionModal} />
                              </div>
                              <div className="card-body">
                                <div className="nav nav-tabs mb-3" role="tablist" aria-label="Tipologia elenco GVP">
                                  <button className={`nav-link ${gvpModalTab === "recommended" ? "active" : ""}`} type="button" role="tab" aria-selected={gvpModalTab === "recommended"} onClick={() => setGvpModalTab("recommended")}>GVP consigliati</button>
                                  <button className={`nav-link ${gvpModalTab === "all" ? "active" : ""}`} type="button" role="tab" aria-selected={gvpModalTab === "all"} onClick={() => setGvpModalTab("all")}>Tutti i GVP</button>
                                </div>
                                <label className="form-label" htmlFor="main-gvp-search">Cerca per nome</label>
                                <input className="form-control mb-3" id="main-gvp-search" type="search" value={gvpSearch} onChange={(event) => setGvpSearch(event.target.value)} placeholder="Inserisci il nome" autoFocus />
                                <div className="d-grid gap-2 border rounded p-3">
                                  {[...associatedGvpUsers, ...unassociatedGvpUsers].map((gvpUser) => (
                                    <label className="form-check" key={gvpUser.id}>
                                      <input className="form-check-input" type="checkbox" checked={gvpIds.includes(gvpUser.id)} onChange={() => toggleGvpSelection(gvpUser)} />
                                      <span className="form-check-label">
                                        {getGvpDisplayName(gvpUser)}
                                        {gvpModalTab === "recommended" && casIds.some((selectedCasId) => isGvpAssignedToCas(gvpUser, selectedCasId)) && <span className="badge text-bg-info ms-2">CAS</span>}
                                        {gvpModalTab === "recommended" && isGvpAssignedToDepartment(gvpUser, selectedDepartment) && <span className="badge text-bg-secondary ms-2">Reparto</span>}
                                        {isAbsentOnAdmissionDate(gvpUser.id) && <span className="badge text-bg-warning ms-2">{getAbsenceLabel(gvpUser.id)}</span>}
                                      </span>
                                    </label>
                                  ))}
                                  {associatedGvpUsers.length + unassociatedGvpUsers.length === 0 && <div className="text-secondary">{gvpModalTab === "recommended" ? "Nessun GVP associato al CAS o al reparto selezionato. Puoi usare la tab “Tutti i GVP”." : "Nessun GVP trovato."}</div>}
                                </div>
                              </div>
                              <div className="card-footer d-flex justify-content-end">
                                <button className="btn btn-primary" type="button" onClick={closeGvpSelectionModal}>Conferma</button>
                              </div>
                            </section>
                          </div>
                        </>
                      )}
                      <div className="patient-assignment-row row g-2 w-100">
                        {SIMPLIFIED_FIELDS.slice(0, 3).map((field) => (
                          <PatientDetailField
                            key={field[0]}
                            field={field}
                            value={details[field[0]]}
                            columnClassName="col-12 col-md-4"
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                          />
                        ))}
                      </div>
                      <div className="patient-assignment-row row g-2 w-100">
                        {SIMPLIFIED_FIELDS.slice(3, 6).map((field) => (
                          <PatientDetailField
                            key={field[0]}
                            field={field}
                            value={details[field[0]]}
                            columnClassName="col-12 col-md-4"
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                          />
                        ))}
                      </div>
                      <div className="d-none">
                        {SIMPLIFIED_FIELDS.slice(6, 8).map((field) => (
                          <PatientDetailField
                            key={field[0]}
                            field={field}
                            value={details[field[0]]}
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                          />
                        ))}
                      </div>
                      <div className="patient-assignment-row row g-2 w-100">
                        {SIMPLIFIED_FIELDS.slice(8, 11).map((field) => (
                          <PatientDetailField
                            key={field[0]}
                            field={field}
                            value={details[field[0]]}
                            columnClassName="col-12 col-md-4"
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                          />
                        ))}
                      </div>
                      <div className="row g-2 w-100">
                        {SIMPLIFIED_FIELDS.slice(11).map((field) => (
                          <PatientDetailField
                            key={field[0]}
                            field={field}
                            value={details[field[0]]}
                            onChange={(name, value) => {
                              setDetails((current) => ({ ...current, [name]: value }));
                              setError("");
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : activeTab === "history" ? (
                    <div className="patient-form-grid patient-history-content">
                      {changeHistory.length === 0 ? (
                        <div className="alert alert-light border mb-0">Nessuna modifica registrata.</div>
                      ) : (
                        <div className="d-grid gap-3 w-100">
                          {[...changeHistory].reverse().map((entry) => (
                            <article className="border rounded p-3" key={entry.id}>
                              <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
                                <strong>{getPatientHistoryFieldLabel(entry.field)}</strong>
                                <small className="text-secondary">
                                  {entry.changedAt ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.changedAt)) : "Data non disponibile"}
                                </small>
                              </div>
                              {entry.field !== "__created" && (
                                <div className="row g-2">
                                  <div className="col-12 col-md-6"><span className="d-block small text-secondary">Valore precedente</span><span className="text-break">{formatResolvedHistoryValue(entry.field, entry.oldValue)}</span></div>
                                  <div className="col-12 col-md-6"><span className="d-block small text-secondary">Nuovo valore</span><span className="text-break">{formatResolvedHistoryValue(entry.field, entry.newValue)}</span></div>
                                </div>
                              )}
                              <div className="mt-2 small text-secondary">
                                Modificato da <strong>{entry.changedByName || "Utente non disponibile"}</strong>{entry.changedByRole ? ` (${entry.changedByRole})` : ""}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : activeTab === "departments" ? (
                    <div className="patient-form-grid patient-departments-content">
                      <div className="patient-assignment-row w-100">
                        {departmentHistory.length === 0 ? (
                          <div className="alert alert-light border mb-0">Nessun cambio di reparto registrato.</div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0 mobile-card-table department-history-table">
                              <thead>
                                <tr>
                                  <th>Reparto</th>
                                  <th>Data</th>
                                  <th>Spostato da</th>
                                </tr>
                              </thead>
                              <tbody>
                                {departmentHistory.map((movement) => (
                                  <tr key={movement.id}>
                                    <td data-label="Reparto">
                                      <strong>{movement.toDepartmentName || "-"}</strong>
                                      {movement.toHospitalName && <span className="d-block small text-secondary">{movement.toHospitalName}</span>}
                                    </td>
                                    <td data-label="Data">{movement.date ? new Intl.DateTimeFormat("it-IT").format(new Date(`${movement.date}T00:00:00`)) : "-"}</td>
                                    <td data-label="Spostato da">
                                      <strong>{movement.changedByName || "Utente non disponibile"}</strong>
                                      {movement.changedByRole && <span className="d-block small text-secondary">{movement.changedByRole}</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeTab === "summary" ? (
                    <div className="patient-form-grid">
                      <div className="alert alert-light border mb-3" role="status">
                        Riepilogo dei dati inseriti per il paziente.
                      </div>
                      <div className="patient-summary-grid">
                        {mainSummaryEntries.map((entry) => (
                          <div className="patient-summary-item" key={`${entry.label}-${entry.value}`}>
                            <div className="patient-summary-label">{entry.label}</div>
                            <div className="patient-summary-value">{formatSummaryValue(entry.value) || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="patient-form-grid">
                      <div className="patient-form-actions">
                        <button className="btn btn-primary" type="submit">
                          {isEditing ? "Salva modifiche" : "Inserisci"}
                        </button>
                      </div>
                      {error && (
                        <div className="alert alert-danger py-2" role="alert">
                          {error}
                        </div>
                      )}

                      <details className="patient-detail-section w-100" open>
                        <summary>NOTIFICA</summary>
                        <div className="patient-notification-grid pt-3">
                          {DETAIL_SECTIONS.find((section) => section.title === "NOTIFICA")?.fields.map((field) => (
                            <PatientDetailField
                              key={field[0]}
                              field={field}
                              value={details[field[0]]}
                              onChange={(name, value) => {
                                setDetails((current) => ({ ...current, [name]: value }));
                                setError("");
                              }}
                            />
                          ))}
                        </div>
                      </details>

                      <details className="patient-detail-section patient-core-section w-100" open>
                        <summary>INFORMAZIONI SUL PAZIENTE/OSPEDALE</summary>
                        <div className="patient-hospital-grid pt-3">

                      <div className="mb-3">
                        <label className="form-label" htmlFor="patient-first-name">
                          Nome
                        </label>
                        <input
                          className="form-control"
                          id="patient-first-name"
                          type="text"
                          value={firstName}
                          onChange={(event) => {
                            setFirstName(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <div>
                        <label className="form-label" htmlFor="patient-last-name">
                          Cognome
                        </label>
                        <input
                          className="form-control"
                          id="patient-last-name"
                          type="text"
                          value={lastName}
                          onChange={(event) => {
                            setLastName(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <div className="mt-3">
                        <label
                          className="form-label"
                          htmlFor="patient-admission-date"
                        >
                          Data di accesso
                        </label>
                        <input
                          className="form-control"
                          id="patient-admission-date"
                          type="date"
                          value={admissionDate}
                          onChange={(event) => {
                            setAdmissionDate(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <div className="mt-3">
                        <label className="form-label" htmlFor="patient-pathology">
                          Patologia
                        </label>
                        <input
                          className="form-control"
                          id="patient-pathology"
                          type="text"
                          value={pathology}
                          onChange={(event) => {
                            setPathology(event.target.value);
                            setError("");
                          }}
                          required
                        />
                      </div>

                      <div className="mt-3">
                        <label className="form-label" htmlFor="patient-notes">
                          Note
                        </label>
                        <textarea
                          className="form-control"
                          id="patient-notes"
                          rows="3"
                          value={notes}
                          onChange={(event) => {
                            setNotes(event.target.value);
                            setError("");
                          }}
                        />
                      </div>

                      <div className="d-none">
                        <div className="col-6">
                          <label className="form-label" htmlFor="patient-cas">
                            CAS
                          </label>
                          <select
                            className="form-select"
                            id="patient-cas"
                            value={casId}
                            onChange={(event) => {
                              setCasId(event.target.value);
                              setError("");
                            }}
                          >
                            <option value="">Seleziona CAS</option>
                            {orderedCasUsers.map((casUser) => (
                              <option key={casUser.id} value={casUser.id}>
                                {casUser.username}
                                {casUser.id === currentUser.id ? " (io)" : ""}
                                {isAbsentOnAdmissionDate(casUser.id) ? ` — ${getAbsenceLabel(casUser.id)}` : ""}
                              </option>
                            ))}
                          </select>
                          {casId && isAbsentOnAdmissionDate(casId) && (
                            <div className="mt-2">
                              <span className="badge text-bg-danger">
                                {selectedCasUser?.username || "CAS"} — {getAbsenceLabel(casId)}
                              </span>
                            </div>
                          )}
                          {visibleCasUsers.length === 0 && (
                            <div className="form-text">
                              Inserisci prima almeno un CAS.
                            </div>
                          )}
                        </div>

                        <div className="col-6">
                          <div className="d-flex align-items-center justify-content-between gap-2">
                            <div className="form-label mb-0">GVP assegnati</div>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              type="button"
                              onClick={openGvpSelectionModal}
                              disabled={visibleGvpUsers.length === 0}
                            >
                              {gvpIds.length > 0 ? "Modifica" : "Seleziona GVP"}
                            </button>
                          </div>
                          <div className="form-text mt-1">
                            {selectedGvpUsers.length > 0 ? (
                              <span className="d-flex flex-wrap gap-1">
                                {selectedGvpUsers.map((user) => (
                                  <span className={`badge ${isAbsentOnAdmissionDate(user.id) ? "text-bg-danger" : "text-bg-secondary"}`} key={user.id}>
                                    {getGvpDisplayName(user)}
                                    {isAbsentOnAdmissionDate(user.id) ? ` — ${getAbsenceLabel(user.id)}` : ""}
                                  </span>
                                ))}
                              </span>
                            ) : "Nessun GVP associato."}
                          </div>
                          {gvpSelectionModalOpen && (
                            <>
                              <button
                                className="entity-modal-backdrop"
                                type="button"
                                aria-label="Chiudi selezione GVP"
                                onClick={closeGvpSelectionModal}
                              />
                              <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="gvp-selection-title">
                                <section className="card entity-modal-card">
                                  <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                    <h3 className="card-title mb-0" id="gvp-selection-title">Seleziona GVP</h3>
                                    <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeGvpSelectionModal} />
                                  </div>
                                  <div className="card-body">
                                    {visibleGvpUsers.length > 0 ? (
                                      <>
                                        <div className="mb-3">
                                          <label className="form-label" htmlFor="gvp-search">Cerca per nome</label>
                                          <input
                                            className="form-control"
                                            id="gvp-search"
                                            type="text"
                                            value={gvpSearch}
                                            onChange={(event) => setGvpSearch(event.target.value)}
                                            placeholder="Inserisci il nome"
                                          />
                                        </div>
                                        <div className="mb-3">
                                          <div className="small fw-semibold mb-2">Associati</div>
                                          {associatedGvpUsers.length > 0 ? (
                                            <div className="d-grid gap-2 border rounded p-3">
                                              {associatedGvpUsers.map((gvpUser) => (
                                                <label className="form-check" key={gvpUser.id}>
                                                  <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={gvpIds.includes(gvpUser.id)}
                                                    onChange={() => toggleGvpSelection(gvpUser)}
                                                  />
                                                  <span className="form-check-label">{getGvpDisplayName(gvpUser)} {isAbsentOnAdmissionDate(gvpUser.id) && <span className="badge text-bg-warning ms-2">{getAbsenceLabel(gvpUser.id)}</span>}</span>
                                                </label>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="form-text">Nessun GVP associato.</div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="small fw-semibold mb-2">Non associati</div>
                                          {unassociatedGvpUsers.length > 0 ? (
                                            <div className="d-grid gap-2 border rounded p-3">
                                              {unassociatedGvpUsers.map((gvpUser) => (
                                                <label className="form-check" key={gvpUser.id}>
                                                  <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={gvpIds.includes(gvpUser.id)}
                                                    onChange={() => toggleGvpSelection(gvpUser)}
                                                  />
                                                  <span className="form-check-label">{getGvpDisplayName(gvpUser)} {isAbsentOnAdmissionDate(gvpUser.id) && <span className="badge text-bg-warning ms-2">{getAbsenceLabel(gvpUser.id)}</span>}</span>
                                                </label>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="form-text">Tutti i GVP disponibili sono già associati.</div>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="form-text">Nessun GVP disponibile per questa presidenza.</div>
                                    )}
                                  </div>
                                  <div className="card-footer d-flex justify-content-end">
                                    <button className="btn btn-primary" type="button" onClick={closeGvpSelectionModal}>Chiudi</button>
                                  </div>
                                </section>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                          <div className="patient-hospital-fields-grid mt-1">
                            {DETAIL_SECTIONS.find((section) => section.title === "INFORMAZIONI SUL PAZIENTE/OSPEDALE")?.fields
                              .filter((field) => !SIMPLIFIED_FIELD_NAMES.has(field[0]))
                              .filter((field) => field[0] !== "sex")
                              .filter((field) => details.isMinorOrNewborn === "Sì" || !PARENT_FIELD_NAMES.has(field[0]))
                              .map((field) => (
                              <PatientDetailField
                                key={field[0]}
                                field={field}
                                value={details[field[0]]}
                                onChange={(name, value) => {
                                  setDetails((current) => ({ ...current, [name]: value }));
                                  setError("");
                                }}
                              />
                              ))}
                          </div>

                        </div>
                      </details>

                      {DETAIL_SECTIONS.filter((section) => !["NOTIFICA", "INFORMAZIONI SUL PAZIENTE/OSPEDALE", "COMPILAZIONE DEL PDF SEMPLIFICATO"].includes(section.title)).map((section) => (
                        <details className="patient-detail-section w-100" key={section.title}>
                          <summary>{section.title}</summary>
                          {section.description && <p className="text-secondary small mb-0 pt-2">{section.description}</p>}
                          <div className="row g-2 pt-3">
                            {section.fields.map((field) => (
                              <PatientDetailField
                                key={field[0]}
                                field={field}
                                value={details[field[0]]}
                                onChange={(name, value) => {
                                  setDetails((current) => ({ ...current, [name]: value }));
                                  setError("");
                                }}
                              />
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                      </fieldset>
                    </>
                  )}
                </div>

                <div className="card-footer d-flex align-items-center gap-2">
                  {canEditPatients && isEditing && !isPatientReadOnly && (
                    <button
                      className="btn btn-outline-danger me-auto"
                      type="button"
                      onClick={handleDelete}
                    >
                      Elimina
                    </button>
                  )}
                  {canEditPatients && isEditing && !isPatientReadOnly && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={resetForm}
                    >
                      Annulla
                    </button>
                  )}
                  {isPatientReadOnly ? (
                    <button className="btn btn-secondary ms-auto" type="button" onClick={resetForm}>Chiudi</button>
                  ) : null}
                </div>
              </form>
            </section>
          </div>

          {transferTarget && <>
            <button className="entity-modal-backdrop" type="button" aria-label="Annulla trasferimento" onClick={closeTransferModal} />
            <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="patient-transfer-title">
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title mb-0" id="patient-transfer-title">Trasferimento paziente</h2>
                  <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeTransferModal} />
                </div>
                <div className="card-body">
                  {transferError && <div className="alert alert-danger py-2" role="alert">{transferError}</div>}
                  <label className="form-label" htmlFor="patient-transfer-notes">Dove è stato trasferito?</label>
                  <textarea
                    className="form-control"
                    id="patient-transfer-notes"
                    rows="5"
                    value={transferDraft}
                    onChange={(event) => {
                      setTransferDraft(event.target.value);
                      setTransferError("");
                    }}
                    placeholder="Indica struttura, ospedale, reparto ed eventuali informazioni utili"
                    maxLength="4000"
                    autoFocus
                  />
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                  {canDeleteTransfer && (
                    <button className="btn btn-outline-danger me-auto" type="button" onClick={deleteTransfer}>
                      Elimina trasferimento
                    </button>
                  )}
                  <button className="btn btn-outline-secondary" type="button" onClick={closeTransferModal}>Annulla</button>
                  <button className="btn btn-primary" type="button" onClick={saveTransfer}>Conferma trasferimento</button>
                </div>
              </section>
            </div>
          </>}

          <section className="card">
            <div className="card-header patient-list-header">
              <h2 className="card-title">Elenco pazienti</h2>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 patient-list-table">
                  <thead>
                    {isGvp ? <tr><th>Paziente</th><th className="text-center patient-actions-column">Azioni</th></tr> : <tr>
                      <th>Paziente</th>
                      <th>Accesso</th>
                      <th>Stato</th>
                      <th>Data</th>
                      <th>CAS</th>
                      <th>GVP</th>
                      <th className="text-center patient-actions-column">Azioni</th>
                    </tr>}
                  </thead>
                  <tbody>
                    {visiblePatients.length === 0 ? (
                      <tr>
                        <td className="text-center text-secondary py-4" colSpan={isGvp ? 2 : 7}>
                          Nessun paziente inserito.
                        </td>
                      </tr>
                    ) : (
                      patientPagination.pageItems.map((patient) => {
                          const patientDepartment = availableDepartments.find((department) => department.id === patient.details?.departmentId);
                          if (isGvp) {
                            return (
                              <tr
                                className="patient-clickable-row"
                                key={patient.id}
                                role="button"
                                tabIndex="0"
                                onClick={() => handleEdit(patient)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleEdit(patient);
                                  }
                                }}
                              >
                                <td className="fw-medium" data-label="Paziente">{formatPatientListName(patient)}<PatientMobileLocation patient={patient} departmentName={patientDepartment?.name} hospitalName={patientDepartment?.hospitalName} /></td>
                                <td className="text-center patient-actions-column" data-label="Azioni"><div className="patient-row-actions"><button className="btn btn-primary btn-sm patient-note-button" type="button" aria-label={getUnreadNoteCount(patient) > 0 ? `Note, ${getUnreadNoteCount(patient)} nuove` : "Note"} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openNotes(patient); }}><NoteButtonContent unreadCount={getUnreadNoteCount(patient)} /></button></div></td>
                              </tr>
                            );
                          }
                          const casUsers = users.filter((item) => getPatientCasIds(patient).includes(item.id));
                          const gvpUsers = users.filter((item) =>
                            getPatientGvpIds(patient).includes(item.id),
                          );

                          return (
                          <tr
                            className="patient-clickable-row"
                            key={patient.id}
                            role="button"
                            tabIndex="0"
                            onClick={() => handleEdit(patient)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleEdit(patient);
                              }
                            }}
                          >
                            <td className="fw-medium" data-label="Paziente">
                              {formatPatientListName(patient)}
                              <PatientMobileLocation patient={patient} departmentName={patientDepartment?.name} hospitalName={patientDepartment?.hospitalName} />
                            </td>
                            <td data-label="Accesso">
                              <span
                                className={`badge ${
                                  patient.admissionType === "scheduled"
                                    ? "text-bg-primary"
                                    : patient.admissionType === "consultation"
                                      ? "text-bg-success"
                                      : "text-bg-danger"
                                }`}
                              >
                                {patient.admissionType === MASKED_VALUE ? MASKED_VALUE : admissionTypeLabel(patient.admissionType, true)}
                              </span>
                            </td>
                            <td data-label="Stato">
                              <select
                                className="form-select form-select-sm patient-list-status"
                                aria-label={`Stato di ${patient.firstName} ${patient.lastName}`}
                                value={patient.status || ""}
                                disabled={patient.status === "Trasferito"}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                onChange={(event) => updatePatientStatus(patient.id, event.target.value)}
                              >
                                <option value="">Nessuno stato</option>
                                {patient.status === "Trasferito" && <option value="Trasferito">Trasferito</option>}
                                {PATIENT_STATUSES.map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </td>
                            <td data-label="Data">
                              {patient.admissionDate === MASKED_VALUE
                                ? MASKED_VALUE
                                : patient.admissionDate
                                ? new Intl.DateTimeFormat("it-IT").format(
                                    new Date(
                                      `${patient.admissionDate}T00:00:00`,
                                    ),
                                  )
                                : "-"}
                            </td>
                            <td data-label="CAS">
                              {casUsers.length > 0 ? <div className="d-flex flex-wrap gap-1">{casUsers.map((casUser) => <span className="badge text-bg-success" key={casUser.id}>{casUser.username}</span>)}</div> : (
                                <span className="badge text-bg-warning">
                                  Non assegnato
                                </span>
                              )}
                            </td>
                            <td data-label="GVP">{gvpUsers.length > 0 ? <div className="d-flex flex-wrap gap-1">{gvpUsers.map((gvpUser) => <span className="badge text-bg-info" key={gvpUser.id}>{getGvpDisplayName(gvpUser)}</span>)}</div> : <span className="text-secondary">-</span>}</td>
                            <td className="text-center patient-actions-column" data-label="Azioni">
                              <div className="patient-row-actions">
                                {(currentUser.role === "CAS" || currentUser.role === "Presidente") && <><button className="btn btn-primary btn-sm patient-note-button" type="button" aria-label={getUnreadNoteCount(patient) > 0 ? `Note GVP, ${getUnreadNoteCount(patient)} nuove` : "Note GVP"} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openNotes(patient); }}><NoteButtonContent unreadCount={getUnreadNoteCount(patient)} /></button><button className="btn btn-warning btn-sm patient-note-button" type="button" aria-label={getUnreadCasNoteCount(patient) > 0 ? `Note CAS, ${getUnreadCasNoteCount(patient)} nuove` : "Note CAS"} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openCasNotes(patient); }}><NoteButtonContent label="Note CAS" unreadCount={getUnreadCasNoteCount(patient)} /></button></>}
                              </div>
                            </td>
                          </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls {...patientPagination} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
