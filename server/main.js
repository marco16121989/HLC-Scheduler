import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { Random } from "meteor/random";
import { check, Match } from "meteor/check";
import webpush from "web-push";
import {
  AccessLogsCollection,
  LoginMessagesCollection,
  AbsencesCollection,
  DepartmentsCollection,
  DoctorsCollection,
  EventsCollection,
  HospitalsCollection,
  HospitalityOffersCollection,
  NotificationsCollection,
  PatientsCollection,
  PresentationsCollection,
  PushSettingsCollection,
  PushSubscriptionsCollection,
  SupportRequestsCollection,
  UsefulFilesCollection,
} from "/imports/api/links";
import { formatUserName } from "/imports/utils/formatUserName";
import { DEFAULT_DEPARTMENT_NAMES } from "/imports/constants/departments";
import { MANAGEABLE_PAGES, getPagePermission } from "/imports/constants/pagePermissions";
import { normalizeGvpPatientSharedFields } from "/imports/constants/gvpPatientSharing";


const usefulFileExtensions = new Set([
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "odt", "rtf", "txt",
  "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp", "zip",
]);
const supportRequestStatuses = new Set(["Inviata", "In lavorazione", "Risolta", "Chiusa"]);

const impersonationSessions = new Map();
const impersonationLoginTickets = new Map();
const impersonationConnectionTokens = new Map();
const clearExpiredImpersonationSessions = () => {
  const now = Date.now();
  for (const [token, session] of impersonationSessions) {
    if (session.expiresAt < now) impersonationSessions.delete(token);
  }
};

Meteor.onConnection((connection) => {
  connection.onClose(() => {
    impersonationConnectionTokens.delete(connection.id);
    for (const [token, ticket] of impersonationLoginTickets) {
      if (ticket.connectionId === connection.id) impersonationLoginTickets.delete(token);
    }
  });
});

Accounts.registerLoginHandler("hlc-impersonation", async function impersonationLogin(options) {
  const token = options?.hlcImpersonationToken;
  if (!token) return undefined;
  check(token, String);
  const ticket = impersonationLoginTickets.get(token);
  impersonationLoginTickets.delete(token);
  if (!ticket || ticket.connectionId !== this.connection.id || ticket.expiresAt < Date.now()) {
    throw new Meteor.Error("invalid-token", "Token assistenza non valido o scaduto.");
  }
  if (ticket.mode === "start") {
    impersonationSessions.set(ticket.sessionToken, {
      adminId: ticket.adminId,
      targetId: ticket.userId,
      startedAt: new Date(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    });
    impersonationConnectionTokens.set(this.connection.id, ticket.sessionToken);
  } else {
    impersonationSessions.delete(ticket.sessionToken);
    impersonationConnectionTokens.delete(this.connection.id);
  }
  return { userId: ticket.userId };
});

export const normalizePushSubscription = (subscription) => {
  check(subscription, Object);
  check(subscription.endpoint, String);
  check(subscription.keys, Object);
  check(subscription.keys.p256dh, String);
  check(subscription.keys.auth, String);

  const expirationTime = subscription.expirationTime;
  if (expirationTime !== undefined && expirationTime !== null) {
    check(expirationTime, Number);
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: expirationTime ?? null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };
};
const usefulFileMimeTypes = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text", "application/rtf", "text/rtf", "text/plain",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet", "text/csv", "application/csv",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation", "application/zip", "application/x-zip-compressed",
  "application/octet-stream",
]);

const publicUserFields = {
  username: 1,
  profile: 1,
};

let vapidPublicKey = "";

const initializeWebPush = async () => {
  const environmentKeys = process.env.HLC_VAPID_PUBLIC_KEY && process.env.HLC_VAPID_PRIVATE_KEY
    ? { publicKey: process.env.HLC_VAPID_PUBLIC_KEY, privateKey: process.env.HLC_VAPID_PRIVATE_KEY }
    : null;
  let keys = environmentKeys || await PushSettingsCollection.findOneAsync("vapid");
  if (!keys) {
    keys = { _id: "vapid", ...webpush.generateVAPIDKeys(), createdAt: new Date() };
    await PushSettingsCollection.insertAsync(keys);
  }
  vapidPublicKey = keys.publicKey;
  webpush.setVapidDetails(process.env.HLC_VAPID_SUBJECT || "mailto:assistenza@hlcscheduler.local", keys.publicKey, keys.privateKey);
};

const sendDevicePush = async (notification) => {
  if (!vapidPublicKey) return;
  const subscriptions = await PushSubscriptionsCollection.find({ userId: notification.recipientId }).fetchAsync();
  const badgeCount = await NotificationsCollection.find({
    recipientId: notification.recipientId,
    readAt: null,
  }).countAsync();
  const payload = JSON.stringify({
    title: "HLC Scheduler",
    body: notification.message,
    url: "/",
    notificationId: notification._id,
    badgeCount,
  });
  for (const item of subscriptions) {
    try {
      await webpush.sendNotification(item.subscription, payload);
    } catch (error) {
      if ([404, 410].includes(error?.statusCode)) {
        await PushSubscriptionsCollection.removeAsync(item._id);
      } else {
        console.error("Invio notifica push non riuscito.", error?.message || error);
      }
    }
  }
};

const insertNotification = async (notification) => {
  const id = await NotificationsCollection.insertAsync(notification);
  sendDevicePush({ ...notification, _id: id }).catch((error) => {
    console.error("Preparazione della notifica push non riuscita.", error?.message || error);
  });
  return id;
};

const requireUser = (context) => {
  if (!context.userId) {
    throw new Meteor.Error("not-authorized", "Devi effettuare l'accesso.");
  }
};
const requirePageEdit = (actor, pageId) => {
  const permission = getPagePermission({ ...(actor?.profile || {}), role: actor?.profile?.role }, pageId);
  if (!permission.edit) throw new Meteor.Error("not-authorized", "Non hai il permesso di modificare questa sezione.");
};

const getGvpPatientSharedFields = async (presidentId) => {
  const president = await Meteor.users.findOneAsync(presidentId, {
    fields: { "profile.gvpPatientSharedFields": 1 },
  });
  return normalizeGvpPatientSharedFields(president?.profile?.gvpPatientSharedFields);
};

const CLOSED_PATIENT_STATUSES = ["Dimesso", "Deceduto", "Trasferito"];
const getClosedPatientHiddenFields = async () => ["firstName", "lastName"];

const gvpPatientProjection = (sharedFields) => Object.fromEntries([
  "presidentId", "casId", "casIds", "gvpId", "gvpIds", "gvpNotes", "transferNotes",
  ...sharedFields,
].map((field) => [field, 1]));

const setNestedValue = (target, path, value) => {
  const parts = path.split(".");
  let cursor = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value;
    else cursor = cursor[part] ||= {};
  });
};

const pickGvpPatientFields = (patient, sharedFields) => {
  const visible = {
    _id: patient._id,
    presidentId: patient.presidentId,
    casId: patient.casId,
    casIds: patient.casIds,
    gvpId: patient.gvpId,
    gvpIds: patient.gvpIds,
    gvpNotes: patient.gvpNotes,
    transferNotes: patient.transferNotes,
  };
  for (const path of sharedFields) {
    const value = path.split(".").reduce((current, part) => current?.[part], patient);
    if (value !== undefined) setNestedValue(visible, path, value);
  }
  return visible;
};

const maskClosedPatientFields = (patient, hiddenFields) => {
  if (!patient || !CLOSED_PATIENT_STATUSES.includes(patient.status)) return patient;
  const masked = { ...patient, details: { ...(patient.details || {}) } };
  hiddenFields.forEach((path) => setNestedValue(masked, path, "********"));
  if (Array.isArray(patient.changeHistory)) {
    masked.changeHistory = patient.changeHistory.map((entry) => hiddenFields.includes(entry.field)
      ? { ...entry, oldValue: "********", newValue: "********" }
      : entry);
  }
  return masked;
};

const restoreProtectedPatientFields = (record, existing, hiddenFields) => {
  if (!CLOSED_PATIENT_STATUSES.includes(record?.status) || !existing) return record;
  const restored = { ...record, details: { ...(record.details || {}) } };
  hiddenFields.forEach((path) => {
    const originalValue = path.split(".").reduce((current, part) => current?.[part], existing);
    if (originalValue !== undefined) setNestedValue(restored, path, originalValue);
  });
  return restored;
};

const PATIENT_AUDIT_EXCLUDED_FIELDS = new Set([
  "_id", "id", "presidentId", "changeHistory", "createdAt", "updatedAt",
]);

const flattenPatientAuditFields = (value, prefix = "", output = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!PATIENT_AUDIT_EXCLUDED_FIELDS.has(path)) flattenPatientAuditFields(nestedValue, path, output);
    });
  } else if (prefix) {
    output[prefix] = value;
  }
  return output;
};

const formatPatientAuditValue = (value) => {
  if (value === undefined || value === null || value === "") return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const buildPatientChangeHistory = ({ existing, updated, actor }) => {
  const before = flattenPatientAuditFields(existing);
  const after = flattenPatientAuditFields(updated);
  const changedAt = new Date();
  const changedByName = actor?.username
    || `${actor?.profile?.firstName || ""} ${actor?.profile?.lastName || ""}`.trim()
    || actor?.profile?.role
    || "Utente";
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => formatPatientAuditValue(before[field]) !== formatPatientAuditValue(after[field]))
    .map((field) => ({
      id: Random.id(),
      field,
      oldValue: formatPatientAuditValue(before[field]),
      newValue: formatPatientAuditValue(after[field]),
      changedAt,
      changedById: actor?._id || "",
      changedByName,
      changedByRole: actor?.profile?.role || "",
    }));
};

const standardPatientProjection = (hiddenFields = []) => {
  const projection = Object.fromEntries([
    "presidentId", "casId", "casIds", "gvpId", "gvpIds", "firstName", "lastName",
    "admissionDate", "dischargeDate", "admissionType", "status", "transferNotes", "pathology",
    "doctorId", "details.sex", "details.maidenName", "details.departmentId", "details.hospitalRoom",
    "details.hospitalBed", "details.anesthesiologistDate", "details.anesthesiologistTime",
    "details.anesthesiologistName",
  ].map((field) => [field, 1]));
  hiddenFields.forEach((field) => delete projection[field]);
  projection.status = 1;
  return projection;
};

