import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";

const activePdfEnrollmentWhere = (userId, pdfCourseId) => ({
  userId,
  ...(pdfCourseId ? { pdfCourseId } : {}),
  status: "ACTIVE",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

const publicPdfSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  price: true,
  discount: true,
  totalPayableAmount: true,
  isAvailableForFree: true,
  pdfFileName: true,
  fileUrl: true,
  thumbnailUrl: true,
  sortOrder: true,
  createdAt: true,
};

const toPublicPdf = ({ price, totalPayableAmount, ...course }) => ({
  ...course,
  price: Number(price),
  totalPayableAmount: Number(totalPayableAmount),
});

export const getPublishedPdfCoursesService = async (userId) => {
  const courses = await prisma.pdfCourseResource.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
      ...(userId
        ? {
            enrollments: {
              none: activePdfEnrollmentWhere(userId),
            },
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: publicPdfSelect,
  });

  return courses.map((course) => {
    const { fileUrl, ...courseData } = toPublicPdf(course);
    // Never expose a paid PDF's storage URL in the public catalogue.
    return { ...courseData, ...(course.isAvailableForFree ? { fileUrl } : {}) };
  });
};

export const getPublishedPdfCourseDetailsService = async (pdfCourseId, userId) => {
  const course = await prisma.pdfCourseResource.findFirst({
    where: { id: pdfCourseId, status: CourseStatus.PUBLISHED },
    select: publicPdfSelect,
  });

  if (!course) {
    const error = new Error("PDF course not found");
    error.statusCode = 404;
    throw error;
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: activePdfEnrollmentWhere(userId, pdfCourseId),
    select: { id: true },
  });

  const { fileUrl, ...courseData } = toPublicPdf(course);
  return {
    ...courseData,
    isPurchased: Boolean(enrollment),
    ...(course.isAvailableForFree ? { fileUrl } : {}),
  };
};

export const getPurchasedPdfCoursesService = async (userId) => {
  const courses = await prisma.pdfCourseResource.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
      enrollments: { some: activePdfEnrollmentWhere(userId, undefined) },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      ...publicPdfSelect,
    },
  });

  return courses.map(toPublicPdf);
};

export const getPdfCourseAccessService = async ({ userId, pdfCourseId }) => {
  const course = await prisma.pdfCourseResource.findFirst({
    where: { id: pdfCourseId, status: CourseStatus.PUBLISHED },
    select: { id: true, fileUrl: true, isAvailableForFree: true },
  });

  if (!course) {
    const error = new Error("PDF course not found");
    error.statusCode = 404;
    throw error;
  }

  if (!course.isAvailableForFree) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        pdfCourseId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });

    if (!enrollment) {
      const error = new Error("You must purchase this PDF course first");
      error.statusCode = 403;
      throw error;
    }
  }

  return { fileUrl: course.fileUrl };
};
