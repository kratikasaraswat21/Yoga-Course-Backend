import { EnvConfig } from "#src/config/env.config.js";
import {
  createVideoObjectService,
  deleteYogaCourseVideoFromCloudFlair,
  deleteYogaCourseVideoService,
  fetchCourseVideosService,
  fetchVideoDetailsService,
  getVideoUploadMetadata,
  reorderCourseVideosService,
  updateVideoObjectWithCloudflareMetadata,
} from "#src/routes/modules/admin/video-uploads/video-upload.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { encodeMetadata } from "#src/utils/helper.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";

export const CreateCloudflareVideoUploadUrlController = asyncHandler(async (req, res) => {
  const title = req?.body?.title;
  const fileName = req?.body?.fileName;
  const fileType = req?.body?.fileType;
  const fileSize = req?.body?.fileSize;
  const maxDurationSeconds = req?.body?.maxDurationSeconds;
  const courseId = req?.body?.courseId;
  const description = req?.body?.description;
  const thumbnailType = req?.body?.thumbnailType;
  const thumbnailUrl = req?.body?.thumbnailUrl;
  const thumbnailId = req?.body?.thumbnailId;

  if (!["automatic", "custom"].includes(thumbnailType)) {
    return res.status(400).json({
      message: ERROR_MESSAGES.INVALID_THUMBNAIL_TYPE,
      success: false,
    });
  }

  const videoObject = await createVideoObjectService({
    title,
    description: description ?? "",
    originalFileName: fileName,
    fileType,
    fileSize: BigInt(fileSize),
    status: "PENDING",
    durationSeconds: maxDurationSeconds,
    isCustomThumbnail: thumbnailType == "custom",
    yogaCourseId: courseId,
    thumbnailUrl: thumbnailUrl ?? "",
    thumbnailId: thumbnailId ?? "",
  });

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error(ERROR_MESSAGES.CLOUDFLARE_STREAM_CONFIGURATION_MISSING);
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const videoId = videoObject.id;

  const encodedMetadata = encodeMetadata({
    name: fileName,
    maxDurationSeconds: String(maxDurationSeconds),
    expiry: expiresAt,
  });

  const cloudflareMetaData = await getVideoUploadMetadata({ encodedMetadata, fileSize, expiresAt });

  await updateVideoObjectWithCloudflareMetadata({ video_id: videoId, cloudflareMetaData });

  return res.status(201).json({
    message: SUCCESS_MESSAGES.VIDEO_UPLOAD_URL_CREATED_SUCCESSFULLY,
    success: true,
    data: {
      videoId: videoObject.id,
      cloudflareVideoUid: cloudflareMetaData.cloudflareVideoUid,
      uploadUrl: cloudflareMetaData.uploadUrl,
      expiresAt: cloudflareMetaData.expiresAt,
    },
  });
});

export const fetchYogaCourseVideosController = asyncHandler(async (req, res) => {
  const courseId = req?.query?.courseId;

  const response = await fetchCourseVideosService(courseId);

  return res.status(201).json({
    message: SUCCESS_MESSAGES.COURSE_VIDEOS_FETCHED_SUCCESSFULLY,
    success: true,
    data: response,
  });
});

export const reorderCourseVideosController = asyncHandler(async (req, res) => {
  const { courseId, videoId, orderedIds } = req.body ?? {};
  const videos = await reorderCourseVideosService({ courseId, videoId, orderedIds });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.COURSE_VIDEOS_REORDERED_SUCCESSFULLY,
    success: true,
    data: {
      videos,
    },
  });
});

export const deleteVideoFromCloudflare = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await fetchVideoDetailsService(videoId);

  if (!video) {
    return res.status(404).json({
      success: false,
      message: ERROR_MESSAGES.VIDEO_NOT_FOUND,
    });
  }

  await deleteYogaCourseVideoFromCloudFlair(video.cloudflareVideoUid);

  await deleteYogaCourseVideoService(video.id);

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.VIDEO_DELETED_SUCCESSFULLY,
    data: {
      videoId: video.id,
      deleted: true,
    },
  });
});
