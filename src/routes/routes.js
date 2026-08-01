import authRoutes from "#src/routes/modules/auth/auth.routes.js";
import { Router } from "express";

const routers = Router();

routers.use("/auth", authRoutes);

export default routers;
