import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";

const activeEnrollmentWhere = (userId, courseId) => ({
  userId,
  courseId,
  status: "ACTIVE",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

const validateRating = (rating) => {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 0 || numericRating > 5 || !Number.isInteger(numericRating * 2)) {
    const error = new Error("Rating must be between 0 and 5 in 0.5 increments");
    error.statusCode = 400;
    throw error;
  }
  return numericRating;
};

const ensureCoursePurchase = async (userId, courseId) => {
  const enrollment = await prisma.enrollment.findFirst({ where: activeEnrollmentWhere(userId, courseId) });
  if (!enrollment) {
    const error = new Error("You must purchase this course before reviewing it");
    error.statusCode = 403;
    throw error;
  }
};

export const createCourseReviewService = async ({ userId, courseId, rating, comment }) => {
  await ensureCoursePurchase(userId, courseId);

  const course = await prisma.yogaCourse.findFirst({ where: { id: courseId, status: CourseStatus.PUBLISHED }, select: { id: true } });
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }

  const existingReview = await prisma.courseReview.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existingReview) {
    const error = new Error("You have already reviewed this course");
    error.statusCode = 409;
    throw error;
  }

  return prisma.courseReview.create({
    data: { userId, courseId, rating: validateRating(rating), comment: comment?.trim() || null },
    select: { id: true, courseId: true, rating: true, comment: true, createdAt: true },
  });
};

export const createCourseVideoRatingService = async ({ userId, courseId, videoId, rating }) => {
  await ensureCoursePurchase(userId, courseId);

  const video = await prisma.courseVideo.findFirst({
    where: { id: videoId, yogaCourseId: courseId, yogaCourse: { status: CourseStatus.PUBLISHED } },
    select: { id: true },
  });
  if (!video) {
    const error = new Error("Video not found");
    error.statusCode = 404;
    throw error;
  }

  const existingRating = await prisma.courseVideoRating.findUnique({ where: { userId_videoId: { userId, videoId } } });
  if (existingRating) {
    const error = new Error("You have already rated this video");
    error.statusCode = 409;
    throw error;
  }

  return prisma.courseVideoRating.create({
    data: { userId, videoId, rating: validateRating(rating) },
    select: { id: true, videoId: true, rating: true, createdAt: true },
  });
};
