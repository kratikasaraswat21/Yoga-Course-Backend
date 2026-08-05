import { EnvConfig } from "#src/config/env.config.js";
import { prisma } from "#src/lib/prisma.js";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: EnvConfig.CLOUDINARY_CLOUD_NAME,
  api_key: EnvConfig.CLOUDINARY_API_KEY,
  api_secret: EnvConfig.CLOUDINARY_API_SECRET,
});

export const signPdfFileService = (pdfFolder, timestamp) => {
  const pdfSignature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: pdfFolder,
    },
    EnvConfig.CLOUDINARY_API_SECRET,
  );

  console.log(pdfSignature);

  return pdfSignature;
};

export const signPdfCourseThumbnailService = (thumbnailFolder, timestamp) => {
  const thumbnailSignature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: thumbnailFolder,
    },
    EnvConfig.CLOUDINARY_API_SECRET,
  );

  return thumbnailSignature;
};

export const addPdfCourseService = async (data) => {
  const lastResource = await prisma.pdfCourseResource.findFirst({
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  return prisma.pdfCourseResource.create({
    data: {
      ...data,
      sortOrder: (lastResource?.sortOrder ?? 0) + 1,
    },
  });
};

export const editPdfCourseService = async (data, course_id) => {
  const lastResource = await prisma.pdfCourseResource.update({
    where: { id: course_id },
    data: data,
  });
};

export const fetchPdfCourse = async () => {
  return prisma.pdfCourseResource.findMany({
    orderBy: {
      sortOrder: "asc",
    },
  });
};

export const deletePdfCourseService = async (course_id) => {
  return prisma.pdfCourseResource.delete({
    where: {
      id: course_id,
    },
  });
};

export const reorderPdfCoursesService = async ({ courseId, orderedIds }) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    const error = new Error("orderedIds must be a non-empty array.");
    error.statusCode = 400;
    throw error;
  }

  if (orderedIds.some((id) => typeof id !== "string" || id.length === 0)) {
    const error = new Error("orderedIds must contain valid course IDs.");
    error.statusCode = 400;
    throw error;
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    const error = new Error("orderedIds must not contain duplicate course IDs.");
    error.statusCode = 400;
    throw error;
  }

  if (courseId && !orderedIds.includes(courseId)) {
    const error = new Error("courseId must be included in orderedIds.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (transaction) => {
    const courses = await transaction.pdfCourseResource.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const existingIds = new Set(courses.map(({ id }) => id));
    const missingIds = orderedIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      const error = new Error(`The following PDF courses were not found: ${missingIds.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }

    const orderedIdSet = new Set(orderedIds);
    const remainingIds = courses.map(({ id }) => id).filter((id) => !orderedIdSet.has(id));
    const completeOrder = [...orderedIds, ...remainingIds];

    await Promise.all(
      completeOrder.map((id, index) =>
        transaction.pdfCourseResource.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    return transaction.pdfCourseResource.findMany({
      orderBy: { sortOrder: "asc" },
    });
  });
};
