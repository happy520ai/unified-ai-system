import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createGatewayChatRequest,
  createGatewayClient,
} from "@unified-ai-system/shared-sdk";

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(cliDirectory, "../../..");
const serviceEntrypoint = resolve(
  repoRoot,
  "apps/ai-gateway-service/src/index.js",
);
const demoEntrypoint = resolve(repoRoot, "tools/terminal-demo.mjs");
const workspaceManifest = resolve(repoRoot, "pnpm-workspace.yaml");
const rootPackage = readJson(resolve(repoRoot, "package.json"));
const usageReportUrl =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";

export const CLI_VERSION = rootPackage.version;
export const DEFAULT_GATEWAY_URL =
  process.env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100";

const COMMANDS = new Set([
  "chat",
  "demo",
  "doctor",
  "enhance",
  "help",
  "serve",
  "spend",
  "status",
  "version",
]);
const ENHANCEMENT_PROFILES = new Set([
  "auto",
  "general",
  "coding",
  "analysis",
  "writing",
  "research",
  "planning",
]);
const ENHANCEMENT_LANGUAGES = new Set(["auto", "zh-CN", "en"]);

const COMMAND_ALIASES = new Map([
  ["health", "status"],
  ["start", "serve"],
]);

export class CliUsageError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "CliUsageError";
    this.exitCode = options.exitCode ?? 2;
    this.hint = options.hint;
  }
}

