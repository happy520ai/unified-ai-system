import { mkdir, writeFile } from "node:fs/promises";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const SMOKE_MODES = new Set(["fake", "real-no-key", "real-with-key", "no-key"]);
const mode = SMOKE_MODES.has(process.env.AI_GATEWAY_SMOKE_MODE) ? process.env.AI_GATEWAY_SMOKE_MODE : "no-key";
const evidenceOutputEnabled = process.env.AI_GATEWAY_SMOKE_WRITE_EVIDENCE === "1";
const evidenceDir = new URL("../../evidence/", import.meta.url);

const checks = [];

if (mode === "fake" || mode === "no-key") {
  checks.push(
    await runRouteCheck({
      name: "fake-route",
      env: {
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      },
      expected: "fake route succeeds",
    }),
  );
}

if (mode === "real-no-key" || mode === "no-key") {
  checks.push(
    await runRouteCheck({
      name: "real-no-key-controlled-failure",
      env: {
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        OPENAI_API_KEY: "",
      },
      expected: "real route returns OPENAI_API_KEY_MISSING",
    }),
  );
  checks.push(
    await runRouteCheck({
      name: "auto-no-key-falls-back-to-fake",
      env: {
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "auto",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        OPENAI_API_KEY: "",
      },
      expected: "auto route uses fake when OpenAI key is absent",
    }),
  );
}

if (mode === "real-with-key") {
  if (!process.env.OPENAI_API_KEY) {
    checks.push({
      name: "real-with-key-openai-route",
      expected: "real route calls OpenAI when OPENAI_API_KEY is present",
      skipped: true,
      reason: "OPENAI_API_KEY is not present in the current environment.",
      result: {
        success: false,
        code: "OPENAI_API_KEY_MISSING",
        message: "OPENAI_API_KEY is not present in the current environment.",
        data: {
          selectedProvider: "openai",
          selectedModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
          executionMode: "real",
          executionStatus: "blocked",
          outputText: "",
          warnings: [],
        },
        error: {
          code: "OPENAI_API_KEY_MISSING",
          type: "configuration",
          message: "OPENAI_API_KEY is not present in the current environment.",
          retryable: false,
          provider: "openai",
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          details: {
            apiKeyPresent: false,
          },
        },
        meta: createEvidenceMeta(),
      },
    });
  } else {
    checks.push(
      await runRouteCheck({
        name: "real-with-key-openai-route",
        env: {
          ...process.env,
          AI_GATEWAY_PROVIDER_MODE: "real",
          AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        },
        expected: "real route calls OpenAI and returns a route envelope",
      }),
    );
  }
}

const report = {
  smoke: "openai-route",
  mode,
  openAiApiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
  checks,
};

if (evidenceOutputEnabled && mode === "real-with-key") {
  const evidence = createOpenAIRealRouteEvidence(report);
  await writeEvidenceFiles(evidence);
}

console.log(JSON.stringify(report, null, 2));

async function runRouteCheck({ name, env, expected }) {
  const application = createGatewayApplication(env);
  const server = createGatewayHttpServer(application);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const url = `http://127.0.0.1:${server.address().port}/route`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        taskType: "chat",
        messages: [
          {
            role: "user",
            content: "Phase 6B OpenAI route smoke ping.",
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
      result: summarizeRouteEnvelope(envelope),
    };
  } catch (error) {
    return {
      name,
      expected,
      httpStatus: null,
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
      outputText: envelope.data?.outputText,
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

function createOpenAIRealRouteEvidence(report) {
  const check = report.checks.find((item) => item.name === "real-with-key-openai-route") ?? report.checks[0];
  const result = check?.result ?? {};
  const data = result.data ?? {};
  const error = result.error ?? null;
  const meta = result.meta ?? createEvidenceMeta();
  const success = result.success === true && data.executionMode === "real" && data.selectedProvider === "openai";
  const conclusion = success ? "success baseline formed" : "still blocked";

  return {
    executedAt: meta.timestamp,
    mode: "real-with-key",
    provider: data.selectedProvider ?? error?.provider ?? "openai",
    model: data.selectedModel ?? error?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    success,
    failure: !success,
    skipped: check?.skipped === true,
    conclusion,
    requestId: meta.requestId,
    durationMs: meta.durationMs,
    routeEnvelopeSummary: {
      success: result.success ?? false,
      code: result.code ?? error?.code ?? "OPENAI_REAL_ROUTE_NOT_COMPLETED",
      message: result.message ?? error?.message ?? check?.reason ?? "OpenAI real route did not complete.",
      data: {
        selectedProvider: data.selectedProvider ?? null,
        selectedModel: data.selectedModel ?? null,
        executionMode: data.executionMode ?? "real",
        executionStatus: data.executionStatus ?? "blocked",
        outputTextPresent: Boolean(data.outputText),
        warnings: data.warnings ?? [],
      },
      error,
      meta,
    },
  };
}

async function writeEvidenceFiles(evidence) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(new URL("openai-real-route-smoke.json", evidenceDir), `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(new URL("openai-real-route-smoke.md", evidenceDir), renderEvidenceMarkdown(evidence));
}

function renderEvidenceMarkdown(evidence) {
  return [
    "# OpenAI Real Route Smoke Evidence",
    "",
    `- executedAt: ${evidence.executedAt}`,
    `- mode: ${evidence.mode}`,
    `- provider: ${evidence.provider}`,
    `- model: ${evidence.model}`,
    `- success: ${evidence.success}`,
    `- failure: ${evidence.failure}`,
    `- skipped: ${evidence.skipped}`,
    `- requestId: ${evidence.requestId}`,
    `- durationMs: ${evidence.durationMs}`,
    `- conclusion: ${evidence.conclusion}`,
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
    requestId: `openai_real_route_${Date.now().toString(36)}`,
    timestamp,
    durationMs: 0,
  };
}
