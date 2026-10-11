-- Features: optional course landing page, prelaunch offer, video release schedule.

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('NONE', 'DISCOUNT', 'PRELAUNCH');

-- AlterTable: slug is added as nullable first, filled for existing courses, then made required.
ALTER TABLE "yoga_courses" ADD COLUMN     "landingPageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prelaunchDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "prelaunchEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prelaunchEndAt" TIMESTAMP(3),
ADD COLUMN     "prelaunchPayableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "prelaunchStartAt" TIMESTAMP(3),
ADD COLUMN     "slug" TEXT;

-- Backfill slugs from titles. Duplicate titles get a short ID suffix so every slug is unique.
WITH base AS (
  SELECT
    "id",
    COALESCE(NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(TRIM("title"), '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'course') AS "baseSlug",
    "createdAt"
  FROM "yoga_courses"
),
ranked AS (
  SELECT
    "id",
    "baseSlug",
    ROW_NUMBER() OVER (PARTITION BY "baseSlug" ORDER BY "createdAt", "id") AS "position"
  FROM base
)
UPDATE "yoga_courses" AS course
SET "slug" = CASE
  WHEN ranked."position" = 1 THEN LEFT(ranked."baseSlug", 80)
  ELSE LEFT(ranked."baseSlug", 80) || '-' || SUBSTRING(course."id", 1, 8)
END
FROM ranked
WHERE ranked."id" = course."id";

ALTER TABLE "yoga_courses" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "offerType" "OfferType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "isPrelaunchPurchase" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "course_videos" ADD COLUMN     "releaseAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "course_landing_contents" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "tagline" TEXT,
    "heroImageUrl" TEXT,
    "heroImageId" TEXT,
    "learningOutcomes" JSONB NOT NULL DEFAULT '[]',
    "targetAudience" JSONB NOT NULL DEFAULT '[]',
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "bannerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_landing_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_landing_contents_courseId_key" ON "course_landing_contents"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "yoga_courses_slug_key" ON "yoga_courses"("slug");

-- CreateIndex
CREATE INDEX "yoga_courses_prelaunchStartAt_idx" ON "yoga_courses"("prelaunchStartAt");

-- CreateIndex
CREATE INDEX "yoga_courses_prelaunchEndAt_idx" ON "yoga_courses"("prelaunchEndAt");

-- CreateIndex
CREATE INDEX "course_videos_yogaCourseId_releaseAt_idx" ON "course_videos"("yogaCourseId", "releaseAt");

-- CreateIndex
CREATE INDEX "course_videos_releaseAt_idx" ON "course_videos"("releaseAt");

-- AddForeignKey
ALTER TABLE "course_landing_contents" ADD CONSTRAINT "course_landing_contents_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "yoga_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
