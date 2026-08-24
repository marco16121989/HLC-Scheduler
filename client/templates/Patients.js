import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { createPopulatedPatientPdf } from "../utils/populatePatientPdf.js";
import { createSimplifiedPatientPdf } from "../utils/populateSimplifiedPatientPdf.js";
import { confirmAction } from "./ConfirmDialog.js";

const getToday = () => new Date().toISOString().slice(0, 10);

const formatPatientListName = (patient) => {
  const isFemale = ["Femmina", "Femminile"].includes(patient.details?.sex);
  const maidenName = patient.details?.maidenName?.trim();
  if (isFemale && maidenName) {
    return `${patient.firstName} ${maidenName} (${patient.lastName})`;
  }
  return `${patient.firstName} ${patient.lastName}`;
};

const NoteButtonContent = () => <span className="patient-note-content">
  <svg className="patient-note-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 3h14v18H5z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
  <span>Note</span>
</span>;

const PATIENT_STATUSES = [
  "In attesa di ricovero",
  "Ricoverato",
  "Dimesso",
  "Trasferito",
  "Deceduto",
];

const getPatientGvpIds = (patient) =>
  Array.isArray(patient?.gvpIds)
    ? patient.gvpIds
    : patient?.gvpId
      ? [patient.gvpId]
      : [];

const getGvpNotes = (patient) => {
  if (Array.isArray(patient?.gvpNotes)) return patient.gvpNotes;
  if (typeof patient?.gvpNotes === "string" && patient.gvpNotes.trim()) {
    return [{ id: "legacy", text: patient.gvpNotes, author: "GVP", authorRole: "GVP", createdAt: null }];
  }
  return [];
};

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
      ["hospitalRoom", "Stanza"],
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
  ["main", "Info Principali"],
  ["departments", "Reparti Coinvolti"],
  ["summary", "Riepilogo"],
  ["insertion", "Info Complete"],
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

