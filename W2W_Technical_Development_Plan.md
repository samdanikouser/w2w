# W2W Platform — Full Technical Development Plan

**Project:** Waste to Work (W2W) EPWP Waste Recycling Programme Management Platform  
**Prepared by:** Athina Tech  
**For:** Antigravity Development Team  
**Date:** May 2026  
**Version:** 1.0  
**Status:** Ready for Development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [What Has Been Built — The Prototype](#2-what-has-been-built--the-prototype)
3. [Technology Stack Decision](#3-technology-stack-decision)
4. [Architecture Overview](#4-architecture-overview)
5. [Repository Structure](#5-repository-structure)
6. [Phase 0 — Planning and Setup](#6-phase-0--planning-and-setup)
7. [Phase 1 — Render and Infrastructure Setup](#7-phase-1--render-and-infrastructure-setup)
8. [Phase 2 — Database Schema](#8-phase-2--database-schema)
9. [Phase 3 — Backend Development](#9-phase-3--backend-development)
10. [Phase 4 — Frontend Development](#10-phase-4--frontend-development)
11. [Phase 5 — Mobile PWA and Offline Sync](#11-phase-5--mobile-pwa-and-offline-sync)
12. [Phase 6 — PDF Generation and Reports](#12-phase-6--pdf-generation-and-reports)
13. [Phase 7 — Security and POPIA Compliance](#13-phase-7--security-and-popia-compliance)
14. [Phase 8 — Data Migration from Prototype](#14-phase-8--data-migration-from-prototype)
15. [Phase 9 — Testing and UAT](#15-phase-9--testing-and-uat)
16. [Phase 10 — Deployment on Render](#16-phase-10--deployment-on-render)
17. [Phase 11 — Monitoring and Backups](#17-phase-11--monitoring-and-backups)
18. [Phase 12 — Go-Live and Training](#18-phase-12--go-live-and-training)
19. [Custom Domain Setup](#19-custom-domain-setup)
20. [Complete Timeline](#20-complete-timeline)
21. [Cost Summary](#21-cost-summary)
22. [Module Reference](#22-module-reference)
23. [Role and Permission Matrix](#23-role-and-permission-matrix)

---

## 1. Project Overview

### What is W2W

Waste to Work is an EPWP (Expanded Public Works Programme) waste recycling initiative operating under the City of Johannesburg Metro in Gauteng. The programme employs 100 waste pickers (beneficiaries) across 15 collection sites in 4 planning regions, organised into 15 cooperatives.

Waste is collected, sorted, and sold to PRO (Producer Responsibility Organisation) buyers including Petco, Polyco, Fibre Cycle, Metpac, E-Wasa, and Consol. Revenue from waste sales and PRO grants funds the programme.

### Why This System is Being Built

- Track waste collected per site, per employee, per category in real time
- Monitor financial performance — income, expenses, P&L, cost per job
- Enforce stock accountability — what is received at depots must match what is sold
- Produce EPR-compliant monthly reports for the City and PRO partners
- Track beneficiary income uplift and programme impact for funders
- Provide field workers with a mobile interface for attendance and submissions
- Give management a live dashboard across all 15 sites

### Key Numbers

| Item | Count |
|---|---|
| Total employees | 112 |
| Field worker beneficiaries | 100 |
| Active sites | 15 |
| Cooperatives | 15 |
| Depots | 7 |
| Planning regions | 4 (C, D, F, G) |
| Waste categories | 10 (EPR) |
| User roles | 8 |

---

## 2. What Has Been Built — The Prototype

A fully functional single-file HTML prototype (W2W Platform v10) has been built and validated with the client. It contains:

- All 28 modules fully designed and logic-tested
- All 8 role permission levels implemented
- All business logic proven: stock variance, price locking, ROI calculation, income uplift
- All UI screens designed including both Back Office (BOH) and Field Worker (FO) mobile app
- Real data: 112 employees, 15 sites, 15 cooperatives, 7 depots loaded
- Demo credentials and sample data

**The prototype is the complete specification.** Every screen, every calculation, every permission rule, and every data field has been defined. The production build takes this and makes it persistent, scalable, secure, and maintainable.

The prototype file is available at: `W2W_Platform_v10.html`

---

## 3. Technology Stack Decision

### Why Not Supabase or Firebase

Direct SQL from the browser (via Supabase anon key) means anyone with the API key can query any table. Owning the backend means:

- The browser never touches the database directly
- All SQL runs on your server only
- Permissions are enforced server-side — cannot be bypassed from the browser
- Your data, your backups, your control
- No third-party dependency for data access

### Final Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Component isolation, type safety, fast builds |
| Styling | Tailwind CSS | Replaces prototype's inline CSS cleanly |
| State Management | Zustand | Lightweight, simple, persists auth to localStorage |
| API Client | Axios + React Query | Caching, background refresh, optimistic updates |
| Charts | Recharts | Already used in prototype, React-native |
| Tables | TanStack Table | Sorting, filtering, pagination built in |
| Forms | React Hook Form + Zod | Type-safe validation matching backend schemas |
| PDF | Puppeteer (server-side) | Pixel-perfect ID cards, delivery notes, EPR reports |
| Excel | SheetJS | Already proven in prototype, client-side |
| Backend | Node.js + Express + TypeScript | Same language as frontend, proven ecosystem |
| ORM | Prisma | Type-safe database access, auto-generated types |
| Validation | Zod | Shared schemas between frontend and backend |
| Auth | JWT + bcrypt | Stateless, scalable, standard |
| File Storage | Cloudflare R2 | No egress fees, S3-compatible, free 10GB |
| Database | PostgreSQL 16 | Relational data, POPIA compliance, proven |
| Hosting | Render | Frontend + Backend + Database in one platform |
| CI/CD | Render Auto-Deploy | Push to GitHub → Render deploys automatically |
| Monitoring | UptimeRobot + Sentry | Uptime alerts + error tracking |
| Email | SendGrid | Transactional email, free tier |

### Why Render

- Manages PostgreSQL, Node.js backend, and React frontend in one dashboard
- Auto-deploys from GitHub on every push to `main` — zero manual steps
- Zero-downtime deploys — new version starts before old one stops
- Built-in HTTPS and SSL on every service — no Nginx or Certbot needed
- Built-in logs, metrics, and health checks
- Johannesburg-accessible (Oregon region, lowest latency from SA on Render)
- Cost: **$14/month total** (R260/month) for all three services

### Custom Domain — No onrender.com Shown to Users

Once custom domains are configured, users only ever see `w2w.athinatech.co.za`. The `.onrender.com` URLs exist in the background for internal use but never appear to end users. Render provisions SSL certificates for custom domains automatically.

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│                                                                 │
│   Back Office (Desktop)          Field Worker App (Mobile)      │
│   w2w.athinatech.co.za           w2w.athinatech.co.za/field     │
│   React + TypeScript             React PWA + Offline Sync       │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTPS only — JWT on every request
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   RENDER WEB SERVICE                            │
│              api.w2w.athinatech.co.za                           │
│                                                                 │
│   Node.js + Express + TypeScript                                │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │ Auth Layer   │  │ Role & Site  │  │   Business Logic     │ │
│   │ JWT verify   │  │ Scope Guard  │  │   Waste, P&L,        │ │
│   │ Refresh      │  │ Per request  │  │   Variance, Reports  │ │
│   └──────────────┘  └──────────────┘  └──────────────────────┘ │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │ Prisma ORM   │  │ Zod Validate │  │   Audit Logger       │ │
│   │ Type-safe SQL│  │ Every input  │  │   Every mutation     │ │
│   └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │  Private network (never public)
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                 RENDER POSTGRESQL DATABASE                      │
│                   w2w_production                                │
│                                                                 │
│   No public internet access                                     │
│   Only accepts connections from backend on same private network │
│   Daily automated backups (Render)                             │
│   Weekly off-site backups (Cloudflare R2)                      │
└─────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│               CLOUDFLARE R2 — FILE STORAGE                     │
│                                                                 │
│   Employee photos, ID copies, documents                         │
│   Weekly database backup exports                               │
│   Free up to 10GB, no egress fees                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Repository Structure

Single GitHub repository. Two application folders. One shared types package.

```
w2w-platform/                    ← single private GitHub repo
│
├── frontend/                    ← React application
│   ├── src/
│   │   ├── api/                 ← all API call functions (typed)
│   │   │   ├── client.ts        ← axios instance with JWT interceptor
│   │   │   ├── auth.ts
│   │   │   ├── employees.ts
│   │   │   ├── waste.ts
│   │   │   ├── pl.ts
│   │   │   ├── variance.ts
│   │   │   ├── reports.ts
│   │   │   └── dashboard.ts
│   │   ├── components/          ← reusable UI components
│   │   │   ├── ui/              ← Button, Input, Modal, Table, Badge, Alert
│   │   │   ├── layout/          ← Sidebar, TopBar, PageHeader, SiteBanner
│   │   │   └── charts/          ← WasteDonut, PLTrend, VarianceBar
│   │   ├── pages/               ← one folder per module
│   │   │   ├── auth/            ← Login
│   │   │   ├── dashboard/       ← Dashboard (5 tabs)
│   │   │   ├── employees/       ← List, Form, IDCard
│   │   │   ├── waste/           ← WasteLog, DepotScanner
│   │   │   ├── sites/           ← Sites, Cooperatives, Depots
│   │   │   ├── pl/              ← PLRegister, LockMonth
│   │   │   ├── reports/         ← ReportsHub, WasteReport, PLReport
│   │   │   ├── variance/        ← StockVariance
│   │   │   ├── training/        ← TrainingTracker
│   │   │   ├── vehicles/        ← VehicleList
│   │   │   ├── settings/        ← WasteCategories, PaymentScale
│   │   │   ├── audit/           ← AuditLog
│   │   │   └── field/           ← FO mobile app pages
│   │   ├── hooks/               ← React Query data hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useEmployees.ts
│   │   │   ├── useWasteLogs.ts
│   │   │   ├── useVariance.ts
│   │   │   └── useDashboard.ts
│   │   ├── stores/              ← Zustand global state
│   │   │   ├── authStore.ts     ← user, token, logout
│   │   │   └── filterStore.ts   ← shared date filter state
│   │   ├── types/               ← TypeScript interfaces
│   │   ├── utils/               ← formatters, permission helpers
│   │   ├── router.tsx           ← React Router + protected routes
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── .env.development
│   └── .env.production
│
├── backend/                     ← Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts      ← Prisma client singleton
│   │   │   └── env.ts           ← typed environment variables
│   │   ├── middleware/
│   │   │   ├── auth.ts          ← JWT verification
│   │   │   ├── authorize.ts     ← role + site scope enforcement
│   │   │   ├── rateLimit.ts     ← brute force protection
│   │   │   ├── audit.ts         ← auto-log every mutation
│   │   │   └── errorHandler.ts  ← consistent error responses
│   │   ├── routes/              ← one file per resource
│   │   │   ├── auth.ts          ← POST /login /logout /refresh
│   │   │   ├── employees.ts
│   │   │   ├── waste.ts
│   │   │   ├── sites.ts
│   │   │   ├── cooperatives.ts
│   │   │   ├── depots.ts
│   │   │   ├── pl.ts
│   │   │   ├── variance.ts
│   │   │   ├── monthlyReports.ts
│   │   │   ├── vehicles.ts
│   │   │   ├── training.ts
│   │   │   ├── warnings.ts
│   │   │   ├── ppe.ts
│   │   │   ├── settings.ts
│   │   │   ├── audit.ts
│   │   │   ├── upload.ts
│   │   │   ├── sos.ts
│   │   │   ├── reports.ts
│   │   │   └── dashboard.ts
│   │   ├── services/            ← business logic (not in routes)
│   │   │   ├── wasteService.ts  ← waste calculations, depot sync
│   │   │   ├── plService.ts     ← P&L sync, price lock logic
│   │   │   ├── varianceService.ts ← received vs sold calculation
│   │   │   ├── pdfService.ts    ← Puppeteer PDF generation
│   │   │   └── emailService.ts  ← SendGrid notifications
│   │   └── server.ts            ← Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma        ← database schema
│   │   └── migrations/          ← every schema change tracked
│   ├── tests/
│   │   ├── auth.test.ts
│   │   ├── employees.test.ts
│   │   ├── variance.test.ts
│   │   └── waste.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                     ← local dev only, never committed
│
└── README.md
```

### Branch Strategy

```
main        → production (Render deploys from here)
staging     → pre-production testing
dev         → active development
feature/*   → individual feature branches

Rule: No direct push to main or staging.
      All changes via pull request.
      Require 1 reviewer approval before merge.
```

---

## 6. Phase 0 — Planning and Setup

**Duration: 2 weeks**

### Accounts to Create Before Writing Any Code

| Service | URL | Purpose | Cost |
|---|---|---|---|
| GitHub | github.com | Code repository | Free |
| Render | render.com | Hosting — all three services | $14/month |
| Cloudflare | cloudflare.com | DNS + R2 file storage | Free |
| Domain registrar | domains.co.za | w2w.athinatech.co.za | ~R150/year |
| Sentry | sentry.io | Error tracking | Free tier |
| UptimeRobot | uptimerobot.com | Uptime monitoring | Free |
| SendGrid | sendgrid.com | Transactional email | Free tier (100/day) |
| Mailtrap | mailtrap.io | Email testing in dev | Free |

### GitHub Repository Setup

```bash
# Create private repo on github.com: athinatech/w2w-platform
git clone https://github.com/athinatech/w2w-platform.git
cd w2w-platform
mkdir frontend backend
git checkout -b dev
git push origin dev
```

**GitHub Branch Protection Rules** (Settings → Branches → Add rule for `main`):

- Require pull request before merging: ON
- Require 1 approving review: ON
- Dismiss stale reviews: ON
- No direct pushes: ON

### Environment Files

These are never committed to GitHub. Set them locally and in Render dashboard.

```bash
# backend/.env  (local development)
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://w2w_app:password@host/w2w_production
JWT_SECRET=generate-with-openssl-rand-base64-64
JWT_REFRESH_SECRET=generate-with-openssl-rand-base64-64
JWT_EXPIRES_IN=8h
REFRESH_EXPIRES_IN=30d
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_ACCESS_KEY=your-r2-access-key
CF_SECRET_KEY=your-r2-secret-key
CF_BUCKET_NAME=w2w-files
CF_PUBLIC_URL=https://files.w2w.athinatech.co.za
SENDGRID_API_KEY=your-sendgrid-key
SENTRY_DSN=your-sentry-backend-dsn

# frontend/.env.development
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=W2W Platform (Dev)

# frontend/.env.production
VITE_API_URL=https://api.w2w.athinatech.co.za/api
VITE_APP_NAME=W2W Platform
VITE_SENTRY_DSN=your-sentry-frontend-dsn
```

---

## 7. Phase 1 — Render and Infrastructure Setup

**Duration: 1 week**

### Step 1: Create PostgreSQL Database on Render

Go to render.com → New → PostgreSQL

```
Name:           w2w-database
Database Name:  w2w_production
User:           w2w_app
Region:         Oregon (US West)
Plan:           Starter ($7/month)
                1GB storage, daily backups, 97 connections
```

Render provides two connection strings. Save both:

```
Internal URL  → used by backend service on Render (free, private network)
External URL  → used by your local machine during development
```

### Step 2: Create Backend Web Service on Render

Go to render.com → New → Web Service

```
Connect:          GitHub → athinatech/w2w-platform
Name:             w2w-backend
Region:           Oregon (must match database)
Branch:           main
Root Directory:   backend
Runtime:          Node
Build Command:    npm install && npm run build
Start Command:    node dist/server.js
Plan:             Starter ($7/month) — always on, no sleep
```

**Environment Variables in Render Dashboard:**

```
NODE_ENV              production
PORT                  3001
DATABASE_URL          [paste Internal PostgreSQL URL]
JWT_SECRET            [generate: openssl rand -base64 64]
JWT_REFRESH_SECRET    [generate: openssl rand -base64 64]
JWT_EXPIRES_IN        8h
REFRESH_EXPIRES_IN    30d
FRONTEND_URL          https://w2w.athinatech.co.za
CORS_ORIGIN           https://w2w.athinatech.co.za
CF_ACCOUNT_ID         [from Cloudflare]
CF_ACCESS_KEY         [from R2 API tokens]
CF_SECRET_KEY         [from R2 API tokens]
CF_BUCKET_NAME        w2w-files
CF_PUBLIC_URL         https://files.w2w.athinatech.co.za
SENDGRID_API_KEY      [from SendGrid]
SENTRY_DSN            [from Sentry backend project]
```

**Health Check** — set in Render dashboard:

```
Health Check Path:   /api/health
```

### Step 3: Create Frontend Static Site on Render

Go to render.com → New → Static Site

```
Connect:          GitHub → athinatech/w2w-platform
Name:             w2w-frontend
Branch:           main
Root Directory:   frontend
Build Command:    npm install && npm run build
Publish Dir:      dist
Plan:             Free
```

**Redirect / Rewrite Rule** (add in Render Static Site settings):

```
Source:       /*
Destination:  /index.html
Status:       200
```

This is required for React Router — without it, direct navigation to any URL returns 404.

**Environment Variables:**

```
VITE_API_URL      https://api.w2w.athinatech.co.za/api
VITE_APP_NAME     W2W Platform
VITE_SENTRY_DSN   [from Sentry frontend project]
```

### How Auto-Deploy Works on Render

```
Developer pushes to GitHub main branch
              ↓
Render detects push via GitHub webhook
              ↓
Render pulls latest code
              ↓
Runs build command (npm install && npm run build)
              ↓
Starts new version of the service
              ↓
Health check passes → /api/health returns 200
              ↓
Old version terminated
              ↓
Deploy complete — zero downtime
```

---

## 8. Phase 2 — Database Schema

**Completed during Phase 0 — implemented during Phase 1**

### Core Tables

```sql
-- Users and authentication
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL
                  CHECK (role IN ('it','chairman','ceo','cfo',
                                  'admin','supervisor','depot','field')),
  employee_id   VARCHAR(20) REFERENCES employees(id),
  is_active     BOOLEAN DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Employees / beneficiaries
CREATE TABLE employees (
  id                  VARCHAR(20) PRIMARY KEY,    -- W2W-001 format
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  national_id         BYTEA,                       -- encrypted (POPIA)
  phone               VARCHAR(20),
  email               VARCHAR(255),
  site_id             VARCHAR(20) REFERENCES sites(id),
  designation         VARCHAR(100),
  status              VARCHAR(50) DEFAULT 'Active',
  stipend             DECIMAL(10,2) DEFAULT 0,
  service_fee         DECIMAL(10,2) DEFAULT 0,
  pre_income_monthly  DECIMAL(10,2) DEFAULT 0,
  enrol_date          DATE,
  exit_date           DATE,
  exit_reason         VARCHAR(100),
  photo_url           VARCHAR(500),
  bank_account        BYTEA,                       -- encrypted (POPIA)
  bank_name           VARCHAR(100),
  license             VARCHAR(50),
  license_expiry      DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Geographic structure
CREATE TABLE sites (
  id              VARCHAR(20) PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  region          VARCHAR(10),
  province        VARCHAR(100),
  municipality    VARCHAR(100),
  ohs_rating      INTEGER DEFAULT 100,
  supervisor_id   VARCHAR(20) REFERENCES employees(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cooperatives (
  id              VARCHAR(20) PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  site_id         VARCHAR(20) REFERENCES sites(id),
  stage           VARCHAR(50) DEFAULT 'Formation',
  registration_no VARCHAR(100),
  pro_partner     VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE depots (
  id               VARCHAR(20) PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  type             VARCHAR(20) CHECK (type IN ('IWMC','MRC','BBC')),
  site_id          VARCHAR(20) REFERENCES sites(id),
  capacity_kg      INTEGER DEFAULT 0,
  current_stock_kg INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Waste management
CREATE TABLE waste_categories (
  id           VARCHAR(20) PRIMARY KEY,
  code         VARCHAR(20) NOT NULL,
  name         VARCHAR(100) NOT NULL,
  epr_category VARCHAR(100),
  price_per_kg DECIMAL(10,2) NOT NULL,
  buyers       TEXT[] DEFAULT '{}',          -- array of PRO buyer names
  color        VARCHAR(20)
);

CREATE TABLE waste_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    VARCHAR(20) REFERENCES employees(id),
  site_id        VARCHAR(20) REFERENCES sites(id),
  depot_id       VARCHAR(20) REFERENCES depots(id),
  date           DATE NOT NULL,
  total_kg       DECIMAL(10,2) NOT NULL,
  per_category   JSONB NOT NULL,             -- {PET: 120, HDPE: 45, ...}
  price_snapshot JSONB NOT NULL,             -- {PET: 4.50, ...} locked at scan time
  locked_revenue DECIMAL(12,2),
  delivery_note  VARCHAR(50),
  recorded_by    UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- EPR monthly reports
CREATE TABLE monthly_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             VARCHAR(20) REFERENCES sites(id),
  date_from           DATE NOT NULL,
  date_to             DATE NOT NULL,
  material_breakdown  JSONB NOT NULL,        -- {PET: 500, HDPE: 200, ...}
  buyer_confirmation  VARCHAR(200),
  traceability_ref    VARCHAR(100),
  status              VARCHAR(50) DEFAULT 'Draft',
  prepared_by         UUID REFERENCES users(id),
  submitted_date      DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Financial P&L
CREATE TABLE pl_revenue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month       VARCHAR(7) NOT NULL,           -- 2026-04
  category    VARCHAR(200) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  source      VARCHAR(200),
  auto_waste  BOOLEAN DEFAULT false,
  locked      BOOLEAN DEFAULT false,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pl_expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month       VARCHAR(7) NOT NULL,
  category    VARCHAR(200) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  cost_centre VARCHAR(100),
  approved_by UUID REFERENCES users(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locked_months (
  month       VARCHAR(7) PRIMARY KEY,
  locked_by   UUID REFERENCES users(id),
  locked_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Operations
CREATE TABLE vehicles (
  id            VARCHAR(20) PRIMARY KEY,
  registration  VARCHAR(50),
  type          VARCHAR(50),
  make          VARCHAR(100),
  model         VARCHAR(100),
  status        VARCHAR(50) DEFAULT 'Active',
  assigned_to   VARCHAR(20) REFERENCES employees(id),
  site_id       VARCHAR(20) REFERENCES sites(id),
  capacity      VARCHAR(50),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE training_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    VARCHAR(20) REFERENCES employees(id),
  module         VARCHAR(200) NOT NULL,
  status         VARCHAR(50) DEFAULT 'Pending',
  completed_date DATE,
  provider       VARCHAR(200),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE warnings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  VARCHAR(20) REFERENCES employees(id),
  level        INTEGER CHECK (level BETWEEN 1 AND 4),
  reason       TEXT,
  issued_by    UUID REFERENCES users(id),
  issued_date  DATE DEFAULT CURRENT_DATE,
  status       VARCHAR(50) DEFAULT 'Active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ppe_inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item          VARCHAR(200) NOT NULL,
  category      VARCHAR(100),
  qty_in_stock  INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  site_id       VARCHAR(20) REFERENCES sites(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sos_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     VARCHAR(20) REFERENCES employees(id),
  latitude        DECIMAL(10,7),
  longitude       DECIMAL(10,7),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable audit log
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  table_name  VARCHAR(100),
  record_id   VARCHAR(200),
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent updates and deletes on audit log
REVOKE UPDATE, DELETE ON audit_log FROM w2w_app;

-- Performance indexes
CREATE INDEX idx_waste_logs_site_date  ON waste_logs(site_id, date);
CREATE INDEX idx_waste_logs_employee   ON waste_logs(employee_id);
CREATE INDEX idx_employees_site        ON employees(site_id);
CREATE INDEX idx_monthly_reports_site  ON monthly_reports(site_id, date_from);
CREATE INDEX idx_audit_log_created     ON audit_log(created_at DESC);
CREATE INDEX idx_pl_revenue_month      ON pl_revenue(month);
CREATE INDEX idx_pl_expenses_month     ON pl_expenses(month);
```

### Prisma Schema

The Prisma schema mirrors the SQL above exactly. Prisma generates TypeScript types automatically — every table becomes a typed interface available throughout the backend.

Run migrations:

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name describe_the_change

# Apply migrations in production (runs automatically on Render start)
npx prisma migrate deploy

# View database in browser during development
npx prisma studio
```

---

## 9. Phase 3 — Backend Development

**Duration: 6 weeks (Weeks 4–9)**

### Backend Initialisation

```bash
cd backend
npm init -y
npm install express cors helmet morgan bcryptjs jsonwebtoken
npm install cookie-parser @prisma/client multer uuid zod
npm install dotenv compression express-rate-limit
npm install @aws-sdk/client-s3

npm install -D typescript ts-node nodemon @types/node @types/express
npm install -D @types/bcryptjs @types/jsonwebtoken @types/multer @types/cors
npm install -D prisma jest @types/jest ts-jest supertest @types/supertest

npx prisma init
```

### package.json Scripts

```json
{
  "scripts": {
    "dev":     "nodemon src/server.ts",
    "build":   "prisma generate && tsc",
    "start":   "npx prisma migrate deploy && node dist/server.js",
    "migrate": "prisma migrate dev",
    "studio":  "prisma studio",
    "test":    "jest --coverage",
    "lint":    "eslint src/**/*.ts"
  }
}
```

> **Important:** The `start` script runs `prisma migrate deploy` before starting the server. This means every Render deploy automatically applies any pending database migrations safely.

### Authentication Flow

```
1. POST /api/auth/login
   → Receive email + password
   → Find user in database
   → bcrypt.compare(password, hash)
   → Build JWT payload: { userId, role, employeeId, siteId }
   → Sign access token (8h expiry)
   → Sign refresh token (30d expiry)
   → Return both tokens + user object

2. Every protected request
   → Read Authorization: Bearer <token> header
   → jwt.verify(token, JWT_SECRET)
   → Find user in database (confirm still active)
   → Attach user to req.user
   → Continue to route handler

3. POST /api/auth/refresh
   → Receive refresh token
   → jwt.verify(refreshToken, JWT_REFRESH_SECRET)
   → Issue new access token
   → Return new access token

4. Token expiry
   → Frontend detects 401 response
   → Auto-calls /api/auth/refresh with stored refresh token
   → If refresh also fails → redirect to login
```

### Role and Site Scope Enforcement

Every route that returns data filtered by site must go through `enforceSiteScope`:

```typescript
// Scoped roles can only see their own site
const SCOPED_ROLES = ['admin', 'supervisor', 'depot']

export const enforceSiteScope = (req, res, next) => {
  if (SCOPED_ROLES.includes(req.user.role)) {
    req.query.siteId = req.user.siteId  // override any siteId in query
    req.body.siteId  = req.user.siteId  // override any siteId in body
  }
  next()
}
```

### Key API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | Public | Login, returns JWT |
| POST | /api/auth/refresh | Public | Refresh access token |
| POST | /api/auth/logout | Auth | Logout |
| GET | /api/employees | Auth | List employees (scoped) |
| POST | /api/employees | Auth (exec+) | Create employee |
| PUT | /api/employees/:id | Auth (exec+) | Update employee |
| POST | /api/employees/:id/photo | Auth | Upload photo to R2 |
| GET | /api/waste-logs | Auth | List waste logs (scoped) |
| POST | /api/waste-logs | Auth | Create log + price snapshot + depot sync |
| GET | /api/variance | Auth | Stock variance calculation |
| GET | /api/monthly-reports | Auth | List EPR reports (scoped) |
| POST | /api/monthly-reports | Auth | Submit EPR report |
| GET | /api/pl/revenue | Auth (finance) | P&L revenue entries |
| POST | /api/pl/revenue | Auth (finance) | Add revenue entry |
| GET | /api/pl/expenses | Auth (finance) | P&L expense entries |
| POST | /api/pl/expenses | Auth (finance) | Add expense entry |
| POST | /api/pl/lock | Auth (CFO/CEO/IT) | Lock a month |
| GET | /api/dashboard/summary | Auth | Dashboard data (scoped) |
| GET | /api/reports/waste | Auth | Waste collection report |
| GET | /api/reports/pl | Auth (finance) | P&L report |
| GET | /api/sites | Auth | List sites (scoped) |
| POST | /api/sites | Auth (structure) | Create site |
| POST | /api/sos | Auth (field) | Trigger SOS alert |
| GET | /api/sos/active | Auth (admin+) | Active SOS alerts |
| GET | /api/audit | Auth (exec/IT) | Audit log |
| GET | /api/health | Public | Health check for Render |

### Price Lock Logic

When waste is submitted at the depot, the current price per kg for each category is captured in a `price_snapshot` JSONB column on the waste log. This price never changes regardless of future price updates.

When a month is locked, the `locked_months` table gets a record for that month. The P&L sync function skips any locked month — it never recalculates revenue for a period that has been officially closed.

```typescript
// Price snapshot captured at submission time
const priceSnapshot = {}
categories.forEach(cat => {
  priceSnapshot[cat.code] = Number(cat.price_per_kg)
})

// Locked revenue calculated using snapshot prices
const lockedRevenue = categories.reduce((sum, cat) => {
  return sum + (perCategory[cat.code] || 0) * priceSnapshot[cat.code]
}, 0)
```

### Stock Variance — Server-Side SQL

```sql
WITH received AS (
  SELECT
    wl.site_id,
    s.name as site_name,
    s.region,
    cat_key as category,
    SUM((wl.per_category->>cat_key)::numeric) as received_kg
  FROM waste_logs wl
  JOIN sites s ON s.id = wl.site_id
  CROSS JOIN jsonb_object_keys(wl.per_category) as cat_key
  WHERE wl.date BETWEEN $1 AND $2
    AND ($3::text IS NULL OR wl.site_id = $3)
  GROUP BY wl.site_id, s.name, s.region, cat_key
),
sold AS (
  SELECT
    mr.site_id,
    cat_key as category,
    SUM((mr.material_breakdown->>cat_key)::numeric) as sold_kg
  FROM monthly_reports mr
  CROSS JOIN jsonb_object_keys(mr.material_breakdown) as cat_key
  WHERE mr.status = 'Submitted'
    AND mr.date_from >= $1
    AND mr.date_to <= $2
    AND ($3::text IS NULL OR mr.site_id = $3)
  GROUP BY mr.site_id, cat_key
)
SELECT
  r.site_id,
  r.site_name,
  r.region,
  r.category,
  r.received_kg,
  COALESCE(s.sold_kg, 0) as sold_kg,
  r.received_kg - COALESCE(s.sold_kg, 0) as variance_kg,
  ROUND(
    (r.received_kg - COALESCE(s.sold_kg, 0))
    / NULLIF(r.received_kg, 0) * 100, 2
  ) as variance_pct
FROM received r
LEFT JOIN sold s
  ON s.site_id = r.site_id AND s.category = r.category
ORDER BY r.site_name, r.category
```

---

## 10. Phase 4 — Frontend Development

**Duration: 8 weeks (Weeks 4–11, parallel with backend)**

### Frontend Initialisation

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install axios @tanstack/react-query react-router-dom
npm install zustand
npm install tailwindcss @headlessui/react @heroicons/react
npm install recharts @tanstack/react-table
npm install xlsx react-to-print qrcode.react
npm install react-hook-form @hookform/resolvers zod
npm install date-fns @sentry/react

npm install -D @tailwindcss/forms vitest @testing-library/react
npx tailwindcss init -p
```

### API Client — Axios with JWT Interceptor

```typescript
// src/api/client.ts
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000
})

// Attach token to every request automatically
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`,
          { refreshToken })
        useAuthStore.getState().setTokens(data.accessToken, refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
```

### Protected Routes

```tsx
// src/router.tsx
const ProtectedRoute = ({ children, allowedRoles }: {
  children: React.ReactNode
  allowedRoles?: string[]
}) => {
  const { user, isLoggedIn } = useAuthStore()
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user!.role))
    return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
```

### Site Context Banner

For Area Manager and Supervisor logins, a site context banner appears at the top of every page showing which site they are viewing:

```
📍 Viewing: Florida Lake   ·   Region: C   ·   Logged in as: Site Supervisor
```

This is rendered in the BOH layout component and updates on every navigation.

### Build Order for Frontend Modules

Build in this order — each module uses components from the previous:

1. Auth — Login page, token storage, logout
2. Layout — Sidebar, TopBar, SiteBanner, PageHeader
3. Dashboard — 5 tabs: Performance, Financial, Tonnes, Budget, Impact
4. Employees — List, Form, ID Card print
5. Waste Logs — Entry form, table with filters
6. Depot Scanner — Employee lookup, kg entry, delivery note
7. Stock Variance — Received vs Sold per site per category
8. P&L Register — Revenue/expense entry, lock month
9. Monthly EPR Report — Date range form, submission workflow
10. Reports Hub — Waste Report, P&L Report
11. Training Tracker — Compliance matrix
12. Vehicles — Fleet list
13. Sites / Cooperatives / Depots — View only for scoped roles
14. Settings — Waste categories with buyers array
15. Audit Log — Read-only table
16. Field Worker App — Attendance, My Report, SOS

---

## 11. Phase 5 — Mobile PWA and Offline Sync

**Duration: 3 weeks (Weeks 12–14)**

### PWA Configuration

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name:        'W2W Field App',
      short_name:  'W2W',
      theme_color: '#146484',
      display:     'standalone',
      orientation: 'portrait',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    }
  })
]
```

Field workers install the app by opening `w2w.athinatech.co.za/field` in Chrome on Android and tapping "Add to Home Screen". No app store required.

### Offline Sync Strategy

Sites with poor connectivity (Naledi Informal, Zandspruit, Jabulani Rail) need offline support.

```
Field worker submits check-in / waste log without internet
                    ↓
Action saved to IndexedDB (browser local storage)
                    ↓
Service worker detects connectivity restored
                    ↓
Queued actions replayed against API in order
                    ↓
Server confirms — IndexedDB entry marked complete
```

### SOS Real-Time Alert

When a field worker triggers SOS, the alert appears on the Area Manager's dashboard within seconds using Server-Sent Events (SSE):

```typescript
// Backend: SSE endpoint
app.get('/api/sos/stream', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendAlert = (alert) => {
    res.write(`data: ${JSON.stringify(alert)}\n\n`)
  }

  sosEmitter.on('new-alert', sendAlert)
  req.on('close', () => sosEmitter.off('new-alert', sendAlert))
})

// Frontend: listen for SOS alerts
const eventSource = new EventSource('/api/sos/stream', {
  headers: { Authorization: `Bearer ${token}` }
})
eventSource.onmessage = (e) => {
  const alert = JSON.parse(e.data)
  showSOSBanner(alert)  // red pulsing banner with Google Maps link
}
```

---

## 12. Phase 6 — PDF Generation and Reports

**Duration: 2 weeks (Weeks 15–16)**

### PDF Generation with Puppeteer

All PDFs are generated server-side so they look identical regardless of the user's browser or printer settings.

```typescript
// src/services/pdfService.ts
import puppeteer from 'puppeteer'

export const generateIDCard = async (employee: Employee, site: Site) => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page    = await browser.newPage()

  const html = buildIDCardHTML(employee, site)  // same template as prototype
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.emulateMediaType('screen')

  const pdf = await page.pdf({
    width:            '340px',
    height:           '220px',
    printBackground:  true
  })

  await browser.close()
  return pdf
}

export const generateDeliveryNote = async (wasteLog: WasteLog) => {
  // Same pattern — build HTML, render with Puppeteer, return PDF buffer
}

export const generateEPRReport = async (report: MonthlyReport) => {
  // Full EPR monthly report PDF
}
```

```typescript
// src/routes/reports.ts
router.get('/id-card/:empId', authenticate, async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.empId } })
  const site     = await prisma.site.findUnique({ where: { id: employee.siteId } })
  const pdf      = await generateIDCard(employee, site)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="ID_${employee.id}.pdf"`)
  res.send(pdf)
})
```

> **Render note:** Add `puppeteer` to dependencies and set the environment variable `PUPPETEER_EXECUTABLE_PATH` on Render if needed. Render's Node.js environment supports Puppeteer with the `--no-sandbox` flag.

### Excel Exports

Excel exports run client-side using SheetJS — no server involvement needed:

```typescript
// src/utils/exportExcel.ts
import * as XLSX from 'xlsx'

export const exportVarianceReport = (data: VarianceRow[]) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Variance')
  XLSX.writeFile(wb, `W2W_Variance_${formatDate(new Date())}.xlsx`)
}
```

---

## 13. Phase 7 — Security and POPIA Compliance

**Duration: 1 week (Week 17)**

### POPIA Requirements

POPIA (Protection of Personal Information Act) applies to all employee personal data.

| Data | Treatment |
|---|---|
| SA ID Number | Encrypted at rest using `pgcrypto`. Never returned in list queries. Only decrypted when explicitly needed for individual record view. |
| Bank account details | Encrypted at rest. Never returned to frontend in list views. Only returned to IT Admin and CFO roles. |
| Employee photos | Stored in private Cloudflare R2 bucket. URLs are signed (expire after 1 hour) — not permanent public links. |
| Audit log | Every access to sensitive fields logged with user ID, timestamp, and IP address. |
| Data retention | Records marked for archival when programme ends. Never bulk-deleted without IT Admin confirmation. |

### Encryption for SA ID Numbers

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store encrypted
UPDATE employees
SET national_id = pgp_sym_encrypt(natid_plaintext, current_setting('app.encryption_key'))
WHERE id = $1;

-- Decrypt when needed (only in individual record queries, never in list queries)
SELECT pgp_sym_decrypt(national_id, current_setting('app.encryption_key'))
FROM employees WHERE id = $1;
```

Set the encryption key as a PostgreSQL configuration parameter via Render environment variable — never hardcoded.

### Security Checklist

- [ ] All routes require authentication except `/api/auth/login` and `/api/health`
- [ ] Role permissions enforced in middleware — not just frontend
- [ ] Site scoping enforced server-side for admin and supervisor roles
- [ ] Rate limiting: 500 requests/15min globally, 10 login attempts/15min
- [ ] JWT tokens expire after 8 hours — refresh tokens after 30 days
- [ ] All inputs validated with Zod before touching the database
- [ ] SQL injections impossible — Prisma uses parameterised queries exclusively
- [ ] CORS restricted to `https://w2w.athinatech.co.za` only
- [ ] Audit log is append-only — `UPDATE` and `DELETE` revoked at database level
- [ ] Sensitive data never logged — middleware strips passwords and tokens from logs
- [ ] File uploads validated for type and size before R2 upload
- [ ] Environment variables never in source code

---

## 14. Phase 8 — Data Migration from Prototype

**Duration: 1 week (Week 18)**

### Export State from Prototype

Open `W2W_Platform_v10.html` in a browser. Open browser console:

```javascript
copy(JSON.stringify(STATE, null, 2))
```

Paste the result into `backend/scripts/prototype-state.json`.

### Migration Script

```typescript
// backend/scripts/migrateFromPrototype.ts
import { prisma } from '../src/config/database'
import bcrypt from 'bcryptjs'
import state from './prototype-state.json'

async function migrate() {
  // 1. Sites (15)
  for (const site of state.sites) {
    await prisma.site.upsert({
      where:  { id: site.id },
      update: {},
      create: {
        id: site.id, name: site.name,
        region: site.region,
        province: 'Gauteng',
        municipality: 'City of Johannesburg Metro',
        ohsRating: site.ohsRating || 100
      }
    })
  }

  // 2. Waste categories (10)
  for (const cat of state.wasteCategories) {
    await prisma.wasteCategory.upsert({
      where:  { id: cat.id },
      update: { pricePerKg: cat.pricePerKg },
      create: {
        id: cat.id, code: cat.code,
        name: cat.name, eprCategory: cat.eprCategory,
        pricePerKg: cat.pricePerKg,
        buyers: cat.buyers || [cat.buyer].filter(Boolean)
      }
    })
  }

  // 3. Employees (112)
  for (const emp of state.employees) {
    await prisma.employee.upsert({
      where:  { id: emp.id },
      update: {},
      create: {
        id: emp.id,
        firstName: emp.first,
        lastName: emp.last,
        phone: emp.phone || null,
        siteId: emp.site || null,
        designation: emp.designation || 'Collector',
        status: emp.status || 'Active',
        stipend: emp.stipend || 0,
        serviceFee: emp.serviceFee || 0,
        preIncomeMonthly: emp.preIncomeMonthly || 0,
        enrollDate: emp.enrollDate ? new Date(emp.enrollDate) : null
      }
    })
  }

  // 4. User accounts (employees with system roles)
  const systemUsers = state.employees.filter(e => e.systemRole && e.password)
  for (const emp of systemUsers) {
    const hash = await bcrypt.hash(emp.password, 12)
    await prisma.user.upsert({
      where:  { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        passwordHash: hash,
        role: emp.systemRole,
        employeeId: emp.id,
        isActive: true
      }
    })
  }

  console.log('Migration complete')
}

migrate().catch(console.error)
```

Run against production using the Render external database URL:

```bash
DATABASE_URL="[Render external URL]" npx ts-node scripts/migrateFromPrototype.ts
```

Verify record counts after migration:

```sql
SELECT 'employees' as table, COUNT(*) FROM employees
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'sites', COUNT(*) FROM sites
UNION ALL SELECT 'waste_categories', COUNT(*) FROM waste_categories;
```

---

## 15. Phase 9 — Testing and UAT

**Duration: 2 weeks (Weeks 19–20)**

### Automated Tests

Write tests for the three most critical areas:

```typescript
// tests/auth.test.ts — login, token expiry, role enforcement
// tests/variance.test.ts — received vs sold calculation accuracy
// tests/waste.test.ts — price snapshot, depot stock update, P&L sync
// tests/pl.test.ts — lock month, locked entries not recalculated
```

Run tests in CI — Render does not run tests automatically, so add a pre-deploy check:

```bash
# Run before every merge to main
npm test -- --passWithNoTests
```

### UAT — Who Tests What

| Role | Test Focus |
|---|---|
| IT Admin | All modules, all roles, all permissions |
| CEO / Chairman | Dashboard, Impact metrics, Reports |
| CFO | P&L entry, Lock month, Financial report |
| Area Manager | Employees, Waste logs, Variance, EPR report, site banner shows their site |
| Site Supervisor | Depot scanner, Training, Attendance — scoped to their site only |
| Field Worker | Mobile app: clock in, clock out, own report, SOS |

### UAT Checklist Per Module

For every module test:
1. Happy path — normal operation works correctly
2. Role boundaries — supervisor cannot see other sites
3. Structure access — admin cannot add new sites or cooperatives
4. Data accuracy — waste log kg appears in variance report
5. Mobile responsiveness — tested on Samsung A-series (most common in SA)
6. Offline mode — submit check-in on airplane mode, verify sync on reconnect

---

## 16. Phase 10 — Deployment on Render

**Duration: Already configured in Phase 1 — ongoing**

### How Deployment Works

```
Developer finishes a feature on feature/branch
              ↓
Opens pull request → dev branch
              ↓
Code review and approval
              ↓
Merge to dev → deploys to staging automatically
              ↓
QA testing on staging
              ↓
Pull request from dev → main
              ↓
Merge to main → Render detects push
              ↓
Render runs: npm install && npm run build
              ↓
Render runs: prisma migrate deploy (in start command)
              ↓
New version goes live — zero downtime
              ↓
Health check: GET /api/health → 200 OK
              ↓
Old version terminated
```

### Render Dashboard — Three Services

```
w2w-database       PostgreSQL Starter      $7/month
w2w-backend        Web Service Starter     $7/month
w2w-frontend       Static Site             Free
─────────────────────────────────────────────────────
                   Total                   $14/month
```

### Staging Environment

Create a second set of Render services for staging:

```
w2w-database-staging    PostgreSQL Free tier    $0
w2w-backend-staging     Web Service Free tier   $0 (sleeps after 15 min)
w2w-frontend-staging    Static Site             $0

Total staging cost:     $0/month
```

Connect staging services to the `staging` branch. Staging auto-deploys when you merge to `staging` branch. All testing happens on staging. Production only gets code that has been tested on staging.

---

## 17. Phase 11 — Monitoring and Backups

**Duration: Week 21 — then ongoing**

### Render Built-In Monitoring

Available in the Render dashboard for every service:

- Live log streaming — searchable, last 7 days
- CPU and memory usage graphs
- Request count and response time (p50, p95, p99)
- Deploy history with rollback option

### UptimeRobot — External Monitoring (Free)

Sign up at uptimerobot.com. Create two monitors:

```
Monitor 1:
  Name:      W2W Frontend
  URL:       https://w2w.athinatech.co.za
  Interval:  5 minutes
  Alert:     Email + SMS

Monitor 2:
  Name:      W2W API Health
  URL:       https://api.w2w.athinatech.co.za/api/health
  Interval:  5 minutes
  Alert:     Email + SMS
```

If either monitor fails, text message sent within 5 minutes.

### Sentry — Error Tracking (Free Tier)

Every unhandled error in production captured with:
- Full stack trace
- The user who was logged in
- The request that caused the error
- Browser/OS information (frontend errors)

Free tier: 5,000 errors per month — well above W2W's needs.

### Backup Strategy

| Backup | Frequency | Retention | Storage |
|---|---|---|---|
| Render automated | Daily | 7 days | Render (included) |
| Your weekly export | Every Sunday 2am | 12 weeks | Cloudflare R2 |
| Your monthly export | 1st of month | 24 months | Cloudflare R2 |

**Weekly backup script** — run as a Render Cron Job ($1/month) or free cron service (cron-job.org):

```typescript
// scripts/backup.ts
// pg_dump → gzip → upload to Cloudflare R2
// Scheduled: 0 2 * * 0  (Sundays at 2am)
```

**To restore from any backup:**

```bash
# Download the backup file from Cloudflare R2
# Then restore to Render PostgreSQL:
psql [RENDER_EXTERNAL_DATABASE_URL] < w2w_backup_2026-04-01.sql
```

Test restoration quarterly — download a recent backup and restore to a local PostgreSQL to confirm it works.

### Health Check Endpoint

```typescript
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status:    'ok',
      database:  'connected',
      uptime:    Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    })
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' })
  }
})
```

Render uses this endpoint to determine if the service is healthy. If it returns anything other than 200, Render marks the deploy as failed and keeps the previous version running.

---

## 18. Phase 12 — Go-Live and Training

**Duration: 2 weeks (Weeks 23–24)**

### Phased Rollout Strategy

Do not go live at all 15 sites simultaneously.

**Week 23, Days 1–2:** Pilot at 2 sites
- Florida Lake (Region C) — established, predictable
- Newtown (Region F) — urban, good connectivity

**Week 23, Days 3–5:** Monitor pilot sites
- Check audit logs for errors
- Confirm waste logs sync correctly
- Verify stock variance figures match expectations
- Test SOS end-to-end
- Fix any critical issues

**Week 24, Days 1–3:** Roll out Region C and F (6 sites total)

**Week 24, Days 4–5:** Roll out Region D and G (remaining 9 sites)

### User Training Per Role

**IT Admin / Developer (self):** Full system walkthrough. Responsible for user account creation and password resets.

**Area Managers and CFO (half day, in-person):**
- Dashboard overview
- Employee registration
- P&L entry and lock month
- EPR monthly report submission
- Stock variance interpretation
- Report generation and export

**Site Supervisors (2 hours, can be remote):**
- Depot scanner operation
- Attendance management
- Training record updates
- Site banner confirms which site they are viewing

**Field Workers (30 minutes per site, in-person):**
- Install PWA: open browser → `w2w.athinatech.co.za/field` → Add to Home Screen
- Clock in / clock out
- View own waste collection totals
- SOS button — when to use and what happens

### Post-Launch Support Period

First 4 weeks after go-live: daily check-in with Area Managers. Weekly check of:

- Audit log for unusual activity
- Stock variance — any persistent unresolved gaps
- Error count in Sentry
- Database size and backup success in Render dashboard

---

## 19. Custom Domain Setup

### What Users See vs What Runs Behind

```
User types:   https://w2w.athinatech.co.za
              → Cloudflare DNS → Render Static Site → React App

API calls:    https://api.w2w.athinatech.co.za/api/...
              → Cloudflare DNS → Render Web Service → Node.js

Database:     dpg-xxxx.oregon-postgres.render.com:5432
              → Only accessible from backend on private network
              → Users never see this URL
```

The word "Render" and "onrender.com" never appears anywhere users can see.

### DNS Configuration in Cloudflare

Add these DNS records in your Cloudflare dashboard:

```
Type    Name    Target                              Proxy Status
CNAME   w2w     w2w-frontend.onrender.com           DNS only (grey cloud)
CNAME   api     w2w-backend.onrender.com            DNS only (grey cloud)
```

> **Important:** Set to "DNS only" (grey cloud) not "Proxied" (orange cloud). Render handles SSL and proxy — Cloudflare proxying can cause conflicts.

### Add Custom Domains in Render

1. Go to w2w-frontend service → Custom Domains → Add Domain → `w2w.athinatech.co.za`
2. Go to w2w-backend service → Custom Domains → Add Domain → `api.w2w.athinatech.co.za`

Render automatically provisions SSL certificates for both domains within minutes. HTTPS works with your custom domain. Done.

---

## 20. Complete Timeline

| Phase | What | Duration | Weeks |
|---|---|---|---|
| 0 | Planning, accounts, schema design, repo setup | 2 weeks | 1–2 |
| 1 | Render services, PostgreSQL, Prisma, project init | 1 week | 3 |
| 2 | Database schema and migrations | Concurrent with Phase 1 | 3 |
| 3 | Backend: all API routes, middleware, services | 6 weeks | 4–9 |
| 4 | Frontend: all React modules | 8 weeks | 4–11 (parallel) |
| 5 | Mobile PWA + offline sync | 3 weeks | 12–14 |
| 6 | PDF generation, reports, exports | 2 weeks | 15–16 |
| 7 | Security review, POPIA compliance, load testing | 1 week | 17 |
| 8 | Data migration from prototype | 1 week | 18 |
| 9 | Automated testing + UAT with real users | 2 weeks | 19–20 |
| 10 | Monitoring, backup verification, health checks | 1 week | 21 |
| 11 | Staging testing and final fixes | 1 week | 22 |
| 12 | Phased go-live and user training | 2 weeks | 23–24 |
| — | **Total** | **~24 weeks** | |

---

## 21. Cost Summary

### Monthly Running Costs (Once Live)

| Service | Plan | Cost |
|---|---|---|
| Render PostgreSQL | Starter | $7/month ≈ R130 |
| Render Web Service (backend) | Starter | $7/month ≈ R130 |
| Render Static Site (frontend) | Free | R0 |
| Cloudflare R2 (files + backups) | Free up to 10GB | R0 |
| Cloudflare DNS | Free | R0 |
| UptimeRobot (monitoring) | Free | R0 |
| Sentry (error tracking) | Free up to 5K errors/month | R0 |
| SendGrid (email) | Free up to 100 emails/day | R0 |
| Domain name (annual) | — | R150/year ≈ R13/month |
| **Total** | | **~$14/month ≈ R270/month** |

### When to Upgrade

| Trigger | Upgrade | Cost |
|---|---|---|
| Database exceeds 1GB | Render PostgreSQL Standard | $20/month |
| More than 97 concurrent DB connections | Render PostgreSQL Standard | $20/month |
| File storage exceeds 10GB | Cloudflare R2 paid | $0.015/GB beyond 10GB |
| Backend needs more memory | Render Standard ($25/month) or Pro | $25–$85/month |

W2W is unlikely to need any upgrades within the first 2–3 years of operation at current scale.

---

## 22. Module Reference

Every module below was designed and tested in the prototype. The production build implements the same logic with persistent data.

### Back Office Modules (Desktop)

| Module | Route | Access Roles |
|---|---|---|
| Dashboard | /dashboard | All management roles |
| Employee Directory | /employees | All management roles (scoped) |
| Onboarding Checklist | /onboarding | Admin, Supervisor, IT, Exec |
| Depot Scanner | /scanner | Admin, Supervisor, Depot |
| Waste Collection Logs | /waste | All management roles (scoped) |
| Stock Variance Report | /variance | All management roles (scoped) |
| Monthly EPR Report | /monthly-reports | Admin, Supervisor, IT, Exec |
| P&L Register | /pl | CFO, CEO, Chairman, IT |
| Reports Hub | /reports | Finance + management roles |
| Waste Collection Report | /reports/waste | All management roles |
| P&L Financial Report | /reports/pl | Finance roles |
| Training Tracker | /training | All management roles (scoped) |
| Warnings and Violations | /warnings | Admin, Supervisor, IT, Exec |
| Vehicles and Fleet | /vehicles | All management roles |
| PPE and Stock Register | /ppe | All management roles (scoped) |
| Depot Management | /depots | All management roles (scoped) |
| Sites and Regions | /sites | IT, Chairman, CEO only |
| Cooperatives | /cooperatives | IT, Chairman, CEO only |
| Beneficiary Tracker | /beneficiaries | IT, Chairman, CEO, CFO |
| Demographics | /demographics | Finance + exec |
| Attendance Report | /attendance | All management roles (scoped) |
| Audit Log | /audit | IT, Chairman, CEO only |
| Settings | /settings | IT, Chairman, CEO only |

### Field Worker Mobile App (FO)

| Screen | Route | Description |
|---|---|---|
| Attendance | /field/attendance | Clock in / clock out with GPS timestamp |
| My Report | /field/report | Own waste collection totals by category |
| My Profile | /field/profile | Personal details, training status |
| SOS | /field/sos | Emergency alert with GPS to Area Manager |

---

## 23. Role and Permission Matrix

### Access Levels

| Permission | IT | Chairman | CEO | CFO | Area Manager | Supervisor | Depot | Field |
|---|---|---|---|---|---|---|---|---|
| View all sites | ✓ | ✓ | ✓ | ✓ | Own site | Own site | Own depot | — |
| Add / edit employees | ✓ | ✓ | ✓ | — | — | — | — | — |
| View employees | ✓ | ✓ | ✓ | ✓ | Own site | Own site | — | Own profile |
| Depot scanner | ✓ | — | — | — | ✓ | ✓ | ✓ | — |
| View waste logs | ✓ | ✓ | ✓ | ✓ | Own site | Own site | Own depot | Own records |
| Stock variance | ✓ | ✓ | ✓ | ✓ | Own site | Own site | Own depot | — |
| P&L entry | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Lock month | ✓ | — | ✓ | ✓ | — | — | — | — |
| Unlock month | ✓ | — | — | — | — | — | — | — |
| Add sites / coops / depots | ✓ | ✓ | ✓ | — | — | — | — | — |
| View sites | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| EPR monthly report | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — |
| Financial reports | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Waste reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Impact dashboard | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Training management | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — |
| Issue warnings | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — |
| Audit log | ✓ | ✓ | ✓ | — | — | — | — | — |
| Settings / categories | ✓ | ✓ | ✓ | — | — | — | — | — |
| Mobile app | — | — | — | — | — | — | — | ✓ |

### Site Scoping

Area Manager, Site Supervisor, and Depot Operator are **site-scoped**. This means:

- The server automatically filters all queries to their assigned site
- They cannot pass a different `siteId` in requests to see other sites
- This enforcement happens in backend middleware — not just in the UI
- The site context banner on every page confirms which site they are viewing

---

*End of W2W Technical Development Plan v1.0*  
*Prepared by Athina Tech — May 2026*  
*For development queries contact: [insert contact]*
