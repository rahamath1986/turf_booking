# Turf Management Module Documentation

## 1. Overview
The Turf Management module powers both customer discovery and owner facility lifecycle management for the Multi-Turf Sports Booking Platform. It enforces multi-tenant boundaries ensuring turf owners can only manage their own facilities while customers can search, filter, discover nearby venues with geospatial distance calculation, and inspect facility details.

---

## 2. API Endpoints Reference

### 2.1 Customer Discovery APIs (Public)

| Method | Endpoint | Description | Query Parameters / Features |
|---|---|---|---|
| `GET` | `/api/v1/turfs` | List all active turfs | `cityId`, `sportId`, `minPrice`, `maxPrice`, `minRating`, `sortBy`, `sortOrder`, `page`, `limit` |
| `GET` | `/api/v1/turfs/search` | Full-text search | `q` (name, address, area, city), pagination |
| `GET` | `/api/v1/turfs/nearby` | Geospatial proximity search | `latitude`, `longitude`, `radiusKm` (default: 10km), `limit`, `page` |
| `GET` | `/api/v1/turfs/featured` | Curated featured turfs | `limit` (default: 10) |
| `GET` | `/api/v1/turfs/popular` | Most popular turfs | Ranked by `ratingAverage` (DESC) and `totalReviews` (DESC) |
| `GET` | `/api/v1/turfs/:id` | Turf overview | Complete overview with pricing rules, operating hours, sports, facilities, and images |

### 2.2 Turf Detail Sub-resource APIs (Public)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/turfs/:id/sports` | Available sports with icons and specifications |
| `GET` | `/api/v1/turfs/:id/facilities` | On-premise amenities and facilities (e.g. Floodlights, Parking, Changing Rooms) |
| `GET` | `/api/v1/turfs/:id/images` | Gallery images with `displayOrder` and `isCover` flag |
| `GET` | `/api/v1/turfs/:id/rules` | Venue operating rules and terms |
| `GET` | `/api/v1/turfs/:id/policies` | Venue cancellation, refund, and reschedule policies |

### 2.3 Owner Management APIs (Protected)
> **Auth Required**: `Bearer <JWT_ACCESS_TOKEN>`
> **Roles Allowed**: `TURF_OWNER`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`
> **Multi-Tenant Rule**: Non-admin owners are strictly forbidden from viewing or altering another owner's turf (`403 Forbidden`).

| Method | Endpoint | Description | Payload / Action |
|---|---|---|---|
| `POST` | `/api/v1/owner/turfs` | Create a new turf | Complete registration with sports, facilities, hours, pricing rules, images |
| `GET` | `/api/v1/owner/turfs` | List owner's turfs | Returns all facilities owned by the authenticated owner |
| `GET` | `/api/v1/owner/turfs/:id` | Get owner's turf by ID | Full internal detail with tenant isolation check |
| `PUT` | `/api/v1/owner/turfs/:id` | Update turf details | Update basic info, rules, policies, sports, facilities, pricing, hours |
| `DELETE` | `/api/v1/owner/turfs/:id` | Soft-delete turf | Sets `deletedAt = new Date()`, prevents new bookings |
| `PATCH` | `/api/v1/owner/turfs/:id/status` | Toggle operational status | `{ "isActive": true \| false }` |

---

## 3. Filtering, Sorting, and Search Specifications

### 3.1 City & Sport Filtering
- `cityId`: UUID of target city.
- `sportId`: UUID of target sport. Uses Prisma relation filter `sports: { some: { sportId } }`.

### 3.2 Pricing & Rating Filtering
- `minPrice`: Filters turfs with starting price `>= minPrice`.
- `maxPrice`: Filters turfs with starting price `<= maxPrice`.
- `minRating`: Filters turfs where `ratingAverage >= minRating`.

### 3.3 Sorting Options
- `sortBy`: `createdAt` | `ratingAverage` | `startingPrice` | `name`
- `sortOrder`: `asc` | `desc` (default: `desc`)

### 3.4 Proximity Distance Search (Haversine Formula)
Implemented in `TurfsService.findNearby` using the spherical law of Haversine:
$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
- `latitude`: User's current latitude (-90 to 90).
- `longitude`: User's current longitude (-180 to 180).
- `radiusKm`: Search radius (default: 10km, max: 100km).
- Returns items sorted ascending by distance (`distanceKm`).

---

## 4. Multi-Tenant Security & Owner Authorization Boundary

### 4.1 Owner Profile Resolution
When an owner registers or interacts with owner endpoints:
1. `JwtAuthGuard` authenticates the user and attaches `req.user` (`userId`, `roles`).
2. `RolesGuard` ensures user has `TURF_OWNER`, `MANAGER`, `ADMIN`, or `SUPER_ADMIN`.
3. If an owner profile doesn't exist yet on `POST /api/v1/owner/turfs`, it is automatically provisioned for the user.
4. For all operations (`GET /:id`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/status`), `assertTurfOwnership(turfId, userId, userRoles)`:
   - Validates the turf exists.
   - If user does not have `ADMIN` or `SUPER_ADMIN` and `turf.owner.userId !== userId`, an immediate `ForbiddenException('You are not authorized to manage this turf')` is thrown.
   - Cross-tenant data leakage is completely prevented.

---

## 5. Automated Tests

### 5.1 Unit Tests (`src/turfs/turfs.service.spec.ts`)
- Listing active turfs with pagination metadata.
- Single turf lookup with NotFoundException handling.
- Distance calculation and radius filtering using Haversine formula.
- Owner authorization verification: allows turf owner, rejects unauthorized owner with `403 Forbidden`.
- Status toggle and soft deletion validation.

### 5.2 End-to-End Tests (`test/turfs.e2e-spec.ts`)
- Customer discovery:
  - `GET /api/v1/turfs` (pagination, filtering, sorting).
  - `GET /api/v1/turfs/search?q=...`
  - `GET /api/v1/turfs/nearby?latitude=...&longitude=...&radiusKm=...`
  - `GET /api/v1/turfs/featured`
  - `GET /api/v1/turfs/popular`
  - `GET /api/v1/turfs/:id`
  - `GET /api/v1/turfs/:id/sports`
  - `GET /api/v1/turfs/:id/facilities`
  - `GET /api/v1/turfs/:id/images`
  - `GET /api/v1/turfs/:id/rules`
  - `GET /api/v1/turfs/:id/policies`
- Owner management & multi-tenant isolation:
  - Owner A creates turf.
  - Owner A reads their turf list and single turf detail.
  - Owner A updates their turf.
  - Owner A toggles active status.
  - **Security check**: Owner B attempts `GET /api/v1/owner/turfs/:ownerATurfId` -> returns `403 Forbidden`.
  - **Security check**: Owner B attempts `PUT /api/v1/owner/turfs/:ownerATurfId` -> returns `403 Forbidden`.
  - **Security check**: Owner B attempts `PATCH /api/v1/owner/turfs/:ownerATurfId/status` -> returns `403 Forbidden`.
  - **Security check**: Owner B attempts `DELETE /api/v1/owner/turfs/:ownerATurfId` -> returns `403 Forbidden`.
  - Customer role attempting owner API -> returns `403 Forbidden`.
  - Unauthenticated request attempting owner API -> returns `401 Unauthorized`.
