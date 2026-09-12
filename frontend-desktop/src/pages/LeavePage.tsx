import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { staffApi, type LeaveRequest } from "../features/staff";
import { Empty, PageTitle, Skeleton, Status, fmtDate, leaveTone, plain, useToast } from "../components/ui";

const TABS: Array<{ id: string; label: string; status?: string }> = [
  { id: "authorized", label: "Awaiting decision", status: "authorized" },
  { id: "pending_guardian", label: "Awaiting guardian", status: "pending_guardian" },
  { id: "approved", label: "Approved", status: "approved" },
  { id: "rejected", label: "Rejected", status: "rejected" },
  { id: "all", label: "All" },
];

function who(l: LeaveRequest): string {
  return l.student?.display_name ?? l.student?.name ?? l.student_name ?? l.requested_by_name;
}

/* Leave is a decision queue. Every decision is attributed to the person who made it. */
export function LeavePage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === (params.get("tab") ?? "authorized")) ?? TABS[0]!;
  const focus = params.get("focus");
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState<Record<string, string>>({});

  const list = useQuery({ queryKey: ["leaves", tab.status ?? "all"], queryFn: () => staffApi.leaves(tab.status) });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" | "clarify" }) => staffApi.leaveAction(id, action, note[id]?.trim() || undefined),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["leaves"] });
      void qc.invalidateQueries({ queryKey: ["principal-home"] });
      toast(v.action === "approve" ? "Leave approved and the family notified." : v.action === "reject" ? "Leave rejected and the family notified." : "Clarification requested.");
    },
    onError: (e: Error) => toast(e.message, true),
  });

  const rows = list.data?.results ?? [];

  return (
    <>
      <PageTitle eyebrow="Leave requests" title="Decisions" sub="Approvals and rejections are recorded against your name and notify the family." />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === tab.id} className="btn sm" style={t.id === tab.id ? { background: "var(--ink)", color: "var(--ground)", borderColor: "var(--ink)" } : undefined}
            onClick={() => setParams((p) => { p.set("tab", t.id); p.delete("focus"); return p; })}>{t.label}</button>
        ))}
      </div>

      {list.isPending ? <Skeleton h={260} /> : rows.length === 0 ? <div className="card"><Empty>Nothing in this queue.</Empty></div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((l) => {
            const decidable = l.status === "authorized" || l.status === "pending_guardian";
            const isFocus = focus === l.id;
            return (
              <div key={l.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, borderColor: isFocus ? "var(--brand)" : undefined }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <b style={{ fontSize: 15 }}>{who(l)}</b>
                      <Status tone={leaveTone(l.status)}>{plain(l.status)}</Status>
                      <span className="st neu">{plain(l.category)}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>
                      {fmtDate(l.starts_on, { day: "numeric", month: "short" })}{l.ends_on && l.ends_on !== l.starts_on ? ` – ${fmtDate(l.ends_on, { day: "numeric", month: "short" })}` : ""} · {l.duration_days} day{l.duration_days === 1 ? "" : "s"}
                      {l.class_name || l.student?.class_name ? ` · ${l.class_name ?? l.student?.class_name}` : ""}
                    </div>
                    {l.reason ? <div style={{ fontSize: 13.5, marginTop: 8, color: "var(--ink-2)", lineHeight: 1.55 }}>{l.reason}</div> : null}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--faint)", textAlign: "right", lineHeight: 1.6 }}>
                    Requested by {l.requested_by_name}<br />
                    {l.guardian_authorized_by_name ? <>Authorised by {l.guardian_authorized_by_name}<br /></> : null}
                    {l.decided_by_name ? <>Decided by {l.decided_by_name} · {fmtDate(l.decided_at, { day: "numeric", month: "short" })}</> : null}
                    {l.documents.length ? <><br />{l.documents.length} document{l.documents.length === 1 ? "" : "s"}</> : null}
                  </div>
                </div>

                {decidable ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--line-3)" }}>
                    <input className="input" placeholder="Note to the family (optional, required for clarification)" value={note[l.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [l.id]: e.target.value }))} style={{ flex: "1 1 260px", fontSize: 13.5, padding: "8px 11px" }} />
                    <button className="btn pri" disabled={act.isPending} onClick={() => act.mutate({ id: l.id, action: "approve" })}>Approve</button>
                    <button className="btn danger" disabled={act.isPending} onClick={() => act.mutate({ id: l.id, action: "reject" })}>Reject</button>
                    <button className="btn" disabled={act.isPending || !(note[l.id]?.trim())} onClick={() => act.mutate({ id: l.id, action: "clarify" })}>Ask for clarification</button>
                  </div>
                ) : null}

                {l.audit_log?.length ? (
                  <details style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    <summary style={{ cursor: "pointer" }}>History · {l.audit_log.length}</summary>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                      {l.audit_log.map((a) => <div key={a.id}>{fmtDate(a.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {a.actor_name}{a.to_status ? ` · ${plain(a.to_status)}` : ""}{a.note ? ` — ${a.note}` : ""}</div>)}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
