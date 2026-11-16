/** Deterministic payment checks: no Redis, hosted database, provider network, or global fixtures. */
const base = require("./jest.config.js");
module.exports = {
  ...base,
  globalSetup: undefined,
  setupFiles: ["reflect-metadata", "<rootDir>/src/common/bigint-serializer.ts"],
  testRegex: "src/(common/idempotency|modules/(payments|invoices|subscriptions))/.*\\.spec\\.ts$",
};
