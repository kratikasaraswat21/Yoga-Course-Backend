/*
  Warnings:

  - You are about to drop the `CourseVideos` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CourseVideos";

-- CreateTable
CREATE TABLE "course_videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "cloudflareVideoUid" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "readyToStream" BOOLEAN NOT NULL DEFAULT false,
    "processingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationSeconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnailUrl" TEXT,
    "hlsUrl" TEXT,
    "dashUrl" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_videos_cloudflareVideoUid_key" ON "course_videos"("cloudflareVideoUid");
