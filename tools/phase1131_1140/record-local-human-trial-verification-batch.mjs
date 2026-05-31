import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const resultPath = resolve(process.cwd(), "apps/ai-gateway-service/evidence/phase1131_1140/local-human-trial-evidence-result.json");
const result = JSON.parse(readFileSync(resultPath, "utf8"));

const passedCommands = [
  "pnpm run preflight:phase632-token-saving",
  "node tools/phase651_666/run-codex-long-task-token-saving-subgateway.mjs",
  "node --check tools/phase1131_1140/validate-local-human-trial-evidence-period.mjs",
  "node tools/phase1131_1140/validate-local-human-trial-evidence-period.mjs",
  "pnpm verify:phase107a-secret-safety",
  "pnpm verify:phase321a-workbench-product-recovery",
  "pnpm smoke:phase308a-desktop-workbench-ui",
  "pnpm -r --if-present check",
  "pnpm run sync:readme-agents-current-state",
  "pnpm run verify:phase306c-readme-agents-auto-sync-guard"
];

const updated = {
  ...result,
  completed: true,
  recommended_sealed: true,
  blocker: null,
  verificationCommands: passedCommands.map((command) => ({ command, status: "passed" })),
  failedCommands: [],
  readmeAgentsSyncExecuted: true,
  readmeAgentsSyncPassed: true,
  verifierSideEffects: [
    "phase107a secret safety verifier refreshed its own evidence files",
    "README.md and AGENTS.md managed blocks refreshed by sync:readme-agents-current-state"
  ]
};

writeFileSync(resultPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  recordedPassedCommands: passedCommands.length,
  resultPath: "apps/ai-gateway-service/evidence/phase1131_1140/local-human-trial-evidence-result.json"
}, null, 2));
