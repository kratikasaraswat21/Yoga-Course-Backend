import { EnvConfig } from "#src/config/env.config.js";
import {
  createVideoObjectService,
  getVideoUploadMetadata,
  updateVideoObjectWithCloudflareMetadata,
} from "#src/routes/modules/admin/video-uploads/video-upload.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { encodeMetadata } from "#src/utils/helper.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";

export const CreateCloudflareVideoUploadUrlController = asyncHandler(async (req, res) => {
  const title = req?.body?.title;
  const fileName = req?.body?.fileName;
  const fileType = req?.body?.fileType;
  const fileSize = req?.body?.fileSize;
  const maxDurationSeconds = req?.body?.maxDurationSeconds;

  const videoObject = await createVideoObjectService({
    title,
    originalFileName: fileName,
    fileType,
    fileSize: BigInt(fileSize),
    status: "PENDING",
  });

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error("Cloudflare Stream configuration is missing");
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const videoId = videoObject.id;

  const encodedMetadata = encodeMetadata({
    name: fileName,
    filename: fileName,
    filetype: fileType,
    videoId,
    maxDurationSeconds: maxDurationSeconds.toString(),
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
