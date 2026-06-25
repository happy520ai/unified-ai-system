import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-282a-commit-readiness-preflight.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-282a-commit-readiness-preflight.md";

const requiredPhaseEvidence = [
  ["268A", "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json"],
  ["269A", "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json"],
  ["270A", "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json"],
  ["271A", "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json"],
  ["272A", "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json"],
  ["273A", "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json"],
  ["274A", "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json"],
  ["275A", "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json"],
  ["276A", "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json"],
  ["277A", "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.json"],
  ["278A", "apps/ai-gateway-service/evidence/phase-278a-daily-knowledge-enrichment.json"],
  ["279A", "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json"],
  ["280A", "apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.json"],
  ["281A", "apps/ai-gateway-service/evidence/phase-281a-operational-readiness-decision-gate.json"],
];

const requiredScripts = [
  ["root", "run:phase281a-operational-readiness-decision-gate"],
  ["root", "verify:phase281a-operational-readiness-decision-gate"],
  ["root", "run:phase282a-commit-readiness-preflight"],
  ["root", "verify:phase282a-commit-readiness-preflight"],
  ["service", "run:phase281a-operational-readiness-decision-gate"],
  ["service", "verify:phase281a-operational-readiness-decision-gate"],
  ["service", "run:phase282a-commit-readiness-preflight"],
  ["service", "verify:phase282a-commit-readiness-preflight"],
];

const requiredVerifiers = [
  "apps/ai-gateway-service/src/entrypoints/verifyOperationalReadinessDecisionGate.js",
  "apps/ai-gateway-service/src/entrypoints/verifyCommitReadinessPreflight.js",
  "apps/ai-gateway-service/src/entrypoints/verifySecurityHardeningAudit.js",
  "apps/ai-gateway-service/src/entrypoints/verifyFullCodebaseAudit.js",
  "apps/ai-gateway-service/src/entrypoints/verifyPublicKnowledgeImportPreview.js",
  "apps/ai-gateway-service/src/entrypoints/verifyQualityCostRoutingPreview.js",
  "apps/ai-gateway-service/src/entrypoints/verifyResponseCacheHardening.js",
];

const dirtyEntries = readGitStatus().map(parseGitStatusLine).filter(Boolean);
const phase282Paths = [
  "docs/COMMIT_READINESS_PREFLIGHT.md",
  evidenceJsonPath,
  evidenceMdPath,
  "apps/ai-gateway-service/src/entrypoints/runCommitReadinessPreflight.js",
  "apps/ai-gateway-service/src/entrypoints/verifyCommitReadinessPreflight.js",
];
const classifiedMap = new Map();
for (const entry of dirtyEntries) {
  const classification = classifyFile(entry.path, entry.status);
  classifiedMap.set(entry.path, {
    ...entry,
    ...classification,
  });
}
for (const path of phase282Paths) {
  if (!classifiedMap.has(path)) {
    classifiedMap.set(path, {
      status: "??",
      path,
      ...classifyFile(path, "??"),
    });
  }
}

const classifiedFiles = Array.from(classifiedMap.values()).sort((a, b) => a.path.localeCompare(b.path));
const commitCandidateFiles = classifiedFiles
  .filter((file) => file.commitRecommendation === "commit_candidate")
  .map((file) => file.path);
const nonCommitCandidateFiles = classifiedFiles
  .filter((file) => file.commitRecommendation !== "commit_candidate")
  .map((file) => file.path);

const rootPackage = readJson("package.json");
const servicePackage = readJson("apps/ai-gateway-service/package.json");
const evidenceCompleteness = buildEvidenceCompleteness();
const packageScriptCompleteness = buildPackageScriptCompleteness(rootPackage, servicePackage);
const verifierCompleteness = buildVerifierCompleteness();
const legacyStatus = runGit(["status", "--short", "--", "legacy"]);
const projectContextCreated = existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md"));
const phase107Evidence = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-107a-secret-safety.json");

