import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CasRoleBadge } from "./CasRoleBadge.js";
import { getPatientAssignmentGvpLabel } from "/imports/api/patientAssignmentUsers.js";

export const PatientAssignees = ({ users, type, singleLine = false }) => {
  const [visibleCount, setVisibleCount] = useState(1);
  const row = useRef(null);
  const measurements = useRef(null);
  useLayoutEffect(() => {
    if (!singleLine || !row.current || !measurements.current) return undefined;
    const update = () => {
      const availableWidth = row.current?.clientWidth;
      const items = measurements.current?.children;
      if (!availableWidth || !items) return;
      let width = 0;
      let count = 0;
      for (let index = 0; index < users.length; index += 1) {
        width += items[index].firstElementChild.getBoundingClientRect().width + (index ? 4 : 0);
        const remaining = users.length - index - 1;
        const counterWidth = remaining ? items[index].lastElementChild.getBoundingClientRect().width + 4 : 0;
        if (width + counterWidth <= availableWidth) count = index + 1;
      }
      setVisibleCount(Math.max(1, count));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row.current);
    return () => observer.disconnect();
  }, [singleLine, users, type]);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(null);
  const timer = useRef(null);
  const anchor = useRef(null);
  const panel = useRef(null);
  const listId = useId();
  useEffect(() => () => globalThis.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!expanded) return undefined;
    const dismiss = () => { setExpanded(false); globalThis.clearTimeout(timer.current); };
    const outside = event => { if (!panel.current?.contains(event.target) && !anchor.current?.contains(event.target)) dismiss(); };
    const onKey = event => { if (event.key === "Escape") { event.stopPropagation(); dismiss(); anchor.current?.focus(); } };
    const onScroll = event => { if (!panel.current?.contains(event.target)) dismiss(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, true);
    globalThis.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, true);
      globalThis.removeEventListener("resize", dismiss);
    };
  }, [expanded]);
  const showAll = event => {
    event.stopPropagation();
    globalThis.clearTimeout(timer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(300, globalThis.innerWidth - 24);
    const below = globalThis.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    const placeBelow = below >= Math.min(260, 58 + users.length * 44) || below >= above;
    setPosition({
      position: "fixed",
      width,
      left: Math.max(12, Math.min(rect.right - width, globalThis.innerWidth - width - 12)),
      ...(placeBelow ? { top: rect.bottom + 8 } : { bottom: globalThis.innerHeight - rect.top + 8 }),
      maxHeight: Math.max(80, Math.min(340, placeBelow ? below : above)),
    });
    setExpanded(true);
    timer.current = globalThis.setTimeout(() => setExpanded(false), 5000);
  };
  const color = type === "CAS" ? "text-bg-success" : "text-bg-info";
  const name = user => type === "CAS" ? user.username : getPatientAssignmentGvpLabel(user);
  const badge = user => <span className={`badge ${color}`}>{type === "CAS" && <CasRoleBadge user={user} />}{name(user)}</span>;
  if (!users.length) return type === "CAS" ? <span className="badge text-bg-warning">Non assegnato</span> : <span className="text-secondary">-</span>;
  const shownCount = singleLine ? Math.min(visibleCount, users.length) : 1;
  return <div ref={row} className={singleLine ? "patient-assignees-single-line" : "d-flex flex-wrap align-items-center gap-1"}>
    {users.slice(0, shownCount).map(user => <span className="patient-assignee-visible-name" key={user.id}>{badge(user)}</span>)}
    {users.length > shownCount && <button ref={anchor} className={`badge border-0 ${color}`} type="button" aria-label={`Visualizza tutti i ${users.length} ${type} assegnati`} aria-expanded={expanded} aria-controls={listId} aria-haspopup="dialog" onClick={showAll} onKeyDown={event => event.stopPropagation()}>+{users.length - shownCount}</button>}
    {singleLine && <div ref={measurements} className="patient-assignees-measurements" aria-hidden="true">{users.map((user, index) => <span key={user.id}>{badge(user)}<span className={`badge border-0 ${color}`}>+{users.length - index - 1}</span></span>)}</div>}
    {expanded && position && createPortal(<div ref={panel} id={listId} className={`patient-assignees-popover ${type === "CAS" ? "is-cas" : "is-gvp"}`} style={position} role="dialog" aria-labelledby={`${listId}-title`} onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") { setExpanded(false); globalThis.clearTimeout(timer.current); anchor.current?.focus(); } }}>
      <div className="patient-assignees-popover-header"><strong id={`${listId}-title`}>{type} assegnati <span>{users.length}</span></strong><button className="btn-close" type="button" aria-label="Chiudi elenco assegnati" onClick={() => { setExpanded(false); globalThis.clearTimeout(timer.current); anchor.current?.focus(); }} /></div>
      <ul className="list-unstyled mb-0">{users.map(user => <li key={user.id}><span className="patient-assignee-avatar" aria-hidden="true">{String(name(user) || "?").trim().slice(0, 1).toLocaleUpperCase("it")}</span><span className="patient-assignee-label">{type === "CAS" && <CasRoleBadge user={user} />}{name(user)}</span></li>)}</ul>
    </div>, document.body)}
  </div>;
};
