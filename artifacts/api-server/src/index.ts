import app from "./app";
import { logger } from "./lib/logger";
import { startWorker } from "./lib/generation";
import { bootstrapPublicDemonstration } from "./lib/public-demo-bootstrap";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    const result = await bootstrapPublicDemonstration();
    logger.info({ result }, "Public demonstration data checked");
  }
  app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startWorker();
  });
}
main().catch(error => {
  logger.error({ error: error instanceof Error ? error.message : "Unknown startup error" }, "Startup failed");
  process.exit(1);
});
