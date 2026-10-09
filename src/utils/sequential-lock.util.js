import { prisma } from "#src/lib/prisma.js";
import { releasedVideoWhere } from "#src/utils/video-visibility.util.js";

export const LockReason = Object.freeze({ SCHEDULED: "SCHEDULED", SEQUENTIAL: "SEQUENTIAL" });

/**
 * "Lock videos in order" for one buyer. `videos` are sorted by sortOrder and already went through
 * applyVideoVisibility (scheduled videos have isLocked: true) and carry isCompleted.
 *
 * Walking the released videos in order: every completed video stays open, the first video not yet
 * completed is open (the buyer's next video), and every later one is locked. Scheduled videos are
 * skipped, so they never block the videos around them. Without the lock, nothing changes; nextVideoId
 * is still the first released video not yet completed (for "Continue").
 */
export const applySequentialLock = (videos, { enabled }) => {
  let nextVideoId = null;

  const lockedVideos = videos.map((video) => {
    if (video.isLocked) return { ...video, lockReason: LockReason.SCHEDULED };
    if (video.isCompleted) return { ...video, lockReason: null };
    if (!nextVideoId) {
      nextVideoId = video.id;
      return { ...video, lockReason: null };
    }
    return enabled ? { ...video, isLocked: true, lockReason: LockReason.SEQUENTIAL } : { ...video, lockReason: null };
  });

  return { videos: lockedVideos, nextVideoId };
};

export const createSequentialLockError = (nextVideoId) => {
  const error = new Error("Complete the previous video to unlock this one");
  error.statusCode = 403;
  error.data = { code: "VIDEO_LOCKED_SEQUENTIAL", nextVideoId };
  return error;
};

/**
 * Throws 403 VIDEO_LOCKED_SEQUENTIAL when the course locks videos in order and this buyer hasn't
 * reached `videoId` yet. Used by playback, completion and rating, so the order can't be skipped by
 * calling the API directly.
 */
export const ensureVideoUnlockedInOrder = async ({ userId, courseId, videoId, now = new Date() }) => {
  const course = await prisma.yogaCourse.findUnique({
    where: { id: courseId },
    select: {
      sequentialUnlock: true,
      courseVideos: {
        where: { status: "READY", readyToStream: true, ...releasedVideoWhere(now) },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, completions: { where: { userId }, select: { id: true }, take: 1 } },
      },
    },
  });
  if (!course?.sequentialUnlock) return;

  const { videos, nextVideoId } = applySequentialLock(
    course.courseVideos.map(({ id, completions }) => ({ id, isLocked: false, isCompleted: completions.length > 0 })),
    { enabled: true },
  );
  if (videos.find((video) => video.id === videoId)?.lockReason === LockReason.SEQUENTIAL) {
    throw createSequentialLockError(nextVideoId);
  }
};
