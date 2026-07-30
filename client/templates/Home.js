import { useState } from "react";
import { Users } from "./Users.js";
import { Hospitals } from "./Hospitals.js";
import { Doctors } from "./Doctors.js";
import { Patients } from "./Patients.js";

export const Home = ({
  user,
  users,
  setUsers,
  hospitals,
  setHospitals,
  doctors,
  setDoctors,
  patients,
  setPatients,
  onLogout,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => globalThis.innerWidth >= 992,
  );
  const [activeView, setActiveView] = useState(
    user.role === "Presidente" || user.role === "CAS" ? "team" : "home",
  );
  const presidentId =
    user.role === "Presidente"
      ? user.id
      : user.role === "CAS"
        ? user.presidentId || user.associationId
        : "";

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
              {user.role === "Admin" && (
              <>
              <li className="nav-item">
                <button
                  className={`nav-link w-100 ${activeView === "users" ? "active" : ""}`}
                  type="button"
                  onClick={() => setActiveView("users")}
                >
                  <span className="nav-icon admin-nav-icon" aria-hidden="true">U</span>
                  <p>Utenti</p>
                </button>
              </li>
              </>
              )}
              {user.role === "Presidente" && (
                <li className="nav-item">
                  <button
                    className={`nav-link w-100 ${activeView === "team" ? "active" : ""}`}
                    type="button"
                    onClick={() => setActiveView("team")}
                  >
                    <span className="nav-icon admin-nav-icon" aria-hidden="true">S</span>
                    <p>La mia squadra</p>
                  </button>
                </li>
              )}
              {user.role === "CAS" && (
                <li className="nav-item">
                  <button
                    className={`nav-link w-100 ${activeView === "team" ? "active" : ""}`}
                    type="button"
                    onClick={() => setActiveView("team")}
                  >
                    <span className="nav-icon admin-nav-icon" aria-hidden="true">G</span>
                    <p>I miei GVP</p>
                  </button>
                </li>
              )}
              {(user.role === "Presidente" || user.role === "CAS") && (
                <>
                  <li className="nav-item">
                    <button
                      className={`nav-link w-100 ${activeView === "hospitals" ? "active" : ""}`}
                      type="button"
                      onClick={() => setActiveView("hospitals")}
                    >
                      <span className="nav-icon admin-nav-icon" aria-hidden="true">O</span>
                      <p>Ospedali</p>
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link w-100 ${activeView === "doctors" ? "active" : ""}`}
                      type="button"
                      onClick={() => setActiveView("doctors")}
                    >
                      <span className="nav-icon admin-nav-icon" aria-hidden="true">M</span>
                      <p>Medici</p>
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link w-100 ${activeView === "patients" ? "active" : ""}`}
                      type="button"
                      onClick={() => setActiveView("patients")}
                    >
                      <span className="nav-icon admin-nav-icon" aria-hidden="true">P</span>
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
        {activeView === "users" && user.role === "Admin" ? (
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
            users={users}
            currentUser={user}
            presidentId={presidentId}
          />
        ) : activeView === "team" && user.role === "Presidente" ? (
          <Users
            users={users}
            setUsers={setUsers}
            hospitals={hospitals}
            manager={user}
          />
        ) : activeView === "team" && user.role === "CAS" ? (
          <Users
            users={users}
            setUsers={setUsers}
            hospitals={hospitals}
            manager={user}
          />
        ) : (
          <div className="app-content" />
        )}
      </main>

      <footer className="app-footer">
        <strong>HLC Scheduler</strong>
        <span className="float-end d-none d-sm-inline">Pannello amministrativo</span>
      </footer>
    </div>
  );
};
