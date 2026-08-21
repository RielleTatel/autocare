import "reflect-metadata";
import "./common/bigint-serializer";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";

async function bootstrap() {
  const env = loadEnv();
  // rawBody: true makes Nest's body-parser middleware stash the original request Buffer on
  // `req.rawBody` for every request, IN ADDITION TO the normally JSON-parsed `req.body` — it
  // does not disable JSON parsing globally. This is required by the PayMongo webhook controller
  // (payments.webhook.controller.ts), which needs the exact raw bytes to verify the HMAC
  // signature; every other route is unaffected (they only ever read req.body, never rawBody).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix("api/v1");
  await app.listen(env.API_PORT);
}

void bootstrap();
