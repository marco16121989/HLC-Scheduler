import { useMemo, useState } from "react";

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const parseDate = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`) : null;

export const Calendar = ({ presentations, patients, doctors, currentUser }) => {
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [viewMode, setViewMode] = useState("month");
  const [eventFilter, setEventFilter] = useState("all");

  const events = useMemo(() => {
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
          title: `${patient.lastName} ${patient.firstName}`,
          detail: [
            patient.admissionType === "scheduled" ? "Ricovero programmato" : "Emergenza",
            patient.pathology,
            doctor ? `Dr. ${doctor.lastName}` : "",
          ].filter(Boolean).join(" · "),
        };
      });
    return [...presentationEvents, ...patientEvents].sort((a, b) => a.title.localeCompare(b.title));
  }, [presentations, patients, doctors]);

  const filteredEvents = eventFilter === "all"
    ? events
    : events.filter((event) => event.type === eventFilter);
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

  const renderEvent = (event) => (
    <article className={`calendar-agenda-item ${event.type}`} key={event.id}>
      <span className="badge">{event.type === "presentation" ? "Presentazione" : "Paziente"}</span>
      <h3>{event.title}</h3>
      {event.detail && <p>{event.detail}</p>}
    </article>
  );

  return (
    <>
      <div className="app-content-header">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div><h1 className="mb-0">Calendario</h1><div className="text-secondary small">Eventi disponibili per {currentUser.username}</div></div>
            <div className="d-flex flex-wrap gap-2">
              <div className="btn-group" role="group" aria-label="Filtro eventi">
                {[['all', 'Tutti'], ['presentation', 'Presentazioni'], ['patient', 'Pazienti']].map(([filter, label]) => <button className={`btn ${eventFilter === filter ? "btn-secondary" : "btn-outline-secondary"}`} type="button" key={filter} onClick={() => setEventFilter(filter)}>{label}</button>)}
              </div>
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
          <div className="calendar-legend"><span><i className="calendar-dot presentation" /> Presentazioni (tutti)</span><span><i className="calendar-dot patient" /> Pazienti autorizzati</span></div>
          {viewMode === "month" && <><div className="calendar-grid calendar-week-header">{WEEK_DAYS.map((day) => <div key={day}>{day}</div>)}</div>
          <div className="calendar-grid calendar-days">{cells.map((date, index) => {
            if (!date) return <div className="calendar-day empty" key={`empty-${index}`} />;
            const key = dateKey(date);
            const dayEvents = filteredEvents.filter((event) => event.date === key);
            return <button className={`calendar-day ${key === selectedDate ? "selected" : ""} ${key === todayKey ? "today" : ""}`} type="button" key={key} onClick={() => setSelectedDate(key)} aria-label={`${date.getDate()}, ${dayEvents.length} eventi`}>
              <span className="calendar-day-number">{date.getDate()}</span>
              <span className="calendar-day-events">{dayEvents.slice(0, 3).map((event) => <span className={`calendar-event ${event.type}`} key={event.id} title={event.title}>{event.title}</span>)}{dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3}</span>}</span>
            </button>;
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
