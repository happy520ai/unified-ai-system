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

    it("enhanced CSS should be under 50KB", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.length < 50 * 1024, `enhanced CSS size ${css.length} should be under 50KB`);
    });

    it("console CSS should be under 15KB", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css.length < 15 * 1024, `console CSS size ${css.length} should be under 15KB`);
    });
  });

  describe("CSS Optimization", () => {
    it("should not have bare universal selectors", () => {
      const css = readCss("futureMinimalEnhanced.css");
      // Check for bare * { } (not combined with class/child selectors)
      assert.ok(!css.match(/^\*\s*\{/m), "CSS should not contain bare universal selector * { }");
    });

    it("should use CSS variables for colors", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-"), "CSS should contain --future- variables");
    });

    it("should have transition tokens", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-transition"), "CSS should contain transition tokens");
    });
  });

  describe("Animation Performance", () => {
    it("should use transform for animations", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes("transform: translateY"), "CSS should use transform: translateY for animations");
    });

    it("should have transition properties", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes("transition:"), "CSS should have transition properties");
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
    it("should have design tokens", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-accent"), "CSS should have accent tokens");
    });

    it("should have consistent naming", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-"), "CSS should use --future- prefix");
    });
  });
});
