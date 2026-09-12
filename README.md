# OmniSchool — Edura attendance vertical

OmniSchool is being built as a complete School OS. This repository contains the
first vertical: student, parent, teacher, and principal attendance and timetable
operations, leave, diary, secure accounts, notifications, and an attendance AI assistant. The visual language is
implemented from the supplied Stitch screens; product behavior that was not
shown in those screens (authentication, authorization, loading/error/empty
states, navigation, exports, and workflow integrity) is implemented explicitly.

The application runtime is TypeScript end to end, with a reproducible Python data generator for development and review environments:

- `frontend/` — React 19, TypeScript, Vite, TanStack Query, accessible responsive UI.
- `backend/` — NestJS 11 on Fastify 5, TypeScript, Kysely, PostgreSQL, OpenAPI.
- `backend/scripts/generate_school_data.py` — deterministic, relationship-validated medium-school fixture generation.
- `compose.yaml` — one-origin production-style image plus PostgreSQL.

The Node server is the sole backend. It owns `/api/v1`, health/OpenAPI routes,
authenticated uploads, and the compiled React history fallback.

## Quick start

Requirements: Docker with Compose v2.

```bash
docker compose up --build
```

Then open <http://127.0.0.1:8000>. Useful service routes:

- Liveness: <http://127.0.0.1:8000/healthz>
- PostgreSQL readiness: <http://127.0.0.1:8000/readyz>
- Swagger UI: <http://127.0.0.1:8000/api/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/api/schema>

Compose defaults are deliberately local/demo-only. Set a strong `COOKIE_SECRET`
and database password, set `DEMO_MODE=false` and `SEED_DEMO=false`, configure
exact `ALLOWED_ORIGINS`, and use `COOKIE_SECURE=true` for a real HTTPS deployment.

## Demo access

| Persona | Username | Password | Landing page |
|---|---|---|---|
| Parent | `pooja.parent` | `OmniDemo@2026` | `/parent/home` |
| Student | `aarav.student` | `OmniDemo@2026` | `/student` |
| Teacher | `kavita.staff` | `OmniDemo@2026` | `/teacher` |
| Principal | `meera.principal` | `OmniDemo@2026` | `/principal` |

The login screen also offers explicit parent/student demo buttons when
`DEMO_MODE=true`. Routes never silently impersonate a demo user. Public signup
creates a secure account in `pending_school_membership`; it exposes no school or
student records until an administrator links it to a school.

## Implemented web routes

| Parent experience | Student experience | Teacher experience | Principal experience |
|---|---|---|---|
| `/parent/home` | `/student` | `/teacher` | `/principal` |
| `/parent/attendance` | `/student/attendance` | `/teacher/attendance` | `/principal/attendance` |
| `/parent/leave` | `/student/attendance/eligibility` | `/teacher/timetable` | `/principal/timetable` |
| `/parent/diary` | `/student/leave/new` |  |  |
| `/parent/timetable` | `/student/leave` |  |  |
|  | `/student/timetable` |  |  |
|  | `/student/timetable/week` |  |  |
|  | `/student/copilot` |  |  |

The launcher names the broader School OS modules. Modules outside this attendance
pilot are clearly marked planned and do not expose fake working controls.

## Local development

Use PostgreSQL 14+ (including `psql`), Node.js 22+, and Python 3.11+.

```bash
cd backend
cp .env.example .env
npm ci
set -a; . ./.env; set +a
npm run db:migrate
npm run db:seed
npm run dev
```

`db:seed` non-destructively upserts a realistic Cambridge International School cohort: 200 students in eight sections, a primary guardian relationship for every student, 17 teachers/staff, one principal, two months of daily attendance, subject totals, conflict-free weekly timetables, gate events, leave workflows, diary activity, and notifications. The generator validates the graph before producing SQL; PostgreSQL repeats the critical checks inside one transaction. Run `npm run db:generate` when you only want the reviewable SQL and JSON summary without loading the database.

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Vite serves <http://127.0.0.1:5173> and proxies `/api` to port 8000. For the
single-origin build, run `npm run build` in `frontend`, set `SPA_DIST_DIR` in the
backend to the absolute `frontend/dist` path, and run `npm run build && npm start`
from `backend`.

## Authentication, authorization, and workflow integrity

- Passwords use Node's scrypt with per-password salts.
- Browser sessions are opaque signed cookies; only SHA-256 token hashes are kept
  in PostgreSQL. Session cookies are `HttpOnly`.
- Unsafe requests use a signed double-submit CSRF token, including login and
  registration. The explicit demo bootstrap is disabled outside demo mode.
- Every student lookup is scoped by active school membership plus student,
  guardian, or staff relationship. Identifiers from the browser are never trusted
  without this check.
- Leave changes are validated state transitions with audit records. Student
  multipart submission writes the request and supporting document atomically;
  guardian clarification is non-destructive; guardian-originated leave is
  immediately guardian-authorized for school review.
- API errors include a request ID. Rate-limit buckets are shared in PostgreSQL.

See [`backend/README.md`](backend/README.md) for the API and operational detail.

## Attendance Copilot

The AI boundary is provider-neutral:

- `AI_PROVIDER=ollama` uses local Ollama (the development default in Compose).
- `AI_PROVIDER=mock` is deterministic for tests and offline development.
- `AI_PROVIDER=openai-compatible` uses a configurable compatible chat endpoint.

For local Ollama:

```bash
ollama serve
ollama pull qwen3:8b
```

Set `OLLAMA_BASE_URL=http://127.0.0.1:11434` and `OLLAMA_MODEL=qwen3:8b` for a
host-run backend. The server—not the browser—builds bounded attendance context
after authorization. The assistant is read-only and advisory.

## Verification

```bash
cd frontend
npm run typecheck
npm run lint
npm test
npm run build

cd ../backend
npm run typecheck
npm run lint
npm run build
DATABASE_URL=postgresql://... npm test
npm audit --omit=dev

cd ..
docker compose config --quiet
```

Backend integration tests require PostgreSQL and cover session/CSRF behavior,
pending onboarding isolation, tenant-scoped parent/student data, timetable and
notification contracts, clarification invariants, atomic file uploads and
downloads, guardian auto-authorization, teacher register submission, principal
RBAC, timetable create/update/delete, class ranking, and the generic AI response.

## Share a local build with ngrok

Start the compiled one-origin app on port 8000, then:

```bash
ngrok http 8000
```

For HTTPS sign-in, restart the backend with the exact ngrok origin in
`ALLOWED_ORIGINS` and `COOKIE_SECURE=true`. Keep `TRUST_PROXY=true`; never use a
wildcard production origin.

## Production notes

The Docker image builds both applications, runs as UID/GID `10001`, and contains
only production Node dependencies and compiled artifacts. Apply migrations as a
single release step for replicated deployments. Replace the local upload volume
with encrypted private object storage and malware scanning, use a managed secret
store, back up PostgreSQL and documents together, terminate TLS at a trusted
proxy, and monitor `/readyz`.

## Product and architecture blueprints

The repository also includes the broader Eduvera planning documents:

- [`01_DESIGN.md`](01_DESIGN.md)
- [`02_TECHNICAL_ARCHITECTURE.md`](02_TECHNICAL_ARCHITECTURE.md)
- [`03_PRODUCT_FUNCTIONALITY.md`](03_PRODUCT_FUNCTIONALITY.md)
- [`04_FLOW_DIAGRAMS.md`](04_FLOW_DIAGRAMS.md)
