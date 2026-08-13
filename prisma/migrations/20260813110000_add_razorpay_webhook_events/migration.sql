CREATE TABLE "razorpay_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "razorpay_webhook_events_eventId_key" ON "razorpay_webhook_events"("eventId");
