import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../../lib/api";

export function ScreenLoading() {
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <span className="route-loader__mark" aria-hidden="true" />
      <span>Syncing school records…</span>
    </div>
  );
}

interface LiveRouteErrorProps {
  error: unknown;
  onRetry: () => unknown;
}

export function LiveRouteError({ error, onRetry }: LiveRouteErrorProps) {
  const { refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const unauthorized = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (!unauthorized) return;
    const next = `${location.pathname}${location.search}`;
    void refresh().finally(() => {
      void navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
    });
  }, [location.pathname, location.search, navigate, refresh, unauthorized]);

  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const Icon = unauthorized ? ShieldAlert : AlertTriangle;
  return (
    <main className="live-route-error" role="alert" aria-live="assertive">
      <span className="live-route-error__icon" aria-hidden="true"><Icon size={24} /></span>
      <span className="live-route-error__eyebrow">Edura OS • Live records</span>
      <h1>{unauthorized ? "Your secure session has ended." : "We couldn’t sync this view."}</h1>
      <p>
        {unauthorized
          ? "Taking you to sign in. Your intended page will open after you reconnect."
          : "No placeholder records are being shown. Check your connection and try the school service again."}
      </p>
      {!unauthorized ? (
        <button type="button" disabled={retrying} onClick={() => void retry()}>
          <RefreshCw className={retrying ? "spin" : undefined} size={17} />
          {retrying ? "Trying again…" : "Retry live records"}
        </button>
      ) : null}
    </main>
  );
}
