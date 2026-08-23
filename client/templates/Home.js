import { useState } from "react";
import { Meteor } from "meteor/meteor";
import { Users } from "./Users.js";
import { Hospitals } from "./Hospitals.js";
import { Departments } from "./Departments.js";
import { Doctors } from "./Doctors.js";
import { Patients } from "./Patients.js";
import { PatientReports } from "./PatientReports.js";
import { PresentationReports } from "./PresentationReports.js";
import { Presentations } from "./Presentations.js";
import { Calendar } from "./Calendar.js";
import { SHAREPOINT_URL } from "./SharePoint.js";
import { Profile } from "./Profile.js";
import { SupportRequests } from "./SupportRequests.js";
import { UsefulFiles } from "./UsefulFiles.js";
import { Notifications } from "./Notifications.js";
import { Info } from "./Info.js";
import { Settings } from "./Settings.js";
import { Absences } from "./Absences.js";

const ICON_PATHS = {
  calendar: ["M3 5h18v16H3z", "M16 3v4M8 3v4M3 10h18"],
  absence: ["M3 5h18v16H3z", "M16 3v4M8 3v4M3 10h18", "M8 15h8"],
  profile: ["M20 21a8 8 0 0 0-16 0", "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  sharepoint: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"],
  team: ["M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7z", "M9 12l2 2 4-4"],
  cas: ["M12 3 4 6v6c0 4.5 3.2 7.5 8 9 4.8-1.5 8-4.5 8-9V6z", "M9 11h6M12 8v6"],
  hospital: ["M3 21h18M5 21V5h14v16M9 5V3h6v2M9 9h6M12 6v6M8 16h2M14 16h2"],
  departments: ["M3 21h18M5 21V4h14v17", "M8 8h3v3H8zM13 8h3v3h-3zM8 14h3v3H8zM13 14h3v3h-3z"],
  presentation: ["M3 4h18v13H3z", "M8 21l4-4 4 4M7 9l3 3 4-5 3 3"],
  doctor: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v10M7 12h10"],
  patient: ["M4 21v-7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v7", "M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M9 16h6M12 13v6"],
  reports: ["M4 20V10M10 20V4M16 20v-7M22 20H2", "M4 7h.01M10 1h.01M16 10h.01"],
  presentationReports: ["M12 3v9l7.8 4.5A9 9 0 1 1 12 3z", "M14 3.3A9 9 0 0 1 21 10h-7z"],
  support: ["M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z", "M8 9h8M8 13h5"],
  files: ["M4 3h10l6 6v12H4z", "M14 3v6h6", "M8 14h8M8 18h6"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 10v7M12 7h.01"],
  settings: ["M4 6h16M4 12h16M4 18h16", "M8 3v6M16 9v6M10 15v6"],
};

const MenuIcon = ({ name }) => (
  <svg className="nav-icon admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICON_PATHS[name].map((path) => <path d={path} key={path} />)}
  </svg>
);

export const Home = ({
  user,
  users,
  setUsers,
  hospitals,
  setHospitals,
  departments,
  setDepartments,
  doctors,
  setDoctors,
  patients,
  setPatients,
  presentations,
  setPresentations,
  supportRequests,
  notifications = [],
  usefulFiles = [],
  absences = [],
  theme,
  onToggleTheme,
  fontSize,
  onFontSizeChange,
  highContrast,
  onToggleHighContrast,
  boldText,
  onToggleBoldText,
  onLogout,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => globalThis.innerWidth >= 992,
  );
  const [activeView, setActiveView] = useState(
    user.role === "GVP" ? "patients" : "home",
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const markNotificationRead = (notificationId) => Meteor.call("hlc.markNotificationAsRead", notificationId);
  const markAllNotificationsRead = () => Meteor.call("hlc.markAllNotificationsAsRead");
  const presidentId =
    user.role === "Presidente"
      ? user.id
      : user.role === "CAS" || user.role === "GVP"
        ? user.presidentId || user.associationId
        : "";
  const closeMobileSidebar = () => {
    if (globalThis.innerWidth < 992) setSidebarOpen(false);
  };
  const openView = (view) => {
    setActiveView(view);
    closeMobileSidebar();
  };

  return (
    <div
      className={`app-wrapper sidebar-expand-lg sidebar-mini ${
        sidebarOpen ? "sidebar-open" : "sidebar-collapse"
      }`}
    >
      <nav className="app-header navbar navbar-expand bg-body">
        <div className="container-fluid">
          <ul className="navbar-nav">
            <li className="nav-item">
              <button
                className="nav-link admin-icon-button"
                type="button"
                onClick={() => setSidebarOpen((current) => !current)}
                aria-label="Apri o chiudi il menu"
                aria-expanded={sidebarOpen}
                title="Menu"
              >
                <span aria-hidden="true">&#9776;</span>
              </button>
            </li>
          </ul>

          <ul className="navbar-nav ms-auto align-items-center">
            {(user.role === "CAS" || user.role === "Presidente") && (
              <li className="nav-item me-2 position-relative">
                <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Mostra notifiche">
                  🔔
                  {unreadNotifications.length > 0 && <span className="badge text-bg-danger ms-2">{unreadNotifications.length}</span>}
                </button>
                {notificationsOpen && (
                  <div className="dropdown-menu show p-2 shadow" style={{ position: "absolute", right: 0, top: "calc(100% + 0.35rem)", minWidth: "18rem", zIndex: 1100 }}>
                    {unreadNotifications.length === 0 ? (
                      <div className="small text-secondary">Nessuna nuova notifica.</div>
                    ) : unreadNotifications.slice(0, 5).map((notification) => (
                      <div key={notification.id} className="border rounded p-2 mb-2 small bg-primary-subtle">
                        <div>{notification.message}</div>
                        <div className="text-secondary mt-1">{new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(notification.createdAt))}</div>
                        <button className="btn btn-link btn-sm p-0 mt-1" type="button" onClick={() => markNotificationRead(notification.id)}>Segna come letta</button>
                      </div>
                    ))}
                    <div className="d-grid gap-2 mt-2">
                      <button className="btn btn-outline-secondary btn-sm" type="button" disabled={unreadNotifications.length === 0} onClick={markAllNotificationsRead}>Segna tutte come lette</button>
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => { setNotificationsOpen(false); openView("notifications"); }}>Vai alle notifiche</button>
                    </div>
                  </div>
                )}
              </li>
            )}
            <li className="nav-item d-none d-sm-block">
              <span className="nav-link admin-user-email">
                {user.username} · {user.role}
              </span>
            </li>
            <li className="nav-item">
              <button
                className="btn btn-outline-danger btn-sm"
                type="button"
                onClick={onLogout}
              >
                Esci
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
        <div className="sidebar-brand">
          <a href="#" className="brand-link" aria-label="HLC Scheduler home">
            <img
              className="brand-logo"
              src="/images/hlc-scheduler-logo.png"
              alt=""
            />
            <span className="brand-text fw-semibold">HLC Scheduler</span>
          </a>
        </div>
        <div className="sidebar-wrapper">
          <nav className="mt-2">
            <ul className="nav sidebar-menu flex-column" role="menu">
              <li className="sidebar-section-label menu-order-tools">Strumenti</li>
              {user.role !== "Admin" && <li className="nav-item menu-order-tools">
                <button
                  className={`nav-link w-100 ${activeView === "calendar" ? "active" : ""}`}
                  type="button"
                  onClick={() => openView("calendar")}
                >
                  <MenuIcon name="calendar" />
                  <p>Calendario</p>
                </button>
              </li>}
              {["Presidente", "CAS", "GVP"].includes(user.role) && <li className="nav-item menu-order-tools">
                <button className={`nav-link w-100 ${activeView === "absences" ? "active" : ""}`} type="button" onClick={() => openView("absences")}>
                  <MenuIcon name="absence" />
                  <p>Periodi di assenza</p>
                </button>
              </li>}
              {user.role !== "Admin" && <li className="nav-item menu-order-tools">
                <button className={`nav-link w-100 ${activeView === "useful-files" ? "active" : ""}`} type="button" onClick={() => openView("useful-files")}>
                  <MenuIcon name="files" />
                  <p>File Utili</p>
                </button>
              </li>}
              <li className="nav-item menu-order-tools">
                <button className={`nav-link w-100 ${activeView === "settings" ? "active" : ""}`} type="button" onClick={() => openView("settings")}>
                  <MenuIcon name="settings" />
                  <p>Impostazioni</p>
                </button>
              </li>
              <li className="nav-item menu-order-info">
                <button className={`nav-link w-100 ${activeView === "info" ? "active" : ""}`} type="button" onClick={() => openView("info")}>
                  <MenuIcon name="info" />
                  <p>Info</p>
                </button>
              </li>
              {user.role === "GVP" && <li className="nav-item menu-order-tools">
                <button
                  className={`nav-link w-100 ${activeView === "profile" ? "active" : ""}`}
                  type="button"
                  onClick={() => openView("profile")}
                >
                  <MenuIcon name="profile" />
                  <p>Profilo</p>
                </button>
              </li>}
              {user.role !== "Admin" && user.role !== "GVP" && <li className="sidebar-section-label menu-order-links">Collegamenti</li>}
              {user.role !== "Admin" && user.role !== "GVP" && <li className="nav-item menu-order-links">
                <a
                  className="nav-link w-100"
                  href={SHAREPOINT_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={closeMobileSidebar}
                >
                  <MenuIcon name="sharepoint" />
                  <p>Share Point</p>
                </a>
              </li>}
              <li className="sidebar-section-label menu-order-support">Assistenza</li>
              {user.role !== "GVP" && <li className="nav-item menu-order-support-item">
                <button className={`nav-link w-100 ${activeView === "support" ? "active" : ""}`} type="button" onClick={() => openView("support")}>
                  <MenuIcon name="support" />
                  <p>Segnalazioni</p>
                </button>
              </li>}
              {user.role === "Admin" && (
              <>
              <li className="sidebar-section-label menu-order-admin">Amministrazione</li>
              <li className="nav-item menu-order-admin">
                <button
                  className={`nav-link w-100 ${activeView === "users" ? "active" : ""}`}
                  type="button"
                  onClick={() => openView("users")}
                >
                  <MenuIcon name="users" />
                  <p>Utenti</p>
                </button>
              </li>
              </>
              )}
              {(user.role === "Presidente" || user.role === "CAS" || (user.role === "GVP" && user.canInsertGvp)) && <li className="sidebar-section-label menu-order-team">Squadra</li>}
              {(user.role === "Presidente" || user.role === "CAS") && (
                <li className="nav-item menu-order-team">
                  <button
                    className={`nav-link w-100 ${activeView === "cas" ? "active" : ""}`}
                    type="button"
                    onClick={() => openView("cas")}
                  >
                    <MenuIcon name="cas" />
                    <p>CAS</p>
                  </button>
                </li>
              )}
              {user.role === "GVP" && user.canInsertGvp && (
                <li className="nav-item menu-order-team">
                  <button
                    className={`nav-link w-100 ${activeView === "gvp" ? "active" : ""}`}
                    type="button"
                    onClick={() => openView("gvp")}
                  >
                    <MenuIcon name="team" />
                    <p>GVP</p>
                  </button>
                </li>
              )}
              {(user.role === "Presidente" || user.role === "CAS") && (
                <li className="nav-item menu-order-team">
                  <button
                    className={`nav-link w-100 ${activeView === "gvp" ? "active" : ""}`}
                    type="button"
                    onClick={() => openView("gvp")}
                  >
                    <MenuIcon name="team" />
                    <p>GVP</p>
                  </button>
                </li>
              )}
              {(user.role === "Presidente" || user.role === "CAS") && <li className="nav-item menu-order-team">
                <button
                  className={`nav-link w-100 ${activeView === "profile" ? "active" : ""}`}
                  type="button"
                  onClick={() => openView("profile")}
                >
                  <MenuIcon name="profile" />
                  <p>Profilo</p>
                </button>
              </li>}
              {(user.role === "Presidente" || user.role === "CAS") && (
                <>
                  <li className="sidebar-section-label menu-order-health">Gestione sanitaria</li>
                  <li className="nav-item menu-order-health">
                    <button
                      className={`nav-link w-100 ${activeView === "hospitals" ? "active" : ""}`}
                      type="button"
                      onClick={() => openView("hospitals")}
                    >
                      <MenuIcon name="hospital" />
                      <p>Ospedali</p>
                    </button>
                  </li>
                  <li className="nav-item menu-order-health">
                    <button
                      className={`nav-link w-100 ${activeView === "departments" ? "active" : ""}`}
                      type="button"
                      onClick={() => openView("departments")}
                    >
                      <MenuIcon name="departments" />
                      <p>Reparti</p>
                    </button>
                  </li>
                  <li className="nav-item menu-order-health">
                    <button
                      className={`nav-link w-100 ${activeView === "presentations" ? "active" : ""}`}
                      type="button"
                      onClick={() => openView("presentations")}
                    >
                      <MenuIcon name="presentation" />
                      <p>Presentazioni</p>
                    </button>
                  </li>
                  <li className="sidebar-section-label menu-order-reports">Report</li>
                  <li className="nav-item menu-order-reports">
                    <button className={`nav-link w-100 ${activeView === "presentation-reports" ? "active" : ""}`} type="button" onClick={() => openView("presentation-reports")}>
                      <MenuIcon name="presentationReports" />
                      <p>Report presentazioni</p>
                    </button>
                  </li>
                  <li className="nav-item menu-order-health">
                    <button
                      className={`nav-link w-100 ${activeView === "doctors" ? "active" : ""}`}
                      type="button"
                      onClick={() => openView("doctors")}
                    >
                      <MenuIcon name="doctor" />
                      <p>Medici</p>
                    </button>
                  </li>
                  <li className="nav-item menu-order-health">
                    <button
                      className={`nav-link w-100 ${activeView === "patients" ? "active" : ""}`}
                      type="button"
                      onClick={() => openView("patients")}
                    >
                      <MenuIcon name="patient" />
                      <p>Pazienti</p>
                    </button>
                  </li>
                  <li className="nav-item menu-order-reports">
                    <button className={`nav-link w-100 ${activeView === "patient-reports" ? "active" : ""}`} type="button" onClick={() => openView("patient-reports")}>
                      <MenuIcon name="reports" />
                      <p>Report pazienti</p>
                    </button>
                  </li>
                </>
              )}
              {user.role === "GVP" && (
                <>
                <li className="sidebar-section-label menu-order-health">Gestione sanitaria</li>
                <li className="nav-item menu-order-health">
                  <button
                    className={`nav-link w-100 ${activeView === "patients" ? "active" : ""}`}
                    type="button"
                    onClick={() => openView("patients")}
                  >
                    <MenuIcon name="patient" />
                    <p>Pazienti</p>
                  </button>
                </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </aside>
      <button
        className="sidebar-overlay"
        type="button"
        aria-label="Chiudi il menu"
        onClick={() => setSidebarOpen(false)}
      />

      <main className="app-main" aria-label="Contenuto principale">
        {activeView === "support" ? (
          <SupportRequests requests={supportRequests} currentUser={user} />
        ) : activeView === "absences" && ["Presidente", "CAS", "GVP"].includes(user.role) ? (
          <Absences absences={absences} users={users} currentUser={user} />
        ) : activeView === "settings" ? (
          <Settings theme={theme} onToggleTheme={onToggleTheme} fontSize={fontSize} onFontSizeChange={onFontSizeChange} highContrast={highContrast} onToggleHighContrast={onToggleHighContrast} boldText={boldText} onToggleBoldText={onToggleBoldText} />
        ) : activeView === "info" ? (
          <Info />
        ) : activeView === "notifications" ? (
          <Notifications notifications={notifications} />
        ) : activeView === "useful-files" && presidentId ? (
          <UsefulFiles files={usefulFiles} currentUser={user} />
        ) : activeView === "profile" ? (
          <Profile currentUser={user} hospitals={hospitals} />
        ) : activeView === "calendar" ? (
          <Calendar
            presentations={presentations}
            patients={patients}
            doctors={doctors}
            users={users}
            currentUser={user}
          />
        ) : activeView === "users" && user.role === "Admin" ? (
          <Users
            users={users}
            setUsers={setUsers}
            hospitals={hospitals}
            manager={user}
          />
        ) : activeView === "hospitals" && presidentId ? (
          <Hospitals
            hospitals={hospitals}
            setHospitals={setHospitals}
            departmentTemplates={departments}
            presidentId={presidentId}
          />
        ) : activeView === "departments" && presidentId ? (
          <Departments
            departments={departments}
            setDepartments={setDepartments}
            hospitals={hospitals}
            presidentId={presidentId}
          />
        ) : activeView === "doctors" && presidentId ? (
          <Doctors
            doctors={doctors}
            setDoctors={setDoctors}
            hospitals={hospitals}
            presidentId={presidentId}
          />
        ) : activeView === "patients" && presidentId ? (
          <Patients
            patients={patients}
            setPatients={setPatients}
            doctors={doctors}
            hospitals={hospitals}
            users={users}
            currentUser={user}
            presidentId={presidentId}
            absences={absences}
          />
        ) : activeView === "patient-reports" && presidentId && user.role !== "GVP" ? (
          <PatientReports patients={patients} hospitals={hospitals} users={users} currentUser={user} presidentId={presidentId} />
        ) : activeView === "presentation-reports" && presidentId && user.role !== "GVP" ? (
          <PresentationReports presentations={presentations} presidentId={presidentId} />
        ) : activeView === "presentations" && presidentId ? (
          <Presentations
            presentations={presentations}
            setPresentations={setPresentations}
            currentUser={user}
            presidentId={presidentId}
          />
        ) : activeView === "cas" && (user.role === "Presidente" || user.role === "CAS") ? (
          <Users
            users={users}
            setUsers={setUsers}
            hospitals={hospitals}
            manager={user}
            managedRole="CAS"
          />
        ) : activeView === "gvp" && (user.role === "Presidente" || user.role === "CAS" || (user.role === "GVP" && user.canInsertGvp)) ? (
          <Users
            users={users}
            setUsers={setUsers}
            hospitals={hospitals}
            manager={user}
            managedRole="GVP"
          />
        ) : (
          <div className="app-content home-welcome">
            <div className="home-welcome-inner">
              <img
                className="home-welcome-logo"
                src="/images/hlc-scheduler-logo.png"
                alt="HLC Scheduler"
              />
              <h1>HLC Scheduler</h1>
              <p>Benvenuto, {user.firstName || user.username}</p>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <strong>HLC Scheduler</strong>
        <span className="float-end d-none d-sm-inline">Pannello amministrativo</span>
      </footer>
    </div>
  );
};