const publishPatientCursors = async (subscription, cursors) => {
  const observers = [];
  const sourceRecords = cursors.map(() => new Map());
  const publishedRecords = new Map();
  const valuesMatch = (first, second) => JSON.stringify(first) === JSON.stringify(second);
  const syncPatient = (id) => {
    const availableSources = sourceRecords.filter((source) => source.has(id));
    if (availableSources.length === 0) {
      if (publishedRecords.has(id)) subscription.removed(PatientsCollection._name, id);
      publishedRecords.delete(id);
      return;
    }
    // Il cursore dei pazienti conclusi è l'ultimo e ha la precedenza, così i campi
    // censurati non possono riapparire durante un cambio di stato simultaneo.
    const nextFields = { ...availableSources.at(-1).get(id) };
    const previousFields = publishedRecords.get(id);
    if (!previousFields) {
      publishedRecords.set(id, nextFields);
      subscription.added(PatientsCollection._name, id, nextFields);
      return;
    }
    const changes = {};
    for (const field of new Set([...Object.keys(previousFields), ...Object.keys(nextFields)])) {
      if (!(field in nextFields)) changes[field] = undefined;
      else if (!valuesMatch(previousFields[field], nextFields[field])) changes[field] = nextFields[field];
    }
    publishedRecords.set(id, nextFields);
    if (Object.keys(changes).length > 0) subscription.changed(PatientsCollection._name, id, changes);
  };
  for (let index = 0; index < cursors.length; index += 1) {
    const source = sourceRecords[index];
    const cursor = cursors[index];
    const observer = await cursor.observeChangesAsync({
      added: (id, fields) => {
        source.set(id, { ...fields });
        syncPatient(id);
      },
      changed: (id, fields) => {
        const nextFields = { ...(source.get(id) || {}) };
        Object.entries(fields).forEach(([field, value]) => {
          if (value === undefined) delete nextFields[field];
          else nextFields[field] = value;
        });
        source.set(id, nextFields);
        syncPatient(id);
      },
      removed: (id) => {
        source.delete(id);
        syncPatient(id);
      },
    });
    observers.push(observer);
  }
  subscription.onStop(() => observers.forEach((observer) => observer.stop()));
};

export const buildPatientNoteNotification = ({ recipientId, patientId, patientName, noteAuthor, noteText }) => ({
  recipientId,
  type: "patient-note",
  patientId,
  patientName,
  noteAuthor,
  noteText,
  message: `${noteAuthor} ha aggiunto una nota per ${patientName}.`,
  createdAt: new Date(),
  readAt: null,
});

export const getAssignedGvpIds = (patient) => [...new Set([
  ...(Array.isArray(patient?.gvpIds) ? patient.gvpIds : []),
  patient?.gvpId,
].filter(Boolean))];

export const getAssignedCasIds = (patient) => [...new Set([
  ...(Array.isArray(patient?.casIds) ? patient.casIds : []),
  patient?.casId,
].filter(Boolean))];

export const getPatientCoordinatorIds = (patient) => [...new Set([
  ...getAssignedCasIds(patient),
  patient?.presidentId,
].filter(Boolean))];

export const isNewCasAssignment = (previousCasId, currentCasId) =>
  Boolean(currentCasId) && currentCasId !== previousCasId;

export const getPatientDeletionRecipientIds = (patient, actorId) => [...new Set([
  ...getPatientCoordinatorIds(patient),
  ...getAssignedGvpIds(patient),
].filter((recipientId) => recipientId && recipientId !== actorId))];

const getActorPresidentId = async (actor) => {
  const role = actor?.profile?.role;
  if (role === "Presidente") return actor._id;
  if (actor?.profile?.presidentId) return actor.profile.presidentId;
  if (role === "CAS" && actor.profile?.associationId) return actor.profile.associationId;
  if (role !== "GVP") return "";
  const linkedCasId = actor.profile?.casIds?.[0] || actor.profile?.casId || actor.profile?.associationId || "";
  const linkedCas = linkedCasId ? await Meteor.users.findOneAsync(linkedCasId) : null;
  return linkedCas?.profile?.presidentId || linkedCas?.profile?.associationId ||
    (linkedCas?.profile?.role === "Presidente" ? linkedCas._id : "");
};

const cleanRecord = (record) => {
  const { _id, password, passwordHash, ...fields } = record;
  return { _id: record.id || _id, ...fields };
};

const replaceRecords = async (collection, records, scope = {}) => {
  check(records, [Object]);
  const scopedRecords = scope.presidentId
    ? records.filter((record) => record.presidentId === scope.presidentId)
    : records;
  const incomingIds = scopedRecords.map((record) => record.id || record._id);
  const removeSelector = scope.presidentId
    ? { presidentId: scope.presidentId, _id: { $nin: incomingIds } }
    : { _id: { $nin: incomingIds } };

  await collection.removeAsync(removeSelector);
  for (const record of scopedRecords) {
    const cleaned = cleanRecord(record);
    const { _id, ...fields } = cleaned;
    await collection.upsertAsync(
      { _id, ...(scope.presidentId ? { presidentId: scope.presidentId } : {}) },
      { $set: fields },
    );
  }
};

const validatePatientAssignments = async (records, presidentId) => {
  if (!presidentId) return;
  const casIds = [...new Set(records.flatMap((record) => getAssignedCasIds(record)))];
  const gvpIds = [...new Set(records.flatMap((record) => getAssignedGvpIds(record)))];
  const assignedIds = [...new Set([...casIds, ...gvpIds])];
  if (assignedIds.length > 0) {
    const assignedUsers = await Meteor.users.find(
      { _id: { $in: assignedIds } },
      { fields: publicUserFields },
    ).fetchAsync();
    const usersById = new Map(assignedUsers.map((user) => [user._id, user]));
    const belongsToOrganization = async (id, expectedRole) => {
      const user = usersById.get(id);
      return user?.profile?.role === expectedRole &&
        await getActorPresidentId(user) === presidentId;
    };
    const casChecks = await Promise.all(casIds.map((id) => belongsToOrganization(id, "CAS")));
    const gvpChecks = await Promise.all(gvpIds.map((id) => belongsToOrganization(id, "GVP")));
    const invalidCas = casChecks.some((isValid) => !isValid);
    const invalidGvp = gvpChecks.some((isValid) => !isValid);
    if (invalidCas || invalidGvp) {
      throw new Meteor.Error("not-authorized", "Assegnazione a un utente esterno all’organizzazione.");
    }
  }

  const doctorIds = [...new Set(records.flatMap((record) => [
    record.doctorId,
    ...(Array.isArray(record.recommendedDoctorIds) ? record.recommendedDoctorIds : []),
  ]).filter(Boolean))];
  if (doctorIds.length > 0) {
    const allowedDoctorCount = await DoctorsCollection.find({
      _id: { $in: doctorIds },
      presidentId,
    }).countAsync();
    if (allowedDoctorCount !== doctorIds.length) {
      throw new Meteor.Error("not-authorized", "Medico esterno all’organizzazione.");
    }
  }
};

const userView = (user) => ({
  id: user._id,
  username: user.username,
  ...(user.profile || {}),
});

const ensureDefaultDepartments = async (presidentId) => {
  if (!presidentId || await DepartmentsCollection.find({ presidentId }).countAsync() > 0) return;
  for (const name of DEFAULT_DEPARTMENT_NAMES) {
    await DepartmentsCollection.insertAsync({ name, presidentId });
  }
};

const sendScheduledAdmissionReminders = async () => {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const patients = await PatientsCollection.find({
    admissionType: "scheduled",
    admissionDate: { $exists: true, $ne: "" },
    status: { $nin: CLOSED_PATIENT_STATUSES },
  }).fetchAsync();

  for (const patient of patients) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(patient.admissionDate || "");
    if (!match) continue;
    const admissionDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const daysUntilAdmission = Math.round((admissionDate.getTime() - todayStart.getTime()) / 86400000);
    if (![7, 2].includes(daysUntilAdmission)) continue;

    const gvpIds = getAssignedGvpIds(patient);
    const recipientIds = [...new Set([...getPatientCoordinatorIds(patient), ...gvpIds])];
    const patientName = `${patient.lastName || ""} ${patient.firstName || ""}`.trim();

    for (const recipientId of recipientIds) {
      const recipient = await Meteor.users.findOneAsync(recipientId, { fields: publicUserFields });
      if (!["Presidente", "CAS", "GVP"].includes(recipient?.profile?.role)) continue;
      const alreadySent = await NotificationsCollection.findOneAsync({
        recipientId,
        type: "scheduled-admission-reminder",
        patientId: patient._id,
        admissionDate: patient.admissionDate,
        reminderDays: daysUntilAdmission,
      });
      if (alreadySent) continue;

      await insertNotification({
        recipientId,
        type: "scheduled-admission-reminder",
        patientId: patient._id,
        patientName,
        admissionDate: patient.admissionDate,
        reminderDays: daysUntilAdmission,
        senderName: "Sistema",
        message: `Il ricovero programmato di ${patientName || "un paziente assegnato"} è previsto tra ${daysUntilAdmission} giorni.`,
        createdAt: new Date(),
        readAt: null,
      });
    }
  }
};

Accounts.validateLoginAttempt((attempt) => {
  if (attempt.allowed && attempt.user?.profile?.disabled) {
    throw new Meteor.Error("account-disabled", "Il gestionale è stato disattivato per questo account.");
  }
  return attempt.allowed;
});

