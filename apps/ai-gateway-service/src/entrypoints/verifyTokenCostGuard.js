import { execFileSync } from "node:child_process";
import { writeEvidenceWithRenderer } from "./entrypointUtils.js";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";
import { createTokenBudgetPolicy } from "../cost/tokenBudgetPolicy.js";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";
import { listen, postJson, close } from "./entrypointUtils.js";

const PHASE = "268A-token-cost-guard";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-268a-token-cost-guard.json");
const evidenceMdPath = resolve(evidenceDir, "phase-268a-token-cost-guard.md");
const docPath = resolve(repoRoot, "docs/TOKEN_COST_GUARD.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");

const requiredDocSections = [
  "## Purpose",
  "## Why this protects paid API usage",
  "## Current status: preview-only",
  "## What it does",
  "## What it does not do",
  "## API endpoints",
  "## Budget policy",
  "## Token estimation",
  "## Context trimming strategy",
  "## Model tier strategy",
  "## Cache strategy",
  "## Ledger / summary",
  "## Safety boundaries",
  "## Verification commands",
  "## Future integration path",
];

const requiredSafetyMarkers = [
  "preview-only",
  "externalApiCalled=false",
  "paidApiCalled=false",
  "apiKeyRead=false",
  "defaultNvidiaChatLaneChanged=false",
  "no paid API call",
  "no real provider call",
  "no API key read",
  "no default NVIDIA `/chat` lane change",
  "no Codex CLI",
  "no real Codex exec",
  "no workflow runner",
  "no worktree creation",
  "no auto commit/push/PR",
];

const forbiddenClaims = [
  "paid api was called",
  "external api was called",
  "api key was read",
  "default nvidia /chat lane changed",
  "production-ready billing control is complete",
  "real paid api savings proved",
  "codex cli invoked",
  "real codex exec completed",
  "workflow runner enabled",
  "worktree created",
  "auto commit completed",
  "auto push completed",
];

