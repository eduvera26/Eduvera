import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { staffApi, type AttendanceStatus } from "../features/staff";
import { useAuth } from "../lib/auth";
import { Empty, Initials, PageTitle, Skeleton, Status, attendanceTone, fmtDate, submissionTone, today, useToast } from "../components/ui";

/* ---------- class list ---------- */
export function AttendanceIndex() {
  const { persona } = useAuth();
  const [date, setDate] = useState(today());
  const teacher = useQuery({ queryKey: ["teacher-home", date], queryFn: () => staffApi.teacherHome(date), enabled: persona === "teacher" });
  const principal = useQuery({ queryKey: ["principal-home", date], queryFn: () => staffApi.principalHome(date), enabled: persona === "principal" });
  const q = persona === "principal" ? principal : teacher;
  const classes = persona === "principal" ? (principal.data?.classes ?? []) : (teacher.data?.classes ?? []);

  return (
    <>
      <PageTitle eyebrow="Attendance" title="Registers" sub={fmtDate(date)} actions={<label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><span className="lbl">Date</span><input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={{ width: 160, padding: "7px 10px", fontSize: 13 }} /></label>} />
      {q.isPending ? <Skeleton h={220} /> : classes.length === 0 ? <div className="card"><Empty>No classes on this date. Pick another day above.</Empty></div> : (
        <div className="card">
          {classes.map((c) => (
            <div className="row" key={c.class_section_id}>
              <div className="rowtxt"><b>{c.class_name}</b><span>Room {c.room_number} · {c.starts_at}–{c.ends_at} · {c.marked_count} of {c.student_count} marked</span></div>
              <Status tone={submissionTone(c.submission_status)}>{c.submission_status === "submitted" ? "Submitted" : c.submission_status === "in_progress" ? "In progress" : "Not started"}</Status>
              <Link className="btn sm" to={`/attendance/${c.class_section_id}?date=${date}`}>Open register</Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- one register ---------- */
const MARKS: Array<{ code: AttendanceStatus; label: string; cls?: string }> = [
  { code: "present", label: "Present" },
  { code: "absent", label: "Absent", cls: "g" },
  { code: "late", label: "Late", cls: "w" },
  { code: "excused", label: "Excused" },
];

export function RegisterPage() {
  const { classId = "" } = useParams();
  const [params] = useSearchParams();
  const date = params.get("date") ?? today();
  const qc = useQueryClient();
  const toast = useToast();
  const { persona } = useAuth();

  const reg = useQuery({ queryKey: ["register", classId, date], queryFn: () => staffApi.teacherAttendance(classId, date), enabled: Boolean(classId) });
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!reg.data) return;
    const initial: Record<string, AttendanceStatus> = {};
    for (const s of reg.data.roster) if (s.status) initial[s.id] = s.status;
    setMarks(initial); setDirty(false);
  }, [reg.data]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, half_day: 0, unmarked: 0 };
    for (const s of reg.data?.roster ?? []) { const m = marks[s.id]; if (m) c[m] += 1; else c.unmarked += 1; }
    return c;
  }, [marks, reg.data]);

  const submit = useMutation({
    mutationFn: () => staffApi.bulkAttendance({
      class_section_id: classId, date,
      records: Object.entries(marks).map(([student_id, status]) => ({ student_id, status })),
    }),
    onSuccess: (data) => {
      qc.setQueryData(["register", classId, date], data);
      void qc.invalidateQueries({ queryKey: ["teacher-home"] });
      void qc.invalidateQueries({ queryKey: ["principal-home"] });
      setDirty(false);
      toast(`${Object.keys(marks).length} records written in one request.`);
    },
    onError: (e: Error) => toast(e.message, true),
  });

  if (reg.isPending) return <><Skeleton h={34} w={340} /><Skeleton h={420} /></>;
  if (reg.isError || !reg.data) return <Empty>Could not load this register. {String((reg.error as Error)?.message ?? "")}</Empty>;

  const d = reg.data;
  const all = d.roster.length;
  const allMarked = counts.unmarked === 0 && all > 0;
  const submittedAlready = d.roster.every((s) => s.status);

  function mark(id: string, code: AttendanceStatus) { setMarks((m) => ({ ...m, [id]: code })); setDirty(true); }
  function markAll(code: AttendanceStatus) { const m: Record<string, AttendanceStatus> = {}; for (const s of d.roster) m[s.id] = code; setMarks(m); setDirty(true); }

  return (
    <>
      <PageTitle
        eyebrow={<><Link to="/attendance" style={{ color: "inherit", textDecoration: "none" }}>Attendance</Link> · {d.class.term}</>}
        title={`${d.class.name}`}
        sub={<>{fmtDate(d.date)} · Room {d.class.room} · {d.class.board} · {all} on roll{d.periods[0] ? ` · ${d.periods[0].display_title} ${d.periods[0].starts_at}–${d.periods[0].ends_at}` : ""}</>}
        actions={<>
          {submittedAlready && !dirty ? <Status tone="pos">Submitted</Status> : dirty ? <Status tone="cau">Unsaved changes</Status> : <Status tone="cri">Not submitted</Status>}
          <button className="btn" onClick={() => markAll("present")}>Mark all present</button>
          <button className="btn pri" disabled={!allMarked || !dirty || submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? "Submitting…" : submittedAlready ? "Save changes" : "Submit register"}</button>
        </>}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {(["present", "absent", "late", "excused"] as const).map((k) => (
          <div className="card" key={k} style={{ padding: "10px 16px", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="big" style={{ fontSize: 22 }}>{counts[k]}</span><span className="muted" style={{ fontSize: 12.5 }}>{k[0]!.toUpperCase() + k.slice(1)}</span>
          </div>
        ))}
        <div className="card" style={{ padding: "10px 16px", display: "flex", alignItems: "baseline", gap: 8, borderColor: counts.unmarked ? "var(--cau)" : undefined }}>
          <span className="big" style={{ fontSize: 22, color: counts.unmarked ? "var(--cau-ink)" : undefined }}>{counts.unmarked}</span><span className="muted" style={{ fontSize: 12.5 }}>Unmarked</span>
        </div>
        <div className="faint" style={{ alignSelf: "center", fontSize: 12.5, marginLeft: "auto" }}>Submitting writes the whole register in one request.</div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th className="num" style={{ width: 56 }}>Roll</th><th>Student</th><th>Admission</th><th>Mark</th><th>Last saved</th></tr></thead>
            <tbody>
              {d.roster.map((s) => {
                const m = marks[s.id];
                return (
                  <tr key={s.id} style={{ background: m ? undefined : "var(--cau-tint)" }}>
                    <td className="num muted">{s.roll_number}</td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Initials name={s.name} src={s.avatar_url} /><b style={{ fontWeight: 600 }}>{s.name}</b></div></td>
                    <td className="mono muted" style={{ fontSize: 12.5 }}>{s.admission_number}</td>
                    <td>
                      <div className="seg" role="group" aria-label={`Mark ${s.name}`}>
                        {MARKS.map((k) => (
                          <button key={k.code} className={k.cls} aria-pressed={m === k.code} onClick={() => mark(s.id, k.code)} disabled={persona !== "teacher" && persona !== "principal"}>{k.label}</button>
                        ))}
                      </div>
                    </td>
                    <td>{s.status ? <Status tone={attendanceTone(s.status)}>{s.status[0]!.toUpperCase() + s.status.slice(1).replace("_", " ")}</Status> : <span className="faint" style={{ fontSize: 12.5 }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