export function parseCliArgs(
  argv,
  env = process.env,
) {
  const options = {
    command: null,
    positionals: [],
    json: false,
    evidence: false,
    help: false,
    version: false,
    url: env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100",
    urlProvided: false,
    timeoutMs: 30_000,
    timeoutProvided: false,
    prompt: null,
    enhance: false,
    profile: "auto",
    profileProvided: false,
    language: "auto",
    languageProvided: false,
    allowRealProvider: false,
    adminKey: env.AGENT_CONSOLE_ADMIN_KEY ?? env.PME_AUTH_TOKEN ?? null,
    host: null,
    port: null,
  };

  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (positionalOnly) {
      addPositional(options, token);
      continue;
    }

    if (token === "--") {
      positionalOnly = true;
      continue;
    }

    if (!token.startsWith("-")) {
      addPositional(options, token);
      continue;
    }

    const [flag, inlineValue] = splitFlag(token);

    if (flag === "--json") {
      options.json = true;
      continue;
    }
    if (flag === "--evidence") {
      options.evidence = true;
      continue;
    }
    if (flag === "--help" || flag === "-h") {
      options.help = true;
      continue;
    }
    if (flag === "--version" || flag === "-v") {
      options.version = true;
      continue;
    }
    if (flag === "--allow-real-provider") {
      options.allowRealProvider = true;
      continue;
    }
    if (flag === "--admin-key") {
      options.adminKey = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--enhance") {
      options.enhance = true;
      continue;
    }
    if (flag === "--profile") {
      options.profile = readFlagValue(argv, index, flag, inlineValue);
      options.profileProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--language") {
      options.language = readFlagValue(argv, index, flag, inlineValue);
      options.languageProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--url") {
      options.url = readFlagValue(argv, index, flag, inlineValue);
      options.urlProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--timeout") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.timeoutMs = parseIntegerOption(value, flag, 1, 300_000);
      options.timeoutProvided = true;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--prompt") {
      options.prompt = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--host") {
      options.host = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--port") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.port = parseIntegerOption(value, flag, 1, 65_535);
      if (inlineValue === null) index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${flag}`);
  }

  if (options.version) {
    options.command = "version";
  } else if (options.help || !options.command) {
    options.command = "help";
  } else {
    options.command = COMMAND_ALIASES.get(options.command) ?? options.command;
  }

  validateOptions(options);
  return options;
}

export async function runCli(
  argv = process.argv.slice(2),
  runtime = {},
) {
  const stdout = runtime.stdout ?? process.stdout;
  const stderr = runtime.stderr ?? process.stderr;
  let options;

  try {
    options = parseCliArgs(argv, runtime.env ?? process.env);
    const output = createOutput({
      stdout,
      stderr,
      json: options.json,
      colorEnabled:
        !options.json
        && stdout.isTTY
        && !("NO_COLOR" in (runtime.env ?? process.env))
        && (runtime.env ?? process.env).TERM !== "dumb",
    });

    switch (options.command) {
      case "help":
        output.write(renderHelp());
        return 0;
      case "version":
        output.write(
          options.json
            ? `${JSON.stringify({ ok: true, version: CLI_VERSION }, null, 2)}\n`
            : `Unified AI System CLI ${CLI_VERSION}\n`,
        );
        return 0;
      case "demo":
        return await runDemo(options, runtime);
      case "serve":
        return await runServe(options, runtime, output);
      case "status":
        return await runStatus(options, output);
      case "doctor":
        return await runDoctor(options, runtime, output);
      case "enhance":
        return await runEnhance(options, output, runtime.stdin ?? process.stdin);
      case "chat":
        return await runChat(options, output, runtime.stdin ?? process.stdin);
      case "spend":
        return await runSpend(options, output);
      case "forge":
        return await runForge(options, output);
      default:
        throw new CliUsageError(`Unknown command: ${options.command}`);
    }
  } catch (error) {
    return reportFailure({
      error,
      options,
      argv,
      stderr,
    });
  }
}

async function runEnhance(options, output, stdin) {
  const prompt = await resolvePrompt(options, stdin, { required: true });
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: process.env.PME_AUTH_TOKEN
      ? { authorization: `Bearer ${process.env.PME_AUTH_TOKEN}` }
      : {},
  });
  const response = await client.enhancePrompt({
    input: prompt,
    profile: options.profile,
    language: options.language,
  });
  const enhancement = unwrapEnvelope(response);
  if (typeof enhancement.enhancedPrompt !== "string") {
    throw new Error("The gateway did not return an enhanced prompt.");
  }

  const result = {
    ok: true,
    gatewayUrl: options.url,
    original: enhancement.original,
    enhancedPrompt: enhancement.enhancedPrompt,
    profile: enhancement.profile,
    language: enhancement.language,
    detectedSignals: enhancement.signals ?? {},
    compiledSections: summarizeCompiledSections(enhancement.sections),
    clarifyingQuestions: enhancement.clarifyingQuestions ?? [],
    metadata: enhancement.metadata ?? {},
  };

  if (options.evidence) {
    output.write(`${JSON.stringify(buildEnhancementEvidence(result), null, 2)}\n`);
  } else if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderEnhancement(result, output);
  }
  return 0;
}

function buildEnhancementEvidence(result) {
  const metadata = result.metadata ?? {};
  const providerFreeEvidence =
    metadata.providerCalled === false
    && metadata.credentialRequired === false
    && metadata.deterministic === true;

  if (!providerFreeEvidence) {
    throw new Error(
      "The gateway did not return complete provider-free enhancement evidence.",
    );
  }

  return {
    schema: "unified-ai-system/usage-report/v1",
    command: [
      "pnpm gateway enhance",
      JSON.stringify(result.original),
      "--profile",
      result.profile,
      "--language",
      result.language,
    ].join(" "),
    environment: `${process.platform}; Node ${process.version}`,
    mode: "prompt-enhancement",
    providerCalled: false,
    credentialRequired: false,
    deterministic: true,
    original: result.original,
    enhancedPrompt: result.enhancedPrompt,
    profile: result.profile,
    language: result.language,
    detectedSignals: result.detectedSignals,
    compiledSections: result.compiledSections,
    clarifyingQuestions: result.clarifyingQuestions,
    reportUrl: usageReportUrl,
    reviewBeforeSharing: true,
  };
}

function summarizeCompiledSections(sections) {
  return Array.isArray(sections)
    ? sections.map((section) => ({
        id: section.id,
        title: section.title,
        itemCount: Array.isArray(section.items) ? section.items.length : 0,
      }))
    : [];
}

async function runDemo(options, runtime) {
  const args = [demoEntrypoint];
  if (options.json) args.push("--json");
  if (options.evidence) args.push("--evidence");

  const prompt = await resolvePrompt(options, runtime.stdin ?? process.stdin, {
    required: false,
  });
  const env = {
    ...(runtime.env ?? process.env),
    ...(prompt ? { AI_GATEWAY_DEMO_PROMPT: prompt } : {}),
  };

  return runChildProcess(
    runtime.spawnProcess ?? spawn,
    process.execPath,
    [
      ...args,
      ...(options.enhance ? ["--enhance"] : []),
      ...(options.profileProvided ? ["--profile", options.profile] : []),
      ...(options.languageProvided ? ["--language", options.language] : []),
    ],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
}

async function runServe(options, runtime, output) {
  const env = {
    ...(runtime.env ?? process.env),
    ...(options.host ? { AI_GATEWAY_SERVICE_HOST: options.host } : {}),
    ...(options.port ? { AI_GATEWAY_SERVICE_PORT: String(options.port) } : {}),
  };

  output.write(
    [
      "",
      output.bold("Unified AI System"),
      output.muted("Starting the gateway. Press Ctrl+C to stop."),
      "",
    ].join("\n"),
  );

  return runChildProcess(
    runtime.spawnProcess ?? spawn,
    process.execPath,
    [serviceEntrypoint],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      windowsHide: true,
    },
    { forwardSignals: true },
  );
}

// forge:设想族群的命令行入口(status/polish/quality/memory/taiji/workforce)。
function trimUrl(url) {
  return String(url ?? "").replace(/[/]+$/, "");
}
async function runForge(options, output) {
  const client = createGatewayClient({ baseUrl: options.url, timeoutMs: options.timeoutMs });
  const sub = String(options._.length > 1 ? options._[1] : options.forgeCommand ?? "status");
  const request = async (path, body) => {
    const response = await fetch(`${trimUrl(options.url)}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "provider-dispatch-key": `uai-cli-${randomUUID()}`,
        ...(process.env.PME_AUTH_TOKEN ? { authorization: `Bearer ${process.env.PME_AUTH_TOKEN}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  };
  const get = async (path) => {
    const response = await fetch(`${trimUrl(options.url)}${path}`, {
      headers: process.env.PME_AUTH_TOKEN ? { authorization: `Bearer ${process.env.PME_AUTH_TOKEN}` } : {},
    });
    return { status: response.status, payload: await response.json().catch(() => ({})) };
  };
  let result;
  if (sub === "status") result = await get("/forge/status");
  else if (sub === "polish") result = await request("/forge/polish", { content: String(options.text ?? options._.slice(2).join(" ") ?? "") });
  else if (sub === "quality") result = await request("/forge/quality", { code: String(options.text ?? options._.slice(2).join(" ") ?? "") });
  else if (sub === "memory") result = await request("/forge/memory", { action: "remember", content: String(options.text ?? options._.slice(2).join(" ") ?? "") });
  else if (sub === "recall") result = await request("/forge/memory", { action: "recall", query: String(options.text ?? options._.slice(2).join(" ") ?? "") });
  else if (sub === "taiji") result = await request("/taiji/compile", { request: String(options.text ?? options._.slice(2).join(" ") ?? "") });
  else if (sub === "workforce") result = await request("/workforce/preview", { task: String(options.text ?? options._.slice(2).join(" ") ?? "") });
  else throw new CliUsageError("Unknown forge subcommand. Use: status | polish | quality | memory | recall | taiji | workforce");
  output.write(`${JSON.stringify(result.payload, null, 2)}
`);
  return result.status >= 200 && result.status < 300 ? 0 : 1;
}

async function runStatus(options, output) {
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

async function runDoctor(options, runtime, output) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
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
  const pnpmMajor = Number(pnpmVersion.split(".")[0]);
  const checks = [
    {
      id: "node",
      passed: Number.isFinite(nodeMajor) && nodeMajor >= 20,
      detail: `Node.js ${process.versions.node}`,
    },
    {
      id: "pnpm",
      passed: pnpmCheck.status === 0 && Number.isFinite(pnpmMajor) && pnpmMajor >= 9,
      detail:
        pnpmCheck.status === 0
          ? `pnpm ${pnpmVersion}`
          : "pnpm was not found on PATH",
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

async function runChat(options, output, stdin) {
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

function renderEnhancement(result, output) {
  const clarifyingQuestions = Array.isArray(result.clarifyingQuestions)
    ? result.clarifyingQuestions
    : [];
  const metadata = result.metadata ?? {};
  const safetyProven =
    metadata.providerCalled === false
    && metadata.credentialRequired === false
    && metadata.deterministic === true;
  const safetyLabel = safetyProven
    ? output.green("[safe]")
    : output.yellow("[check]");
  const questionLines = clarifyingQuestions.length > 0
    ? [
        "",
        output.bold("Questions to refine (optional)"),
        ...clarifyingQuestions.map((question, index) => `  ${index + 1}. ${question}`),
      ]
    : [];
  const lines = [
    "",
    output.bold("Enhanced prompt"),
    output.muted(`${result.profile} | ${result.language} | local deterministic engine`),
    "",
    result.enhancedPrompt,
    ...questionLines,
    "",
    `  ${safetyLabel} provider call ${metadata.providerCalled === false ? "none" : "check JSON"} | credentials ${metadata.credentialRequired === false ? "not required" : "check JSON"} | deterministic ${metadata.deterministic === true ? "yes" : "check JSON"}`,
    metadata.originalPreserved === true
      ? output.muted("  Original request preserved. Use --evidence for a shareable report, or --json for raw output.")
      : output.muted("  Review the JSON metadata before sharing this result."),
    "",
  ];
  output.write(`${lines.join("\n")}\n`);
}

async function runSpend(options, output) {
  if (!options.adminKey) {
    throw new CliUsageError(
      "The spend report needs an admin key: pass --admin-key <uai-…> or set AGENT_CONSOLE_ADMIN_KEY / PME_AUTH_TOKEN.",
      { hint: "Create one with POST /enterprise/virtual-keys and role admin." },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Spend report request timed out after ${options.timeoutMs}ms`));
  }, options.timeoutMs);

  let response;
  try {
    response = await fetch(`${options.url.replace(/\/+$/, "")}/enterprise/spend-report`, {
      headers: { authorization: `Bearer ${options.adminKey}` },
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(
      `Could not reach the gateway spend report at ${options.url}: ${error?.message ?? error}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Spend report failed with HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const envelope = await response.json();
  const data = envelope?.data ?? {};
  const result = {
    ok: true,
    gatewayUrl: options.url,
    window: data.window ?? "current-budget-window",
    totals: data.totals ?? {},
    rows: Array.isArray(data.rows) ? data.rows : [],
  };

  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderSpend(result, output);
  }
  return 0;
}

function renderSpend(result, output) {
  const totals = result.totals ?? {};
  output.write(`Spend report — ${result.window}\n`);
  output.write(
    `keys: ${totals.keys ?? result.rows.length} (active ${totals.activeKeys ?? "?"})  ` +
    `tokens: ${totals.tokensUsed ?? 0}  requests: ${totals.requestCount ?? 0}  ` +
    `over soft budget: ${totals.keysOverSoftBudget ?? 0}\n\n`,
  );

  if (!result.rows.length) {
    output.write("No virtual keys yet. Create one with POST /enterprise/virtual-keys.\n");
    return;
  }

  const header = "  keyId       role        tokens      budget            status";
  output.write(`${header}\n`);
  for (const row of result.rows) {
    const budget = row.budget?.enabled
      ? `${row.tokensUsed ?? 0}/${row.budget.limitTokens ?? "?"}` +
        (row.budget.windowResetAt ? ` (resets ${row.budget.windowResetAt.slice(0, 10)})` : "")
      : "unlimited";
    const status = row.revoked
      ? "revoked"
      : row.budget?.softBudgetExceeded
        ? "over soft budget"
        : "ok";
    output.write(
      `  ${String(row.keyId ?? "?").padEnd(12)}${String(row.role ?? "?").padEnd(12)}` +
      `${String(row.tokensUsed ?? 0).padEnd(12)}${budget.padEnd(18)}${status}\n`,
    );
  }
}

function renderHelp() {
  return `
Unified AI System CLI ${CLI_VERSION}

Usage:
  pnpm gateway <command> [options]

Commands:
  demo [prompt]    Run an isolated credential-free demonstration
  serve            Start the local gateway
  status           Inspect gateway and chat readiness
  enhance [prompt] Preview a structured prompt without calling a model
  chat [prompt]    Send one chat request to a running gateway
  spend            Show per-key token spend and budget status
  doctor           Check the local toolchain and gateway connection
  help             Show this help
  version          Show the CLI version

Options:
  --url <url>                 Gateway URL (default: ${DEFAULT_GATEWAY_URL})
  --timeout <ms>              Request timeout, up to 300000
  --prompt <text>             Prompt for demo, enhance, or chat
  --enhance                   Enhance a chat or demo prompt locally
  --profile <name>            auto, general, coding, analysis, writing, research, planning
  --language <name>           auto, zh-CN, en (for prompt enhancement)
  --allow-real-provider       Authorize one chat command to use a real provider
  --admin-key <uai-…>         Admin virtual key for enterprise routes (spend)
  --host <host>               Host override for serve
  --port <port>               Port override for serve
  --json                      Emit machine-readable output
  --evidence                  Emit report-ready usage evidence for demo/enhance
  -h, --help                  Show help
  -v, --version               Show version

Examples:
  pnpm gateway demo
  pnpm gateway demo "Build me an API" --enhance --profile coding
  pnpm gateway demo "帮我设计一个 API" --enhance --profile coding --language zh-CN
  pnpm gateway serve
  pnpm gateway status
  pnpm gateway spend --admin-key uai-…
  pnpm gateway enhance "Build me an API"
  pnpm gateway enhance "帮我规划一个小型 API" --language zh-CN
  pnpm gateway chat "Build me an API" --enhance --profile coding
  pnpm gateway chat "Hello from the terminal"
  pnpm gateway doctor --json

Pipe input:
  With no prompt argument, demo, enhance, and chat read the request from stdin.
  printf '%s' "Plan a launch" | pnpm gateway enhance --profile planning
  Get-Content .\\request.txt -Raw | pnpm gateway enhance --profile planning

Safety:
  chat refuses to send when a real provider may be active unless
  --allow-real-provider is supplied explicitly.
`;
}

function createOutput({ stdout, stderr, json, colorEnabled }) {
  const color = (code, value) =>
    colorEnabled ? `\u001b[${code}m${value}\u001b[0m` : String(value);

  return {
    json,
    write: (value) => stdout.write(value),
    writeError: (value) => stderr.write(value),
    bold: (value) => color("1", value),
    cyan: (value) => color("36", value),
    green: (value) => color("32", value),
    muted: (value) => color("2", value),
    yellow: (value) => color("33", value),
  };
}

function validateOptions(options) {
  if (!COMMANDS.has(options.command)) {
    throw new CliUsageError(`Unknown command: ${options.command}`);
  }

  if (
    !["chat", "demo", "enhance"].includes(options.command)
    && (options.prompt !== null || options.positionals.length > 0)
  ) {
    throw new CliUsageError(
      `${options.command} does not accept positional arguments or --prompt.`,
    );
  }
  if (
    ["chat", "demo", "enhance"].includes(options.command)
    && options.prompt !== null
    && options.positionals.length > 0
  ) {
    throw new CliUsageError(
      "Use either positional prompt text or --prompt, not both.",
    );
  }
  if (options.allowRealProvider && options.command !== "chat") {
    throw new CliUsageError(
      "--allow-real-provider is only valid with the chat command.",
    );
  }
  if (options.enhance && !["chat", "demo"].includes(options.command)) {
    throw new CliUsageError(
      "--enhance is only valid with the chat or demo command.",
    );
  }
  if (options.evidence && !["demo", "enhance"].includes(options.command)) {
    throw new CliUsageError(
      "--evidence is only valid with the demo or enhance command.",
    );
  }
  if (!ENHANCEMENT_PROFILES.has(options.profile)) {
    throw new CliUsageError(`Unsupported enhancement profile: ${options.profile}`);
  }
  if (!ENHANCEMENT_LANGUAGES.has(options.language)) {
    throw new CliUsageError(`Unsupported enhancement language: ${options.language}`);
  }
  if (
    options.profileProvided
    && options.command !== "enhance"
    && !(options.command === "chat" && options.enhance)
    && !(options.command === "demo" && options.enhance)
  ) {
    throw new CliUsageError(
      "--profile is only valid with enhance or chat/demo --enhance.",
    );
  }
  if (
    options.languageProvided
    && options.command !== "enhance"
    && !(options.command === "chat" && options.enhance)
    && !(options.command === "demo" && options.enhance)
  ) {
    throw new CliUsageError(
      "--language is only valid with enhance or chat/demo --enhance.",
    );
  }
  if (
    (options.host !== null || options.port !== null)
    && options.command !== "serve"
  ) {
    throw new CliUsageError("--host and --port are only valid with serve.");
  }
  if (
    (options.urlProvided || options.timeoutProvided)
    && !["chat", "doctor", "enhance", "spend", "status"].includes(options.command)
  ) {
    throw new CliUsageError(
      "--url and --timeout are only valid with chat, doctor, enhance, spend, or status.",
    );
  }
  if (options.json && options.command === "serve") {
    throw new CliUsageError("--json is not supported by serve.");
  }

  if (["chat", "doctor", "enhance", "spend", "status"].includes(options.command)) {
    let parsedUrl;
    try {
      parsedUrl = new URL(options.url);
    } catch {
      throw new CliUsageError(`Invalid gateway URL: ${options.url}`);
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new CliUsageError("Gateway URL must use http or https.");
    }
  }
}

function addPositional(options, value) {
  if (options.command === null) {
    options.command = value;
  } else {
    options.positionals.push(value);
  }
}

function splitFlag(token) {
  const equalsIndex = token.indexOf("=");
  if (equalsIndex === -1) return [token, null];
  return [token.slice(0, equalsIndex), token.slice(equalsIndex + 1)];
}

function readFlagValue(argv, index, flag, inlineValue) {
  const value = inlineValue ?? argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) {
    throw new CliUsageError(`${flag} requires a value.`);
  }
  return value;
}

function parseIntegerOption(value, flag, minimum, maximum) {
  if (!/^\d+$/.test(value)) {
    throw new CliUsageError(`${flag} must be an integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CliUsageError(
      `${flag} must be between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

async function resolvePrompt(options, stdin, { required }) {
  const argumentPrompt =
    options.prompt ?? options.positionals.join(" ").trim();
  if (argumentPrompt) return argumentPrompt;

  if (!stdin.isTTY) {
    let piped = "";
    for await (const chunk of stdin) piped += chunk;
    if (piped.trim()) return piped.trim();
  }

  if (required) {
    throw new CliUsageError(
      "A prompt is required.",
      { hint: 'Example: pnpm gateway chat "Hello"' },
    );
  }
  return null;
}

function unwrapEnvelope(value) {
  return value?.data ?? value ?? {};
}

function runChildProcess(
  spawnProcess,
  command,
  args,
  options,
  behavior = {},
) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnProcess(command, args, options);
    const signalHandlers = new Map();

    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) {
        process.removeListener(signal, handler);
      }
    };

    if (behavior.forwardSignals) {
      for (const signal of ["SIGINT", "SIGTERM"]) {
        const handler = () => {
          if (child.exitCode === null) child.kill(signal);
        };
        signalHandlers.set(signal, handler);
        process.once(signal, handler);
      }
    }

    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolvePromise(code ?? (signal ? 1 : 0));
    });
  });
}

function reportFailure({ error, options, argv, stderr }) {
  const jsonRequested = options?.json ?? argv.includes("--json");
  const message = error instanceof Error ? error.message : String(error);
  const hint =
    error?.hint
    ?? (["chat", "enhance", "status"].includes(options?.command)
      ? "Start the gateway with: pnpm gateway serve"
      : null);

  if (jsonRequested) {
    stderr.write(
      `${JSON.stringify(
        {
          ok: false,
          command: options?.command ?? null,
          error: message,
          ...(hint ? { hint } : {}),
        },
        null,
        2,
      )}\n`,
    );
  } else {
    stderr.write(`\n[error] ${message}\n`);
    if (hint) stderr.write(`[next] ${hint}\n`);
    stderr.write("\n");
  }

  return Number.isInteger(error?.exitCode) ? error.exitCode : 1;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
