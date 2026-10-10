import { EnvConfig } from "#src/config/env.config.js";
import { SendEmailNotificationService } from "#src/email/email.service.js";
import { prisma } from "#src/lib/prisma.js";
import { OfferType } from "#src/utils/course-pricing.util.js";
import { formatIstDisplayDate } from "#src/utils/ist-date.util.js";
import { releasedVideoWhere } from "#src/utils/video-visibility.util.js";

// A purchase email that failed is retried by the daily job for this long after the purchase.
const PURCHASE_EMAIL_RETRY_DAYS = 7;

const formatRupees = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
    .format(Number(amount) || 0)
    .replace(/\.00$/, "");

const getCourseUrl = (courseId) => `${EnvConfig.LANDING_SITE_URL}/my-courses/${courseId}`;

const readyVideoWhere = { status: "READY", readyToStream: true };

// SendEmailNotificationService logs and returns the error instead of throwing it.
const sendEmail = async (email, templateName, data) => {
  const result = await SendEmailNotificationService(email, templateName, data);
  if (!result || result instanceof Error) throw result instanceof Error ? result : new Error("Email was not sent");
};

/**
 * When a course goes live: the earliest release date of its READY videos. A READY video without a
 * release date means the course is already live.
 */
const getCourseLiveState = async (courseId, now = new Date()) => {
  const videos = await prisma.courseVideo.findMany({
    where: { yogaCourseId: courseId, ...readyVideoWhere },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { title: true, releaseAt: true },
  });
  const firstReleased = videos.find((video) => !video.releaseAt || new Date(video.releaseAt) <= now);
  const firstReleaseAt = videos
    .map((video) => video.releaseAt)
    .filter(Boolean)
    .sort((first, second) => new Date(first) - new Date(second))[0];

  return {
    isLive: Boolean(firstReleased),
    liveAt: firstReleased ? null : (firstReleaseAt ?? null),
    firstVideoTitle: firstReleased?.title ?? videos[0]?.title ?? "",
  };
};

/**
 * Purchase confirmation for one course enrollment, right after payment: the prelaunch email for a
 * prelaunch purchase, the normal one otherwise. The enrollment is claimed first, so a repeated
 * webhook can't send it twice; a failed send is released again for the daily job to retry.
 */
export const sendCoursePurchaseEmailService = async (enrollmentId) => {
  const claimed = await prisma.enrollment.updateMany({
    where: { id: enrollmentId, courseId: { not: null }, status: "ACTIVE", purchaseEmailSentAt: null },
    data: { purchaseEmailSentAt: new Date() },
  });
  if (claimed.count === 0) return { sent: false };

  try {
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      select: {
        isPrelaunchPurchase: true,
        user: { select: { name: true, email: true } },
        course: { select: { id: true, title: true, sequentialUnlock: true } },
        order: {
          select: { amount: true, offerType: true, discountPercent: true, razorpayOrderId: true, updatedAt: true },
        },
      },
    });
    const { user, course, order } = enrollment;
    const amountPaid = Number(order?.amount ?? 0);
    const discountPercent = Number(order?.discountPercent ?? 0);
    // The full price is worked out from the order, so it matches what was paid even if the price changes later.
    const originalPrice = discountPercent > 0 && discountPercent < 100 ? amountPaid / (1 - discountPercent / 100) : amountPaid;
    const isPrelaunch = enrollment.isPrelaunchPurchase || order?.offerType === OfferType.PRELAUNCH;

    const data = {
      name: user.name,
      courseTitle: course.title,
      amountPaid: formatRupees(amountPaid),
      originalPrice: formatRupees(Math.round(originalPrice)),
      discountPercent: Math.round(discountPercent),
      orderId: order?.razorpayOrderId ?? "",
      purchaseDate: formatIstDisplayDate(order?.updatedAt ?? new Date()),
      courseUrl: getCourseUrl(course.id),
      sequentialUnlock: course.sequentialUnlock,
    };

    if (!isPrelaunch) {
      await sendEmail(user.email, "EMAIL_COURSE_PURCHASED", data);
      return { sent: true, template: "EMAIL_COURSE_PURCHASED" };
    }

    const liveState = await getCourseLiveState(course.id);
    await sendEmail(user.email, "EMAIL_COURSE_PURCHASED_PRELAUNCH", {
      ...data,
      isLive: liveState.isLive,
      courseLiveDate: liveState.liveAt ? formatIstDisplayDate(liveState.liveAt) : null,
    });
    // Bought after the course went live: this email already says so, so no "course is live" email follows.
    if (liveState.isLive) {
      await prisma.enrollment.update({ where: { id: enrollmentId }, data: { liveEmailSentAt: new Date() } });
    }
    return { sent: true, template: "EMAIL_COURSE_PURCHASED_PRELAUNCH" };
  } catch (error) {
    console.error(`Purchase email for enrollment ${enrollmentId} failed:`, error);
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { purchaseEmailSentAt: null } });
    return { sent: false, error };
  }
};

/** Daily job: purchase emails that failed recently are tried again. */
export const retryPendingPurchaseEmailsService = async (now = new Date()) => {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId: { not: null },
      orderId: { not: null },
      status: "ACTIVE",
      purchaseEmailSentAt: null,
      enrolledAt: { gte: new Date(now.getTime() - PURCHASE_EMAIL_RETRY_DAYS * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });

  let sent = 0;
  for (const { id } of enrollments) {
    if ((await sendCoursePurchaseEmailService(id)).sent) sent += 1;
  }
  return { pending: enrollments.length, sent };
};

/**
 * Daily job: "your course is live" for prelaunch buyers whose course now has a released video.
 * Normal buyers never get this email.
 */
export const sendCourseLiveEmailsService = async (now = new Date(), courseId = undefined) => {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      ...(courseId && { courseId }),
      status: "ACTIVE",
      isPrelaunchPurchase: true,
      liveEmailSentAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      course: { courseVideos: { some: { ...readyVideoWhere, ...releasedVideoWhere(now) } } },
    },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  const liveStates = new Map();
  let sent = 0;
  for (const enrollment of enrollments) {
    const claimed = await prisma.enrollment.updateMany({
      where: { id: enrollment.id, liveEmailSentAt: null },
      data: { liveEmailSentAt: new Date() },
    });
    if (claimed.count === 0) continue;

    try {
      const { course, user } = enrollment;
      if (!liveStates.has(course.id)) liveStates.set(course.id, await getCourseLiveState(course.id, now));
      await sendEmail(user.email, "EMAIL_COURSE_LIVE", {
        name: user.name,
        courseTitle: course.title,
        firstVideoTitle: liveStates.get(course.id).firstVideoTitle,
        courseUrl: getCourseUrl(course.id),
      });
      sent += 1;
    } catch (error) {
      console.error(`"Course is live" email for enrollment ${enrollment.id} failed:`, error);
      await prisma.enrollment.update({ where: { id: enrollment.id }, data: { liveEmailSentAt: null } });
    }
  }
  return { pending: enrollments.length, sent };
};
