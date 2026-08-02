import routers from "#src/routes/routes.js";
import { errorHandler } from "#src/utils/async-handler.util.js";
import cors from "cors";
import "dotenv";
import express from "express";
import helmet from "helmet";
const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Yoga course API is running",
  });
});
app.use("/app/api/v1", routers);
app.use(errorHandler);

export default app;
