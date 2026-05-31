import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "270A-token-saving-benchmark";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const benchmarkScriptPath = resolve(serviceRoot, "src/entrypoints/runTokenSavingBenchmark.js");
const verifierPath = resolve(serviceRoot, "src/entrypoints/verifyTokenSavingBenchmark.js");
const docsPath = resolve(repoRoot, "docs/TOKEN_SAVING_BENCHMARK.md");
const uiPath = resolve(serviceRoot, "src/ui/consolePage.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-270a-token-saving-benchmark.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-270a-token-saving-benchmark.md");

const requiredDocMarkers = [
  "Current token-saving capability",
  "What this benchmark cannot prove yet",
  "Most wasteful requests",
  "Best local-only scenarios",
  "Scenarios that need paid API",
  "Scenarios that should use MiMo v2.5 Pro",
  "Scenarios that should require approval",
  "Scenarios that should block",
  "Next five optimizations",
  "Route A",
  "Route B",
  "Route C",
  "Route D",
  "Route E",
];

const checks = [];

try {
  const docsText = readRequiredText(docsPath, "docs_exists");
  const uiText = readRequiredText(uiPath, "ui_exists");
  const evidence = readJson(evidenceJsonPath, "evidence_json_exists");
  const evidenceMarkdown = readRequiredText(evidenceMdPath, "evidence_md_exists");
  const rootPackage = readJson(rootPackagePath, "root_package_exists");
  const servicePackage = readJson(servicePackagePath, "service_package_exists");

  assertCheck("benchmark_script_exists", existsSync(benchmarkScriptPath), benchmarkScriptPath);
  assertCheck("verifier_script_exists", existsSync(verifierPath), verifierPath);
  assertCheck("docs_exists", docsText.length > 0, docsPath);
  assertCheck("evidence_json_exists", evidence.phase === PHASE, evidenceJsonPath);
  assertCheck("evidence_md_exists", evidenceMarkdown.includes("Phase 270A"), evidenceMdPath);
  assertCheck("status_passed", evidence.status === "passed", evidence.status);
  assertCheck("at_least_8_cases", Array.isArray(evidence.cases) && evidence.cases.length >= 8, evidence.cases?.length);

  for (const marker of requiredDocMarkers) {
    assertCheck(`doc_marker_${slug(marker)}`, docsText.includes(marker), marker);
  }

  for (const [index, item] of (evidence.cases ?? []).entries()) {
    assertCheck(`case_${index}_id_present`, typeof item.caseId === "string" && item.caseId.length > 0, item.caseId);
    assertCheck(`case_${index}_naive_input_numeric`, Number.isFinite(Number(item.naiveEstimatedInputTokens)), item.caseId);
    assertCheck(`case_${index}_optimized_input_numeric`, Number.isFinite(Number(item.optimizedEstimatedInputTokens)), item.caseId);
    assertCheck(`case_${index}_tokens_saved_numeric`, Number.isFinite(Number(item.estimatedTokensSaved)), item.caseId);
    assertCheck(`case_${index}_savings_ratio_numeric`, Number.isFinite(Number(item.savingsRatio)), item.caseId);
    assertCheck(`case_${index}_decision_present`, ["allow", "require_approval", "block"].includes(item.decision), item.caseId);
    assertCheck(`case_${index}_recommended_actions_array`, Array.isArray(item.recommendedActions), item.caseId);
  }

  assertCheck("gaps_populated", Array.isArray(evidence.gaps) && evidence.gaps.length >= 5, evidence.gaps?.length);
  assertCheck("better_plan_populated", Array.isArray(evidence.betterPlan) && evidence.betterPlan.length >= 5, evidence.betterPlan?.length);
  assertCheck("summary_case_count_matches", evidence.summary?.caseCount === evidence.cases?.length, evidence.summary?.caseCount);
  assertCheck("summary_average_savings_numeric", Number.isFinite(Number(evidence.summary?.averageSavingsRatio)), evidence.summary?.averageSavingsRatio);
  assertCheck("summary_total_tokens_saved_numeric", Number.isFinite(Number(evidence.summary?.estimatedTotalTokensSaved)), evidence.summary?.estimatedTotalTokensSaved);
  assertCheck("ui_marker_exists", uiText.includes("Token Saving Benchmark") && uiText.includes("averageSavingsRatio"), "consolePage.js");
  assertCheck(
    "root_benchmark_script_present",
    rootPackage.scripts?.["benchmark:token-saving"] === "pnpm --filter @unified-ai-system/ai-gateway-service benchmark:token-saving",
    "package.json"
  );
  assertCheck(
    "root_verify_script_present",
    rootPackage.scripts?.["verify:phase270a-token-saving-benchmark"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase270a-token-saving-benchmark",
    "package.json"
  );
  assertCheck(
    "service_benchmark_script_present",
    servicePackage.scripts?.["benchmark:token-saving"] === "node ./src/entrypoints/runTokenSavingBenchmark.js",
    "apps/ai-gateway-service/package.json"
  );
  assertCheck(
    "service_verify_script_present",
    servicePackage.scripts?.["verify:phase270a-token-saving-benchmark"] === "node ./src/entrypoints/verifyTokenSavingBenchmark.js",
    "apps/ai-gateway-service/package.json"
  );

  assertCheck("safety_fields_all_false", safetyFieldsAllFalse(evidence.safety), JSON.stringify(evidence.safety));
  assertCheck("default_nvidia_chat_lane_unchanged", evidence.defaultNvidiaChatLaneChanged === false && evidence.safety?.defaultNvidiaChatLaneChanged === false, evidenceJsonPath);
  assertCheck("mimo_not_default", evidence.mimoSetAsDefault === false && evidence.safety?.mimoSetAsDefault === false, evidenceJsonPath);
  assertCheck("long_context_not_sent_to_paid_api", evidence.longContextSentToPaidApi === false && evidence.safety?.longContextSentToPaidApi === false, evidenceJsonPath);
  assertCheck("paid_api_call_count_zero", evidence.paidApiCallCount === 0, evidence.paidApiCallCount);
  assertCheck("legacy_not_modified_in_evidence", evidence.safety?.legacyModified === false, evidenceJsonPath);
  assertCheck("project_context_not_created_in_evidence", evidence.safety?.projectContextCreated === false, evidenceJsonPath);
  assertCheck("project_context_absent", !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")), "PROJECT_CONTEXT.md");
  assertCheck("legacy_clean_for_phase", getLegacyStatus() === "", "legacy/");
  assertCheck("no_plaintext_api_key_in_docs_evidence", !hasPlaintextKeyPattern([docsText, evidenceMarkdown, JSON.stringify(evidence)]), "docs/evidence");

  const failedChecks = checks.filter((check) => !check.passed);
  const verifiedEvidence = {
    ...evidence,
    verifiedAt: new Date().toISOString(),
    verifier: {
      name: "verifyTokenSavingBenchmark",
      status: failedChecks.length === 0 ? "passed" : "failed",
      checks,
    },
  };

  await writeFile(evidenceJsonPath, `${JSON.stringify(verifiedEvidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderVerifiedMarkdown(verifiedEvidence), "utf8");

  if (failedChecks.length) {
    console.error(JSON.stringify({ phase: PHASE, status: "failed", failedChecks }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      phase: PHASE,
      status: "passed",
      checks: checks.length,
      evidenceJsonPath,
      evidenceMdPath,
    }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({
    phase: PHASE,
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
    checks,
  }, null, 2));
  process.exitCode = 1;
}

function readRequiredText(path, checkName) {
  const exists = existsSync(path);
  assertCheck(checkName, exists, path);
  return exists ? readFileSync(path, "utf8") : "";
}

function readJson(path, checkName) {
  const text = readRequiredText(path, checkName);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    assertCheck(`${checkName}_valid_json`, false, error instanceof Error ? error.message : String(error));
    return {};
  }
}

function assertCheck(name, passed, detail = "") {
  checks.push({
    name,
    passed: Boolean(passed),
    detail: String(detail ?? ""),
  });
}

function safetyFieldsAllFalse(safety = {}) {
  const required = [
    "plainTextApiKeyWritten",
    "apiKeyPrinted",
    "defaultNvidiaChatLaneChanged",
    "mimoSetAsDefault",
    "legacyModified",
    "projectContextCreated",
    "codexCliInvoked",
    "codexExecInvoked",
    "workflowRunnerEnabled",
    "worktreeCreated",
    "autoCommit",
    "autoPush",
    "longContextSentToPaidApi",
    "largeOutputRequested",
  ];
  return required.every((field) => safety[field] === false);
}

function hasPlaintextKeyPattern(texts) {
  const combined = texts.join("\n");
  const patterns = [
    /Bearer\s+(?!<masked>)[A-Za-z0-9._-]{16,}/i,
    /Authorization\s*[:=]\s*(?!<masked>)[A-Za-z0-9._\-\s]{16,}/i,
    /MIMO_API_KEY\s*[:=]\s*(?!<masked>|<redacted>|present|true|false|n\/a)[A-Za-z0-9._-]{12,}/i,
    /sk-[A-Za-z0-9]{20,}/i,
  ];
  return patterns.some((pattern) => pattern.test(combined));
}

function getLegacyStatus() {
  try {
    return execFileSync("git", ["-c", `safe.directory=${repoRoot}`, "status", "--short", "--", "legacy"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "legacy-status-unavailable";
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function renderVerifiedMarkdown(evidence) {
  return `# Phase 270A Token Saving Benchmark Evidence

- Phase: ${evidence.phase}
- Status: ${evidence.status}
- Conclusion: ${evidence.conclusion}
- Generated at: ${evidence.generatedAt}
- Verified at: ${evidence.verifiedAt}
- Mode: ${evidence.mode}
- Default NVIDIA /chat lane changed: ${evidence.defaultNvidiaChatLaneChanged}
- MiMo set as default: ${evidence.mimoSetAsDefault}
- Paid API call count: ${evidence.paidApiCallCount}
- Long context sent to paid API: ${evidence.longContextSentToPaidApi}

## Summary

- caseCount: ${evidence.summary.caseCount}
- averageSavingsRatio: ${evidence.summary.averageSavingsRatio}
- maxSavingsRatio: ${evidence.summary.maxSavingsRatio}
- estimatedTotalNaiveTokens: ${evidence.summary.estimatedTotalNaiveTokens}
- estimatedTotalOptimizedTokens: ${evidence.summary.estimatedTotalOptimizedTokens}
- estimatedTotalTokensSaved: ${evidence.summary.estimatedTotalTokensSaved}
- cacheEligibleCount: ${evidence.summary.cacheEligibleCount}
- blockedCount: ${evidence.summary.blockedCount}
- requireApprovalCount: ${evidence.summary.requireApprovalCount}
- modelTierDowngradeOpportunities: ${evidence.summary.modelTierDowngradeOpportunities}

## Cases

${evidence.cases.map((item) => `### ${item.caseId}

- mode: ${item.mode}
- naiveEstimatedInputTokens: ${item.naiveEstimatedInputTokens}
- optimizedEstimatedInputTokens: ${item.optimizedEstimatedInputTokens}
- estimatedTokensSaved: ${item.estimatedTokensSaved}
- savingsRatio: ${item.savingsRatio}
- decision: ${item.decision}
- recommendedActions: ${item.recommendedActions.join(", ") || "none"}
`).join("\n")}

## Gaps

${evidence.gaps.map((gap) => `- ${gap}`).join("\n")}

## Better Plan

${evidence.betterPlan.map((item) => `- ${item.route}: ${item.title} (${item.recommendation}) - ${item.value}`).join("\n")}

## Safety

${Object.entries(evidence.safety).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Verifier

- Verifier: ${evidence.verifier?.name ?? "n/a"}
- Verifier status: ${evidence.verifier?.status ?? "n/a"}
- Checks: ${evidence.verifier?.checks?.length ?? 0}
`;
}
