/*
  Warnings:

  - You are about to drop the `PdfCourseResource` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "PdfCourseResource";

-- CreateTable
CREATE TABLE "pdf_course_resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfFileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_course_resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_course_resource_sortOrder_idx" ON "pdf_course_resource"("sortOrder");
