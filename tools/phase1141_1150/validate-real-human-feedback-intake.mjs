import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();
const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1141_1150/real-human-feedback-intake-result.json");
const phase1120Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json");
const phase1131Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1131_1140/local-human-trial-evidence-result.json");

const requiredDocs = [
  "docs/phase1141-1150-real-human-feedback-intake.md",
  "docs/phase1147-real-feedback-issue-classification-ledger.md",
  "docs/phase1148-post-seal-ui-blocker-decision.md",
  "docs/phase1149-human-trial-evidence-package.md"
];

const readJson = (path) => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
const phase1120 = readJson(phase1120Path);
const phase1131 = readJson(phase1131Path);
const result = readJson(resultPath) ?? {
  completed: false,
  recommended_sealed: false,
  blocker: "phase1141_1150_result_missing",
  phaseRange: "1141-1150"
};

const docsText = requiredDocs
  .filter((path) => existsSync(resolve(repoRoot, path)))
  .map((path) => readFileSync(resolve(repoRoot, path), "utf8"))
  .join("\n");

const checks = {
  phase1120Sealed: result.phase1120Sealed === true && phase1120?.productUiFinalPatchSealed === true,
  phase1131_1140Sealed: result.phase1131_1140Sealed === true && phase1131?.completed === true,
  fakeHumanFeedbackDetected: result.fakeHumanFeedbackDetected === false,
  codexSelfTestCountedAsHumanFeedback: result.codexSelfTestCountedAsHumanFeedback === false,
  realHumanFeedbackCollectedKnown: typeof result.realHumanFeedbackCollected === "boolean",
  ownerFeedbackCollectedKnown: typeof result.ownerFeedbackCollected === "boolean",
  externalTesterFeedbackCountValid: Number.isInteger(result.externalTesterFeedbackCount) && result.externalTesterFeedbackCount >= 0,
  feedbackClassificationLedgerGenerated: result.feedbackClassificationLedgerGenerated === true && existsSync(resolve(repoRoot, "docs/phase1147-real-feedback-issue-classification-ledger.md")),
  postSealBlockerDecisionGenerated: result.postSealBlockerDecisionGenerated === true && existsSync(resolve(repoRoot, "docs/phase1148-post-seal-ui-blocker-decision.md")),
  providerCallsMade: result.providerCallsMade === false,
  secretValueExposed: result.secretValueExposed === false,
  deployExecuted: result.deployExecuted === false,
  chatModified: result.chatModified === false,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified === false,
  docsGenerated: requiredDocs.every((path) => existsSync(resolve(repoRoot, path))),
  noFakeFeedbackClaimInDocs: !docsText.includes("Codex 自测视为人工反馈") && !docsText.includes("外部测试者已完成"),
  missingFeedbackBlocksSeal: result.realHumanFeedbackCollected === true || (result.recommended_sealed === false && result.blocker === "real_human_feedback_missing")
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const ok = failedChecks.length === 0;
const verified = {
  ...result,
  completed: ok ? true : result.completed === true,
  recommended_sealed: ok && result.realHumanFeedbackCollected === true && result.recommended_sealed === true,
  blocker: ok
    ? (result.realHumanFeedbackCollected === true ? result.blocker : "real_human_feedback_missing")
    : `phase1141_1150_failed_checks:${failedChecks.join(",")}`,
  partialCompletionAccepted: ok && result.realHumanFeedbackCollected !== true,
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
  realHumanFeedbackCollected: verified.realHumanFeedbackCollected,
  failedChecks
}, null, 2));

if (!ok) {
  process.exitCode = 1;
}
