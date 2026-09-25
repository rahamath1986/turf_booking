# 🔐 Authentication & RBAC Architecture Specification

## Logical Database: `turf_booking_db`
**Security Standard**: Argon2id + JWT Access/Refresh Token Rotation + Role-Based Access Control (RBAC)  
**API Version**: `/api/v1/auth/*`  

---

## 1. Supported Platform Roles

The system enforces backend RBAC across 6 standard platform roles:

| Role Name | Scope & Permissions | Target Audience |
|---|---|---|
| `SUPER_ADMIN` | Global platform administration, cloud infrastructure oversight, owner verification | Internal Platform Executives |
| `ADMIN` | Venue approval, dispute resolution, analytics, user account moderation | Operations & Support Team |
| `TURF_OWNER` | Turf facility management, court setup, pricing rules, staff delegation | Venue Business Owners |
| `MANAGER` | Venue operations, daily slot management, staff supervision | Turf Managers |
| `STAFF` | On-site ground coordination, QR ticket validation, check-in execution | Ground Staff |
| `CUSTOMER` | Venue discovery, real-time booking, slot holds, payments, reviews | End-User Sports Players |

---

## 2. Security Engineering Principles

### No Plaintext Passwords
* All user passwords are encrypted using **Argon2id** (memory cost: 65,536 KB, time cost: 3 iterations, parallelism: 4 lanes) before reaching PostgreSQL.
* Passwords are never logged, returned in DTOs, or exposed in API responses.

### Short-Lived Access Tokens & Long-Lived Refresh Tokens
* **Access Token**: Signed using HMAC-SHA256 (`HS256`) with a 15-minute TTL (`15m`). Contains `sub` (userId), `email`, and `roles`.
* **Refresh Token**: Signed JWT with a 7-day TTL (`7d`).
* **Hashed Storage**: Only the cryptographic SHA-256 hash of the refresh token is stored in the database (`refresh_tokens.token_hash`), preventing token exposure in the event of database dumps.

### Automatic Refresh Token Rotation & Reuse Detection
1. When a client calls `POST /api/v1/auth/refresh-token`, the active refresh token is marked as `is_revoked: true` and replaced by a newly issued refresh token in a single atomic database transaction.
2. If an attacker attempts to reuse an already-revoked refresh token (token replay attack), the system automatically triggers a **security alert** and revokes **ALL** active refresh tokens for that user, invalidating every active session across all devices.

### Rate Limiting & Brute-Force Protection
* Global NestJS `ThrottlerGuard` enforces request limits per client IP.
* `POST /api/v1/auth/send-otp` enforces a minimum 60-second cooldown between OTP dispatch requests for the same target phone or email.
* OTP codes allow a maximum of 3 failed verification attempts before automatic invalidation.

---

## 3. Implemented API Endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register new user account (`CUSTOMER` or `TURF_OWNER`) |
| `POST` | `/api/v1/auth/login` | Public | Email + password authentication, returns token pair |
| `POST` | `/api/v1/auth/send-otp` | Public (Throttled) | Dispatch 6-digit numeric OTP for login, register, or reset |
| `POST` | `/api/v1/auth/verify-otp` | Public | Verify OTP code and execute purpose-specific action |
| `POST` | `/api/v1/auth/refresh-token` | Public | Rotate refresh token and obtain new access token |
| `POST` | `/api/v1/auth/logout` | Public / Bearer | Revoke active refresh token / session |
| `POST` | `/api/v1/auth/forgot-password` | Public | Issue password reset token (user enumeration protected) |
| `POST` | `/api/v1/auth/reset-password` | Public | Reset password using reset token; revokes all sessions |
| `POST` | `/api/v1/auth/change-password` | Bearer Token | Authenticated password change; revokes other sessions |
| `GET` | `/api/v1/auth/me` | Bearer Token | Retrieve authenticated user profile and roles |

---

## 4. API Request / Response Samples

### 1. Register (`POST /api/v1/auth/register`)
**Request**:
```json
{
  "fullName": "Rahul Sharma",
  "email": "rahul.sharma@example.com",
  "phone": "+919876543210",
  "password": "SecurePassword#2026",
  "role": "CUSTOMER"
}
```
**Response (201 Created)**:
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "user": {
      "id": "e3a89047-9876-47b8-b593-9c8e1d2f3a4b",
      "email": "rahul.sharma@example.com",
      "fullName": "Rahul Sharma",
      "phone": "+919876543210",
      "roles": ["CUSTOMER"],
      "isEmailVerified": false,
      "isPhoneVerified": false,
      "createdAt": "2026-09-25T03:55:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  },
  "timestamp": "2026-09-25T03:55:00.000Z",
  "correlationId": "8f9a0b1c-2d3e-4f5a-6b7c-8d9e0f1a2b3c"
}
```

### 2. Login (`POST /api/v1/auth/login`)
**Request**:
```json
{
  "email": "rahul.sharma@example.com",
  "password": "SecurePassword#2026"
}
```
**Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "id": "e3a89047-9876-47b8-b593-9c8e1d2f3a4b",
      "email": "rahul.sharma@example.com",
      "fullName": "Rahul Sharma",
      "phone": "+919876543210",
      "roles": ["CUSTOMER"]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  },
  "timestamp": "2026-09-25T03:55:05.000Z"
}
```

### 3. Role Authorization Failure (403 Forbidden)
When a `CUSTOMER` attempts to access an administrator route:
```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied: requires one of [SUPER_ADMIN, ADMIN]",
  "timestamp": "2026-09-25T03:55:10.000Z",
  "path": "/api/v1/admin/stats",
  "correlationId": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d"
}
```

---

## 5. Automated Test Coverage

The test suite covers all mandated authentication scenarios:
* `Registration`: Hashes password with Argon2id, verifies uniqueness constraints, rejects weak passwords.
* `Login`: Authenticates valid credentials, returns access & refresh tokens.
* `Invalid Password`: Rejects invalid passwords with 401 Unauthorized without leaking existence.
* `Expired Token`: Forges an expired token to confirm 401 Unauthorized rejection.
* `Unauthorized Request`: Validates 401 rejection on protected routes without Bearer tokens.
* `Role Authorization`: Confirms CUSTOMER accounts receive 403 Forbidden on Admin endpoints, while SUPER_ADMIN accounts receive 200 OK.
* `Refresh Token Rotation`: Verifies token replacement and triggers reuse defense invalidation.
* `OTP Lifecycle`: Dispatches and verifies 6-digit one-time codes with TTL expiration.
