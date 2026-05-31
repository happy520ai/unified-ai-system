import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();
const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1151_1160/owner-real-manual-trial-intake-result.json");
const phase1120Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json");
const phase1131Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1131_1140/local-human-trial-evidence-result.json");

const requiredDocs = [
  "docs/phase1151-1160-owner-real-manual-trial-intake.md",
  "docs/phase1152-owner-trial-input-contract.md",
  "docs/phase1153-owner-trial-feedback-classification-ledger.md",
  "docs/phase1154-owner-trial-ui-issue-ledger.md",
  "docs/phase1155-owner-trial-blocker-decision.md",
  "docs/phase1159-owner-trial-evidence-package.md"
];

const readJson = (path) => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
const phase1120 = readJson(phase1120Path);
const phase1131 = readJson(phase1131Path);
const result = readJson(resultPath) ?? {
  completed: false,
  recommended_sealed: false,
  blocker: "phase1151_1160_result_missing",
  phaseRange: "1151-1160"
};

const docsText = requiredDocs
  .filter((path) => existsSync(resolve(repoRoot, path)))
  .map((path) => readFileSync(resolve(repoRoot, path), "utf8"))
  .join("\n");

const forbiddenClaims = [
  "production ready",
  "deployed to production",
  "provider called",
  "api key exposed",
  "codex self-checks are owner feedback",
  "真实 Provider 已调用",
  "生产可用",
  "已部署生产"
];

const ownerInputKnown = typeof result.realOwnerFeedbackInputFound === "boolean"
  && typeof result.ownerFeedbackCollected === "boolean";
const missingInputBlocksSeal = result.ownerFeedbackCollected === true
  || (result.recommended_sealed === false && result.blocker === "owner_real_manual_trial_input_missing");

const checks = {
  completed: result.completed === true,
  phaseRange: result.phaseRange === "1151-1160",
  ownerRealManualTrialIntake: result.ownerRealManualTrialIntake === true,
  humanInterventionRequired: result.humanInterventionRequired === false,
  phase1120Sealed: result.phase1120Sealed === true && phase1120?.productUiFinalPatchSealed === true,
  phase1131_1140Completed: result.phase1131_1140Completed === true && phase1131?.completed === true,
  ownerInputKnown,
  codexSelfTestCountedAsOwnerFeedback: result.codexSelfTestCountedAsOwnerFeedback === false,
  fakeOwnerFeedbackDetected: result.fakeOwnerFeedbackDetected === false,
  ownerFeedbackClassificationCompleted: result.ownerFeedbackClassificationCompleted === true,
  ownerFeedbackLedgerGenerated: result.ownerFeedbackLedgerGenerated === true && existsSync(resolve(repoRoot, "docs/phase1153-owner-trial-feedback-classification-ledger.md")),
  ownerTrialIssueLedgerGenerated: result.ownerTrialIssueLedgerGenerated === true && existsSync(resolve(repoRoot, "docs/phase1154-owner-trial-ui-issue-ledger.md")),
  ownerTrialEvidencePackageGenerated: result.ownerTrialEvidencePackageGenerated === true && existsSync(resolve(repoRoot, "docs/phase1159-owner-trial-evidence-package.md")),
  ownerTrialBlockerDecisionGenerated: result.ownerTrialBlockerDecisionGenerated === true && existsSync(resolve(repoRoot, "docs/phase1155-owner-trial-blocker-decision.md")),
  providerCallsMade: result.providerCallsMade === false,
  secretValueExposed: result.secretValueExposed === false,
  deployExecuted: result.deployExecuted === false,
  releaseExecuted: result.releaseExecuted === false,
  tagCreated: result.tagCreated === false,
  artifactUploaded: result.artifactUploaded === false,
  chatModified: result.chatModified === false,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified === false,
  legacyModified: result.legacyModified === false,
  projectContextModified: result.projectContextModified === false,
  productionReadyClaimed: result.productionReadyClaimed === false,
  docsGenerated: requiredDocs.every((path) => existsSync(resolve(repoRoot, path))),
  noUnsupportedClaimsInDocs: !forbiddenClaims.some((claim) => docsText.toLowerCase().includes(claim.toLowerCase())),
  missingInputBlocksSeal,
  completedButUnsealedWhenNoOwnerInput: result.ownerFeedbackCollected === true || result.partialCompletionAccepted === true
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const ok = failedChecks.length === 0;
const verified = {
  ...result,
  completed: ok ? true : result.completed === true,
  recommended_sealed: ok && result.ownerFeedbackCollected === true && result.recommended_sealed === true,
  blocker: ok
    ? (result.ownerFeedbackCollected === true ? result.blocker : "owner_real_manual_trial_input_missing")
    : `phase1151_1160_failed_checks:${failedChecks.join(",")}`,
  partialCompletionAccepted: ok && result.ownerFeedbackCollected !== true,
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
  ownerFeedbackCollected: verified.ownerFeedbackCollected,
  failedChecks
}, null, 2));

if (!ok) {
  process.exitCode = 1;
}
