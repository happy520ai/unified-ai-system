import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/src/**/*.test.{js,mjs,ts,mts}",
      "apps/**/src/**/*.test.{js,mjs,ts,mts}",
    ],
    testTimeout: 15000,
    hookTimeout: 10000,
  },
});
