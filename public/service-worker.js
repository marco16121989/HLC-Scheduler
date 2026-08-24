self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "Nuova notifica" }; }
  event.waitUntil(self.registration.showNotification(data.title || "HLC Scheduler", {
    body: data.body || "Hai ricevuto una nuova notifica.",
    icon: "/images/hlc-scheduler-logo.png",
    badge: "/images/hlc-scheduler-logo.png",
    tag: data.notificationId || undefined,
    data: { url: data.url || "/" },
  }));
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
