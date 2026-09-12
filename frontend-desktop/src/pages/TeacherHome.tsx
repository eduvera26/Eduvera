import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { staffApi } from "../features/staff";
import { Empty, PageTitle, Skeleton, Status, fmtDate, submissionTone, today } from "../components/ui";

/* Teaching opens on the day: what is next, and what is still outstanding from you.
   No school-wide percentages — that is not this person's job. */
export function TeacherHome() {
  const [date, setDate] = useState(today());
  const home = useQuery({ queryKey: ["teacher-home", date], queryFn: () => staffApi.teacherHome(date) });

  if (home.isPending) return <><Skeleton h={34} w={360} /><Skeleton h={120} /><Skeleton h={260} /></>;
  if (home.isError || !home.data) return <Empty>Could not load your day. {String((home.error as Error)?.message ?? "")}</Empty>;

  const d = home.data;
  const open = d.classes.filter((c) => c.submission_status !== "submitted");
  const next = open[0];
  const weekday = new Date(`${date}T00:00:00`).getDay() || 7;
  const todaySlots = d.weekly_timetable.filter((s) => s.weekday === weekday).sort((a, b) => a.period_number - b.period_number);

  return (
    <>
      <PageTitle title={date === today() ? "Your day" : "Your classes"} sub={<>{fmtDate(d.date)} · {d.teacher.name} · {d.classes.length} class{d.classes.length === 1 ? "" : "es"}</>} actions={<label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><span className="lbl">Date</span><input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={{ width: 160, padding: "7px 10px", fontSize: 13 }} /></label>} />

      {d.classes.length === 0 ? (
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <Status tone="neu">No classes on this date</Status>
          <div className="dsp">Nothing scheduled</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>You have {d.weekly_timetable.length} periods across the week. Pick another date to open a register.</div>
        </div>
      ) : next ? (
        <div className="card" style={{ borderColor: "var(--cau)", background: "var(--cau-tint)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <Status tone="cau">Register not submitted</Status>
          <div className="dsp">{next.class_name} · {open.length} of {d.classes.length} registers still open</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{next.starts_at}–{next.ends_at} in room {next.room_number} · {next.marked_count} of {next.student_count} marked so far</div>
          <div className="btnrow"><Link className="btn pri" to={`/attendance/${next.class_section_id}?date=${date}`}>Mark register</Link><Link className="btn" to="/attendance">All classes</Link></div>
        </div>
      ) : (
        <div className="card" style={{ borderColor: "var(--pos)", background: "var(--pos-bg)", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <Status tone="pos">Nothing outstanding</Status>
          <div className="dsp">You are caught up</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>Every register for today is submitted.</div>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <div className="card-h"><b>Timetable</b><span className="faint" style={{ fontSize: 12.5 }}>{todaySlots.length} periods today</span></div>
          {todaySlots.length === 0 ? <Empty>No periods scheduled today.</Empty> : todaySlots.map((s) => {
            const cls = d.classes.find((c) => c.class_section_id === s.class_section_id);
            return (
              <div className="row" key={s.id}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 46, flexShrink: 0 }}>{s.starts_at}</span>
                <div className="rowtxt"><b>{s.class_name}</b><span>{s.subject_name} · {s.room} · period {s.period_number}</span></div>
                {cls ? <Status tone={submissionTone(cls.submission_status)}>{cls.submission_status === "submitted" ? "Marked" : cls.submission_status === "in_progress" ? "Partial" : "Not marked"}</Status> : null}
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-h"><b>Your classes</b></div>
          {d.classes.map((c) => (
            <div className="row" key={c.class_section_id}>
              <div className="rowtxt"><b>{c.class_name}</b><span>{c.student_count} students · {c.attending_count} present · {c.absent_count} absent{c.subjects?.length ? ` · ${c.subjects.join(", ")}` : ""}</span></div>
              <Status tone={submissionTone(c.submission_status)}>{c.submission_status === "submitted" ? "Submitted" : c.submission_status === "in_progress" ? "In progress" : "Open"}</Status>
              <Link className="btn sm" to={`/attendance/${c.class_section_id}?date=${date}`}>Open</Link>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
