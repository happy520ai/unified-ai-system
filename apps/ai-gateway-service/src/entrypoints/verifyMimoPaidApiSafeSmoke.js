import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const PHASE = "269A-mimo-paid-api-safe-smoke";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const smokeScriptPath = resolve(serviceRoot, "src/entrypoints/smokeMimoPaidRoute.js");
const verifierPath = resolve(serviceRoot, "src/entrypoints/verifyMimoPaidApiSafeSmoke.js");
const docsPath = resolve(repoRoot, "docs/MIMO_PAID_API_SAFE_SMOKE.md");
const uiPath = resolve(serviceRoot, "src/ui/consolePage.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-269a-mimo-paid-api-safe-smoke.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-269a-mimo-paid-api-safe-smoke.md");

const requiredDocSections = [
  "Purpose",
  "Current status",
  "Configuration source",
  "Safety boundaries",
  "What this smoke does",
  "What this smoke does not do",
  "Token/cost control",
  "Exact smoke command",
  "Evidence output",
  "Failure modes",
  "Default provider protection",
  "Verification commands",
  "Next phase options",
];

const requiredSafetyMarkers = [
  "no default NVIDIA `/chat` lane change",
  "no MiMo default provider switch",
  "no plaintext API key",
  "no full Authorization header output",
  "no long project context",
  "no multi-turn test",
  "no retry loop",
  "no pressure test",
  "no automatic fallback to a paid model",
  "no production-ready claim",
  "AI_GATEWAY_DEFAULT_PROVIDER=nvidia",
  "AI_GATEWAY_FALLBACK_ENABLED=false",
];

const checks = [];

