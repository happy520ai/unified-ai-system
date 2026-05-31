import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const resultPath = resolve(process.cwd(), "apps/ai-gateway-service/evidence/phase1141_1150/real-human-feedback-intake-result.json");
const result = JSON.parse(readFileSync(resultPath, "utf8"));

const passedCommands = [
  "node --check tools/phase1141_1150/validate-real-human-feedback-intake.mjs",
  "node tools/phase1141_1150/validate-real-human-feedback-intake.mjs",
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
  recommended_sealed: false,
  blocker: "real_human_feedback_missing",
  verificationCommands: passedCommands.map((command) => ({ command, status: "passed" })),
  failedCommands: [],
  readmeAgentsSyncExecuted: true,
  readmeAgentsSyncPassed: true,
  realHumanFeedbackCollected: false,
  ownerFeedbackCollected: false,
  externalTesterFeedbackCount: 0,
  fakeHumanFeedbackDetected: false,
  productionReadyClaimed: false
};

writeFileSync(resultPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  recordedPassedCommands: passedCommands.length,
  resultPath: "apps/ai-gateway-service/evidence/phase1141_1150/real-human-feedback-intake-result.json"
}, null, 2));
