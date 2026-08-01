import routers from "#src/routes/routes.js";
import cors from "cors";
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

export default app;
