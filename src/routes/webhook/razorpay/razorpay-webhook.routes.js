import { razorpayWebhookController } from "#src/routes/webhook/razorpay/razorpay-webhook.controller.js";
import { Router } from "express";

const razorpayWebhookRoutes = Router();
razorpayWebhookRoutes.post("/payment", razorpayWebhookController);

export default razorpayWebhookRoutes;
