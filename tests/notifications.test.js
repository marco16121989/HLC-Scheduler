import assert from "assert";
import {
  buildPatientNoteNotification,
  canReceiveEmailNotification,
  getAssignedGvpIds,
  getPatientDeletionRecipientIds,
  getPatientCoordinatorIds,
  isNewCasAssignment,
  normalizePushSubscription,
  validateEmailSettings,
} from "../server/main.js";

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

describe("push subscriptions", function () {
  it("accepts browser-specific extra fields and normalizes the stored value", function () {
    const subscription = normalizePushSubscription({
      endpoint: "https://push.example/subscription",
      expirationTime: null,
      keys: { p256dh: "public-key", auth: "auth-secret", browserExtra: "ignored" },
      browserExtra: true,
    });

    assert.deepStrictEqual(subscription, {
      endpoint: "https://push.example/subscription",
      expirationTime: null,
      keys: { p256dh: "public-key", auth: "auth-secret" },
    });
  });

  it("accepts a missing optional expiration time", function () {
    const subscription = normalizePushSubscription({
      endpoint: "https://push.example/subscription",
      keys: { p256dh: "public-key", auth: "auth-secret" },
    });

    assert.strictEqual(subscription.expirationTime, null);
  });

  it("finds the assigned GVP when a legacy assignment coexists with an empty list", function () {
    assert.deepStrictEqual(getAssignedGvpIds({ gvpIds: [], gvpId: "gvp-1" }), ["gvp-1"]);
  });

  it("notifies every unique assigned GVP", function () {
    assert.deepStrictEqual(
      getAssignedGvpIds({ gvpIds: ["gvp-1", "gvp-2"], gvpId: "gvp-1" }),
      ["gvp-1", "gvp-2"],
    );
  });

  it("treats the President and CAS as patient notification coordinators", function () {
    assert.deepStrictEqual(
      getPatientCoordinatorIds({ casId: "cas-1", presidentId: "president-1" }),
      ["cas-1", "president-1"],
    );
  });

  it("detects a new CAS assignment independently from GVP assignments", function () {
    assert.strictEqual(isNewCasAssignment("", "cas-1"), true);
    assert.strictEqual(isNewCasAssignment("cas-1", "cas-1"), false);
    assert.strictEqual(isNewCasAssignment("cas-1", "cas-2"), true);
  });

  it("notifies involved users of deletion but excludes the acting CAS", function () {
    assert.deepStrictEqual(
      getPatientDeletionRecipientIds({
        presidentId: "president-1",
        casId: "cas-1",
        gvpIds: ["gvp-1", "gvp-2"],
      }, "cas-1"),
      ["president-1", "gvp-1", "gvp-2"],
    );
  });
});

describe("email settings", function () {
  it("normalizes SMTP addresses and text fields", function () {
    assert.deepStrictEqual(validateEmailSettings({
      host: " smtp.example.com ",
      port: 587,
      secure: false,
      username: " account@example.com ",
      fromName: " HLC Scheduler ",
      fromEmail: " Sender@Example.com ",
      replyTo: " Reply@Example.com ",
    }), {
      host: "smtp.example.com",
      port: 587,
      secure: false,
      username: "account@example.com",
      fromName: "HLC Scheduler",
      fromEmail: "sender@example.com",
      replyTo: "reply@example.com",
    });
  });

  it("rejects invalid SMTP ports and sender addresses", function () {
    const valid = { host: "smtp.example.com", port: 587, secure: false, username: "user", fromName: "HLC", fromEmail: "sender@example.com", replyTo: "" };
    assert.throws(() => validateEmailSettings({ ...valid, port: 70000 }));
    assert.throws(() => validateEmailSettings({ ...valid, fromEmail: "invalid" }));
  });
});

describe("notification emails", function () {
  it("requires both a valid recipient email and explicit consent", function () {
    assert.strictEqual(canReceiveEmailNotification({ email: "user@example.com", emailNotifications: true }), true);
    assert.strictEqual(canReceiveEmailNotification({ email: "user@example.com", emailNotifications: false }), false);
    assert.strictEqual(canReceiveEmailNotification({ email: "", emailNotifications: true }), false);
    assert.strictEqual(canReceiveEmailNotification({ email: "invalid", emailNotifications: true }), false);
  });
});
