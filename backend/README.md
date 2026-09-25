# Turf Booking Platform - Backend API Service

Production-ready backend API service for the Multi-Turf Sports Booking Platform built with NestJS, TypeScript, Prisma ORM, PostgreSQL, and Redis.

---

## 🛠️ Tech Stack & Infrastructure

- **Framework**: [NestJS](https://nestjs.com/) (Modular Architecture)
- **Database**: PostgreSQL 16 (with UUIDs, soft deletes, foreign keys, indexes, and unique constraints)
- **ORM & Migrations**: [Prisma](https://www.prisma.io/) (Non-destructive declarative migrations)
- **Cache & Concurrency**: Redis 7
- **Security**: JWT (Access & Refresh tokens with rotation), argon2/bcrypt password hashing, HMAC-SHA256 signature verification, timing-safe equality comparison
- **Testing**: Jest Unit Tests & Supertest E2E Integration Tests

---

## 🚀 Getting Started

### 1. Start Infrastructure
```bash
docker compose up -d
```
- PostgreSQL: `localhost:5434` (Database: `turf_booking_db`)
- Redis: `localhost:6380`

### 2. Environment Configuration
Copy `.env.example` to `.env` or verify:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://turf_admin:turf_secure_password_2026@localhost:5434/turf_booking_db?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380
JWT_ACCESS_SECRET=your_jwt_access_secret_key_minimum_32_chars
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_minimum_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PAYMENT_PROVIDER=MOCK
PAYMENT_KEY_ID=rzp_test_sample_key_id
PAYMENT_KEY_SECRET=sample_mock_secret_key_12345
PAYMENT_WEBHOOK_SECRET=sample_mock_webhook_secret_67890
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD...\n-----END PRIVATE KEY-----\n"
```

### 3. Run Migrations & Seed
```bash
npx prisma migrate deploy
npm run seed
```

### 4. Run Application
```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 5. Run Tests
```bash
# Unit tests
npm test

# End-to-end integration tests
npm run test:e2e

# Linting
npm run lint
```

---

## 📡 API Endpoints

### 📊 Owner Analytics & Management
Detailed documentation: [docs/owners/OWNERS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/owners/OWNERS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/dashboard` | Turf Owner / Admin | Executive KPI dashboard: revenue, bookings count, occupancy, cancellations, and top sports |
| `GET` | `/api/v1/owner/dashboard/revenue` | Turf Owner / Admin | Daily and monthly revenue trends with breakdown per turf venue |
| `GET` | `/api/v1/owner/dashboard/bookings` | Turf Owner / Admin | Booking volume by status (`CONFIRMED`, `COMPLETED`, `CANCELLED`), cancellation rate, and daily trends |
| `GET` | `/api/v1/owner/dashboard/occupancy` | Turf Owner / Admin | Venue utilization rate: booked slot hours against operational capacity |
| `GET` | `/api/v1/owner/dashboard/peak-hours` | Turf Owner / Admin | Peak hours analysis across 24h day-parts (morning, afternoon, evening, night) and popular sports |
| `GET` | `/api/v1/owner/bookings` | Turf Owner / Admin | Paginated bookings across owned venues with search and status filtering |
| `GET` | `/api/v1/owner/bookings/:id` | Turf Owner / Admin | Detailed booking record with customer contact, payments, and status history |
| `POST` | `/api/v1/owner/bookings/walk-in` | Turf Owner / Admin | Register walk-in / offline booking on the spot with double-booking prevention |
| `POST` | `/api/v1/owner/bookings/:id/cancel` | Turf Owner / Admin | Turf owner cancels booking with reason, immediately releasing the slot |
| `POST` | `/api/v1/owner/bookings/:id/reschedule` | Turf Owner / Admin | Turf owner moves booking to another time slot with conflict checks |

---

### ❤️ Favorites
Detailed documentation: [docs/favorites-reviews-coupons/FAVORITES_REVIEWS_COUPONS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/favorites-reviews-coupons/FAVORITES_REVIEWS_COUPONS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/favorites` | Customer | List authenticated customer's favorited turfs with images and amenities |
| `POST` | `/api/v1/favorites/:turfId` | Customer | Add a turf venue to favorites (idempotent upsert) |
| `DELETE` | `/api/v1/favorites/:turfId` | Customer | Remove a turf from favorites |

---

### ⭐ Reviews & Owner Replies
Detailed documentation: [docs/favorites-reviews-coupons/FAVORITES_REVIEWS_COUPONS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/favorites-reviews-coupons/FAVORITES_REVIEWS_COUPONS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/turfs/:id/reviews` | Public | Paginated customer reviews with star rating breakdown summary |
| `POST` | `/api/v1/turfs/:id/reviews` | Customer | Submit review for turf. Automatically recalculates venue rating average |
| `PUT` | `/api/v1/reviews/:id` | Author / Admin | Update star rating and review comment |
| `DELETE` | `/api/v1/reviews/:id` | Author / Admin | Delete review and recalculate venue rating average |
| `POST` | `/api/v1/reviews/:id/reply` | Turf Owner / Admin | Verified turf owner public response to a customer review |

---

### 🎟️ Coupons & Promotions Engine
Detailed documentation: [docs/favorites-reviews-coupons/FAVORITES_REVIEWS_COUPONS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/favorites-reviews-coupons/FAVORITES_REVIEWS_COUPONS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/coupons` | Public | Active public coupons eligible for booking |
| `POST` | `/api/v1/coupons/validate` | Public / Auth | Validates coupon across 8 business rules and calculates discount |
| `POST` | `/api/v1/admin/coupons` | Admin | Create coupon with expiry, caps, usage limits, and turf/sport restrictions |
| `GET` | `/api/v1/admin/coupons` | Admin | List all promotional coupons with total redemption metrics |
| `GET` | `/api/v1/admin/coupons/:id` | Admin | Get coupon details and recent redemptions audit log |
| `PUT` | `/api/v1/admin/coupons/:id` | Admin | Update coupon rules or toggle active status |
| `DELETE` | `/api/v1/admin/coupons/:id` | Admin | Delete promotional coupon |

---

### 🔔 Notifications & Device Management (FCM)
Detailed documentation: [docs/notifications/NOTIFICATIONS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/notifications/NOTIFICATIONS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/devices` | Authenticated | Register or update FCM device token with device metadata |
| `DELETE` | `/api/v1/devices/:id` | Authenticated | Unregister/deactivate device token |
| `GET` | `/api/v1/notifications` | Authenticated | Paginated user notification inbox (supports `type`, `isRead` filters) |
| `GET` | `/api/v1/notifications/unread` | Authenticated | Quick unread notifications and unread badge count |
| `POST` | `/api/v1/notifications/:id/read` | Authenticated | Mark a single notification as read |
| `POST` | `/api/v1/notifications/read-all` | Authenticated | Mark all user notifications as read |

---

### 🔄 Cancellations & Refunds
Detailed documentation: [docs/refunds/REFUNDS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/refunds/REFUNDS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/turfs/:id/cancellation-policy` | Public | View turf cancellation policy and refund tiers |
| `GET` | `/api/v1/bookings/:id/cancellation-fee` | Customer / Admin | Server-side calculation of cancellation fee based on lead time |
| `GET` | `/api/v1/bookings/:id/refund-preview` | Customer / Admin | Preview refundable amount, deductions, and policy rule |
| `POST` | `/api/v1/bookings/:id/cancel` | Customer / Admin | Cancel booking and trigger automatic refund workflow |
| `POST` | `/api/v1/refunds` | Customer / Admin | Initiate manual refund request for eligible booking |
| `GET` | `/api/v1/refunds/:id` | Customer / Admin | Full refund audit record with payment provider reference |

---

### 💳 Payments & Webhooks
Detailed documentation: [docs/payments/PAYMENTS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/payments/PAYMENTS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/create-order` | Customer | Initiates payment order from a slot hold or pending booking |
| `POST` | `/api/v1/payments/verify` | Customer | **Server-side cryptographic verification** (HMAC-SHA256) & atomic booking confirmation |
| `GET` | `/api/v1/payments/:id` | Customer / Admin | Full payment audit record including status transition history |
| `GET` | `/api/v1/payments/:id/status` | Customer / Admin | Lightweight polling endpoint for payment status |
| `POST` | `/api/v1/webhooks/payment` | Public (Signed) | Payment gateway webhook with signature verification and deduplication |

---

### 📅 Booking Engine
Detailed documentation: [docs/bookings/BOOKINGS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/bookings/BOOKINGS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/booking/holds` | Customer | Temporary 10-minute hold on a slot |
| `GET` | `/api/v1/booking/holds/:id` | Customer | Check slot hold validity and expiration |
| `DELETE` | `/api/v1/booking/holds/:id` | Customer | Manually release a slot hold |
| `POST` | `/api/v1/bookings` | Customer | Create booking directly or from an active hold |
| `GET` | `/api/v1/bookings` | Customer / Admin | List user bookings with pagination & status filters |
| `GET` | `/api/v1/bookings/:id` | Customer / Admin | Get full booking details with status history |
| `GET` | `/api/v1/bookings/:id/status` | Customer / Admin | Get current booking status |
| `POST` | `/api/v1/bookings/:id/cancel` | Customer / Admin | Cancel a booking with reason |
| `POST` | `/api/v1/bookings/:id/reschedule`| Customer / Admin | Reschedule booking to another available slot |

---

### 🕒 Turf Availability & Dynamic Pricing
Detailed documentation: [docs/availability/AVAILABILITY.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/availability/AVAILABILITY.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/turfs/:id/availability` | Public | Full day operating schedule & slots |
| `GET` | `/api/v1/turfs/:id/available-slots` | Public | Real-time list of bookable slots |
| `GET` | `/api/v1/turfs/:id/pricing` | Public | Dynamic pricing calculation (peak, weekend, holiday) |
| `GET` | `/api/v1/owner/turfs/:id/availability` | Turf Owner | Owner availability view |
| `POST` | `/api/v1/owner/turfs/:id/availability` | Turf Owner | Set custom date operating schedule |
| `PUT` | `/api/v1/owner/turfs/:id/availability` | Turf Owner | Update operating schedule |
| `POST` | `/api/v1/owner/turfs/:id/block-slot` | Turf Owner | Block slot for maintenance or tournament |
| `DELETE` | `/api/v1/owner/turfs/:id/block-slot/:slotId` | Turf Owner | Unblock slot |

---

### 🏟️ Turf Management
Detailed documentation: [docs/turfs/TURFS.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/turfs/TURFS.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/turfs` | Public | Paginated list with city, sport, and price filters |
| `GET` | `/api/v1/turfs/:id` | Public | Detailed turf info |
| `GET` | `/api/v1/turfs/search` | Public | Keyword search across name and description |
| `GET` | `/api/v1/turfs/nearby` | Public | Haversine distance-based search by lat/lng |
| `GET` | `/api/v1/turfs/featured` | Public | Curated featured turfs |
| `GET` | `/api/v1/turfs/popular` | Public | Highly rated turfs |
| `POST` | `/api/v1/owner/turfs` | Turf Owner | Create a new turf |
| `GET` | `/api/v1/owner/turfs` | Turf Owner | List owner's turfs |
| `GET` | `/api/v1/owner/turfs/:id` | Turf Owner | Owner turf detail |
| `PUT` | `/api/v1/owner/turfs/:id` | Turf Owner | Update turf |
| `DELETE` | `/api/v1/owner/turfs/:id` | Turf Owner | Soft delete turf |
| `PATCH` | `/api/v1/owner/turfs/:id/status` | Turf Owner | Activate/deactivate turf |

---

### 🔐 Authentication & RBAC
Detailed documentation: [docs/auth/AUTH.md](file:///Users/rahamathalikhan/Documents/turf_booking/backend/docs/auth/AUTH.md)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Register customer or owner |
| `POST` | `/api/v1/auth/login` | Public | Login with email & password |
| `POST` | `/api/v1/auth/send-otp` | Public | Dispatch phone OTP |
| `POST` | `/api/v1/auth/verify-otp` | Public | Authenticate via OTP |
| `POST` | `/api/v1/auth/refresh-token` | Public | Rotate refresh token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revoke refresh tokens |
| `POST` | `/api/v1/auth/forgot-password` | Public | Trigger password reset |
| `POST` | `/api/v1/auth/reset-password` | Public | Reset password with token |
| `POST` | `/api/v1/auth/change-password` | Authenticated | Change current password |
| `GET` | `/api/v1/auth/me` | Authenticated | Get current user profile & roles |

