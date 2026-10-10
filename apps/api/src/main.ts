import "reflect-metadata";
import "./common/bigint-serializer";
import { config } from "dotenv";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { loadEnv } from "./config/env";

// Local development starts the API from the monorepo root, so load the API
// env file explicitly instead of relying on the current working directory.
config({ path: join(__dirname, "..", ".env") });

async function bootstrap() {
  const env = loadEnv();
  // Queue configuration reads process.env at module import time. Load .env first so
  // BullMQ uses the configured Redis service instead of defaulting to localhost.
  const { AppModule } = await import("./app.module");
  // rawBody: true makes Nest's body-parser middleware stash the original request Buffer on
  // `req.rawBody` for every request, IN ADDITION TO the normally JSON-parsed `req.body` — it
  // does not disable JSON parsing globally. This is required by the PayMongo webhook controller
  // (payments.webhook.controller.ts), which needs the exact raw bytes to verify the HMAC
  // signature; every other route is unaffected (they only ever read req.body, never rawBody).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix("api/v1");
  const port = env.PORT ?? env.API_PORT;
  await app.listen(port, "0.0.0.0");
  Logger.log(`API listening on 0.0.0.0:${port}`, "Bootstrap");
}

void bootstrap();
