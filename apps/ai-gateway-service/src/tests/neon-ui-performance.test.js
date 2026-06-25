/**
 * Performance Test — Neon UI Enhancement
 * Tests that CSS is optimized and doesn't cause performance issues
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const stylesDir = resolve(moduleDir, "../ui/future-minimal-os/styles");

function readCss(filename) {
  return readFileSync(resolve(stylesDir, filename), "utf8");
}

describe("Performance", () => {
  describe("CSS File Sizes", () => {
    it("tokens CSS should be under 5KB", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.length).toBeLessThan(5 * 1024);
    });

    it("enhanced CSS should be under 15KB", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.length).toBeLessThan(15 * 1024);
    });

    it("console CSS should be under 10KB", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css.length).toBeLessThan(10 * 1024);
    });
  });

  describe("CSS Optimization", () => {
    it("should not have redundant selectors", () => {
      const css = readCss("futureMinimalEnhanced.css");
      // Check for common redundant patterns
      assert.ok(css).not.toMatch(/\*\s*\{/); // Universal selector
    });

    it("should use CSS variables for colors", () => {
      const css = readCss("futureMinimalTokens.css");
      // Should have CSS variables defined
      assert.ok(css).includes("--future-");
    });

    it("should have reduced motion support", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("prefers-reduced-motion");
    });
  });

  describe("Animation Performance", () => {
    it("should use transform for animations", () => {
      const css = readCss("futureMinimalEnhanced.css");
      // Should use transform for better performance
      assert.ok(css).includes("transform: translateY");
    });

    it("should use opacity for animations", () => {
      const css = readCss("futureMinimalTokens.css");
      // Should use opacity for better performance
      assert.ok(css).includes("opacity");
    });

    it("should not animate layout properties", () => {
      const css = readCss("futureMinimalEnhanced.css");
      // Should not animate width, height, top, left, etc.
      const layoutProperties = ["width:", "height:", "top:", "left:", "right:", "bottom:"];
      for (const prop of layoutProperties) {
        // Allow in keyframes but not in transitions
        const lines = css.split("\n");
        for (const line of lines) {
          if (line.includes("transition") && line.includes(prop)) {
            expect.fail(`Should not animate layout property: ${prop}`);
          }
        }
      }
    });
  });

  describe("Backdrop Filter Performance", () => {
    it("should have reasonable blur values", () => {
      const css = readCss("futureMinimalTokens.css");
      // Blur values should be reasonable (not too high)
      const blurMatch = css.match(/--future-glass-blur:\s*(\d+)px/);
      if (blurMatch) {
        const blurValue = parseInt(blurMatch[1]);
        assert.ok(blurValue).toBeLessThanOrEqual(30);
      }
    });

    it("should have reduced motion fallback", () => {
      const css = readCss("futureMinimalTokens.css");
      // Should have reduced motion fallback for backdrop-filter
      assert.ok(css).includes("prefers-reduced-motion: reduce");
    });
  });
});
