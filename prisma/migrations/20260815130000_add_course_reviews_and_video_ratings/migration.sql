CREATE TABLE "course_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_video_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_video_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_reviews_userId_courseId_key" ON "course_reviews"("userId", "courseId");
CREATE INDEX "course_reviews_courseId_idx" ON "course_reviews"("courseId");
CREATE UNIQUE INDEX "course_video_ratings_userId_videoId_key" ON "course_video_ratings"("userId", "videoId");
CREATE INDEX "course_video_ratings_videoId_idx" ON "course_video_ratings"("videoId");

ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "yoga_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_video_ratings" ADD CONSTRAINT "course_video_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_video_ratings" ADD CONSTRAINT "course_video_ratings_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "course_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