Meteor.publish("hlc-data", async function publishHlcData() {
  if (!this.userId) {
    return this.ready();
  }

  const actor = await Meteor.users.findOneAsync(this.userId);
  const role = actor?.profile?.role;
  const linkedCasId = role === "GVP"
    ? actor.profile?.casIds?.[0] || actor.profile?.casId || actor.profile?.associationId || ""
    : "";
  const linkedCas = linkedCasId ? await Meteor.users.findOneAsync(linkedCasId) : null;
  const presidentId =
    role === "Presidente"
      ? actor._id
      : role === "CAS" || role === "GVP"
        ? actor.profile.presidentId ||
          (role === "GVP"
            ? linkedCas?.profile?.presidentId || linkedCas?.profile?.associationId ||
              (linkedCas?.profile?.role === "Presidente" ? linkedCas._id : "")
            : actor.profile.associationId)
        : null;
  const dataSelector = presidentId ? { presidentId } : role === "Admin" ? {} : { _id: null };
  await ensureDefaultDepartments(presidentId);
  const userSelector =
    role === "Admin"
      ? {}
      : role === "GVP" && !getPagePermission({ ...actor.profile, role }, "gvp").view
        ? { _id: actor._id }
      : presidentId
        ? {
            $or: [
              { _id: actor._id },
              { "profile.presidentId": presidentId },
              { "profile.associationId": presidentId },
            ],
          }
        : { _id: actor._id };

  if (role === "GVP") {
    const sharedPatientFields = await getGvpPatientSharedFields(presidentId);
    const closedPatientHiddenFields = await getClosedPatientHiddenFields(presidentId);
    const closedGvpFields = sharedPatientFields.filter((field) => !closedPatientHiddenFields.includes(field));
    const canViewPermissions = getPagePermission({ ...actor.profile, role }, "permissions").view;
    const gvpHospitalUsersSelector = canViewPermissions ? {
      $or: [
        { _id: actor._id },
        { "profile.presidentId": presidentId },
        { "profile.associationId": presidentId },
      ],
    } : {
      $or: [
        { _id: actor._id },
        { "profile.role": "CAS", "profile.presidentId": presidentId },
        { "profile.role": "CAS", "profile.associationId": presidentId },
      ],
    };
    await publishPatientCursors(this, [
      PatientsCollection.find(
        { presidentId, status: { $nin: CLOSED_PATIENT_STATUSES }, $or: [{ gvpIds: actor._id }, { gvpId: actor._id }] },
        { fields: gvpPatientProjection(sharedPatientFields) },
      ),
      PatientsCollection.find(
        { presidentId, status: { $in: CLOSED_PATIENT_STATUSES }, $or: [{ gvpIds: actor._id }, { gvpId: actor._id }] },
        { fields: gvpPatientProjection(closedGvpFields) },
      ),
    ]);
    return [
      Meteor.users.find(gvpHospitalUsersSelector, { fields: publicUserFields }),
      HospitalsCollection.find({ presidentId }),
      HospitalityOffersCollection.find(
        getPagePermission({ ...actor.profile, role }, "hospitality").view ? { presidentId } : { _id: null },
        { sort: { hostName: 1 } },
      ),
      DoctorsCollection.find({ presidentId }, { fields: {
        presidentId: 1,
        firstName: 1,
        lastName: 1,
        phone: 1,
        email: 1,
        doctorType: 1,
        professionalRole: 1,
        notes: 1,
        doctorNotes: 1,
        officeInstructions: 1,
        departmentIds: 1,
      } }),
      UsefulFilesCollection.find({ presidentId }, { sort: { createdAt: -1 } }),
      AbsencesCollection.find({ userId: actor._id }, { sort: { startDate: 1 } }),
    ];
  }

  const absenceUserIds = ["Presidente", "CAS"].includes(role)
    ? (await Meteor.users.find(userSelector, { fields: { _id: 1 } }).fetchAsync()).map((user) => user._id)
    : [actor._id];
  const closedPatientHiddenFields = await getClosedPatientHiddenFields(presidentId);
  await publishPatientCursors(this, [
    PatientsCollection.find({ ...dataSelector, status: { $nin: CLOSED_PATIENT_STATUSES } }, { fields: standardPatientProjection() }),
    PatientsCollection.find({ ...dataSelector, status: { $in: CLOSED_PATIENT_STATUSES } }, { fields: standardPatientProjection(closedPatientHiddenFields) }),
  ]);

  return [
    Meteor.users.find(userSelector, { fields: publicUserFields }),
    HospitalsCollection.find(dataSelector),
    HospitalityOffersCollection.find(
      getPagePermission({ ...(actor.profile || {}), role }, "hospitality").view ? dataSelector : { _id: null },
      { sort: { hostName: 1 } },
    ),
    DepartmentsCollection.find(dataSelector),
    DoctorsCollection.find(dataSelector),
    // Le presentazioni sono condivise soltanto all'interno della stessa organizzazione.
    PresentationsCollection.find(dataSelector),
    SupportRequestsCollection.find(role === "Admin" ? {} : { createdBy: actor._id }),
    UsefulFilesCollection.find(dataSelector, { sort: { createdAt: -1 } }),
    AbsencesCollection.find({ userId: { $in: absenceUserIds } }, { sort: { startDate: 1 } }),
  ];
});

Meteor.publish("hlc-events", async function publishHlcEvents() {
  if (!this.userId) return this.ready();
  const actor = await Meteor.users.findOneAsync(this.userId);
  if (!actor || actor.profile?.role === "Admin") return this.ready();
  const presidentId = await getActorPresidentId(actor);
  if (!presidentId) return this.ready();
  return EventsCollection.find({
    presidentId,
    $or: [{ createdBy: actor._id }, { "invitees.userId": actor._id }],
  }, { sort: { startsAt: 1 } });
});

Meteor.publish("hlc-notifications", function publishHlcNotifications() {
  if (!this.userId) {
    return this.ready();
  }

  return NotificationsCollection.find({ recipientId: this.userId }, { sort: { createdAt: -1 } });
});

Meteor.publish("hlc-access-logs", async function publishHlcAccessLogs() {
  if (!this.userId) return this.ready();
  const actor = await Meteor.users.findOneAsync(this.userId, { fields: { profile: 1 } });
  if (actor?.profile?.role !== "Admin") return this.ready();

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  return AccessLogsCollection.find(
    { createdAt: { $gte: twelveMonthsAgo } },
    { sort: { createdAt: -1 } },
  );
});

const buildPatientCasNoteNotification = ({ recipientId, patientId, patientName, noteAuthor, noteText }) => ({
  recipientId,
  type: "patient-cas-note",
  patientId,
  patientName,
  noteAuthor,
  noteText,
  message: `${noteAuthor} ha aggiunto una nota CAS per ${patientName}.`,
  createdAt: new Date(),
  readAt: null,
});

Meteor.publish("hlc-login-messages", async function publishHlcLoginMessages() {
  if (!this.userId) return this.ready();
  const actor = await Meteor.users.findOneAsync(this.userId, { fields: { profile: 1 } });
  if (actor?.profile?.role === "Admin") {
    return LoginMessagesCollection.find({}, { sort: { startDate: -1, createdAt: -1 } });
  }
  if (!["Presidente", "CAS", "GVP"].includes(actor?.profile?.role)) return this.ready();
  const today = new Date().toISOString().slice(0, 10);
  return LoginMessagesCollection.find({ startDate: { $lte: today }, endDate: { $gte: today } }, { sort: { startDate: 1, createdAt: 1 } });
});

