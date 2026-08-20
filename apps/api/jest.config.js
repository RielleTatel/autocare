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
};
