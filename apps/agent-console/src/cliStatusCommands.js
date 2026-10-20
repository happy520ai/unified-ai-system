// Extracted verbatim from cli-core.js so the status/doctor/chat command
// cluster lives beside the other command modules. Pure mechanical move;
// behaviour unchanged.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { resolvePrompt } from "./cliRuntime.js";
import { repoRoot, serviceEntrypoint, demoEntrypoint, workspaceManifest, rootPackage, CLI_VERSION } from "./cliPaths.js";
import { createGatewayChatRequest, createGatewayClient } from "@unified-ai-system/shared-sdk";
import { unwrapEnvelope } from "./cli-shared-helpers.js";
import { CliUsageError } from "./cli-errors.js";

export async function runStatus(options, output) {
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
  });
  const [healthEnvelope, readinessEnvelope] = await Promise.all([
    client.health(),
    client.setupReadiness(),
  ]);
  const health = unwrapEnvelope(healthEnvelope);
  const readiness = unwrapEnvelope(readinessEnvelope);
  const providers = Array.isArray(health.providers)
    ? health.providers.map((provider) => provider.id ?? provider.name ?? "unknown")
    : [];
  const result = {
    ok: health.status === "ready",
    gatewayUrl: options.url,
    status: health.status ?? "unknown",
    providerMode: health.providerMode ?? "unknown",
    realProviderEnabled: health.realProviderEnabled === true,
    providers,
    chatReady: readiness.readiness?.chat?.ready === true,
  };

  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderStatus(result, output);
  }

  return result.ok ? 0 : 1;
}


export async function runDoctor(options, runtime, output) {
  const nodeVersion = runtime.nodeVersion ?? process.versions.node;
  const engineRequirements = runtime.engineRequirements ?? rootPackage.engines;
  const nodeRequirement = engineRequirements?.node ?? null;
  const pnpmRequirement = engineRequirements?.pnpm ?? null;
  const pnpmInvocation =
    process.platform === "win32"
      ? {
          command: process.env.ComSpec ?? "cmd.exe",
          args: ["/d", "/s", "/c", "pnpm --version"],
        }
      : {
          command: "pnpm",
          args: ["--version"],
        };
  const pnpmCheck = (runtime.spawnSynchronous ?? spawnSync)(
    pnpmInvocation.command,
    pnpmInvocation.args,
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    },
  );
  const pnpmVersion = String(pnpmCheck.stdout ?? "").trim();
  const checks = [
    {
      id: "node",
      passed: matchesDoctorEngine(nodeVersion, nodeRequirement),
      required: nodeRequirement,
      detail: `Node.js ${nodeVersion} (requires ${nodeRequirement ?? "a declared package engine"})`,
    },
    {
      id: "pnpm",
      passed: pnpmCheck.status === 0 && matchesDoctorEngine(pnpmVersion, pnpmRequirement),
      required: pnpmRequirement,
      detail:
        pnpmCheck.status === 0
          ? `pnpm ${pnpmVersion || "unknown"} (requires ${pnpmRequirement ?? "a declared package engine"})`
          : `pnpm was not found on PATH (requires ${pnpmRequirement ?? "a declared package engine"})`,
    },
    {
      id: "workspace",
      passed:
        existsSync(serviceEntrypoint)
        && existsSync(demoEntrypoint)
        && existsSync(workspaceManifest),
      detail: "gateway, demo, and workspace entrypoints",
    },
  ];

  let gateway = {
    reachable: false,
    status: "offline",
    realProviderEnabled: null,
  };

  try {
    const client = createGatewayClient({
      baseUrl: options.url,
      timeoutMs: Math.min(options.timeoutMs, 3_000),
    });
    const health = unwrapEnvelope(await client.health());
    gateway = {
      reachable: true,
      status: health.status ?? "unknown",
      realProviderEnabled: health.realProviderEnabled === true,
    };
  } catch {
    // The gateway is optional for environment diagnostics.
  }

  const result = {
    ok: checks.every((check) => check.passed),
    version: CLI_VERSION,
    checks,
    gateway: {
      url: options.url,
      ...gateway,
    },
    nextAction: gateway.reachable
      ? "pnpm gateway status"
      : "pnpm gateway serve",
  };

  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderDoctor(result, output);
  }

  return result.ok ? 0 : 1;
}

