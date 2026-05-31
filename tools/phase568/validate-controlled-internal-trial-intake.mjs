import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const docs = {
  intake: "docs/phase568-mission-control-controlled-internal-trial-intake.md",
  summary: "docs/phase568-internal-trial-feedback-summary.md",
  ledger: "docs/phase568-issue-classification-ledger.md",
  lowRisk: "docs/phase568-low-risk-fix-candidates.md",
  report: "docs/phase568-execution-report.md",
};

const evidencePath = "apps/ai-gateway-service/evidence/phase568/controlled-internal-trial-intake-result.json";

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

const requiredDocsTerms = [
  "P0",
  "P1",
  "P2",
  "P3",
  "Provider / CredentialRef",
  "Security Shield",
  "Evidence Replay",
  "fallback",
  "real_internal_trial_feedback_missing",
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
    phase: "Phase568",
    name: "Mission Control Controlled Internal Trial Intake",
    completed: true,
    recommended_sealed: false,
    blocker: null,
    docsExist: {},
    requiredTermsMissing: [],
    boundaryTermsMissing: [],
    dangerousActionInstructionTermsPresent: [],
    evidenceExists: false,
    evidenceStatus: null,
  };

  try {
    for (const [key, path] of Object.entries(docs)) {
      result.docsExist[key] = existsSync(resolve(path));
      ensure(result.docsExist[key], `Missing Phase568 doc: ${path}`);
    }

    result.evidenceExists = existsSync(resolve(evidencePath));
    ensure(result.evidenceExists, `Missing Phase568 evidence: ${evidencePath}`);

    const allDocs = (await Promise.all(Object.values(docs).map((path) => readText(path)))).join("\n\n");
    result.requiredTermsMissing = missingTerms(allDocs, requiredDocsTerms);
    result.boundaryTermsMissing = missingTerms(allDocs, requiredBoundaryTerms);
    result.dangerousActionInstructionTermsPresent = presentTerms(allDocs, dangerousActionInstructions);

    ensure(result.requiredTermsMissing.length === 0, `Phase568 docs missing required terms: ${result.requiredTermsMissing.join(", ")}`);
    ensure(result.boundaryTermsMissing.length === 0, `Phase568 docs missing boundary terms: ${result.boundaryTermsMissing.join(", ")}`);
    ensure(
      result.dangerousActionInstructionTermsPresent.length === 0,
      `Dangerous action instruction wording detected: ${result.dangerousActionInstructionTermsPresent.join(", ")}`,
    );

    const evidence = JSON.parse(await readText(evidencePath));
    result.evidenceStatus = {
      completed: evidence.completed,
      recommended_sealed: evidence.recommended_sealed,
      blocker: evidence.blocker,
      trialFeedbackCollected: evidence.trialFeedbackCollected,
      feedbackSourceRecordPresent: evidence.feedbackSourceRecordPresent,
    };

    ensure(evidence.phase === "Phase568", "Evidence phase must be Phase568.");
    ensure(evidence.basedOnPhase567 === true, "Evidence must record basedOnPhase567=true.");
    ensure(evidence.feedbackSummaryGenerated === true, "Feedback summary must be generated.");
    ensure(evidence.issueClassificationGenerated === true, "Issue classification must be generated.");
    ensure(evidence.lowRiskFixCandidatesGenerated === true, "Low-risk fix candidates must be generated.");
    ensure(evidence.providerCallsMade === false, "providerCallsMade must be false.");
    ensure(evidence.nonNvidiaProviderCallsMade === false, "nonNvidiaProviderCallsMade must be false.");
    ensure(evidence.secretValueExposed === false, "secretValueExposed must be false.");
    ensure(evidence.rawSecretAccessed === false, "rawSecretAccessed must be false.");
    ensure(evidence.deployExecuted === false, "deployExecuted must be false.");
    ensure(evidence.releaseExecuted === false, "releaseExecuted must be false.");
    ensure(evidence.tagCreated === false, "tagCreated must be false.");
    ensure(evidence.artifactUploaded === false, "artifactUploaded must be false.");
    ensure(evidence.billingExecuted === false, "billingExecuted must be false.");
    ensure(evidence.invoiceGenerated === false, "invoiceGenerated must be false.");
    ensure(evidence.chatGatewayRuntimeModified === false, "chatGatewayRuntimeModified must be false.");
    ensure(evidence.workspaceCleanClaimed === false, "workspaceCleanClaimed must be false.");

    if (evidence.trialFeedbackCollected === false) {
      ensure(evidence.recommended_sealed === false, "recommended_sealed must not be true when trialFeedbackCollected=false.");
      ensure(evidence.completed === false, "completed must not be true when real trial feedback is missing.");
      ensure(evidence.blocker === "real_internal_trial_feedback_missing", "Missing real feedback must use blocker=real_internal_trial_feedback_missing.");
    }

    if (evidence.recommended_sealed === true) {
      ensure(evidence.trialFeedbackCollected === true, "recommended_sealed=true requires trialFeedbackCollected=true.");
      ensure(evidence.feedbackSourceRecordPresent === true, "recommended_sealed=true requires a real feedback source record.");
      ensure(evidence.blocker === null, "recommended_sealed=true requires blocker=null.");
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
