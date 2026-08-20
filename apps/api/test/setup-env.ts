// Loads apps/api/.env for jest runs so e2e/unit tests get DATABASE_URL, REDIS_URL,
// FIREBASE_* and POLICY_VERSION without threading env through the invocation.
// dotenv does not override variables already present in process.env, so CI (which
// sets them via the workflow env block) is unaffected.
import { config } from "dotenv";
import { join } from "path";

config({ path: join(__dirname, "..", ".env"), quiet: true });
