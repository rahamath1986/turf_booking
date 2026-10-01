-- New turf owner profiles default to inactive (unapproved) until an admin approves them.
ALTER TABLE "turf_owners" ALTER COLUMN "is_active" SET DEFAULT false;
