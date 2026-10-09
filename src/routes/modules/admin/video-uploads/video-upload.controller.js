import { EnvConfig } from "#src/config/env.config.js";
import {
  createVideoObjectService,
  deleteYogaCourseVideoFromCloudFlair,
  deleteYogaCourseVideoService,
  fetchCourseVideosService,
  fetchVideoDetailsService,
  getVideoUploadMetadata,
  reorderCourseVideosService,
  updateVideoDetailsService,
  updateVideoObjectWithCloudflareMetadata,
  resolveVideoReleaseAt,
  formatAdminVideo,
  fetchCourseVideoGroupsService,
  createCourseVideoGroupService,
  updateCourseVideoGroupService,
  deleteCourseVideoGroupService,
  setGroupReleaseDateService,
} from "#src/routes/modules/admin/video-uploads/video-upload.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { encodeMetadata } from "#src/utils/helper.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";
import { revalidateCoursePages } from "#src/utils/landing-revalidate.util.js";

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
  const releaseAt = resolveVideoReleaseAt(req?.body?.releaseDate);

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
    releaseAt,
    groupId: req?.body?.groupId || undefined,
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
  const { courseId, videoId, orderedIds, layout } = req.body ?? {};
  const videos = await reorderCourseVideosService({ courseId, videoId, orderedIds, layout });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.COURSE_VIDEOS_REORDERED_SUCCESSFULLY,
    success: true,
    data: {
      videos,
    },
  });
});

export const updateVideoDetailsController = asyncHandler(async (req, res) => {
  const { videoId, title, description, thumbnailId, thumbnailUrl, releaseDate, groupId } = req.body;

  const video = await updateVideoDetailsService(videoId, {
    title,
    description,
    thumbnailId,
    thumbnailUrl,
    releaseDate,
    groupId,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.VIDEO_DETAILS_UPDATED_SUCCESSFULLY,
    success: true,
    data: {
      video: formatAdminVideo(video),
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
  revalidateCoursePages(video.yogaCourseId);

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.VIDEO_DELETED_SUCCESSFULLY,
    data: {
      videoId: video.id,
      deleted: true,
    },
  });
});

export const fetchCourseVideoGroupsController = asyncHandler(async (req, res) => {
  const groups = await fetchCourseVideoGroupsService(req.query.courseId);
  return res.status(200).json({ success: true, message: "Video groups fetched successfully", data: { groups } });
});

export const createCourseVideoGroupController = asyncHandler(async (req, res) => {
  const group = await createCourseVideoGroupService({
    courseId: req.body.courseId,
    title: req.body.title,
    description: req.body.description,
  });
  return res.status(201).json({ success: true, message: "Group created successfully", data: { group } });
});

export const updateCourseVideoGroupController = asyncHandler(async (req, res) => {
  const group = await updateCourseVideoGroupService(req.params.groupId, {
    title: req.body.title,
    description: req.body.description,
  });
  return res.status(200).json({ success: true, message: "Group updated successfully", data: { group } });
});

export const deleteCourseVideoGroupController = asyncHandler(async (req, res) => {
  const result = await deleteCourseVideoGroupService(req.params.groupId);
  return res.status(200).json({ success: true, message: "Group deleted. Its videos are now ungrouped.", data: result });
});

export const setGroupReleaseDateController = asyncHandler(async (req, res) => {
  const result = await setGroupReleaseDateService(req.params.groupId, req.body.releaseDate);
  return res.status(200).json({ success: true, message: "Release date applied to every video in the group", data: result });
});
