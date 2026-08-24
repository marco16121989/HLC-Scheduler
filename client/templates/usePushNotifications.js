import { Meteor } from "meteor/meteor";
import { useCallback, useEffect, useState } from "react";

const callAsync = (method, ...args) => new Promise((resolve, reject) => {
  Meteor.call(method, ...args, (error, result) => error ? reject(error) : resolve(result));
});

const decodePublicKey = (value) => {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = globalThis.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...binary].map((character) => character.charCodeAt(0)));
};

export const usePushNotifications = (userId) => {
  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in globalThis && "Notification" in globalThis;
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState(() => supported ? Notification.permission : "unsupported");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!supported || !userId) return undefined;
    navigator.serviceWorker.register("/service-worker.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (subscription) {
          await callAsync("hlc.savePushSubscription", subscription.toJSON());
        }
        if (active) setEnabled(Boolean(subscription));
      })
      .catch(() => { if (active) setError("Impossibile inizializzare le notifiche del dispositivo."); });
    setPermission(Notification.permission);
    return () => { active = false; };
  }, [supported, userId]);

  const enable = useCallback(async () => {
    if (!supported) return;
    setBusy(true); setError("");
    try {
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);
      if (requestedPermission !== "granted") throw new Error("Autorizzazione alle notifiche non concessa.");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const publicKey = await callAsync("hlc.getPushPublicKey");
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodePublicKey(publicKey) });
      await callAsync("hlc.savePushSubscription", subscription.toJSON());
      setEnabled(true);
    } catch (reason) {
      setError(reason?.reason || reason?.message || "Impossibile attivare le notifiche.");
    } finally { setBusy(false); }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true); setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await callAsync("hlc.removePushSubscription", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch (reason) {
      setError(reason?.reason || reason?.message || "Impossibile disattivare le notifiche.");
    } finally { setBusy(false); }
  }, [supported]);

  const detach = useCallback(async () => {
    if (!supported || !userId) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      try {
        await callAsync("hlc.removePushSubscription", subscription.endpoint);
      } catch (error) {
        await subscription.unsubscribe().catch(() => {});
        setEnabled(false);
        throw error;
      }
    }
    if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge().catch(() => {});
    }
  }, [supported, userId]);

  return { supported, enabled, permission, busy, error, enable, disable, detach };
};
