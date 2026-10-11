-- Instagram feedback screenshots can belong to one course (NULL = global).
ALTER TABLE "instagram_feedback_images" ADD COLUMN "courseId" TEXT;

CREATE INDEX "instagram_feedback_images_courseId_sortOrder_idx" ON "instagram_feedback_images"("courseId", "sortOrder");

ALTER TABLE "instagram_feedback_images" ADD CONSTRAINT "instagram_feedback_images_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "yoga_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
