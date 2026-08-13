import { EnvConfig } from "#src/config/env.config.js";
import { processRazorpayWebhookService } from "#src/routes/modules/payment/payment.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const isValidSignature = (rawBody, receivedSignature) => {
  if (!EnvConfig.RAZORPAY_WEBHOOK_SECRET || !receivedSignature) return false;
  const expectedSignature = createHmac("sha256", EnvConfig.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedSignature, "utf8");
  const received = Buffer.from(receivedSignature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const razorpayWebhookController = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ success: false, message: "Invalid Razorpay webhook body" });
  }

  if (!isValidSignature(req.body, req.get("X-Razorpay-Signature"))) {
    return res.status(401).json({ success: false, message: "Invalid Razorpay webhook signature" });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, message: "Invalid Razorpay webhook JSON payload" });
  }

  const eventType = payload.event;
  if (!["order.paid", "payment.captured"].includes(eventType)) {
    return res.status(200).json({ success: true, message: "Razorpay event acknowledged" });
  }

  const orderEntity = payload.payload?.order?.entity;
  const paymentEntity = payload.payload?.payment?.entity;
  const orderId = orderEntity?.id ?? paymentEntity?.order_id;
  const paymentId = paymentEntity?.id;
  const amount = orderEntity?.amount ?? paymentEntity?.amount;
  const eventId = req.get("X-Razorpay-Event-Id");

  if (!eventId || !orderId) {
    return res.status(400).json({ success: false, message: "Incomplete Razorpay webhook payload" });
  }

  const result = await processRazorpayWebhookService({ eventId, eventType, orderId, paymentId, amount });
  return res.status(200).json({ success: true, message: result.duplicate ? "Webhook already processed" : "Payment processed successfully" });
});
