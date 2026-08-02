import { EnvConfig } from "#src/config/env.config.js";
import { VerifyEmailTransportConnectionService } from "#src/email/email.service.js";
import app from "#src/index.js";
import { prisma } from "#src/lib/prisma.js";
import { AdminSeedFunction } from "#src/lib/seed-script.js";

let server;

const ShutDown = (signal) => {
  console.log(`${signal} received. Closing server...`);

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

const startServer = async () => {
  try {
    await AdminSeedFunction();

    server = app.listen(EnvConfig.PORT, () => {
      console.log(`Server Started On Port ${EnvConfig.PORT}`);
    });

    VerifyEmailTransportConnectionService();
  } catch (error) {
    console.error("Admin seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();

process.on("SIGTERM", () => ShutDown("SIGTERM"));
process.on("SIGINT", () => ShutDown("SIGINT"));
