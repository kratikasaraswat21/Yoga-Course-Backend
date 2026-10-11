-- Purchase and "course is live" emails, the sequential video lock, and Instagram feedback images.

-- 1. Emails: when each one was sent. Existing buyers already have access, so they are marked as sent
--    and don't receive a purchase email when this ships.
ALTER TABLE "enrollments" ADD COLUMN "purchaseEmailSentAt" TIMESTAMP(3),
ADD COLUMN "liveEmailSentAt" TIMESTAMP(3);

UPDATE "enrollments" SET "purchaseEmailSentAt" = "enrolledAt" WHERE "courseId" IS NOT NULL;

-- Prelaunch buyers of a course that is already live don't need the "course is live" email.
UPDATE "enrollments" AS e
SET "liveEmailSentAt" = NOW()
WHERE e."isPrelaunchPurchase" = true
  AND e."courseId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "course_videos" AS v
    WHERE v."yogaCourseId" = e."courseId"
      AND v."status" = 'READY'
      AND (v."releaseAt" IS NULL OR v."releaseAt" <= NOW())
  );

-- 2. Sequential video lock (off by default).
ALTER TABLE "yoga_courses" ADD COLUMN "sequentialUnlock" BOOLEAN NOT NULL DEFAULT false;

-- 3. Instagram feedback images.
CREATE TABLE "instagram_feedback_images" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_feedback_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "instagram_feedback_images_sortOrder_idx" ON "instagram_feedback_images"("sortOrder");
