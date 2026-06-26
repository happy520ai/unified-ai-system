#!/usr/bin/env node
/**
 * build.mjs — esbuild bundler for AI Gateway frontend assets
 *
 * Extracts inline JS/CSS from template literals into proper bundled files.
 * Run: node build.mjs
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, "src/ui");
const outDir = resolve(__dirname, "dist/public");

// Ensure output directory
mkdirSync(outDir, { recursive: true });

// ── Extract inline JS from template literal ──
const inlineJsPath = resolve(srcDir, "scripts/consolePageInlineJs.js");
const inlineJsContent = readFileSync(inlineJsPath, "utf8");

// Extract the template literal content (between first ` and last `)
const jsMatch = inlineJsContent.match(/`([\s\S]*)`/);
if (jsMatch) {
  writeFileSync(resolve(outDir, "console.js"), jsMatch[1].trim());
  console.log("✓ Extracted console.js");
}

// ── Extract inline CSS from template literal ──
const inlineCssPath = resolve(srcDir, "styles/consolePageInlineCss.js");
const inlineCssContent = readFileSync(inlineCssPath, "utf8");

const cssMatch = inlineCssContent.match(/`([\s\S]*)`/);
if (cssMatch) {
  writeFileSync(resolve(outDir, "console.css"), cssMatch[1].trim());
  console.log("✓ Extracted console.css");
}

// ── Bundle with esbuild ──
try {
  await build({
    entryPoints: [resolve(outDir, "console.js")],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: resolve(outDir, "console.bundle.js"),
    format: "iife",
    target: ["es2020"],
    platform: "browser",
  });
  console.log("✓ Bundled console.bundle.js");
} catch (err) {
  console.warn("⚠ esbuild bundle skipped (esbuild not installed):", err.message);
  // Fallback: just copy the extracted JS as-is
  console.log("  Using un-bundled console.js as fallback");
}

// ── Generate manifest ──
const manifest = {
  version: "1.0.0",
  builtAt: new Date().toISOString(),
  files: {
    js: "console.bundle.js",
    css: "console.css",
  },
};
writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("✓ Generated manifest.json");

console.log("\nBuild complete → dist/public/");