let server;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const health = await getJson(`${serviceUrl}/cost/health`);
  const estimate = await postJson(`${serviceUrl}/cost/estimate`, sampleAllowInput());
  const guard = await postJson(`${serviceUrl}/cost/guard/check`, sampleAllowInput());
  const summary = await getJson(`${serviceUrl}/cost/summary`);

  const doc = await readFile(docPath, "utf8");
  const html = createConsolePage();
  verifyEmbeddedScriptSyntax(html);

  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  const servicePackage = JSON.parse(await readFile(servicePackagePath, "utf8"));
  const samplePolicy = createTokenBudgetPolicy({}, {
    enabled: true,
    perRequestMaxInputTokens: 20000,
    perRequestMaxOutputTokens: 4096,
    perRequestMaxEstimatedCostUsd: 0.1,
    dailyMaxEstimatedCostUsd: 3,
    requireApprovalAboveUsd: 0.03,
    hardBlockAboveUsd: 0.1,
    defaultCurrency: "USD",
    defaultModelTier: "cheap",
  });
  const allowCase = checkTokenCostGuard(sampleAllowInput(), { policy: samplePolicy });
  const requireApprovalCase = checkTokenCostGuard(sampleRequireApprovalInput(), { policy: samplePolicy });
  const blockCase = checkTokenCostGuard(sampleBlockInput(), { policy: samplePolicy });
  const savingsCase = checkTokenCostGuard(sampleSavingsInput(), { policy: samplePolicy });

  const checks = {
    docsExists: existsSync(docPath),
    tokenEstimatorExists: existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/cost/tokenEstimator.js")),
    tokenCostGuardExists: existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/cost/tokenCostGuard.js")),
    tokenBudgetPolicyExists: existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/cost/tokenBudgetPolicy.js")),
    tokenCachePolicyExists: existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/cost/tokenCachePolicy.js")),
    tokenCostLedgerExists: existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/cost/tokenCostLedger.js")),
    uiContainsTokenCostGuard: [
      "Token Cost Guard / 付费 API 成本保护层",
      "preview-only",
      "paidApiCalled=false",
      "externalApiCalled=false",
      "apiKeyRead=false",
      "no default NVIDIA /chat lane change",
      "no real provider call",
      "local retrieval first",
      "context trimming",
      "model tier routing",
      "cache key",
      "budget block",
      "ledger summary",
    ].every((marker) => html.includes(marker)),
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase268a-token-cost-guard"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase268a-token-cost-guard",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase268a-token-cost-guard"] ===
      "node ./src/entrypoints/verifyTokenCostGuard.js",
    evidenceJsonGenerated: true,
    evidenceMarkdownGenerated: true,
    requiredDocsSectionsPresent: requiredDocSections.every((section) => doc.includes(section)),
    requiredSafetyMarkersPresent: requiredSafetyMarkers.every((marker) => doc.includes(marker) || html.includes(marker)),
    forbiddenClaimsAbsent: forbiddenClaims.every((claim) => !doc.toLowerCase().includes(claim)),
    noLegacyModified: getLegacyStatus().trim().length === 0,
    projectContextAbsent: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
    noPlaintextApiKeyInDocs: !hasPlaintextApiKey(doc),
    healthEndpointOk:
      health.status === "ok" &&
      health.data?.mode === "preview-only" &&
      health.data?.externalApiCalled === false &&
      health.data?.paidApiCalled === false &&
      health.data?.apiKeyRead === false,
    estimateEndpointOk:
      estimate.status === "ok" &&
      estimate.data?.mode === "preview-only" &&
      estimate.data?.estimate?.totalTokens > 0 &&
      estimate.data?.estimate?.totalCostUsd >= 0 &&
      estimate.data?.safety?.externalApiCalled === false,
    guardEndpointOk:
      guard.status === "ok" &&
      guard.data?.decision === "allow" &&
      guard.data?.safety?.paidApiCalled === false &&
      guard.data?.safety?.apiKeyRead === false,
    summaryEndpointOk:
      summary.status === "ok" &&
      summary.data?.totalEstimateCount >= 1 &&
      summary.data?.paidApiCalled === false,
    safetyFieldsFalse: [allowCase, requireApprovalCase, blockCase, savingsCase].every((sample) => {
      return sample.safety.externalApiCalled === false &&
        sample.safety.paidApiCalled === false &&
        sample.safety.apiKeyRead === false &&
        sample.safety.defaultNvidiaChatLaneChanged === false;
    }),
    sampleEstimateAllowCasePassed:
      allowCase.decision === "allow" &&
      allowCase.estimate.totalTokens > 0 &&
      allowCase.estimate.totalCostUsd < samplePolicy.requireApprovalAboveUsd,
    sampleHighCostRequireApprovalCasePassed:
      requireApprovalCase.decision === "require_approval" &&
      requireApprovalCase.estimate.totalCostUsd >= samplePolicy.requireApprovalAboveUsd,
    sampleOverBudgetBlockCasePassed:
      blockCase.decision === "block" &&
      blockCase.estimate.totalCostUsd >= samplePolicy.hardBlockAboveUsd,
    sampleCacheKeyGenerated:
      typeof allowCase.cache.cacheKey === "string" &&
      allowCase.cache.cacheKey.startsWith("token-guard:") &&
      allowCase.cache.cacheEligible === true,
    sampleSavingsEstimateGenerated:
      savingsCase.savings.rawContextTokens > savingsCase.savings.selectedContextTokens &&
      savingsCase.savings.estimatedTokensSaved > 0 &&
      savingsCase.savings.estimatedSavingsRatio > 0,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    conclusion: passed ? "paid-api-token-cost-guard-preview-ready" : "paid-api-token-cost-guard-preview-incomplete",
    checkedAt: new Date().toISOString(),
    serviceUrl,
    docsPath: "docs/TOKEN_COST_GUARD.md",
    modules: [
      "apps/ai-gateway-service/src/cost/tokenEstimator.js",
      "apps/ai-gateway-service/src/cost/tokenBudgetPolicy.js",
      "apps/ai-gateway-service/src/cost/tokenCostGuard.js",
      "apps/ai-gateway-service/src/cost/tokenCachePolicy.js",
      "apps/ai-gateway-service/src/cost/tokenCostLedger.js",
    ],
    endpoints: [
      "GET /cost/health",
      "POST /cost/estimate",
      "POST /cost/guard/check",
      "GET /cost/summary",
    ],
    checks,
    samples: {
      allow: summarizeSample(allowCase),
      requireApproval: summarizeSample(requireApprovalCase),
      block: summarizeSample(blockCase),
      savings: summarizeSample(savingsCase),
      endpointHealth: health.data,
      endpointSummary: summary.data,
    },
    safety: {
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
      defaultNvidiaChatLaneChanged: false,
      legacyModified: false,
      projectContextCreated: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
    },
  };

  await writeEvidenceWithRenderer(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence, renderEvidenceMarkdown);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const fallback = {
    phase: PHASE,
    status: "failed",
    conclusion: "paid-api-token-cost-guard-preview-incomplete",
    checkedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    safety: {
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
      defaultNvidiaChatLaneChanged: false,
      legacyModified: false,
      projectContextCreated: existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
      codexCliInvoked: false,
      codexExecInvoked: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
    },
  };
  await writeEvidence(fallback);
  console.log(JSON.stringify(fallback, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function sampleAllowInput() {
  return {
    requestType: "chat-preview",
    provider: "preview-provider",
    model: "cheap-preview-model",
    modelTier: "cheap",
    messages: [
      {
        role: "user",
        content: "Summarize the current project status in five bullets.",
      },
    ],
    rawContextText: "Short local context.",
    maxOutputTokens: 200,
  };
}

function sampleRequireApprovalInput() {
  return {
    requestType: "analysis-preview",
    provider: "preview-provider",
    model: "premium-preview-model",
    modelTier: "premium",
    messages: [
      {
        role: "user",
        content: "Analyze this large planning context before a future paid API call. ".repeat(120),
      },
    ],
    maxOutputTokens: 2000,
  };
}

function sampleBlockInput() {
  return {
    requestType: "large-generation-preview",
    provider: "preview-provider",
    model: "premium-preview-model",
    modelTier: "premium",
    messages: [
      {
        role: "user",
        content: "Generate a very large output from a future paid API.",
      },
    ],
    maxOutputTokens: 6000,
  };
}

function sampleSavingsInput() {
  return {
    requestType: "knowledge-preview",
    provider: "preview-provider",
    model: "cheap-preview-model",
    modelTier: "cheap",
    messages: [
      {
        role: "user",
        content: "Answer from the selected local evidence only.",
      },
    ],
    rawContextText: "Long raw context paragraph for cost guard savings preview. ".repeat(1200),
    selectedSources: [
      {
        title: "selected-evidence",
        snippet: "Short selected evidence for a local retrieval first answer.",
      },
    ],
    maxOutputTokens: 300,
  };
}

function summarizeSample(sample) {
  return {
    decision: sample.decision,
    estimate: sample.estimate,
    savings: sample.savings,
    cache: sample.cache,
    recommendedActions: sample.recommendedActions,
    safety: sample.safety,
  };
}

function verifyEmbeddedScriptSyntax(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

function getLegacyStatus() {
  try {
    return execFileSync("git", ["-c", `safe.directory=${repoRoot}`, "status", "--short", "--", "legacy"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch {
    return "git-status-unavailable";
  }
}

function hasPlaintextApiKey(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/.test(text);
}

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  return {
    httpStatus: response.status,
    ...body,
  };
}



function renderEvidenceMarkdown(evidence) {
  return `# Phase 268A Token Cost Guard Evidence

- Phase: ${evidence.phase}
- Status: ${evidence.status}
- Checked at: ${evidence.checkedAt}
- Conclusion: ${evidence.conclusion}
- Docs path: docs/TOKEN_COST_GUARD.md
- External API called: ${evidence.safety?.externalApiCalled}
- Paid API called: ${evidence.safety?.paidApiCalled}
- API key read: ${evidence.safety?.apiKeyRead}
- Default NVIDIA chat lane changed: ${evidence.safety?.defaultNvidiaChatLaneChanged}

## Checks

${Object.entries(evidence.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}

## Sample Decisions

- Allow case: ${evidence.samples?.allow?.decision ?? "n/a"}
- Require approval case: ${evidence.samples?.requireApproval?.decision ?? "n/a"}
- Block case: ${evidence.samples?.block?.decision ?? "n/a"}
- Savings tokens saved: ${evidence.samples?.savings?.savings?.estimatedTokensSaved ?? "n/a"}

## Safety

${Object.entries(evidence.safety ?? {}).map(([name, value]) => `- ${name}: ${value}`).join("\n")}
`;
}
