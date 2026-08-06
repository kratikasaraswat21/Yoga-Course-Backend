-- CreateTable
CREATE TABLE "affiliate_products" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "productsLink" TEXT NOT NULL,
    "buttonTitle" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_products_sortOrder_idx" ON "affiliate_products"("sortOrder");
