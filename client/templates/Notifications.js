import { useState } from "react";
import { Meteor } from "meteor/meteor";

const getSender = (notification) => notification.noteAuthor || notification.senderName || "Sistema";
const getDateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const Notifications = ({ notifications }) => {
  const [senderFilter, setSenderFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const senders = [...new Set(notifications.map(getSender))].sort((first, second) => first.localeCompare(second));
  const filteredNotifications = notifications.filter((notification) =>
    (senderFilter === "all" || getSender(notification) === senderFilter) &&
    (!dateFilter || getDateKey(notification.createdAt) === dateFilter),
  );
  const markRead = (notificationId) => Meteor.call("hlc.markNotificationAsRead", notificationId);
  const markUnread = (notificationId) => Meteor.call("hlc.markNotificationAsUnread", notificationId);

  return <>
    <div className="app-content-header"><div className="container-fluid"><h1 className="mb-0">Notifiche</h1></div></div>
    <div className="app-content"><div className="container-fluid"><section className="card">
      <div className="card-header"><h2 className="card-title">Elenco notifiche</h2></div>
      <div className="card-body">
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6"><label className="form-label" htmlFor="notification-sender-filter">Mittente</label><select className="form-select" id="notification-sender-filter" value={senderFilter} onChange={(event) => setSenderFilter(event.target.value)}><option value="all">Tutti i mittenti</option>{senders.map((sender) => <option value={sender} key={sender}>{sender}</option>)}</select></div>
          <div className="col-12 col-md-6"><label className="form-label" htmlFor="notification-date-filter">Data</label><input className="form-control" id="notification-date-filter" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div>
        </div>
        {filteredNotifications.length === 0 ? <p className="text-secondary mb-0">Nessuna notifica corrisponde ai filtri selezionati.</p> : <div className="d-grid gap-2">{filteredNotifications.map((notification) => <article className={`border rounded p-3 ${notification.readAt ? "bg-body" : "bg-primary-subtle"}`} key={notification.id}>
          <div className="d-flex align-items-start justify-content-between gap-3"><div><div className="fw-semibold">{getSender(notification)}</div><p className="mb-1">{notification.message}</p><div className="small text-secondary">{new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(notification.createdAt))}</div></div>{notification.readAt ? <button className="btn btn-outline-secondary btn-sm flex-shrink-0" type="button" onClick={() => markUnread(notification.id)}>Segna come da leggere</button> : <button className="btn btn-outline-primary btn-sm flex-shrink-0" type="button" onClick={() => markRead(notification.id)}>Segna come letta</button>}</div>
        </article>)}</div>}
      </div>
    </section></div></div>
  </>;
};
