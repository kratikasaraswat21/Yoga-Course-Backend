import { EnvConfig } from "#src/config/env.config.js";
import app from "#src/index.js";
import { prisma } from "#src/lib/prisma.js";
import { AdminSeedFunction } from "#src/lib/seed-script.js";

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

AdminSeedFunction()
  .catch((error) => {
    console.error("Admin seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

process.on("SIGTERM", () => ShutDown("SIGTERM"));
process.on("SIGINT", () => ShutDown("SIGINT"));
