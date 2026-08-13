/*
  Warnings:

  - You are about to drop the column `dashUrl` on the `course_videos` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `course_videos` table. All the data in the column will be lost.
  - You are about to drop the column `hlsUrl` on the `course_videos` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `course_videos` table. All the data in the column will be lost.
  - Added the required column `thumbnailId` to the `course_videos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yogaCourseId` to the `course_videos` table without a default value. This is not possible if the table is not empty.
  - Made the column `thumbnailUrl` on table `course_videos` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "course_videos" DROP COLUMN "dashUrl",
DROP COLUMN "height",
DROP COLUMN "hlsUrl",
DROP COLUMN "width",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isCustomThumbnail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thumbnailId" TEXT NOT NULL,
ADD COLUMN     "yogaCourseId" TEXT NOT NULL,
ALTER COLUMN "thumbnailUrl" SET NOT NULL;

-- CreateTable
CREATE TABLE "yoga_courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "totalPayableAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "thumbnailUrl" TEXT NOT NULL,
    "thumbnailId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yoga_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_videos_yogaCourseId_idx" ON "course_videos"("yogaCourseId");

-- CreateIndex
CREATE INDEX "course_videos_yogaCourseId_sortOrder_idx" ON "course_videos"("yogaCourseId", "sortOrder");

-- AddForeignKey
ALTER TABLE "course_videos" ADD CONSTRAINT "course_videos_yogaCourseId_fkey" FOREIGN KEY ("yogaCourseId") REFERENCES "yoga_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
