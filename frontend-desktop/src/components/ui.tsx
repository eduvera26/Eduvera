import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/* ---------- status: colour + shape + word ---------- */
export type Tone = "pos" | "cau" | "cri" | "inf" | "neu";

const GLYPH: Record<Tone, ReactNode> = {
  pos: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>,
  cau: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M10 2.5L18.5 17.5H1.5z" /></svg>,
  cri: <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /></svg>,
  inf: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="10" cy="10" r="7" /></svg>,
  neu: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2.6" aria-hidden="true"><circle cx="10" cy="10" r="7" /></svg>,
};

export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`st ${tone}`}>{GLYPH[tone]}{children}</span>;
}

export function attendanceTone(status: string | null | undefined): Tone {
  switch (status) {
    case "present": return "pos";
    case "late": case "half_day": return "cau";
    case "absent": return "cri";
    case "excused": return "inf";
    default: return "neu";
  }
}
export function submissionTone(s: "not_started" | "in_progress" | "submitted"): Tone {
  return s === "submitted" ? "pos" : s === "in_progress" ? "cau" : "cri";
}
export function leaveTone(status: string): Tone {
  if (status === "approved") return "pos";
  if (status === "rejected" || status === "declined" || status === "withdrawn") return "neu";
  if (status.startsWith("pending") || status === "authorized") return "cau";
  return "inf";
}
export const plain = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/* ---------- toasts ---------- */
interface Toast { id: number; text: string; bad?: boolean }
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, bad?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, bad }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast${t.bad ? " bad" : ""}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- small blocks ---------- */
export function Stat({ label, value, tone, note }: { label: string; value: ReactNode; tone?: Tone; note?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="lbl">{label}</div>
      <div className="big v">{value}</div>
      {note ? <div style={{ fontSize: 12.5, color: tone ? `var(--${tone === "cau" ? "cau-ink" : tone})` : "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>{note}</div> : null}
    </div>
  );
}

export function Initials({ name, src }: { name: string; src?: string | null }) {
  const ini = name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return <div className="av">{src ? <img src={src} alt="" /> : ini}</div>;
}

export function Skeleton({ h = 18, w = "100%" }: { h?: number; w?: string | number }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageTitle({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="head">
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div className="lbl">{eyebrow}</div> : null}
        <h1 className="dsp" style={{ marginTop: eyebrow ? 5 : 0 }}>{title}</h1>
        {sub ? <div style={{ fontSize: 13, color: "var(--faint)", marginTop: 5 }}>{sub}</div> : null}
      </div>
      {actions ? <div className="btnrow">{actions}</div> : null}
    </div>
  );
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(undefined, opts).format(d);
}
export const today = () => new Date().toISOString().slice(0, 10);
