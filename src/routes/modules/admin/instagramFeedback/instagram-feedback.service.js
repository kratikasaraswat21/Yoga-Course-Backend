import { EnvConfig } from "#src/config/env.config.js";
import { prisma } from "#src/lib/prisma.js";
import { LandingTags, revalidateLandingTags } from "#src/utils/landing-revalidate.util.js";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: EnvConfig.CLOUDINARY_CLOUD_NAME,
  api_key: EnvConfig.CLOUDINARY_API_KEY,
  api_secret: EnvConfig.CLOUDINARY_API_SECRET,
});

export const INSTAGRAM_FEEDBACK_FOLDER = "yoga/instagram-feedback";
const MAX_ALT_TEXT_LENGTH = 200;

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const imageSelect = { id: true, imageUrl: true, publicId: true, altText: true, sortOrder: true, createdAt: true };

export const signInstagramFeedbackUploadService = (timestamp) =>
  cloudinary.utils.api_sign_request({ timestamp, folder: INSTAGRAM_FEEDBACK_FOLDER }, EnvConfig.CLOUDINARY_API_SECRET);

export const fetchInstagramFeedbackImagesService = () =>
  prisma.instagramFeedbackImage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: imageSelect });

/** Public list for the home page and course landing pages. */
export const fetchPublicInstagramFeedbackImagesService = () =>
  prisma.instagramFeedbackImage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, imageUrl: true, altText: true },
  });

/** Saves an image uploaded with the signature above. Only images from this site's upload folder are accepted. */
export const addInstagramFeedbackImageService = async ({ imageUrl, publicId, altText }) => {
  const url = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const id = typeof publicId === "string" ? publicId.trim() : "";
  const expectedPrefix = `https://res.cloudinary.com/${EnvConfig.CLOUDINARY_CLOUD_NAME}/image/upload/`;

  if (!url.startsWith(expectedPrefix)) throw badRequest("Upload the image through the admin panel first");
  if (!id.startsWith(`${INSTAGRAM_FEEDBACK_FOLDER}/`) || !url.includes(id)) {
    throw badRequest("The image doesn't match its upload");
  }
  const alt = typeof altText === "string" ? altText.trim() : "";
  if (alt.length > MAX_ALT_TEXT_LENGTH) throw badRequest(`Image description can't be longer than ${MAX_ALT_TEXT_LENGTH} characters`);

  const last = await prisma.instagramFeedbackImage.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const image = await prisma.instagramFeedbackImage.create({
    data: { imageUrl: url, publicId: id, altText: alt || null, sortOrder: (last?.sortOrder ?? 0) + 1 },
    select: imageSelect,
  });

  revalidateLandingTags([LandingTags.INSTAGRAM_FEEDBACK]);
  return image;
};

/** Saves a new order: `orderedIds` lists every image, first to last. */
export const reorderInstagramFeedbackImagesService = async ({ orderedIds }) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.some((id) => typeof id !== "string" || !id)) {
    throw badRequest("orderedIds must list the image IDs");
  }
  if (new Set(orderedIds).size !== orderedIds.length) throw badRequest("orderedIds can't contain the same image twice");

  const images = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.instagramFeedbackImage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const existingIds = new Set(existing.map(({ id }) => id));
    if (orderedIds.some((id) => !existingIds.has(id))) throw badRequest("Some images were not found. Refresh the page.");

    // Images missing from the list (e.g. added in another tab) keep their place at the end.
    const listed = new Set(orderedIds);
    const completeOrder = [...orderedIds, ...existing.map(({ id }) => id).filter((id) => !listed.has(id))];
    await Promise.all(
      completeOrder.map((id, index) =>
        transaction.instagramFeedbackImage.update({ where: { id }, data: { sortOrder: index + 1 } }),
      ),
    );
    return transaction.instagramFeedbackImage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: imageSelect,
    });
  });

  revalidateLandingTags([LandingTags.INSTAGRAM_FEEDBACK]);
  return images;
};

/** Deletes the image and its file on Cloudinary. */
export const deleteInstagramFeedbackImageService = async (id) => {
  const image = await prisma.instagramFeedbackImage.findUnique({ where: { id }, select: { id: true, publicId: true } });
  if (!image) {
    const error = new Error("Image not found");
    error.statusCode = 404;
    throw error;
  }

  await prisma.instagramFeedbackImage.delete({ where: { id } });
  revalidateLandingTags([LandingTags.INSTAGRAM_FEEDBACK]);

  // The image is already off the site; a failed Cloudinary clean-up only leaves an unused file.
  cloudinary.uploader
    .destroy(image.publicId, { resource_type: "image", invalidate: true })
    .catch((error) => console.error(`Cloudinary delete failed for ${image.publicId}:`, error));

  return { id };
};
