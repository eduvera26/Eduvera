import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BellRing,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  X,
} from "lucide-react";

import { schoolClock } from "../../lib/schoolTime";
import { StudentShell, type StudentRouteMap } from "./StudentShell";
import { ParentShell } from "../parent/ParentShell";
import type { ParentChildSummary, ParentPageAction } from "../parent/parentTypes";
import { demoTimetableDays, type SchoolDayKey, type TimetableDay, type TimetablePeriod } from "./student-timetable-data";
import "./student-pages.css";

const bellAlertStorageKey = "omnischool.timetable.bell-alerts";

const weekdayKeys: Array<SchoolDayKey | undefined> = [undefined, "mon", "tue", "wed", "thu", "fri", "sat"];

function timeMinutes(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return undefined;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (match[3]?.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (match[3]?.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function storedBellPreference(defaultValue: boolean) {
  if (typeof window === "undefined") return defaultValue;
  const stored = window.localStorage.getItem(bellAlertStorageKey);
  return stored === null ? defaultValue : stored === "true";
}

function compactSubject(subject: string) {
  return subject
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\b(General|Theory|Literature|Practicum|Science)\b/gi, "")
    .trim() || subject;
}

function periodRange(period: TimetablePeriod) {
  return period.endTime ? `${period.time} - ${period.endTime}` : period.time;
}

function kitForPeriod(period: TimetablePeriod) {
  const subject = period.subject.toLowerCase();
  if (/lunch|recess|break|free|dismissal/.test(subject)) return null;
  if (/assembly|yoga/.test(subject)) return "House uniform";
  if (period.tone === "lab" || /lab|physics|chemistry|biology|computer/.test(subject)) return "Lab manual";
  if (/club/.test(subject)) return "Club kit";
  if (period.tone === "activity" || /games|physical|pe|sport|house/.test(subject)) return "Sports kit";
  if (/social|history|geography|civics|polity/.test(subject)) return "SST notebook";
  if (/art|craft/.test(subject)) return "Art kit";
  if (/music|choir/.test(subject)) return "Music folder";
  if (/quiz/.test(subject)) return "Quiz prep";
  if (/math/.test(subject)) return "Math notebook";
  if (/english|debate|library/.test(subject)) return "Reader";
  if (/hindi|sanskrit|french|language/.test(subject)) return "Language notebook";
  return `${compactSubject(period.subject)} notebook`;
}

export interface StudentTimetablePageProps {
  days?: TimetableDay[];
  audience?: "student" | "parent";
  child?: ParentChildSummary;
  onSelectChild?: (childId: string) => ParentPageAction;
  className?: string;
  studentName?: string;
  termLabel?: string;
  routes?: Partial<StudentRouteMap>;
  onDownload?: () => void | Promise<void>;
  onBellAlertsChange?: (enabled: boolean) => void;
}

function TimetableShell({
  audience,
  child,
  onSelectChild,
  routes,
  className,
  children,
}: {
  audience: "student" | "parent";
  child?: ParentChildSummary;
  onSelectChild?: (childId: string) => ParentPageAction;
  routes?: Partial<StudentRouteMap>;
  className?: string;
  children: ReactNode;
}) {
  if (audience === "parent") {
    return <ParentShell active="timetable" pageLabel="Timetable" child={child} onSelectChild={onSelectChild}>{children}</ParentShell>;
  }
  return <StudentShell activeNav="classes" variant="edura" routes={routes} className={className}>{children}</StudentShell>;
}

export function StudentTimetablePage({
  days = demoTimetableDays,
  audience = "student",
  child,
  onSelectChild,
  className = "Class 7A",
  studentName = "Aarav Sharma",
  termLabel = "Academic Year 2026–27 • Term 1",
  routes,
  onBellAlertsChange,
}: StudentTimetablePageProps) {
  const [bellAlerts, setBellAlerts] = useState(() => storedBellPreference(false));
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<{ day: TimetableDay; period: TimetablePeriod } | null>(null);
  const chartScrollerRef = useRef<HTMLDivElement | null>(null);
  const focusCellRef = useRef<HTMLTableCellElement | null>(null);
  const currentSchoolClock = schoolClock(now);
  const todayKey = weekdayKeys[currentSchoolClock.weekday];
  const nowMinutes = currentSchoolClock.minutes;
  const today = days.find((day) => day.key === todayKey);
  const currentPeriod = today?.periods.find((period) => {
    const starts = timeMinutes(period.time);
    const ends = timeMinutes(period.endTime);
    return starts !== undefined && ends !== undefined && starts <= nowMinutes && nowMinutes < ends;
  });
  const nextPeriod = today?.periods.find((period) => {
    const starts = timeMinutes(period.time);
    return starts !== undefined && starts > nowMinutes;
  });
  const chartFocusPeriod = currentPeriod ?? nextPeriod;
  const bellPeriod = currentPeriod ?? nextPeriod;
  const bellTarget = currentPeriod ? timeMinutes(currentPeriod.endTime) : timeMinutes(nextPeriod?.time);
  const bellMinutes = bellTarget === undefined ? undefined : Math.max(0, bellTarget - nowMinutes);
  const periodColumns = useMemo(() => {
    const maxPeriods = Math.max(0, ...days.map((day) => day.periods.length));
    return Array.from({ length: maxPeriods }, (_, index) => index);
  }, [days]);
  const todayKit = useMemo(() => {
    const source = today ?? days[0];
    const items = source?.periods
      .map(kitForPeriod)
      .filter((item): item is string => Boolean(item))
      .filter((item, index, all) => all.indexOf(item) === index)
      .slice(0, 5) ?? [];
    return { day: source, items };
  }, [days, today]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useLayoutEffect(() => {
    const scroller = chartScrollerRef.current;
    const cell = focusCellRef.current;
    if (!scroller || !cell) return;
    const alignFocusedCell = () => {
      const left = cell.offsetLeft - (scroller.clientWidth / 2) + (cell.clientWidth / 2);
      if (typeof scroller.scrollTo === "function") scroller.scrollTo({ left, behavior: "auto" });
      else scroller.scrollLeft = left;
    };
    alignFocusedCell();
    const frame = window.requestAnimationFrame(alignFocusedCell);
    return () => window.cancelAnimationFrame(frame);
  }, [chartFocusPeriod?.id, periodColumns.length]);

  function toggleBellAlerts() {
    const enabled = !bellAlerts;
    setBellAlerts(enabled);
    window.localStorage.setItem(bellAlertStorageKey, String(enabled));
    onBellAlertsChange?.(enabled);
    setToast(enabled
      ? onBellAlertsChange
        ? `Bell alerts enabled for ${className}.`
        : "Bell reminder preference saved on this device. Push alerts are not active yet."
      : "Bell reminder preference paused.");
  }

  if (!days.length) {
    return (
      <TimetableShell audience={audience} child={child} onSelectChild={onSelectChild} routes={routes} className={className}>
        <div className="student-page-stack timetable-page">
          <section className="student-card student-empty-state timetable-empty-state">
            <BookOpen size={24} />
            <div><strong>No timetable published</strong><p>The school has not added periods for this week yet.</p></div>
          </section>
        </div>
      </TimetableShell>
    );
  }

  return (
    <TimetableShell audience={audience} child={child} onSelectChild={onSelectChild} routes={routes} className={className}>
      <div className="student-page-stack timetable-page">
        <section className="timetable-intro">
          <header>
            <div><h1>{className} Timetable</h1><p>{termLabel} • {studentName}</p></div>
            <button className={bellAlerts ? "square-soft-button is-active" : "square-soft-button"} type="button" aria-pressed={bellAlerts} aria-label="Save bell reminder preference" onClick={toggleBellAlerts}><Clock3 size={23} /></button>
          </header>
          {bellPeriod ? (
            <div className="next-bell-banner" aria-label="Today bell status">
              <span><BellRing size={19} /></span>
              <span><small>{currentPeriod ? "Current period ends" : "Next bell"} <i /> <b>{bellMinutes ?? "—"} mins</b></small><strong>{bellPeriod.period} • {bellPeriod.subject}</strong></span>
              <ChevronRight size={19} />
            </div>
          ) : null}
        </section>

        <section className="student-card timetable-week-chart" aria-labelledby="week-chart-heading">
          <header>
            <div><h2 id="week-chart-heading">Weekly period chart</h2><p>Rows are school days. Columns are class periods.</p></div>
            <strong>{days.reduce((total, day) => total + day.periods.length, 0)} periods/wk</strong>
          </header>
          <div className="timetable-week-chart__scroller" ref={chartScrollerRef}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  {periodColumns.map((index) => <th key={index} scope="col">P{index + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.key} className={day.key === todayKey ? "is-today" : ""}>
                    <th scope="row"><span>{day.shortLabel}</span><small>{day.date}</small></th>
                    {periodColumns.map((index) => {
                      const period = day.periods[index];
                      const isCurrent = day.key === todayKey && period?.id === currentPeriod?.id;
                      const isChartFocus = day.key === todayKey && period?.id === chartFocusPeriod?.id;
                      return (
                        <td ref={isChartFocus ? focusCellRef : undefined} key={`${day.key}-${index}`} className={period ? `tone-${period.tone} ${isCurrent ? "is-current" : ""} ${isChartFocus ? "is-chart-focus" : ""}` : "is-empty"}>
                          {period ? <button type="button" onClick={() => setSelectedPeriod({ day, period })} aria-label={`${period.subject}, ${day.longLabel} ${period.period}, ${periodRange(period)}`}><strong>{compactSubject(period.subject)}</strong><small>{period.period} • {period.time.replace(/\s(?:AM|PM)$/, "")}</small>{isCurrent ? <em>Now</em> : null}</button> : <span aria-label="No period scheduled">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="timetable-legend"><span><i className="tone-math" />Maths</span><span><i className="tone-science" />Science</span><span><i className="tone-english" />English</span><span><i className="tone-language" />Languages</span><span><i className="tone-lab" />Labs</span><span><i className="tone-activity" />Activities</span></div>
        </section>

        {todayKit.items.length ? (
          <section className="student-card timetable-kit-card" aria-labelledby="timetable-kit-heading">
            <header><div><h2 id="timetable-kit-heading">Today’s kit</h2><p>{todayKit.day?.longLabel ?? "Today"} essentials from the timetable.</p></div><strong>{todayKit.items.length}</strong></header>
            <div>{todayKit.items.map((item) => <span key={item}><Check size={13} />{item}</span>)}</div>
          </section>
        ) : null}
      </div>
      {selectedPeriod ? (
        <div className="student-sheet-backdrop" role="presentation" onClick={() => setSelectedPeriod(null)}>
          <section className="student-sheet timetable-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="period-detail-heading" onClick={(event) => event.stopPropagation()}>
            <div className="student-sheet__handle" />
            <header>
              <span className={`period-detail-icon tone-${selectedPeriod.period.tone}`}><BookOpen size={20} /></span>
              <div><p>{selectedPeriod.day.longLabel} • {selectedPeriod.period.period}</p><h2 id="period-detail-heading">{selectedPeriod.period.subject}</h2></div>
              <button className="student-icon-button" type="button" onClick={() => setSelectedPeriod(null)} aria-label="Close period details"><X size={18} /></button>
            </header>
            <div className="period-detail-grid">
              <span><Clock3 size={15} /><strong>{periodRange(selectedPeriod.period)}</strong><small>Time</small></span>
              <span><MapPin size={15} /><strong>{selectedPeriod.period.room ?? "Room pending"}</strong><small>Room</small></span>
            </div>
            <div className="period-detail-copy">
              <span><strong>{selectedPeriod.period.teacher ?? "Faculty assignment pending"}</strong><small>Teacher</small></span>
              {selectedPeriod.period.detail ? <p>{selectedPeriod.period.detail}</p> : null}
              {selectedPeriod.period.flag ? <em>{selectedPeriod.period.flag}</em> : null}
            </div>
          </section>
        </div>
      ) : null}
      {toast && <div className="student-toast" role="status"><Check size={18} />{toast}</div>}
    </TimetableShell>
  );
}
