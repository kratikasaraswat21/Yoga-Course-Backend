/*
  Warnings:

  - Added the required column `pdfFileName` to the `PdfCourseResource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PdfCourseResource" ADD COLUMN     "pdfFileName" TEXT NOT NULL;
