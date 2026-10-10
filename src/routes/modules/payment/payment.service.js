import { EnvConfig } from "#src/config/env.config.js";
import { prisma } from "#src/lib/prisma.js";
import { CourseStatus } from "#src/lib/enum.js";
import { createHmac } from "node:crypto";
import { coursePricingSelect, getCoursePricing, OfferType } from "#src/utils/course-pricing.util.js";
import { sendCoursePurchaseEmailService } from "#src/routes/modules/course/course-notification.service.js";

const razorpayRequest = async (path, options = {}) => {
  if (!EnvConfig.RAZORPAY_KEY_ID || !EnvConfig.RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay configuration is missing");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${EnvConfig.RAZORPAY_KEY_ID}:${EnvConfig.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.description ?? "Razorpay request failed");
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }
  return data;
};

const ensurePurchasingUser = async (userId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "USER" },
    select: { id: true },
  });

  if (!user) {
    const error = new Error("Only users can make purchases");
    error.statusCode = 403;
    throw error;
  }
};

export const createCourseOrderService = async ({ userId, courseId }) => {
  await ensurePurchasingUser(userId);

  const course = await prisma.yogaCourse.findFirst({
    where: { id: courseId, status: CourseStatus.PUBLISHED },
    select: { id: true, title: true, ...coursePricingSelect },
  });
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }

  const alreadyEnrolled = await prisma.enrollment.findFirst({
    where: { userId, courseId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  if (alreadyEnrolled) {
    const error = new Error("You already own this course");
    error.statusCode = 409;
    throw error;
  }

  // The price is fixed when the order is created, so a prelaunch checkout opened before midnight
  // still gets the prelaunch price if it is paid a few minutes later.
  const pricing = getCoursePricing(course);
  const amount = Math.round(Number(pricing.payableAmount) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    const error = new Error("Course price must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  const razorpayOrder = await razorpayRequest("/orders", {
    method: "POST",
    // Razorpay receipts must be 56 characters or fewer. Keep the full IDs in notes/database.
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: `course_${course.id.slice(0, 8)}_${Date.now()}`,
      notes: { userId, courseId, offerType: pricing.offerType },
    }),
  });

  const order = await prisma.order.create({
    data: {
      userId, courseId, amount: Number(pricing.payableAmount), currency: "INR",
      offerType: pricing.offerType, discountPercent: pricing.discountPercent,
      status: "PAYMENT_PENDING", razorpayOrderId: razorpayOrder.id,
      payment: { create: { gateway: "RAZORPAY", status: "CREATED" } },
    },
  });

  return {
    orderId: order.id,
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency: "INR",
    keyId: EnvConfig.RAZORPAY_KEY_ID,
    offerType: pricing.offerType,
    course: { id: course.id, title: course.title },
  };
};

