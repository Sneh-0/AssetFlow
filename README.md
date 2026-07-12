# AssetFlow — Enterprise Asset & Resource Management (PERN)

Hackathon build: **P**ostgreSQL (Supabase) + **E**xpress + **R**eact (Vite) + **N**ode.

```
AssetFlow/
├── backend/    Express API (JWT auth, role-based routes)
├── database/   schema.sql + seed.sql — paste into Supabase SQL Editor
└── frontend/   React + Vite + Tailwind
```

## One-time Supabase setup (ONE teammate does this, then shares the string)

1. Go to [supabase.com](https://supabase.com) → New project → pick a region near you, set a DB password.
2. **SQL Editor** (left sidebar) → paste all of `database/schema.sql` → Run.
3. New query → paste all of `database/seed.sql` → Run (demo accounts + sample assets).
4. Project → **Connect** (top bar) → copy the **Session pooler** connection string
   (port **5432** — not the Transaction pooler on 6543, and not the direct connection which is IPv6-only).
5. Share it in the team chat — everyone uses the **same** database.

## Setup (every teammate)

```bash
# 1. Backend
cd backend
copy .env.example .env        # paste the shared Supabase DATABASE_URL into .env
npm install
npm run dev                   # → http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # → http://localhost:5173 (proxies /api to :5000)
```

**Demo logins** (seeded):

| Email | Password | Role |
|---|---|---|
| admin@assetflow.com | admin123 | Admin |
| manager@assetflow.com | password123 | Asset Manager |
| head@assetflow.com | password123 | Department Head |
| priya@assetflow.com | password123 | Employee (holds AF-0001) |
| raj@assetflow.com | password123 | Employee |

## What already works (this first draft)

- Auth: signup (employee-only, no self-elevation), login, JWT session restore
- Role-based access on every route (`requireRole` middleware)
- Org Setup: departments (hierarchy + heads), categories, employee directory with role promotion
- Assets: register with auto tag (AF-0001…), search/filter, lifecycle statuses, per-asset history
- **Allocation conflict rule**: allocating a held asset → 409 with holder name → "Request Transfer Instead" button
- Transfer workflow: requested → approved/rejected → auto re-allocation
- Return flow with condition notes; overdue returns auto-flagged (dashboard + red rows)
- **Booking overlap validation**: 9:00–10:00 vs 9:30–10:30 rejected; back-to-back allowed
- Maintenance workflow: pending → approved/rejected → assigned → in progress → resolved, with asset status auto-sync
- Audit cycles: create, assign auditors, mark verified/missing/damaged, discrepancy report, close (missing → Lost)
- Dashboard KPIs, notifications, activity log, starter reports

## Team split (4 people × 8 hours)

Each frontend page has an `// OWNER: Px` comment at the top. Push at least once per hour.

| Person | Owns | Hour-by-hour |
|---|---|---|
| **P1** | Auth polish + Org Setup (Screens 1, 3) | H1: run app, test flows · H2–3: forgot password + custom category fields editor · H4–5: dept hierarchy view, validation, empty states · H6–7: UI polish, form errors · H8: demo prep |
| **P2** | Assets + Allocation/Transfer (Screens 4, 5) | H1: run app, test flows · H2–3: photo upload (base64 or URL), asset detail actions · H4–5: QR code (`qrcode.react`), status transition buttons · H6–7: filters by dept/location, transfer approval by dept head scope · H8: demo prep |
| **P3** | Bookings + Maintenance (Screens 6, 7) | H1: run app, test flows · H2–3: calendar/day-grid view for bookings · H4–5: reschedule, booking reminder toast, maintenance photo attach · H6–7: technician assign modal, priority filter, polish · H8: demo prep |
| **P4** | Dashboard, Audits, Reports, Notifications (Screens 2, 8, 9, 10) | H1: run app, test flows · H2–3: charts on Reports (CSS bars → recharts), booking heatmap · H4–5: audit discrepancy report view + CSV export · H6–7: unread badge, notification polling/toasts, dashboard polish · H8: demo prep |

### Git workflow (hourly pushes)

```bash
git checkout -b feat/<yourname>-<feature>   # work on a branch
git add . && git commit -m "feat: ..."
git push -u origin feat/<yourname>-<feature>
# open PR → merge to main; or if team agrees, push small commits straight to main
git pull --rebase origin main               # before every push, always
```

Merge-conflict insurance: **each person edits only their own pages/routes**. Shared files (`App.jsx`, `index.js`, `schema.sql`) — announce in group chat before touching.

⚠️ Everyone shares ONE Supabase database. If the schema changes: edit `database/schema.sql`, announce it, then one person re-pastes `schema.sql` + `seed.sql` in the Supabase SQL Editor (schema.sql drops + recreates everything — all data is wiped, which is fine for a hackathon).

## API reference

All routes under `/api`, JSON, `Authorization: Bearer <token>`.

| Method + Path | What | Who |
|---|---|---|
| POST `/auth/signup` `/auth/login`, GET `/auth/me` | Auth | public / any |
| GET/POST/PUT `/org/departments` | Departments | writes: admin |
| GET/POST/PUT `/org/categories` | Categories | writes: admin |
| GET `/org/employees`, PUT `/org/employees/:id` | Directory + role promotion | writes: admin |
| GET/POST `/assets`, GET/PUT `/assets/:id` | Registry + history | writes: admin, asset_manager |
| GET/POST `/allocations` | Allocate (409 on conflict) | writes: admin, AM, dept head |
| POST `/allocations/:id/return` | Return flow | any |
| GET/POST `/allocations/transfers`, PUT `/allocations/transfers/:id` | Transfer workflow (`{action: approve\|reject}`) | decide: admin, AM, dept head |
| GET/POST `/bookings` (409 on overlap), POST `/bookings/:id/cancel` | Booking | any |
| GET/POST `/maintenance`, PUT `/maintenance/:id` | Workflow (`{action: approve\|reject\|assign\|start\|resolve}`) | transitions: admin, AM |
| GET/POST `/audits`, GET `/audits/:id`, POST `/audits/:id/records`, GET `/audits/:id/discrepancies`, POST `/audits/:id/close` | Audit cycles | create: admin; close: admin, AM |
| GET `/dashboard` `/reports` `/notifications` `/activity`, POST `/notifications/read-all` | Dashboard/reports/notifs | any |
