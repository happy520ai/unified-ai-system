// Extracted verbatim from cli-core.js so the CLI runtime plumbing (output
// writer, option validation, prompt resolution, child process runner, and
// failure reporting) lives beside the other command modules. Pure mechanical
// move; behaviour unchanged.
import {
  COMMANDS,
  ENHANCEMENT_PROFILES,
  ENHANCEMENT_LANGUAGES,
  LOCAL_CLIENT_ONBOARDING_MUTATIONS,
} from "./cli-constants.js";
import { CliUsageError } from "./cli-errors.js";
import {
  CliLocalClientFailure,
  CliOnboardingFailure,
  localClientLifecycleOptionsUsed,
  localClientLifecycleOptionsUsedExcludingApply,
  validateLocalClientLifecycleOptions,
} from "./cli-local-client.js";
import {
  validateAgentGovernanceOptions,
  validateControlCenterOptions,
  validateLocalClientOnboardingOptions,
  validateWorkflowOrCredentialOptions,
} from "./cli-validation.js";
import { validateContextCodecOptions } from "./contextCodecCommands.ts";
import { validateWorkforceOptions } from "./workforceCommands.ts";
import { validateOperatorOptions } from "./operatorCommands.ts";
import { CliControlCenterFailure } from "./cliControlCenter.js";
import { CliAgentGovernanceFailure } from "./cliAgentGovernance.js";

