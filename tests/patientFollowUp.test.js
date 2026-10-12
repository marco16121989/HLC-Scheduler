import assert from "assert";
import {
  canViewPatientFollowUp, getFollowUpPatientSelector, getPatientsForView,
  isFollowUpPatient, NON_FOLLOW_UP_PATIENT_SELECTOR,
  formatFollowUpActivationDate, getFollowUpActivationDate, withFollowUpActivationDate,
} from "../imports/api/patientFollowUp.js";
import { getPagePermission } from "../imports/constants/pagePermissions.js";

const patient = {
  id: "patient-1", presidentId: "pres-1", status: "Dimesso", followUpEnabled: true,
  firstName: "Mario", lastName: "Rossi", casIds: ["cas-1", "cas-2"],
  details: { elderAddress: "Indirizzo completo" }, notes: "Note del paziente",
};
const cas = { id: "cas-1", role: "CAS", presidentId: "pres-1" };

describe("follow up patient visibility", function () {
  it("allows the organization's president and every assigned CAS", function () {
    assert.strictEqual(canViewPatientFollowUp({ id: "pres-1", role: "Presidente" }, patient), true);
    assert.strictEqual(canViewPatientFollowUp(cas, patient), true);
    assert.strictEqual(canViewPatientFollowUp({ ...cas, id: "cas-2" }, patient), true);
  });

  it("supports legacy CAS assignments and Meteor account profiles", function () {
    const account = { _id: "cas-1", profile: { role: "CAS", associationId: "pres-1" } };
    assert.strictEqual(canViewPatientFollowUp(account, { ...patient, casIds: [], casId: "cas-1" }), true);
    assert.deepStrictEqual(getFollowUpPatientSelector(account), {
      presidentId: "pres-1", status: "Dimesso", followUpEnabled: true,
      $or: [{ casIds: "cas-1" }, { casId: "cas-1" }],
    });
  });

  it("denies unassigned CAS, other organizations, GVP and Admin", function () {
    for (const user of [
      { ...cas, id: "cas-other" }, { ...cas, presidentId: "pres-other" },
      { id: "pres-other", role: "Presidente" },
      { ...cas, role: "GVP" }, { ...cas, role: "Admin" }, null,
    ]) assert.strictEqual(canViewPatientFollowUp(user, patient), false);
    for (const role of ["GVP", "Admin"]) {
      assert.deepStrictEqual(getFollowUpPatientSelector({ ...cas, role }), { _id: null });
      assert.strictEqual(getPagePermission({ role, pagePermissions: { "follow-up": { view: true } } }, "follow-up").view, false);
    }
  });

  it("shows authorized follow up in both lists without losing patient data", function () {
    const ordinary = { ...patient, id: "ordinary", followUpEnabled: false };
    const otherCasPatient = { ...patient, id: "other", casIds: ["cas-other"] };
    const records = [patient, ordinary, otherCasPatient];
    assert.deepStrictEqual(getPatientsForView(records, cas, "pres-1", false), [patient, ordinary]);
    assert.deepStrictEqual(getPatientsForView(records, cas, "pres-1", true), [patient]);
    assert.strictEqual(getPatientsForView(records, cas, "pres-1", true)[0], patient);
    assert.deepStrictEqual(getPatientsForView(records, { id: "pres-1", role: "Presidente" }, "pres-1", true), [patient, otherCasPatient]);
    assert.deepStrictEqual(getPatientsForView(records, { id: "pres-1", role: "Presidente" }, "pres-1", false), records);
    assert.deepStrictEqual(getPatientsForView(records, { ...cas, role: "GVP" }, "pres-1", false), [ordinary]);
    assert.deepStrictEqual(getPatientsForView(records, { ...cas, role: "GVP" }, "pres-1", true), []);
  });

  it("includes only discharged patients with explicitly activated follow up", function () {
    assert.strictEqual(isFollowUpPatient(patient), true);
    for (const status of ["Ricoverato", "Deceduto", "Trasferito"]) {
      assert.strictEqual(isFollowUpPatient({ ...patient, status }), false);
    }
    for (const followUpEnabled of [false, undefined, "true", 1]) {
      assert.strictEqual(isFollowUpPatient({ ...patient, followUpEnabled }), false);
    }
    assert.deepStrictEqual(NON_FOLLOW_UP_PATIENT_SELECTOR, { $nor: [{ status: "Dimesso", followUpEnabled: true }] });
  });
});

describe("follow up activation dates", function () {
  it("records the server date on activation and ignores a client-supplied date", function () {
    const now = new Date("2026-10-12T09:30:00Z");
    const activated = withFollowUpActivationDate(
      { ...patient, followUpActivatedAt: new Date("2000-01-01") },
      { ...patient, status: "Ricoverato", followUpEnabled: false }, now,
    );
    assert.strictEqual(activated.followUpActivatedAt, now);
    assert.strictEqual(withFollowUpActivationDate(patient, null, now).followUpActivatedAt, now);
  });

  it("preserves an existing activation date across later saves", function () {
    const activatedAt = new Date("2026-10-01T09:30:00Z");
    const updated = withFollowUpActivationDate(patient, { ...patient, followUpActivatedAt: activatedAt });
    assert.deepStrictEqual(updated.followUpActivatedAt, activatedAt);
    assert.strictEqual(withFollowUpActivationDate({ ...patient, followUpEnabled: false }, patient).followUpActivatedAt, null);
  });

  it("recovers legacy dates only from documented activations", function () {
    const activatedAt = new Date("2026-10-10T08:00:00Z");
    const legacy = { ...patient, changeHistory: [
      { field: "followUpEnabled", oldValue: "false", newValue: "true", changedAt: activatedAt },
      { field: "notes", newValue: "Aggiornamento", changedAt: new Date("2026-10-11") },
    ] };
    assert.deepStrictEqual(getFollowUpActivationDate(legacy), activatedAt);
    assert.strictEqual(getFollowUpActivationDate(patient), null);
    assert.strictEqual(withFollowUpActivationDate(patient, patient).followUpActivatedAt, null);
    assert.strictEqual(getFollowUpActivationDate({ ...patient, changeHistory: {} }), null);
  });

  it("formats dates in Rome time and handles missing or invalid dates", function () {
    assert.strictEqual(formatFollowUpActivationDate("2026-10-11T22:30:00Z"), "12/10/2026");
    assert.strictEqual(formatFollowUpActivationDate(null), "Non disponibile");
    assert.strictEqual(formatFollowUpActivationDate("invalid"), "Non disponibile");
  });
});
