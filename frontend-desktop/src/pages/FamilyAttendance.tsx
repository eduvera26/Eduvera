import { useQuery } from "@tanstack/react-query";
import { familyApi, type AttendanceRecord, type AttendanceSummary, type SubjectAttendance } from "../features/family";
import { useAuth } from "../lib/auth";
import { Empty, PageTitle, Skeleton, Stat, Status, attendanceTone, fmtDate, plain } from "../components/ui";
import { ChildSwitcher } from "./FamilyHome";

function SummaryTiles({ s, threshold }: { s: AttendanceSummary; threshold: number }) {
  return (
    <div className="grid4">
      <Stat label="This term" value={`${s.percentage.toFixed(1)}%`} tone={s.percentage < threshold ? "cau" : "pos"} note={<>threshold {threshold}%</>} />
      <Stat label="Present" value={s.present} tone="pos" note={<>of {s.total} recorded days</>} />
      <Stat label="Absent" value={s.absent} tone={s.absent ? "cri" : "pos"} note={<>{s.excused} excused</>} />
      <Stat label="Late" value={s.late} tone={s.late ? "cau" : "pos"} note={<>{s.half_day} half days</>} />
    </div>
  );
}

function SubjectTable({ subjects }: { subjects: SubjectAttendance[] }) {
  if (!subjects.length) return null;
  return (
    <div className="card">
      <div className="card-h"><b>By subject</b><span className="faint" style={{ fontSize: 12.5 }}>{subjects.length} subjects</span></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Subject</th><th>Teacher</th><th className="num">Held</th><th className="num">Attended</th><th className="num">Attendance</th><th>Next</th></tr></thead>
        <tbody>{subjects.map((s) => {
          const pct = Number(s.percentage);
          return (
            <tr key={s.id}>
              <td><span style={{ display: "inline-block", width: 3, height: 14, background: s.subject.color, borderRadius: 2, marginRight: 9, verticalAlign: -2 }} /><b style={{ fontWeight: 600 }}>{s.subject.name}</b></td>
              <td className="muted">{s.teacher?.name ?? "—"}</td>
              <td className="num">{s.classes_held}</td><td className="num">{s.classes_attended}</td>
              <td className="num"><Status tone={pct < 75 ? "cri" : pct < 85 ? "cau" : "pos"}>{pct.toFixed(1)}%</Status></td>
              <td className="muted">{s.next_class ? `${s.next_class.weekday_label} ${s.next_class.starts_at}` : "—"}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </div>
  );
}

function Calendar({ records }: { records: AttendanceRecord[] }) {
  const recent = [...records].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  return (
    <div className="card">
      <div className="card-h"><b>Day by day</b><span className="faint" style={{ fontSize: 12.5 }}>last {recent.length} recorded days</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, padding: 14 }}>
        {recent.map((r) => (
          <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(r.date, { weekday: "short", day: "numeric", month: "short" })}</span>
            <Status tone={attendanceTone(r.status)}>{plain(r.status)}</Status>
            {r.check_in_at ? <span style={{ fontSize: 11.5, color: "var(--faint)" }}>in {fmtDate(r.check_in_at, { hour: "2-digit", minute: "2-digit" })}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ParentAttendancePage() {
  const { child } = useAuth();
  const q = useQuery({ queryKey: ["parent-attendance", child], queryFn: () => familyApi.parentAttendance(child ?? undefined) });
  const subjects = useQuery({ queryKey: ["subject-attendance", child], queryFn: () => familyApi.subjectAttendance(child ?? undefined) });
  if (q.isPending) return <><Skeleton h={34} w={340} /><Skeleton h={100} /><Skeleton h={300} /></>;
  if (q.isError || !q.data) return <Empty>Could not load attendance.</Empty>;
  const d = q.data;
  return (
    <>
      <PageTitle eyebrow="Attendance" title={d.student.user.display_name} sub={<>{d.student.current_enrollment.class_name} · {d.term.name} {d.term.academic_year}{d.today ? <> · today: <b>{plain(d.today.status)}</b></> : null}</>} />
      <ChildSwitcher current={d.student} siblings={[]} />
      <SummaryTiles s={d.summary} threshold={Number(d.term.threshold)} />
      <SubjectTable subjects={subjects.data?.results ?? []} />
      <Calendar records={d.calendar} />
    </>
  );
}

export function StudentAttendancePage() {
  const q = useQuery({ queryKey: ["student-attendance"], queryFn: familyApi.studentAttendance });
  if (q.isPending) return <><Skeleton h={34} w={340} /><Skeleton h={100} /><Skeleton h={300} /></>;
  if (q.isError || !q.data) return <Empty>Could not load attendance.</Empty>;
  const d = q.data;
  const r = d.ranking;
  return (
    <>
      <PageTitle eyebrow="Attendance" title="Your attendance" sub={<>{d.student.current_enrollment.class_name} · {d.term.name} {d.term.academic_year}</>} />
      <SummaryTiles s={d.summary} threshold={Number(d.term.threshold)} />
      <div className="grid2">
        <SubjectTable subjects={d.subjects} />
        {r?.published ? (
          <div className="card">
            <div className="card-h"><b>Class standing</b><span className="faint" style={{ fontSize: 12.5 }}>as of {fmtDate(r.as_of, { day: "numeric", month: "short" })}</span></div>
            <div style={{ padding: "14px 16px", display: "flex", gap: 20, alignItems: "baseline", borderBottom: "1px solid var(--line-3)" }}>
              <span className="big" style={{ fontSize: 30 }}>{r.current_rank ?? "—"}</span>
              <span className="muted" style={{ fontSize: 13 }}>of {r.cohort_size}{r.current_streak ? ` · ${r.current_streak}-day streak` : ""}</span>
            </div>
            {r.leaders.slice(0, 5).map((l) => (
              <div className="row" key={l.rank}><span style={{ width: 24, fontWeight: 600 }}>{l.rank}</span><div className="rowtxt"><b>{l.name}</b><span>{l.attended} of {l.held}</span></div><span style={{ fontWeight: 600 }}>{l.percentage.toFixed(1)}%</span></div>
            ))}
            <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--faint)" }}>{r.methodology}</div>
          </div>
        ) : null}
      </div>
    </>
  );
}