export function createOutput({ stdout, stderr, json, colorEnabled }) {
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

export function validateOptions(options) {
  if (!COMMANDS.has(options.command)) {
    throw new CliUsageError(`Unknown command: ${options.command}`);
  }

  if (
    !["chat", "demo", "enhance", "clients", "clients-onboarding", "control-center", "agents", "forge", "workflow", "workforce", "providers", "knowledge", "routing", "taiji", "codec"].includes(options.command)
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
  const onboardingOptionsUsed = options.onboardingProfileId !== null
    || options.onboardingAction !== null
    || options.onboardingPlanId !== null
    || options.onboardingReceiptFile !== null;
  if (options.command !== "clients-onboarding" && onboardingOptionsUsed) {
    throw new CliUsageError(
      "--profile-id, --action, --plan-id, --receipt-file, and --idempotency-key are only valid with clients-onboarding.",
    );
  }
  if (
    !new Set(["clients-onboarding", "control-center"]).has(options.command)
    && options.idempotencyKey !== null
  ) {
    throw new CliUsageError(
      "--idempotency-key is only valid with onboarding or control-center mutations.",
    );
  }
  if (options.command !== "control-center" && options.controlCenterManifestFile !== null) {
    throw new CliUsageError("--manifest is only valid with control-center configure.");
  }
  const operatorCommand = ["knowledge", "routing", "taiji", "forge", "codec", "workforce"].includes(options.command);
  const agentTaskCommand = options.command === "agents" && options.positionals[0] === "task";
  if (options.operatorAudioOutput !== null && (options.command !== "forge" || options.positionals[0] !== "orchestrate")) {
    throw new CliUsageError("--audio-output is only valid with forge orchestrate speech tasks.");
  }
  if (!operatorCommand && !agentTaskCommand && (options.operatorInput !== null || options.operatorMode !== null || options.operatorSources.length || options.operatorPasses !== null || options.operatorMaxOutputTokens !== null)) {
    throw new CliUsageError("--input, --mode, --source-id and --passes are only valid with knowledge, routing, Forge or Taiji operations.");
  }
  const lifecycleOptionsUsed = localClientLifecycleOptionsUsed(operatorCommand ? { ...options, lifecycleLimit: null, lifecycleOffset: null }
    : options.command === "workflow" ? { ...options, lifecycleLimit: null } : options);
  const controlCenterApplyOnly = options.command === "control-center"
    && options.lifecycleApply
    && !localClientLifecycleOptionsUsedExcludingApply(options);
  if (options.command !== "clients" && lifecycleOptionsUsed && !controlCenterApplyOnly) {
    throw new CliUsageError(
      "Local-client lifecycle options are only valid with the clients command.",
    );
  }
  const agentOptionsUsed = agentGovernanceOptionsUsed(["forge", "codec"].includes(options.command) ? { ...options, agentId: null, agentGoal: null, agentProviderId: null, agentModelId: null }
    : options.command === "taiji" ? { ...options, agentId: null }
    : options.command === "workflow" ? { ...options, agentId: null, agentGoal: null }
    : options.command === "providers" ? { ...options, agentProviderId: null } : options);
  if (options.command !== "agents" && agentOptionsUsed) {
    throw new CliUsageError("Agent Governance options are only valid with the agents command.");
  }
  if (options.agentReason !== null && !new Set(["agents", "clients"]).has(options.command)) {
    throw new CliUsageError("--reason is only valid with agents or clients.");
  }
  if (!new Set(["clients", "clients-onboarding", "control-center", "agents", "knowledge", "forge", "taiji", "codec", "workforce"]).has(options.command) && options.confirmed) {
    throw new CliUsageError("--yes is only valid with governed mutations.");
  }
  if (options.command === "clients-onboarding") {
    validateLocalClientOnboardingOptions(options);
  }
  if (options.command === "clients") {
    validateLocalClientLifecycleOptions(options);
  }
  if (options.command === "agents") {
    validateAgentGovernanceOptions(options);
  }
  if (operatorCommand) {
    try {
      if (options.command === "codec") validateContextCodecOptions(options);
      else if (options.command === "workforce") validateWorkforceOptions(options);
      else validateOperatorOptions(options);
    } catch (error) { throw new CliUsageError(error.message); }
  }
  if (options.command === "control-center") {
    validateControlCenterOptions(options);
  }
  if (!new Set(["workflow"]).has(options.command) && (options.workflowId !== null || options.workflowArtifactName !== null)) {
    throw new CliUsageError("--workflow-id and --artifact-name are only valid with workflow.");
  }
  if (options.command === "workflow" || options.command === "providers") validateWorkflowOrCredentialOptions(options);
  if (options.allowRealProvider && options.command !== "chat"
    && !(options.command === "agents" && options.positionals[0] === "run") && !operatorCommand && !agentTaskCommand) {
    throw new CliUsageError(
      "--allow-real-provider is only valid with the chat command or agents run.",
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
    && !["agents", "chat", "clients", "clients-onboarding", "control-center", "doctor", "enhance", "forge", "spend", "status", "workflow", "workforce", "providers", "knowledge", "routing", "taiji", "codec"].includes(options.command)
  ) {
    throw new CliUsageError(
      "--url and --timeout are only valid with networked gateway commands.",
    );
  }
  if (options.json && options.command === "serve") {
    throw new CliUsageError("--json is not supported by serve.");
  }

  if (["agents", "chat", "clients", "clients-onboarding", "control-center", "doctor", "enhance", "forge", "spend", "status", "workflow", "workforce", "providers", "knowledge", "routing", "taiji", "codec"].includes(options.command)) {
    let parsedUrl;
    try {
      parsedUrl = new URL(options.url);
    } catch {
      if (options.command === "workflow" || options.command === "providers") throw new CliUsageError("Invalid gateway URL.");
      throw new CliUsageError(`Invalid gateway URL: ${options.url}`);
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new CliUsageError("Gateway URL must use http or https.");
    }
    if (
      new Set(["control-center", "workflow", "providers"]).has(options.command)
      && (parsedUrl.username.length > 0 || parsedUrl.password.length > 0)
    ) {
      throw new CliUsageError(options.command === "control-center"
        ? "The control-center gateway URL must not contain userinfo credentials."
        : "The gateway URL must not contain userinfo credentials.");
    }
  }
}

function agentGovernanceOptionsUsed(options) {
  return options.agentId !== null
    || options.agentApprovalId !== null
    || options.agentName !== null
    || options.agentTask !== null
    || options.agentGoal !== null
    || options.agentTools.length > 0
    || options.agentTtlSeconds !== null
    || options.agentParentId !== null
    || options.agentMaxIterations !== null
    || options.agentRunTimeoutMs !== null
    || options.agentToolMode !== null
    || options.agentProviderId !== null
    || options.agentModelId !== null
    || options.agentCascade;
}

export async function resolvePrompt(options, stdin, { required }) {
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

export function runChildProcess(
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

export function reportFailure({ error, options, argv, stderr }) {
  const jsonRequested = options?.json ?? argv.includes("--json");
  if (error instanceof CliControlCenterFailure) {
    const diagnostic = { ok: false, command: "control-center", kind: "required-surface", surface: error.surface, code: error.code, durationMs: error.durationMs };
    stderr.write(jsonRequested ? `${JSON.stringify(diagnostic, null, 2)}\n`
      : `\n[error] control-center ${error.surface}: ${error.code} (${error.durationMs ?? "unknown"} ms)\n`);
    return 1;
  }
  if (error instanceof CliAgentGovernanceFailure) {
    if (jsonRequested) {
      stderr.write(`${JSON.stringify({
        ok: false,
        command: "agents",
        operation: error.operation,
        status: error.status,
        code: error.code,
        retryAllowed: false,
      }, null, 2)}\n`);
    } else {
      stderr.write(`\n[error] ${error.code}\n`);
      stderr.write(`[status] ${error.status}\n`);
      if (error.mutation) {
        stderr.write("[retry] forbidden; reconcile with agents list/show/approvals before another mutation\n");
      }
      stderr.write("\n");
    }
    return error.exitCode;
  }
  if (error instanceof CliLocalClientFailure) {
    if (jsonRequested) {
      stderr.write(`${JSON.stringify({
        ok: false,
        command: "clients",
        operation: error.operation,
        status: error.status,
        code: error.code,
        retryAllowed: false,
      }, null, 2)}\n`);
    } else {
      stderr.write(`\n[error] ${error.code}\n`);
      stderr.write(`[status] ${error.status}\n`);
      if (error.mutation) {
        stderr.write("[retry] forbidden; reconcile before any new attempt\n");
      }
      stderr.write("\n");
    }
    return error.exitCode;
  }
  if (error instanceof CliOnboardingFailure) {
    if (jsonRequested) {
      stderr.write(`${JSON.stringify({
        ok: false,
        command: "clients-onboarding",
        operation: error.operation,
        status: error.status,
        code: error.code,
        retryAllowed: false,
      }, null, 2)}\n`);
    } else {
      stderr.write(`\n[error] ${error.code}\n`);
      stderr.write(`[status] ${error.status}\n`);
      if (LOCAL_CLIENT_ONBOARDING_MUTATIONS.has(error.operation)) {
        stderr.write("[retry] forbidden; reconcile before any new attempt\n");
      }
      stderr.write("\n");
    }
    return error.exitCode;
  }
  const message = error instanceof Error ? error.message : String(error);
  const hint =
    error?.hint
    ?? (["chat", "control-center", "enhance", "status"].includes(options?.command)
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
