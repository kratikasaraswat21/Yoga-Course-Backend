import { EnvConfig } from "#src/config/env.config.js";
import { prisma } from "#src/lib/prisma.js";

export const createVideoObjectService = async (data) => {
  const video = await prisma.CourseVideos.create({
    data: data,
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

    throw new Error("Unable to initialize video upload");
  }

  return {
    uploadUrl,
    cloudflareVideoUid,
    expiresAt,
  };
};

export const updateVideoObjectWithCloudflareMetadata = async ({ video_id, cloudflareMetaData }) => {
  await prisma.CourseVideos.update({
    where: {
      id: video_id,
    },

    data: {
      cloudflareVideoUid: cloudflareMetaData.cloudflareVideoUid,

      status: "UPLOADING",
    },
  });
};
