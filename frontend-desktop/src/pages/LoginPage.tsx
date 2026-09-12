import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { status, persona, login, demoMode } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "signed-in" && persona) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(identifier.trim(), password); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  const notStaff = status === "signed-in" && !persona;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={submit} className="card" style={{ width: "min(400px, 100%)", padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, letterSpacing: ".14em", fontWeight: 700 }}>OMNISCHOOL</div>
          <h1 className="dsp" style={{ marginTop: 10 }}>Sign in</h1>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>Principals, teachers, guardians and students all sign in here. What you see is decided by your school membership.</p>
        </div>

        {notStaff ? (
          <div style={{ background: "var(--cau-bg)", color: "var(--cau-ink)", borderRadius: 7, padding: "11px 13px", fontSize: 13, lineHeight: 1.5 }}>
            This account has no active school membership yet. Ask your school to complete onboarding, or try the <a href={import.meta.env.DEV ? "http://127.0.0.1:5173/" : "/"}>mobile app</a>.
          </div>
        ) : null}

        <label className="field">
          <span className="lbl">Username or email</span>
          <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="field">
          <span className="lbl">Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        {error ? <div style={{ color: "var(--cri)", fontSize: 13 }}>{error}</div> : null}

        <button className="btn pri" type="submit" disabled={busy} style={{ padding: 12 }}>{busy ? "Signing in…" : "Sign in"}</button>

        {demoMode ? (
          <div style={{ fontSize: 12.5, color: "var(--faint)", lineHeight: 1.6 }}>
            Demo accounts · password <span className="mono">OmniDemo@2026</span><br />
            <span className="mono">meera.principal</span> · <span className="mono">kavita.staff</span> · <span className="mono">pooja.parent</span> · <span className="mono">aarav.student</span>
          </div>
        ) : null}
      </form>
    </div>
  );
}