try {
  const docsText = readRequiredText(docsPath, "docs_exists");
  const uiText = readRequiredText(uiPath, "ui_exists");
  const rootPackage = readJson(rootPackagePath, "root_package_exists");
  const servicePackage = readJson(servicePackagePath, "service_package_exists");
  const evidence = readJson(evidenceJsonPath, "evidence_json_exists");
  const evidenceMarkdown = readRequiredText(evidenceMdPath, "evidence_markdown_exists");

  assertCheck("smoke_script_exists", existsSync(smokeScriptPath), smokeScriptPath);
  assertCheck("verifier_script_exists", existsSync(verifierPath), verifierPath);
  assertCheck("docs_exists", docsText.length > 0, docsPath);
  assertCheck("evidence_json_exists", evidence.phase === PHASE, evidenceJsonPath);
  assertCheck("evidence_markdown_exists", evidenceMarkdown.includes("Phase 269A"), evidenceMdPath);

  for (const section of requiredDocSections) {
    assertCheck(`docs_section_${slug(section)}`, docsText.includes(`## ${section}`), section);
  }

  for (const marker of requiredSafetyMarkers) {
    assertCheck(`safety_marker_${slug(marker)}`, docsText.includes(marker), marker);
  }

  assertCheck(
    "root_smoke_script_exists",
    rootPackage.scripts?.["smoke:mimo-paid-route"] === "pnpm --filter @unified-ai-system/ai-gateway-service smoke:mimo-paid-route",
    "package.json"
  );
  assertCheck(
    "root_verify_script_exists",
    rootPackage.scripts?.["verify:phase269a-mimo-paid-api-safe-smoke"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase269a-mimo-paid-api-safe-smoke",
    "package.json"
  );
  assertCheck(
    "service_smoke_script_exists",
    servicePackage.scripts?.["smoke:mimo-paid-route"] === "node ./src/entrypoints/smokeMimoPaidRoute.js",
    "apps/ai-gateway-service/package.json"
  );
  assertCheck(
    "service_verify_script_exists",
    servicePackage.scripts?.["verify:phase269a-mimo-paid-api-safe-smoke"] === "node ./src/entrypoints/verifyMimoPaidApiSafeSmoke.js",
    "apps/ai-gateway-service/package.json"
  );

  assertCheck("ui_contains_mimo_panel", uiText.includes("MiMo Paid API Safe Smoke"), "consolePage.js");
  assertCheck("ui_contains_not_default_marker", uiText.includes("configured but not default"), "consolePage.js");
  assertCheck("ui_contains_no_plaintext_key_marker", uiText.includes("no plaintext API key"), "consolePage.js");

  assertCheck("evidence_status_valid", ["passed", "blocked", "failed"].includes(evidence.status), evidence.status);
  assertCheck("default_nvidia_chat_lane_unchanged", evidence.defaultNvidiaChatLaneChanged === false && evidence.safety?.defaultNvidiaChatLaneChanged === false, evidenceJsonPath);
  assertCheck("plaintext_api_key_not_written", evidence.plainTextApiKeyWritten === false && evidence.safety?.plainTextApiKeyWritten === false, evidenceJsonPath);
  assertCheck("long_context_not_sent", evidence.request?.longContextSent === false && evidence.safety?.longContextSent === false, evidenceJsonPath);
  assertCheck("large_output_not_requested", evidence.safety?.largeOutputRequested === false && Number(evidence.request?.maxOutputTokens) <= 32, evidenceJsonPath);
  assertCheck("legacy_not_modified_in_evidence", evidence.safety?.legacyModified === false, evidenceJsonPath);
  assertCheck("project_context_not_created_in_evidence", evidence.safety?.projectContextCreated === false, evidenceJsonPath);
  assertCheck("no_codex_cli", evidence.safety?.codexCliInvoked === false, evidenceJsonPath);
  assertCheck("no_codex_exec", evidence.safety?.codexExecInvoked === false, evidenceJsonPath);
  assertCheck("no_workflow_runner", evidence.safety?.workflowRunnerEnabled === false, evidenceJsonPath);
  assertCheck("no_worktree", evidence.safety?.worktreeCreated === false, evidenceJsonPath);
  assertCheck("no_auto_commit_push", evidence.safety?.autoCommit === false && evidence.safety?.autoPush === false, evidenceJsonPath);

  if (evidence.status === "passed") {
    assertCheck("passed_http_status_2xx", Number(evidence.response?.httpStatus) >= 200 && Number(evidence.response?.httpStatus) < 300, evidence.response?.httpStatus);
    assertCheck("passed_response_success", evidence.response?.success === true, evidenceJsonPath);
    assertCheck("passed_text_received", evidence.response?.textReceived === true, evidenceJsonPath);
    assertCheck("passed_provider_model_recorded", evidence.provider === "mimo" && Boolean(evidence.model), `${evidence.provider}/${evidence.model}`);
  }

  if (evidence.status === "blocked") {
    assertCheck("blocked_reason_explicit", typeof evidence.blockedReason === "string" && evidence.blockedReason.length > 0, evidence.blockedReason);
    assertCheck("blocked_no_success_claim", evidence.response?.success === false, evidenceJsonPath);
  }

  if (evidence.status === "failed") {
    assertCheck("failed_reason_explicit", typeof evidence.failure?.message === "string" && evidence.failure.message.length > 0, evidence.failure?.message);
    assertCheck("failed_no_success_claim", evidence.response?.success === false, evidenceJsonPath);
  }

  if (evidence.response?.usageReturned === true) {
    assertCheck("usage_input_tokens_numeric", Number.isFinite(Number(evidence.response.inputTokens)), evidence.response.inputTokens);
    assertCheck("usage_output_tokens_numeric", Number.isFinite(Number(evidence.response.outputTokens)), evidence.response.outputTokens);
    assertCheck("usage_total_tokens_numeric", Number.isFinite(Number(evidence.response.totalTokens)), evidence.response.totalTokens);
  }

  assertCheck("no_forbidden_production_claims", !hasForbiddenProductionClaims([docsText, evidenceMarkdown, JSON.stringify(evidence)]), "docs/evidence");
  assertCheck("no_plaintext_key_pattern_in_new_files", !hasPlaintextKeyPattern([docsText, evidenceMarkdown, JSON.stringify(evidence)]), "docs/evidence");
  assertCheck("project_context_absent", !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")), "PROJECT_CONTEXT.md");
  assertCheck("legacy_clean_for_phase", getLegacyStatus() === "", "legacy/");

  const failedChecks = checks.filter((check) => !check.passed);
  const verifiedEvidence = {
    ...evidence,
    verifiedAt: new Date().toISOString(),
    verifier: {
      name: "verifyMimoPaidApiSafeSmoke",
      status: failedChecks.length === 0 ? "passed" : "failed",
      checks,
    },
  };

  await writeFile(evidenceJsonPath, `${JSON.stringify(verifiedEvidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderVerifiedMarkdown(verifiedEvidence), "utf8");

  if (failedChecks.length > 0) {
    console.error(JSON.stringify({ phase: PHASE, status: "failed", failedChecks }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      phase: PHASE,
      status: "passed",
      evidenceStatus: evidence.status,
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
    /MIMO_API_KEY\s*[:=]\s*(?!<masked>|<redacted>|present|true|false|n\/a)[A-Za-z0-9._-]{12,}/i,
    /sk-[A-Za-z0-9]{20,}/i,
  ];
  return patterns.some((pattern) => pattern.test(combined));
}

function hasForbiddenProductionClaims(texts) {
  const combined = texts.join("\n");
  const patterns = [
    /production[- ]ready\s*[:=]\s*(true|yes|complete|passed)/i,
    /production provider routing\s*[:=]\s*(true|enabled|complete|passed)/i,
    /default\s+(provider|chat provider|\/chat provider)\s*[:=]\s*mimo/i,
    /MiMo\s+is\s+now\s+the\s+default/i,
    /default\s+NVIDIA\s+\/chat\s+lane\s+changed\s*[:=]\s*true/i,
    /longContextSent\s*[:=]\s*true/i,
    /plainTextApiKeyWritten\s*[:=]\s*true/i,
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
  return `# Phase 269A MiMo Paid API Safe Smoke Evidence

- Phase: ${evidence.phase}
- Status: ${evidence.status}
- Checked at: ${evidence.checkedAt}
- Verified at: ${evidence.verifiedAt}
- Provider: ${evidence.provider}
- Model: ${evidence.model ?? "n/a"}
- Mode: ${evidence.mode}
- Default NVIDIA /chat lane changed: ${evidence.defaultNvidiaChatLaneChanged}
- API key present: ${evidence.apiKeyPresent}
- API key masked: ${evidence.apiKeyMasked}
- Plaintext API key written: ${evidence.plainTextApiKeyWritten}
- Max output tokens: ${evidence.request?.maxOutputTokens}
- Long context sent: ${evidence.request?.longContextSent}
- HTTP status: ${evidence.response?.httpStatus ?? "n/a"}
- Success: ${evidence.response?.success}
- Text received: ${evidence.response?.textReceived}
- Exact smoke text matched: ${evidence.response?.exactSmokeTextMatched}
- Usage returned: ${evidence.response?.usageReturned}
- Input tokens: ${evidence.response?.inputTokens}
- Output tokens: ${evidence.response?.outputTokens}
- Total tokens: ${evidence.response?.totalTokens}
- Blocked reason: ${evidence.blockedReason ?? "n/a"}
- Failure code: ${evidence.failure?.code ?? "n/a"}
- Conclusion: ${evidence.conclusion}

## Token Guard

- Guard decision: ${evidence.tokenGuard?.guardDecision ?? "n/a"}
- Estimated input tokens: ${evidence.tokenGuard?.estimatedInputTokens ?? "n/a"}
- Estimated output tokens: ${evidence.tokenGuard?.estimatedOutputTokens ?? "n/a"}
- Estimated cost USD: ${evidence.tokenGuard?.estimatedCostUsd ?? "n/a"}

## Safety

${Object.entries(evidence.safety ?? {}).map(([name, value]) => `- ${name}: ${value}`).join("\n")}

## Verifier

- Verifier: ${evidence.verifier?.name ?? "n/a"}
- Verifier status: ${evidence.verifier?.status ?? "n/a"}
- Checks: ${evidence.verifier?.checks?.length ?? 0}
`;
}
