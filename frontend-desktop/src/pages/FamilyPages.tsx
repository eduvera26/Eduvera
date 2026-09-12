import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { familyApi, type Leave, type Slot } from "../features/family";
import { useAuth } from "../lib/auth";
import { Empty, PageTitle, Skeleton, Status, fmtDate, leaveTone, plain, today, useToast } from "../components/ui";

/* ---------- timetable (both personas) ---------- */
export function FamilyTimetablePage() {
  const { persona, child } = useAuth();
  const q = useQuery({
    queryKey: ["family-timetable", persona, child],
    queryFn: async () => {
      if (persona === "student") { const w = await familyApi.studentWeek(); return { title: w.class_name, days: w.days }; }
      const [home, tt] = await Promise.all([familyApi.parentHome(child ?? undefined), familyApi.timetable(child ?? undefined)]);
      const grouped = new Map<number, { weekday: number; weekday_label: string; periods: Slot[] }>();
      for (const s of tt.results) {
        const g = grouped.get(s.weekday) ?? { weekday: s.weekday, weekday_label: s.weekday_label, periods: [] };
        g.periods.push(s); grouped.set(s.weekday, g);
      }
      return { title: `${home.student.user.display_name} · ${home.student.current_enrollment.class_name}`, days: [...grouped.values()].sort((a, b) => a.weekday - b.weekday) };
    },
  });
  if (q.isPending) return <><Skeleton h={34} w={320} /><Skeleton h={380} /></>;
  if (q.isError || !q.data) return <Empty>Could not load the timetable.</Empty>;
  const days = q.data.days.map((d) => ({ ...d, periods: [...d.periods].sort((a, b) => a.period_number - b.period_number) }));
  const periods = [...new Set(days.flatMap((d) => d.periods.map((p) => p.period_number)))].sort((a, b) => a - b);
  return (
    <>
      <PageTitle eyebrow="Timetable" title="This week" sub={q.data.title} />
      <div className="card"><div className="tbl-wrap">
        <table className="tbl" style={{ tableLayout: "fixed", minWidth: 720 }}>
          <thead><tr><th style={{ width: 80 }}>Period</th>{days.map((d) => <th key={d.weekday}>{d.weekday_label}</th>)}</tr></thead>
          <tbody>{periods.map((p) => (
            <tr key={p}>
              <td className="muted" style={{ fontSize: 12 }}><b style={{ color: "var(--ink)", fontWeight: 600 }}>P{p}</b></td>
              {days.map((d) => {
                const s = d.periods.find((x) => x.period_number === p);
                if (!s) return <td key={d.weekday} className="faint">—</td>;
                return <td key={d.weekday} style={{ verticalAlign: "top" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <b style={{ fontWeight: 600, fontSize: 13 }}>{s.subject?.name ?? s.display_title}</b>
                    <span className="faint" style={{ fontSize: 12 }}>{s.starts_at}–{s.ends_at}{s.room ? ` · ${s.room}` : ""}{s.teacher ? ` · ${s.teacher.name}` : ""}</span>
                  </div></td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div></div>
    </>
  );
}

/* ---------- diary (both personas) ---------- */
export function FamilyDiaryPage() {
  const { persona, child } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const to = today();
  const from = useMemo(() => { const d = new Date(`${to}T00:00:00`); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); }, [to]);
  const q = useQuery({ queryKey: ["family-diary", persona, child, from, to], queryFn: () => familyApi.diary(from, to, persona === "parent" ? child ?? undefined : undefined) });
  const home = useQuery({ queryKey: ["parent-home", child], queryFn: () => familyApi.parentHome(child ?? undefined), enabled: persona === "parent" });
  const me = useQuery({ queryKey: ["student-home"], queryFn: familyApi.studentHome, enabled: persona === "student" });
  const studentId = persona === "parent" ? (home.data?.student.id ?? child ?? "") : (me.data?.student.id ?? "");
  const ack = useMutation({
    mutationFn: (id: string) => familyApi.acknowledge(id, studentId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["family-diary"] }); toast("Acknowledged."); },
    onError: (e: Error) => toast(e.message, true),
  });
  if (q.isPending) return <><Skeleton h={34} w={300} /><Skeleton h={300} /></>;
  const items = q.data?.results ?? [];
  return (
    <>
      <PageTitle eyebrow="Diary" title="Last two weeks" sub={<>{fmtDate(from, { day: "numeric", month: "short" })} – {fmtDate(to, { day: "numeric", month: "short" })} · {items.length} entries</>} />
      {items.length === 0 ? <div className="card"><Empty>Nothing in the diary for this period.</Empty></div> : (
        <div className="card">{items.map((d) => (
          <div className="row" key={d.id} style={{ alignItems: "flex-start" }}>
            <Status tone={d.item_type === "homework" ? "cau" : d.item_type === "announcement" ? "inf" : "neu"}>{d.item_type_label}</Status>
            <div className="rowtxt">
              <b>{d.title}</b>
              <span>{fmtDate(d.date, { weekday: "short", day: "numeric", month: "short" })}{d.subject ? ` · ${d.subject.name}` : ""} · {d.author_name}{d.due_at ? ` · due ${fmtDate(d.due_at, { day: "numeric", month: "short" })}` : ""}</span>
              <span style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{d.body}</span>
            </div>
            {d.requires_acknowledgement ? (d.acknowledged ? <Status tone="pos">Acknowledged</Status> : <button className="btn sm pri" disabled={ack.isPending || !studentId} onClick={() => ack.mutate(d.id)}>Acknowledge</button>) : null}
          </div>
        ))}</div>
      )}
    </>
  );
}

/* ---------- leave (parent authorises; student applies and tracks) ---------- */
function LeaveCard({ l, actions }: { l: Leave; actions?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <b style={{ fontSize: 15 }}>{l.category_label ?? plain(l.category)}</b>
        <Status tone={leaveTone(l.status)}>{l.status_label ?? plain(l.status)}</Status>
        <span className="muted" style={{ fontSize: 13 }}>{fmtDate(l.starts_on, { day: "numeric", month: "short" })}{l.ends_on !== l.starts_on ? ` – ${fmtDate(l.ends_on, { day: "numeric", month: "short" })}` : ""} · {l.duration_days} day{l.duration_days === 1 ? "" : "s"}</span>
      </div>
      {l.reason ? <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>{l.reason}</div> : null}
      <div style={{ fontSize: 12, color: "var(--faint)" }}>Requested by {l.requested_by_name}{l.guardian_authorized_by_name ? ` · authorised by ${l.guardian_authorized_by_name}` : ""}{l.decided_by_name ? ` · decided by ${l.decided_by_name}` : ""}{l.documents.length ? ` · ${l.documents.length} document${l.documents.length === 1 ? "" : "s"}` : ""}</div>
      {actions}
    </div>
  );
}

export function ParentLeavePage() {
  const { child } = useAuth();
  const qc = useQueryClient(); const toast = useToast();
  const [note, setNote] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ["parent-leaves", child], queryFn: () => familyApi.leaves(child ?? undefined) });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "authorize" | "clarify" | "decline" }) => familyApi.leaveAction(id, action, note[id]?.trim() || undefined),
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: ["parent-leaves"] }); void qc.invalidateQueries({ queryKey: ["parent-home"] }); toast(v.action === "authorize" ? "Authorised — the school will now review it." : v.action === "decline" ? "Declined." : "Clarification requested."); },
    onError: (e: Error) => toast(e.message, true),
  });
  if (q.isPending) return <><Skeleton h={34} w={300} /><Skeleton h={220} /></>;
  const rows = q.data?.results ?? [];
  const pending = rows.filter((l) => l.status === "pending_guardian");
  const rest = rows.filter((l) => l.status !== "pending_guardian");
  return (
    <>
      <PageTitle eyebrow="Leave" title="Leave requests" sub="A request needs your authorisation before the school reviews it." />
      {pending.length ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="lbl">Waiting for you</div>
        {pending.map((l) => <LeaveCard key={l.id} l={l} actions={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
            <input className="input" placeholder="Note (required to ask for clarification)" value={note[l.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [l.id]: e.target.value }))} style={{ flex: "1 1 240px", fontSize: 13.5, padding: "8px 11px" }} />
            <button className="btn pri" disabled={act.isPending} onClick={() => act.mutate({ id: l.id, action: "authorize" })}>Authorise</button>
            <button className="btn" disabled={act.isPending || !(note[l.id]?.trim())} onClick={() => act.mutate({ id: l.id, action: "clarify" })}>Ask for clarification</button>
            <button className="btn danger" disabled={act.isPending} onClick={() => act.mutate({ id: l.id, action: "decline" })}>Decline</button>
          </div>} />)}
      </div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="lbl">History</div>
        {rest.length === 0 ? <div className="card"><Empty>No other leave requests.</Empty></div> : rest.map((l) => <LeaveCard key={l.id} l={l} />)}
      </div>
    </>
  );
}

