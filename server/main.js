import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { check, Match } from "meteor/check";
import {
  AbsencesCollection,
  DepartmentsCollection,
  DoctorsCollection,
  HospitalsCollection,
  NotificationsCollection,
  PatientsCollection,
  PresentationsCollection,
  SupportRequestsCollection,
  UsefulFilesCollection,
} from "/imports/api/links";
import { formatUserName } from "/imports/utils/formatUserName";
import { DEFAULT_DEPARTMENT_NAMES } from "/imports/constants/departments";

const usefulFileExtensions = new Set([
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "odt", "rtf", "txt",
  "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp", "zip",
]);
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

const requireUser = (context) => {
  if (!context.userId) {
    throw new Meteor.Error("not-authorized", "Devi effettuare l'accesso.");
  }
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
    await collection.upsertAsync(_id, { $set: fields });
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
      : role === "GVP" && !actor.profile?.canInsertGvp
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
    return [
      Meteor.users.find(userSelector, { fields: publicUserFields }),
      PatientsCollection.find(
        { presidentId, $or: [{ gvpIds: actor._id }, { gvpId: actor._id }] },
        { fields: {
          presidentId: 1,
          casId: 1,
          gvpId: 1,
          gvpIds: 1,
          firstName: 1,
          lastName: 1,
          admissionDate: 1,
          dischargeDate: 1,
          admissionType: 1,
          status: 1,
          transferNotes: 1,
          departmentHistory: 1,
          gvpNotes: 1,
          "details.sex": 1,
          "details.maidenName": 1,
          "details.congregation": 1,
          "details.age": 1,
          "details.patientPhone": 1,
          "details.healthProblems": 1,
          "details.spiritualCondition": 1,
          "details.nonWitnessFamily": 1,
          "details.datCompleted": 1,
          "details.datRegistered": 1,
          "details.elderName": 1,
          "details.elderEmail": 1,
          "details.elderPhone": 1,
          "details.simplifiedNotes": 1,
        } },
      ),
      UsefulFilesCollection.find({ presidentId }, { sort: { createdAt: -1 } }),
      AbsencesCollection.find({ userId: actor._id }, { sort: { startDate: 1 } }),
    ];
  }

  const absenceUserIds = ["Presidente", "CAS"].includes(role)
    ? (await Meteor.users.find(userSelector, { fields: { _id: 1 } }).fetchAsync()).map((user) => user._id)
    : [actor._id];

  return [
    Meteor.users.find(userSelector, { fields: publicUserFields }),
    HospitalsCollection.find(dataSelector),
    DepartmentsCollection.find(dataSelector),
    DoctorsCollection.find(dataSelector),
    PatientsCollection.find(dataSelector),
    // Le presentazioni sono eventi condivisi e visibili a tutti gli utenti autenticati.
    PresentationsCollection.find({}),
    SupportRequestsCollection.find(role === "Admin" ? {} : { createdBy: actor._id }),
    UsefulFilesCollection.find(dataSelector, { sort: { createdAt: -1 } }),
    AbsencesCollection.find({ userId: { $in: absenceUserIds } }, { sort: { startDate: 1 } }),
  ];
});

Meteor.publish("hlc-notifications", function publishHlcNotifications() {
  if (!this.userId) {
    return this.ready();
  }

  return NotificationsCollection.find({ recipientId: this.userId }, { sort: { createdAt: -1 } });
});

Meteor.methods({
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
    if (!["Presidente", "CAS"].includes(role)) {
      throw new Meteor.Error("not-authorized", "Non puoi caricare file utili.");
    }
    const presidentId = role === "Presidente"
      ? actor._id
      : actor.profile?.presidentId || actor.profile?.associationId || "";
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
      : role === "CAS"
        ? actor.profile?.presidentId || actor.profile?.associationId || ""
        : "";
    const file = await UsefulFilesCollection.findOneAsync(fileId);
    const canDelete = file && file.presidentId === presidentId &&
      (role === "Presidente" || (role === "CAS" && file.createdBy === actor._id));
    if (!canDelete) throw new Meteor.Error("not-authorized", "Non puoi eliminare questo file.");
    await UsefulFilesCollection.removeAsync(fileId);
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

    if (actorRole === "GVP" && patient.casId) {
      const recipient = await Meteor.users.findOneAsync(patient.casId);
      if (recipient) {
        await NotificationsCollection.insertAsync(
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
    const validStatus = ["Inviata", "In lavorazione", "Risolta", "Chiusa"].includes(status) ? status : "Inviata";
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

    const collections = {
      hospitals: HospitalsCollection,
      departments: DepartmentsCollection,
      doctors: DoctorsCollection,
      patients: PatientsCollection,
      presentations: PresentationsCollection,
    };
    await replaceRecords(collections[kind], records, { presidentId });
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
    const casCanCreateCas = actorRole === "CAS" && actor.profile?.canInsertCas === true;
    const casCanCreateGvp = actorRole === "CAS" && actor.profile?.canInsertGvp === true;
    const gvpCanCreateGvp = actorRole === "GVP" && actor.profile?.canInsertGvp === true;
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

Meteor.startup(async () => {
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
});
