import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();
const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1131_1140/local-human-trial-evidence-result.json");
const phase1120Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json");

const requiredDocs = [
  "docs/phase1131-1140-local-human-trial-evidence-period.md",
  "docs/phase1131-local-trial-plan.md",
  "docs/phase1132-screenshot-checklist.md",
  "docs/phase1133-user-comprehension-form.md",
  "docs/phase1134-manual-trial-evidence-intake-schema.md",
  "docs/phase1135-owner-manual-trial-record.md",
  "docs/phase1136-external-tester-trial-slots.md",
  "docs/phase1137-feedback-classification-ledger.md",
  "docs/phase1138-ui-issue-ledger-after-final-seal.md",
  "docs/phase1139-post-seal-trial-evidence-package.md"
];

const readJson = (path) => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
const phase1120 = readJson(phase1120Path);
const result = readJson(resultPath) ?? {
  completed: false,
  recommended_sealed: false,
  blocker: "phase1131_1140_result_missing",
  phaseRange: "1131-1140"
};

const docText = requiredDocs
  .filter((path) => existsSync(resolve(repoRoot, path)))
  .map((path) => readFileSync(resolve(repoRoot, path), "utf8"))
  .join("\n");

const forbiddenClaims = [
  "生产可用",
  "production ready",
  "真实用户反馈已完成",
  "human feedback completed",
  "已部署",
  "deployed to production"
];

const checks = {
  completed: result.completed === true,
  phaseRange: result.phaseRange === "1131-1140",
  phase1120Sealed: result.phase1120Sealed === true && phase1120?.productUiFinalPatchSealed === true,
  uiFinalPatchSealed: result.uiFinalPatchSealed === true,
  localTrialPlanGenerated: result.localTrialPlanGenerated === true && existsSync(resolve(repoRoot, "docs/phase1131-local-trial-plan.md")),
  screenshotChecklistGenerated: result.screenshotChecklistGenerated === true && existsSync(resolve(repoRoot, "docs/phase1132-screenshot-checklist.md")),
  comprehensionFormGenerated: result.comprehensionFormGenerated === true && existsSync(resolve(repoRoot, "docs/phase1133-user-comprehension-form.md")),
  manualTrialSchemaGenerated: result.manualTrialSchemaGenerated === true && existsSync(resolve(repoRoot, "docs/phase1134-manual-trial-evidence-intake-schema.md")),
  ownerManualTrialRecordPrepared: result.ownerManualTrialRecordPrepared === true && existsSync(resolve(repoRoot, "docs/phase1135-owner-manual-trial-record.md")),
  externalTesterSlotsPrepared: result.externalTesterSlotsPrepared === true && existsSync(resolve(repoRoot, "docs/phase1136-external-tester-trial-slots.md")),
  feedbackLedgerGenerated: result.feedbackLedgerGenerated === true && existsSync(resolve(repoRoot, "docs/phase1137-feedback-classification-ledger.md")),
  postSealIssueLedgerGenerated: result.postSealIssueLedgerGenerated === true && existsSync(resolve(repoRoot, "docs/phase1138-ui-issue-ledger-after-final-seal.md")),
  postSealEvidencePackageGenerated: existsSync(resolve(repoRoot, "docs/phase1139-post-seal-trial-evidence-package.md")),
  providerCallsMade: result.providerCallsMade === false,
  secretValueExposed: result.secretValueExposed === false,
  deployExecuted: result.deployExecuted === false,
  releaseExecuted: result.releaseExecuted === false,
  tagCreated: result.tagCreated === false,
  artifactUploaded: result.artifactUploaded === false,
  chatModified: result.chatModified === false,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified === false,
  fakeHumanFeedbackDetected: result.fakeHumanFeedbackDetected === false && !docText.includes("Codex 自测 = 人工反馈"),
  productionReadyClaimed: result.productionReadyClaimed === false && !forbiddenClaims.some((claim) => docText.toLowerCase().includes(claim.toLowerCase())),
  docsGenerated: requiredDocs.every((path) => existsSync(resolve(repoRoot, path)))
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const ok = failedChecks.length === 0;
const verified = {
  ...result,
  recommended_sealed: ok && result.recommended_sealed === true,
  blocker: ok ? result.blocker : `phase1131_1140_failed_checks:${failedChecks.join(",")}`,
  partialCompletionAccepted: !ok,
  verifier: {
    ok,
    failedChecks,
    checks,
    checkedAt: new Date().toISOString()
  }
};

mkdirSync(dirname(resultPath), { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(verified, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok,
  completed: verified.completed,
  recommended_sealed: verified.recommended_sealed,
  blocker: verified.blocker,
  failedChecks
}, null, 2));

if (!ok) {
  process.exitCode = 1;
}
