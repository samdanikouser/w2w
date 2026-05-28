# W2W — Waste to Work Management Platform

EPWP waste-recycling programme management platform. POPIA-compliant. Built for the City of Johannesburg.

## Architecture

```
w2w/
├── backend/         Node + Express + Prisma (PostgreSQL) — REST API on :4000
├── frontend/        Vite + React + TypeScript + Tailwind v4 — dev server on :3000
├── W2W_Platform_v10.html       Reference prototype (single-file HTML)
└── W2W_Technical_Development_Plan.md
```

## First-time setup

### Backend

```bash
cd backend
cp .env.example .env       # fill in DATABASE_URL, JWT_SECRET, SEED_ADMIN_*
npm install
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed         # creates the bootstrap admin from env vars
npm run dev
```

Required env vars (`backend/.env`):

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | ≥ 32 chars; server refuses to start in production without this |
| `SEED_ADMIN_EMAIL` | Bootstrap admin login |
| `SEED_ADMIN_PASSWORD` | ≥ 12 chars |
| `SEED_ADMIN_NAME` | Optional, defaults to "System Administrator" |
| `CORS_ORIGIN` | Frontend origin, default `http://localhost:3000` |
| `NODE_ENV` | `development` or `production` |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit <http://localhost:3000>, log in with the bootstrap admin you seeded, then immediately:

1. **Settings → Roles** — define your custom role labels (e.g. "Yard Supervisor")
2. **Employees → Add Employee** — register staff
3. **Settings → Users** — link an employee to a login account with a role
4. **My Profile → Security** — change your admin password

## Modules

| Sidebar item | Backend route | Notes |
| --- | --- | --- |
| Dashboard | (derived) | KPI cards + 5-tab analytics (Performance, Financial, Tons, Budget, Impact) |
| Sites & Regions | `/api/sites` | Cooperatives, depots, buyback centres |
| EPR Monthly Reports | `/api/epr-reports`, `/api/waste-types` | Dynamic breakdown per configured Waste Types & PROs |
| P&L Entry Register | `/api/transactions` | Revenue + expense ledger |
| Reports & Export | (links to modules) | 8 report templates |
| Demographics | (derived from employees) | Workforce composition charts |
| Employees | `/api/employees` | 7-tab profile modal, ID-card print |
| Onboarding | (derived from employees) | New-hire pipeline funnel |
| Attendance Report | `/api/attendance` | Daily check-in grid |
| Beneficiary Tracker | (derived from employees + waste logs) | Programme participants |
| Stock Register | `/api/stock-items` | PPE, consumables, equipment |
| Stock Variance | (local) | Expected vs actual reconciliation |
| Vehicles & Fleet | `/api/vehicles` | Registration, service schedule, status |
| Depot Management | `/api/sites?type=DEPOT` | Subset of sites |
| Depot Scanner | `/api/waste-logs` | QR / manual employee lookup → log intake |
| Waste Collection | `/api/waste-logs` | Grid-based bulk entry, Depot routing, Approval workflow |
| Training Tracker | `/api/training` | Dynamic Modules (Mandatory/Optional) & Records |
| Warnings & Violations | `/api/violations` | Disciplinary register |
| Audit Log | `/api/audit-logs` | Read-only POPIA trail |
| Settings | `/api/users`, `/api/roles`, `/api/waste-types` | Organisation, Users, Roles, Dynamic Waste Categories (EPR pricing/PRO), Data & POPIA |
| My Profile | `/api/auth/me`, `/api/auth/change-password` | Personal info, notifications, security |

## Security

- JWT auth (`/api/auth/login`) with 8 h expiry. Secret enforced ≥ 32 chars in production.
- Password policy: min 10 chars, mixed case, digit.
- bcrypt 12 rounds.
- Login rate-limit: 10 attempts per 15 min per IP.
- Constant-time-ish bcrypt comparison on failure to mask user-existence.
- Every CRUD action audited (`AuditLog` table) with user, IP, entity reference.
- Helmet + CORS + JSON body limit (2 MB) + Express rate-limit.
- POPIA-compliant: SA ID / banking / contact fields documented as encrypted at app layer; audit-log retention controlled in Settings.

## Production deployment

1. Set all env vars in `backend/.env` (especially `JWT_SECRET` ≥ 32 chars and `SEED_ADMIN_*`).
2. `NODE_ENV=production npx prisma migrate deploy && npx prisma db seed`.
3. Build the frontend: `cd frontend && npm run build` → serve `dist/` behind a reverse proxy.
4. Reverse-proxy `/api/*` to the backend on port 4000.
5. Enforce HTTPS at the proxy layer.
6. Rotate `SEED_ADMIN_PASSWORD` immediately after first login.

## License

Proprietary — Athina Tech. All rights reserved.
