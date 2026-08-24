import { defineConfig } from "vitest/config";
import { availableParallelism } from "node:os";

const maxWorkers = Math.max(2, Math.min(8, availableParallelism()));

export default defineConfig({
  test: {
    include: [
      "packages/**/src/**/*.test.{js,mjs,ts,mts}",
      "apps/**/src/**/*.test.{js,mjs,ts,mts}",
    ],
    testTimeout: 15000,
    hookTimeout: 10000,
    maxWorkers,
  },
});
