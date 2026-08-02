import assert from "assert";
import { buildPatientNoteNotification } from "../server/main.js";

describe("patient note notifications", function () {
  it("builds a notification for the CAS recipient", function () {
    const notification = buildPatientNoteNotification({
      recipientId: "cas-1",
      patientId: "patient-1",
      patientName: "Mario Rossi",
      noteAuthor: "GVP Demo",
      noteText: "Nuova nota",
    });

    assert.strictEqual(notification.recipientId, "cas-1");
    assert.strictEqual(notification.type, "patient-note");
    assert.strictEqual(notification.patientId, "patient-1");
    assert.match(notification.message, /Mario Rossi/);
    assert.strictEqual(notification.readAt, null);
  });
});
