# OmniSchool Node backend

NestJS 11 + Fastify 5 API for the first OmniSchool vertical: student attendance and parent/student workflows. PostgreSQL is the only datastore; Kysely provides a strict typed query layer. The API preserves the React client's existing `/api/v1` contracts while keeping room for later School OS modules.

## What is implemented

- Signed, opaque cookie sessions backed by PostgreSQL; session tokens are stored only as SHA-256 hashes.
- Signed double-submit CSRF protection on every unsafe mutation, including login and registration. Demo-session bootstrap is the deliberate development-only exception.
- Scrypt password hashes, password quality validation, collision-safe normalized usernames, logout/session expiry cleanup, and pending-school onboarding for public registration.
- Active-membership + relationship tenant checks for every student object. Students see themselves, guardians see linked children, and staff act only inside their school.
- Parent/student aggregate screens, subject/daily attendance, gate events, timetable, diary acknowledgement/notes, notifications, leave workflows, and staff attendance writes.
- Leave submission accepts JSON or one multipart request. A multipart request may contain `category`, `starts_on`, `ends_on`, `reason`, optional `student_id`, and one PDF/JPEG/PNG `file` up to 10 MB. Leave, authorization, audit, notifications, and document metadata commit together; staged files are removed on rollback.
- Guardian `clarify` records a same-state audit event and notifies the student. It never declines the request. An authorized guardian's own submission is immediately `authorized` and ready for school review.
- Generic Attendance Copilot provider boundary: deterministic `mock`, local `ollama`, or an OpenAI-compatible chat endpoint. All provider context is assembled from server-authorized PostgreSQL queries and bound to one student.
- PostgreSQL audit log, shared PostgreSQL rate-limit buckets, request IDs, security headers, CORS allowlist, Swagger/OpenAPI, liveness/readiness, static assets, and React history fallback.

## Local setup

Requires Node.js 22+ and PostgreSQL 14+.

```bash
cp .env.example .env
npm ci
set -a; . ./.env; set +a
npm run db:migrate
npm run db:seed
npm run dev
```

The seed workflow also requires Python 3.11+ and the PostgreSQL `psql` client. It generates and then non-destructively upserts a complete 200-student school cohort. Use `npm run db:generate` to inspect the generated SQL and summary without changing PostgreSQL, and `npm run test:seed` to run the relationship and transaction-safety checks.

Production-like compiled start:

```bash
npm run build
node dist/main.js
```

Set `SPA_DIST_DIR` to the React `dist` directory. Exact assets are served directly and `/`, `/login`, `/signup`, `/launcher`, `/parent/*`, `/student/*`, and onboarding paths return `index.html` for client-side routing.

## Demo accounts

All seeded accounts use `OmniDemo@2026` (or `DEMO_PASSWORD` during seeding):

| Persona | Username | Email |
|---|---|---|
| Parent | `pooja.parent` | `pooja.sharma@example.test` |
| Student | `aarav.student` | `aarav.sharma@example.test` |
| Staff | `kavita.staff` | `kavita.mehta@example.test` |

Pooja is Aarav's primary parent and Ananya's registered guardian. Every seeded student has an active enrollment, primary guardian, complete two-month attendance history, subject totals, timetable, and operational data used by the student, parent, teacher, and principal screens. Aarav also has an authorization-pending medical leave, approved history, diary items, notifications, and school contact details.

## API and health

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/schema`
- Liveness: `/healthz`
- PostgreSQL readiness: `/readyz`
- Versioned API: `/api/v1`

Core groups include `auth/*`, `students/*`, `attendance-records/*`, `leave-requests/*`, `diary/*`, `notifications/*`, `screens/parent/*`, `screens/student/*`, and `ai/attendance/query/`. Both canonical and trailing-slash API paths are accepted for client compatibility.

The `csrftoken` cookie is readable by the React client; send that exact signed cookie value in `X-CSRFToken`. The session cookie is `HttpOnly`. In HTTPS environments set `COOKIE_SECURE=true`, use a random 32+ character `COOKIE_SECRET`, and configure exact `ALLOWED_ORIGINS`.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
DATABASE_URL=postgresql://... npm test
npm audit --omit=dev
```

The integration suite starts the compiled Fastify app on a temporary local port and verifies liveness/readiness, login and registration CSRF, signed server sessions, onboarding isolation, parent contracts and contact fields, guardian timetable access, notification shape, non-destructive clarification, atomic multipart leave + authenticated download, guardian auto-authorization, and the generic AI response contract.

## Docker

Run this from the repository root so the image can compile both React and Node:

```bash
docker build -f backend/Dockerfile -t omnischool .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e COOKIE_SECRET='replace-with-a-long-random-secret' \
  -e ALLOWED_ORIGINS='https://school.example' \
  -e COOKIE_SECURE=true \
  -v omnischool-uploads:/app/storage/leave-documents \
  omnischool
```

The container applies pending migrations at startup. Set `SEED_DEMO=true` only in an explicit demo environment. Uploaded documents require a durable volume or object-storage adapter before horizontally scaled deployment.

## Operational notes

- PostgreSQL rate limits are shared across API instances. For very high request volume, replace this table-backed limiter with Redis or an edge gateway without changing controller contracts.
- Local filesystem uploads are transactional at the application/database boundary and cleaned on rollback. Production clusters should use encrypted object storage, malware scanning, retention rules, and signed download URLs.
- AI is read-only and advisory. Provider failures return `503`; no provider receives data for a student the current user cannot access.
- Run migrations with a dedicated deployment identity and use separate runtime credentials with only required table privileges in production.
