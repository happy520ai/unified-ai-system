import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.js", "apps/**/src/**/*.test.js"],
    testTimeout: 15000,
    hookTimeout: 10000,
  },
});
