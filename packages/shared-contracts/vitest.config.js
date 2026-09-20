import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{js,mjs,ts,mts}"],
    testTimeout: 15000,
    hookTimeout: 10000,
  },
});
