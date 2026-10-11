import { EnvConfig } from "#src/config/env.config.js";
import {
  addInstagramFeedbackImageService,
  deleteInstagramFeedbackImageService,
  fetchInstagramFeedbackImagesService,
  INSTAGRAM_FEEDBACK_FOLDER,
  reorderInstagramFeedbackImagesService,
  signInstagramFeedbackUploadService,
} from "#src/routes/modules/admin/instagramFeedback/instagram-feedback.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

export const generateInstagramFeedbackUploadSignature = asyncHandler(async (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);

  return res.status(200).json({
    success: true,
    message: "Upload signed",
    data: {
      cloudName: EnvConfig.CLOUDINARY_CLOUD_NAME,
      apiKey: EnvConfig.CLOUDINARY_API_KEY,
      timestamp,
      upload_info: {
        signature: signInstagramFeedbackUploadService(timestamp),
        folder: INSTAGRAM_FEEDBACK_FOLDER,
        resourceType: "image",
      },
    },
  });
});

export const fetchInstagramFeedbackImagesController = asyncHandler(async (req, res) => {
  const images = await fetchInstagramFeedbackImagesService(req.query?.courseId);
  return res.status(200).json({ success: true, message: "Feedback images fetched", data: { images } });
});

export const addInstagramFeedbackImageController = asyncHandler(async (req, res) => {
  const image = await addInstagramFeedbackImageService({
    imageUrl: req.body?.imageUrl,
    publicId: req.body?.publicId,
    altText: req.body?.altText,
    courseId: req.body?.courseId,
  });
  return res.status(201).json({ success: true, message: "Feedback image added", data: { image } });
});

export const reorderInstagramFeedbackImagesController = asyncHandler(async (req, res) => {
  const images = await reorderInstagramFeedbackImagesService({
    orderedIds: req.body?.orderedIds,
    courseId: req.body?.courseId,
  });
  return res.status(200).json({ success: true, message: "Order saved", data: { images } });
});

export const deleteInstagramFeedbackImageController = asyncHandler(async (req, res) => {
  const result = await deleteInstagramFeedbackImageService(req.query?.id);
  return res.status(200).json({ success: true, message: "Feedback image deleted", data: result });
});