function matchesDoctorEngine(version, requirement) {
  if (typeof version !== "string" || typeof requirement !== "string" || !requirement.trim()) return false;
  const actualMatch = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(version);
  if (!actualMatch) return false;
  const actual = actualMatch.slice(1, 4).map(Number);
  if (!actual.every(Number.isSafeInteger)) return false;

  // The package declares stable-version >= / < bounds joined by spaces.
  // Unknown range syntax must fail rather than silently accepting a runtime.
  return requirement.trim().split(/\s+/u).every((clause) => {
    const bound = /^(>=|<)(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?$/u.exec(clause);
    if (!bound) return false;
    const expected = bound.slice(2, 5).map((part) => Number(part ?? 0));
    if (!expected.every(Number.isSafeInteger)) return false;
    const differing = actual.findIndex((part, index) => part !== expected[index]);
    const comparison = differing === -1 ? 0 : Math.sign(actual[differing] - expected[differing]);
    return bound[1] === ">=" ? comparison >= 0 : comparison < 0;
  });
}

export async function runChat(options, output, stdin) {
  const prompt = await resolvePrompt(options, stdin, { required: true });
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: process.env.PME_AUTH_TOKEN
      ? { authorization: `Bearer ${process.env.PME_AUTH_TOKEN}` }
      : {},
  });
  const health = unwrapEnvelope(await client.health());
  const safeFakeRuntime =
    health.realProviderEnabled === false
    && health.providerMode !== "real";

  if (!safeFakeRuntime && !options.allowRealProvider) {
    throw new CliUsageError(
      "The gateway may use a real provider. The chat request was not sent.",
      {
        hint:
          "Review the gateway configuration, then repeat with --allow-real-provider to authorize this one CLI request.",
      },
    );
  }

  const requestId = randomUUID();
  const response = await client.chat(
    createGatewayChatRequest({
      prompt,
      context: {
        requestId,
        traceId: `cli-${requestId}`,
      },
      metadata: {
        caller: "unified-ai-system-cli",
        command: "chat",
        realProviderAuthorized: options.allowRealProvider,
      },
      ...(options.enhance
        ? {
            promptEnhancement: {
              enabled: true,
              profile: options.profile,
              language: options.language,
            },
          }
        : {}),
    }),
  );

  if (response.success !== true || !response.data) {
    throw new Error("The gateway did not return a successful chat response.");
  }

  const data = response.data;
  const result = {
    ok: true,
    gatewayUrl: options.url,
    prompt,
    outputText: data.outputText ?? data.text ?? "",
    selectedProvider: data.selectedProvider ?? null,
    selectedModel: data.selectedModel ?? null,
    executionMode: data.executionMode ?? "unknown",
    executionStatus: data.executionStatus ?? "unknown",
    realProviderAuthorized: options.allowRealProvider,
    promptEnhancement: data.promptEnhancement ?? { applied: false },
  };

  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderChat(result, output);
  }

  return 0;
}

function renderStatus(result, output) {
  const realProviderState = result.realProviderEnabled
    ? output.yellow("enabled")
    : output.green("disabled");
  const lines = [
    "",
    output.bold("Unified AI System"),
    output.muted("Gateway status"),
    "",
    `  ${output.green("[ready]")} gateway       ${result.gatewayUrl}`,
    `  ${output.green("[ready]")} status        ${result.status}`,
    `  ${output.green("[ready]")} mode          ${result.providerMode}`,
    `  ${output.green("[ready]")} providers     ${result.providers.join(", ") || "none"}`,
    `  ${output.green("[ready]")} chat          ${result.chatReady ? "ready" : "needs attention"}`,
    `  ${result.realProviderEnabled ? output.yellow("[armed]") : output.green("[safe]")} real providers ${realProviderState}`,
    "",
  ];
  output.write(`${lines.join("\n")}\n`);
}

function renderDoctor(result, output) {
  const lines = [
    "",
    output.bold("Unified AI System"),
    output.muted(`CLI doctor ${result.version}`),
    "",
    ...result.checks.map(
      (check) =>
        `  ${check.passed ? output.green("[pass]") : output.yellow("[fail]")} ${check.id.padEnd(12)} ${check.detail}`,
    ),
    `  ${result.gateway.reachable ? output.green("[online]") : output.muted("[offline]")} gateway      ${result.gateway.url}`,
    "",
    `  ${output.cyan("next")} ${result.nextAction}`,
    "",
  ];
  output.write(`${lines.join("\n")}\n`);
}

function renderChat(result, output) {
  const lines = [
    "",
    `  ${output.cyan(">")} ${result.prompt}`,
    `  ${output.yellow("<")} ${result.outputText}`,
    ...(result.promptEnhancement.applied
      ? [`  ${output.green("[enhanced]")} ${result.promptEnhancement.profile}/${result.promptEnhancement.language}`]
      : []),
    "",
    `  ${output.green("[done]")} ${result.selectedProvider ?? "unknown"}/${result.selectedModel ?? "unknown"} | ${result.executionMode}`,
    "",
  ];
  output.write(`${lines.join("\n")}\n`);
}
