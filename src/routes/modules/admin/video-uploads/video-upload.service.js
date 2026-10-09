import { EnvConfig } from "#src/config/env.config.js";
import { prisma } from "#src/lib/prisma.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { addDaysToIstDate, getIstToday, istDateToUtc, utcToIstDate } from "#src/utils/ist-date.util.js";
import { revalidateCoursePages } from "#src/utils/landing-revalidate.util.js";

export const MAX_RELEASE_DAYS_AHEAD = 60;

/**
 * Turns the admin's optional release date ("YYYY-MM-DD", IST) into the stored UTC instant.
 * Empty means "visible as soon as processing finishes". The date must be between today and
 * today + 60 days. Choosing today makes the video visible straight away, because 00:00 IST has passed.
 * `existingReleaseAt` lets an edit keep a date that is already saved, even if it is now in the past.
 */
export const resolveVideoReleaseAt = (releaseDate, existingReleaseAt) => {
  if (releaseDate === undefined) return undefined;
  if (releaseDate === null || releaseDate === "") return null;

  if (existingReleaseAt && utcToIstDate(existingReleaseAt) === releaseDate) return existingReleaseAt;

  const releaseAt = istDateToUtc(releaseDate);
  const today = getIstToday();
  const lastAllowedDate = addDaysToIstDate(today, MAX_RELEASE_DAYS_AHEAD);

  if (releaseDate < today) {
    const error = new Error("Release date can't be in the past");
    error.statusCode = 400;
    throw error;
  }

  if (releaseDate > lastAllowedDate) {
    const error = new Error(`Release date must be within ${MAX_RELEASE_DAYS_AHEAD} days from today`);
    error.statusCode = 400;
    throw error;
  }

  return releaseAt;
};

export const formatAdminVideo = (video, now = new Date()) => ({
  ...video,
  fileSize: video.fileSize.toString(),
  releaseDate: utcToIstDate(video.releaseAt),
  isScheduled: Boolean(video.releaseAt && video.releaseAt > now),
});

export const createVideoObjectService = async (data) => {
  const lastResource = await prisma.courseVideo.findFirst({
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });
  const groupId = await resolveVideoGroupId(data.groupId, data.yogaCourseId);
  const video = await prisma.courseVideo.create({
    data: {
      ...data,
      groupId: groupId ?? null,
      sortOrder: (lastResource?.sortOrder ?? 0) + 1,
    },
  });
  if (groupId) await normalizeCourseVideoOrder(video.yogaCourseId);

  revalidateCoursePages(video.yogaCourseId);
  return video;
};

