import { UserValidateMiddleware } from "#src/middlewares/verify-user.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import { createCourseOrderController, createPdfCourseOrderController, verifyCoursePaymentController } from "#src/routes/modules/payment/payment.controller.js";
import { Router } from "express";
import { body } from "express-validator";

const paymentRoutes = Router();
paymentRoutes.use(UserValidateMiddleware);

paymentRoutes.post("/orders", body("courseId").isUUID().withMessage("Valid course ID is required"), ValidateRequestParametersMiddleware, createCourseOrderController);
paymentRoutes.post("/pdf-orders", body("pdfCourseId").isUUID().withMessage("Valid PDF course ID is required"), ValidateRequestParametersMiddleware, createPdfCourseOrderController);
paymentRoutes.post(
  "/verify",
  body("razorpayOrderId").isString().notEmpty(),
  body("razorpayPaymentId").isString().notEmpty(),
  body("razorpaySignature").isString().notEmpty(),
  ValidateRequestParametersMiddleware,
  verifyCoursePaymentController,
);

export default paymentRoutes;
