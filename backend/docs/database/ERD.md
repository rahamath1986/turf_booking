# 📊 Entity Relationship Diagram (ERD) - Core Database Schema

## Logical Database: `turf_booking_db`
**Platform**: Azure Database for PostgreSQL Flexible Server  
**ORM**: Prisma v6.19.3  
**Phase**: Phase 2 - Core Schema  

---

## 1. Visual Entity Relationship Diagram

```mermaid
erDiagram
    %% Users Subsystem
    User ||--o{ UserRole : has
    Role ||--o{ UserRole : assigned_to
    User ||--o{ UserAddress : has
    User ||--o{ UserDevice : registers
    User ||--o| TurfOwner : owns_profile
    User ||--o{ BlockedSlot : blocks
    User ||--o{ AuditLog : performs

    %% Locations Subsystem
    Country ||--o{ State : contains
    State ||--o{ City : contains
    City ||--o{ Area : contains
    City ||--o{ Turf : locates
    Area ||--o{ Turf : locates_area
    City ||--o{ UserAddress : city_ref
    State ||--o{ UserAddress : state_ref
    Area ||--o{ UserAddress : area_ref

    %% Turf & Facilities Subsystem
    TurfOwner ||--o{ Turf : owns
    Turf ||--o{ TurfImage : displays
    Turf ||--o{ TurfVideo : displays
    Turf ||--o{ TurfSport : supports
    Sport ||--o{ TurfSport : featured_in
    Turf ||--o{ TurfFacility : offers
    Facility ||--o{ TurfFacility : provided_at

    %% Turf Configuration
    Turf ||--o{ OperatingHour : operates
    Turf ||--o{ PricingRule : applies
    Sport ||--o{ PricingRule : customizes
    Turf ||--o{ BlockedSlot : schedules

    User {
        uuid id PK
        string email UK
        string phone UK
        string password_hash
        string full_name
        string avatar_url
        boolean is_active
        boolean is_email_verified
        boolean is_phone_verified
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    Role {
        uuid id PK
        string name UK
        string description
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    UserRole {
        uuid id PK
        uuid user_id FK
        uuid role_id FK
        timestamptz created_at
    }

    UserAddress {
        uuid id PK
        uuid user_id FK
        string address_line_1
        string address_line_2
        uuid area_id FK
        uuid city_id FK
        uuid state_id FK
        string postal_code
        string landmark
        string address_type
        boolean is_default
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    UserDevice {
        uuid id PK
        uuid user_id FK
        string device_token UK
        string device_type
        string device_name
        string os_version
        string app_version
        boolean is_active
        timestamptz last_active_at
        timestamptz created_at
        timestamptz updated_at
    }

    Country {
        uuid id PK
        string name UK
        string code UK
        string phone_code
        string currency
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    State {
        uuid id PK
        uuid country_id FK
        string name
        string code
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    City {
        uuid id PK
        uuid state_id FK
        string name
        string slug UK
        decimal latitude
        decimal longitude
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    Area {
        uuid id PK
        uuid city_id FK
        string name
        string slug
        string postal_code
        decimal latitude
        decimal longitude
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    Sport {
        uuid id PK
        string name UK
        string slug UK
        string description
        string icon_url
        int min_players
        int max_players
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    Facility {
        uuid id PK
        string name UK
        string slug UK
        string icon_url
        string description
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    TurfOwner {
        uuid id PK
        uuid user_id FK,UK
        string business_name
        string legal_name
        string pan_number
        string gst_number
        string bank_account_number
        string bank_ifsc
        string bank_name
        boolean is_verified
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    Turf {
        uuid id PK
        uuid owner_id FK
        uuid city_id FK
        uuid area_id FK
        string name
        string slug UK
        string description
        string address_line
        string postal_code
        decimal latitude
        decimal longitude
        string contact_phone
        string contact_email
        string cover_image_url
        string rules
        decimal rating_average
        int total_reviews
        boolean is_active
        boolean is_approved
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    TurfImage {
        uuid id PK
        uuid turf_id FK
        string image_url
        string caption
        int display_order
        boolean is_cover
        timestamptz created_at
    }

    TurfVideo {
        uuid id PK
        uuid turf_id FK
        string video_url
        string thumbnail_url
        string title
        int display_order
        timestamptz created_at
    }

    TurfSport {
        uuid id PK
        uuid turf_id FK
        uuid sport_id FK
        boolean is_active
        timestamptz created_at
    }

    TurfFacility {
        uuid id PK
        uuid turf_id FK
        uuid facility_id FK
        boolean is_active
        timestamptz created_at
    }

    OperatingHour {
        uuid id PK
        uuid turf_id FK
        int day_of_week
        string open_time
        string close_time
        boolean is_closed
        timestamptz created_at
        timestamptz updated_at
    }

    PricingRule {
        uuid id PK
        uuid turf_id FK
        uuid sport_id FK
        string rule_name
        string day_type
        int day_of_week
        string start_time
        string end_time
        decimal hourly_price
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    BlockedSlot {
        uuid id PK
        uuid turf_id FK
        date block_date
        string start_time
        string end_time
        string reason
        uuid blocked_by_user_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    AuditLog {
        uuid id PK
        uuid user_id FK
        string action
        string entity_type
        string entity_id
        json old_values
        json new_values
        string ip_address
        string user_agent
        timestamptz created_at
    }
```

