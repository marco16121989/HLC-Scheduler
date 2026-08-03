import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { useEffect, useState } from "react";
import { Home } from "./Home.js";
import { Login } from "./Login.js";
import {
  DoctorsCollection,
  HospitalsCollection,
  NotificationsCollection,
  PatientsCollection,
  PresentationsCollection,
  SupportRequestsCollection,
} from "/imports/api/links";
import { formatUserName } from "/imports/utils/formatUserName";

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
  const [theme, setTheme] = useState(() => {
    const savedTheme = globalThis.localStorage?.getItem("hlc-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    document.body.setAttribute("data-bs-theme", theme);
    globalThis.localStorage?.setItem("hlc-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => current === "dark" ? "light" : "dark");
  };

  const { ready, user, users, hospitals, doctors, patients, presentations, supportRequests, notifications } = useTracker(() => {
    const dataSubscription = Meteor.subscribe("hlc-data");
    const notificationSubscription = Meteor.subscribe("hlc-notifications");
    const account = Meteor.user();

    return {
      ready: dataSubscription.ready() && notificationSubscription.ready(),
      user: account ? toClientRecord(account) : null,
      users: Meteor.users.find({}, { sort: { username: 1 } }).fetch().map(toClientRecord),
      hospitals: HospitalsCollection.find().fetch().map(toClientRecord),
      doctors: DoctorsCollection.find().fetch().map(toClientRecord),
      patients: PatientsCollection.find().fetch().map(toClientRecord),
      presentations: PresentationsCollection.find().fetch().map(toClientRecord),
      supportRequests: SupportRequestsCollection.find({}, { sort: { createdAt: -1 } }).fetch().map(toClientRecord),
      notifications: NotificationsCollection.find({}, { sort: { createdAt: -1 } }).fetch().map((item) => ({
        ...item,
        id: item._id,
      })),
    };
  }, []);

  const makeSetter = (kind, current) => (update) => {
    const next = typeof update === "function" ? update(current) : update;
    callServer("hlc.replaceRecords", kind, next);
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
    callServer("hlc.replaceRecords", "presentations", writableRecords);
  };

  if (Meteor.loggingIn() || (Meteor.userId() && !ready)) {
    return null;
  }

  if (user?.disabled) {
    Meteor.logout();
    return null;
  }

  return user ? (
    <Home
      user={user}
      users={users}
      setUsers={setUsers}
      hospitals={hospitals}
      setHospitals={makeSetter("hospitals", hospitals)}
      doctors={doctors}
      setDoctors={makeSetter("doctors", doctors)}
      patients={patients}
      setPatients={makeSetter("patients", patients)}
      presentations={presentations}
      setPresentations={setPresentations}
      supportRequests={supportRequests}
      notifications={notifications}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLogout={() => Meteor.logout()}
    />
  ) : (
    <Login theme={theme} onToggleTheme={toggleTheme} />
  );
};
