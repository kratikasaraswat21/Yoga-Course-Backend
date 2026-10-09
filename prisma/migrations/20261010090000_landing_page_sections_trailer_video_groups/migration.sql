-- Landing page redesign (all sections editable), course trailer, and video groups (weeks).

-- 1. Landing content moves into one JSON column. Copy what was saved in the old columns first.
ALTER TABLE "course_landing_contents" ADD COLUMN "content" JSONB NOT NULL DEFAULT '{}';

UPDATE "course_landing_contents"
SET "content" = jsonb_build_object(
  'announcement', jsonb_build_object('prelaunch', COALESCE("bannerText", ''), 'live', COALESCE("bannerText", '')),
  'hero', jsonb_build_object(
    'subtitle', COALESCE("tagline", ''),
    'coverImageUrl', COALESCE("heroImageUrl", ''),
    'coverImageId', COALESCE("heroImageId", '')
  ),
  'stats', COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('icon', '', 'title', item->>'title', 'text', COALESCE(item->>'description', '')))
     FROM jsonb_array_elements("highlights") AS item),
    '[]'::jsonb
  ),
  'benefits', jsonb_build_object('items', "learningOutcomes"),
  'faq', jsonb_build_object('items', "faqs")
);

ALTER TABLE "course_landing_contents"
DROP COLUMN "bannerText",
DROP COLUMN "faqs",
DROP COLUMN "heroImageId",
DROP COLUMN "heroImageUrl",
DROP COLUMN "highlights",
DROP COLUMN "learningOutcomes",
DROP COLUMN "tagline",
DROP COLUMN "targetAudience",
ADD COLUMN     "trailerDurationSeconds" DOUBLE PRECISION,
ADD COLUMN     "trailerFileName" TEXT,
ADD COLUMN     "trailerHlsUrl" TEXT,
ADD COLUMN     "trailerPosterId" TEXT,
ADD COLUMN     "trailerPosterUrl" TEXT,
ADD COLUMN     "trailerStatus" "VideoStatus",
ADD COLUMN     "trailerThumbnailUrl" TEXT,
ADD COLUMN     "trailerVideoUid" TEXT;

-- 2. Video groups (weeks).
ALTER TABLE "course_videos" ADD COLUMN     "groupId" TEXT;

CREATE TABLE "course_video_groups" (
    "id" TEXT NOT NULL,
    "yogaCourseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_video_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_video_groups_yogaCourseId_sortOrder_idx" ON "course_video_groups"("yogaCourseId", "sortOrder");

CREATE UNIQUE INDEX "course_landing_contents_trailerVideoUid_key" ON "course_landing_contents"("trailerVideoUid");

CREATE INDEX "course_videos_groupId_idx" ON "course_videos"("groupId");

ALTER TABLE "course_videos" ADD CONSTRAINT "course_videos_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "course_video_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "course_video_groups" ADD CONSTRAINT "course_video_groups_yogaCourseId_fkey" FOREIGN KEY ("yogaCourseId") REFERENCES "yoga_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
