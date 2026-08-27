import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useEffect, useRef, useState } from "react";
import { Home } from "./Home.js";
import { Login } from "./Login.js";
import {
  AccessLogsCollection,
  AbsencesCollection,
  DepartmentsCollection,
  DoctorsCollection,
  EventsCollection,
  HospitalsCollection,
  NotificationsCollection,
  PatientsCollection,
  PresentationsCollection,
  SupportRequestsCollection,
  UsefulFilesCollection,
} from "/imports/api/links";
import { formatUserName } from "/imports/utils/formatUserName";
import { usePushNotifications } from "./usePushNotifications.js";
import { ConfirmDialogHost } from "./ConfirmDialog.js";

const toClientRecord = ({ _id, profile, ...record }) => ({
  id: _id,
  ...record,
  ...(record.username ? { username: formatUserName(record.username) } : {}),
  ...(profile || {}),
});

const callServer = (method, ...args) => {
  Meteor.call(method, ...args, (error) => {
    if (error) {
      globalThis.alert(error.reason || "Impossibile salvare i dati.");
    }
  });
};

export const App = () => {
  const [logoReady, setLogoReady] = useState(false);
  const [startupExiting, setStartupExiting] = useState(false);
  const [startupComplete, setStartupComplete] = useState(false);
  const startupStartedAt = useRef(Date.now());
  const [theme, setTheme] = useState(() => {
    const savedTheme = globalThis.localStorage?.getItem("hlc-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [fontSize, setFontSize] = useState(() => {
    const savedFontSize = globalThis.localStorage?.getItem("hlc-font-size");
    return ["xsmall", "small", "normal", "large", "xlarge"].includes(savedFontSize)
      ? savedFontSize
      : "normal";
  });
  const [highContrast, setHighContrast] = useState(
    () => globalThis.localStorage?.getItem("hlc-high-contrast") === "true",
  );
  const [boldText, setBoldText] = useState(
    () => globalThis.localStorage?.getItem("hlc-bold-text") === "true",
  );

  useEffect(() => {
    const logo = new Image();
    let cancelled = false;
    const markLogoReady = () => {
      if (!cancelled) setLogoReady(true);
    };
    const decodeLogo = () => {
      if (typeof logo.decode !== "function") {
        markLogoReady();
        return;
      }
      logo.decode().then(markLogoReady, markLogoReady);
    };
    logo.onload = decodeLogo;
    logo.onerror = markLogoReady;
    logo.src = "/images/hlc-scheduler-logo-optimized.jpg";
    if (logo.complete) decodeLogo();
    return () => {
      cancelled = true;
      logo.onload = null;
      logo.onerror = null;
    };
  }, []);

  useEffect(() => {
    const resetKey = "hlc-italian-interface-reset-v1";
    document.documentElement.lang = "it";
    globalThis.localStorage?.removeItem("hlc-language");
    if (globalThis.sessionStorage?.getItem(resetKey) !== "done") {
      globalThis.sessionStorage?.setItem(resetKey, "done");
      globalThis.location.reload();
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    document.body.setAttribute("data-bs-theme", theme);
    document.documentElement.lang = "it";
    globalThis.localStorage?.removeItem("hlc-language");
    globalThis.localStorage?.setItem("hlc-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-app-font-size", fontSize);
    globalThis.localStorage?.setItem("hlc-font-size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute("data-high-contrast", String(highContrast));
    globalThis.localStorage?.setItem("hlc-high-contrast", String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.setAttribute("data-bold-text", String(boldText));
    globalThis.localStorage?.setItem("hlc-bold-text", String(boldText));
  }, [boldText]);


  const toggleTheme = () => {
    setTheme((current) => current === "dark" ? "light" : "dark");
  };

  const { ready, user, users, hospitals, departments, doctors, patients, presentations, events, supportRequests, notifications, usefulFiles, absences, accessLogs } = useTracker(() => {
    const dataSubscription = Meteor.subscribe("hlc-data");
    const eventSubscription = Meteor.subscribe("hlc-events");
    const notificationSubscription = Meteor.subscribe("hlc-notifications");
    const accessSubscription = Meteor.subscribe("hlc-access-logs");
    const account = Meteor.user();

    return {
      ready: dataSubscription.ready() && eventSubscription.ready() && notificationSubscription.ready() && accessSubscription.ready(),
      user: account ? toClientRecord(account) : null,
      users: Meteor.users.find({}, { sort: { username: 1 } }).fetch().map(toClientRecord),
      hospitals: HospitalsCollection.find().fetch().map(toClientRecord),
      departments: DepartmentsCollection.find({}, { sort: { name: 1 } }).fetch().map(toClientRecord),
      doctors: DoctorsCollection.find().fetch().map(toClientRecord),
      patients: PatientsCollection.find().fetch().map(toClientRecord),
      presentations: PresentationsCollection.find().fetch().map(toClientRecord),
      events: EventsCollection.find({}, { sort: { startsAt: 1 } }).fetch().map(toClientRecord),
      supportRequests: SupportRequestsCollection.find({}, { sort: { createdAt: -1 } }).fetch().map(toClientRecord),
      notifications: NotificationsCollection.find({}, { sort: { createdAt: -1 } }).fetch().map((item) => ({
        ...item,
        id: item._id,
      })),
      usefulFiles: UsefulFilesCollection.find({}, { sort: { createdAt: -1 } }).fetch().map(toClientRecord),
      absences: AbsencesCollection.find({}, { sort: { startDate: 1 } }).fetch().map(toClientRecord),
      accessLogs: AccessLogsCollection.find({}, { sort: { createdAt: -1 } }).fetch().map(toClientRecord),
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const trackingKey = `hlc-access-session:${user.id}`;
    if (globalThis.sessionStorage?.getItem(trackingKey)) return;
    globalThis.sessionStorage?.setItem(trackingKey, "tracked");
    Meteor.call("hlc.trackAccess");
  }, [user?.id]);

  const pushNotifications = usePushNotifications(user?.id);

  const logout = async () => {
    try {
      await pushNotifications.detach();
    } finally {
      Meteor.logout();
    }
  };

  useEffect(() => {
    if (!("setAppBadge" in navigator) || !("clearAppBadge" in navigator)) return;
    const unreadCount = user?.id
      ? notifications.filter((notification) => !notification.readAt).length
      : 0;
    const badgeUpdate = unreadCount > 0
      ? navigator.setAppBadge(unreadCount)
      : navigator.clearAppBadge();
    badgeUpdate.catch(() => {});
  }, [notifications, user?.id]);

  const initialLoadingComplete = logoReady && !Meteor.loggingIn() && !(Meteor.userId() && !ready);
  useEffect(() => {
    if (!initialLoadingComplete || startupComplete) return undefined;
    const elapsed = Date.now() - startupStartedAt.current;
    const remaining = Math.max(0, 3000 - elapsed);
    let completionTimer;
    const exitTimer = globalThis.setTimeout(() => {
      setStartupExiting(true);
      completionTimer = globalThis.setTimeout(() => setStartupComplete(true), 420);
    }, remaining);
    return () => {
      globalThis.clearTimeout(exitTimer);
      globalThis.clearTimeout(completionTimer);
    };
  }, [initialLoadingComplete, startupComplete]);

  const makeSetter = (kind, current) => (update) => {
    const next = typeof update === "function" ? update(current) : update;
    const currentById = new Map(current.map((record) => [record.id, record]));
    const nextIds = new Set(next.map((record) => record.id));
    const upserts = next.filter((record) =>
      !currentById.has(record.id) || JSON.stringify(currentById.get(record.id)) !== JSON.stringify(record),
    );
    const removedIds = current.filter((record) => !nextIds.has(record.id)).map((record) => record.id);
    if (kind === "patients") {
      callServer("hlc.applyPatientChanges", { upserts, removedIds });
    } else {
      callServer("hlc.applyRecordChanges", kind, { upserts, removedIds });
    }
  };
  const setUsers = (update) => {
    const next = typeof update === "function" ? update(users) : update;
    callServer("hlc.syncUsers", next);
  };
  const setPresentations = (update) => {
    const next = typeof update === "function" ? update(presentations) : update;
    const organizationId = user?.role === "Presidente"
      ? user.id
      : user?.presidentId || user?.associationId || "";
    const writableRecords = user?.role === "Admin"
      ? next
      : next.filter((record) => record.presidentId === organizationId);
    const currentById = new Map(presentations.map((record) => [record.id, record]));
    const nextIds = new Set(writableRecords.map((record) => record.id));
    const upserts = writableRecords.filter((record) =>
      !currentById.has(record.id) || JSON.stringify(currentById.get(record.id)) !== JSON.stringify(record),
    );
    const removedIds = presentations.filter((record) => !nextIds.has(record.id)).map((record) => record.id);
    callServer("hlc.applyRecordChanges", "presentations", { upserts, removedIds });
  };

  const startupLoader = <div className={`startup-loader ${startupExiting ? "is-exiting" : ""}`} role="status" aria-live="polite">
      <div className="startup-loader-content">
        <div className="startup-loader-mark" aria-hidden="true">HLC</div>
        <div className="startup-progress" aria-label="Caricamento in corso"><span /></div>
      </div>
    </div>;

  if (!startupComplete && !startupExiting) {
    return startupLoader;
  }

  if (user?.disabled) {
    Meteor.logout();
    return null;
  }

  return <>{!startupComplete && startupLoader}<ConfirmDialogHost />{user ? (
    <Home
      user={user}
      users={users}
      setUsers={setUsers}
      hospitals={hospitals}
      setHospitals={makeSetter("hospitals", hospitals)}
      departments={departments}
      setDepartments={makeSetter("departments", departments)}
      doctors={doctors}
      setDoctors={makeSetter("doctors", doctors)}
      patients={patients}
      setPatients={makeSetter("patients", patients)}
      presentations={presentations}
      setPresentations={setPresentations}
      events={events}
      supportRequests={supportRequests}
      notifications={notifications}
      usefulFiles={usefulFiles}
      absences={absences}
      accessLogs={accessLogs}
      pushNotifications={pushNotifications}
      theme={theme}
      onToggleTheme={toggleTheme}
      fontSize={fontSize}
      onFontSizeChange={setFontSize}
      highContrast={highContrast}
      onToggleHighContrast={() => setHighContrast((current) => !current)}
      boldText={boldText}
      onToggleBoldText={() => setBoldText((current) => !current)}
      onLogout={logout}
    />
  ) : (
    <Login theme={theme} onToggleTheme={toggleTheme} />
  )}</>;
};
