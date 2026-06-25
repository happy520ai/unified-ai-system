#!/usr/bin/env node
/**
 * run-phase-verify.mjs — Universal phase verifier runner
 *
 * Usage:
 *   node tools/lib/run-phase-verify.mjs <phaseId> [suffix]
 *   pnpm verify:phase 3971a
 *   pnpm verify:phase 3971a xiaomi-provider-readiness-matrix
 *
 * Automatically discovers and runs the matching verify script:
 *   tools/phase<id>/verify-<suffix>.mjs   (if suffix given)
 *   tools/phase<id>/verify-*.mjs          (first match, if no suffix)
 */

import { existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const phaseId = process.argv[2];
const suffix = process.argv[3];

if (!phaseId) {
  console.error("Usage: run-phase-verify.mjs <phaseId> [suffix]");
  console.error("  pnpm verify:phase 3971a");
  console.error("  pnpm verify:phase 3971a xiaomi-provider-readiness-matrix");
  process.exit(1);
}

// Try both formats: phase3971a and phase_3971a
const dirNames = [`phase${phaseId}`, `phase_${phaseId}`];
let phaseDir = null;
for (const name of dirNames) {
  const candidate = resolve(repoRoot, "tools", name);
  if (existsSync(candidate)) {
    phaseDir = candidate;
    break;
  }
}

if (!phaseDir) {
  console.error(`Phase directory not found: tried tools/phase${phaseId} and tools/phase_${phaseId}`);
  process.exit(1);
}

// Find verify script
const entries = readdirSync(phaseDir).filter(e => e.endsWith(".mjs") && e.startsWith("verify-"));

if (entries.length === 0) {
  console.error(`No verify-*.mjs found in ${phaseDir}`);
  process.exit(1);
}

let targetScript;
if (suffix) {
  targetScript = entries.find(e => e === `verify-${suffix}.mjs`);
  if (!targetScript) {
    console.error(`verify-${suffix}.mjs not found in ${phaseDir}. Available: ${entries.join(", ")}`);
    process.exit(1);
  }
} else {
  targetScript = entries[0];
  console.log(`[${phaseId}] Running ${targetScript} (first verify script found)`);
}

const scriptPath = resolve(phaseDir, targetScript);
console.log(`[${phaseId}] Executing: node ${scriptPath}`);
try {
  execSync(`node "${scriptPath}"`, { stdio: "inherit", cwd: repoRoot, timeout: 120_000 });
  console.log(`[${phaseId}] ✓ Completed`);
} catch (err) {
  console.error(`[${phaseId}] ✗ Failed (exit code ${err.status})`);
  process.exit(err.status ?? 1);
}
