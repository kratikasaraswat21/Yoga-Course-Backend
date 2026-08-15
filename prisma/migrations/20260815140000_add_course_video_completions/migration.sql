CREATE TABLE "course_video_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_video_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_video_completions_userId_videoId_key" ON "course_video_completions"("userId", "videoId");
CREATE INDEX "course_video_completions_videoId_idx" ON "course_video_completions"("videoId");

ALTER TABLE "course_video_completions" ADD CONSTRAINT "course_video_completions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_video_completions" ADD CONSTRAINT "course_video_completions_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "course_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
