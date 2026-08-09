import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";

export const getCloudFlairImageUploadURL = async ({ formData }) => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/` + `${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/images/v2/direct_upload`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN}`,
      },

      body: formData,
    },
  );

  const responseData = await response.json();

  if (!response.ok || !responseData.success || !responseData.result?.id || !responseData.result.uploadURL) {
    throw new Error(responseData.errors?.[0]?.message ?? "Unable to initialize course thumbnail upload");
  }

  return {
    imageId: responseData.result.id,
    uploadUrl: responseData.result.uploadURL,
  };
};

export const deleteThumbnailImageService = async ({ encodedImageId, imageId }) => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/` +
      `${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/images/v1/` +
      `${encodedImageId}`,
    {
      method: "DELETE",

      headers: {
        Authorization: `Bearer ${EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN}`,
      },
    },
  );

  const responseData = await response.json();

  if (!response.ok || !responseData.success) {
    throw new Error(responseData.errors?.[0]?.message ?? "Unable to delete course thumbnail");
  }

  return {
    imageId,
    deleted: true,
  };
};

export const addYogaCourseForStepOne = async ({
  title,
  description,
  price,
  discount,
  totalPayableAmount,
  thumbnailUrl,
  thumbnailId,
}) => {
  return await prisma.yogaCourse.create({
    data: {
      title,
      description,
      status: CourseStatus.DRAFT,
      price,
      discount,
      totalPayableAmount,
      thumbnailUrl,
      thumbnailId,
    },
  });
};
