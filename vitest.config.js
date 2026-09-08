import { defineConfig } from "vitest/config";
import { availableParallelism } from "node:os";

const configuredWorkers = process.env.AI_GATEWAY_TEST_MAX_WORKERS;
if (configuredWorkers !== undefined && !/^[1-8]$/.test(configuredWorkers)) {
  throw new Error("AI_GATEWAY_TEST_MAX_WORKERS must be an integer from 1 to 8.");
}
const maxWorkers = configuredWorkers === undefined
  ? Math.max(2, Math.min(8, availableParallelism()))
  : Number(configuredWorkers);

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
