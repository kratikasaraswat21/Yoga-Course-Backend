import { EnvConfig } from "#src/config/env.config.js";

export const LandingTags = Object.freeze({
  COURSES: "courses",
  REVIEWS: "landing-reviews",
  INSTAGRAM_FEEDBACK: "instagram-feedback",
  course: (courseId) => `course:${courseId}`,
});

let hasWarnedAboutMissingConfig = false;

/**
 * Asks the public website to rebuild its cached pages for these tags.
 * Fire-and-forget: a failure is logged but never fails the admin request that triggered it.
 */
export const revalidateLandingTags = (tags) => {
  const uniqueTags = [...new Set(tags.filter(Boolean))];
  if (uniqueTags.length === 0) return;

  if (!EnvConfig.LANDING_SITE_URL || !EnvConfig.LANDING_REVALIDATE_SECRET) {
    if (!hasWarnedAboutMissingConfig) {
      console.warn("Landing page revalidation skipped: LANDING_SITE_URL or LANDING_REVALIDATE_SECRET is not set");
      hasWarnedAboutMissingConfig = true;
    }
    return;
  }

  fetch(`${EnvConfig.LANDING_SITE_URL}/api/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-secret": EnvConfig.LANDING_REVALIDATE_SECRET,
    },
    body: JSON.stringify({ tags: uniqueTags }),
    signal: AbortSignal.timeout(10_000),
  })
    .then(async (response) => {
      if (!response.ok) {
        console.error("Landing page revalidation failed:", response.status, await response.text().catch(() => ""));
      }
    })
    .catch((error) => console.error("Landing page revalidation failed:", error.message));
};

export const revalidateCoursePages = (courseId) =>
  revalidateLandingTags([LandingTags.COURSES, courseId ? LandingTags.course(courseId) : null]);
