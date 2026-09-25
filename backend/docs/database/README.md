# 🗄️ Database Architecture & Migration Guide

## Database: `turf_booking_db`

### 1. Architectural Principles & Isolation
* **Logical Database Isolation**: `turf_booking_db` is logically isolated within PostgreSQL. It does not mix tables from future applications (e.g., `resumeats_db`, `invoice_db`) sharing the Azure subscription.
* **Environment Configuration**: Database connection is strictly driven by the `DATABASE_URL` environment variable:
  ```env
  DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/turf_booking_db?schema=public
  ```
* **No Hardcoded Credentials**: Connection strings, secrets, and credentials are never stored in code or repository commits.

---

### 2. Design Standards Applied
1. **Primary Keys**: All tables utilize UUID v4 (`@id @default(uuid()) @db.Uuid`) to avoid sequential ID enumeration attacks.
2. **Timestamps**: `created_at` and `updated_at` use microsecond-accurate PostgreSQL timestamps with timezone (`@db.Timestamptz(6)`).
3. **Soft Deletion**: Models supporting recovery or audit retention (`users`, `user_addresses`, `sports`, `turf_owners`, `turfs`) maintain a nullable `deleted_at` field with dedicated indexes.
4. **Relational Constraints**:
   - `onDelete: Cascade` is applied to dependent sub-entities (e.g., `turf_images`, `turf_videos`, `operating_hours`, `user_roles`).
   - `onDelete: Restrict` is applied to essential foreign keys (e.g., `owner_id`, `city_id`, `role_id`) to prevent accidental orphan creation.
   - `onDelete: SetNull` is applied to optional audit or reference fields (e.g., `blocked_by_user_id`, `area_id`).
5. **Targeted Indexing**: Indexes are created on foreign keys, filtering flags (`isActive`), search vectors, and compound keys (`[turfId, dayOfWeek]`, `[email, isActive]`).

---

### 3. Core Database Tables (Phase 2)

#### Users & Authentication
- `users`: Core identity accounts.
- `roles`: Platform RBAC roles (`SUPER_ADMIN`, `ADMIN`, `TURF_OWNER`, `MANAGER`, `STAFF`, `CUSTOMER`).
- `user_roles`: Many-to-many role assignments.
- `user_addresses`: User delivery/billing addresses with location hierarchy links.
- `user_devices`: FCM device tokens and mobile/web client tracking.

#### Locations Catalog
- `countries`: ISO country records.
- `states`: Regional state divisions.
- `cities`: Operational cities.
- `areas`: Micro-locations / neighborhoods with postal codes.

#### Sports & Facilities
- `sports`: Supported sports (Football, Cricket, Badminton, Tennis, Pickleball, Basketball) with player limits.
- `facilities`: Venue amenities (Floodlights, Changing Rooms, Parking, Cafeteria, etc.).

#### Turf Venues & Ownership
- `turf_owners`: Business KYC, PAN, GST, and bank account details.
- `turfs`: Multi-sport turf venues with geo-coordinates, reviews, and status.
- `turf_images`: High-resolution gallery metadata.
- `turf_videos`: Video tour links and thumbnails.
- `turf_sports`: Mapping of sports hosted at each turf.
- `turf_facilities`: Mapping of amenities offered at each turf.

#### Turf Operations & Configuration
- `operating_hours`: Weekly opening/closing schedules per day.
- `pricing_rules`: Dynamic weekday/weekend and time-of-day hourly pricing.
- `blocked_slots`: Scheduled maintenance, private events, or weather blackout slots.

#### Audit
- `audit_logs`: Immutable security, authorization, and administrative action logs.

---

### 4. Migration & Management Workflow

```bash
# Validate Prisma schema syntax and relations
npx prisma validate

# Generate updated Prisma client TypeScript definitions
npx prisma generate

# Apply migrations in local development
npx prisma migrate dev --name <migration_name>

# Apply migrations in CI/CD pipeline or production environment
npx prisma migrate deploy

# Launch visual database browser
npx prisma studio

# Seed initial bootstrap data
npm run prisma:seed
```

---

### 5. Seeded Test Data Reference

The database includes test fixtures for development and automated testing:

| Entity Type | Identifier / Name | Key Attributes |
|---|---|---|
| **Super Admin** | `superadmin.demo@turfplatform.test` | Role: `SUPER_ADMIN`, `ADMIN` |
| **Turf Owner** | `owner.demo@turfarena.test` | Business: "Spartan Sports Arena LLP" |
| **Customer** | `customer.demo@sportfan.test` | Role: `CUSTOMER`, registered iOS device |
| **Venue** | "Spartan Sports Arena Koramangala" | Bengaluru -> Koramangala, 4 sports, 5 facilities |
| **Pricing Rules** | Weekday (₹1,200 - ₹1,800), Weekend (₹2,000) | Hourly pricing rules configured |
| **Blocked Slot** | `2026-10-01` 06:00 - 12:00 | Maintenance blackout period |
