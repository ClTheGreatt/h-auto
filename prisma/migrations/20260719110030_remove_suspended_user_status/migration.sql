-- Remove SUSPENDED from the UserStatus enum. Postgres does not support
-- dropping enum values directly, so this recreates the type with only the
-- remaining values and swaps the column over.
-- Safe: verified 0 rows currently have status = 'SUSPENDED' before this
-- migration was written.
BEGIN;

CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus_new" USING ("status"::text::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "UserStatus_old";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

COMMIT;
