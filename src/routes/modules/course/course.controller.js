import {
  getPublishedCourseDetailsService,
  getPublishedCoursesService,
  getPublishedCourseVideosService,
  getCourseVideoPlaybackService,
  getOtherCourseVideosService,
  getPurchasedCoursesService,
} from "#src/routes/modules/course/course.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

export const getPublishedCoursesController = asyncHandler(async (req, res) => {
  const courses = await getPublishedCoursesService();

  return res.status(200).json({
    success: true,
    message: "Courses fetched successfully",
    data: {
      courses,
    },
  });
});

export const getPurchasedCoursesController = asyncHandler(async (req, res) => {
  const courses = await getPurchasedCoursesService(req.user.id);
  return res.status(200).json({ success: true, message: "Purchased courses fetched successfully", data: { courses } });
});

export const getPublishedCourseDetailsController = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const course = await getPublishedCourseDetailsService(courseId, req.user?.id);

  return res.status(200).json({
    success: true,
    message: "Course details fetched successfully",
    data: {
      course,
    },
  });
});

export const getPublishedCourseVideosController = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const course = await getPublishedCourseVideosService(courseId, req.user?.id);

  return res.status(200).json({
    success: true,
    message: "Course videos fetched successfully",
    data: {
      course,
    },
  });
});

export const getCourseVideoPlaybackController = asyncHandler(async (req, res) => {
  const { courseId, videoId } = req.params;
  const playback = await getCourseVideoPlaybackService({ courseId, videoId, userId: req.user.id });

  return res.status(200).json({
    success: true,
    message: "Video playback URL generated successfully",
    data: {
      playback,
    },
  });
});

export const getOtherCourseVideosController = asyncHandler(async (req, res) => {
  const { courseId, videoId } = req.params;
  const course = await getOtherCourseVideosService({ courseId, videoId, userId: req.user?.id });

  return res.status(200).json({
    success: true,
    message: "Other course videos fetched successfully",
    data: {
      course,
    },
  });
});
