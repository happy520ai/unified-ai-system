import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const docs = {
  summary: "docs/phase568-internal-trial-feedback-summary.md",
  ledger: "docs/phase568-issue-classification-ledger.md",
  lowRisk: "docs/phase568-low-risk-fix-candidates.md",
  executionReport: "docs/phase568-execution-report.md",
  phase568b: "docs/phase568b-controlled-internal-trial-feedback-classification.md",
  phase568bReport: "docs/phase568b-execution-report.md",
};

const evidence568Path = "apps/ai-gateway-service/evidence/phase568/controlled-internal-trial-intake-result.json";
const evidence568bPath = "apps/ai-gateway-service/evidence/phase568b/controlled-internal-trial-feedback-classification-result.json";

const requiredBoundaryTerms = [
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

function missingTerms(source, terms) {
  return terms.filter((term) => !source.includes(term));
}

function presentTerms(source, terms) {
  return terms.filter((term) => source.includes(term));
}

async function readText(path) {
  return readFile(resolve(path), "utf8");
}

async function main() {
  const result = {
    phase: "Phase568B",
    name: "Controlled Internal Trial Feedback Classification",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    docsExist: {},
    boundaryTermsMissing: [],
    dangerousActionInstructionTermsPresent: [],
  };

  try {
    for (const [key, path] of Object.entries(docs)) {
      result.docsExist[key] = existsSync(resolve(path));
      ensure(result.docsExist[key], `Missing required doc: ${path}`);
    }
    ensure(existsSync(resolve(evidence568Path)), `Missing Phase568 evidence: ${evidence568Path}`);
    ensure(existsSync(resolve(evidence568bPath)), `Missing Phase568B evidence: ${evidence568bPath}`);

    const allDocs = (await Promise.all(Object.values(docs).map((path) => readText(path)))).join("\n\n");
    result.boundaryTermsMissing = missingTerms(allDocs, requiredBoundaryTerms);
    result.dangerousActionInstructionTermsPresent = presentTerms(allDocs, dangerousActionInstructions);

    ensure(result.boundaryTermsMissing.length === 0, `Missing boundary terms: ${result.boundaryTermsMissing.join(", ")}`);
    ensure(
      result.dangerousActionInstructionTermsPresent.length === 0,
      `Dangerous action instruction wording detected: ${result.dangerousActionInstructionTermsPresent.join(", ")}`,
    );

    const evidence568 = JSON.parse(await readText(evidence568Path));
    const evidence568b = JSON.parse(await readText(evidence568bPath));
    const ledger = await readText(docs.ledger);
    const lowRisk = await readText(docs.lowRisk);

    ensure(evidence568.trialFeedbackCollected === true, "Phase568 evidence must record trialFeedbackCollected=true.");
    ensure(evidence568.feedbackSourceCount >= 1, "Phase568 evidence must record feedbackSourceCount >= 1.");
    ensure(Array.isArray(evidence568.feedbackSources) && evidence568.feedbackSources.length >= 1, "Phase568 evidence must include feedbackSources.");
    ensure(evidence568.blocker === null, "Phase568 evidence blocker must be null.");
    ensure(evidence568.recommended_sealed === true, "Phase568 evidence must be sealed after real feedback classification.");
    ensure(evidence568.feedbackSourceRecordPresent === true, "Phase568 evidence must record feedbackSourceRecordPresent=true.");
    ensure(evidence568.p0BlockerCount === 0, "Phase568 p0 count mismatch.");
    ensure(evidence568.p1HighIssueCount === 0, "Phase568 p1 count mismatch.");
    ensure(evidence568.p2MediumIssueCount === 3, "Phase568 p2 count mismatch.");
    ensure(evidence568.p3LowIssueCount === 4, "Phase568 p3 count mismatch.");

    ensure(ledger.includes("P2 medium: 3"), "Ledger must record P2 medium: 3.");
    ensure(ledger.includes("P3 low: 4"), "Ledger must record P3 low: 4.");
    ensure(ledger.includes("three_mode_density_and_repetition"), "Ledger missing three_mode_density_and_repetition.");
    ensure(ledger.includes("action_button_copy_execution_anxiety"), "Ledger missing action_button_copy_execution_anxiety.");
    ensure(ledger.includes("security_shield_too_internal"), "Ledger missing security_shield_too_internal.");
    ensure(lowRisk.includes("预览普通模式结果"), "Low-risk candidates missing Normal button wording candidate.");
    ensure(lowRisk.includes("预览 God Mode 方案"), "Low-risk candidates missing God button wording candidate.");
    ensure(lowRisk.includes("预览天枢规划"), "Low-risk candidates missing Tianshu button wording candidate.");

    ensure(evidence568b.completed === true, "Phase568B evidence must be completed.");
    ensure(evidence568b.recommended_sealed === true, "Phase568B evidence must be sealed.");
    ensure(evidence568b.feedbackSourceCount >= 1, "Phase568B evidence must record feedbackSourceCount >= 1.");
    ensure(evidence568b.trialFeedbackCollected === true, "Phase568B evidence must record real feedback collected.");
    ensure(evidence568b.uiDirectlyModified === false, "Phase568B must not directly modify UI.");
    ensure(evidence568b.providerCallsMade === false, "Phase568B providerCallsMade must be false.");
    ensure(evidence568b.secretValueExposed === false, "Phase568B secretValueExposed must be false.");
    ensure(evidence568b.deployExecuted === false, "Phase568B deployExecuted must be false.");
    ensure(evidence568b.billingExecuted === false, "Phase568B billingExecuted must be false.");
    ensure(evidence568b.invoiceGenerated === false, "Phase568B invoiceGenerated must be false.");
    ensure(evidence568b.chatGatewayRuntimeModified === false, "Phase568B must not modify chat gateway runtime.");
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
