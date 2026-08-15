/*
  Warnings:

  - A unique constraint covering the columns `[userId,pdfCourseId]` on the table `enrollments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_courseId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_courseId_fkey";

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "pdfCourseId" TEXT,
ALTER COLUMN "courseId" DROP NOT NULL,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pdfCourseId" TEXT,
ALTER COLUMN "courseId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "enrollments_pdfCourseId_status_idx" ON "enrollments"("pdfCourseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_userId_pdfCourseId_key" ON "enrollments"("userId", "pdfCourseId");

-- CreateIndex
CREATE INDEX "orders_pdfCourseId_status_idx" ON "orders"("pdfCourseId", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "yoga_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pdfCourseId_fkey" FOREIGN KEY ("pdfCourseId") REFERENCES "pdf_course_resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "yoga_courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_pdfCourseId_fkey" FOREIGN KEY ("pdfCourseId") REFERENCES "pdf_course_resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
