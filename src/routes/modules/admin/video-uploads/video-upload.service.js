import { EnvConfig } from "#src/config/env.config.js";
import { prisma } from "#src/lib/prisma.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";

export const createVideoObjectService = async (data) => {
  const lastResource = await prisma.courseVideo.findFirst({
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });
  const video = await prisma.courseVideo.create({
    data: {
      ...data,
      sortOrder: (lastResource?.sortOrder ?? 0) + 1,
    },
  });

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

  return videos.map((video) => ({
    ...video,
    fileSize: video.fileSize.toString(),
  }));
};

export const reorderCourseVideosService = async ({ courseId, videoId, orderedIds }) => {
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

    return reorderedVideos.map((video) => ({
      ...video,
      fileSize: video.fileSize.toString(),
    }));
  });
};

export const fetchVideoDetailsService = async (video_id) => {
  return await prisma.courseVideo.findUnique({
    where: {
      id: video_id,
    },
  });
};

export const updateVideoDetailsService = async (videoId, { title, description, thumbnailId, thumbnailUrl }) => {
  const video = await prisma.courseVideo.findUnique({
    where: { id: videoId },
    select: { id: true },
  });

  if (!video) {
    const error = new Error(ERROR_MESSAGES.VIDEO_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  return prisma.courseVideo.update({
    where: { id: videoId },
    data: {
      title,
      description,
      thumbnailId,
      thumbnailUrl,
    },
  });
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