export const getVideoUploadMetadata = async ({ encodedMetadata, fileSize, expiresAt }) => {
  const uploadMetadata = `${encodedMetadata},requiresignedurls`;

  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/` + `${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`;

  const cloudflareResponse = await fetch(endpoint, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${EnvConfig.CLOUDFLARE_STREAM_API_TOKEN}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": fileSize.toString(),
      "Upload-Metadata": uploadMetadata,
    },
  });

  const uploadUrl = cloudflareResponse.headers.get("Location");

  const cloudflareVideoUid = cloudflareResponse.headers.get("stream-media-id");

  if (!cloudflareResponse.ok || !uploadUrl || !cloudflareVideoUid) {
    const errorResponse = await cloudflareResponse.text();

    console.error("Cloudflare Stream upload initialization failed:", {
      status: cloudflareResponse.status,
      response: errorResponse,
    });

    throw new Error(ERROR_MESSAGES.VIDEO_UPLOAD_INITIALIZATION_FAILED);
  }

  return {
    uploadUrl,
    cloudflareVideoUid,
    expiresAt,
  };
};

export const updateVideoObjectWithCloudflareMetadata = async ({ video_id, cloudflareMetaData }) => {
  await prisma.CourseVideo.update({
    where: {
      id: video_id,
    },

    data: {
      cloudflareVideoUid: cloudflareMetaData.cloudflareVideoUid,

      status: "UPLOADING",
    },
  });
};

export const fetchCourseVideosService = async (courseId) => {
  const videos = await prisma.courseVideo.findMany({
    where: {
      yogaCourseId: courseId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  const now = new Date();
  return videos.map((video) => formatAdminVideo(video, now));
};

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

/** Makes sure a group exists and belongs to the course. `null`/"" means "no group". */
export const resolveVideoGroupId = async (groupId, courseId) => {
  if (groupId === undefined) return undefined;
  if (groupId === null || groupId === "") return null;

  const group = await prisma.courseVideoGroup.findFirst({ where: { id: groupId, yogaCourseId: courseId }, select: { id: true } });
  if (!group) throw badRequest("The selected group doesn't belong to this course");
  return group.id;
};

/**
 * Keeps the course-wide video order in group order (Week 1's videos, then Week 2's, …, ungrouped last),
 * keeping the existing order inside each group. Lesson numbers, "next video" and the week view then
 * always agree. Does nothing for a course without groups.
 */
export const normalizeCourseVideoOrder = async (courseId) => {
  const groups = await prisma.courseVideoGroup.findMany({
    where: { yogaCourseId: courseId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (groups.length === 0) return;

  const videos = await prisma.courseVideo.findMany({
    where: { yogaCourseId: courseId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, groupId: true, sortOrder: true },
  });
  const groupRank = new Map(groups.map((group, index) => [group.id, index]));
  const rankOf = (video) => groupRank.get(video.groupId) ?? groups.length;
  // Array.prototype.sort is stable, so videos keep their order inside a group.
  const ordered = [...videos].sort((first, second) => rankOf(first) - rankOf(second));

  const updates = ordered
    .map((video, index) => ({ video, sortOrder: index + 1 }))
    .filter(({ video, sortOrder }) => video.sortOrder !== sortOrder)
    .map(({ video, sortOrder }) => prisma.courseVideo.update({ where: { id: video.id }, data: { sortOrder } }));
  if (updates.length > 0) await prisma.$transaction(updates);
};

export const fetchCourseVideoGroupsService = async (courseId) => {
  const groups = await prisma.courseVideoGroup.findMany({
    where: { yogaCourseId: courseId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, description: true, sortOrder: true, videos: { select: { id: true }, orderBy: { sortOrder: "asc" } } },
  });

  return groups.map(({ videos, ...group }) => ({ ...group, videoIds: videos.map(({ id }) => id) }));
};

export const createCourseVideoGroupService = async ({ courseId, title, description }) => {
  const course = await prisma.yogaCourse.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const lastGroup = await prisma.courseVideoGroup.findFirst({
    where: { yogaCourseId: courseId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const group = await prisma.courseVideoGroup.create({
    data: { yogaCourseId: courseId, title, description: description || null, sortOrder: (lastGroup?.sortOrder ?? 0) + 1 },
    select: { id: true, title: true, description: true, sortOrder: true },
  });

  revalidateCoursePages(courseId);
  return { ...group, videoIds: [] };
};

const findGroupOrThrow = async (groupId) => {
  const group = await prisma.courseVideoGroup.findUnique({ where: { id: groupId }, select: { id: true, yogaCourseId: true } });
  if (!group) {
    const error = new Error("Group not found");
    error.statusCode = 404;
    throw error;
  }
  return group;
};

export const updateCourseVideoGroupService = async (groupId, { title, description }) => {
  const group = await findGroupOrThrow(groupId);
  const updated = await prisma.courseVideoGroup.update({
    where: { id: groupId },
    data: { title, ...(description !== undefined ? { description: description || null } : {}) },
    select: { id: true, title: true, description: true, sortOrder: true },
  });

  revalidateCoursePages(group.yogaCourseId);
  return updated;
};

// Deleting a group never deletes its videos; they become ungrouped (onDelete: SetNull).
export const deleteCourseVideoGroupService = async (groupId) => {
  const group = await findGroupOrThrow(groupId);
  await prisma.courseVideoGroup.delete({ where: { id: groupId } });
  await normalizeCourseVideoOrder(group.yogaCourseId);

  revalidateCoursePages(group.yogaCourseId);
  return { groupId, deleted: true };
};

/** "Set release date for this group": applies one date (same 0–60 day rule) to every video in it. */
export const setGroupReleaseDateService = async (groupId, releaseDate) => {
  const group = await findGroupOrThrow(groupId);
  const releaseAt = resolveVideoReleaseAt(releaseDate ?? "");

  const { count } = await prisma.courseVideo.updateMany({ where: { groupId }, data: { releaseAt } });

  revalidateCoursePages(group.yogaCourseId);
  return { groupId, releaseDate: utcToIstDate(releaseAt), updatedVideoCount: count };
};

/**
 * Saves a full layout in one transaction: group order, each video's group, and one continuous
 * course-wide video order. layout = [{ groupId, videoIds }], with groupId null for ungrouped videos.
 */
const reorderCourseVideosByLayout = async ({ courseId, layout }) => {
  if (!Array.isArray(layout) || layout.length === 0) throw badRequest("layout must be a non-empty list");

  const seenGroupIds = new Set();
  const seenVideoIds = new Set();
  layout.forEach((entry) => {
    if (!entry || typeof entry !== "object" || !Array.isArray(entry.videoIds)) throw badRequest("Every layout entry needs videoIds");
    const groupId = entry.groupId ?? null;
    if (groupId !== null && typeof groupId !== "string") throw badRequest("groupId must be text or null");
    if (seenGroupIds.has(groupId)) throw badRequest("A group appears more than once in the layout");
    seenGroupIds.add(groupId);
    entry.videoIds.forEach((videoId) => {
      if (typeof videoId !== "string" || seenVideoIds.has(videoId)) throw badRequest(ERROR_MESSAGES.ORDERED_VIDEO_IDS_DUPLICATE);
      seenVideoIds.add(videoId);
    });
  });

  return prisma.$transaction(async (transaction) => {
    const [videos, groups] = await Promise.all([
      transaction.courseVideo.findMany({ where: { yogaCourseId: courseId }, select: { id: true } }),
      transaction.courseVideoGroup.findMany({ where: { yogaCourseId: courseId }, select: { id: true } }),
    ]);

    const courseVideoIds = new Set(videos.map(({ id }) => id));
    const courseGroupIds = new Set(groups.map(({ id }) => id));
    const unknownVideoIds = [...seenVideoIds].filter((id) => !courseVideoIds.has(id));
    if (unknownVideoIds.length > 0) throw badRequest(ERROR_MESSAGES.VIDEO_COURSE_IDS_NOT_FOUND(unknownVideoIds));
    if (seenVideoIds.size !== courseVideoIds.size) throw badRequest("The layout must include every video of the course exactly once");
    if ([...seenGroupIds].some((id) => id !== null && !courseGroupIds.has(id))) {
      throw badRequest("The layout contains a group that doesn't belong to this course");
    }

    // Ungrouped videos always come last.
    const orderedLayout = [...layout.filter((entry) => entry.groupId), ...layout.filter((entry) => !entry.groupId)];
    let videoPosition = 0;
    const updates = [];
    orderedLayout.forEach((entry, groupIndex) => {
      if (entry.groupId) {
        updates.push(transaction.courseVideoGroup.update({ where: { id: entry.groupId }, data: { sortOrder: groupIndex + 1 } }));
      }
      entry.videoIds.forEach((videoId) => {
        videoPosition += 1;
        updates.push(
          transaction.courseVideo.update({ where: { id: videoId }, data: { sortOrder: videoPosition, groupId: entry.groupId ?? null } }),
        );
      });
    });
    await Promise.all(updates);

    const reorderedVideos = await transaction.courseVideo.findMany({ where: { yogaCourseId: courseId }, orderBy: { sortOrder: "asc" } });
    const now = new Date();
    return reorderedVideos.map((video) => formatAdminVideo(video, now));
  }).then((videos) => {
    revalidateCoursePages(courseId);
    return videos;
  });
};

export const reorderCourseVideosService = async ({ courseId, videoId, orderedIds, layout }) => {
  if (layout !== undefined) {
    if (typeof courseId !== "string" || courseId.length === 0) throw badRequest(ERROR_MESSAGES.COURSE_ID_REQUIRED);
    return reorderCourseVideosByLayout({ courseId, layout });
  }

  if (typeof courseId !== "string" || courseId.length === 0) {
    const error = new Error(ERROR_MESSAGES.COURSE_ID_REQUIRED);
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    const error = new Error(ERROR_MESSAGES.ORDERED_VIDEO_IDS_REQUIRED);
    error.statusCode = 400;
    throw error;
  }

  if (orderedIds.some((id) => typeof id !== "string" || id.length === 0)) {
    const error = new Error(ERROR_MESSAGES.ORDERED_VIDEO_IDS_INVALID);
    error.statusCode = 400;
    throw error;
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    const error = new Error(ERROR_MESSAGES.ORDERED_VIDEO_IDS_DUPLICATE);
    error.statusCode = 400;
    throw error;
  }

  if (videoId && !orderedIds.includes(videoId)) {
    const error = new Error(ERROR_MESSAGES.VIDEO_ID_NOT_IN_ORDER);
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (transaction) => {
    const videos = await transaction.courseVideo.findMany({
      where: { yogaCourseId: courseId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const existingIds = new Set(videos.map(({ id }) => id));
    const missingIds = orderedIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      const error = new Error(ERROR_MESSAGES.VIDEO_COURSE_IDS_NOT_FOUND(missingIds));
      error.statusCode = 400;
      throw error;
    }

    const orderedIdSet = new Set(orderedIds);
    const remainingIds = videos.map(({ id }) => id).filter((id) => !orderedIdSet.has(id));
    const completeOrder = [...orderedIds, ...remainingIds];

    await Promise.all(
      completeOrder.map((id, index) =>
        transaction.courseVideo.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    const reorderedVideos = await transaction.courseVideo.findMany({
      where: { yogaCourseId: courseId },
      orderBy: { sortOrder: "asc" },
    });

    const now = new Date();
    return reorderedVideos.map((video) => formatAdminVideo(video, now));
  }).then((videos) => {
    revalidateCoursePages(courseId);
    return videos;
  });
};

export const fetchVideoDetailsService = async (video_id) => {
  return await prisma.courseVideo.findUnique({
    where: {
      id: video_id,
    },
  });
};

export const updateVideoDetailsService = async (
  videoId,
  { title, description, thumbnailId, thumbnailUrl, releaseDate, groupId },
) => {
  const video = await prisma.courseVideo.findUnique({
    where: { id: videoId },
    select: { id: true, releaseAt: true, yogaCourseId: true, groupId: true },
  });

  if (!video) {
    const error = new Error(ERROR_MESSAGES.VIDEO_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const updatedVideo = await prisma.courseVideo.update({
    where: { id: videoId },
    data: {
      title,
      description,
      thumbnailId,
      thumbnailUrl,
      releaseAt: resolveVideoReleaseAt(releaseDate, video.releaseAt),
      groupId: await resolveVideoGroupId(groupId, video.yogaCourseId),
    },
  });

  if (updatedVideo.groupId !== video.groupId) await normalizeCourseVideoOrder(updatedVideo.yogaCourseId);

  revalidateCoursePages(updatedVideo.yogaCourseId);
  return updatedVideo;
};

export const deleteYogaCourseVideoService = async (video_id) => {
  return await prisma.courseVideo.delete({
    where: {
      id: video_id,
    },
  });
};

export const deleteYogaCourseVideoFromCloudFlair = async (cloudflareVideoUid) => {
  if (!cloudflareVideoUid) {
    const error = new Error(ERROR_MESSAGES.CLOUDFLARE_VIDEO_ID_MISSING);
    error.statusCode = 400;
    throw error;
  }

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error(ERROR_MESSAGES.CLOUDFLARE_STREAM_CONFIGURATION_MISSING);
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/stream/${encodeURIComponent(cloudflareVideoUid)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${EnvConfig.CLOUDFLARE_STREAM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );

  const responseText = await response.text();
  let result = { success: response.ok };

  if (responseText.trim()) {
    try {
      result = JSON.parse(responseText);
    } catch {
      if (!response.ok) {
        throw new Error(ERROR_MESSAGES.CLOUDFLARE_VIDEO_DELETION_FAILED);
      }
    }
  }

  if (!response.ok || result.success === false) {
    const error = new Error(result.errors?.[0]?.message || ERROR_MESSAGES.CLOUDFLARE_VIDEO_DELETION_FAILED);
    error.statusCode = response.status >= 400 ? response.status : 502;
    throw error;
  }

  return result;
};
