import adminAuthRoutes from "#src/routes/modules/admin/auth/auth.routes.js";
import authRoutes from "#src/routes/modules/auth/auth.routes.js";
import { Router } from "express";

const routers = Router();

routers.use("/auth", authRoutes);
routers.use("/admin/auth", adminAuthRoutes);

export default routers;
