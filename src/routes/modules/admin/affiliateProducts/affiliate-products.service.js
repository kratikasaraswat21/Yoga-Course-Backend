import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: EnvConfig.CLOUDINARY_CLOUD_NAME,
  api_key: EnvConfig.CLOUDINARY_API_KEY,
  api_secret: EnvConfig.CLOUDINARY_API_SECRET,
});

export const signAffiliateFileService = (pdfFolder, timestamp) => {
  const pdfSignature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: pdfFolder,
    },
    EnvConfig.CLOUDINARY_API_SECRET,
  );

  return pdfSignature;
};

export const addAffiliateProductService = async (data) => {
  const lastResource = await prisma.AffiliateProducts.findFirst({
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  return prisma.AffiliateProducts.create({
    data: {
      ...data,
      sortOrder: (lastResource?.sortOrder ?? 0) + 1,
    },
  });
};

export const editAffiliateProductService = async (data, course_id) => {
  return prisma.AffiliateProducts.update({
    where: { id: course_id },
    data: data,
  });
};

export const deleteAffiliateProductService = async (course_id) => {
  return prisma.AffiliateProducts.delete({ where: { id: course_id } });
};

export const fetchAffiliateProductsService = async () => {
  return prisma.AffiliateProducts.findMany({
    orderBy: {
      sortOrder: "asc",
    },
  });
};

export const fetchPublishedAffiliateProductsService = async () => {
  return prisma.AffiliateProducts.findMany({
    where: { status: CourseStatus.PUBLISHED },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      productsLink: true,
      buttonTitle: true,
      thumbnailUrl: true,
      sortOrder: true,
      createdAt: true,
    },
  });
};

export const reorderAffiliateProductsService = async ({ productId, orderedIds }) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    const error = new Error("orderedIds must be a non-empty array.");
    error.statusCode = 400;
    throw error;
  }

  if (orderedIds.some((id) => typeof id !== "string" || id.length === 0)) {
    const error = new Error("orderedIds must contain valid affiliate product IDs.");
    error.statusCode = 400;
    throw error;
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    const error = new Error("orderedIds must not contain duplicate affiliate product IDs.");
    error.statusCode = 400;
    throw error;
  }

  if (productId && !orderedIds.includes(productId)) {
    const error = new Error("productId must be included in orderedIds.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (transaction) => {
    const products = await transaction.AffiliateProducts.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const existingIds = new Set(products.map(({ id }) => id));
    const missingIds = orderedIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      const error = new Error(`The following affiliate products were not found: ${missingIds.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }

    const orderedIdSet = new Set(orderedIds);
    const remainingIds = products.map(({ id }) => id).filter((id) => !orderedIdSet.has(id));
    const completeOrder = [...orderedIds, ...remainingIds];

    await Promise.all(
      completeOrder.map((id, index) =>
        transaction.AffiliateProducts.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    return transaction.AffiliateProducts.findMany({
      orderBy: { sortOrder: "asc" },
    });
  });
};
