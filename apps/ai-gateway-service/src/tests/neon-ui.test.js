/**
 * Visual Regression Test — Neon UI Enhancement
 * Tests that CSS variables are correctly applied and components render properly
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const stylesDir = resolve(moduleDir, "../ui/future-minimal-os/styles");
const componentsDir = resolve(moduleDir, "../ui/future-minimal-os/components");

function readCss(filename) {
  return readFileSync(resolve(stylesDir, filename), "utf8");
}

function readJs(filename) {
  return readFileSync(resolve(componentsDir, filename), "utf8");
}

describe("Neon UI Enhancement", () => {
  describe("Design Tokens", () => {
    it("should have correct neon cyan color", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("--future-accent: #00F0FF");
    });

    it("should have correct neon violet color", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("--future-accent-strong: #B026FF");
    });

    it("should have correct background color", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("--future-bg: #0A0A0A");
    });

    it("should have glassmorphism blur", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("--future-glass-blur: 20px");
    });

    it("should have neon glow shadows", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("--future-glow-cyan");
      assert.ok(css).includes("--future-glow-violet");
    });

    it("should have scanline overlay", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("--future-scanline");
    });

    it("should have reduced motion support", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css).includes("prefers-reduced-motion: reduce");
    });
  });

  describe("Enhanced Components", () => {
    it("should have glass card styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css).includes("backdrop-filter: blur");
      assert.ok(css).includes("future-glass-bg");
    });

    it("should have KPI tile styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css).includes(".kpi-tile");
      assert.ok(css).includes(".kpi-tile__value");
      assert.ok(css).includes(".kpi-tile__delta");
    });

    it("should have status pill styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css).includes(".status-pill");
      assert.ok(css).includes(".status-pill--online");
      assert.ok(css).includes(".status-pill--warning");
      assert.ok(css).includes(".status-pill--critical");
    });

    it("should have data table styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css).includes(".future-data-table");
    });

    it("should have neon text glow", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css).includes(".neon-text-cyan");
      assert.ok(css).includes(".neon-text-violet");
    });

    it("should have skeleton loading", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css).includes(".future-skeleton");
      assert.ok(css).includes("shimmer");
    });
  });

  describe("Console Enhancement", () => {
    it("should have console panel glassmorphism", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css).includes("future-os-panel");
      assert.ok(css).includes("backdrop-filter: blur");
    });

    it("should have chat message neon", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css).includes("chat-message--assistant");
      assert.ok(css).includes("chat-message--user");
    });

    it("should have input neon focus", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css).includes("chat-input:focus");
      assert.ok(css).includes("box-shadow: var(--future-glow-cyan)");
    });
  });

  describe("Neon Components JS", () => {
    it("should export renderKPITile", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js).includes("export function renderKPITile");
    });

    it("should export renderStatusPill", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js).includes("export function renderStatusPill");
    });

    it("should export renderDataTable", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js).includes("export function renderDataTable");
    });

    it("should export renderScanlineOverlay", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js).includes("export function renderScanlineOverlay");
    });

    it("should have ARIA labels", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js).includes("role=\"status\"");
      assert.ok(js).includes("aria-label");
      assert.ok(js).includes("aria-hidden=\"true\"");
    });
  });

  describe("Integration", () => {
    it("should load enhanced CSS in FutureMinimalOsApp", () => {
      const appJs = readFileSync(resolve(moduleDir, "../ui/future-minimal-os/FutureMinimalOsApp.js"), "utf8");
      assert.ok(appJs).includes("futureMinimalEnhanced.css");
      assert.ok(appJs).includes("consoleEnhanced.css");
    });

    it("should include scanline overlay in shell", () => {
      const shellJs = readFileSync(resolve(moduleDir, "../ui/future-minimal-os/layout/FutureMinimalShell.js"), "utf8");
      assert.ok(shellJs).includes("renderScanlineOverlay");
    });
  });
});
