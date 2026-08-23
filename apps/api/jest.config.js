/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.(e2e-)?spec\\.ts$",
  setupFiles: ["reflect-metadata", "<rootDir>/test/setup-env.ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }] },
  moduleNameMapper: {
    "^@autocare/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
  },
  testEnvironment: "node",
  // The dev/test database is hosted Supabase (remote): per-query network latency makes multi-step
  // real-DB e2e flows exceed jest's 5s default. 30s gives headroom without masking real hangs.
  testTimeout: 30_000,
};
