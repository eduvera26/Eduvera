import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { familyApi, type DiaryItem, type Slot, type Student } from "../features/family";
import { useAuth } from "../lib/auth";
import { Empty, Initials, PageTitle, Skeleton, Stat, Status, attendanceTone, fmtDate, plain } from "../components/ui";

/* Families open on an answer, not a dashboard. The number is supporting detail. */

export function ChildSwitcher({ current, siblings }: { current: Student; siblings: Student[] }) {
  const { child, setChild } = useAuth();
  const all = [current, ...siblings.filter((s) => s.id !== current.id)];
  if (all.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Child">
      {all.map((s) => {
        const on = (child ?? current.id) === s.id;
        return (
          <button key={s.id} onClick={() => setChild(s.id)} aria-pressed={on} className="btn" style={on ? { background: "var(--brand)", color: "var(--brand-on)", borderColor: "var(--brand)", borderRadius: 999 } : { borderRadius: 999 }}>
            <Initials name={s.user.display_name} src={s.avatar_url} />{s.user.display_name.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleList({ slots, date }: { slots: Slot[]; date: string }) {
  return (
    <div className="card">
      <div className="card-h"><b>{fmtDate(date, { weekday: "long" })}'s timetable</b><span className="faint" style={{ fontSize: 12.5 }}>{slots.length} periods</span></div>
      {slots.length === 0 ? <Empty>No periods today.</Empty> : slots.map((s) => (
        <div className="row" key={s.id}>
          <span style={{ fontSize: 13, fontWeight: 600, width: 46, flexShrink: 0 }}>{s.starts_at}</span>
          <div className="rowtxt"><b>{s.subject?.name ?? s.display_title}</b><span>{s.teacher?.name ? `${s.teacher.name} · ` : ""}{s.room}</span></div>
        </div>
      ))}
    </div>
  );
}

function DiaryPreview({ items, to }: { items: DiaryItem[]; to: string }) {
  return (
    <div className="card">
      <div className="card-h"><b>Diary</b><Link to={to} className="faint" style={{ fontSize: 12.5 }}>All entries</Link></div>
      {items.length === 0 ? <Empty>Nothing new in the diary.</Empty> : items.map((d) => (
        <div className="row" key={d.id}>
          <Status tone={d.item_type === "homework" ? "cau" : d.item_type === "announcement" ? "inf" : "neu"}>{d.item_type_label}</Status>
          <div className="rowtxt"><b>{d.title}</b><span>{d.subject?.name ? `${d.subject.name} · ` : ""}{d.author_name}{d.due_at ? ` · due ${fmtDate(d.due_at, { day: "numeric", month: "short" })}` : ""}</span></div>
          {d.requires_acknowledgement && !d.acknowledged ? <Status tone="cau">Needs acknowledgement</Status> : null}
        </div>
      ))}
    </div>
  );
}

export function ParentHome() {
  const { child } = useAuth();
  const q = useQuery({ queryKey: ["parent-home", child], queryFn: () => familyApi.parentHome(child ?? undefined) });
  if (q.isPending) return <><Skeleton h={34} w={380} /><Skeleton h={140} /><Skeleton h={260} /></>;
  if (q.isError || !q.data) return <Empty>Could not load your child's day. {String((q.error as Error)?.message ?? "")}</Empty>;
  const d = q.data;
  const name = d.student.user.display_name.split(" ")[0];
  const present = d.campus_presence?.direction === "in";
  const m = d.semester_metrics;
  const below = m.attendance_threshold != null && m.attendance_percentage < m.attendance_threshold;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageTitle title={`How is ${name} doing today?`} sub={<>{fmtDate(today)} · {d.student.current_enrollment.class_name} · {d.student.current_enrollment.term.name}</>} />
      <ChildSwitcher current={d.student} siblings={d.siblings} />

      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10, borderColor: present ? "var(--pos)" : "var(--line)", background: present ? "var(--pos-bg)" : "var(--surface)" }}>
        <Status tone={present ? "pos" : "neu"}>{present ? "In school" : d.campus_presence ? "Left school" : "No gate event yet"}</Status>
        <div className="dsp">{present && d.campus_presence ? `${name} arrived at ${fmtDate(d.campus_presence.occurred_at, { hour: "2-digit", minute: "2-digit" })}.` : d.campus_presence ? `${name} left at ${fmtDate(d.campus_presence.occurred_at, { hour: "2-digit", minute: "2-digit" })}.` : `No arrival recorded for ${name} yet today.`}</div>
        <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
          Attendance this term is {m.attendance_percentage.toFixed(1)}%{m.attendance_threshold != null ? `, ${below ? "below" : "above"} the ${m.attendance_threshold}% the school asks for` : ""}.
          {m.homework_due ? ` ${m.homework_due} piece${m.homework_due === 1 ? "" : "s"} of homework due.` : ""}
        </div>
      </div>

      {d.action_required ? (
        <div className="card" style={{ padding: 18, borderColor: "var(--cau)", background: "var(--cau-tint)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Status tone="cau">Needs you</Status>
          <div style={{ flexGrow: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{name}'s {d.action_required.category_label.toLowerCase()} leave needs your authorisation</b>
            <div className="muted" style={{ fontSize: 13 }}>{fmtDate(d.action_required.starts_on, { day: "numeric", month: "short" })} · {d.action_required.duration_days} day{d.action_required.duration_days === 1 ? "" : "s"}</div></div>
          <Link className="btn pri" to="/leave">Review</Link>
        </div>
      ) : null}

      <div className="grid4">
        <Stat label="Attendance" value={`${d.attendance.percentage.toFixed(1)}%`} tone={below ? "cau" : "pos"} note={<>{d.attendance.present} of {d.attendance.total} days</>} />
        <Stat label="Absences" value={d.attendance.absent} tone={d.attendance.absent ? "cri" : "pos"} note={<>{d.attendance.late} late · {d.attendance.excused} excused</>} />
        <Stat label="Homework due" value={m.homework_due} tone={m.homework_due ? "cau" : "pos"} note="this week" />
        <Stat label="Fees" value={plain(m.dues_status)} tone="pos" note="Autumn term" />
      </div>

      <div className="grid2">
        <ScheduleList slots={d.today_schedule} date={today} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DiaryPreview items={d.diary_preview} to="/diary" />
          {d.contacts.length ? (
            <div className="card"><div className="card-h"><b>School contacts</b></div>
              {d.contacts.slice(0, 3).map((c, i) => <div className="row" key={c.id ?? i}><div className="rowtxt"><b>{c.name}</b><span>{c.label ?? c.role ?? c.designation ?? ""}{c.phone ? ` · ${c.phone}` : ""}{c.availability ? ` · ${c.availability}` : ""}</span></div></div>)}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function StudentHome() {
  const q = useQuery({ queryKey: ["student-home"], queryFn: familyApi.studentHome });
  if (q.isPending) return <><Skeleton h={34} w={380} /><Skeleton h={140} /><Skeleton h={260} /></>;
  if (q.isError || !q.data) return <Empty>Could not load your day. {String((q.error as Error)?.message ?? "")}</Empty>;
  const d = q.data;
  const t = d.today_attendance;
  const threshold = Number(d.term.threshold);
  const below = d.attendance.percentage < threshold;
  const attendanceColor = !below ? "var(--pos)"
    : d.attendance.percentage >= threshold - 10 ? "var(--cau-ink)"
      : "var(--attendance-orange)";
  const next = d.today_schedule.find((s) => s.starts_at > new Date().toTimeString().slice(0, 5)) ?? d.today_schedule[0];

  return (
    <>
      <PageTitle title="Your day" sub={<>{fmtDate(d.date)} · {d.student.current_enrollment.class_name} · roll {d.student.current_enrollment.roll_number} · {d.term.name}</>} />

      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <Status tone={t ? attendanceTone(t.status) : "neu"}>{t ? plain(t.status) : "Not marked yet"}</Status>
        <div className="dsp">{next ? `Next: ${next.subject?.name ?? next.display_title} at ${next.starts_at}` : "Nothing scheduled today"}</div>
        <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
          {next ? `${next.room}${next.teacher ? ` · ${next.teacher.name}` : ""}. ` : ""}
          Attendance is {d.attendance.percentage.toFixed(1)}%, {below ? "below" : "above"} the {threshold}% threshold.
          {d.active_leave_count ? ` ${d.active_leave_count} leave request${d.active_leave_count === 1 ? "" : "s"} in progress.` : ""}
        </div>
      </div>

      <div className="grid4">
        <Stat label="Attendance" value={<span style={{ color: attendanceColor }}>{d.attendance.percentage.toFixed(1)}%</span>} tone={below ? "cau" : "pos"} note={<>{d.attendance.present} of {d.attendance.total} days</>} />
        <Stat label="Periods today" value={d.today_schedule.length} note={next ? `next at ${next.starts_at}` : "none"} />
        <Stat label="Active leave" value={d.active_leave_count} tone={d.active_leave_count ? "cau" : "pos"} note={<Link to="/leave">Leave status</Link>} />
        <Stat label="Unread" value={d.unread_notifications} tone={d.unread_notifications ? "inf" : "pos"} note={<Link to="/notifications">Notifications</Link>} />
      </div>

      <div className="grid2">
        <ScheduleList slots={d.today_schedule} date={d.date} />
        <DiaryPreview items={d.diary_preview} to="/diary" />
      </div>
    </>
  );
}
