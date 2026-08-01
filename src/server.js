import { EnvConfig } from "#src/config/env.config.js";
import app from "#src/index.js";

const server = app.listen(EnvConfig.PORT, () => {
  console.log(`Server Started On Port ${EnvConfig.PORT}`);
});

const ShutDown = (signal) => {
  console.log(`${signal} received. Closing server...`);

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => ShutDown("SIGTERM"));
process.on("SIGINT", () => ShutDown("SIGINT"));
