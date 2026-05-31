import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const docs = {
  intake: "docs/phase573-real-non-codex-feedback-intake.md",
  summary: "docs/phase573-non-codex-feedback-summary.md",
  ledger: "docs/phase573-non-codex-issue-classification-ledger.md",
  common: "docs/phase573-common-issues-and-patterns.md",
  candidates: "docs/phase573-low-risk-fix-candidates.md",
  report: "docs/phase573-execution-report.md",
};

const evidencePath =
  "apps/ai-gateway-service/evidence/phase573/real-non-codex-feedback-intake-result.json";

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
    phase: "Phase573",
    name: "Real Non-Codex Multi-Human Internal Trial Feedback Intake and Classification",
    completed: true,
    recommended_sealed: null,
    blocker: null,
    docsExist: {},
    boundaryMissingTerms: [],
    dangerousActionPhrasesPresent: [],
  };

  try {
    for (const [key, path] of Object.entries(docs)) {
      result.docsExist[key] = existsSync(resolve(path));
      ensure(result.docsExist[key], `Missing Phase573 doc: ${path}`);
    }
    ensure(existsSync(resolve(evidencePath)), `Missing Phase573 evidence: ${evidencePath}`);

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

    ensure(evidence.phase === "Phase573", "Evidence phase must be Phase573.");
    ensure(evidence.basedOnPhase572 === true, "Evidence must be based on Phase572.");
    ensure(evidence.minimumRequiredFeedbackCount === 2, "minimumRequiredFeedbackCount must be 2.");
    ensure(evidence.targetFeedbackCount === 3, "targetFeedbackCount must be 3.");
    ensure(Array.isArray(evidence.feedbackSources), "feedbackSources must be an array.");
    ensure(evidence.feedbackSourceCount === evidence.feedbackSources.length, "feedbackSourceCount must match feedbackSources length.");

    if (evidence.feedbackSourceCount < evidence.minimumRequiredFeedbackCount) {
      ensure(evidence.completed === false, "Insufficient feedback must keep completed=false.");
      ensure(evidence.recommended_sealed === false, "Insufficient feedback must keep recommended_sealed=false.");
      ensure(evidence.realNonCodexFeedbackCollected === false, "Insufficient feedback must keep realNonCodexFeedbackCollected=false.");
      ensure(evidence.blocker === "non_codex_feedback_count_below_minimum", "Insufficient feedback must record the expected blocker.");
    } else {
      ensure(evidence.completed === true, "Sufficient feedback should set completed=true.");
      ensure(evidence.recommended_sealed === true, "Sufficient feedback should set recommended_sealed=true.");
      ensure(evidence.realNonCodexFeedbackCollected === true, "Sufficient feedback should set realNonCodexFeedbackCollected=true.");
      ensure(evidence.feedbackSources.every((source) => source.nonCodex === true), "Every feedback source must be nonCodex=true.");
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