export const Patients = ({
  patients,
  setPatients,
  doctors,
  hospitals = [],
  users,
  currentUser,
  presidentId,
  absences = [],
}) => {
  const isGvp = currentUser.role === "GVP";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionType, setAdmissionType] = useState("emergency");
  const [patientStatus, setPatientStatus] = useState(PATIENT_STATUSES[0]);
  const [transferNotes, setTransferNotes] = useState("");
  const [admissionDate, setAdmissionDate] = useState(getToday);
  const [dischargeDate, setDischargeDate] = useState("");
  const [pathology, setPathology] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [casId, setCasId] = useState(
    currentUser.role === "CAS" ? currentUser.id : "",
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
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [doctorSelectionModalOpen, setDoctorSelectionModalOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [departmentSelectionModalOpen, setDepartmentSelectionModalOpen] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentChangeDate, setDepartmentChangeDate] = useState(getToday);
  const [casSelectionModalOpen, setCasSelectionModalOpen] = useState(false);
  const [casSearch, setCasSearch] = useState("");
  const [gvpSelectionModalOpen, setGvpSelectionModalOpen] = useState(false);
  const [gvpSearch, setGvpSearch] = useState("");
  const [notePatient, setNotePatient] = useState(null);
  const [newGvpNote, setNewGvpNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferDraft, setTransferDraft] = useState("");
  const [transferError, setTransferError] = useState("");
  const [activeTab, setActiveTab] = useState("main");

  const isEditing = editingId !== null;
  const transferTargetPatient = transferTarget?.type === "patient"
    ? patients.find((patient) => patient.id === transferTarget.patientId)
    : null;
  const canDeleteTransfer = transferTarget?.type === "form"
    ? patientStatus === "Trasferito"
    : transferTargetPatient?.status === "Trasferito";
  const organizationPatients = patients.filter(
    (patient) => patient.presidentId === presidentId,
  );
  const roleFilteredPatients = isGvp
    ? organizationPatients.filter((patient) => {
        const patientGvpIds = getPatientGvpIds(patient);
        const isMine = patientGvpIds.includes(currentUser.id) || patient.casId === currentUser.id;
        return gvpPatientScope === "all" ? true : isMine;
      })
    : currentUser.role === "CAS" && casFilter !== "all"
      ? organizationPatients.filter((patient) => patient.casId === casFilter)
      : organizationPatients;
  const visiblePatients = statusFilter === "all"
    ? roleFilteredPatients
    : roleFilteredPatients.filter(
        (patient) => (patient.status || PATIENT_STATUSES[0]) === statusFilter,
      );
  const currentNotePatient = notePatient
    ? visiblePatients.find((patient) => patient.id === notePatient.id) || notePatient
    : null;
  const visibleDoctors = doctors.filter(
    (doctor) => doctor.presidentId === presidentId,
  );
  const filteredDoctors = visibleDoctors.filter((doctor) =>
    `${doctor.lastName || ""} ${doctor.firstName || ""}`
      .toLowerCase()
      .includes(doctorSearch.trim().toLowerCase()),
  );
  const availableDepartments = hospitals
    .filter((hospital) => hospital.presidentId === presidentId)
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
  const filteredCasUsers = orderedCasUsers.filter((user) =>
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
  const normalizedGvpSearch = gvpSearch.trim().toLowerCase();
  const associatedGvpUsers = visibleGvpUsers.filter((user) => gvpIds.includes(user.id)).filter((user) => {
    if (!normalizedGvpSearch) return true;
    return `${getGvpDisplayName(user)}`.toLowerCase().includes(normalizedGvpSearch);
  }).sort(availableFirst);
  const unassociatedGvpUsers = visibleGvpUsers.filter((user) => !gvpIds.includes(user.id)).filter((user) => {
    if (!normalizedGvpSearch) return true;
    return `${getGvpDisplayName(user)}`.toLowerCase().includes(normalizedGvpSearch);
  }).sort(availableFirst);
  const editingPatientNotes = getGvpNotes(
    patients.find((patient) => patient.id === editingId),
  );

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setAdmissionType("emergency");
    setPatientStatus(PATIENT_STATUSES[0]);
    setTransferNotes("");
    setAdmissionDate(getToday());
    setDischargeDate("");
    setPathology("");
    setDoctorId("");
    setCasId(currentUser.role === "CAS" ? currentUser.id : "");
    setGvpIds([]);
    setNotes("");
    setNewGvpNote("");
    setDetails({ isMinorOrNewborn: "No" });
    setDepartmentHistory([]);
    setEditingId(null);
    setError("");
    setActiveTab("main");
    setDoctorSelectionModalOpen(false);
    setDepartmentSelectionModalOpen(false);
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
    setGvpSelectionModalOpen(true);
  };

  const openCasSelectionModal = () => {
    setError("");
    setCasSearch("");
    setCasSelectionModalOpen(true);
  };

  const closeCasSelectionModal = () => setCasSelectionModalOpen(false);

  const openDoctorSelectionModal = () => {
    setError("");
    setDoctorSearch("");
    setDoctorSelectionModalOpen(true);
  };

  const closeDoctorSelectionModal = () => setDoctorSelectionModalOpen(false);

  const openDepartmentSelectionModal = () => {
    setError("");
    setDepartmentSearch("");
    setDepartmentChangeDate(getToday());
    setDepartmentSelectionModalOpen(true);
  };

  const selectPatientDepartment = (department) => {
    if (selectedDepartment?.id === department.id) {
      closeDepartmentSelectionModal();
      return;
    }

    if (isEditing && selectedDepartment) {
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
    }

    setDetails((current) => ({
      ...current,
      departmentId: department.id,
      hospitalName: department.hospitalName,
      hospitalDepartment: department.name,
    }));
    closeDepartmentSelectionModal();
  };

  const closeDepartmentSelectionModal = () => setDepartmentSelectionModalOpen(false);

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
    const validDoctorId = visibleDoctors.some(
      (doctor) => doctor.id === doctorId,
    )
      ? doctorId
      : "";
    const validCasId = visibleCasUsers.some((user) => user.id === casId)
      ? casId
      : "";
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

    const isDuplicate = patients.some(
      (patient) =>
        patient.firstName.toLowerCase() === normalizedFirstName.toLowerCase() &&
        patient.lastName.toLowerCase() === normalizedLastName.toLowerCase() &&
        patient.presidentId === presidentId &&
        patient.id !== editingId,
    );

    if (isDuplicate) {
      setError("Il paziente e gia presente.");
      setActiveTab("insertion");
      return false;
    }

    const patientData = {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      admissionType:
        admissionType === "scheduled" ? "scheduled" : "emergency",
      status: PATIENT_STATUSES.includes(patientStatus)
        ? patientStatus
        : PATIENT_STATUSES[0],
      transferNotes: patientStatus === "Trasferito" ? transferNotes.trim() : "",
      admissionDate,
      dischargeDate,
      pathology: normalizedPathology,
      doctorId: validDoctorId,
      casId: validCasId,
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

  const handleEdit = (patient) => {
    setEditingId(patient.id);
    setFirstName(patient.firstName);
    setLastName(patient.lastName);
    setAdmissionType(
      patient.admissionType === "scheduled" ? "scheduled" : "emergency",
    );
    setPatientStatus(
      PATIENT_STATUSES.includes(patient.status)
        ? patient.status
        : PATIENT_STATUSES[0],
    );
    setTransferNotes(patient.transferNotes || "");
    setAdmissionDate(patient.admissionDate || getToday());
    setDischargeDate(patient.dischargeDate || "");
    setPathology(patient.pathology || "");
    setDoctorId(patient.doctorId || "");
    setCasId(patient.casId || "");
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
    setError("");
    setActiveTab("summary");
    setModalOpen(true);
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
    if (!PATIENT_STATUSES.includes(status)) return;
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
    setNotePatient(patient);
    setNewGvpNote("");
    setNoteError("");
  };

  const closeNotes = () => {
    setNotePatient(null);
    setNewGvpNote("");
    setNoteError("");
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
      }
    });
  };

  const doctor = doctors.find((item) => item.id === doctorId);
  const selectedCasUser = users.find((item) => item.id === casId);
  const selectedGvpUsers = users.filter((item) => gvpIds.includes(item.id));

  const summaryEntries = [
    { label: "Nome", value: firstName },
    { label: "Cognome", value: lastName },
    { label: "Sesso", value: details.sex },
    ...(details.sex === "Femmina" ? [{ label: "Cognome da nubile", value: details.maidenName }] : []),
    { label: "DAT compilata?", value: details.datCompleted },
    { label: "DAT registrata?", value: details.datRegistered },
    { label: "Tipo di accesso", value: admissionType === "scheduled" ? "Ricovero programmato" : "Emergenza" },
    { label: "Stato", value: patientStatus },
    ...(patientStatus === "Trasferito" ? [{ label: "Dove è stato trasferito", value: transferNotes }] : []),
    { label: "Medico responsabile", value: doctor ? `${doctor.lastName} ${doctor.firstName}` : "Non assegnato" },
    { label: "Reparto", value: selectedDepartment ? `${selectedDepartment.hospitalName} / ${selectedDepartment.name}` : "Non assegnato" },
    { label: "CAS", value: selectedCasUser?.username || "Non assegnato" },
    { label: "GVP assegnati", value: selectedGvpUsers.length > 0 ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ") : "Nessun GVP assegnato" },
    ...DETAIL_SECTIONS.flatMap((section) =>
      section.fields.map((field) => ({
        label: `${section.title} — ${field[1]}`,
        value: details[field[0]],
      })),
    ),
  ];

  const gvpSummaryEntries = [
    { label: "Nome", value: firstName },
    { label: "Cognome", value: lastName },
    { label: "Sesso", value: details.sex },
    ...(details.sex === "Femmina" ? [{ label: "Cognome da nubile", value: details.maidenName }] : []),
    { label: "Stato", value: patientStatus },
    ...(patientStatus === "Trasferito" ? [{ label: "Dove è stato trasferito", value: transferNotes }] : []),
    { label: "Congregazione", value: details.congregation },
    { label: "Età", value: details.age },
    { label: "Numero di cellulare del paziente", value: details.patientPhone },
    { label: "Problemi di salute", value: details.healthProblems },
    { label: "Condizione spirituale", value: details.spiritualCondition },
    { label: "Familiari non Testimoni coinvolti", value: details.nonWitnessFamily },
    { label: "DAT compilata?", value: details.datCompleted },
    { label: "DAT registrata?", value: details.datRegistered },
    { label: "Nome dell’anziano", value: details.elderName },
    { label: "E-mail dell’anziano", value: details.elderEmail },
    { label: "Cellulare dell’anziano", value: details.elderPhone },
    { label: "Note per il CAS", value: details.simplifiedNotes },
  ];

  const mainSummaryEntries = [
    { label: "Nome", value: firstName },
    { label: "Cognome", value: lastName },
    { label: "Sesso", value: details.sex },
    ...(details.sex === "Femmina" ? [{ label: "Cognome da nubile", value: details.maidenName }] : []),
    { label: "DAT compilata?", value: details.datCompleted },
    { label: "DAT registrata?", value: details.datRegistered },
    { label: "Tipo di accesso", value: admissionType === "scheduled" ? "Ricovero programmato" : "Emergenza" },
    { label: "Stato", value: patientStatus },
    { label: "Medico responsabile", value: doctor ? `${doctor.lastName} ${doctor.firstName}` : "Non assegnato" },
    { label: "CAS", value: selectedCasUser?.username || "Non assegnato" },
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
            <h1 className="mb-0">Pazienti</h1>
            <div className="d-flex align-items-center gap-2 flex-nowrap patient-header-actions">
              <select
                className="form-select w-auto flex-shrink-0"
                aria-label="Filtra pazienti per stato"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Tutti gli stati</option>
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
              {!isGvp && <button className="btn btn-primary" type="button" onClick={openCreateModal}>Inserisci</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="app-content patient-page-content">
        <div className="container-fluid">
          {notePatient && <>
            <button className="entity-modal-backdrop" type="button" aria-label="Chiudi note" onClick={closeNotes} />
            <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="gvp-notes-title">
              <section className="card entity-modal-card">
                <div className="card-header d-flex align-items-center">
                  <h2 className="card-title" id="gvp-notes-title">Note — {notePatient.lastName} {notePatient.firstName}</h2>
                  <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeNotes} />
                </div>
                <div className="card-body">
                  {noteError && <div className="alert alert-danger py-2" role="alert">{noteError}</div>}
                  <h3 className="h6">Note esistenti</h3>
                  {getGvpNotes(currentNotePatient).length === 0 ? <p className="text-secondary">Nessuna nota inserita.</p> : <div className="d-grid gap-2 mb-4">{getGvpNotes(currentNotePatient).map((note) => <article className="border rounded p-3" key={note.id}><div className="d-flex align-items-start justify-content-between gap-3"><p className="mb-1">{note.text}</p>{note.authorId === currentUser.id && <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteGvpNote(note)}>Elimina</button>}</div><div className="d-flex align-items-center gap-2"><span className={`badge ${getNoteRoleBadgeClass(note.authorRole)}`}>{note.authorRole || "GVP"}</span><small className="text-secondary">{note.author || "GVP"}{note.createdAt ? ` · ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(note.createdAt))}` : ""}</small></div></article>)}</div>}
                  <label className="form-label" htmlFor="gvp-patient-notes">Aggiungi una nota</label>
                  <textarea className="form-control" id="gvp-patient-notes" rows="5" value={newGvpNote} onChange={(event) => setNewGvpNote(event.target.value)} maxLength="4000" autoFocus />
                </div>
                <div className="card-footer d-flex justify-content-end gap-2">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeNotes}>Annulla</button>
                  <button className="btn btn-primary" type="button" onClick={saveGvpNotes} disabled={noteSaving || !newGvpNote.trim()}>{noteSaving ? "Salvataggio…" : "Aggiungi nota"}</button>
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
                      onChange={(event) => requestFormStatusChange(event.target.value)}
                    >
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
                {!isGvp && (
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
                      {PATIENT_FORM_TABS.filter(([tabId]) => !["summary", "departments"].includes(tabId) || isEditing).map(([tabId, label]) => <button
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

                  {isGvp ? (
                    <div className="patient-form-grid">
                      <div className="alert alert-light border mb-3" role="status">
                        Riepilogo delle informazioni disponibili per il GVP.
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
                  ) : activeTab === "main" ? (
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
                        <div className="col-12 col-md-4">
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
                        <div className="col-12 col-md-4">
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
                      <div className="patient-assignment-row row g-2 w-100">
                        {SIMPLIFIED_FIELDS.slice(6, 8).map((field) => (
                          <PatientDetailField
                            key={field[0]}
                            field={field}
                            value={details[field[0]]}
                            columnClassName="col-12 col-md-6"
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
                        </div>
                      </fieldset>
                      {patientStatus === "Trasferito" && (
                        <div className="w-100 alert alert-light border mb-0">
                          <div className="fw-semibold mb-1">Dove è stato trasferito</div>
                          <div>{transferNotes || "Informazione non disponibile"}</div>
                          <button
                            className="btn btn-outline-primary btn-sm mt-2"
                            type="button"
                            onClick={() => {
                              setTransferTarget({ type: "form" });
                              setTransferDraft(transferNotes);
                              setTransferError("");
                            }}
                          >
                            Modifica note trasferimento
                          </button>
                        </div>
                      )}
                      <div className="patient-assignment-row row g-3 w-100">
                        <div className="col-12 col-md-3">
                          <div className="form-label">Medico responsabile</div>
                          <button className="btn btn-outline-primary w-100" type="button" onClick={openDoctorSelectionModal} disabled={visibleDoctors.length === 0}>
                            {doctor ? `${doctor.lastName} ${doctor.firstName}` : "Seleziona medico"}
                          </button>
                        </div>
                        <div className="col-12 col-md-3">
                          <div className="form-label">CAS</div>
                          <button className="btn btn-outline-primary w-100" type="button" onClick={openCasSelectionModal} disabled={visibleCasUsers.length === 0}>
                            {selectedCasUser ? selectedCasUser.username : "Seleziona CAS"}
                          </button>
                        </div>
                        <div className="col-12 col-md-3">
                          <div className="form-label">GVP assegnati</div>
                          <button className="btn btn-outline-primary w-100" type="button" onClick={openGvpSelectionModal} disabled={visibleGvpUsers.length === 0}>
                            {selectedGvpUsers.length > 0
                              ? selectedGvpUsers.map((user) => getGvpDisplayName(user)).join(", ")
                              : "Seleziona GVP"}
                          </button>
                        </div>
                        <div className="col-12 col-md-3">
                          <div className="form-label">Reparto</div>
                          {isEditing && selectedDepartment ? (
                            <button
                              className="btn btn-outline-primary w-100 text-start"
                              type="button"
                              onClick={openDepartmentSelectionModal}
                              disabled={availableDepartments.length === 0}
                              aria-label={`Cambia reparto. Reparto attuale: ${selectedDepartment.hospitalName}, ${selectedDepartment.name}`}
                              title="Clicca per cambiare reparto"
                            >
                              {selectedDepartment.hospitalName} / {selectedDepartment.name}
                            </button>
                          ) : (
                            <button className="btn btn-outline-primary w-100" type="button" onClick={openDepartmentSelectionModal} disabled={availableDepartments.length === 0}>
                              {selectedDepartment ? `${selectedDepartment.hospitalName} / ${selectedDepartment.name}` : "Seleziona reparto"}
                            </button>
                          )}
                        </div>
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
                      {departmentSelectionModalOpen && (
                        <>
                          <button className="entity-modal-backdrop" type="button" aria-label="Chiudi selezione reparto" onClick={closeDepartmentSelectionModal} />
                          <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="department-selection-title">
                            <section className="card entity-modal-card">
                              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                                <h3 className="card-title mb-0" id="department-selection-title">{isEditing && selectedDepartment ? "Cambia reparto" : "Seleziona reparto"}</h3>
                                <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={closeDepartmentSelectionModal} />
                              </div>
                              <div className="card-body">
                                {isEditing && selectedDepartment && (
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
                                <label className="form-label" htmlFor="doctor-search">Cerca per nome</label>
                                <input className="form-control mb-3" id="doctor-search" type="search" value={doctorSearch} onChange={(event) => setDoctorSearch(event.target.value)} placeholder="Inserisci nome o cognome" autoFocus />
                                <div className="d-grid gap-2">
                                  {filteredDoctors.map((availableDoctor) => (
                                    <button
                                      className={`btn text-start ${doctorId === availableDoctor.id ? "btn-primary" : "btn-outline-secondary"}`}
                                      type="button"
                                      key={availableDoctor.id}
                                      onClick={() => {
                                        setDoctorId(availableDoctor.id);
                                        closeDoctorSelectionModal();
                                      }}
                                    >
                                      {availableDoctor.lastName} {availableDoctor.firstName}
                                    </button>
                                  ))}
                                  {filteredDoctors.length === 0 && <div className="text-secondary">Nessun medico trovato.</div>}
                                </div>
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
                                <label className="form-label" htmlFor="cas-search">Cerca per nome</label>
                                <input className="form-control mb-3" id="cas-search" type="search" value={casSearch} onChange={(event) => setCasSearch(event.target.value)} placeholder="Inserisci il nome" autoFocus />
                                <div className="d-grid gap-2">
                                  {filteredCasUsers.map((casUser) => (
                                    <button
                                      className={`btn text-start ${casId === casUser.id ? "btn-primary" : "btn-outline-secondary"}`}
                                      type="button"
                                      key={casUser.id}
                                      onClick={() => {
                                        setCasId(casUser.id);
                                        closeCasSelectionModal();
                                      }}
                                    >
                                      {casUser.username}{casUser.id === currentUser.id ? " (io)" : ""}
                                      {isAbsentOnAdmissionDate(casUser.id) ? ` — ${getAbsenceLabel(casUser.id)}` : ""}
                                    </button>
                                  ))}
                                  {filteredCasUsers.length === 0 && <div className="text-secondary">Nessun CAS trovato.</div>}
                                </div>
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
                                <label className="form-label" htmlFor="main-gvp-search">Cerca per nome</label>
                                <input className="form-control mb-3" id="main-gvp-search" type="search" value={gvpSearch} onChange={(event) => setGvpSearch(event.target.value)} placeholder="Inserisci il nome" autoFocus />
                                <div className="d-grid gap-2 border rounded p-3">
                                  {[...associatedGvpUsers, ...unassociatedGvpUsers].map((gvpUser) => (
                                    <label className="form-check" key={gvpUser.id}>
                                      <input className="form-check-input" type="checkbox" checked={gvpIds.includes(gvpUser.id)} onChange={() => toggleGvpSelection(gvpUser)} />
                                      <span className="form-check-label">{getGvpDisplayName(gvpUser)}{isAbsentOnAdmissionDate(gvpUser.id) && <span className="badge text-bg-warning ms-2">{getAbsenceLabel(gvpUser.id)}</span>}</span>
                                    </label>
                                  ))}
                                  {associatedGvpUsers.length + unassociatedGvpUsers.length === 0 && <div className="text-secondary">Nessun GVP trovato.</div>}
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
                </div>

                <div className="card-footer d-flex align-items-center gap-2">
                  {!isGvp && isEditing && (
                    <button
                      className="btn btn-outline-danger me-auto"
                      type="button"
                      onClick={handleDelete}
                    >
                      Elimina
                    </button>
                  )}
                  {!isGvp && isEditing && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={resetForm}
                    >
                      Annulla
                    </button>
                  )}
                  {isGvp ? (
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
                      [...visiblePatients]
                        .sort((first, second) =>
                          first.lastName.localeCompare(second.lastName),
                        )
                        .map((patient) => {
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
                                <td className="fw-medium" data-label="Paziente">{formatPatientListName(patient)}</td>
                                <td className="text-center patient-actions-column" data-label="Azioni"><div className="patient-row-actions"><button className="btn btn-primary btn-sm" type="button" onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openNotes(patient); }}><NoteButtonContent /></button></div></td>
                              </tr>
                            );
                          }
                          const casUser = users.find(
                            (item) => item.id === patient.casId,
                          );
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
                            </td>
                            <td data-label="Accesso">
                              <span
                                className={`badge ${
                                  patient.admissionType === "scheduled"
                                    ? "text-bg-primary"
                                    : "text-bg-danger"
                                }`}
                              >
                                {patient.admissionType === "scheduled"
                                  ? "Programmato"
                                  : "Emergenza"}
                              </span>
                            </td>
                            <td data-label="Stato">
                              <select
                                className="form-select form-select-sm patient-list-status"
                                aria-label={`Stato di ${patient.firstName} ${patient.lastName}`}
                                value={patient.status || PATIENT_STATUSES[0]}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                onChange={(event) => updatePatientStatus(patient.id, event.target.value)}
                              >
                                {PATIENT_STATUSES.map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </td>
                            <td data-label="Data">
                              {patient.admissionDate
                                ? new Intl.DateTimeFormat("it-IT").format(
                                    new Date(
                                      `${patient.admissionDate}T00:00:00`,
                                    ),
                                  )
                                : "-"}
                            </td>
                            <td data-label="CAS">
                              {casUser?.username || (
                                <span className="badge text-bg-warning">
                                  Non assegnato
                                </span>
                              )}
                            </td>
                            <td data-label="GVP">{gvpUsers.length > 0 ? <div className="d-flex flex-wrap gap-1">{gvpUsers.map((gvpUser) => <span className="badge text-bg-info" key={gvpUser.id}>{getGvpDisplayName(gvpUser)}</span>)}</div> : <span className="text-secondary">-</span>}</td>
                            <td className="text-center patient-actions-column" data-label="Azioni">
                              <div className="patient-row-actions">
                                {(currentUser.role === "CAS" || currentUser.role === "Presidente") && <button className="btn btn-primary btn-sm" type="button" onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openNotes(patient); }}><NoteButtonContent /></button>}
                              </div>
                            </td>
                          </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
