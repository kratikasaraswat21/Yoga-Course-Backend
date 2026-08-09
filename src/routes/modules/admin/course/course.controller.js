import { EnvConfig } from "#src/config/env.config.js";
import {
  addYogaCourseForStepOne,
  deleteThumbnailImageService,
  getCloudFlairImageUploadURL,
} from "#src/routes/modules/admin/course/course.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";

export const generateCourseThumbnailUploadURL = asyncHandler(async (req, res) => {
  const { fileName, fileType } = req.body;

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN) {
    throw new Error("Cloudflare Images configuration is missing");
  }

  const formData = new FormData();

  formData.append("requireSignedURLs", "false");

  formData.append(
    "metadata",
    JSON.stringify({
      type: "COURSE_THUMBNAIL",
      fileName,
      fileType,
    }),
  );

  const response = await getCloudFlairImageUploadURL({ formData });

  return res.status(201).json({
    success: true,

    message: SUCCESS_MESSAGES.COURSE_THUMBNAIL_UPLOAD_URL_GENERATED_SUCCESSFULLY,

    data: {
      imageId: response.imageId,
      uploadUrl: response.uploadUrl,
    },
  });
});

export const deleteCourseThumbnailController = asyncHandler(async (req, res) => {
  const { imageId } = req.params;

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN) {
    throw new Error("Cloudflare Images configuration is missing");
  }

  const encodedImageId = encodeURIComponent(imageId);

  const response = await deleteThumbnailImageService({ encodedImageId, imageId });

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSE_THUMBNAIL_DELETED_SUCCESSFULLY,
    data: response,
  });
});

export const addCourseDataForStepOne = asyncHandler(async (req, res) => {
  const title = req?.body?.title;
  const description = req?.body?.description;
  const price = req?.body?.price;
  const discountPercentage = req?.body?.discountPercentage;
  const roundPayableAmount = req?.body?.roundPayableAmount;
  const thumbnailUrl = req?.body?.thumbnailURL;
  const thumbnailId = req?.body?.thumbnailId;

  const coursePrice = Number(price);
  const courseDiscountPercentage = Number(discountPercentage);
  const discountedPrice = coursePrice - (coursePrice * courseDiscountPercentage) / 100;

  const totalPayableAmount = roundPayableAmount ? Math.round(discountedPrice) : Number(discountedPrice.toFixed(2));

  const courseObject = await addYogaCourseForStepOne({
    title,
    description,
    price: coursePrice,
    discount: courseDiscountPercentage,
    totalPayableAmount: totalPayableAmount,
    thumbnailId,
    thumbnailUrl,
  });

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSE_STEP_ONE_SAVED_SUCCESSFULLY,
    data: {
      course_id: courseObject.id,
    },
  });
});
