import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/engine.ts", "src/explain.ts"],
      thresholds: { branches: 100 },
    },
  },
});
