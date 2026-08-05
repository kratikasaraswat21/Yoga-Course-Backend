import adminAuthRoutes from "#src/routes/modules/admin/auth/auth.routes.js";
import pdfManager from "#src/routes/modules/admin/pdfManager/pdf-manager.routes.js";
import authRoutes from "#src/routes/modules/auth/auth.routes.js";
import { Router } from "express";

const routers = Router();

routers.use("/auth", authRoutes);
routers.use("/admin/auth", adminAuthRoutes);
routers.use("/admin/pdf-course", pdfManager);

export default routers;
