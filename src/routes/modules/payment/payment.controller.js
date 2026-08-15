import { createCourseOrderService, createPdfCourseOrderService, verifyCoursePaymentService } from "#src/routes/modules/payment/payment.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

export const createCourseOrderController = asyncHandler(async (req, res) => {
  const order = await createCourseOrderService({ userId: req.user.id, courseId: req.body.courseId });
  return res.status(201).json({ success: true, message: "Payment order created successfully", data: { order } });
});

export const createPdfCourseOrderController = asyncHandler(async (req, res) => {
  const order = await createPdfCourseOrderService({ userId: req.user.id, pdfCourseId: req.body.pdfCourseId });
  return res.status(201).json({ success: true, message: "PDF course payment order created successfully", data: { order } });
});

export const verifyCoursePaymentController = asyncHandler(async (req, res) => {
  const payment = await verifyCoursePaymentService({ userId: req.user.id, ...req.body });
  return res.status(200).json({ success: true, message: "Payment verified successfully", data: { payment } });
});
