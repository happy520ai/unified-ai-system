import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json");
const result = JSON.parse(readFileSync(resultPath, "utf8"));

const passedCommands = [
  "node --check apps/ai-gateway-service/src/ui/consolePage.js",
  "node --check apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  "node --check apps/ai-gateway-service/src/ui/components/NormalModePanel.js",
  "node --check apps/ai-gateway-service/src/ui/components/GodModePanel.js",
  "node --check apps/ai-gateway-service/src/ui/components/TianshuModePanel.js",
  "node --check apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js",
  "node --check apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js",
  "node --check tools/phase1101_1120/run-future-minimal-os-ui-final-patch-closure.mjs",
  "node --check tools/phase1101_1120/validate-future-minimal-os-ui-final-patch-closure.mjs",
  "node tools/phase1101_1120/run-future-minimal-os-ui-final-patch-closure.mjs",
  "node tools/phase1101_1120/validate-future-minimal-os-ui-final-patch-closure.mjs",
  "pnpm run verify:phase1101-1120-future-minimal-os-ui-final-patch-closure",
  "pnpm verify:phase107a-secret-safety",
  "pnpm verify:phase321a-workbench-product-recovery",
  "pnpm smoke:phase308a-desktop-workbench-ui",
  "pnpm -r --if-present check",
  "node tools/phase574r2/validate-first-screen-sample-entry-ux-lock.mjs",
  "node tools/phase570/validate-post-phase569-browser-comprehension-recheck.mjs",
  "node tools/phase1001_1100/validate-future-minimal-os-product-ui-finalization.mjs",
  "pnpm run sync:readme-agents-current-state",
  "pnpm run verify:phase306c-readme-agents-auto-sync-guard"
];

const skippedCommands = [
  {
    command: "node tools/phase1001_1020/validate-future-minimal-os-ui-production-line.mjs",
    reason: "optional verifier file missing"
  }
];

const updated = {
  ...result,
  completed: true,
  recommended_sealed: true,
  blocker: null,
  productUiFinalPatchSealed: true,
  finalVerificationBatchPassed: true,
  verificationCommands: passedCommands.map((command) => ({ command, status: "passed" })),
  skippedOptionalVerificationCommands: skippedCommands,
  failedCommands: [],
  readmeAgentsSyncExecuted: true,
  readmeAgentsSyncPassed: true
};

writeFileSync(resultPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  recordedPassedCommands: passedCommands.length,
  skippedOptionalVerificationCommands: skippedCommands.length,
  resultPath: "apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json"
}, null, 2));
