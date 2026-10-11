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

const imageSelect = { id: true, imageUrl: true, publicId: true, altText: true, courseId: true, sortOrder: true, createdAt: true };
const imageOrder = [{ sortOrder: "asc" }, { createdAt: "asc" }];

// Images without a course are global; `courseId` picks one course's own images.
const scopeWhere = (courseId) => ({ courseId: courseId || null });

const assertCourseExists = async (courseId) => {
  if (!courseId) return;
  const course = await prisma.yogaCourse.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
};

export const signInstagramFeedbackUploadService = (timestamp) =>
  cloudinary.utils.api_sign_request({ timestamp, folder: INSTAGRAM_FEEDBACK_FOLDER }, EnvConfig.CLOUDINARY_API_SECRET);

/** The global images, or one course's own images when `courseId` is given. */
export const fetchInstagramFeedbackImagesService = (courseId) =>
  prisma.instagramFeedbackImage.findMany({ where: scopeWhere(courseId), orderBy: imageOrder, select: imageSelect });

/**
 * Public list. Without `courseId`: the global images (home page). With it: that course's own images,
 * or the global ones when the course has none.
 */
export const fetchPublicInstagramFeedbackImagesService = async (courseId) => {
  const select = { id: true, imageUrl: true, altText: true };
  if (courseId) {
    const courseImages = await prisma.instagramFeedbackImage.findMany({ where: { courseId }, orderBy: imageOrder, select });
    if (courseImages.length > 0) return courseImages;
  }
  return prisma.instagramFeedbackImage.findMany({ where: { courseId: null }, orderBy: imageOrder, select });
};

/**
 * Saves an image uploaded with the signature above, as a global image or for one course.
 * Only images from this site's upload folder are accepted.
 */
export const addInstagramFeedbackImageService = async ({ imageUrl, publicId, altText, courseId }) => {
  const url = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const id = typeof publicId === "string" ? publicId.trim() : "";
  const expectedPrefix = `https://res.cloudinary.com/${EnvConfig.CLOUDINARY_CLOUD_NAME}/image/upload/`;

  if (!url.startsWith(expectedPrefix)) throw badRequest("Upload the image through the admin panel first");
  if (!id.startsWith(`${INSTAGRAM_FEEDBACK_FOLDER}/`) || !url.includes(id)) {
    throw badRequest("The image doesn't match its upload");
  }
  const alt = typeof altText === "string" ? altText.trim() : "";
  if (alt.length > MAX_ALT_TEXT_LENGTH) throw badRequest(`Image description can't be longer than ${MAX_ALT_TEXT_LENGTH} characters`);

  await assertCourseExists(courseId);

  const last = await prisma.instagramFeedbackImage.findFirst({
    where: scopeWhere(courseId),
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const image = await prisma.instagramFeedbackImage.create({
    data: {
      imageUrl: url,
      publicId: id,
      altText: alt || null,
      courseId: courseId || null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
    select: imageSelect,
  });

  revalidateLandingTags([LandingTags.INSTAGRAM_FEEDBACK]);
  return image;
};

/** Saves a new order: `orderedIds` lists every image of the scope (global or one course), first to last. */
export const reorderInstagramFeedbackImagesService = async ({ orderedIds, courseId }) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.some((id) => typeof id !== "string" || !id)) {
    throw badRequest("orderedIds must list the image IDs");
  }
  if (new Set(orderedIds).size !== orderedIds.length) throw badRequest("orderedIds can't contain the same image twice");

  const images = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.instagramFeedbackImage.findMany({
      where: scopeWhere(courseId),
      orderBy: imageOrder,
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
    return transaction.instagramFeedbackImage.findMany({ where: scopeWhere(courseId), orderBy: imageOrder, select: imageSelect });
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

/** Removes a deleted course's own screenshots from Cloudinary (the rows go with the course). */
export const destroyCourseFeedbackImageFiles = (publicIds) =>
  Promise.all(
    publicIds.map((publicId) =>
      cloudinary.uploader
        .destroy(publicId, { resource_type: "image", invalidate: true })
        .catch((error) => console.error(`Cloudinary delete failed for ${publicId}:`, error)),
    ),
  );
