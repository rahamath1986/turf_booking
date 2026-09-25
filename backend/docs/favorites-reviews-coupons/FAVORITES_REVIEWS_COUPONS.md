# Favorites, Reviews & Promotional Coupons Subsystems

Comprehensive guide for Favorites, Turf Reviews & Owner Replies, and Promotional Coupons with Rule Engine validation.

---

## 1. Favorites Subsystem

Provides wishlist/favorites management for authenticated customers to save their preferred venues.

### Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/favorites` | Authenticated | Get paginated list of user's favorited turfs with images and sport types |
| `POST` | `/api/v1/favorites/:turfId` | Authenticated | Add a turf to user's favorites (idempotent upsert) |
| `DELETE` | `/api/v1/favorites/:turfId` | Authenticated | Remove a turf from user's favorites |

---

## 2. Reviews Subsystem

Customer reviews with ratings from 1 to 5, aggregate star breakdown, and verified turf owner responses.

### Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/turfs/:id/reviews` | Public | Paginated reviews with star distribution summary (1-5 stars) |
| `POST` | `/api/v1/turfs/:id/reviews` | Authenticated | Submit review for turf. Automatically syncs turf average rating |
| `PUT` | `/api/v1/reviews/:id` | Author / Admin | Update rating and review comment |
| `DELETE` | `/api/v1/reviews/:id` | Author / Admin | Delete review and recalculate venue rating average |
| `POST` | `/api/v1/reviews/:id/reply` | Turf Owner / Admin | Turf owner posts public reply to customer review |

---

## 3. Coupons & Promotions Engine

Rule-based discounting engine supporting percentage or flat discounts with comprehensive constraints.

### Supported Business Rules

1. **Expiry Window**: Verified between `startDate` and `endDate`.
2. **Minimum Order Amount**: `amount >= minOrderAmount` required to trigger discount.
3. **Maximum Discount Cap**: Percentage discounts capped by `maxDiscountAmount` in INR.
4. **Total Usage Limit**: Global redemption cap across platform (`currentUsageCount < totalUsageLimit`).
5. **Per-User Limit**: Enforces maximum redemptions per individual user (`CouponUsage` table).
6. **Turf Restriction**: Optional constraint to specific turf IDs (`turfIds: string[]`).
7. **Sport Restriction**: Optional constraint to specific sports (e.g. `['CRICKET', 'FOOTBALL']`).
8. **First Booking Only**: Restricts discount to users with 0 prior confirmed bookings (`isFirstBookingOnly: true`).

### Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/coupons` | Public | List active public coupons eligible for current time window |
| `POST` | `/api/v1/coupons/validate` | Public / Auth | Evaluates coupon code against all 8 rules and calculates discount |
| `POST` | `/api/v1/admin/coupons` | Admin / SuperAdmin | Create new promotional coupon with rule constraints |
| `GET` | `/api/v1/admin/coupons` | Admin / SuperAdmin | Paginated list of coupons with total redemption metrics |
| `GET` | `/api/v1/admin/coupons/:id` | Admin / SuperAdmin | Retrieve coupon details with redemption audit trail |
| `PUT` | `/api/v1/admin/coupons/:id` | Admin / SuperAdmin | Update coupon rules, limits, or dates |
| `DELETE` | `/api/v1/admin/coupons/:id` | Admin / SuperAdmin | Delete or deactivate coupon |
