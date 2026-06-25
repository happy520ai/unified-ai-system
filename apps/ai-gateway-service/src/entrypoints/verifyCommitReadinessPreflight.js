import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const docsPath = "docs/COMMIT_READINESS_PREFLIGHT.md";
const jsonPath = "apps/ai-gateway-service/evidence/phase-282a-commit-readiness-preflight.json";
const mdPath = "apps/ai-gateway-service/evidence/phase-282a-commit-readiness-preflight.md";

function main() {
  const evidence = readJson(jsonPath);
  const docsText = readText(docsPath);
  const combinedText = [docsText, readText(jsonPath), readText(mdPath)].join("\n");
  const finalReadiness = String(evidence.finalCommitReadiness ?? "");

  const checks = {
    docsExists: fileExists(docsPath),
    evidenceJsonExists: fileExists(jsonPath),
    evidenceMdExists: fileExists(mdPath),
    phaseIs282A: evidence.phase === "282A",
    statusPass: evidence.status === "pass",
    currentBlockerNone: evidence.currentBlocker === "none",
    paidApiCallCountZero: evidence.paidApiCallCount === 0,
    externalApiCalledFalse: evidence.externalApiCalled === false,
    mimoApiCalledFalse: evidence.mimoApiCalled === false,
    embeddingCalledFalse: evidence.embeddingCalled === false,
    legacyModifiedFalse: evidence.legacyModified === false,
    projectContextCreatedFalse: evidence.projectContextCreated === false && !fileExists("PROJECT_CONTEXT.md"),
    commitPerformedFalse: evidence.commitPerformed === false,
    pushPerformedFalse: evidence.pushPerformed === false,
    workspaceCleanClaimedFalse: evidence.workspaceCleanClaimed === false,
    dirtyWorkspaceObservedTrue: evidence.dirtyWorkspaceObserved === true,
    commitCandidateFilesArray: Array.isArray(evidence.commitCandidateFiles),
    nonCommitCandidateFilesArray: Array.isArray(evidence.nonCommitCandidateFiles),
    finalReadinessNotCleanReady: finalReadiness.length > 0
      && !/^clean-ready$/i.test(finalReadiness)
      && /not-clean-ready|dirty|human|review/i.test(finalReadiness),
    docsNoCommitNoPush: docsText.includes("No commit was performed") && docsText.includes("No push was performed"),
    docsRequiredSectionsPresent: [
      "Executive Summary",
      "Dirty Workspace Overview",
      "Phase-Based File Classification",
      "Evidence Completeness Review",
      "Package Scripts Review",
      "Verifier Review",
      "Secret Safety Review",
      "legacy/ Boundary Review",
      "PROJECT_CONTEXT.md Boundary Review",
      "Commit Candidate Files",
      "Non-Commit Candidate Files",
      "Risk Notes",
      "Final Commit Readiness Judgment",
      "Recommended Commit Strategy",
    ].every((section) => docsText.includes(`## ${section}`)),
    noPlaintextApiKeyInDocsEvidence: !containsPlaintextApiKey(combinedText),
  };

  const failures = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);

  const result = {
    phase: "282A",
    status: failures.length === 0 ? "passed" : "failed",
    checks: Object.keys(checks).length,
    failures,
    evidenceStatus: evidence.status,
    dirtyWorkspaceObserved: evidence.dirtyWorkspaceObserved,
    dirtyFileCount: evidence.dirtyFileCount,
    commitCandidateCount: evidence.commitCandidateFiles?.length ?? 0,
    nonCommitCandidateCount: evidence.nonCommitCandidateFiles?.length ?? 0,
    currentBlocker: evidence.currentBlocker,
    finalCommitReadiness: evidence.finalCommitReadiness,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    embeddingCalled: evidence.embeddingCalled,
    legacyModified: evidence.legacyModified,
    projectContextCreated: evidence.projectContextCreated,
    commitPerformed: evidence.commitPerformed,
    pushPerformed: evidence.pushPerformed,
    workspaceCleanClaimed: evidence.workspaceCleanClaimed,
    evidenceJsonPath: resolve(repoRoot, jsonPath),
    evidenceMdPath: resolve(repoRoot, mdPath),
  };

  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function fileExists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}



function containsPlaintextApiKey(text) {
  return /sk-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /nvapi-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /Bearer\s+(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9._-]{24,}/i.test(text)
    || /(Authorization|api-key)\s*[:=]\s*[A-Za-z0-9._-]{24,}/i.test(text);
}

main();
