import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const docs = {
  overview: "docs/phase571-mission-control-internal-trial-feedback-round2.md",
  summary: "docs/phase571-round2-feedback-summary.md",
  ledger: "docs/phase571-round2-issue-classification-ledger.md",
  candidates: "docs/phase571-round2-low-risk-fix-candidates.md",
  report: "docs/phase571-execution-report.md",
};
const evidencePath = "apps/ai-gateway-service/evidence/phase571/internal-trial-feedback-round2-result.json";

const requiredTerms = [
  "Round 1 vs Round 2",
  "threeModeComprehension: improved",
  "buttonAnxiety: improved",
  "providerMisunderstandingRisk: unchanged_or_improved",
  "securityShieldUserUnderstanding: improved",
  "evidenceReplayClarity: stable",
  "still_hidden",
  "no-provider-call",
  "no-secret",
  "no-deploy",
  "no-billing",
  "no-invoice",
  "Yiyi / character remains hidden",
];

const dangerousActionInstructions = [
  "Deploy Now",
  "Release Now",
  "Push to Production",
  "Call Provider Now",
  "Save Secret",
  "Upload Secret",
  "Generate Invoice",
];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return readFile(resolve(path), "utf8");
}

function missingTerms(text, terms) {
  return terms.filter((term) => !text.includes(term));
}

function presentTerms(text, terms) {
  return terms.filter((term) => text.includes(term));
}

async function main() {
  const result = {
    phase: "Phase571",
    name: "Mission Control Internal Trial Feedback Round 2",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    docsExist: {},
    requiredTermsMissing: [],
    dangerousActionInstructionTermsPresent: [],
  };

  try {
    for (const [key, path] of Object.entries(docs)) {
      result.docsExist[key] = existsSync(resolve(path));
      ensure(result.docsExist[key], `Missing Phase571 doc: ${path}`);
    }
    ensure(existsSync(resolve(evidencePath)), `Missing Phase571 evidence: ${evidencePath}`);

    const allDocs = (await Promise.all(Object.values(docs).map((path) => read(path)))).join("\n\n");
    result.requiredTermsMissing = missingTerms(allDocs, requiredTerms);
    result.dangerousActionInstructionTermsPresent = presentTerms(allDocs, dangerousActionInstructions);
    ensure(result.requiredTermsMissing.length === 0, `Missing required terms: ${result.requiredTermsMissing.join(", ")}`);
    ensure(
      result.dangerousActionInstructionTermsPresent.length === 0,
      `Dangerous action instruction wording detected: ${result.dangerousActionInstructionTermsPresent.join(", ")}`,
    );

    const evidence = JSON.parse(await read(evidencePath));
    ensure(evidence.phase === "Phase571", "Evidence phase must be Phase571.");
    ensure(evidence.trialFeedbackCollected === true, "Round 2 must record trialFeedbackCollected=true.");
    ensure(evidence.feedbackSourceCount >= 1, "Round 2 must include at least one feedback source.");
    ensure(Array.isArray(evidence.feedbackSources) && evidence.feedbackSources.length >= 1, "Feedback source record missing.");
    ensure(evidence.recommended_sealed === true, "Round 2 should be sealed only with feedback source present.");
    ensure(evidence.blocker === null, "Round 2 blocker must be null.");
    ensure(evidence.round1ComparisonGenerated === true, "Round 1 vs Round 2 comparison must be generated.");
    ensure(evidence.threeModeComprehension === "improved", "threeModeComprehension must be improved.");
    ensure(evidence.buttonAnxiety === "improved", "buttonAnxiety must be improved.");
    ensure(evidence.providerMisunderstandingRisk === "unchanged_or_improved", "Provider misunderstanding risk mismatch.");
    ensure(evidence.securityShieldUserUnderstanding === "improved", "Security Shield understanding mismatch.");
    ensure(evidence.evidenceReplayClarity === "stable", "Evidence Replay clarity mismatch.");
    ensure(evidence.characterModuleResidue === "still_hidden", "Character residue must remain hidden.");
    ensure(evidence.p0BlockerCount === 0, "P0 count mismatch.");
    ensure(evidence.p1HighIssueCount === 0, "P1 count mismatch.");
    ensure(evidence.p2MediumIssueCount === 2, "P2 count mismatch.");
    ensure(evidence.p3LowIssueCount === 2, "P3 count mismatch.");
    for (const key of [
      "yiyiVisible",
      "characterModuleVisible",
      "providerCallsMade",
      "nonNvidiaProviderCallsMade",
      "secretValueExposed",
      "rawSecretAccessed",
      "deployExecuted",
      "releaseExecuted",
      "tagCreated",
      "artifactUploaded",
      "billingExecuted",
      "invoiceGenerated",
      "chatGatewayRuntimeModified",
      "workspaceCleanClaimed",
    ]) {
      ensure(evidence[key] === false, `Evidence field ${key} must be false.`);
    }
  } catch (error) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = String(error?.message || error);
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
