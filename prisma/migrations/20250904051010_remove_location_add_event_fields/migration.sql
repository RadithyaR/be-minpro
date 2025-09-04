/*
  Warnings:

  - You are about to drop the column `locationId` on the `events` table. All the data in the column will be lost.
  - You are about to drop the `locations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `locationType` to the `events` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('online', 'offline');

-- DropForeignKey
ALTER TABLE "public"."events" DROP CONSTRAINT "events_locationId_fkey";

-- AlterTable
ALTER TABLE "public"."events" DROP COLUMN "locationId",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "locationType" "public"."LocationType" NOT NULL;

-- DropTable
DROP TABLE "public"."locations";