export function StudentLeavePage() {
  const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ["student-leave"], queryFn: familyApi.studentLeaveStatus });
  const [form, setForm] = useState({ category: "medical", starts_on: today(), ends_on: today(), reason: "" });
  const [open, setOpen] = useState(false);
  const create = useMutation({
    mutationFn: () => familyApi.createLeave(form),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["student-leave"] }); void qc.invalidateQueries({ queryKey: ["student-home"] }); setOpen(false); setForm({ category: "medical", starts_on: today(), ends_on: today(), reason: "" }); toast("Submitted — your guardian will be asked to authorise it."); },
    onError: (e: Error) => toast(e.message, true),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => familyApi.leaveAction(id, "withdraw"),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["student-leave"] }); toast("Withdrawn."); },
    onError: (e: Error) => toast(e.message, true),
  });
  function submit(e: FormEvent) { e.preventDefault(); create.mutate(); }
  if (q.isPending) return <><Skeleton h={34} w={300} /><Skeleton h={220} /></>;
  const d = q.data;
  return (
    <>
      <PageTitle eyebrow="Leave" title="Your leave" sub="Requests go to your guardian first, then to the school." actions={<button className="btn pri" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "Request leave"}</button>} />
      {open ? (
        <form onSubmit={submit} className="card" style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label className="field"><span className="lbl">Category</span>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{["medical", "family", "travel", "personal"].map((c) => <option key={c} value={c}>{plain(c)}</option>)}</select></label>
          <label className="field"><span className="lbl">From</span><input className="input" type="date" required value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value, ends_on: form.ends_on < e.target.value ? e.target.value : form.ends_on })} /></label>
          <label className="field"><span className="lbl">To</span><input className="input" type="date" required min={form.starts_on} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></label>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span className="lbl">Reason</span><textarea className="input" required minLength={10} rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="What the school needs to know" /></label>
          <div style={{ gridColumn: "1 / -1" }}><button className="btn pri" type="submit" disabled={create.isPending}>{create.isPending ? "Submitting…" : "Submit request"}</button></div>
        </form>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="lbl">In progress</div>
        {!d?.active.length ? <div className="card"><Empty>No leave in progress.</Empty></div> : d.active.map((l) => <LeaveCard key={l.id} l={l} actions={
          l.status === "pending_guardian" ? <div style={{ paddingTop: 10, borderTop: "1px solid var(--line-3)" }}><button className="btn sm danger" disabled={withdraw.isPending} onClick={() => withdraw.mutate(l.id)}>Withdraw</button></div> : null} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="lbl">History</div>
        {!d?.history.length ? <div className="card"><Empty>No past requests.</Empty></div> : d.history.map((l) => <LeaveCard key={l.id} l={l} />)}
      </div>
    </>
  );
}
