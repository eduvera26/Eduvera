# OmniSchool desktop dashboard

The staff console: principal and teacher screens on a desktop layout. It is a separate
Vite app from `frontend/` (the mobile parent/student app) and shares the same API.

```bash
npm install
npm run dev        # http://127.0.0.1:5174, proxies /api to the backend on :8000
npm run typecheck
npm run build
```

The backend's `ALLOWED_ORIGINS` must include `http://127.0.0.1:5174`.

## Who sees what

Navigation is derived from the user's school membership, never from a fixed menu:

| Membership | Persona   | Screens                                                       |
|------------|-----------|---------------------------------------------------------------|
| `admin`    | Principal | Overview, Attendance, Leave requests, Timetable, Notifications |
| `staff`    | Teacher   | Overview (your day), Attendance, Leave requests, Notifications |

Parents and students are turned away at sign-in and pointed at the mobile app.

Demo accounts (password `OmniDemo@2026`): `meera.principal`, `kavita.staff`.

## Design

Follows the finalised theme: Plus Jakarta Sans with Noto companions declared for
non-Latin scripts, IBM Plex Mono for identifiers, a fixed semantic palette where status
is always colour + shape + word, and light/dark from one token set (`src/theme.css`).
Leadership opens on exceptions; teaching opens on the day; every decision is
attributed to the person who made it.
