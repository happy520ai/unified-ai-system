import { mkdir, writeFile } from "node:fs/promises";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const DEFAULT_MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const evidenceOutputEnabled = process.env.AI_GATEWAY_SMOKE_WRITE_EVIDENCE === "1";
const evidenceDir = new URL("../../evidence/", import.meta.url);

const mimoBaseUrl = normalizeBaseUrl(process.env.MIMO_BASE_URL) || DEFAULT_MIMO_BASE_URL;
const mimoModel = String(process.env.MIMO_MODEL ?? "").trim();
const mimoApiKeyPresent = Boolean(process.env.MIMO_API_KEY);
const checks = [];

if (!mimoApiKeyPresent) {
  checks.push(createSkippedCheck({
    name: "mimo-route-missing-key",
    reason: "missing_key",
    code: "MIMO_API_KEY_MISSING",
    message: "MIMO_API_KEY is not present in the current environment.",
  }));
} else if (!mimoModel) {
  checks.push(createSkippedCheck({
    name: "mimo-route-missing-model",
    reason: "missing_model",
    code: "MIMO_MODEL_MISSING",
    message: "MIMO_MODEL is not present. Use a model ID from the MiMo console or subscription page.",
  }));
} else {
  checks.push(
    await runRouteCheck({
      name: "mimo-real-route",
      expected: "MiMo Token Plan route returns a sanitized route envelope.",
      env: {
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ROUTE_MODE: "fixed",
        AI_GATEWAY_DEFAULT_PROVIDER: "mimo",
        AI_GATEWAY_DEFAULT_MODEL: mimoModel,
        AI_GATEWAY_ENABLED_PROVIDERS: "mimo",
        MIMO_BASE_URL: mimoBaseUrl,
        MIMO_MODEL: mimoModel,
        MIMO_API_KEY: process.env.MIMO_API_KEY,
        OPENAI_API_KEY: "",
      },
    }),
  );
}

const report = {
  smoke: "mimo-route",
  status: createReportStatus(checks),
  reason: createReportReason(checks),
  provider: "mimo",
  providerDisplayName: "MiMo Token Plan",
  openAiCompatible: true,
  baseUrl: mimoBaseUrl,
  model: mimoModel || null,
  mimoApiKeyPresent,
  openAiApiKeyUsed: false,
  defaultNvidiaChatLaneChanged: false,
  checks,
};

if (evidenceOutputEnabled) {
  await writeEvidenceFiles(createMimoRouteEvidence(report));
}

if (report.status === "failed") {
  process.exitCode = 1;
}

console.log(JSON.stringify(report, null, 2));

