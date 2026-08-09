#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const usageReportUrl =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";
const serviceEntrypoint = resolve(
  repoRoot,
  "apps/ai-gateway-service/src/index.js",
);
const prompt =
  process.env.AI_GATEWAY_DEMO_PROMPT ?? "Hello from Unified AI System";
const jsonOutput = process.argv.includes("--json");
const evidenceOutput = process.argv.includes("--evidence");
const enhancementEnabled = process.argv.includes("--enhance");
const profileFlagIndex = process.argv.indexOf("--profile");
const enhancementProfile =
  profileFlagIndex >= 0 && process.argv[profileFlagIndex + 1]
    ? process.argv[profileFlagIndex + 1]
    : "general";
const languageFlagIndex = process.argv.indexOf("--language");
const enhancementLanguage =
  languageFlagIndex >= 0 && process.argv[languageFlagIndex + 1]
    ? process.argv[languageFlagIndex + 1]
    : "auto";
const colorEnabled =
  !jsonOutput
  && !evidenceOutput
  && process.stdout.isTTY
  && !("NO_COLOR" in process.env)
  && process.env.TERM !== "dumb";

const color = {
  bold: (value) => formatAnsi("1", value),
  cyan: (value) => formatAnsi("36", value),
  green: (value) => formatAnsi("32", value),
  muted: (value) => formatAnsi("2", value),
  yellow: (value) => formatAnsi("33", value),
};

function formatAnsi(code, value) {
  return colorEnabled ? `\u001b[${code}m${value}\u001b[0m` : String(value);
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function findFreePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (!port) throw new Error("Unable to allocate a local demo port.");
  return port;
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, body };
}

async function waitForReady(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Gateway exited before becoming ready with code ${child.exitCode}.`,
      );
    }
    try {
      const health = await fetchJson(`${baseUrl}/health/check`);
      if (health.status === 200 && health.body?.data?.status === "ready") {
        return health.body;
      }
    } catch {
      // The isolated gateway may briefly refuse connections during startup.
    }
    await delay(250);
  }
  throw new Error("Gateway did not become ready within 30 seconds.");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(3_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), delay(2_000)]);
  }
}

function renderDemo(result) {
  const lines = [
    "",
    color.bold("  Unified AI System"),
    color.muted("  Local-first AI gateway | terminal demo"),
    "",
    `  ${color.green("[ready]")} gateway       ${result.baseUrl}`,
    `  ${color.green("[ready]")} provider      ${result.provider}`,
    `  ${color.green("[ready]")} model         ${result.model}`,
    `  ${color.green("[ready]")} execution     ${result.executionMode}`,
    `  ${color.green("[ready]")} real calls    disabled`,
    "",
    `  ${color.cyan(">")} ${result.prompt}`,
    ...(result.promptEnhancement
      ? [
          `  ${color.green("[enhanced]")} ${result.promptEnhancement.profile}/${result.promptEnhancement.language}`,
          `  ${result.promptEnhancement.enhancedPrompt}`,
        ]
      : []),
    `  ${color.yellow("<")} ${result.outputText}`,
    "",
    `  ${color.green("[done]")} ${result.latencyMs} ms | no API key | process cleaned up`,
    color.muted('  Next: pnpm gateway demo "Help me plan a small API" --enhance --profile planning'),
    color.muted("  If this helps, star the project: https://github.com/happy520ai/unified-ai-system"),
    color.muted(`  Share OS + one output line: ${usageReportUrl}`),
    "",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function buildEvidence(result) {
  const commandParts = ["pnpm gateway demo", JSON.stringify(result.prompt)];
  if (result.promptEnhancement) {
    commandParts.push(
      "--enhance",
      "--profile",
      result.promptEnhancement.profile,
      "--language",
      result.promptEnhancement.language,
    );
  }

  return {
    schema: "unified-ai-system/usage-report/v1",
    command: commandParts.join(" "),
    environment: `${process.platform}; Node ${process.version}`,
    mode: result.executionMode,
    providerCalled: result.realProviderCallsMade,
    credentialRequired: false,
    deterministic: true,
    original: result.prompt,
    ...(result.promptEnhancement
      ? {
          enhancedPrompt: result.promptEnhancement.enhancedPrompt,
          profile: result.promptEnhancement.profile,
          language: result.promptEnhancement.language,
        }
      : {}),
    outputPreview: result.outputText.split(/\r?\n/).slice(0, 12).join("\n"),
    reportUrl: usageReportUrl,
    reviewBeforeSharing: true,
  };
}

async function runDemo() {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [serviceEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
      AI_GATEWAY_SERVICE_PORT: String(port),
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ROUTE_MODE: "registry-default",
      AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
      AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
      AI_GATEWAY_ENABLED_PROVIDERS:
        "local-fake-provider,backup-fake-provider",
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-8_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });

  try {
    const health = await waitForReady(baseUrl, child);
    if (health?.data?.realProviderEnabled !== false) {
      throw new Error("Demo safety check failed: real providers are enabled.");
    }

    let promptEnhancement = null;
    if (enhancementEnabled) {
      const enhancement = await fetchJson(`${baseUrl}/prompts/enhance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: prompt,
          profile: enhancementProfile,
          language: enhancementLanguage,
        }),
      });
      const data = enhancement.body?.data;
      if (
        enhancement.status !== 200
        || enhancement.body?.status !== "ok"
        || typeof data?.enhancedPrompt !== "string"
        || data.metadata?.providerCalled !== false
      ) {
        throw new Error("The local prompt enhancement did not complete safely.");
      }
      promptEnhancement = {
        original: data.original,
        enhancedPrompt: data.enhancedPrompt,
        profile: data.profile,
        language: data.language,
        metadata: data.metadata,
      };
    }

    const startedAt = Date.now();
    const chat = await fetchJson(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        ...(promptEnhancement
          ? {
              promptEnhancement: {
                enabled: true,
                profile: promptEnhancement.profile,
                language: promptEnhancement.language,
              },
            }
          : {}),
      }),
    });
    const latencyMs = Date.now() - startedAt;

    if (
      chat.status !== 200
      || chat.body?.success !== true
      || chat.body?.data?.executionMode !== "fake"
      || chat.body?.data?.selectedProvider !== "local-fake-provider"
    ) {
      throw new Error("The isolated fake-provider chat did not complete.");
    }

    const result = {
      ok: true,
      baseUrl,
      provider: chat.body.data.selectedProvider,
      model: chat.body.data.selectedModel,
      executionMode: chat.body.data.executionMode,
      executionStatus: chat.body.data.executionStatus,
      prompt,
      promptEnhancement,
      outputText: chat.body.data.outputText,
      latencyMs,
      realProviderCallsMade: false,
    };

    if (evidenceOutput) {
      process.stdout.write(`${JSON.stringify(buildEvidence(result), null, 2)}\n`);
    } else if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      renderDemo(result);
    }
  } catch (error) {
    const details = `${stdout}\n${stderr}`.trim().slice(-2_000);
    const failure = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      realProviderCallsMade: false,
      ...(details ? { outputTail: details } : {}),
    };
    if (jsonOutput) {
      process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    } else {
      process.stderr.write(
        `\n  ${color.yellow("[failed]")} ${failure.error}\n\n`,
      );
    }
    process.exitCode = 1;
  } finally {
    await stopChild(child);
  }
}

await runDemo();
