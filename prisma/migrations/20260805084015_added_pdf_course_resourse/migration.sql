-- CreateTable
CREATE TABLE "PdfCourseResource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfCourseResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdfCourseResource_sortOrder_idx" ON "PdfCourseResource"("sortOrder");
