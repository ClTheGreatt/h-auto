-- Add mustChangePassword, defaulting new rows to true (temp password must
-- be rotated before first dashboard access), then backfill existing rows
-- to false — they've already been using their current password, no need
-- to force a change.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

UPDATE "User" SET "mustChangePassword" = false;
