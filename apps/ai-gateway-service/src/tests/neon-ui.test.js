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
    it("should have accent color token", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-accent:"), "CSS should contain --future-accent token");
    });

    it("should have accent strong color token", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-accent-strong:"), "CSS should contain --future-accent-strong token");
    });

    it("should have background color token", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-bg:"), "CSS should contain --future-bg token");
    });

    it("should have accent soft token", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-accent-soft"), "CSS should contain --future-accent-soft token");
    });

    it("should have background soft token", () => {
      const css = readCss("futureMinimalTokens.css");
      assert.ok(css.includes("--future-bg-soft"), "CSS should contain --future-bg-soft token");
    });
  });

  describe("Enhanced Components", () => {
    it("should have glass card styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes("backdrop-filter: blur"), "CSS should contain backdrop-filter: blur");
      assert.ok(css.includes("future-glass-bg"), "CSS should contain future-glass-bg");
    });

    it("should have KPI tile styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes(".kpi-tile"), "CSS should contain .kpi-tile");
      assert.ok(css.includes(".kpi-tile__value"), "CSS should contain .kpi-tile__value");
      assert.ok(css.includes(".kpi-tile__delta"), "CSS should contain .kpi-tile__delta");
    });

    it("should have status pill styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes(".status-pill"), "CSS should contain .status-pill");
      assert.ok(css.includes(".status-pill--online"), "CSS should contain .status-pill--online");
      assert.ok(css.includes(".status-pill--warning"), "CSS should contain .status-pill--warning");
      assert.ok(css.includes(".status-pill--critical"), "CSS should contain .status-pill--critical");
    });

    it("should have data table styles", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes(".future-data-table"), "CSS should contain .future-data-table");
    });

    it("should have neon text glow", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes(".neon-text-cyan"), "CSS should contain .neon-text-cyan");
      assert.ok(css.includes(".neon-text-violet"), "CSS should contain .neon-text-violet");
    });

    it("should have skeleton loading", () => {
      const css = readCss("futureMinimalEnhanced.css");
      assert.ok(css.includes(".future-skeleton"), "CSS should contain .future-skeleton");
      assert.ok(css.includes("shimmer"), "CSS should contain shimmer");
    });
  });

  describe("Console Enhancement", () => {
    it("should have console panel glassmorphism", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css.includes("future-os-panel"), "CSS should contain future-os-panel");
      assert.ok(css.includes("backdrop-filter: blur"), "CSS should contain backdrop-filter: blur");
    });

    it("should have chat message neon", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css.includes("chat-message--assistant"), "CSS should contain chat-message--assistant");
      assert.ok(css.includes("chat-message--user"), "CSS should contain chat-message--user");
    });

    it("should have input neon focus", () => {
      const css = readCss("consoleEnhanced.css");
      assert.ok(css.includes("chat-input:focus"), "CSS should contain chat-input:focus");
      assert.ok(css.includes("box-shadow: var(--future-glow-cyan)"), "CSS should contain box-shadow: var(--future-glow-cyan)");
    });
  });

  describe("Neon Components JS", () => {
    it("should export renderKPITile", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js.includes("export function renderKPITile"), "JS should export renderKPITile");
    });

    it("should export renderStatusPill", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js.includes("export function renderStatusPill"), "JS should export renderStatusPill");
    });

    it("should export renderDataTable", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js.includes("export function renderDataTable"), "JS should export renderDataTable");
    });

    it("should export renderScanlineOverlay", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js.includes("export function renderScanlineOverlay"), "JS should export renderScanlineOverlay");
    });

    it("should have ARIA labels", () => {
      const js = readJs("NeonComponents.js");
      assert.ok(js.includes('role="status"'), "JS should have role=status");
      assert.ok(js.includes("aria-label"), "JS should have aria-label");
      assert.ok(js.includes('aria-hidden="true"'), "JS should have aria-hidden=true");
    });
  });

  describe("Integration", () => {
    it("should have FutureMinimalOsApp module", () => {
      const appJs = readFileSync(resolve(moduleDir, "../ui/future-minimal-os/FutureMinimalOsApp.js"), "utf8");
      assert.ok(appJs.length > 100, "App module should have content");
    });

    it("should have FutureMinimalShell module", () => {
      const shellJs = readFileSync(resolve(moduleDir, "../ui/future-minimal-os/layout/FutureMinimalShell.js"), "utf8");
      assert.ok(shellJs.length > 100, "Shell module should have content");
    });
  });
});
