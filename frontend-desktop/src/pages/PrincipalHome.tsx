import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { staffApi } from "../features/staff";
import { Empty, PageTitle, Skeleton, Stat, Status, fmtDate, submissionTone, today } from "../components/ui";

/* Leadership opens on exceptions, not on a generic dashboard:
   what is missing, who is below threshold, what needs a decision. */
export function PrincipalHome() {
  const [date, setDate] = useState(today());
  const home = useQuery({ queryKey: ["principal-home", date], queryFn: () => staffApi.principalHome(date) });
  const leaves = useQuery({ queryKey: ["leaves", "authorized"], queryFn: () => staffApi.leaves("authorized") });

  if (home.isPending) return <><Skeleton h={34} w={420} /><div className="grid4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={96} />)}</div></>;
  if (home.isError || !home.data) return <Empty>Could not load the school summary. {String((home.error as Error)?.message ?? "")}</Empty>;

  const d = home.data;
  const s = d.summary;
  const missing = d.classes.filter((c) => c.submission_status !== "submitted");
  const pendingLeaves = leaves.data?.results ?? [];

  return (
    <>
      <PageTitle
        title="What needs your attention today?"
        sub={<>{fmtDate(d.date)} · {s.students} students on roll · {d.principal.name}</>}
        actions={<label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><span className="lbl">Date</span><input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={{ width: 160, padding: "7px 10px", fontSize: 13 }} /></label>}
      />

      <div className="grid4">
        <Stat label="Attendance today" value={`${s.attendance_percentage.toFixed(1)}%`} tone={s.attendance_percentage < 90 ? "cau" : "pos"} note={<>{s.attending} of {s.marked} marked present</>} />
        <Stat label="Registers submitted" value={<>{s.classes_submitted}<span style={{ fontSize: 18, color: "var(--muted)" }}> / {s.classes_total}</span></>} tone={missing.length ? "cri" : "pos"} note={missing.length ? <>{missing.length} still open</> : "All classes in"} />
        <Stat label="Absent" value={s.absent} tone={s.absent ? "cri" : "pos"} note={<>{s.late} arrived late</>} />
        <Stat label="Below threshold" value={d.exceptions.length} tone={d.exceptions.length ? "cau" : "pos"} note="students this term" />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-h"><b>Registers</b><span className="faint" style={{ fontSize: 12.5 }}>{d.classes.length} classes</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Class</th><th>Room</th><th className="num">Roll</th><th className="num">Present</th><th className="num">Absent</th><th className="num">Attendance</th><th>Register</th><th></th></tr></thead>
              <tbody>
                {d.classes.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="muted">{c.room_number}</td>
                    <td className="num">{c.student_count}</td>
                    <td className="num">{c.attending_count}</td>
                    <td className="num" style={{ color: c.absent_count ? "var(--cri)" : undefined }}>{c.absent_count}</td>
                    <td className="num">{c.marked_count ? `${c.attendance_percentage.toFixed(1)}%` : <span className="faint">—</span>}</td>
                    <td><Status tone={submissionTone(c.submission_status)}>{c.submission_status === "submitted" ? "Submitted" : c.submission_status === "in_progress" ? "In progress" : "Not started"}</Status></td>
                    <td><Link className="btn sm" to={`/attendance/${c.id}?date=${date}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h"><b>Leave awaiting your decision</b><Link to="/leave" className="faint" style={{ fontSize: 12.5 }}>All requests</Link></div>
            {leaves.isPending ? <div style={{ padding: 16 }}><Skeleton h={40} /></div>
              : pendingLeaves.length === 0 ? <Empty>Nothing waiting on you.</Empty>
              : pendingLeaves.slice(0, 5).map((l) => (
                <div className="row" key={l.id}>
                  <div className="rowtxt">
                    <b>{l.student?.display_name ?? l.student?.name ?? l.student_name ?? "Student"} · {l.category}</b>
                    <span>{fmtDate(l.starts_on, { day: "numeric", month: "short" })} · {l.duration_days} day{l.duration_days === 1 ? "" : "s"} · authorised by {l.guardian_authorized_by_name ?? "guardian"}</span>
                  </div>
                  <Link className="btn sm" to={`/leave?focus=${l.id}`}>Review</Link>
                </div>
              ))}
          </div>

          <div className="card">
            <div className="card-h"><b>Below attendance threshold</b><span className="faint" style={{ fontSize: 12.5 }}>{d.exceptions.length}</span></div>
            {d.exceptions.length === 0 ? <Empty>No student is below the threshold this term.</Empty>
              : d.exceptions.slice(0, 6).map((x) => (
                <div className="row" key={x.id}>
                  <Status tone={x.percentage < x.threshold - 10 ? "cri" : "cau"}>{x.percentage.toFixed(1)}%</Status>
                  <div className="rowtxt"><b>{x.name}</b><span>{x.class_name} · <span className="mono">{x.admission_number}</span> · threshold {x.threshold}% · {x.recorded_days} days recorded</span></div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
