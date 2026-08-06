/*
  Warnings:

  - Added the required column `discount` to the `pdf_course_resource` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isAvailableForFree` to the `pdf_course_resource` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `pdf_course_resource` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPayableAmount` to the `pdf_course_resource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "pdf_course_resource" ADD COLUMN     "discount" INTEGER NOT NULL,
ADD COLUMN     "isAvailableForFree" BOOLEAN NOT NULL,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalPayableAmount" DOUBLE PRECISION NOT NULL;
