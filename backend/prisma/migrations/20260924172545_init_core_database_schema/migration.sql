-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "avatar_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "address_line_1" VARCHAR(255) NOT NULL,
    "address_line_2" VARCHAR(255),
    "area_id" UUID,
    "city_id" UUID,
    "state_id" UUID,
    "postal_code" VARCHAR(20) NOT NULL,
    "landmark" VARCHAR(150),
    "address_type" VARCHAR(30) NOT NULL DEFAULT 'HOME',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_token" VARCHAR(500) NOT NULL,
    "device_type" VARCHAR(30) NOT NULL,
    "device_name" VARCHAR(100),
    "os_version" VARCHAR(50),
    "app_version" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_active_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "phone_code" VARCHAR(10) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(170) NOT NULL,
    "postal_code" VARCHAR(20),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "icon_url" VARCHAR(500),
    "min_players" INTEGER NOT NULL DEFAULT 2,
    "max_players" INTEGER NOT NULL DEFAULT 22,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "icon_url" VARCHAR(500),
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turf_owners" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "pan_number" VARCHAR(20),
    "gst_number" VARCHAR(30),
    "bank_account_number" VARCHAR(50),
    "bank_ifsc" VARCHAR(30),
    "bank_name" VARCHAR(100),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "turf_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turfs" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "area_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "address_line" TEXT NOT NULL,
    "postal_code" VARCHAR(20),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "contact_phone" VARCHAR(30),
    "contact_email" VARCHAR(255),
    "cover_image_url" VARCHAR(500),
    "rules" TEXT,
    "rating_average" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "turfs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turf_images" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(255),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turf_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turf_videos" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "video_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "title" VARCHAR(150),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turf_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turf_sports" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turf_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turf_facilities" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turf_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_hours" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" VARCHAR(5) NOT NULL,
    "close_time" VARCHAR(5) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "sport_id" UUID,
    "rule_name" VARCHAR(100) NOT NULL,
    "day_type" VARCHAR(30) NOT NULL DEFAULT 'ALL',
    "day_of_week" INTEGER,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "hourly_price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_slots" (
    "id" UUID NOT NULL,
    "turf_id" UUID NOT NULL,
    "block_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "reason" VARCHAR(255),
    "blocked_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blocked_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(50),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_is_active_idx" ON "users"("email", "is_active");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_is_default_idx" ON "user_addresses"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "user_addresses_postal_code_idx" ON "user_addresses"("postal_code");

-- CreateIndex
CREATE INDEX "user_addresses_deleted_at_idx" ON "user_addresses"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_device_token_key" ON "user_devices"("device_token");

-- CreateIndex
CREATE INDEX "user_devices_user_id_is_active_idx" ON "user_devices"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "user_devices_device_type_idx" ON "user_devices"("device_type");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE INDEX "states_country_id_is_active_idx" ON "states"("country_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "states_country_id_code_key" ON "states"("country_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_state_id_is_active_idx" ON "cities"("state_id", "is_active");

-- CreateIndex
CREATE INDEX "cities_name_idx" ON "cities"("name");

-- CreateIndex
CREATE INDEX "areas_city_id_is_active_idx" ON "areas"("city_id", "is_active");

-- CreateIndex
CREATE INDEX "areas_postal_code_idx" ON "areas"("postal_code");

-- CreateIndex
CREATE UNIQUE INDEX "areas_city_id_slug_key" ON "areas"("city_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sports_slug_key" ON "sports"("slug");

-- CreateIndex
CREATE INDEX "sports_is_active_idx" ON "sports"("is_active");

-- CreateIndex
CREATE INDEX "sports_deleted_at_idx" ON "sports"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_name_key" ON "facilities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_slug_key" ON "facilities"("slug");

-- CreateIndex
CREATE INDEX "facilities_is_active_idx" ON "facilities"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "turf_owners_user_id_key" ON "turf_owners"("user_id");

-- CreateIndex
CREATE INDEX "turf_owners_business_name_idx" ON "turf_owners"("business_name");

-- CreateIndex
CREATE INDEX "turf_owners_is_verified_is_active_idx" ON "turf_owners"("is_verified", "is_active");

-- CreateIndex
CREATE INDEX "turf_owners_deleted_at_idx" ON "turf_owners"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "turfs_slug_key" ON "turfs"("slug");

-- CreateIndex
CREATE INDEX "turfs_owner_id_idx" ON "turfs"("owner_id");

-- CreateIndex
CREATE INDEX "turfs_city_id_is_active_is_approved_idx" ON "turfs"("city_id", "is_active", "is_approved");

-- CreateIndex
CREATE INDEX "turfs_area_id_idx" ON "turfs"("area_id");

-- CreateIndex
CREATE INDEX "turfs_deleted_at_idx" ON "turfs"("deleted_at");

-- CreateIndex
CREATE INDEX "turf_images_turf_id_display_order_idx" ON "turf_images"("turf_id", "display_order");

-- CreateIndex
CREATE INDEX "turf_videos_turf_id_display_order_idx" ON "turf_videos"("turf_id", "display_order");

-- CreateIndex
CREATE INDEX "turf_sports_sport_id_is_active_idx" ON "turf_sports"("sport_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "turf_sports_turf_id_sport_id_key" ON "turf_sports"("turf_id", "sport_id");

-- CreateIndex
CREATE INDEX "turf_facilities_facility_id_is_active_idx" ON "turf_facilities"("facility_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "turf_facilities_turf_id_facility_id_key" ON "turf_facilities"("turf_id", "facility_id");

-- CreateIndex
CREATE INDEX "operating_hours_turf_id_idx" ON "operating_hours"("turf_id");

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_turf_id_day_of_week_key" ON "operating_hours"("turf_id", "day_of_week");

-- CreateIndex
CREATE INDEX "pricing_rules_turf_id_is_active_idx" ON "pricing_rules"("turf_id", "is_active");

-- CreateIndex
CREATE INDEX "pricing_rules_sport_id_idx" ON "pricing_rules"("sport_id");

-- CreateIndex
CREATE INDEX "blocked_slots_turf_id_block_date_idx" ON "blocked_slots"("turf_id", "block_date");

-- CreateIndex
CREATE INDEX "blocked_slots_block_date_idx" ON "blocked_slots"("block_date");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_owners" ADD CONSTRAINT "turf_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "turf_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_images" ADD CONSTRAINT "turf_images_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_videos" ADD CONSTRAINT "turf_videos_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_sports" ADD CONSTRAINT "turf_sports_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_sports" ADD CONSTRAINT "turf_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_facilities" ADD CONSTRAINT "turf_facilities_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turf_facilities" ADD CONSTRAINT "turf_facilities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_turf_id_fkey" FOREIGN KEY ("turf_id") REFERENCES "turfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_blocked_by_user_id_fkey" FOREIGN KEY ("blocked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
