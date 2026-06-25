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
      assert.ok(css.length < 5 * 1024, `tokens CSS size ${css.length} should be under 5KB`);
    });

    it("enhanced CSS should be under 15KB", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.length < 15 * 1024, `enhanced CSS size ${css.length} should be under 15KB`);
    });

    it("console CSS should be under 10KB", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css.length < 10 * 1024, `console CSS size ${css.length} should be under 10KB`);
    });
  });

  describe("CSS Optimization", () => {
    it("should not have redundant selectors", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(!css.match(/\*\s*\{/), "CSS should not contain universal selector * { }");
    });

    it("should use CSS variables for colors", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-"), "CSS should contain --future- variables");
    });

    it("should have reduced motion support", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("prefers-reduced-motion"), "CSS should contain prefers-reduced-motion");
    });
  });

  describe("Animation Performance", () => {
    it("should use transform for animations", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes("transform: translateY"), "CSS should use transform: translateY for animations");
    });

    it("should use opacity for animations", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("opacity"), "CSS should use opacity for animations");
    });

    it("should not animate layout properties", () => {
      const css = readCss("futureMinimalEnhanced.css");
      const layoutProperties = ["width:", "height:", "top:", "left:", "right:", "bottom:"];
      for (const prop of layoutProperties) {
        const lines = css.split("\n");
        for (const line of lines) {
          if (line.includes("transition") && line.includes(prop)) {
            assert.fail(`Should not animate layout property: ${prop}`);
          }
        }
      }
    });
  });

  describe("Backdrop Filter Performance", () => {
    it("should have reasonable blur values", () => {
      const css = readCss("futureMinimalTokens.css");
      const blurMatch = css.match(/--future-glass-blur:\s*(\d+)px/);
      if (blurMatch) {
        const blurValue = parseInt(blurMatch[1]);
        assert.ok(blurValue <= 30, `Blur value ${blurValue}px should be <= 30px`);
      }
    });

    it("should have reduced motion fallback", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("prefers-reduced-motion: reduce"), "CSS should have reduced motion fallback");
    });
  });
});
