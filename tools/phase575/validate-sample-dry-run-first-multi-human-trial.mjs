import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const docs = {
  trial: "docs/phase575-sample-dry-run-first-multi-human-trial.md",
  summary: "docs/phase575-human-feedback-summary.md",
  sources: "docs/phase575-human-feedback-source-ledger.md",
  ledger: "docs/phase575-issue-classification-ledger.md",
  common: "docs/phase575-common-issues-and-patterns.md",
  candidates: "docs/phase575-low-risk-fix-candidates.md",
  report: "docs/phase575-execution-report.md",
};

const evidencePath =
  "apps/ai-gateway-service/evidence/phase575/sample-dry-run-first-multi-human-trial-result.json";

const requiredBoundaryTerms = [
  "no-provider-call",
  "no-secret",
  "no-deploy",
  "no-billing",
  "no-invoice",
  "Yiyi / character remains hidden",
];

const dangerousActionPhrases = [
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

function countLedgerIssues(ledgerText, label) {
  const match = ledgerText.match(new RegExp(`- ${label}:\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

async function main() {
  const result = {
    phase: "Phase575",
    name: "Sample Dry-run First Multi-Human Trial Validator",
    completed: true,
    recommended_sealed: null,
    blocker: null,
    docsExist: {},
    boundaryMissingTerms: [],
    dangerousActionPhrasesPresent: [],
    feedbackSourceCount: null,
  };

  try {
    for (const [key, path] of Object.entries(docs)) {
      result.docsExist[key] = existsSync(resolve(path));
      ensure(result.docsExist[key], `Missing Phase575 doc: ${path}`);
    }
    ensure(existsSync(resolve(evidencePath)), `Missing Phase575 evidence: ${evidencePath}`);

    const [allDocs, ledgerText, evidenceText] = await Promise.all([
      Promise.all(Object.values(docs).map((path) => read(path))).then((parts) => parts.join("\n\n")),
      read(docs.ledger),
      read(evidencePath),
    ]);
    const evidence = JSON.parse(evidenceText);

    result.boundaryMissingTerms = missingTerms(allDocs, requiredBoundaryTerms);
    result.dangerousActionPhrasesPresent = presentTerms(allDocs, dangerousActionPhrases);
    ensure(result.boundaryMissingTerms.length === 0, `Missing boundary terms: ${result.boundaryMissingTerms.join(", ")}`);
    ensure(
      result.dangerousActionPhrasesPresent.length === 0,
      `Dangerous action phrases present in docs: ${result.dangerousActionPhrasesPresent.join(", ")}`,
    );

    ensure(evidence.phase === "Phase575", "Evidence phase must be Phase575.");
    ensure(evidence.basedOnPhase574 === true, "Evidence must be based on Phase574.");
    ensure(evidence.minimumRequiredFeedbackCount === 2, "minimumRequiredFeedbackCount must be 2.");
    ensure(evidence.targetFeedbackCount === 3, "targetFeedbackCount must be 3.");
    ensure(Array.isArray(evidence.feedbackSources), "feedbackSources must be an array.");
    ensure(evidence.feedbackSourceCount === evidence.feedbackSources.length, "feedbackSourceCount must match feedbackSources length.");

    result.feedbackSourceCount = evidence.feedbackSourceCount;

    if (evidence.feedbackSourceCount < evidence.minimumRequiredFeedbackCount) {
      ensure(evidence.completed === false, "Insufficient feedback must keep completed=false.");
      ensure(evidence.recommended_sealed === false, "Insufficient feedback must keep recommended_sealed=false.");
      ensure(evidence.realNonCodexFeedbackCollected === false, "Insufficient feedback must keep realNonCodexFeedbackCollected=false.");
      ensure(evidence.allTestersUsedSampleDryRun === false, "Insufficient feedback must keep allTestersUsedSampleDryRun=false.");
      ensure(
        evidence.blocker === "sample_dry_run_non_codex_feedback_count_below_minimum",
        "Insufficient feedback must record the expected blocker.",
      );
    } else {
      ensure(evidence.completed === true, "Sufficient feedback should set completed=true.");
      ensure(evidence.recommended_sealed === true, "Sufficient feedback should set recommended_sealed=true.");
      ensure(evidence.realNonCodexFeedbackCollected === true, "Sufficient feedback should set realNonCodexFeedbackCollected=true.");
      ensure(evidence.allTestersUsedSampleDryRun === true, "Every counted tester must use sample dry-run.");
      ensure(evidence.feedbackSources.every((source) => source.nonCodex === true), "Every feedback source must be nonCodex=true.");
      ensure(evidence.feedbackSources.every((source) => source.usedSampleDryRun === true), "Every feedback source must use sample dry-run.");
      ensure(evidence.feedbackSources.every((source) => !String(source.testerId || "").toLowerCase().includes("codex")), "Codex feedback must not be counted as non-Codex.");
    }

    ensure(countLedgerIssues(ledgerText, "P0 blocker") === evidence.p0BlockerCount, "P0 count must match ledger.");
    ensure(countLedgerIssues(ledgerText, "P1 high") === evidence.p1HighIssueCount, "P1 count must match ledger.");
    ensure(countLedgerIssues(ledgerText, "P2 medium") === evidence.p2MediumIssueCount, "P2 count must match ledger.");
    ensure(countLedgerIssues(ledgerText, "P3 low") === evidence.p3LowIssueCount, "P3 count must match ledger.");

    for (const key of [
      "characterModuleVisible",
      "yiyiVisible",
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

    result.recommended_sealed = evidence.recommended_sealed;
    result.blocker = evidence.blocker;
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
