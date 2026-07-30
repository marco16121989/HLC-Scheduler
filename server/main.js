import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { check, Match } from "meteor/check";
import {
  DoctorsCollection,
  HospitalsCollection,
  PatientsCollection,
} from "/imports/api/links";

const publicUserFields = {
  username: 1,
  profile: 1,
};

const requireUser = (context) => {
  if (!context.userId) {
    throw new Meteor.Error("not-authorized", "Devi effettuare l'accesso.");
  }
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
    await collection.upsertAsync(_id, { $set: fields });
  }
};

const userView = (user) => ({
  id: user._id,
  username: user.username,
  ...(user.profile || {}),
});

Meteor.publish("hlc-data", async function publishHlcData() {
  if (!this.userId) {
    return this.ready();
  }

  const actor = await Meteor.users.findOneAsync(this.userId);
  const role = actor?.profile?.role;
  const presidentId =
    role === "Presidente"
      ? actor._id
      : role === "CAS"
        ? actor.profile.presidentId || actor.profile.associationId
        : null;
  const dataSelector = presidentId ? { presidentId } : role === "Admin" ? {} : { _id: null };
  const userSelector =
    role === "Admin"
      ? {}
      : presidentId
        ? {
            $or: [
              { _id: actor._id },
              { "profile.presidentId": presidentId },
              { "profile.associationId": presidentId },
            ],
          }
        : { _id: actor._id };

  return [
    Meteor.users.find(userSelector, { fields: publicUserFields }),
    HospitalsCollection.find(dataSelector),
    DoctorsCollection.find(dataSelector),
    PatientsCollection.find(dataSelector),
  ];
});

Meteor.methods({
  async "hlc.replaceRecords"(kind, records) {
    requireUser(this);
    check(kind, Match.OneOf("hospitals", "doctors", "patients"));
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
      doctors: DoctorsCollection,
      patients: PatientsCollection,
    };
    await replaceRecords(collections[kind], records, { presidentId });
  },

  async "hlc.syncUsers"(records) {
    requireUser(this);
    check(records, [Object]);

    const actor = await Meteor.users.findOneAsync(this.userId);
    const actorRole = actor?.profile?.role;
    const actorPresidentId =
      actorRole === "Presidente"
        ? actor._id
        : actorRole === "CAS"
          ? actor.profile.presidentId || actor.profile.associationId
          : "";
    const canManage = (record) =>
      actorRole === "Admin" ||
      (actorRole === "Presidente" &&
        ["CAS", "GVP"].includes(record.role) &&
        record.presidentId === actor._id) ||
      (actorRole === "CAS" &&
        record.role === "GVP" &&
        record.casId === actor._id &&
        record.presidentId === actorPresidentId);

    if (!["Admin", "Presidente", "CAS"].includes(actorRole)) {
      throw new Meteor.Error("not-authorized", "Non puoi gestire gli utenti.");
    }

    const retainedIds = [];
    for (const record of records) {
      check(record.username, String);
      const username = record.username.trim().toLowerCase();
      const profile = {
        role: record.role,
        presidentId: record.presidentId || "",
        casId: record.casId || "",
        associationId: record.associationId || "",
        hospitalId: record.hospitalId || "",
        departmentId: record.departmentId || "",
      };
      let account = record.id
        ? await Meteor.users.findOneAsync(record.id)
        : null;

      if (!account) {
        if (!canManage(record)) {
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
        if (!canManage(record) || !canManage(userView(account))) {
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
  const adminUsername = (
    process.env.HLC_ADMIN_USERNAME || "marco.mattiazzo"
  ).toLowerCase();
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

  // Keep this function referenced during development for easy server-side inspection.
  void userView;
});
