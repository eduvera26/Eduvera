import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardCheck,
  LoaderCircle, Save, Search, UserCheck, UsersRound,
} from "lucide-react";
import type { AttendanceStatus, TeacherAttendanceResponse, TeacherHomeResponse } from "../../features/operations/api";
import { OperationsShell } from "./OperationsShell";

function time(value: string) {
  const [hour = "0", minute = "00"] = value.split(":");
  const numeric = Number(hour);
  return `${numeric % 12 || 12}:${minute} ${numeric >= 12 ? "PM" : "AM"}`;
}

const statusLabels: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Excused", half_day: "Half day" };

export function TeacherHomePage({ data, date, onDateChange }: { data: TeacherHomeResponse; date: string; onDateChange: (date: string) => void }) {
  const totals = data.classes.reduce((value, item) => ({ students: value.students + Number(item.student_count), marked: value.marked + Number(item.marked_count), attending: value.attending + Number(item.attending_count) }), { students: 0, marked: 0, attending: 0 });
  const submitted = data.classes.filter((item) => item.submission_status === "submitted").length;
  return (
    <OperationsShell portal="teacher" active="home" title={`Good morning, ${data.teacher.name.split(" ")[0]}`} subtitle="Teaching operations">
      <div className="operations-stack">
        <section className="operations-hero operations-hero--teacher">
          <div><span>Today’s teaching desk</span><h2>{data.classes.length} assigned {data.classes.length === 1 ? "class" : "classes"}</h2><p>Take attendance once, review exceptions, and keep every class register current.</p></div>
          <label>Date<input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
        </section>
        <section className="operations-metrics" aria-label="Teacher attendance summary">
          <article><span><CalendarDays size={19} /></span><small>Classes</small><strong>{data.classes.length}</strong><em>{submitted} registers complete</em></article>
          <article><span><UsersRound size={19} /></span><small>Students</small><strong>{totals.students}</strong><em>Across assigned classes</em></article>
          <article><span><ClipboardCheck size={19} /></span><small>Marked</small><strong>{totals.marked}</strong><em>{totals.students ? Math.round(totals.marked * 100 / totals.students) : 0}% register coverage</em></article>
          <article><span><UserCheck size={19} /></span><small>Attending</small><strong>{totals.attending}</strong><em>Present, late, or half day</em></article>
        </section>
        <section className="operations-panel">
          <header><div><span>Attendance register</span><h2>Assigned classes</h2></div><b>{submitted}/{data.classes.length} submitted</b></header>
          <div className="teacher-class-list">
            {data.classes.length ? data.classes.map((item) => (
              <article key={item.class_section_id}>
                <span className="teacher-class-list__time"><strong>{time(item.starts_at)}</strong><small>{time(item.ends_at)}</small></span>
                <span className="teacher-class-list__identity"><strong>{item.class_name}</strong><small>{item.subjects?.join(" • ") || "Published timetable"} • {item.room_number || "Room pending"}</small></span>
                <span className={`submission-chip is-${item.submission_status}`}>{item.submission_status === "submitted" ? <Check size={13} /> : null}{item.submission_status.replace("_", " ")}</span>
                <span className="teacher-class-list__counts"><strong>{item.marked_count}/{item.student_count}</strong><small>marked</small></span>
                <Link className="operations-action-link" to={`/teacher/attendance?class_section_id=${encodeURIComponent(item.class_section_id)}&date=${date}`}>{item.submission_status === "submitted" ? "Review" : "Take attendance"}<ChevronRight size={17} /></Link>
              </article>
            )) : <div className="operations-empty"><CalendarDays size={24} /><div><strong>No classes assigned</strong><p>There are no teaching periods assigned for this date.</p></div></div>}
          </div>
        </section>
        <section className="operations-panel operations-schedule-preview">
          <header><div><span>Weekly view</span><h2>Your timetable</h2></div><Link className="operations-action-link" to="/teacher/timetable">Open timetable <ArrowRight size={15} /></Link></header>
          <div>{data.weekly_timetable.slice(0, 6).map((slot) => <article key={slot.id}><b>{slot.weekday_label.slice(0, 3)}</b><span><strong>{slot.subject_name}</strong><small>{slot.class_name} • {time(slot.starts_at)} • {slot.room}</small></span></article>)}</div>
        </section>
      </div>
    </OperationsShell>
  );
}

interface EditableRecord { student_id: string; status: AttendanceStatus; remarks: string }

