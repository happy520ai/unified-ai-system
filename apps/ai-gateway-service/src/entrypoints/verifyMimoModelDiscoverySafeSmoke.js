import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "271A-mimo-model-id-discovery";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const discoverScriptPath = resolve(serviceRoot, "src/entrypoints/discoverMimoModelId.js");
const verifierPath = resolve(serviceRoot, "src/entrypoints/verifyMimoModelDiscoverySafeSmoke.js");
const docsPath = resolve(repoRoot, "docs/MIMO_MODEL_ID_DISCOVERY.md");
const uiPath = resolve(serviceRoot, "src/ui/consolePage.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-271a-mimo-model-id-discovery.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-271a-mimo-model-id-discovery.md");
const phase269EvidencePath = resolve(serviceRoot, "evidence/phase-269a-mimo-paid-api-safe-smoke.json");

const requiredDocSections = [
  "Purpose",
  "Why Phase 269A failed",
  "Current MiMo configuration",
  "Model ID discovery strategy",
  "Candidate model IDs",
  "/models endpoint behavior",
  "Safe smoke rules",
  "Token guard usage",
  "Default NVIDIA /chat protection",
  "Safety boundaries",
  "Evidence files",
  "Verification commands",
  "Failure modes",
  "Next phase options",
];

const requiredSafetyMarkers = [
  "This phase does not set MiMo as default.",
  "This phase does not change the default NVIDIA `/chat` lane.",
  "This phase sends no project long context.",
  "This phase uses at most tiny smoke calls.",
  "This phase writes no plaintext API key.",
  "This phase is not production routing.",
];

const checks = [];

