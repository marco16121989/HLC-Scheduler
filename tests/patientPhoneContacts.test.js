import assert from "assert";
import { preparePatientPhoneContacts, removesPatientPhoneNumber } from "../imports/api/patientPhoneContacts.js";

describe("patient phone contacts", function () {
  it("detects clearing the patient number and removing additional contacts", function () {
    const details = { patientPhone: "111", phoneContacts: [{ id: "one", name: "Mario", phone: "222" }] };
    assert.strictEqual(removesPatientPhoneNumber(details, { patientPhone: "" }), true);
    assert.strictEqual(removesPatientPhoneNumber(details, { phoneContacts: [] }), true);
    assert.strictEqual(removesPatientPhoneNumber(details, { patientPhone: "333" }), false);
    assert.strictEqual(removesPatientPhoneNumber(details, { phoneContacts: [{ id: "one", name: "Mario", phone: "333" }] }), false);
    assert.strictEqual(removesPatientPhoneNumber({}, { phoneContacts: [{ id: "new", name: "Mario", phone: "222" }] }), false);
  });

  it("requires confirmation when clearing the elder number but allows editing it", function () {
    const details = { elderName: "Mario", elderPhone: "222" };
    assert.strictEqual(removesPatientPhoneNumber(details, { elderPhone: "" }), true);
    assert.strictEqual(removesPatientPhoneNumber(details, { elderName: "Mario Rossi", elderPhone: "333" }), false);
  });
  it("supports existing patients without additional contacts", function () {
    assert.deepStrictEqual(preparePatientPhoneContacts(undefined), { contacts: [], valid: true });
  });

  it("preserves mobile prefixes, names and contact identities", function () {
    assert.deepStrictEqual(preparePatientPhoneContacts([{ id: "one", name: " Mario Rossi ", phone: " +39 333 1234567 " }]), {
      contacts: [{ id: "one", name: "Mario Rossi", phone: "+39 333 1234567" }], valid: true,
    });
  });

  it("rejects partially completed contacts", function () {
    assert.strictEqual(preparePatientPhoneContacts([{ name: "Mario", phone: "" }]).valid, false);
    assert.strictEqual(preparePatientPhoneContacts([{ name: "", phone: "3331234567" }]).valid, false);
  });

  it("ignores empty added rows without changing the original contacts", function () {
    const contacts = [{ id: "empty", name: " ", phone: "" }, { id: "one", name: " Mario ", phone: "3331234567" }];
    assert.strictEqual(preparePatientPhoneContacts(contacts).contacts.length, 1);
    assert.strictEqual(contacts[1].name, " Mario ");
  });
});
