-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "CourseVideos" (
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

    CONSTRAINT "CourseVideos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseVideos_cloudflareVideoUid_key" ON "CourseVideos"("cloudflareVideoUid");
