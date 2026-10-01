# Turf Booking — Super Admin Panel

Next.js 14 + TypeScript + Tailwind CSS control panel for the Turf Booking
platform. Consumes the NestJS backend API (`/api/v1/admin/*`). Only
`SUPER_ADMIN` / `ADMIN` roles can sign in.

## URLs

| Environment | Panel                          | API                                      |
| ----------- | ------------------------------ | ---------------------------------------- |
| Live        | `https://turf-admin.gentlerock-8d88694a.centralindia.azurecontainerapps.io/login` | `https://turf-api.gentlerock-8d88694a.centralindia.azurecontainerapps.io/api/v1` |
| Local       | `http://localhost:3000/login`  | `http://localhost:4000/api/v1`           |

## Admin Credentials (demo seed data)

| Role        | Email                              | Password            |
| ----------- | ---------------------------------- | ------------------- |
| Super Admin | `superadmin.demo@turfplatform.test` | `TestSecurePass#2026` |
| Owner       | `owner.demo@turfarena.test`         | `TestSecurePass#2026` |
| Customer    | `customer.demo@sportfan.test`       | `TestSecurePass#2026` |

> Only the Super Admin account can access this panel (Owner/Customer logins
> are rejected by the admin role gate). These are public demo credentials —
> rotate them (or create dedicated admins) for real operations.

## Features

- **Dashboard** — users, turfs, bookings, revenue, pending approvals
- **Users** — search/filter, detail view, create, activate/deactivate
- **Owners** — approve/reject/suspend, full CRUD (create/edit/delete),
  new registrations default to unverified + inactive
- **Turfs** — approve/reject/suspend, create on behalf of an owner,
  edit incl. gallery (file upload to Azure Blob or image URL), city filter
- **Bookings** — advanced filters, full detail (payments/refunds/audit trail),
  create on behalf of a customer with live price preview
- **Reports** — revenue, bookings, users, turfs, commission, refunds (Recharts)

## Getting Started (local)

```bash
npm install
npm run dev      # http://localhost:3000 (uses NEXT_PUBLIC_API_URL)
```

`NEXT_PUBLIC_API_URL` is read from `.env.local` and is inlined at **build**
time — rebuild after changing it.

## Deploy

- **Azure (live):** push to `main` affecting `admin-panel/**` triggers
  `.github/workflows/turf-admin-AutoDeployTrigger.yml` → builds the Docker
  image → deploys Container App `turf-admin` (target port 3000).
- **Docker Compose (local full stack):** from the repo root,
  `docker compose up --build -d` (API on `:4000`, panel on `:3000`).