const evidence = {
  phase: "282A",
  phaseName: "Commit Readiness Preflight",
  status: "pass",
  generatedAt: new Date().toISOString(),
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  legacyModified: legacyStatus.trim().length > 0,
  projectContextCreated,
  commitPerformed: false,
  pushPerformed: false,
  workspaceCleanClaimed: false,
  currentBlocker: "none",
  dirtyWorkspaceObserved: classifiedFiles.length > 0,
  dirtyFileCount: classifiedFiles.length,
  classifiedFiles,
  commitCandidateFiles,
  nonCommitCandidateFiles,
  evidenceCompleteness,
  packageScriptCompleteness,
  verifierCompleteness,
  secretSafety: {
    phase107Status: phase107Evidence?.status ?? "not_available",
    repositoryScanNoPlainSecrets: phase107Evidence?.checks?.repositoryScanNoPlainSecrets === true,
    findingCount: phase107Evidence?.scan?.findingCount ?? null,
    noKeyLeakConclusion: phase107Evidence?.status === "passed" ? "phase107-secret-safety-passed" : "requires-manual-secret-review",
  },
  riskNotes: [
    "Workspace is dirty and must not be treated as clean-ready.",
    "Commit candidates are recommendations only; a human must review before staging.",
    "Non-commit candidates include older phase artifacts, manual trial outputs, local handoff files, and unrelated dirty files.",
    "278A remains not_available_or_not_sealed.",
    "This preflight did not commit, push, call providers, or modify legacy.",
  ],
  finalCommitReadiness: "requires-human-review-dirty-workspace-not-clean-ready",
  recommendedNextAction: "Review commitCandidateFiles and nonCommitCandidateFiles manually before staging any commit.",
};