---

## 2. Table Specifications & Referential Integrity

| Table Name | Primary Key | Foreign Keys | Cascade / Restrict Behavior | Unique Constraints | Primary Purpose |
|---|---|---|---|---|---|
| `users` | UUID | None | N/A | `email`, `phone` | Master account registry |
| `roles` | UUID | None | N/A | `name` | RBAC role definitions |
| `user_roles` | UUID | `user_id`, `role_id` | User: Cascade, Role: Restrict | `[user_id, role_id]` | Many-to-many user role mapping |
| `user_addresses` | UUID | `user_id`, `city_id`, `state_id`, `area_id` | User: Cascade, Locations: SetNull | None | Multi-address support for users |
| `user_devices` | UUID | `user_id` | User: Cascade | `device_token` | FCM push notification target tokens |
| `countries` | UUID | None | N/A | `name`, `code` | Top-level geographic entity |
| `states` | UUID | `country_id` | Country: Restrict | `[country_id, code]` | Regional states/provinces |
| `cities` | UUID | `state_id` | State: Restrict | `slug` | Operational cities |
| `areas` | UUID | `city_id` | City: Restrict | `[city_id, slug]` | Local neighborhoods/postal areas |
| `sports` | UUID | None | N/A | `name`, `slug` | Platform sports catalog |
| `facilities` | UUID | None | N/A | `name`, `slug` | Amenity and facility registry |
| `turf_owners` | UUID | `user_id` | User: Restrict | `user_id` | Business profile & KYC details |
| `turfs` | UUID | `owner_id`, `city_id`, `area_id` | Owner: Restrict, City: Restrict, Area: SetNull | `slug` | Multi-sport venue entities |
| `turf_images` | UUID | `turf_id` | Turf: Cascade | None | Image gallery metadata |
| `turf_videos` | UUID | `turf_id` | Turf: Cascade | None | Video tour metadata |
| `turf_sports` | UUID | `turf_id`, `sport_id` | Turf: Cascade, Sport: Restrict | `[turf_id, sport_id]` | Turf to sport mapping |
| `turf_facilities`| UUID | `turf_id`, `facility_id` | Turf: Cascade, Facility: Restrict | `[turf_id, facility_id]` | Turf amenity mapping |
| `operating_hours`| UUID | `turf_id` | Turf: Cascade | `[turf_id, day_of_week]` | 7-day schedule definition |
| `pricing_rules` | UUID | `turf_id`, `sport_id` | Turf: Cascade, Sport: SetNull | None | Day/time specific hourly rates |
| `blocked_slots` | UUID | `turf_id`, `blocked_by_user_id` | Turf: Cascade, User: SetNull | None | Maintenance/event blackout windows |
| `audit_logs` | UUID | `user_id` | User: SetNull | None | Immutable compliance audit trail |