async function runRouteCheck({ name, env, expected }) {
  const application = createGatewayApplication(env);
  const server = createGatewayHttpServer(application);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/route`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        taskType: "chat",
        messages: [
          {
            role: "user",
            content: "MiMo Token Plan route smoke ping.",
          },
        ],
        options: {
          temperature: 0,
          maxOutputTokens: 32,
        },
      }),
    });
    const envelope = await response.json();

    return {
      name,
      expected,
      httpStatus: response.status,
      skipped: false,
      result: summarizeRouteEnvelope(envelope),
    };
  } catch (error) {
    return {
      name,
      expected,
      httpStatus: null,
      skipped: false,
      result: {
        success: false,
        code: "SMOKE_ROUTE_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "Smoke route request failed.",
      },
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function createSkippedCheck({ name, reason, code, message }) {
  return {
    name,
    expected: "MiMo route smoke is skipped until the local MiMo environment is configured.",
    skipped: true,
    reason,
    result: {
      success: false,
      code,
      message,
      data: {
        selectedProvider: "mimo",
        selectedModel: mimoModel || null,
        executionMode: "real",
        executionStatus: "skipped",
        outputTextPresent: false,
        warnings: [],
      },
      error: {
        code,
        type: "configuration",
        message,
        retryable: false,
        provider: "mimo",
        model: mimoModel || null,
        details: {
          mimoApiKeyPresent,
          openAiApiKeyUsed: false,
        },
      },
      meta: createEvidenceMeta(),
    },
  };
}

function summarizeRouteEnvelope(envelope) {
  return {
    success: envelope.success,
    code: envelope.code,
    message: envelope.message,
    data: {
      selectedProvider: envelope.data?.selectedProvider ?? null,
      selectedModel: envelope.data?.selectedModel ?? null,
      executionMode: envelope.data?.executionMode,
      executionStatus: envelope.data?.executionStatus,
      outputTextPresent: Boolean(envelope.data?.outputText),
      warnings: envelope.data?.warnings ?? [],
    },
    error: envelope.error
      ? {
          code: envelope.error.code,
          type: envelope.error.type,
          message: envelope.error.message,
          retryable: envelope.error.retryable,
          provider: envelope.error.provider,
          model: envelope.error.model,
          details: envelope.error.details,
        }
      : null,
    meta: envelope.meta,
  };
}

function createReportStatus(checksToSummarize) {
  if (checksToSummarize.every((check) => check.skipped)) {
    return "skipped";
  }

  return checksToSummarize.every((check) => check.result?.success === true) ? "passed" : "failed";
}

function createReportReason(checksToSummarize) {
  const skipped = checksToSummarize.find((check) => check.skipped);
  if (skipped) {
    return skipped.reason;
  }

  const failed = checksToSummarize.find((check) => check.result?.success !== true);
  return failed?.result?.code ?? null;
}

function createMimoRouteEvidence(reportToPersist) {
  const check = reportToPersist.checks[0] ?? {};
  const result = check.result ?? {};
  const data = result.data ?? {};
  const error = result.error ?? null;
  const meta = result.meta ?? createEvidenceMeta();

  return {
    executedAt: meta.timestamp,
    smoke: reportToPersist.smoke,
    status: reportToPersist.status,
    reason: reportToPersist.reason,
    provider: "mimo",
    providerDisplayName: "MiMo Token Plan",
    openAiCompatible: true,
    baseUrl: reportToPersist.baseUrl,
    model: reportToPersist.model,
    mimoApiKeyPresent: reportToPersist.mimoApiKeyPresent,
    openAiApiKeyUsed: false,
    defaultNvidiaChatLaneChanged: false,
    routeEnvelopeSummary: {
      success: result.success ?? false,
      code: result.code ?? error?.code ?? "MIMO_ROUTE_NOT_COMPLETED",
      message: result.message ?? error?.message ?? check.reason ?? "MiMo route smoke did not complete.",
      data: {
        selectedProvider: data.selectedProvider ?? "mimo",
        selectedModel: data.selectedModel ?? reportToPersist.model,
        executionMode: data.executionMode ?? "real",
        executionStatus: data.executionStatus ?? (check.skipped ? "skipped" : "blocked"),
        outputTextPresent: Boolean(data.outputTextPresent),
        warnings: data.warnings ?? [],
      },
      error,
      meta,
    },
  };
}

async function writeEvidenceFiles(evidence) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(new URL("mimo-route-smoke.json", evidenceDir), `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(new URL("mimo-route-smoke.md", evidenceDir), renderEvidenceMarkdown(evidence));
}

function renderEvidenceMarkdown(evidence) {
  return [
    "# MiMo Token Plan Route Smoke Evidence",
    "",
    `- executedAt: ${evidence.executedAt}`,
    `- smoke: ${evidence.smoke}`,
    `- status: ${evidence.status}`,
    `- reason: ${evidence.reason}`,
    `- provider: ${evidence.provider}`,
    `- model: ${evidence.model}`,
    `- mimoApiKeyPresent: ${evidence.mimoApiKeyPresent}`,
    `- openAiApiKeyUsed: ${evidence.openAiApiKeyUsed}`,
    `- defaultNvidiaChatLaneChanged: ${evidence.defaultNvidiaChatLaneChanged}`,
    "",
    "## Route Envelope Summary",
    "",
    "```json",
    JSON.stringify(evidence.routeEnvelopeSummary, null, 2),
    "```",
    "",
  ].join("\n");
}

function createEvidenceMeta() {
  const timestamp = new Date().toISOString();

  return {
    requestId: `mimo_route_${Date.now().toString(36)}`,
    timestamp,
    durationMs: 0,
  };
}

function normalizeBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}
