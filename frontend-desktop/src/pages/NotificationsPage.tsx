import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normaliseNotifications, staffApi } from "../features/staff";
import { Empty, PageTitle, Skeleton, Status, fmtDate } from "../components/ui";

export function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: staffApi.notifications, select: normaliseNotifications });
  const read = useMutation({
    mutationFn: (id: string) => staffApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <>
      <PageTitle eyebrow="Notifications" title="Inbox" sub={unread ? `${unread} unread` : "Nothing unread"} />
      {q.isPending ? <Skeleton h={220} /> : items.length === 0 ? <div className="card"><Empty>No notifications yet.</Empty></div> : (
        <div className="card">
          {items.map((n) => (
            <div className="row" key={n.id} style={{ background: n.read_at ? undefined : "var(--raised)" }}>
              <Status tone={n.read_at ? "neu" : "inf"}>{n.read_at ? "Read" : "New"}</Status>
              <div className="rowtxt"><b>{n.title}</b><span>{n.body}</span><span>{fmtDate(n.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
              {!n.read_at ? <button className="btn sm" disabled={read.isPending} onClick={() => read.mutate(n.id)}>Mark read</button> : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
