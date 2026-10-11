// Video groups (e.g. "Week 1"). The course-wide CourseVideo.sortOrder stays the single order of all
// videos, so "next video" logic works with or without groups; groups only add headings.

export const videoGroupSelect = {
  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  select: { id: true, title: true, description: true, sortOrder: true },
};

export const OTHER_VIDEOS_GROUP_TITLE = "Other videos";

/**
 * Builds `[{ id, title, description, videoCount, totalDurationSeconds, videos }]` in group order.
 * Videos without a group go into a final "Other videos" group (id null). Returns [] when the course
 * has no groups, so clients show the flat list exactly as before. Groups with no visible videos are
 * left out unless `includeEmpty` is set (the admin panel shows empty groups).
 */
export const groupCourseVideos = (videos, groups, { includeEmpty = false } = {}) => {
  if (!groups || groups.length === 0) return [];

  const buckets = new Map(groups.map((group) => [group.id, []]));
  const ungrouped = [];
  videos.forEach((video) => {
    const bucket = video.groupId ? buckets.get(video.groupId) : undefined;
    (bucket ?? ungrouped).push(video);
  });

  const summarize = (id, title, description, groupVideos) => ({
    id,
    title,
    description: description ?? null,
    videoCount: groupVideos.length,
    totalDurationSeconds: groupVideos.reduce((total, video) => total + (Number(video.durationSeconds) || 0), 0),
    videos: groupVideos,
  });

  const result = groups
    .map((group) => summarize(group.id, group.title, group.description, buckets.get(group.id)))
    .filter((group) => includeEmpty || group.videoCount > 0);

  if (ungrouped.length > 0) result.push(summarize(null, OTHER_VIDEOS_GROUP_TITLE, null, ungrouped));
  return result;
};
