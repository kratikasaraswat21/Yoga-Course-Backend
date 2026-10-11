import { prisma } from "#src/lib/prisma.js";
import { updateYogaCourseVideoDetails } from "#src/routes/webhook/streams/stream.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { revalidateCoursePages } from "#src/utils/landing-revalidate.util.js";
import crypto from "node:crypto";

export const verifyCloudflareStreamWebhook = ({ rawBody, signatureHeader, webhookSecret }) => {
  try {
    const signatureValues = Object.fromEntries(
      signatureHeader.split(",").map((value) => {
        const [key, signatureValue] = value.trim().split("=");

        return [key, signatureValue];
      }),
    );

    const timestamp = signatureValues.time;
    const receivedSignature = signatureValues.sig1;

    if (!timestamp || !receivedSignature) {
      return false;
    }

    const timestampNumber = Number(timestamp);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Reject requests older than five minutes
    if (!Number.isFinite(timestampNumber) || Math.abs(currentTimestamp - timestampNumber) > 5 * 60) {
      return false;
    }

    /*
     * Cloudflare signs:
     * timestamp + "." + exact raw request body
     */
    const signaturePayload = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]);

    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(signaturePayload).digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    const receivedBuffer = Buffer.from(receivedSignature, "hex");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
};

export const cloudflareStreamWebhookController = asyncHandler(async (req, res) => {
  const signatureHeader = req.get("Webhook-Signature");

  const webhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;

  if (!signatureHeader || !webhookSecret) {
    return res.status(401).json({
      success: false,
      message: "Cloudflare webhook signature is missing",
    });
  }

  /*
   * Because this route uses express.raw(),
   * req.body should be a Buffer.
   */
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid Cloudflare webhook body",
    });
  }

  const rawBody = req.body;

  const isValidWebhook = verifyCloudflareStreamWebhook({
    rawBody,
    signatureHeader,
    webhookSecret,
  });

  if (!isValidWebhook) {
    return res.status(401).json({
      success: false,
      message: "Invalid Cloudflare webhook signature",
    });
  }

  let payload;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid webhook JSON payload",
    });
  }

  if (!payload.uid || !payload.status?.state) {
    return res.status(400).json({
      success: false,
      message: "Incomplete Cloudflare webhook payload",
    });
  }

  console.log("Complete Payload Data", payload);

  const video = await prisma.CourseVideo.findUnique({
    where: {
      cloudflareVideoUid: payload.uid,
    },
  });

  // Not a lesson video: it may be a course trailer (public video on the landing page).
  if (!video) {
    const trailer = await prisma.courseLandingContent.findUnique({
      where: { trailerVideoUid: payload.uid },
      select: { courseId: true },
    });

    if (trailer) {
      const isTrailerReady = payload.readyToStream === true && payload.status.state === "ready";
      const isTrailerFailed = payload.status.state === "error";

      if (isTrailerReady || isTrailerFailed) {
        await prisma.courseLandingContent.update({
          where: { courseId: trailer.courseId },
          data: isTrailerReady
            ? {
                trailerStatus: "READY",
                trailerHlsUrl: payload.playback?.hls ?? null,
                trailerThumbnailUrl: payload.thumbnail ?? null,
                trailerDurationSeconds: payload.duration ?? null,
              }
            : { trailerStatus: "ERROR" },
        });
        revalidateCoursePages(trailer.courseId);
      } else {
        await prisma.courseLandingContent.update({
          where: { courseId: trailer.courseId },
          data: { trailerStatus: "PROCESSING" },
        });
      }

      return res.status(200).json({ success: true, message: "Trailer webhook processed successfully" });
    }
  }

  /*
   * The video may already have been deleted locally.
   * Acknowledge the webhook instead of repeatedly failing.
   */
  if (!video) {
    return res.status(200).json({
      success: true,
      message: "Video not found; webhook acknowledged",
    });
  }

  const processingPercentage = Number(payload.status.pctComplete ?? 0);

  const isReady = payload.readyToStream === true && payload.status.state === "ready";

  const isFailed = payload.status.state === "error";

  if (isReady) {
    await updateYogaCourseVideoDetails(video.id, {
      status: "READY",
      readyToStream: true,
      processingPercentage: 100,
      durationSeconds: payload.duration ?? null,
      width: payload.input?.width ?? null,
      height: payload.input?.height ?? null,
      /*
       * Keep the custom thumbnail when one already exists.
       */
      thumbnailUrl: !video.isCustomThumbnail ? payload.thumbnail : video.thumbnailUrl,

      hlsUrl: payload.playback?.hls ?? null,
      dashUrl: payload.playback?.dash ?? null,

      errorCode: null,
      errorMessage: null,
    });
    revalidateCoursePages(video.yogaCourseId);
  } else if (isFailed) {
    await updateYogaCourseVideoDetails(video.id, {
      status: "ERROR",
      readyToStream: false,
      processingPercentage,
      errorCode: payload.status.errorReasonCode ?? payload.status.errReasonCode ?? "UNKNOWN_ERROR",
      errorMessage:
        payload.status.errorReasonText ?? payload.status.errReasonText ?? "Cloudflare could not process the video",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Cloudflare webhook processed successfully",
  });
});
