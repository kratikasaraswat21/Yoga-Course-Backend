/*
  Warnings:

  - You are about to alter the column `price` on the `yoga_courses` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `totalPayableAmount` on the `yoga_courses` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "pdf_course_resource" ALTER COLUMN "discount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "yoga_courses" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "discount" SET DEFAULT 0,
ALTER COLUMN "discount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalPayableAmount" SET DATA TYPE DOUBLE PRECISION;
