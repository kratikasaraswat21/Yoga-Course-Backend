import { prisma } from "#src/lib/prisma.js";

export const updateYogaCourseVideoDetails = async (video_id, data) => {
  await prisma.CourseVideo.update({
    where: {
      id: video_id,
    },
    data: data,
  });
};
