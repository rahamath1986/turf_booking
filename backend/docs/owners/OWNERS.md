# Turf Owner Management & Business Analytics Subsystem

Comprehensive guide for Turf Owners and Venue Managers to analyze performance, view occupancy rates, track revenue, and manage customer & walk-in bookings.

---

## 1. Analytics & Executive Dashboard

Owner endpoints provide actionable visibility into turf revenue, booking trends, venue occupancy, peak utilization hours, and cancellations.

### Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/dashboard` | Turf Owner / Admin | Executive KPI summary: Today's revenue & bookings, monthly totals, all-time metrics, average occupancy rate, cancellation rate, top sport, busiest slot, and recent bookings |
| `GET` | `/api/v1/owner/dashboard/revenue` | Turf Owner / Admin | Daily and monthly revenue aggregations, with breakdown per turf venue |
| `GET` | `/api/v1/owner/dashboard/bookings` | Turf Owner / Admin | Booking volume by status (`CONFIRMED`, `COMPLETED`, `CANCELLED`), cancellation rate, and daily trends |
| `GET` | `/api/v1/owner/dashboard/occupancy` | Turf Owner / Admin | Venue capacity utilization: Booked slot hours vs. total operational hours, breakdown by turf venue and daily trends |
| `GET` | `/api/v1/owner/dashboard/peak-hours` | Turf Owner / Admin | Hourly booking frequencies (06:00 to 23:00), top 5 popular time slots, sport distributions, and day-part categorization (morning, afternoon, evening, night) |

---

## 2. Owner Bookings Management

Enables turf owners to view their venues' bookings, register walk-in offline bookings with conflict prevention, reschedule match slots, and cancel bookings when necessary.

### Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/bookings` | Turf Owner / Admin | Paginated list of bookings across owned turfs. Filterable by `turfId`, `status`, `startDate`, `endDate`, and full-text keyword search (`search`) |
| `GET` | `/api/v1/owner/bookings/:id` | Turf Owner / Admin | Complete booking audit view including customer contact, payment details, and full status history |
| `POST` | `/api/v1/owner/bookings/walk-in` | Turf Owner / Admin | Register an on-the-spot walk-in booking with cash/POS payment, slot conflict validation, and shadow customer creation |
| `POST` | `/api/v1/owner/bookings/:id/cancel` | Turf Owner / Admin | Owner cancels a match booking (e.g. bad weather or emergency maintenance), immediately releasing the slot (`activeSlotKey`) |
| `POST` | `/api/v1/owner/bookings/:id/reschedule` | Turf Owner / Admin | Owner moves a booking to a new date and time slot with conflict checks and audit trail recording |

---

## 3. Multi-Tenant Authorization Security

All owner endpoints strictly enforce venue ownership:
- A turf owner can only access statistics and bookings belonging to venues registered under their own profile.
- Attempts to query or mutate another owner's turf or booking immediately trigger an audit warning and return `403 Forbidden`.
- Platform Administrators and SuperAdmins have system-wide visibility across all venues.
