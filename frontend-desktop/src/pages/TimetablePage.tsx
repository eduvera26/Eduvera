import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { staffApi } from "../features/staff";
import { Empty, PageTitle, Skeleton, Status } from "../components/ui";

const DAYS = [1, 2, 3, 4, 5, 6];

/* Principal timetable: the whole school on a grid, with clashes surfaced first. */
export function TimetablePage() {
  const tt = useQuery({ queryKey: ["principal-timetable"], queryFn: staffApi.principalTimetable });
  const [classId, setClassId] = useState<string>("");

  const view = useMemo(() => {
    if (!tt.data) return null;
    const cls = classId || tt.data.classes[0]?.id || "";
    const slots = tt.data.slots.filter((s) => s.class_section_id === cls);
    const periods = [...new Set(slots.map((s) => s.period_number))].sort((a, b) => a - b);
    const dayLabels = new Map<number, string>();
    for (const s of tt.data.slots) dayLabels.set(s.weekday, s.weekday_label);
    const conflictIds = new Set<string>();
    for (const c of tt.data.conflicts) { conflictIds.add(c.first_slot_id); conflictIds.add(c.second_slot_id); }
    return { cls, slots, periods, dayLabels, conflictIds };
  }, [tt.data, classId]);

  if (tt.isPending) return <><Skeleton h={34} w={300} /><Skeleton h={420} /></>;
  if (tt.isError || !tt.data || !view) return <Empty>Could not load the timetable.</Empty>;

  const d = tt.data;
  const days = DAYS.filter((w) => view.dayLabels.has(w));

  return (
    <>
      <PageTitle
        eyebrow="Timetable"
        title="School timetable"
        sub={<>{d.classes.length} classes · {d.subjects.length} subjects · {d.teachers.length} teachers · {d.slots.length} slots</>}
        actions={<label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><span className="lbl">Class</span>
          <select className="input" value={view.cls} onChange={(e) => setClassId(e.target.value)} style={{ width: 200, padding: "7px 10px", fontSize: 13 }}>
            {d.classes.map((c) => <option key={c.id} value={c.id}>{c.name} · room {c.room_number}</option>)}
          </select></label>}
      />

      {d.conflicts.length ? (
        <div className="card" style={{ borderColor: "var(--cri)" }}>
          <div className="card-h"><b>Clashes to resolve</b><Status tone="cri">{d.conflicts.length}</Status></div>
          {d.conflicts.map((c, i) => {
            const a = d.slots.find((s) => s.id === c.first_slot_id); const b = d.slots.find((s) => s.id === c.second_slot_id);
            return (
              <div className="row" key={i}>
                <Status tone="cri">{c.type === "teacher" ? "Teacher" : "Room"}</Status>
                <div className="rowtxt"><b>{a?.class_name} and {b?.class_name}</b><span>{a?.weekday_label} {c.starts_at}–{c.ends_at} · {c.type === "teacher" ? (a?.teacher_name ?? "same teacher") : (a?.room ?? "same room")} is double-booked</span></div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}><Status tone="pos">No clashes</Status><span className="muted" style={{ fontSize: 13 }}>No teacher or room is double-booked this week.</span></div>
      )}

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl" style={{ tableLayout: "fixed", minWidth: 760 }}>
            <thead><tr><th style={{ width: 90 }}>Period</th>{days.map((w) => <th key={w}>{view.dayLabels.get(w)}</th>)}</tr></thead>
            <tbody>
              {view.periods.map((p) => {
                const first = view.slots.find((s) => s.period_number === p);
                return (
                  <tr key={p}>
                    <td className="muted" style={{ fontSize: 12 }}><b style={{ color: "var(--ink)", fontWeight: 600 }}>P{p}</b><br />{first?.starts_at}–{first?.ends_at}</td>
                    {days.map((w) => {
                      const s = view.slots.find((x) => x.period_number === p && x.weekday === w);
                      if (!s) return <td key={w} className="faint">—</td>;
                      const subj = d.subjects.find((x) => x.id === s.subject_id);
                      const clash = view.conflictIds.has(s.id);
                      return (
                        <td key={w} style={{ verticalAlign: "top" }}>
                          <div style={{ borderLeft: `3px solid ${clash ? "var(--cri)" : subj?.color ?? "var(--line-2)"}`, paddingLeft: 9, display: "flex", flexDirection: "column", gap: 2 }}>
                            <b style={{ fontWeight: 600, fontSize: 13 }}>{s.slot_type === "class" ? (subj?.name ?? s.display_title) : s.display_title}</b>
                            <span className="faint" style={{ fontSize: 12 }}>{s.teacher_name ?? (s.slot_type === "class" ? "Unassigned" : "")}{s.room ? ` · ${s.room}` : ""}</span>
                            {clash ? <Status tone="cri">Clash</Status> : s.slot_type === "class" && !s.teacher_user_id ? <Status tone="cau">No teacher</Status> : null}
                          </div>
                        </td>
                      );
                    })}
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
