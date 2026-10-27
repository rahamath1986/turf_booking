# 🏟️ Multi-Turf Sports Booking Platform

Enterprise-grade sports turf booking solution designed for mobile applications (Flutter), turf owner management, and admin oversight.

## Project Structure
- `/backend`: NestJS + TypeScript + PostgreSQL + Prisma + Redis backend service (`app-turf-api`).
- `/frontend`: Client application / dashboard workspaces.
- `docker-compose.yml`: Local infrastructure orchestrator for PostgreSQL 16 (`turf_booking_db`) and Redis 7.

For backend instructions, API documentation, and migration guides, refer to [backend/README.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/README.md).

## Live URLs

- Admin panel: `https://turf-admin.gentlerock-8d88694a.centralindia.azurecontainerapps.io/login`
- API: `https://app-service-api-c3hwa9dpeggseyb5.centralindia-01.azurewebsites.net/turf/api/v1`

## Admin Credentials (demo seed data)

| Role        | Email                              | Password              |
| ----------- | ---------------------------------- | --------------------- |
| Super Admin | `superadmin.demo@turfplatform.test` | `TestSecurePass#2026` |
| Owner       | `owner.demo@turfarena.test`         | `TestSecurePass#2026` |
| Customer    | `customer.demo@sportfan.test`       | `TestSecurePass#2026` |

> Only SUPER_ADMIN / ADMIN roles can sign in to the admin panel. These are
> public demo credentials — rotate them for real operations.