export function TeacherAttendancePage({ data, date, onDateChange, onSave, portal = "teacher" }: { data: TeacherAttendanceResponse; date: string; onDateChange: (date: string) => void; onSave: (records: EditableRecord[]) => Promise<void>; portal?: "teacher" | "principal" }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Record<string, EditableRecord>>(() => Object.fromEntries(data.roster.map((student) => [student.id, { student_id: student.id, status: student.status ?? "present", remarks: student.remarks }])));
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const list = useMemo(() => data.roster.filter((student) => `${student.name} ${student.roll_number} ${student.admission_number}`.toLowerCase().includes(search.toLowerCase())), [data.roster, search]);
  const counts = Object.values(records).reduce<Record<AttendanceStatus, number>>((result, record) => ({ ...result, [record.status]: result[record.status] + 1 }), { present: 0, absent: 0, late: 0, excused: 0, half_day: 0 });
  const update = (studentId: string, value: Partial<EditableRecord>) => setRecords((current) => ({ ...current, [studentId]: { ...current[studentId]!, ...value } }));
  const save = async () => {
    setState("saving"); setError("");
    try { await onSave(Object.values(records)); setState("saved"); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Attendance could not be submitted."); setState("error"); }
  };
  return (
    <OperationsShell portal={portal} active="attendance" title={`${data.class.name} attendance`} subtitle={`${data.class.term} • ${data.class.room}`}>
      <div className="operations-stack">
        <section className="attendance-register-toolbar">
          <button type="button" onClick={() => navigate(portal === "teacher" ? "/teacher" : `/principal/attendance?date=${date}`)}><ArrowLeft size={17} />Back to classes</button>
          <label>Register date<input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
          <button className="mark-all-button" type="button" onClick={() => setRecords(Object.fromEntries(data.roster.map((student) => [student.id, { student_id: student.id, status: "present", remarks: "" }]))) }><CheckCircle2 size={17} />Mark all present</button>
        </section>
        <section className="operations-metrics operations-metrics--compact" aria-label="Attendance status counts">
          {(["present", "absent", "late", "excused", "half_day"] as const).map((status) => <article key={status}><small>{statusLabels[status]}</small><strong>{counts[status]}</strong></article>)}
        </section>
        <section className="operations-panel attendance-register">
          <header><div><span>Class register</span><h2>{data.roster.length} enrolled students</h2></div><label className="operations-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or roll no." /></label></header>
          <div className="attendance-roster">
            {list.map((student) => {
              const record = records[student.id];
              return <article key={student.id}>
                <span className="roster-avatar">{student.avatar_url ? <img src={student.avatar_url} alt="" /> : student.name.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</span>
                <span className="roster-identity"><strong>{student.name}</strong><small>Roll {student.roll_number} • {student.admission_number}</small></span>
                <select aria-label={`Attendance status for ${student.name}`} value={record?.status ?? "present"} onChange={(event) => update(student.id, { status: event.target.value as AttendanceStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <input aria-label={`Attendance remark for ${student.name}`} value={record?.remarks ?? ""} onChange={(event) => update(student.id, { remarks: event.target.value })} maxLength={500} placeholder="Optional remark" />
              </article>;
            })}
          </div>
          <footer><span>{state === "saved" ? <><Check size={15} />Register saved successfully</> : `${Object.keys(records).length} records ready`}</span><button type="button" disabled={state === "saving" || Object.keys(records).length !== data.roster.length} onClick={() => void save()}>{state === "saving" ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{state === "saving" ? "Saving register…" : "Submit attendance"}</button></footer>
          {state === "error" ? <p className="operations-error" role="alert">{error}</p> : null}
        </section>
      </div>
    </OperationsShell>
  );
}

export function TeacherTimetablePage({ data }: { data: TeacherHomeResponse }) {
  const days = useMemo(() => {
    const grouped = new Map<string, TeacherHomeResponse["weekly_timetable"]>();
    for (const slot of data.weekly_timetable) grouped.set(slot.weekday_label, [...(grouped.get(slot.weekday_label) ?? []), slot]);
    return [...grouped.entries()];
  }, [data.weekly_timetable]);
  return (
    <OperationsShell portal="teacher" active="timetable" title="My weekly timetable" subtitle={`${data.teacher.name} • Published schedule`}>
      <div className="operations-stack"><section className="operations-hero"><div><span>Weekly teaching plan</span><h2>{data.weekly_timetable.length} scheduled periods</h2><p>Your live school timetable, grouped by teaching day and ordered by period.</p></div></section><section className="teacher-week-grid">{days.map(([day, slots]) => <article className="operations-panel" key={day}><header><div><span>Teaching day</span><h2>{day}</h2></div><b>{slots.length} periods</b></header><div>{slots.map((slot) => <section key={slot.id}><span><small>P{slot.period_number}</small><strong>{time(slot.starts_at)}</strong></span><i /><span><strong>{slot.subject_name}</strong><small>{slot.class_name} • {slot.room || "Room pending"}</small></span></section>)}</div></article>)}</section></div>
    </OperationsShell>
  );
}
