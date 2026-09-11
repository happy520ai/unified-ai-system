import { defineConfig } from "vitest/config";

// Package-local include so `vitest run` inside this package resolves tests
// relative to the package root; the repository-level vitest config keeps
// covering the same files for repo-wide runs.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{js,mjs,ts,mts}"],
    timeout: 15_000,
  },
});
