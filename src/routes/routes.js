import affiliateProductsRoute from "#src/routes/modules/admin/affiliateProducts/affiliate-products.routes.js";
import adminAuthRoutes from "#src/routes/modules/admin/auth/auth.routes.js";
import pdfManager from "#src/routes/modules/admin/pdfManager/pdf-manager.routes.js";
import authRoutes from "#src/routes/modules/auth/auth.routes.js";
import { Router } from "express";

const routers = Router();

routers.use("/auth", authRoutes);
routers.use("/admin/auth", adminAuthRoutes);
routers.use("/admin/pdf-course", pdfManager);
routers.use("/admin/affiliate-product", affiliateProductsRoute);

export default routers;
