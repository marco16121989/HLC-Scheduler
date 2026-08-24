import assert from "assert";
import { buildPatientNoteNotification, getAssignedGvpIds, normalizePushSubscription } from "../server/main.js";

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
});
