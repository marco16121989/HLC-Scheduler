self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "Nuova notifica" }; }
  const showNotification = self.registration.showNotification(data.title || "HLC Scheduler", {
      body: data.body || "Hai ricevuto una nuova notifica.",
      icon: "/images/hlc-app-icon.png",
      badge: "/images/hlc-app-icon.png",
      tag: data.notificationId || undefined,
      data: { url: data.url || "/" },
    });
  const updateBadge = Number.isInteger(data.badgeCount) && "setAppBadge" in self.navigator
    ? self.navigator.setAppBadge(data.badgeCount)
    : Promise.resolve();
  event.waitUntil(Promise.all([showNotification, updateBadge]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) return existing.focus().then(() => existing.navigate(targetUrl));
    return clients.openWindow(targetUrl);
  }));
});
