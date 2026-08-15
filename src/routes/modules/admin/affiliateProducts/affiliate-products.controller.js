import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import {
  addAffiliateProductService,
  deleteAffiliateProductService,
  editAffiliateProductService,
  fetchAffiliateProductsService,
  reorderAffiliateProductsService,
  signAffiliateFileService,
} from "#src/routes/modules/admin/affiliateProducts/affiliate-products.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";

export const generateAffiliateProductsUploadSignature = asyncHandler(async (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const productFolder = `yoga/affiliate/products`;

  const productSignature = signAffiliateFileService(productFolder, timestamp);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.FILE_SIGNED_SUCCESSFULLY,
    success: true,
    data: {
      cloudName: EnvConfig.CLOUDINARY_CLOUD_NAME,
      apiKey: EnvConfig.CLOUDINARY_API_KEY,
      timestamp,
      upload_info: {
        signature: productSignature,
        folder: productFolder,
        resourceType: "image",
      },
    },
  });
});

export const handelAddAffiliateProductsController = asyncHandler(async (req, res) => {
  const title = req?.body?.title ?? "";
  const description = req?.body?.description ?? "";
  const status = req?.body?.status ?? CourseStatus.DRAFT;
  const productsLink = req?.body?.affiliateLink ?? "";
  const buttonTitle = req?.body?.buttonTitle ?? "";
  const thumbnailUrl = req?.body?.thumbnailUrl ?? "";

  const response = await addAffiliateProductService({
    title,
    description,
    status,
    productsLink,
    buttonTitle,
    thumbnailUrl,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.AFFILIATE_PRODUCT_ADDED_SUCCESSFULLY,
    success: true,
  });
});

export const handelEditAffiliateProductsController = asyncHandler(async (req, res) => {
  const course_id = req?.query?.id;
  const title = req?.body?.title ?? "";
  const description = req?.body?.description ?? "";
  const status = req?.body?.status ?? CourseStatus.DRAFT;
  const productsLink = req?.body?.affiliateLink ?? "";
  const buttonTitle = req?.body?.buttonTitle ?? "";
  const thumbnailUrl = req?.body?.thumbnailUrl ?? "";

  const response = await editAffiliateProductService(
    {
      title,
      description,
      status,
      productsLink,
      buttonTitle,
      thumbnailUrl,
    },
    course_id,
  );

  return res.status(200).json({
    message: SUCCESS_MESSAGES.AFFILIATE_PRODUCT_ADDED_SUCCESSFULLY,
    success: true,
  });
});

export const deleteAffiliateProductController = asyncHandler(async (req, res) => {
  const course_id = req?.query?.id;

  const response = await deleteAffiliateProductService(course_id);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.AFFILIATE_PRODUCT_DELETED_SUCCESSFULLY,
    success: true,
    data: {
      pdf_courses: response,
    },
  });
});

export const fetchAllAffiliateProductsController = asyncHandler(async (req, res) => {
  const response = await fetchAffiliateProductsService();

  return res.status(200).json({
    message: SUCCESS_MESSAGES.AFFILIATE_PRODUCT_FETCHED_SUCCESSFULLY,
    success: true,
    data: {
      products: response,
    },
  });
});

export const reorderAffiliateProductsController = asyncHandler(async (req, res) => {
  const { productId, orderedIds } = req.body ?? {};
  const products = await reorderAffiliateProductsService({ productId, orderedIds });

  return res.status(200).json({
    message: "Affiliate products reordered successfully",
    success: true,
    data: {
      products,
    },
  });
});
