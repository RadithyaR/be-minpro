-- CreateEnum
CREATE TYPE "public"."StatusEvent" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "public"."events" ADD COLUMN     "statusEvent" "public"."StatusEvent" NOT NULL DEFAULT 'ACTIVE';
