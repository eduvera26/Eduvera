// Same session + CSRF conventions as the mobile client: HttpOnly session cookie,
// readable signed csrftoken cookie echoed back in X-CSRFToken on every mutation.

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function cookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(prefix))?.slice(prefix.length);
}

function firstMessage(value: unknown, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) for (const v of value) { const m = firstMessage(v, depth + 1); if (m) return m; }
  if (typeof value === "object" && value !== null) for (const v of Object.values(value)) { const m = firstMessage(v, depth + 1); if (m) return m; }
  return undefined;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = cookie("csrftoken");
    if (token) headers.set("X-CSRFToken", decodeURIComponent(token));
  }
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const body: unknown = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("omnischool:session-expired"));
    const err = typeof body === "object" && body !== null && "error" in body ? (body as { error: unknown }).error : body;
    const detail = typeof err === "object" && err !== null && "detail" in err ? (err as { detail: unknown }).detail : undefined;
    throw new ApiError(typeof detail === "string" ? detail : firstMessage(body) ?? `Request failed (${response.status})`, response.status, body);
  }
  return body as T;
}

export function withQuery(path: string, values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) params.set(k, v);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
