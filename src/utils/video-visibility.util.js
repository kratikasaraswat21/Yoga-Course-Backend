import { formatIstDisplayDate, utcToIstDate } from "#src/utils/ist-date.util.js";

// A video is released when it has no release date, or its release date has passed.
export const releasedVideoWhere = (now = new Date()) => ({
  OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
});

export const isVideoReleased = (video, now = new Date()) => !video.releaseAt || new Date(video.releaseAt) <= now;

export const createVideoLockedError = (releaseAt) => {
  const error = new Error(`This video unlocks on ${formatIstDisplayDate(releaseAt)}`);
  error.statusCode = 403;
  error.data = { code: "VIDEO_LOCKED_SCHEDULED", releaseAt: new Date(releaseAt).toISOString(), releaseDate: utcToIstDate(releaseAt) };
  return error;
};

/**
 * Applies the release schedule to a list of videos for one viewer.
 * - showScheduledAsLocked = false: scheduled videos are removed (normal buyers).
 * - showScheduledAsLocked = true: scheduled videos stay in the list, marked as locked (prelaunch buyers,
 *   and people who haven't bought the course yet, so they can see the full curriculum).
 */
export const applyVideoVisibility = (videos, { showScheduledAsLocked, now = new Date() }) =>
  videos
    .filter((video) => showScheduledAsLocked || isVideoReleased(video, now))
    .map(({ releaseAt, ...video }) => {
      const isReleased = isVideoReleased({ releaseAt }, now);

      return {
        ...video,
        isLocked: !isReleased,
        releaseAt: isReleased || !releaseAt ? null : new Date(releaseAt).toISOString(),
        releaseDate: isReleased || !releaseAt ? null : utcToIstDate(releaseAt),
      };
    });