export const createPdfCourseOrderService = async ({ userId, pdfCourseId }) => {
  await ensurePurchasingUser(userId);

  const course = await prisma.pdfCourseResource.findFirst({
    where: { id: pdfCourseId, status: CourseStatus.PUBLISHED },
    select: { id: true, title: true, totalPayableAmount: true, isAvailableForFree: true },
  });
  if (!course) {
    const error = new Error("PDF course not found");
    error.statusCode = 404;
    throw error;
  }
  if (course.isAvailableForFree) {
    const error = new Error("This PDF course is available for free");
    error.statusCode = 400;
    throw error;
  }

  const alreadyEnrolled = await prisma.enrollment.findFirst({
    where: { userId, pdfCourseId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  if (alreadyEnrolled) {
    const error = new Error("You already own this PDF course");
    error.statusCode = 409;
    throw error;
  }

  const amount = Math.round(Number(course.totalPayableAmount) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    const error = new Error("PDF course price must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  const razorpayOrder = await razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: `pdf_${course.id.slice(0, 8)}_${Date.now()}`,
      notes: { userId, pdfCourseId },
    }),
  });

  const order = await prisma.order.create({
    data: {
      userId, pdfCourseId, amount: Number(course.totalPayableAmount), currency: "INR",
      status: "PAYMENT_PENDING", razorpayOrderId: razorpayOrder.id,
      payment: { create: { gateway: "RAZORPAY", status: "CREATED" } },
    },
  });

  return {
    orderId: order.id,
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency: "INR",
    keyId: EnvConfig.RAZORPAY_KEY_ID,
    course: { id: course.id, title: course.title },
  };
};

export const verifyCoursePaymentService = async ({ userId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  await ensurePurchasingUser(userId);

  if (!EnvConfig.RAZORPAY_KEY_SECRET) {
    const error = new Error("Razorpay configuration is missing");
    error.statusCode = 500;
    throw error;
  }
  const expectedSignature = createHmac("sha256", EnvConfig.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  if (expectedSignature !== razorpaySignature) {
    const error = new Error("Invalid Razorpay payment signature");
    error.statusCode = 400;
    throw error;
  }

  const order = await prisma.order.findFirst({ where: { userId, razorpayOrderId } });
  if (!order) {
    const error = new Error("Payment order not found");
    error.statusCode = 404;
    throw error;
  }
  if (order.status === "PAID") return { orderId: order.id, courseId: order.courseId, status: "PAID", enrollmentPending: false };

  await prisma.payment.update({
    where: { orderId: order.id },
    data: { status: "AUTHORIZED", razorpayPaymentId, razorpaySignature },
  });

  return { orderId: order.id, courseId: order.courseId, status: "PAYMENT_PENDING", enrollmentPending: true };
};

export const processRazorpayWebhookService = async (event) => {
  const result = await recordRazorpayPayment(event);

  // Emails are sent only after the payment is committed, and never hold up the webhook response.
  if (result.courseEnrollmentId) {
    sendCoursePurchaseEmailService(result.courseEnrollmentId).catch((error) =>
      console.error("Purchase email failed:", error),
    );
  }
  return result;
};

const recordRazorpayPayment = async ({ eventId, eventType, orderId, paymentId, amount }) => {
  if (!eventId) return { duplicate: false, processed: false };

  return prisma.$transaction(async (transaction) => {
    const existingEvent = await transaction.razorpayWebhookEvent.findUnique({ where: { eventId } });
    if (existingEvent) return { duplicate: true, processed: true };

    const order = await transaction.order.findUnique({
      where: { razorpayOrderId: orderId },
      include: { user: { select: { role: true } } },
    });
    if (!order) {
      await transaction.razorpayWebhookEvent.create({ data: { eventId, eventType } });
      return { duplicate: false, processed: false, reason: "order_not_found" };
    }

    if (order.user.role !== "USER") {
      throw new Error("Only users can make purchases");
    }

    if (amount !== undefined && Number(amount) !== Math.round(Number(order.amount) * 100)) {
      throw new Error("Razorpay webhook amount does not match the order");
    }

    // Razorpay sends both payment.captured and order.paid for one payment, with different event ids.
    // Only the first one marks the order PAID and grants access; the conditional update also makes a
    // concurrent second event wait for the first and then match nothing, so no second email is sent.
    const markedPaid = await transaction.order.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
    if (markedPaid.count === 0) {
      await transaction.razorpayWebhookEvent.create({ data: { eventId, eventType } });
      return { duplicate: true, processed: true };
    }

    await transaction.payment.update({
      where: { orderId: order.id },
      data: { status: "CAPTURED", razorpayPaymentId: paymentId ?? undefined },
    });
    if (order.pdfCourseId) {
      await transaction.enrollment.upsert({
        where: { userId_pdfCourseId: { userId: order.userId, pdfCourseId: order.pdfCourseId } },
        update: { status: "ACTIVE", revokedAt: null, revokeReason: null, orderId: order.id },
        create: { userId: order.userId, pdfCourseId: order.pdfCourseId, orderId: order.id, status: "ACTIVE" },
      });
    } else {
      // Bought at the prelaunch price: this buyer sees scheduled videos as locked with their dates.
      const isPrelaunchPurchase = order.offerType === OfferType.PRELAUNCH;
      // A new purchase (e.g. after access ended) gets its own confirmation and "course is live" emails.
      const enrollment = await transaction.enrollment.upsert({
        where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
        update: {
          status: "ACTIVE",
          revokedAt: null,
          revokeReason: null,
          orderId: order.id,
          isPrelaunchPurchase,
          purchaseEmailSentAt: null,
          liveEmailSentAt: null,
        },
        create: {
          userId: order.userId,
          courseId: order.courseId,
          orderId: order.id,
          status: "ACTIVE",
          isPrelaunchPurchase,
        },
        select: { id: true },
      });
      await transaction.razorpayWebhookEvent.create({ data: { eventId, eventType } });
      return { duplicate: false, processed: true, courseEnrollmentId: enrollment.id };
    }
    await transaction.razorpayWebhookEvent.create({ data: { eventId, eventType } });

    return { duplicate: false, processed: true };
  });
};
