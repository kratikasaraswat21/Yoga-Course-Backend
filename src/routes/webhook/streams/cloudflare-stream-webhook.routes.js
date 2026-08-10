import { cloudflareStreamWebhookController } from "#src/routes/webhook/streams/stream.controller.js";
import { Router } from "express";

const cloudflareStreamWebhookRoutes = Router();

cloudflareStreamWebhookRoutes.post("/stream", cloudflareStreamWebhookController);

export default cloudflareStreamWebhookRoutes;