try {
  const docsText = readRequiredText(docsPath, "docs_exists");
  const uiText = readRequiredText(uiPath, "ui_exists");
  const evidence = readJson(evidenceJsonPath, "evidence_json_exists");
  const evidenceMarkdown = readRequiredText(evidenceMdPath, "evidence_md_exists");
  const rootPackage = readJson(rootPackagePath, "root_package_exists");
  const servicePackage = readJson(servicePackagePath, "service_package_exists");
  const phase269Evidence = existsSync(phase269EvidencePath) ? readJson(phase269EvidencePath, "phase269_evidence_exists") : null;

  assertCheck("discover_script_exists", existsSync(discoverScriptPath), discoverScriptPath);
  assertCheck("verifier_script_exists", existsSync(verifierPath), verifierPath);
  assertCheck("docs_exists", docsText.length > 0, docsPath);
  assertCheck("evidence_json_exists", evidence.phase === PHASE, evidenceJsonPath);
  assertCheck("evidence_md_exists", evidenceMarkdown.includes("Phase 271A"), evidenceMdPath);
  assertCheck("package_root_script_exists", rootPackage.scripts?.["discover:mimo-model-id"] === "pnpm --filter @unified-ai-system/ai-gateway-service discover:mimo-model-id", "package.json");
  assertCheck("package_root_verify_script_exists", rootPackage.scripts?.["verify:phase271a-mimo-model-id-discovery"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase271a-mimo-model-id-discovery", "package.json");
  assertCheck("package_service_script_exists", servicePackage.scripts?.["discover:mimo-model-id"] === "node ./src/entrypoints/discoverMimoModelId.js", "apps/ai-gateway-service/package.json");
  assertCheck("package_service_verify_script_exists", servicePackage.scripts?.["verify:phase271a-mimo-model-id-discovery"] === "node ./src/entrypoints/verifyMimoModelDiscoverySafeSmoke.js", "apps/ai-gateway-service/package.json");
  assertCheck("ui_marker_exists", uiText.includes("MiMo Model ID Discovery") && uiText.includes("phase-271a-mimo-model-id-discovery.json"), "consolePage.js");

  for (const section of requiredDocSections) {
    assertCheck(`doc_section_${slug(section)}`, docsText.includes(`## ${section}`), section);
  }
  for (const marker of requiredSafetyMarkers) {
    assertCheck(`safety_marker_${slug(marker)}`, docsText.includes(marker), marker);
  }

  assertCheck("no_plaintext_api_key_in_docs_evidence_ui", !hasPlaintextKeyPattern([docsText, evidenceMarkdown, uiText, JSON.stringify(evidence)]), "docs/evidence/ui");
  assertCheck("legacy_not_modified_in_evidence", evidence.safety?.legacyModified === false, evidenceJsonPath);
  assertCheck("project_context_not_created_in_evidence", evidence.safety?.projectContextCreated === false, evidenceJsonPath);
  assertCheck("default_nvidia_chat_lane_unchanged", evidence.defaultNvidiaChatLaneChanged === false && evidence.safety?.defaultNvidiaChatLaneChanged === false, evidenceJsonPath);
  assertCheck("mimo_not_default", evidence.mimoSetAsDefault === false && evidence.safety?.mimoSetAsDefault === false, evidenceJsonPath);
  assertCheck("long_context_not_sent_to_paid_api", evidence.safety?.longContextSentToPaidApi === false && evidence.smoke?.longContextSent === false, evidenceJsonPath);
  assertCheck("large_output_not_requested", evidence.safety?.largeOutputRequested === false && Number(evidence.smoke?.maxOutputTokens) <= 32, evidenceJsonPath);
  assertCheck("stress_test_not_executed", evidence.safety?.stressTestExecuted === false, evidenceJsonPath);
  assertCheck("paid_api_call_count_within_limit", Number(evidence.smoke?.paidApiCallCount ?? 0) <= 3, evidence.smoke?.paidApiCallCount);
  assertCheck("max_output_tokens_within_limit", Number(evidence.smoke?.maxOutputTokens ?? 0) <= 32, evidence.smoke?.maxOutputTokens);
  assertCheck("successful_smoke_count_within_limit", Number(evidence.smoke?.successfulSmokeCallCount ?? 0) <= 1, evidence.smoke?.successfulSmokeCallCount);

  if (evidence.status === "passed") {
    assertCheck("passed_working_model_present", typeof evidence.configuration?.discoveredWorkingModelId === "string" && evidence.configuration.discoveredWorkingModelId.length > 0, evidence.configuration?.discoveredWorkingModelId);
    assertCheck("passed_smoke_success_true", evidence.smoke?.success === true, evidenceJsonPath);
    assertCheck("passed_text_received_true", evidence.smoke?.textReceived === true, evidenceJsonPath);
    assertCheck("passed_blocker_none", evidence.blocker?.type === "none", evidence.blocker?.type);
  } else if (["failed", "blocked"].includes(evidence.status)) {
    assertCheck("failed_or_blocked_has_blocker", evidence.blocker?.type && evidence.blocker.type !== "none", evidence.blocker?.type);
    assertCheck("failed_or_blocked_no_success_claim", evidence.smoke?.success === false, evidenceJsonPath);
    assertCheck("phase269_not_falsely_marked_passed", phase269Evidence?.status !== "passed", phase269Evidence?.status ?? "missing");
  } else {
    assertCheck("status_valid", false, evidence.status);
  }

  assertCheck("project_context_absent", !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")), "PROJECT_CONTEXT.md");
  assertCheck("legacy_clean_for_phase", getLegacyStatus() === "", "legacy/");

  const failedChecks = checks.filter((check) => !check.passed);
  const verifiedEvidence = {
    ...evidence,
    verifiedAt: new Date().toISOString(),
    verifier: {
      name: "verifyMimoModelDiscoverySafeSmoke",
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
      evidenceStatus: evidence.status,
      discoveredWorkingModelId: evidence.configuration?.discoveredWorkingModelId ?? null,
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

function hasPlaintextKeyPattern(texts) {
  const combined = texts.join("\n");
  const patterns = [
    /Bearer\s+(?!<masked>)[A-Za-z0-9._-]{16,}/i,
    /Authorization\s*[:=]\s*(?!<masked>)[A-Za-z0-9._\-\s]{16,}/i,
    /api-key\s*[:=]\s*(?!<masked>|<redacted>)[A-Za-z0-9._-]{12,}/i,
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
  return `# Phase 271A MiMo Model ID Discovery Evidence

## Goal

Identify the working MiMo model id safely, without changing the default NVIDIA /chat lane and without writing plaintext API keys.

## Configuration

- Provider: ${evidence.provider}
- Status: ${evidence.status}
- Conclusion: ${evidence.conclusion}
- Verified at: ${evidence.verifiedAt}
- Configured but not default: ${evidence.configuredButNotDefault}
- Default provider: ${evidence.defaultProvider}
- Default NVIDIA /chat lane changed: ${evidence.defaultNvidiaChatLaneChanged}
- MiMo set as default: ${evidence.mimoSetAsDefault}
- Base URL present: ${evidence.configuration?.baseUrlPresent}
- API key present: ${evidence.configuration?.apiKeyPresent}
- API key masked: ${evidence.configuration?.apiKeyMasked}
- Current configured model id: ${evidence.configuration?.configuredModelId ?? "n/a"}
- Discovered working model id: ${evidence.configuration?.discoveredWorkingModelId ?? "n/a"}
- Model discovery method: ${evidence.configuration?.modelDiscoveryMethod ?? "n/a"}

## Models Endpoint

- Attempted: ${evidence.modelsEndpoint?.attempted}
- Available: ${evidence.modelsEndpoint?.available}
- Model count: ${evidence.modelsEndpoint?.modelCount}
- Matching models: ${(evidence.modelsEndpoint?.matchingModels ?? []).join(", ") || "none"}

## Tiny Smoke

- Attempted: ${evidence.smoke?.attempted}
- Paid API call count: ${evidence.smoke?.paidApiCallCount}
- Successful smoke call count: ${evidence.smoke?.successfulSmokeCallCount}
- Max output tokens: ${evidence.smoke?.maxOutputTokens}
- Long context sent: ${evidence.smoke?.longContextSent}
- HTTP status: ${evidence.smoke?.httpStatus}
- Success: ${evidence.smoke?.success}
- Text received: ${evidence.smoke?.textReceived}
- Exact smoke text matched: ${evidence.smoke?.exactSmokeTextMatched}
- Usage returned: ${evidence.smoke?.usageReturned}
- Input tokens: ${evidence.smoke?.inputTokens ?? "n/a"}
- Output tokens: ${evidence.smoke?.outputTokens ?? "n/a"}
- Total tokens: ${evidence.smoke?.totalTokens ?? "n/a"}

## Blocker

- Type: ${evidence.blocker?.type}
- Message: ${evidence.blocker?.message || "none"}

## Safety

${Object.entries(evidence.safety ?? {}).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Verifier

- Verifier: ${evidence.verifier?.name ?? "n/a"}
- Verifier status: ${evidence.verifier?.status ?? "n/a"}
- Checks: ${evidence.verifier?.checks?.length ?? 0}

No plaintext API key and no Authorization header are written in this evidence.
`;
}
