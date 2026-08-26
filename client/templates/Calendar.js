import { useMemo, useState } from "react";
import {
  DETAIL_SECTIONS,
  SIMPLIFIED_FIELDS,
  formatSummaryValue,
} from "./Patients.js";

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const parseDate = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`) : null;

export const Calendar = ({ presentations, patients, doctors, users = [], invitedEvents = [], currentUser }) => {
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [viewMode, setViewMode] = useState("month");
  const isGvp = currentUser.role === "GVP";
  const [eventFilter, setEventFilter] = useState(isGvp ? "assigned" : "all");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientModalTab, setPatientModalTab] = useState("info");

  const calendarEvents = useMemo(() => {
    const presentationEvents = presentations
      .filter((item) => item.presentationDate)
      .map((item) => ({
        id: `presentation-${item.id}`,
        date: item.presentationDate.slice(0, 10),
        type: "presentation",
        title: item.event || "Presentazione",
        detail: [item.facility, item.city, item.presentationTypes?.join(", ")].filter(Boolean).join(" · "),
      }));
    const patientEvents = patients
      .filter((patient) => patient.admissionDate)
      .map((patient) => {
        const doctor = doctors.find((item) => item.id === patient.doctorId);
        return {
          id: `patient-${patient.id}`,
          date: patient.admissionDate.slice(0, 10),
          type: "patient",
          patient,
          title: `${patient.lastName} ${patient.firstName}`,
          detail: [
            patient.admissionType === "scheduled" ? "Ricovero programmato" : "Emergenza",
            !isGvp ? patient.pathology : "",
            doctor ? `Dr. ${doctor.lastName}` : "",
          ].filter(Boolean).join(" · "),
        };
      });
    const invitationEvents = invitedEvents
      .filter((item) => item.startsAt)
      .map((item) => {
        const start = new Date(item.startsAt);
        const end = item.endsAt ? new Date(item.endsAt) : null;
        const timeFormatter = new Intl.DateTimeFormat("it-IT", { timeStyle: "short" });
        return {
          id: `event-${item.id}`,
          date: item.startsAt.slice(0, 10),
          type: "event",
          title: item.title || "Evento",
          detail: [
            end ? `${timeFormatter.format(start)} – ${timeFormatter.format(end)}` : timeFormatter.format(start),
            item.location,
            item.creatorName ? `Creato da ${item.creatorName}` : "",
          ].filter(Boolean).join(" · "),
        };
      });
    return [...presentationEvents, ...patientEvents, ...invitationEvents].sort((a, b) => a.title.localeCompare(b.title));
  }, [presentations, patients, doctors, invitedEvents, isGvp]);

  const filteredEvents = eventFilter === "all"
    ? calendarEvents
    : eventFilter === "assigned"
      ? calendarEvents.filter((event) => event.type !== "presentation")
      : calendarEvents.filter((event) => event.type === eventFilter);
  const firstDayOffset = (displayedMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const day = index - firstDayOffset + 1;
    cells.push(day >= 1 && day <= daysInMonth ? new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day) : null);
  }
  const selectedEvents = filteredEvents.filter((event) => event.date === selectedDate);
  const todayKey = dateKey(new Date());
  const selectedDateValue = parseDate(selectedDate);
  const startOfWeek = new Date(selectedDateValue);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + index);
    return date;
  });
  const periodLabel = viewMode === "month"
    ? new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(displayedMonth)
    : viewMode === "week"
      ? `${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(weekDates[0])} – ${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(weekDates[6])}`
      : new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(selectedDateValue);

  const changePeriod = (difference) => {
    if (viewMode === "month") {
      const next = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + difference, 1);
      setDisplayedMonth(next);
      setSelectedDate(dateKey(next));
      return;
    }
    const next = new Date(selectedDateValue);
    next.setDate(next.getDate() + difference * (viewMode === "week" ? 7 : 1));
    setSelectedDate(dateKey(next));
    setDisplayedMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const selectView = (mode) => {
    setViewMode(mode);
    const selected = parseDate(selectedDate);
    setDisplayedMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  };

  const openEvent = (event) => {
    if (event.type === "patient" && event.patient) {
      setPatientModalTab("info");
      setSelectedPatient(event.patient);
    }
  };

  const renderEvent = (event) => (
    <article
      className={`calendar-agenda-item ${event.type} ${event.type === "patient" ? "is-clickable" : ""}`}
      key={event.id}
      role={event.type === "patient" ? "button" : undefined}
      tabIndex={event.type === "patient" ? 0 : undefined}
      onClick={() => openEvent(event)}
      onKeyDown={(keyboardEvent) => {
        if (event.type === "patient" && (keyboardEvent.key === "Enter" || keyboardEvent.key === " ")) {
          keyboardEvent.preventDefault();
          openEvent(event);
        }
      }}
    >
      <span className="badge">{event.type === "presentation" ? "Presentazione" : event.type === "event" ? "Evento" : "Paziente"}</span>
      <h3>{event.title}</h3>
      {event.detail && <p>{event.detail}</p>}
    </article>
  );

  const selectedDoctor = selectedPatient
    ? doctors.find((doctor) => doctor.id === selectedPatient.doctorId)
    : null;
  const patientDetails = selectedPatient?.details || {};
  const selectedCas = selectedPatient
    ? users.find((user) => user.id === selectedPatient.casId)
    : null;
  const selectedGvpIds = selectedPatient
    ? (Array.isArray(selectedPatient.gvpIds)
        ? selectedPatient.gvpIds
        : selectedPatient.gvpId
          ? [selectedPatient.gvpId]
          : [])
    : [];
  const selectedGvps = users.filter((user) => selectedGvpIds.includes(user.id));
  const selectedGvpNotes = Array.isArray(selectedPatient?.gvpNotes)
    ? selectedPatient.gvpNotes
    : selectedPatient?.gvpNotes
      ? [{ text: selectedPatient.gvpNotes }]
      : [];
  const patientBaseEntries = selectedPatient ? [
    ["Nome", selectedPatient.firstName],
    ["Cognome", selectedPatient.lastName],
    ...(!isGvp ? [
      ["Tipo di accesso", selectedPatient.admissionType === "scheduled" ? "Ricovero programmato" : "Emergenza"],
      ["Data di accesso", selectedPatient.admissionDate],
      ["Patologia", selectedPatient.pathology],
      ["Medico responsabile", selectedDoctor ? `${selectedDoctor.lastName} ${selectedDoctor.firstName}` : "Non assegnato"],
      ["CAS", selectedCas?.username || "Non assegnato"],
      ["GVP assegnati", selectedGvps.length ? selectedGvps.map((user) => user.username).join(", ") : "Nessun GVP assegnato"],
    ] : []),
  ] : [];
  const detailSections = isGvp
    ? [{ title: "Informazioni semplificate", fields: SIMPLIFIED_FIELDS }]
    : DETAIL_SECTIONS;
  const isNotesField = (field) => /notes|comments/i.test(field[0]);
  const informationSections = detailSections.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => !isNotesField(field)),
  })).filter((section) => section.fields.length > 0);

  return (
    <>
      {selectedPatient && <>
        <button className="entity-modal-backdrop" type="button" aria-label="Chiudi dettaglio paziente" onClick={() => setSelectedPatient(null)} />
        <div className="entity-modal-shell" role="dialog" aria-modal="true" aria-labelledby="calendar-patient-title">
          <section className="card entity-modal-card patient-modal-card">
            <div className="card-header d-flex align-items-center gap-3">
              <h2 className="card-title mb-0" id="calendar-patient-title">
                Paziente — {selectedPatient.lastName} {selectedPatient.firstName}
              </h2>
              <button className="btn-close ms-auto" type="button" aria-label="Chiudi" onClick={() => setSelectedPatient(null)} />
            </div>
            <div className="card-body">
              {isGvp && <div className="alert alert-light border" role="status">Sono mostrate soltanto le informazioni semplificate disponibili per il GVP.</div>}
              <div className="nav nav-tabs mb-4" role="tablist" aria-label="Dettaglio paziente">
                <button className={`nav-link ${patientModalTab === "info" ? "active" : ""}`} type="button" role="tab" aria-selected={patientModalTab === "info"} onClick={() => setPatientModalTab("info")}>Informazioni</button>
                <button className={`nav-link ${patientModalTab === "notes" ? "active" : ""}`} type="button" role="tab" aria-selected={patientModalTab === "notes"} onClick={() => setPatientModalTab("notes")}>Note</button>
              </div>
              {patientModalTab === "info" ? <>
                <section className="mb-4">
                  <h3 className="h5 mb-3">Dati principali</h3>
                  <div className="patient-summary-grid">
                    {patientBaseEntries.map(([label, value]) => <div className="patient-summary-item" key={label}><div className="patient-summary-label">{label}</div><div className="patient-summary-value">{formatSummaryValue(value)}</div></div>)}
                  </div>
                </section>
                {informationSections.map((section) => <section className="mb-4" key={section.title}>
                  <h3 className="h5 mb-3">{section.title}</h3>
                  <div className="patient-summary-grid">
                    {section.fields.map((field) => <div className="patient-summary-item" key={field[0]}><div className="patient-summary-label">{field[1]}</div><div className="patient-summary-value">{formatSummaryValue(patientDetails[field[0]])}</div></div>)}
                  </div>
                </section>)}
              </> : selectedGvpNotes.length > 0 ? <div className="patient-notes-chat">
                {selectedGvpNotes.map((note, index) => {
                  const isOwnNote = note.authorId === currentUser.id;
                  return <article className={`patient-chat-message ${isOwnNote ? "is-own" : ""}`} key={note.id || `${note.authorId || "gvp"}-${index}`}>
                    <div className="patient-chat-bubble">
                      <p>{note.text}</p>
                      <div className="patient-chat-meta">
                        <strong>{note.author || "GVP"}</strong>
                        <span>{note.authorRole || "GVP"}</span>
                        {note.createdAt && <time dateTime={new Date(note.createdAt).toISOString()}>{new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(note.createdAt))}</time>}
                      </div>
                    </div>
                  </article>;
                })}
              </div> : <p className="text-secondary mb-0">Nessuna nota GVP presente.</p>}
            </div>
            <div className="card-footer text-end">
              <button className="btn btn-outline-secondary" type="button" onClick={() => setSelectedPatient(null)}>Chiudi</button>
            </div>
          </section>
        </div>
      </>}
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div><h1 className="mb-0">Calendario</h1><div className="text-secondary small">Eventi disponibili per {currentUser.username}</div></div>
            <div className="d-flex flex-wrap gap-2">
              {!isGvp && <div className="btn-group" role="group" aria-label="Filtro eventi">
                {[['all', 'Tutti'], ['event', 'Eventi'], ['presentation', 'Presentazioni'], ['patient', 'Pazienti']].map(([filter, label]) => <button className={`btn ${eventFilter === filter ? "btn-secondary" : "btn-outline-secondary"}`} type="button" key={filter} onClick={() => setEventFilter(filter)}>{label}</button>)}
              </div>}
              <div className="btn-group" role="group" aria-label="Tipo di vista">
                {[['month', 'Mese'], ['week', 'Settimana'], ['day', 'Giorno']].map(([mode, label]) => <button className={`btn ${viewMode === mode ? "btn-primary" : "btn-outline-primary"}`} type="button" key={mode} onClick={() => selectView(mode)}>{label}</button>)}
              </div>
              <div className="btn-group" role="group" aria-label="Navigazione calendario">
                <button className="btn btn-outline-secondary" type="button" onClick={() => changePeriod(-1)} aria-label="Periodo precedente">&lsaquo;</button>
                <button className="btn btn-outline-secondary text-capitalize calendar-month-button" type="button" onClick={() => { const today = new Date(); setDisplayedMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayKey); }}>{periodLabel}</button>
                <button className="btn btn-outline-secondary" type="button" onClick={() => changePeriod(1)} aria-label="Periodo successivo">&rsaquo;</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="app-content"><div className="container-fluid"><div className="row g-3">
        <div className={viewMode === "month" ? "col-12 col-xl-9" : "col-12"}><section className="card calendar-card">
          <div className="calendar-legend"><span><i className="calendar-dot event" /> Eventi su invito</span>{!isGvp && <span><i className="calendar-dot presentation" /> Presentazioni (tutti)</span>}<span><i className="calendar-dot patient" /> {isGvp ? "Casi affidati" : "Pazienti autorizzati"}</span></div>
          {viewMode === "month" && <><div className="calendar-grid calendar-week-header">{WEEK_DAYS.map((day) => <div key={day}>{day}</div>)}</div>
          <div className="calendar-grid calendar-days">{cells.map((date, index) => {
            if (!date) return <div className="calendar-day empty" key={`empty-${index}`} />;
            const key = dateKey(date);
            const dayEvents = filteredEvents.filter((event) => event.date === key);
            return <div className={`calendar-day ${key === selectedDate ? "selected" : ""} ${key === todayKey ? "today" : ""}`} key={key} role="button" tabIndex="0" onClick={() => setSelectedDate(key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedDate(key); }} aria-label={`${date.getDate()}, ${dayEvents.length} eventi`}>
              <span className="calendar-day-number">{date.getDate()}</span>
              <span className="calendar-day-events">{dayEvents.slice(0, 3).map((event) => event.type === "patient" ? <button className={`calendar-event ${event.type}`} type="button" key={event.id} title={event.title} onClick={(clickEvent) => { clickEvent.stopPropagation(); openEvent(event); }}>{event.title}</button> : <span className={`calendar-event ${event.type}`} key={event.id} title={event.title}>{event.title}</span>)}{dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3}</span>}</span>
            </div>;
          })}</div></>}
          {viewMode === "week" && <div className="calendar-week-view">{weekDates.map((date) => {
            const key = dateKey(date);
            const dayEvents = filteredEvents.filter((event) => event.date === key);
            return <section className={`calendar-week-column ${key === todayKey ? "today" : ""}`} key={key}>
              <button className="calendar-week-date" type="button" onClick={() => { setSelectedDate(key); setViewMode("day"); }}><span>{WEEK_DAYS[(date.getDay() + 6) % 7]}</span><strong>{date.getDate()}</strong></button>
              <div className="calendar-week-events">{dayEvents.length ? dayEvents.map(renderEvent) : <span className="text-secondary small">Nessun evento</span>}</div>
            </section>;
          })}</div>}
          {viewMode === "day" && <div className="calendar-day-view"><div className="calendar-day-view-date"><span>{new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(selectedDateValue)}</span><strong>{selectedDateValue.getDate()}</strong></div><div className="calendar-day-view-events">{selectedEvents.length ? selectedEvents.map(renderEvent) : <p className="text-secondary mb-0">Nessun evento.</p>}</div></div>}
        </section></div>
        {viewMode === "month" && <div className="col-12 col-xl-3"><section className="card h-100"><div className="card-header"><h2 className="card-title">{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(selectedDateValue)}</h2></div><div className="card-body">
          {selectedEvents.length === 0 ? <p className="text-secondary mb-0">Nessun evento.</p> : <div className="calendar-agenda">{selectedEvents.map(renderEvent)}</div>}
        </div></section></div>}
      </div></div></div>
    </>
  );
};
