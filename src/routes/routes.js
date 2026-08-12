import affiliateProductsRoute from "#src/routes/modules/admin/affiliateProducts/affiliate-products.routes.js";
import adminAuthRoutes from "#src/routes/modules/admin/auth/auth.routes.js";
import courseRouter from "#src/routes/modules/admin/course/course.routes.js";
import pdfManager from "#src/routes/modules/admin/pdfManager/pdf-manager.routes.js";
import videoUploadRoutes from "#src/routes/modules/admin/video-uploads/video-upload.routes.js";
import authRoutes from "#src/routes/modules/auth/auth.routes.js";
import courseRoutes from "#src/routes/modules/course/course.routes.js";
import { Router } from "express";

const routers = Router();

routers.use("/auth", authRoutes);
routers.use("/courses", courseRoutes);
routers.use("/admin/auth", adminAuthRoutes);
routers.use("/admin/pdf-course", pdfManager);
routers.use("/admin/affiliate-product", affiliateProductsRoute);
routers.use("/admin/uploads/videos", videoUploadRoutes);
routers.use("/admin/course", courseRouter);

export default routers;