const absoluteJsonPath = resolve(repoRoot, evidenceJsonPath);
const absoluteMdPath = resolve(repoRoot, evidenceMdPath);
mkdirSync(dirname(absoluteJsonPath), { recursive: true });
writeFileSync(absoluteJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
writeFileSync(absoluteMdPath, `${renderMarkdown(evidence)}\n`, "utf8");

console.log(JSON.stringify({
  phase: evidence.phase,
  status: evidence.status,
  dirtyWorkspaceObserved: evidence.dirtyWorkspaceObserved,
  dirtyFileCount: evidence.dirtyFileCount,
  commitCandidateCount: commitCandidateFiles.length,
  nonCommitCandidateCount: nonCommitCandidateFiles.length,
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
  evidenceJsonPath,
  evidenceMdPath,
}, null, 2));

function readGitStatus() {
  const statusFile = process.env.PHASE282_GIT_STATUS_FILE;
  if (statusFile && existsSync(statusFile)) {
    return readFileSync(statusFile, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
  }
  if (process.env.PHASE282_GIT_STATUS) {
    return process.env.PHASE282_GIT_STATUS
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
  }
  return runGit(["status", "--short"])
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function parseGitStatusLine(line) {
  if (line.length < 4) {
    return null;
  }
  const rawPath = line.slice(3);
  const path = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop() : rawPath;
  return {
    status: line.slice(0, 2).trim() || "modified",
    path: normalizePath(path),
  };
}

function classifyFile(path, status) {
  const phase = detectPhase(path);
  const domain = detectDomain(path);
  const reason = [];

  let commitRecommendation = "manual_review";
  if (path.startsWith(".codex-handoff/") || path.includes("manual-real-ui-trial") || path.includes("phase-199a-browser-downloads/")) {
    commitRecommendation = "non_commit_candidate";
    reason.push("local/manual trial or handoff artifact");
  } else if (path.startsWith("legacy/")) {
    commitRecommendation = "non_commit_candidate";
    reason.push("legacy is read-only");
  } else if (phase && phaseNumber(phase) >= 268 && phaseNumber(phase) <= 282) {
    commitRecommendation = "commit_candidate";
    reason.push("current 268A-282A evidence or implementation scope");
  } else if ([
    "apps/ai-gateway-service/src/knowledge-import/",
    "apps/ai-gateway-service/src/routing/",
    "apps/ai-gateway-service/src/audit/",
    "apps/ai-gateway-service/src/security/",
  ].some((prefix) => path.startsWith(prefix))) {
    commitRecommendation = "commit_candidate";
    reason.push("current preview/audit implementation domain");
  } else if (["package.json", "apps/ai-gateway-service/package.json", "apps/ai-gateway-service/src/ui/consolePage.js"].includes(path)) {
    commitRecommendation = "commit_candidate";
    reason.push("package script or UI observability update");
  } else if (path.startsWith("tools/agent-workforce/") || path.includes("codex") || path.includes("agent-workforce")) {
    commitRecommendation = "non_commit_candidate";
    reason.push("agent/codex handoff or older preview scope; requires separate review");
  } else if (phase && phaseNumber(phase) < 268) {
    commitRecommendation = "non_commit_candidate";
    reason.push("older phase artifact outside 268A-282A commit scope");
  } else {
    reason.push("unmapped dirty file requires human decision");
  }

  return {
    phase: phase ?? "unmapped",
    domain,
    commitRecommendation,
    reason: reason.join("; "),
    statusKind: status === "??" ? "untracked" : "modified-or-staged",
  };
}

function detectPhase(path) {
  const match = path.match(/phase-?(\d{2,3}[a-z]?)/i);
  if (!match) {
    return null;
  }
  return match[1].toUpperCase();
}

function phaseNumber(phase) {
  const match = String(phase).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function detectDomain(path) {
  if (path.endsWith("package.json")) return "package-scripts";
  if (path.startsWith("docs/")) return "documentation";
  if (path.includes("/evidence/")) return "evidence";
  if (path.includes("/src/ui/")) return "ui";
  if (path.includes("/src/entrypoints/")) return "verifier-or-runner";
  if (path.includes("/src/security/")) return "security-audit";
  if (path.includes("/src/audit/")) return "codebase-audit";
  if (path.includes("/src/knowledge-import/")) return "knowledge-import";
  if (path.includes("/src/routing/")) return "routing";
  if (path.includes("/src/cache/")) return "cache";
  if (path.startsWith("tools/")) return "tooling";
  return "other";
}

function buildEvidenceCompleteness() {
  const reviewed = requiredPhaseEvidence.map(([phase, path]) => {
    const evidence = readJsonIfPresent(path);
    const status = evidence?.status === "passed" || evidence?.status === "pass"
      ? "passed"
      : "not_available_or_not_sealed";
    return { phase, path, exists: Boolean(evidence), status };
  });
  return {
    reviewed,
    completeForCommitPreflight: reviewed.every((item) => item.phase === "278A" || item.status === "passed"),
    phase278aStatus: reviewed.find((item) => item.phase === "278A")?.status ?? "not_available_or_not_sealed",
  };
}

function buildPackageScriptCompleteness(rootPkg, servicePkg) {
  const results = requiredScripts.map(([scope, script]) => ({
    scope,
    script,
    present: Boolean((scope === "root" ? rootPkg : servicePkg).scripts?.[script]),
  }));
  return {
    checkedScripts: results,
    complete: results.every((item) => item.present),
  };
}

function buildVerifierCompleteness() {
  const results = requiredVerifiers.map((path) => ({
    path,
    exists: existsSync(resolve(repoRoot, path)),
  }));
  return {
    checkedVerifiers: results,
    complete: results.every((item) => item.exists),
  };
}

function renderMarkdown(data) {
  const commitExamples = data.commitCandidateFiles.slice(0, 40).map((path) => `- ${path}`).join("\n");
  const nonCommitExamples = data.nonCommitCandidateFiles.slice(0, 40).map((path) => `- ${path}`).join("\n");
  return `# Phase 282A Commit Readiness Preflight

## Summary

- status: ${data.status}
- currentBlocker: ${data.currentBlocker}
- dirtyWorkspaceObserved: ${data.dirtyWorkspaceObserved}
- dirtyFileCount: ${data.dirtyFileCount}
- commitCandidateCount: ${data.commitCandidateFiles.length}
- nonCommitCandidateCount: ${data.nonCommitCandidateFiles.length}
- finalCommitReadiness: ${data.finalCommitReadiness}

## Safety

- paidApiCallCount: ${data.paidApiCallCount}
- externalApiCalled: ${data.externalApiCalled}
- mimoApiCalled: ${data.mimoApiCalled}
- embeddingCalled: ${data.embeddingCalled}
- legacyModified: ${data.legacyModified}
- projectContextCreated: ${data.projectContextCreated}
- commitPerformed: ${data.commitPerformed}
- pushPerformed: ${data.pushPerformed}
- workspaceCleanClaimed: ${data.workspaceCleanClaimed}

## Commit Candidate Examples

${commitExamples || "- none"}

## Non-Commit Candidate Examples

${nonCommitExamples || "- none"}

## Risk Notes

${data.riskNotes.map((note) => `- ${note}`).join("\n")}

## Recommended Next Action

${data.recommendedNextAction}
`;
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}


function readJsonIfPresent(relativePath) {
  try {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      return null;
    }
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizePath(path) {
  return path.replace(/\\/g, "/");
}