Meteor.methods({
  async "hlc.updatePagePermissions"(targetUserId, permissions) {
    requireUser(this);
    check(targetUserId, String);
    check(permissions, Object);
    const president = await Meteor.users.findOneAsync(this.userId, { fields: publicUserFields });
    const actorRole = president?.profile?.role;
    const actorPresidentId = actorRole === "Presidente" ? president._id : await getActorPresidentId(president);
    if (actorRole !== "Presidente" && !getPagePermission({ ...president?.profile, role: actorRole }, "permissions").edit) throw new Meteor.Error("not-authorized", "Non hai il permesso di modificare questa sezione.");
    const target = await Meteor.users.findOneAsync(targetUserId, { fields: publicUserFields });
    const belongsToPresident = target && ["CAS", "GVP"].includes(target.profile?.role) && (target.profile?.presidentId === actorPresidentId || target.profile?.associationId === actorPresidentId);
    if (!belongsToPresident) throw new Meteor.Error("not-authorized", "Utente non disponibile.");
    const allowedPageIds = new Set(MANAGEABLE_PAGES.map(([pageId]) => pageId));
    const normalized = {};
    for (const [pageId, permission] of Object.entries(permissions)) {
      if (!allowedPageIds.has(pageId) || !permission || typeof permission !== "object") continue;
      normalized[pageId] = { view: Boolean(permission.view), edit: Boolean(permission.view && permission.edit) };
    }
    await Meteor.users.updateAsync(targetUserId, { $set: { "profile.pagePermissions": normalized } });
    return true;
  },

  async "hlc.updateRolePagePermissions"(targetRole, permissions) {
    requireUser(this);
    check(targetRole, Match.OneOf("CAS", "GVP"));
    check(permissions, Object);
    const president = await Meteor.users.findOneAsync(this.userId, { fields: publicUserFields });
    const actorRole = president?.profile?.role;
    const actorPresidentId = actorRole === "Presidente" ? president._id : await getActorPresidentId(president);
    if (actorRole !== "Presidente" && !getPagePermission({ ...president?.profile, role: actorRole }, "permissions").edit) throw new Meteor.Error("not-authorized", "Non hai il permesso di modificare questa sezione.");
    const allowedPageIds = new Set(MANAGEABLE_PAGES.map(([pageId]) => pageId));
    const normalized = {};
    for (const [pageId, permission] of Object.entries(permissions)) {
      if (!allowedPageIds.has(pageId) || !permission || typeof permission !== "object") continue;
      normalized[pageId] = { view: Boolean(permission.view), edit: Boolean(permission.view && permission.edit) };
    }
    await Meteor.users.updateAsync({
      "profile.role": targetRole,
      $or: [
        { "profile.presidentId": actorPresidentId },
        { "profile.associationId": actorPresidentId },
      ],
    }, { $set: { "profile.pagePermissions": normalized } }, { multi: true });
    return true;
  },
  async "hlc.createLoginMessage"(data) {
    requireUser(this);
    check(data, { text: String, startDate: String, endDate: String });
    const admin = await Meteor.users.findOneAsync(this.userId, { fields: { profile: 1, username: 1 } });
    if (admin?.profile?.role !== "Admin") throw new Meteor.Error("not-authorized", "Operazione riservata agli amministratori.");
    const text = data.text.trim();
    if (!text || text.length > 4000) throw new Meteor.Error("invalid-message", "Inserisci un messaggio valido (massimo 4000 caratteri).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate) || data.startDate > data.endDate) {
      throw new Meteor.Error("invalid-period", "Il periodo selezionato non è valido.");
    }
    return LoginMessagesCollection.insertAsync({ text, startDate: data.startDate, endDate: data.endDate, createdAt: new Date(), createdBy: admin._id, createdByName: admin.username || "Admin" });
  },

  async "hlc.deleteLoginMessage"(messageId) {
    requireUser(this);
    check(messageId, String);
    const admin = await Meteor.users.findOneAsync(this.userId, { fields: { profile: 1 } });
    if (admin?.profile?.role !== "Admin") throw new Meteor.Error("not-authorized", "Operazione riservata agli amministratori.");
    await LoginMessagesCollection.removeAsync(messageId);
    return true;
  },

  async "hlc.startImpersonation"(targetUserId) {
    requireUser(this);
    clearExpiredImpersonationSessions();
    check(targetUserId, String);
    const admin = await Meteor.users.findOneAsync(this.userId, { fields: publicUserFields });
    if (admin?.profile?.role !== "Admin") {
      throw new Meteor.Error("not-authorized", "Operazione riservata agli amministratori.");
    }
    const target = await Meteor.users.findOneAsync(targetUserId, { fields: publicUserFields });
    if (!target || target.profile?.role === "Admin" || target.profile?.disabled) {
      throw new Meteor.Error("invalid-user", "Utente non disponibile per la modalità assistenza.");
    }
    const impersonationToken = Random.secret();
    const sessionToken = Random.secret();
    impersonationLoginTickets.set(impersonationToken, {
      mode: "start",
      connectionId: this.connection.id,
      adminId: admin._id,
      userId: target._id,
      sessionToken,
      expiresAt: Date.now() + 60_000,
    });
    await AccessLogsCollection.insertAsync({
      userId: admin._id,
      username: admin.username || "Admin",
      role: "Admin",
      action: "impersonation-start",
      targetUserId: target._id,
      targetUsername: target.username || target.profile?.role,
      createdAt: new Date(),
    });
    return { impersonationToken, sessionToken, targetUsername: target.username || target.profile?.role };
  },

  "hlc.getImpersonationStatus"(sessionToken) {
    requireUser(this);
    check(sessionToken, String);
    const session = impersonationSessions.get(sessionToken);
    if (!session || session.targetId !== this.userId || session.expiresAt < Date.now()) {
      impersonationSessions.delete(sessionToken);
      return false;
    }
    impersonationConnectionTokens.set(this.connection.id, sessionToken);
    return true;
  },

  async "hlc.stopImpersonation"(sessionToken) {
    requireUser(this);
    check(sessionToken, String);
    const session = impersonationSessions.get(sessionToken);
    if (!session || session.targetId !== this.userId || session.expiresAt < Date.now()) {
      impersonationSessions.delete(sessionToken);
      throw new Meteor.Error("not-authorized", "Modalità assistenza non attiva.");
    }
    const admin = await Meteor.users.findOneAsync(session.adminId, { fields: publicUserFields });
    if (admin?.profile?.role !== "Admin") {
      impersonationSessions.delete(sessionToken);
      throw new Meteor.Error("not-authorized", "Account amministratore non disponibile.");
    }
    await AccessLogsCollection.insertAsync({
      userId: admin._id,
      username: admin.username || "Admin",
      role: "Admin",
      action: "impersonation-stop",
      targetUserId: session.targetId,
      createdAt: new Date(),
    });
    const restoreToken = Random.secret();
    impersonationLoginTickets.set(restoreToken, {
      mode: "restore",
      connectionId: this.connection.id,
      adminId: admin._id,
      userId: admin._id,
      sessionToken,
      expiresAt: Date.now() + 60_000,
    });
    return { restoreToken };
  },

  "hlc.getPushPublicKey"() {
    requireUser(this);
    if (!vapidPublicKey) throw new Meteor.Error("push-unavailable", "Le notifiche del dispositivo non sono ancora disponibili.");
    return vapidPublicKey;
  },

  async "hlc.savePushSubscription"(subscription) {
    requireUser(this);
    const normalizedSubscription = normalizePushSubscription(subscription);
    await PushSubscriptionsCollection.upsertAsync(
      { "subscription.endpoint": normalizedSubscription.endpoint },
      { $set: { userId: this.userId, subscription: normalizedSubscription, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    );
  },

  async "hlc.removePushSubscription"(endpoint) {
    requireUser(this);
    check(endpoint, String);
    await PushSubscriptionsCollection.removeAsync({ userId: this.userId, "subscription.endpoint": endpoint });
  },

  async "hlc.trackAccess"() {
    requireUser(this);
    const assistanceSession = impersonationSessions.get(impersonationConnectionTokens.get(this.connection.id));
    if (assistanceSession?.targetId === this.userId) return null;
    const actor = await Meteor.users.findOneAsync(this.userId, { fields: publicUserFields });
    const duplicateWindow = new Date(Date.now() - 30 * 60 * 1000);
    const recentAccess = await AccessLogsCollection.findOneAsync({
      userId: this.userId,
      createdAt: { $gte: duplicateWindow },
    });
    if (recentAccess) return recentAccess._id;

    const role = actor?.profile?.role || "Utente";
    const presidentId = role === "Presidente"
      ? actor._id
      : actor?.profile?.presidentId || actor?.profile?.associationId || "";

    return AccessLogsCollection.insertAsync({
      userId: this.userId,
      username: formatUserName(actor?.username || "Utente"),
      role,
      presidentId,
      createdAt: new Date(),
    });
  },

  async "hlc.saveAbsence"(record) {
    requireUser(this);
    check(record, { id: String, startDate: String, endDate: String, note: String });
    const actor = await Meteor.users.findOneAsync(this.userId);
    if (!["Presidente", "CAS", "GVP"].includes(actor?.profile?.role)) {
      throw new Meteor.Error("not-authorized", "Operazione non autorizzata.");
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(record.startDate) || !datePattern.test(record.endDate) || record.endDate < record.startDate) {
      throw new Meteor.Error("invalid-period", "Il periodo di assenza non è valido.");
    }
    const existing = await AbsencesCollection.findOneAsync(record.id);
    if (existing && existing.userId !== this.userId) {
      throw new Meteor.Error("not-authorized", "Non puoi modificare questo periodo.");
    }
    await AbsencesCollection.upsertAsync(record.id, { $set: {
      userId: this.userId,
      username: actor.username,
      startDate: record.startDate,
      endDate: record.endDate,
      note: record.note.trim().slice(0, 500),
      updatedAt: new Date(),
      ...(!existing ? { createdAt: new Date() } : {}),
    } });
  },

  async "hlc.deleteAbsence"(absenceId) {
    requireUser(this);
    check(absenceId, String);
    await AbsencesCollection.removeAsync({ _id: absenceId, userId: this.userId });
  },
  async "hlc.uploadUsefulFile"(file) {
    requireUser(this);
    check(file, { name: String, displayName: String, type: String, size: Number, dataUrl: String });
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    if (!["Presidente", "CAS", "GVP"].includes(role)) {
      throw new Meteor.Error("not-authorized", "Non puoi caricare file utili.");
    }
    const presidentId = role === "Presidente"
      ? actor._id
      : await getActorPresidentId(actor);
    const name = file.name.trim();
    const displayName = file.displayName.trim().slice(0, 120);
    const maxSize = 6 * 1024 * 1024;
    const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (!presidentId || !displayName || !usefulFileExtensions.has(extension) || !usefulFileMimeTypes.has(file.type)) {
      throw new Meteor.Error("invalid-file", "Formato file non supportato.");
    }
    if (file.size <= 0 || file.size > maxSize) {
      throw new Meteor.Error("file-too-large", "Il file non può superare 6 MB.");
    }
    if (!/^data:[a-z0-9.+/-]+;base64,/i.test(file.dataUrl)) {
      throw new Meteor.Error("invalid-file", "Contenuto file non valido.");
    }
    const encodedData = file.dataUrl.slice(file.dataUrl.indexOf(",") + 1);
    const decodedSize = Math.floor((encodedData.length * 3) / 4);
    const hasExpectedSignature = extension === "pdf"
      ? encodedData.startsWith("JVBERi0")
      : ["jpg", "jpeg"].includes(extension)
        ? encodedData.startsWith("/9j/")
        : extension === "png"
          ? encodedData.startsWith("iVBOR")
          : extension === "gif"
            ? encodedData.startsWith("R0lGOD")
            : true;
    if (!hasExpectedSignature || decodedSize <= 0 || decodedSize > maxSize + 2) {
      throw new Meteor.Error("invalid-file", "Contenuto file non valido o troppo grande.");
    }
    await UsefulFilesCollection.insertAsync({
      name,
      displayName,
      type: file.type,
      size: file.size,
      dataUrl: file.dataUrl,
      presidentId,
      createdBy: actor._id,
      createdByUsername: actor.username,
      createdAt: new Date(),
    });
  },

  async "hlc.deleteUsefulFile"(fileId) {
    requireUser(this);
    check(fileId, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    const presidentId = role === "Presidente"
      ? actor._id
      : ["CAS", "GVP"].includes(role) ? await getActorPresidentId(actor) : "";
    const file = await UsefulFilesCollection.findOneAsync(fileId);
    const canDelete = file && file.presidentId === presidentId &&
      (role === "Presidente" || (["CAS", "GVP"].includes(role) && file.createdBy === actor._id));
    if (!canDelete) throw new Meteor.Error("not-authorized", "Non puoi eliminare questo file.");
    await UsefulFilesCollection.removeAsync(fileId);
  },

  async "hlc.addDoctorOperationalNote"(doctorId, text) {
    requireUser(this);
    check(doctorId, String);
    check(text, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    if (!getPagePermission({ ...(actor?.profile || {}), role }, "doctors").view) {
      throw new Meteor.Error("not-authorized", "Non hai il permesso di visualizzare i medici.");
    }
    const presidentId = role === "Presidente" ? actor._id : await getActorPresidentId(actor);
    const doctor = await DoctorsCollection.findOneAsync({ _id: doctorId, presidentId });
    if (!doctor) throw new Meteor.Error("not-found", "Medico non disponibile.");
    const normalizedText = text.trim().slice(0, 4000);
    if (!normalizedText) throw new Meteor.Error("invalid-note", "Inserisci una nota.");
    const note = {
      id: Random.id(),
      text: normalizedText,
      authorId: actor._id,
      author: actor.username || role || "Utente",
      authorRole: role || "",
      createdAt: new Date(),
    };
    await DoctorsCollection.updateAsync(doctorId, { $push: { doctorNotes: note } });
    return note;
  },

  async "hlc.deleteDoctorOperationalNote"(doctorId, noteId) {
    requireUser(this);
    check(doctorId, String);
    check(noteId, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    if (!getPagePermission({ ...(actor?.profile || {}), role }, "doctors").view) {
      throw new Meteor.Error("not-authorized", "Non hai il permesso di visualizzare i medici.");
    }
    const presidentId = role === "Presidente" ? actor._id : await getActorPresidentId(actor);
    const doctor = await DoctorsCollection.findOneAsync({
      _id: doctorId,
      presidentId,
      doctorNotes: { $elemMatch: { id: noteId, authorId: actor._id } },
    });
    if (!doctor) throw new Meteor.Error("not-authorized", "Puoi eliminare soltanto le note inserite da te.");
    await DoctorsCollection.updateAsync(doctorId, {
      $pull: { doctorNotes: { id: noteId, authorId: actor._id } },
    });
  },

  async "hlc.getPatientDetails"(patientId) {
    requireUser(this);
    check(patientId, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    const presidentId = await getActorPresidentId(actor);
    const patient = await PatientsCollection.findOneAsync({
      _id: patientId,
      presidentId,
      ...(role === "GVP" ? { $or: [{ gvpIds: actor._id }, { gvpId: actor._id }] } : {}),
    });
    if (!patient || !["Presidente", "CAS", "GVP"].includes(role)) {
      throw new Meteor.Error("not-authorized", "Paziente non disponibile per il tuo profilo.");
    }
    if (role === "GVP") {
      const sharedFields = await getGvpPatientSharedFields(presidentId);
      const hiddenFields = await getClosedPatientHiddenFields(presidentId);
      return maskClosedPatientFields(pickGvpPatientFields(patient, sharedFields), hiddenFields);
    }
    return maskClosedPatientFields(patient, await getClosedPatientHiddenFields(presidentId));
  },

  async "hlc.updateTransferredPatientNotes"(patientId, transferNotes) {
    requireUser(this);
    check(patientId, String);
    check(transferNotes, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    if (!["Presidente", "CAS"].includes(role) || !getPagePermission({ ...(actor?.profile || {}), role }, "patients").edit) {
      throw new Meteor.Error("not-authorized", "Non hai il permesso di modificare le note del trasferimento.");
    }
    const presidentId = await getActorPresidentId(actor);
    const normalizedNotes = transferNotes.trim();
    if (!normalizedNotes || normalizedNotes.length > 4000) {
      throw new Meteor.Error("invalid-transfer-notes", "Le note del trasferimento devono contenere da 1 a 4000 caratteri.");
    }
    const patient = await PatientsCollection.findOneAsync({ _id: patientId, presidentId, status: "Trasferito" });
    if (!patient) throw new Meteor.Error("patient-not-found", "Paziente trasferito non trovato.");
    const historyEntries = buildPatientChangeHistory({
      existing: { transferNotes: patient.transferNotes },
      updated: { transferNotes: normalizedNotes },
      actor,
    });
    await PatientsCollection.updateAsync(patientId, {
      $set: { transferNotes: normalizedNotes, updatedAt: new Date() },
      ...(historyEntries.length > 0 ? { $push: { changeHistory: { $each: historyEntries } } } : {}),
    });
    return normalizedNotes;
  },

  async "hlc.getGvpPatientSharingSettings"() {
    requireUser(this);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    const canAccessSettings = role === "GVP" || getPagePermission({ ...(actor?.profile || {}), role }, "patient-gvp-sharing").view;
    if (!["Presidente", "CAS", "GVP"].includes(role) || !canAccessSettings) {
      throw new Meteor.Error("not-authorized", "Configurazione non disponibile per il tuo profilo.");
    }
    const presidentId = role === "Presidente" ? actor._id : await getActorPresidentId(actor);
    return getGvpPatientSharedFields(presidentId);
  },

  async "hlc.updateGvpPatientSharingSettings"(fields) {
    requireUser(this);
    check(fields, [String]);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    if (!["Presidente", "CAS", "GVP"].includes(role) || !getPagePermission({ ...(actor?.profile || {}), role }, "patient-gvp-sharing").edit) {
      throw new Meteor.Error("not-authorized", "Non hai il permesso di modificare questa configurazione.");
    }
    const presidentId = role === "Presidente" ? actor._id : await getActorPresidentId(actor);
    const normalized = normalizeGvpPatientSharedFields(fields);
    if (normalized.length !== new Set(fields).size) {
      throw new Meteor.Error("invalid-fields", "La selezione contiene campi non validi.");
    }
    await Meteor.users.updateAsync(presidentId, {
      $set: { "profile.gvpPatientSharedFields": normalized },
    });
    return normalized;
  },

  async "hlc.createEvent"(data) {
    requireUser(this);
    check(data, {
      title: String,
      description: String,
      startsAt: String,
      endsAt: String,
      location: String,
      inviteeIds: [String],
    });
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    if (!["Presidente", "CAS"].includes(role)) {
      throw new Meteor.Error("not-authorized", "Solo Presidente e CAS possono creare eventi.");
    }
    const presidentId = await getActorPresidentId(actor);
    const title = data.title.trim().slice(0, 160);
    const description = data.description.trim().slice(0, 4000);
    const location = data.location.trim().slice(0, 300);
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (!title || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new Meteor.Error("invalid-event", "Inserisci titolo, inizio e fine validi.");
    }
    if (endsAt <= startsAt) {
      throw new Meteor.Error("invalid-event-period", "La fine dell’evento deve essere successiva all’inizio.");
    }
    const requestedIds = [...new Set(data.inviteeIds)].filter((id) => id !== this.userId);
    const inviteeUsers = await Meteor.users.find({
      _id: { $in: requestedIds },
      "profile.role": { $in: ["CAS", "GVP"] },
      $or: [
        { "profile.presidentId": presidentId },
        { "profile.associationId": presidentId },
      ],
    }, { fields: publicUserFields }).fetchAsync();
    if (inviteeUsers.length === 0) {
      throw new Meteor.Error("invitees-required", "Seleziona almeno un CAS o un GVP da invitare.");
    }
    const createdAt = new Date();
    const eventId = await EventsCollection.insertAsync({
      title,
      description,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      location,
      presidentId,
      createdBy: actor._id,
      creatorName: actor.username || role,
      invitees: inviteeUsers.map((user) => ({
        userId: user._id,
        username: user.username || user.profile?.role,
        role: user.profile?.role,
        status: "pending",
        respondedAt: null,
      })),
      createdAt,
      updatedAt: createdAt,
    });
    for (const invitee of inviteeUsers) {
      await insertNotification({
        recipientId: invitee._id,
        type: "event-invitation",
        eventId,
        senderName: actor.username || role,
        message: `${actor.username || role} ti ha invitato all'evento “${title}”.`,
        createdAt: new Date(),
        readAt: null,
      });
    }
    return eventId;
  },

  async "hlc.respondToEvent"(eventId, response) {
    requireUser(this);
    check(eventId, String);
    check(response, Match.OneOf("accepted", "declined"));
    const actor = await Meteor.users.findOneAsync(this.userId);
    if (actor?.profile?.role === "GVP") requirePageEdit(actor, "events");
    const presidentId = await getActorPresidentId(actor);
    const event = await EventsCollection.findOneAsync({
      _id: eventId,
      presidentId,
      "invitees.userId": this.userId,
    });
    if (!event) throw new Meteor.Error("not-authorized", "Invito non disponibile.");
    await EventsCollection.updateAsync(
      { _id: eventId, "invitees.userId": this.userId },
      { $set: {
        "invitees.$.status": response,
        "invitees.$.respondedAt": new Date(),
        updatedAt: new Date(),
      } },
    );
    await NotificationsCollection.updateAsync(
      { recipientId: this.userId, eventId, type: "event-invitation", readAt: null },
      { $set: { readAt: new Date() } },
      { multi: true },
    );
  },

  async "hlc.deleteEvent"(eventId) {
    requireUser(this);
    check(eventId, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const presidentId = await getActorPresidentId(actor);
    const event = await EventsCollection.findOneAsync({
      _id: eventId,
      presidentId,
      createdBy: this.userId,
    });
    if (!event) throw new Meteor.Error("not-authorized", "Puoi eliminare soltanto gli eventi che hai creato.");
    await EventsCollection.removeAsync(eventId);
    await NotificationsCollection.removeAsync({ eventId, type: "event-invitation" });
  },

  async "hlc.addPatientNote"(patientId, noteText) {
    requireUser(this);
    check(patientId, String);
    check(noteText, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const actorRole = actor.profile?.role;
    if (!["Presidente", "CAS", "GVP"].includes(actorRole)) {
      throw new Meteor.Error("not-authorized", "Operazione non autorizzata.");
    }
    const presidentId = actorRole === "Presidente"
      ? actor._id
      : actor.profile?.presidentId ||
        (actorRole === "CAS" ? actor.profile?.associationId : "") || "";
    const patientSelector = {
      _id: patientId,
      presidentId,
      ...(actorRole === "GVP"
        ? { $or: [{ gvpIds: actor._id }, { gvpId: actor._id }] }
        : {}),
    };
    const patient = await PatientsCollection.findOneAsync(patientSelector);
    if (!patient) {
      throw new Meteor.Error("not-authorized", "Paziente non disponibile per il tuo profilo.");
    }
    const normalizedText = noteText.trim().slice(0, 4000);
    if (!normalizedText) {
      throw new Meteor.Error("note-required", "Inserisci una nota.");
    }
    const existingNotes = Array.isArray(patient.gvpNotes)
      ? patient.gvpNotes
      : typeof patient.gvpNotes === "string" && patient.gvpNotes.trim()
        ? [{ id: `legacy-${patientId}`, text: patient.gvpNotes, author: "GVP", authorRole: "GVP", createdAt: null }]
        : [];
    const note = {
      id: `${this.userId}-${Date.now()}`,
      text: normalizedText,
      authorId: this.userId,
      author: actor.username || actorRole,
      authorRole: actorRole,
      createdAt: new Date(),
    };
    await PatientsCollection.updateAsync(patientId, {
      $set: { gvpNotes: [...existingNotes, note] },
    });

    if (actorRole === "GVP") {
      for (const recipientId of getPatientCoordinatorIds(patient)) {
        const recipient = await Meteor.users.findOneAsync(recipientId, { fields: publicUserFields });
        if (!["Presidente", "CAS"].includes(recipient?.profile?.role)) continue;
        await insertNotification(
          buildPatientNoteNotification({
            recipientId: recipient._id,
            patientId: patient._id,
            patientName: `${patient.lastName} ${patient.firstName}`.trim(),
            noteAuthor: actor.username || actorRole,
            noteText: normalizedText,
          }),
        );
      }
    }

    if (["CAS", "Presidente"].includes(actorRole)) {
      const assignedGvpIds = getAssignedGvpIds(patient);
      for (const gvpId of assignedGvpIds) {
        const recipient = await Meteor.users.findOneAsync(gvpId, { fields: publicUserFields });
        if (recipient?.profile?.role !== "GVP") continue;
        await insertNotification(
          buildPatientNoteNotification({
            recipientId: recipient._id,
            patientId: patient._id,
            patientName: `${patient.lastName} ${patient.firstName}`.trim(),
            noteAuthor: actor.username || actorRole,
            noteText: normalizedText,
          }),
        );
      }
    }
  },

  async "hlc.deletePatientNote"(patientId, noteId) {
    requireUser(this);
    check(patientId, String);
    check(noteId, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const actorRole = actor.profile?.role;
    if (!["Presidente", "CAS", "GVP"].includes(actorRole)) {
      throw new Meteor.Error("not-authorized", "Operazione non autorizzata.");
    }
    const presidentId = actorRole === "Presidente"
      ? actor._id
      : actor.profile?.presidentId ||
        (actorRole === "CAS" ? actor.profile?.associationId : "") || "";
    const patient = await PatientsCollection.findOneAsync({
      _id: patientId,
      presidentId,
      ...(actorRole === "GVP"
        ? { $or: [{ gvpIds: actor._id }, { gvpId: actor._id }] }
        : {}),
      gvpNotes: { $elemMatch: { id: noteId, authorId: this.userId } },
    });
    if (!patient) {
      throw new Meteor.Error("not-authorized", "Puoi eliminare soltanto le tue note.");
    }
    await PatientsCollection.updateAsync(patientId, {
      $pull: { gvpNotes: { id: noteId, authorId: this.userId } },
    });
  },

  async "hlc.addPatientCasNote"(patientId, noteText) {
    requireUser(this);
    check(patientId, String);
    check(noteText, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    requirePageEdit(actor, "events");
    requirePageEdit(actor, "events");
    requirePageEdit(actor, "useful-files");
    requirePageEdit(actor, "useful-files");
    const actorRole = actor?.profile?.role;
    if (!["Presidente", "CAS"].includes(actorRole)) {
      throw new Meteor.Error("not-authorized", "Le note CAS sono riservate a CAS e Presidente.");
    }
    const presidentId = actorRole === "Presidente"
      ? actor._id
      : actor.profile?.presidentId || actor.profile?.associationId || "";
    const patient = await PatientsCollection.findOneAsync({ _id: patientId, presidentId });
    if (!patient) throw new Meteor.Error("not-authorized", "Paziente non disponibile per il tuo profilo.");
    const normalizedText = noteText.trim().slice(0, 4000);
    if (!normalizedText) throw new Meteor.Error("note-required", "Inserisci una nota CAS.");
    const note = {
      id: `${this.userId}-${Date.now()}`,
      text: normalizedText,
      authorId: this.userId,
      author: actor.username || actorRole,
      authorRole: actorRole,
      createdAt: new Date(),
    };
    await PatientsCollection.updateAsync(patientId, { $push: { casNotes: note } });
    for (const recipientId of getPatientCoordinatorIds(patient)) {
      if (recipientId === this.userId) continue;
      const recipient = await Meteor.users.findOneAsync(recipientId, { fields: publicUserFields });
      if (!["Presidente", "CAS"].includes(recipient?.profile?.role)) continue;
      await insertNotification(buildPatientCasNoteNotification({
        recipientId: recipient._id,
        patientId: patient._id,
        patientName: `${patient.lastName} ${patient.firstName}`.trim(),
        noteAuthor: actor.username || actorRole,
        noteText: normalizedText,
      }));
    }
  },

  async "hlc.deletePatientCasNote"(patientId, noteId) {
    requireUser(this);
    check(patientId, String);
    check(noteId, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const actorRole = actor?.profile?.role;
    if (!["Presidente", "CAS"].includes(actorRole)) {
      throw new Meteor.Error("not-authorized", "Le note CAS sono riservate a CAS e Presidente.");
    }
    const presidentId = actorRole === "Presidente"
      ? actor._id
      : actor.profile?.presidentId || actor.profile?.associationId || "";
    const patient = await PatientsCollection.findOneAsync({
      _id: patientId,
      presidentId,
      casNotes: { $elemMatch: { id: noteId, authorId: this.userId } },
    });
    if (!patient) throw new Meteor.Error("not-authorized", "Puoi eliminare soltanto le tue note CAS.");
    await PatientsCollection.updateAsync(patientId, { $pull: { casNotes: { id: noteId, authorId: this.userId } } });
  },

  async "hlc.markNotificationAsRead"(notificationId) {
    requireUser(this);
    check(notificationId, String);

    const notification = await NotificationsCollection.findOneAsync({
      _id: notificationId,
      recipientId: this.userId,
    });

    if (!notification) {
      throw new Meteor.Error("not-authorized", "Notifica non disponibile.");
    }

    await NotificationsCollection.updateAsync(notificationId, {
      $set: { readAt: new Date() },
    });
  },

  async "hlc.markNotificationAsUnread"(notificationId) {
    requireUser(this);
    check(notificationId, String);
    const notification = await NotificationsCollection.findOneAsync({
      _id: notificationId,
      recipientId: this.userId,
    });
    if (!notification) {
      throw new Meteor.Error("not-authorized", "Notifica non disponibile.");
    }
    await NotificationsCollection.updateAsync(notificationId, {
      $set: { readAt: null },
    });
  },

  async "hlc.markAllNotificationsAsRead"() {
    requireUser(this);
    await NotificationsCollection.updateAsync(
      { recipientId: this.userId, readAt: null },
      { $set: { readAt: new Date() } },
      { multi: true },
    );
  },

  async "hlc.setPresidentActive"(presidentId, active) {
    requireUser(this);
    check(presidentId, String);
    check(active, Boolean);
    const actor = await Meteor.users.findOneAsync(this.userId);
    if (actor.profile?.role !== "Admin") {
      throw new Meteor.Error("not-authorized", "Operazione riservata agli amministratori.");
    }
    const president = await Meteor.users.findOneAsync(presidentId);
    if (president?.profile?.role !== "Presidente") {
      throw new Meteor.Error("invalid-president", "Presidente non valido.");
    }
    await Meteor.users.updateAsync(
      { $or: [
        { _id: presidentId },
        { "profile.presidentId": presidentId },
        { "profile.associationId": presidentId },
      ] },
      { $set: { "profile.disabled": !active } },
      { multi: true },
    );
  },

  async "hlc.createSupportRequest"(data) {
    requireUser(this);
    check(data, { type: String, subject: String, priority: String, phone: String, message: String });
    const type = ["Segnalazione", "Richiesta"].includes(data.type) ? data.type : "Richiesta";
    const priority = ["Bassa", "Normale", "Alta", "Urgente"].includes(data.priority) ? data.priority : "Normale";
    const subject = data.subject.trim();
    const message = data.message.trim();
    if (!subject || !message) throw new Meteor.Error("invalid-request", "Oggetto e descrizione sono obbligatori.");
    const actor = await Meteor.users.findOneAsync(this.userId);
    if (actor.profile?.role === "GVP") {
      throw new Meteor.Error("not-authorized", "Operazione non disponibile per i GVP.");
    }
    await SupportRequestsCollection.insertAsync({
      type, subject, priority, phone: data.phone.trim(), message, status: "Inviata",
      createdBy: this.userId, createdByUsername: actor.username, createdAt: new Date(),
    });
  },

  async "hlc.updateSupportRequestStatus"(requestId, status) {
    requireUser(this);
    check(requestId, String);
    check(status, String);
    const actor = await Meteor.users.findOneAsync(this.userId);
    if (actor.profile?.role !== "Admin") throw new Meteor.Error("not-authorized", "Operazione riservata agli amministratori.");
    const validStatus = supportRequestStatuses.has(status) ? status : "Inviata";
    await SupportRequestsCollection.updateAsync(requestId, { $set: { status: validStatus } });
  },

  async "hlc.updateMyProfile"(data) {
    requireUser(this);
    check(data, {
      username: String,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      password: String,
      hospitalAssignments: [Object],
    });
    const username = formatUserName(data.username);
    if (!username) {
      throw new Meteor.Error("username-required", "Il nome utente è obbligatorio.");
    }
    const duplicate = await Meteor.users.findOneAsync({
      username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      _id: { $ne: this.userId },
    });
    if (duplicate) {
      throw new Meteor.Error("username-exists", "Il nome utente è già in uso.");
    }
    const actor = await Meteor.users.findOneAsync(this.userId);
    const actorPresidentId = actor.profile?.role === "Presidente"
      ? actor._id
      : actor.profile?.presidentId || actor.profile?.associationId || "";
    const allowedHospitalSelector = actor.profile?.role === "Admin"
      ? {}
      : { presidentId: actorPresidentId };
    const allowedHospitals = await HospitalsCollection.find(allowedHospitalSelector).fetchAsync();
    const requestedHospitalAssignments = actor.profile?.role === "GVP"
      ? actor.profile?.hospitalAssignments || []
      : data.hospitalAssignments;
    const hospitalAssignments = requestedHospitalAssignments.map((assignment) => {
      check(assignment.hospitalId, String);
      check(assignment.departmentIds, [String]);
      const hospital = allowedHospitals.find((item) => item._id === assignment.hospitalId);
      if (!hospital) {
        throw new Meteor.Error("invalid-hospital", "Ospedale non disponibile per il tuo profilo.");
      }
      const validDepartmentIds = assignment.departmentIds.filter((departmentId) =>
        hospital.departments?.some((department) => department.id === departmentId),
      );
      return { hospitalId: assignment.hospitalId, departmentIds: validDepartmentIds };
    });
    const firstAssignment = hospitalAssignments[0];
    await Meteor.users.updateAsync(this.userId, {
      $set: {
        username,
        "profile.firstName": data.firstName.trim(),
        "profile.lastName": data.lastName.trim(),
        "profile.email": data.email.trim(),
        "profile.phone": data.phone.trim(),
        "profile.hospitalAssignments": hospitalAssignments,
        "profile.hospitalId": firstAssignment?.hospitalId || "",
        "profile.departmentId": firstAssignment?.departmentIds[0] || "",
      },
    });
    if (data.password) {
      if (data.password.length < 4) {
        throw new Meteor.Error("password-too-short", "La password deve contenere almeno 4 caratteri.");
      }
      await Accounts.setPasswordAsync(this.userId, data.password, { logout: false });
    }
  },

  async "hlc.replaceRecords"(kind, records) {
    requireUser(this);
    check(kind, Match.OneOf("hospitals", "departments", "doctors", "patients", "presentations"));
    const actor = await Meteor.users.findOneAsync(this.userId);
    requirePageEdit(actor, ({ hospitals: "hospitals", departments: "departments", doctors: "doctors", patients: "patients", presentations: "presentations" })[kind]);
    const role = actor?.profile?.role;
    const presidentId =
      role === "Presidente"
        ? actor._id
        : role === "CAS"
          ? actor.profile.presidentId || actor.profile.associationId
          : null;

    if (role !== "Admin" && !presidentId) {
      throw new Meteor.Error("not-authorized", "Operazione non autorizzata.");
    }
    if (
      presidentId &&
      records.some((record) => record.presidentId !== presidentId)
    ) {
      throw new Meteor.Error("not-authorized", "Dati fuori dalla tua organizzazione.");
    }
    if (kind === "patients" && !this.hlcPatientAssignmentsAlreadyValidated) {
      await validatePatientAssignments(records, presidentId);
    }

    const collections = {
      hospitals: HospitalsCollection,
      departments: DepartmentsCollection,
      doctors: DoctorsCollection,
      patients: PatientsCollection,
      presentations: PresentationsCollection,
    };
    const previousPatientAssignments = new Map();
    const previousPatientCasAssignments = new Map();
    const previousPatientStatuses = new Map();
    let deletedPatients = [];
    if (kind === "patients") {
      const recordIds = records.map((record) => record.id || record._id).filter(Boolean);
      const deletedPatientSelector = {
        ...(presidentId ? { presidentId } : {}),
        _id: { $nin: recordIds },
      };
      deletedPatients = await PatientsCollection.find(deletedPatientSelector, {
        fields: { firstName: 1, lastName: 1, presidentId: 1, casId: 1, casIds: 1, gvpId: 1, gvpIds: 1 },
      }).fetchAsync();
      const previousPatients = await PatientsCollection.find(
        { _id: { $in: recordIds }, ...(presidentId ? { presidentId } : {}) },
        { fields: { casId: 1, casIds: 1, gvpId: 1, gvpIds: 1, status: 1 } },
      ).fetchAsync();
      const previousPatientsById = new Map(previousPatients.map((patient) => [patient._id, patient]));
      for (const record of records) {
        const recordId = record.id || record._id;
        if (!recordId) continue;
        const previous = previousPatientsById.get(recordId);
        const previousIds = getAssignedGvpIds(previous);
        previousPatientAssignments.set(recordId, new Set(previousIds.filter(Boolean)));
        previousPatientCasAssignments.set(recordId, new Set(getAssignedCasIds(previous)));
        previousPatientStatuses.set(recordId, previous?.status || "");
      }
    }
    await replaceRecords(collections[kind], records, { presidentId });

    if (kind === "patients") {
      for (const deletedPatient of deletedPatients) {
        const patientName = `${deletedPatient.lastName || ""} ${deletedPatient.firstName || ""}`.trim();
        for (const recipientId of getPatientDeletionRecipientIds(deletedPatient, this.userId)) {
          const recipient = await Meteor.users.findOneAsync(recipientId, { fields: publicUserFields });
          if (!["Presidente", "CAS", "GVP"].includes(recipient?.profile?.role)) continue;
          await insertNotification({
            recipientId,
            type: "patient-deleted",
            patientId: deletedPatient._id,
            patientName,
            senderName: actor.username || role,
            message: `${actor.username || role} ha eliminato il paziente ${patientName || "selezionato"}.`,
            createdAt: new Date(),
            readAt: null,
          });
        }
      }

      for (const record of records) {
        const recordId = record.id || record._id;
        const previousIds = previousPatientAssignments.get(recordId) || new Set();
        const currentIds = getAssignedGvpIds(record);
        const newlyAssignedIds = [...new Set(currentIds.filter(Boolean))]
          .filter((gvpId) => !previousIds.has(gvpId));
        const removedGvpIds = [...previousIds]
          .filter((gvpId) => !currentIds.includes(gvpId));

        const previousCasIds = previousPatientCasAssignments.get(recordId) || new Set();
        const newlyAssignedCasIds = getAssignedCasIds(record).filter((assignedCasId) => !previousCasIds.has(assignedCasId));
        for (const assignedCasId of role === "Presidente" ? newlyAssignedCasIds : []) {
          const recipient = await Meteor.users.findOneAsync(assignedCasId, { fields: publicUserFields });
          if (recipient?.profile?.role === "CAS") {
            const patientName = `${record.lastName || ""} ${record.firstName || ""}`.trim();
            await insertNotification({
              recipientId: recipient._id,
              type: "patient-assignment",
              patientId: recordId,
              patientName,
              senderName: actor.username || role,
              message: `Ti è stato assegnato il paziente ${patientName || "selezionato"}.`,
              createdAt: new Date(),
              readAt: null,
            });
          }
        }

        for (const gvpId of newlyAssignedIds) {
          const recipient = await Meteor.users.findOneAsync(gvpId, { fields: publicUserFields });
          if (recipient?.profile?.role !== "GVP") continue;
          await insertNotification({
            recipientId: gvpId,
            type: "patient-assignment",
            patientId: recordId,
            patientName: `${record.lastName || ""} ${record.firstName || ""}`.trim(),
            senderName: actor.username || role,
            message: `Ti è stato assegnato il paziente ${`${record.lastName || ""} ${record.firstName || ""}`.trim() || "selezionato"}.`,
            createdAt: new Date(),
            readAt: null,
          });
        }

        for (const gvpId of removedGvpIds) {
          const recipient = await Meteor.users.findOneAsync(gvpId, { fields: publicUserFields });
          if (recipient?.profile?.role !== "GVP") continue;
          const patientName = `${record.lastName || ""} ${record.firstName || ""}`.trim();
          await insertNotification({
            recipientId: gvpId,
            type: "patient-unassignment",
            patientId: recordId,
            patientName,
            senderName: actor.username || role,
            message: `Non sei più assegnato al paziente ${patientName || "selezionato"}.`,
            createdAt: new Date(),
            readAt: null,
          });
        }

        if (record.status === "Deceduto" && previousPatientStatuses.get(recordId) !== "Deceduto") {
          const patientPresidentId = record.presidentId || presidentId;
          const recipient = patientPresidentId
            ? await Meteor.users.findOneAsync(patientPresidentId, { fields: publicUserFields })
            : null;
          if (recipient?.profile?.role === "Presidente") {
            const patientName = `${record.lastName || ""} ${record.firstName || ""}`.trim();
            await insertNotification({
              recipientId: recipient._id,
              type: "patient-deceased",
              patientId: recordId,
              patientName,
              senderName: actor.username || role,
              message: `Il paziente ${patientName || "selezionato"} è stato indicato come deceduto.`,
              createdAt: new Date(),
              readAt: null,
            });
          }
        }
      }
    }
  },

  async "hlc.applyRecordChanges"(kind, changes) {
    requireUser(this);
    check(kind, Match.OneOf("hospitals", "departments", "doctors", "presentations", "hospitality"));
    check(changes, { upserts: [Object], removedIds: [String] });
    const actor = await Meteor.users.findOneAsync(this.userId);
    requirePageEdit(actor, ({ hospitals: "hospitals", departments: "departments", doctors: "doctors", presentations: "presentations", hospitality: "hospitality" })[kind]);
    const role = actor?.profile?.role;
    const presidentId = role === "Presidente"
      ? actor._id
      : ["CAS", "GVP"].includes(role)
        ? await getActorPresidentId(actor)
        : "";
    if (role !== "Admin" && !presidentId) {
      throw new Meteor.Error("not-authorized", "Operazione non autorizzata.");
    }
    if (presidentId && changes.upserts.some((record) => record.presidentId !== presidentId)) {
      throw new Meteor.Error("not-authorized", "Dati fuori dalla tua organizzazione.");
    }
    const collections = {
      hospitals: HospitalsCollection,
      departments: DepartmentsCollection,
      doctors: DoctorsCollection,
      presentations: PresentationsCollection,
      hospitality: HospitalityOffersCollection,
    };
    const collection = collections[kind];
    for (const record of changes.upserts) {
      const cleaned = cleanRecord(record);
      const { _id, ...fields } = cleaned;
      if (!_id) throw new Meteor.Error("invalid-record", "Identificativo record mancante.");
      await collection.upsertAsync(
        { _id, ...(presidentId ? { presidentId } : {}) },
        { $set: fields },
      );
    }
    if (changes.removedIds.length > 0) {
      await collection.removeAsync({
        _id: { $in: [...new Set(changes.removedIds)] },
        ...(presidentId ? { presidentId } : {}),
      });
    }
  },

  async "hlc.applyPatientChanges"(changes) {
    requireUser(this);
    check(changes, { upserts: [Object], removedIds: [String] });
    const actor = await Meteor.users.findOneAsync(this.userId);
    const role = actor?.profile?.role;
    if (role === "Admin") {
      if (changes.upserts.length > 0) throw new Meteor.Error("patient-locked", "L'Admin può soltanto eliminare i pazienti conclusi.");
      const recordsToDelete = await PatientsCollection.find({ _id: { $in: [...new Set(changes.removedIds)] } }).fetchAsync();
      if (recordsToDelete.length !== new Set(changes.removedIds).size || recordsToDelete.some((record) => !CLOSED_PATIENT_STATUSES.includes(record.status))) {
        throw new Meteor.Error("patient-locked", "L'Admin può eliminare soltanto pazienti dimessi, deceduti o trasferiti.");
      }
      if (changes.removedIds.length > 0) await PatientsCollection.removeAsync({ _id: { $in: [...new Set(changes.removedIds)] } });
      return true;
    }
    const presidentId = role === "Presidente"
      ? actor._id
      : role === "CAS"
        ? actor.profile?.presidentId || actor.profile?.associationId || ""
        : "";
    if (!presidentId) throw new Meteor.Error("not-authorized", "Operazione non autorizzata.");
    const closedPatientHiddenFields = await getClosedPatientHiddenFields(presidentId);
    const currentRecords = await PatientsCollection.find({ presidentId }).fetchAsync();
    const recordsById = new Map(currentRecords.map((record) => [record._id, { ...record, id: record._id }]));
    const changedRecords = [];
    const assistanceSession = impersonationSessions.get(impersonationConnectionTokens.get(this.connection?.id));
    const canDeleteClosedPatients = role === "Presidente" || assistanceSession?.targetId === this.userId;
    for (const removedId of changes.removedIds) {
      if (CLOSED_PATIENT_STATUSES.includes(recordsById.get(removedId)?.status) && !canDeleteClosedPatients) {
        throw new Meteor.Error("patient-locked", "Un paziente concluso non può essere modificato o eliminato.");
      }
      recordsById.delete(removedId);
    }
    for (const record of changes.upserts) {
      if (record.presidentId !== presidentId) {
        throw new Meteor.Error("not-authorized", "Dati fuori dalla tua organizzazione.");
      }
      const recordId = record.id || record._id;
      const recordExists = recordsById.has(recordId);
      const existing = recordsById.get(recordId) || {};
      if (CLOSED_PATIENT_STATUSES.includes(existing.status)) {
        throw new Meteor.Error("patient-locked", "Un paziente concluso non può essere modificato o eliminato.");
      }
      const mergedRecord = restoreProtectedPatientFields({
        ...existing,
        ...record,
        id: recordId,
        details: record.details === undefined ? existing.details : record.details,
        departmentHistory: record.departmentHistory === undefined ? existing.departmentHistory : record.departmentHistory,
        notes: record.notes === undefined ? existing.notes : record.notes,
      }, existing, closedPatientHiddenFields);
      const existingHistory = Array.isArray(existing.changeHistory) ? existing.changeHistory : [];
      mergedRecord.changeHistory = recordExists
        ? [...existingHistory, ...buildPatientChangeHistory({ existing, updated: mergedRecord, actor })]
        : [{
            id: Random.id(),
            field: "__created",
            oldValue: "",
            newValue: "Paziente creato",
            changedAt: new Date(),
            changedById: actor._id,
            changedByName: actor.username || `${actor.profile?.firstName || ""} ${actor.profile?.lastName || ""}`.trim() || role,
            changedByRole: role,
          }];
      recordsById.set(recordId, mergedRecord);
      changedRecords.push(mergedRecord);
    }
    await validatePatientAssignments(changedRecords, presidentId);
    this.hlcPatientAssignmentsAlreadyValidated = true;
    try {
      return await Meteor.server.method_handlers["hlc.replaceRecords"].apply(this, ["patients", [...recordsById.values()]]);
    } finally {
      delete this.hlcPatientAssignmentsAlreadyValidated;
    }
  },

  async "hlc.updateCasHospitalAssignments"(casUserId, requestedAssignments) {
    requireUser(this);
    check(casUserId, String);
    check(requestedAssignments, [Object]);
    const actor = await Meteor.users.findOneAsync(this.userId);
    const actorRole = actor?.profile?.role;
    const presidentId = await getActorPresidentId(actor);
    const canManageCas = actorRole === "Presidente" ||
      (actorRole === "CAS" && getPagePermission({ ...actor.profile, role: actorRole }, "cas").edit && casUserId !== actor._id);
    if (!canManageCas || !presidentId) {
      throw new Meteor.Error("not-authorized", "Non puoi modificare i reparti di questo CAS.");
    }
    const casUser = await Meteor.users.findOneAsync({
      _id: casUserId,
      "profile.role": "CAS",
      $or: [
        { "profile.presidentId": presidentId },
        { "profile.associationId": presidentId },
      ],
    });
    if (!casUser) throw new Meteor.Error("not-authorized", "CAS non disponibile.");

    const allowedHospitals = await HospitalsCollection.find({ presidentId }).fetchAsync();
    const hospitalAssignments = requestedAssignments.flatMap((assignment) => {
      check(assignment.hospitalId, String);
      check(assignment.departmentIds, [String]);
      const hospital = allowedHospitals.find((item) => item._id === assignment.hospitalId);
      if (!hospital) return [];
      const validDepartmentIds = [...new Set(assignment.departmentIds)].filter((departmentId) =>
        (hospital.departments || []).some((department) => department.id === departmentId),
      );
      return [{ hospitalId: hospital._id, departmentIds: validDepartmentIds }];
    });
    const firstAssignment = hospitalAssignments[0];
    await Meteor.users.updateAsync(casUserId, { $set: {
      "profile.hospitalAssignments": hospitalAssignments,
      "profile.hospitalId": firstAssignment?.hospitalId || "",
      "profile.departmentId": firstAssignment?.departmentIds[0] || "",
    } });
  },

  async "hlc.syncUsers"(records) {
    requireUser(this);
    check(records, [Object]);

    const actor = await Meteor.users.findOneAsync(this.userId);
    const actorRole = actor?.profile?.role;
    const actorLinkedCasId = actorRole === "GVP"
      ? actor.profile?.casIds?.[0] || actor.profile?.casId || actor.profile?.associationId || ""
      : "";
    const actorLinkedCas = actorLinkedCasId
      ? await Meteor.users.findOneAsync(actorLinkedCasId)
      : null;
    const actorPresidentId =
      actorRole === "Presidente"
        ? actor._id
        : actorRole === "CAS"
          ? actor.profile.presidentId || actor.profile.associationId
          : actorRole === "GVP"
            ? actor.profile.presidentId || actorLinkedCas?.profile?.presidentId || actorLinkedCas?.profile?.associationId ||
              (actorLinkedCas?.profile?.role === "Presidente" ? actorLinkedCas._id : "")
          : "";
    const casCanCreateCas = actorRole === "CAS" && getPagePermission({ ...actor.profile, role: actorRole }, "cas").edit;
    const casCanCreateGvp = actorRole === "CAS" && getPagePermission({ ...actor.profile, role: actorRole }, "gvp").edit;
    const gvpCanCreateGvp = actorRole === "GVP" && getPagePermission({ ...actor.profile, role: actorRole }, "gvp").edit;
    const canManage = (record) => {
      if (actorRole === "Admin") {
        return true;
      }

      if (actorRole === "Presidente") {
        return ["CAS", "GVP"].includes(record.role) && record.presidentId === actor._id;
      }

      if (actorRole === "CAS") {
        return (
          (casCanCreateGvp &&
            record.role === "GVP" &&
            record.presidentId === actorPresidentId) ||
          (casCanCreateCas &&
            record.role === "CAS" &&
            record.id !== actor._id &&
            record.presidentId === actorPresidentId)
        );
      }

      if (actorRole === "GVP") {
        return gvpCanCreateGvp && record.role === "GVP" &&
          record.presidentId === actorPresidentId;
      }

      return false;
    };

    if (!["Admin", "Presidente", "CAS", "GVP"].includes(actorRole)) {
      throw new Meteor.Error("not-authorized", "Non puoi gestire gli utenti.");
    }

    const retainedIds = [];
    for (const record of records) {
      check(record.username, String);
      const username = formatUserName(record.username);
      let account = record.id
        ? await Meteor.users.findOneAsync(record.id)
        : null;
      const isDelegatedCasRecord = actorRole === "CAS" &&
        (account ? account.profile?.role === "CAS" : record.role === "CAS");
      const isDelegatedGvpRecord = ["Presidente", "CAS", "GVP"].includes(actorRole) &&
        (account ? account.profile?.role === "GVP" : record.role === "GVP");
      const requestedGvpCasIds = Array.isArray(record.casIds)
        ? record.casIds
        : record.casId || record.associationId ? [record.casId || record.associationId] : [];
      const delegatedGvpCasIds = [];
      if (isDelegatedGvpRecord) {
        for (const casId of [...new Set(requestedGvpCasIds.filter(Boolean))]) {
          const delegatedCas = await Meteor.users.findOneAsync(casId);
          const delegatedCasPresidentId = delegatedCas?.profile?.presidentId || delegatedCas?.profile?.associationId || "";
          if (delegatedCas?.profile?.role === "CAS" && delegatedCasPresidentId === actorPresidentId) {
            delegatedGvpCasIds.push(casId);
          }
        }
      }
      const delegatedGvpCasId = delegatedGvpCasIds[0] || "";

      // La pubblicazione include anche il gestore e altri utenti di contesto.
      // Non devono essere riscritti durante la sincronizzazione della squadra.
      if (account && !canManage(userView(account))) {
        retainedIds.push(account._id);
        continue;
      }

      const profile = {
        role: isDelegatedCasRecord ? "CAS" : isDelegatedGvpRecord ? "GVP" : record.role,
        presidentId: isDelegatedCasRecord || isDelegatedGvpRecord ? actorPresidentId : record.presidentId || "",
        casId: isDelegatedCasRecord ? "" : isDelegatedGvpRecord ? delegatedGvpCasId : record.casId || "",
        casIds: isDelegatedCasRecord ? [] : isDelegatedGvpRecord
          ? delegatedGvpCasIds
          : record.casIds ?? account?.profile?.casIds ?? [],
        associationId: isDelegatedCasRecord
          ? actorPresidentId
          : isDelegatedGvpRecord
            ? delegatedGvpCasId
          : record.associationId || "",
        hospitalId: record.hospitalId || "",
        departmentId: record.departmentId || "",
        firstName: record.firstName ?? account?.profile?.firstName ?? "",
        lastName: record.lastName ?? account?.profile?.lastName ?? "",
        email: record.email ?? account?.profile?.email ?? "",
        phone: record.phone ?? account?.profile?.phone ?? "",
        hospitalAssignments:
          record.hospitalAssignments ?? account?.profile?.hospitalAssignments ?? [],
        disabled: record.disabled ?? account?.profile?.disabled ?? false,
        canInsertCas: actorRole === "CAS"
          ? account?.profile?.canInsertCas ?? false
          : record.canInsertCas ?? account?.profile?.canInsertCas ?? false,
        canInsertGvp: actorRole === "GVP" || isDelegatedCasRecord
          ? account?.profile?.canInsertGvp ?? false
          : record.canInsertGvp ?? account?.profile?.canInsertGvp ?? false,
        isSecretary: actorRole === "CAS"
          ? account?.profile?.isSecretary ?? false
          : record.isSecretary ?? account?.profile?.isSecretary ?? false,
        casMembership: actorRole === "Admin" && record.role === "Presidente"
          ? String(record.casMembership || "").trim()
          : account?.profile?.casMembership ?? "",
      };

      if (!account) {
        const canCreateCas = casCanCreateCas && record.role === "CAS" && record.presidentId === actorPresidentId;
        if (!canManage(record) && !canCreateCas) {
          throw new Meteor.Error("not-authorized", "Utente fuori dalla tua squadra.");
        }
        if (!record.password) {
          throw new Meteor.Error("password-required", "Password obbligatoria.");
        }
        const newId = await Accounts.createUserAsync({
          username,
          password: record.password,
          profile,
        });
        retainedIds.push(newId);
        continue;
      }

      const changed =
        account.username !== username ||
        JSON.stringify(account.profile || {}) !== JSON.stringify(profile) ||
        Boolean(record.password);
      if (changed) {
        if (!canManage(record)) {
          throw new Meteor.Error("not-authorized", "Utente fuori dalla tua squadra.");
        }
        await Meteor.users.updateAsync(account._id, {
          $set: { username, profile },
        });
        if (record.password) {
          await Accounts.setPasswordAsync(account._id, record.password, {
            logout: false,
          });
        }
      }
      retainedIds.push(account._id);
    }

    const removedUsers = await Meteor.users
      .find({ _id: { $nin: retainedIds } })
      .fetchAsync();
    for (const removedUser of removedUsers) {
      if (removedUser.profile?.role !== "Admin" && canManage(userView(removedUser))) {
        await Meteor.users.removeAsync(removedUser._id);
      }
    }
  },
});

const ensurePerformanceIndexes = async () => {
  await Promise.all([
    PatientsCollection.rawCollection().createIndex({ presidentId: 1, status: 1, lastName: 1 }),
    PatientsCollection.rawCollection().createIndex({ presidentId: 1, casId: 1, status: 1 }),
    PatientsCollection.rawCollection().createIndex({ presidentId: 1, casIds: 1, status: 1 }),
    PatientsCollection.rawCollection().createIndex({ presidentId: 1, gvpIds: 1, status: 1 }),
    PatientsCollection.rawCollection().createIndex({ presidentId: 1, admissionDate: 1 }),
    DoctorsCollection.rawCollection().createIndex({ presidentId: 1, lastName: 1, firstName: 1 }),
    HospitalityOffersCollection.rawCollection().createIndex({ presidentId: 1, hostName: 1 }),
    PresentationsCollection.rawCollection().createIndex({ presidentId: 1, presentationDate: -1 }),
    EventsCollection.rawCollection().createIndex({ presidentId: 1, createdBy: 1, startsAt: 1 }),
    EventsCollection.rawCollection().createIndex({ presidentId: 1, "invitees.userId": 1, startsAt: 1 }),
    NotificationsCollection.rawCollection().createIndex({ recipientId: 1, readAt: 1, createdAt: -1 }),
    AbsencesCollection.rawCollection().createIndex({ userId: 1, startDate: 1, endDate: 1 }),
    LoginMessagesCollection.rawCollection().createIndex({ startDate: 1, endDate: 1 }),
    Meteor.users.rawCollection().createIndex({ "profile.presidentId": 1, "profile.role": 1 }),
    Meteor.users.rawCollection().createIndex({ "profile.associationId": 1, "profile.role": 1 }),
  ]);
};

Meteor.startup(async () => {
  await ensurePerformanceIndexes();
  await initializeWebPush();
  const adminUsername = formatUserName(
    process.env.HLC_ADMIN_USERNAME || "marco.mattiazzo",
  );
  const existingAdmin = await Accounts.findUserByUsername(adminUsername);

  if (!existingAdmin) {
    if (Meteor.isProduction && !process.env.HLC_ADMIN_PASSWORD) {
      throw new Error(
        "In produzione devi configurare la variabile HLC_ADMIN_PASSWORD.",
      );
    }
    const password = process.env.HLC_ADMIN_PASSWORD || "1234";
    await Accounts.createUserAsync({
      username: adminUsername,
      password,
      profile: {
        role: "Admin",
        presidentId: "",
        casId: "",
        associationId: "",
        hospitalId: "",
        departmentId: "",
      },
    });

    if (!process.env.HLC_ADMIN_PASSWORD) {
      console.warn(
        "HLC_ADMIN_PASSWORD non configurata: viene usata la password di sviluppo predefinita.",
      );
    }
  }

  const users = await Meteor.users.find({}, { fields: { username: 1 } }).fetchAsync();
  for (const user of users) {
    const formattedUsername = formatUserName(user.username);
    if (formattedUsername && formattedUsername !== user.username) {
      await Meteor.users.updateAsync(user._id, { $set: { username: formattedUsername } });
    }
  }

  // Keep this function referenced during development for easy server-side inspection.
  void userView;

  await sendScheduledAdmissionReminders();
  Meteor.setInterval(() => {
    sendScheduledAdmissionReminders().catch((error) => {
      console.error("Impossibile controllare i promemoria dei ricoveri programmati.", error);
    });
  }, 60 * 60 * 1000);
});
