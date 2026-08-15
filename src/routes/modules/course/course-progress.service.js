import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";

const activeEnrollmentWhere = (userId, courseId) => ({
  userId,
  courseId,
  status: "ACTIVE",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

export const completeCourseVideoService = async ({ userId, courseId, videoId }) => {
  const enrollment = await prisma.enrollment.findFirst({ where: activeEnrollmentWhere(userId, courseId) });
  if (!enrollment) {
    const error = new Error("You must purchase this course first");
    error.statusCode = 403;
    throw error;
  }

  const video = await prisma.courseVideo.findFirst({
    where: {
      id: videoId,
      yogaCourseId: courseId,
      status: "READY",
      readyToStream: true,
      yogaCourse: { status: CourseStatus.PUBLISHED },
    },
    select: { id: true },
  });
  if (!video) {
    const error = new Error("Video not found or not ready");
    error.statusCode = 404;
    throw error;
  }

  const existingCompletion = await prisma.courseVideoCompletion.findUnique({
    where: { userId_videoId: { userId, videoId } },
    select: { id: true, videoId: true, completedAt: true },
  });
  if (existingCompletion) {
    return { ...existingCompletion, alreadyCompleted: true };
  }

  try {
    const completion = await prisma.courseVideoCompletion.create({
      data: { userId, videoId },
      select: { id: true, videoId: true, completedAt: true },
    });
    return { ...completion, alreadyCompleted: false };
  } catch (error) {
    // A second request arriving at the same time is also treated as idempotent.
    if (error.code === "P2002") {
      const completion = await prisma.courseVideoCompletion.findUniqueOrThrow({
        where: { userId_videoId: { userId, videoId } },
        select: { id: true, videoId: true, completedAt: true },
      });
      return { ...completion, alreadyCompleted: true };
    }
    throw error;
  }
};
