-- Add metadata returned by Cloudflare Stream webhooks.
ALTER TABLE "course_videos"
ADD COLUMN "width" INTEGER,
ADD COLUMN "height" INTEGER,
ADD COLUMN "hlsUrl" TEXT,
ADD COLUMN "dashUrl" TEXT;
