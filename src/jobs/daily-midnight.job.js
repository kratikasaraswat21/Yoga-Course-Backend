import cron from "node-cron";

import { prisma } from "#src/lib/prisma.js";
import {
  retryPendingPurchaseEmailsService,
  sendCourseLiveEmailsService,
} from "#src/routes/modules/course/course-notification.service.js";
import { addDaysToIstDate, getIstDayRange, getIstToday } from "#src/utils/ist-date.util.js";
import { LandingTags, revalidateLandingTags } from "#src/utils/landing-revalidate.util.js";

/**
 * Every schedule boundary (prelaunch start, prelaunch end, video release) happens at exactly 00:00 IST.
 * This job runs just after midnight and refreshes the public pages of every course with a boundary
 * in the given day range, so prices, banners and curriculum locks switch without an admin action.
 * It then sends "your course is live" emails to prelaunch buyers and retries failed purchase emails.
 */
export const runDailyMidnightJob = async ({ fromDate = getIstToday(), days = 1 } = {}) => {
  const { start } = getIstDayRange(fromDate);
  const { start: end } = getIstDayRange(addDaysToIstDate(fromDate, days));

  const [prelaunchCourses, releasedVideos] = await Promise.all([
    prisma.yogaCourse.findMany({
      where: {
        prelaunchEnabled: true,
        OR: [
          { prelaunchStartAt: { gte: start, lt: end } },
          { prelaunchEndAt: { gte: start, lt: end } },
        ],
      },
      select: { id: true },
    }),
    prisma.courseVideo.findMany({
      where: { releaseAt: { gte: start, lt: end } },
      select: { yogaCourseId: true },
      distinct: ["yogaCourseId"],
    }),
  ]);

  const courseIds = [
    ...new Set([...prelaunchCourses.map(({ id }) => id), ...releasedVideos.map(({ yogaCourseId }) => yogaCourseId)]),
  ];

  if (courseIds.length > 0) {
    revalidateLandingTags([LandingTags.COURSES, ...courseIds.map((courseId) => LandingTags.course(courseId))]);
  }

  const lastDate = addDaysToIstDate(fromDate, days - 1);
  console.log(
    `Daily midnight job: refreshed ${courseIds.length} course page(s) for ${fromDate}${days > 1 ? ` to ${lastDate}` : ""}`,
  );

  // Emails run after the page refresh, and a failure here doesn't undo it.
  const liveEmails = await sendCourseLiveEmailsService();
  const purchaseEmails = await retryPendingPurchaseEmailsService();
  console.log(
    `Daily midnight job: sent ${liveEmails.sent}/${liveEmails.pending} "course is live" email(s), retried ${purchaseEmails.sent}/${purchaseEmails.pending} purchase email(s)`,
  );

  return { courseIds, liveEmails, purchaseEmails };
};

export const scheduleDailyMidnightJob = () => {
  const task = cron.schedule(
    "1 0 * * *",
    async () => {
      try {
        await runDailyMidnightJob();
      } catch (error) {
        console.error("Daily midnight job failed:", error);
      }
    },
    { timezone: "Asia/Kolkata", name: "daily-midnight-job", noOverlap: true },
  );

  // Catch up once on start in case the server was down at midnight (yesterday and today).
  runDailyMidnightJob({ fromDate: addDaysToIstDate(getIstToday(), -1), days: 2 }).catch((error) =>
    console.error("Daily midnight job catch-up failed:", error),
  );

  return task;
};
