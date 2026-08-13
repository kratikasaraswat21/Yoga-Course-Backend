import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";

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

export const updateYogaCourseDetailsService = async (
  courseId,
  { title, description, price, discount, totalPayableAmount, thumbnailUrl, thumbnailId, status },
) => {
  return await prisma.yogaCourse.update({
    where: {
      id: courseId,
    },
    data: {
      title,
      description,
      status,
      price,
      discount,
      totalPayableAmount,
      thumbnailUrl,
      thumbnailId,
    },
  });
};

export const getYogaCourseDetailsService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({
    where: {
      id: courseId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      thumbnailUrl: true,
      thumbnailId: true,
      createdAt: true,
      updatedAt: true,
      courseVideos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          originalFileName: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          status: true,
          durationSeconds: true,
          fileSize: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  return {
    ...course,
    courseVideos: course.courseVideos.map((video) => ({
      id: video.id,
      originalName: video.originalFileName,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      status: video.status,
      durationSeconds: video.durationSeconds,
      fileSize: video.fileSize.toString(),
      sortOrder: video.sortOrder,
    })),
  };
};

export const getYogaCourseStepOneService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({
    where: {
      id: courseId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      thumbnailUrl: true,
      thumbnailId: true,
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  return {
    courseId: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    price: Number(course.price),
    discountPercentage: course.discount,
    totalPayableAmount: Number(course.totalPayableAmount),
    thumbnailURL: course.thumbnailUrl,
    thumbnailId: course.thumbnailId,
  };
};

export const publishYogaCourseService = async (courseId) => {
  return prisma.$transaction(async (transaction) => {
    const course = await transaction.yogaCourse.findUnique({
      where: {
        id: courseId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        courseVideos: {
          select: {
            status: true,
            readyToStream: true,
          },
        },
      },
    });

    if (!course) {
      return {
        success: false,
        statusCode: 404,
        message: ERROR_MESSAGES.COURSE_NOT_FOUND,
      };
    }

    if (course.courseVideos.length === 0) {
      return {
        success: false,
        statusCode: 400,
        message: ERROR_MESSAGES.COURSE_HAS_NO_VIDEOS,
      };
    }

    const allVideosReady = course.courseVideos.every(
      (video) => video.status === "READY" && video.readyToStream === true,
    );

    if (!allVideosReady) {
      return {
        success: false,
        statusCode: 400,
        message: ERROR_MESSAGES.COURSE_VIDEOS_NOT_READY,
      };
    }

    const publishedCourse = await transaction.yogaCourse.update({
      where: {
        id: courseId,
      },
      data: {
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    return {
      success: true,
      course: publishedCourse,
    };
  });
};

export const fetchAllYogaCoursesService = async () => {
  const courses = await prisma.yogaCourse.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      thumbnailUrl: true,
      thumbnailId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          courseVideos: true,
        },
      },
    },
  });

  return courses.map(({ _count, ...course }) => ({
    ...course,
    videoCount: _count.courseVideos,
  }));
};
