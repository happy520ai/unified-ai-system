import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const docs = {
  checklist: "docs/phase567-mission-control-internal-trial-readiness-checklist.md",
  walkthrough: "docs/phase567-internal-trial-user-walkthrough.md",
  feedback: "docs/phase567-internal-trial-feedback-form.md",
  knownLimits: "docs/phase567-known-limits-and-no-test-boundaries.md",
  executionReport: "docs/phase567-execution-report.md",
};

const evidencePath = "apps/ai-gateway-service/evidence/phase567/internal-trial-readiness-result.json";

const walkthroughRequiredTerms = [
  "Mission Control",
  "Normal",
  "God",
  "Tianshu",
  "Security Shield",
  "Evidence Replay",
  "Provider",
  "CredentialRef",
  "fallback",
];

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

const evidenceExpectedTrue = [
  "completed",
  "recommended_sealed",
  "basedOnPhase566",
  "internalTrialChecklistGenerated",
  "userWalkthroughGenerated",
  "feedbackFormGenerated",
  "knownLimitsGenerated",
  "missionControlPathCovered",
  "threeModePathCovered",
  "providerCredentialRefPathCovered",
  "securityShieldPathCovered",
  "evidenceReplayPathCovered",
  "fallbackPathCovered",
];

const evidenceExpectedFalse = [
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
];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function findMissing(source, terms) {
  return terms.filter((term) => !source.includes(term));
}

function findPresent(source, terms) {
  return terms.filter((term) => source.includes(term));
}

async function readText(path) {
  return readFile(resolve(path), "utf8");
}

async function main() {
  const result = {
    phase: "Phase567",
    name: "Mission Control Internal Trial Readiness Checklist",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    docsExist: {},
    walkthroughMissingTerms: [],
    boundaryMissingTerms: [],
    dangerousActionInstructionTermsPresent: [],
    evidenceExists: false,
    evidenceChecks: {},
  };

  try {
    for (const [key, path] of Object.entries(docs)) {
      result.docsExist[key] = existsSync(resolve(path));
      ensure(result.docsExist[key], `Missing Phase567 doc: ${path}`);
    }

    result.evidenceExists = existsSync(resolve(evidencePath));
    ensure(result.evidenceExists, `Missing Phase567 evidence: ${evidencePath}`);

    const walkthrough = await readText(docs.walkthrough);
    const allDocs = (await Promise.all(Object.values(docs).map((path) => readText(path)))).join("\n\n");

    result.walkthroughMissingTerms = findMissing(walkthrough, walkthroughRequiredTerms);
    result.boundaryMissingTerms = findMissing(allDocs, requiredBoundaryTerms);
    result.dangerousActionInstructionTermsPresent = findPresent(allDocs, dangerousActionInstructions);

    ensure(result.walkthroughMissingTerms.length === 0, `Walkthrough missing terms: ${result.walkthroughMissingTerms.join(", ")}`);
    ensure(result.boundaryMissingTerms.length === 0, `Boundary terms missing: ${result.boundaryMissingTerms.join(", ")}`);
    ensure(
      result.dangerousActionInstructionTermsPresent.length === 0,
      `Dangerous action instruction wording detected: ${result.dangerousActionInstructionTermsPresent.join(", ")}`,
    );

    const evidence = JSON.parse(await readText(evidencePath));
    ensure(evidence.phase === "Phase567", "Evidence phase must be Phase567.");
    ensure(evidence.blocker === null, "Evidence blocker must be null.");

    for (const key of evidenceExpectedTrue) {
      result.evidenceChecks[key] = evidence[key] === true;
      ensure(result.evidenceChecks[key], `Evidence field ${key} must be true.`);
    }

    for (const key of evidenceExpectedFalse) {
      result.evidenceChecks[key] = evidence[key] === false;
      ensure(result.evidenceChecks[key], `Evidence field ${key} must be false.`);
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
