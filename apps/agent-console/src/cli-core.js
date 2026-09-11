import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";
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
  "agents",
  "chat",
  "clients",
  "clients-onboarding",
  "demo",
  "doctor",
  "enhance",
  "forge",
  "help",
  "serve",
  "spend",
  "status",
  "version",
]);
const AGENT_GOVERNANCE_SUBCOMMANDS = new Set([
  "status",
  "list",
  "show",
  "generate",
  "run",
  "revoke",
  "approvals",
  "approve",
  "reject",
]);
const AGENT_GOVERNANCE_MUTATIONS = new Set([
  "generate",
  "run",
  "revoke",
  "approve",
  "reject",
]);
const AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;
const AGENT_APPROVAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/u;
const AGENT_TOOL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/u;
const AGENT_REVIEW_SENSITIVE_KEY = /(?:password|token|secret|authorization|credential|private.?key|sealed|encrypted)/iu;
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
const LOCAL_CLIENT_LIFECYCLE_SUBCOMMANDS = new Set([
  "discover",
  "list",
  "inspect",
  "register",
  "verify",
  "disable",
  "revoke",
  "smart-manage",
]);
const LOCAL_CLIENT_LIFECYCLE_ALWAYS_MUTATING = new Set([
  "register",
  "verify",
  "disable",
  "revoke",
]);
const LOCAL_CLIENT_DISABLE_REASONS = new Set([
  "manual_disable",
  "maintenance",
  "security_review",
]);
const LOCAL_CLIENT_REVOKE_REASONS = new Set([
  "manual_revoke",
  "credential_compromise",
  "identity_mismatch",
  "security_incident",
]);
const SAFE_LOCAL_CLIENT_LIFECYCLE_ERROR_CODES = new Set([
  "FORBIDDEN",
  "GATEWAY_CLIENT_ABORTED",
  "GATEWAY_CLIENT_TIMEOUT",
  "GATEWAY_HTTP_ERROR",
  "GATEWAY_NETWORK_ERROR",
  "GATEWAY_PROTOCOL_ERROR",
  "LOCAL_CLIENT_LIFECYCLE_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_LIFECYCLE_UNAVAILABLE",
  "LOCAL_CLIENT_VERIFICATION_CANCELLED",
  "LOCAL_CLIENT_VERIFICATION_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND",
  "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE",
  "LOCAL_CLIENT_VERIFICATION_EVIDENCE_INVALID",
  "LOCAL_CLIENT_VERIFICATION_PROBE_FAILED",
  "LOCAL_CLIENT_VERIFICATION_PROBE_UNAVAILABLE",
  "LOCAL_CLIENT_VERIFICATION_PROMOTION_FAILED",
  "LOCAL_CLIENT_VERIFICATION_REQUEST_INVALID",
  "LOCAL_CLIENT_VERIFICATION_SCOPE_REQUIRED",
  "UNAUTHENTICATED",
  "local_client_disable_client_missing",
  "local_client_disable_failed",
  "local_client_disable_invalid_json",
  "local_client_disable_invalid_payload",
  "local_client_disable_not_found",
  "local_client_discover_system_failed",
  "local_client_discover_system_invalid_json",
  "local_client_invalid_payload",
  "local_client_register_adapter_binding_incomplete",
  "local_client_register_adapter_binding_invalid",
  "local_client_register_capabilities_missing",
  "local_client_register_client_missing",
  "local_client_register_failed",
  "local_client_register_invalid_json",
  "local_client_register_persistence_failed",
  "local_client_register_revoked",
  "local_client_registry_corrupt",
  "local_client_registry_failed",
  "local_client_revoke_authority_unavailable",
  "local_client_revoke_client_missing",
  "local_client_revoke_failed",
  "local_client_revoke_invalid_json",
  "local_client_revoke_invalid_payload",
  "local_client_revoke_not_found",
  "local_client_revoke_revision_conflict",
  "local_client_revoke_revision_required",
  "local_client_scope_invalid",
  "local_client_scope_required",
  "local_client_smart_manage_failed",
  "local_client_smart_manage_invalid_json",
  "local_client_verification_persistence_failed",
  "local_client_verification_scope_required",
  "local_client_verify_failed",
  "local_client_verify_invalid_json",
]);
const LOCAL_CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const LOCAL_CLIENT_CAPABILITY_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/u;
const LOCAL_CLIENT_DECLARATION_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const LOCAL_CLIENT_SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const LOCAL_CLIENT_ONBOARDING_SUBCOMMANDS = new Set([
  "profiles",
  "inspect",
  "verify",
  "plan",
  "approve",
  "apply",
  "rollback",
  "recover",
]);
const LOCAL_CLIENT_ONBOARDING_MUTATIONS = new Set([
  "approve",
  "apply",
  "rollback",
  "recover",
]);
const LOCAL_CLIENT_ONBOARDING_ACTIONS = new Set([
  "enable",
  "disable",
  "rollback",
  "recover",
]);
const LOCAL_CLIENT_ONBOARDING_CERTIFICATION =
  "fixture-tested-not-real-client-certified";
const LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS = Object.freeze([
  Object.freeze({
    profileId: "claude-compatible-mcp-json",
    client: "claude-compatible",
    label: "Claude-compatible",
    containerKey: "mcpServers",
  }),
  Object.freeze({
    profileId: "cursor-mcp-json",
    client: "cursor",
    label: "Cursor",
    containerKey: "mcpServers",
  }),
  Object.freeze({
    profileId: "vscode-mcp-json",
    client: "vscode",
    label: "VS Code",
    containerKey: "servers",
  }),
]);
const SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES = new Set([
  "FORBIDDEN",
  "GATEWAY_CLIENT_ABORTED",
  "GATEWAY_CLIENT_TIMEOUT",
  "GATEWAY_HTTP_ERROR",
  "GATEWAY_NETWORK_ERROR",
  "GATEWAY_PROTOCOL_ERROR",
  "LOCAL_CLIENT_ONBOARDING_API_APPROVAL_INVALID",
  "LOCAL_CLIENT_ONBOARDING_API_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_ONBOARDING_DISABLED",
  "LOCAL_CLIENT_ONBOARDING_API_EXTERNAL_EFFECT_NOT_DURABLE",
  "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_NOT_DURABLE",
  "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_REQUIRED",
  "LOCAL_CLIENT_ONBOARDING_API_DEPENDENCY_FAILED",
  "LOCAL_CLIENT_ONBOARDING_API_PLAN_MISMATCH",
  "LOCAL_CLIENT_ONBOARDING_API_PLAN_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_API_REQUEST_INVALID",
  "LOCAL_CLIENT_ONBOARDING_APPROVAL_IDEMPOTENCY_CONFLICT",
  "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_CANCELLED",
  "LOCAL_CLIENT_ONBOARDING_IDEMPOTENCY_REJECTED",
  "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_PRECOMMIT_REJECTED",
  "LOCAL_CLIENT_ONBOARDING_RUNTIME_CLOSED",
  "LOCAL_CLIENT_ONBOARDING_RUNTIME_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_ONBOARDING_TENANT_FORBIDDEN",
  "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE",
  "UNAUTHENTICATED",
]);
const UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES = new Set([
  "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
  "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
]);
const LOCAL_CLIENT_ONBOARDING_PROFILE_IDS = new Set(
  LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.map(({ profileId }) => profileId),
);
const LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES = 64 * 1024;
const LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN = /^onboarding_[a-f0-9]{64}$/u;
const LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN = /^onboard:[a-z0-9-]+:[a-f0-9]{64}$/u;
const LOCAL_CLIENT_ONBOARDING_TRANSACTION_ID_PATTERN = /^tx_[a-f0-9]{64}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{1,255}$/u;

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

class CliOnboardingFailure extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "CliOnboardingFailure";
    this.code = code;
    this.operation = options.operation ?? null;
    this.status = options.status ?? "rejected";
    this.retryAllowed = false;
    this.exitCode = 1;
  }
}

class CliLocalClientFailure extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "CliLocalClientFailure";
    this.code = code;
    this.operation = options.operation ?? null;
    this.status = options.status ?? "rejected";
    this.mutation = options.mutation === true;
    this.retryAllowed = false;
    this.exitCode = 1;
  }
}

class CliAgentGovernanceFailure extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "CliAgentGovernanceFailure";
    this.code = code;
    this.operation = options.operation ?? null;
    this.status = options.status ?? "rejected";
    this.mutation = options.mutation === true;
    this.retryAllowed = false;
    this.exitCode = 1;
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
    onboardingProfileId: null,
    onboardingAction: null,
    onboardingPlanId: null,
    onboardingReceiptFile: null,
    idempotencyKey: null,
    confirmed: false,
    lifecycleClientId: null,
    lifecycleDisplayName: null,
    lifecycleCapabilities: [],
    lifecycleIncludeDisabled: false,
    lifecycleLimit: null,
    lifecycleOffset: null,
    lifecycleApply: false,
    lifecycleMaxProcesses: null,
    lifecycleIncludeUnknown: false,
    lifecycleIncludeSystemProcesses: false,
    lifecycleIncludeMissingAsDisabled: false,
    lifecycleAutoDiscoverAll: false,
    lifecycleRevision: null,
    lifecycleAdapterId: null,
    lifecycleAdapterType: null,
    lifecycleAdapterVersion: null,
    lifecycleManifestSha256: null,
    lifecycleProtocolVersion: null,
    lifecycleReason: null,
    agentId: null,
    agentApprovalId: null,
    agentName: null,
    agentTask: null,
    agentGoal: null,
    agentTools: [],
    agentTtlSeconds: null,
    agentParentId: null,
    agentMaxIterations: null,
    agentRunTimeoutMs: null,
    agentToolMode: null,
    agentProviderId: null,
    agentModelId: null,
    agentReason: null,
    agentCascade: false,
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
    if (flag === "--profile-id") {
      options.onboardingProfileId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--action") {
      options.onboardingAction = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--plan-id") {
      options.onboardingPlanId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--receipt-file") {
      options.onboardingReceiptFile = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--idempotency-key") {
      options.idempotencyKey = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--yes") {
      if (inlineValue !== null) {
        throw new CliUsageError("--yes does not accept a value.");
      }
      options.confirmed = true;
      continue;
    }
    if (flag === "--client-id") {
      options.lifecycleClientId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--display-name") {
      options.lifecycleDisplayName = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--capability") {
      options.lifecycleCapabilities.push(readFlagValue(argv, index, flag, inlineValue));
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--include-disabled") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeDisabled = true;
      continue;
    }
    if (flag === "--limit") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleLimit = parseIntegerOption(value, flag, 1, 100);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--offset") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleOffset = parseIntegerOption(value, flag, 0, Number.MAX_SAFE_INTEGER);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--apply") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleApply = true;
      continue;
    }
    if (flag === "--max-processes") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleMaxProcesses = parseIntegerOption(value, flag, 1, 10_000);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--include-unknown") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeUnknown = true;
      continue;
    }
    if (flag === "--include-system-processes") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeSystemProcesses = true;
      continue;
    }
    if (flag === "--include-missing-as-disabled") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleIncludeMissingAsDisabled = true;
      continue;
    }
    if (flag === "--auto-discover-all") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.lifecycleAutoDiscoverAll = true;
      continue;
    }
    if (flag === "--revision") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleRevision = parseIntegerOption(value, flag, 1, Number.MAX_SAFE_INTEGER);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--adapter-id") {
      options.lifecycleAdapterId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--adapter-type") {
      options.lifecycleAdapterType = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--adapter-version") {
      options.lifecycleAdapterVersion = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--manifest-sha256") {
      options.lifecycleManifestSha256 = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--protocol-version") {
      options.lifecycleProtocolVersion = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--reason") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.lifecycleReason = value;
      options.agentReason = value;
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--agent-id") {
      options.agentId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--approval-id") {
      options.agentApprovalId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--name") {
      options.agentName = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--task") {
      options.agentTask = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--goal") {
      options.agentGoal = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--tool") {
      options.agentTools.push(readFlagValue(argv, index, flag, inlineValue));
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--ttl-seconds") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.agentTtlSeconds = parseIntegerOption(value, flag, 1, 2_592_000);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--parent-agent-id") {
      options.agentParentId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--max-iterations") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.agentMaxIterations = parseIntegerOption(value, flag, 1, 25);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--run-timeout-ms") {
      const value = readFlagValue(argv, index, flag, inlineValue);
      options.agentRunTimeoutMs = parseIntegerOption(value, flag, 1_000, 120_000);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--tool-mode") {
      options.agentToolMode = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--provider-id") {
      options.agentProviderId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--model-id") {
      options.agentModelId = readFlagValue(argv, index, flag, inlineValue);
      if (inlineValue === null) index += 1;
      continue;
    }
    if (flag === "--cascade") {
      assertFlagHasNoInlineValue(flag, inlineValue);
      options.agentCascade = true;
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
      case "agents":
        return await runAgents(options, output);
      case "status":
        return await runStatus(options, output);
      case "doctor":
        return await runDoctor(options, runtime, output);
      case "enhance":
        return await runEnhance(options, output, runtime.stdin ?? process.stdin);
      case "chat":
        return await runChat(options, output, runtime.stdin ?? process.stdin);
      case "clients":
        return await runClients(options, output);
      case "clients-onboarding":
        return await runClientsOnboarding(options, output, runtime.cwd ?? process.cwd());
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

async function runAgents(options, output) {
  const operation = options.positionals[0];
  const mutation = AGENT_GOVERNANCE_MUTATIONS.has(operation);
  const runTimeoutMs = options.agentRunTimeoutMs ?? 60_000;
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: operation === "run"
      ? Math.max(options.timeoutMs, runTimeoutMs + 5_000)
      : options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });

  try {
    let data;
    if (operation === "status") {
      data = unwrapEnvelope(await client.agentGovernanceStats()).stats;
    } else if (operation === "list") {
      data = unwrapEnvelope(await client.governedAgents()).agents;
    } else if (operation === "show") {
      const [agentEnvelope, policyEnvelope] = await Promise.all([
        client.governedAgent(options.agentId),
        client.governedAgentPolicy(options.agentId),
      ]);
      data = {
        agent: unwrapEnvelope(agentEnvelope).agent,
        effectivePolicy: unwrapEnvelope(policyEnvelope).effectivePolicy,
      };
    } else if (operation === "generate") {
      data = unwrapEnvelope(await client.generateGovernedAgent({
        name: options.agentName,
        task: options.agentTask,
        requestedTools: options.agentTools,
        ttlSeconds: options.agentTtlSeconds ?? 3600,
        parentAgentId: options.agentParentId,
      }));
    } else if (operation === "run") {
      data = unwrapEnvelope(await client.runGovernedAgent(options.agentId, {
        goal: options.agentGoal,
        timeoutMs: runTimeoutMs,
        ...(options.agentMaxIterations === null ? {} : { maxIterations: options.agentMaxIterations }),
        toolMode: options.agentToolMode ?? (options.agentTools.length > 0 ? "readonly" : "none"),
        ...(options.agentTools.length > 0 ? { toolAllowlist: options.agentTools } : {}),
        ...(options.agentProviderId === null ? {} : { providerId: options.agentProviderId }),
        ...(options.agentModelId === null ? {} : { modelId: options.agentModelId }),
      }));
    } else if (operation === "revoke") {
      data = unwrapEnvelope(await client.revokeGovernedAgent(options.agentId, {
        reason: options.agentReason ?? "operator_requested",
        cascade: options.agentCascade,
      }));
    } else if (operation === "approvals") {
      const approvals = unwrapEnvelope(
        await client.governedApprovals(options.agentId ?? undefined),
      ).approvals;
      data = Array.isArray(approvals) ? approvals.map(projectAgentApproval) : [];
    } else {
      data = projectAgentApproval(
        unwrapEnvelope(await client.decideGovernedApproval(
          options.agentApprovalId,
          operation,
        )).approval,
      );
    }

    const operationSucceeded = operation !== "run" || data?.status === "completed";
    const result = {
      ok: operationSucceeded,
      command: "agents",
      operation,
      mode: mutation ? "governed-mutation" : "read-only",
      ...(mutation ? { retryAllowed: false } : { writesPerformed: false }),
      data,
    };
    if (options.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
    else renderAgentGovernanceCommand(result, output);
    return operationSucceeded ? 0 : 1;
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw createSafeAgentGovernanceFailure(error, { operation, mutation });
  }
}

function renderAgentGovernanceCommand(result, output) {
  const lines = [
    "",
    output.bold("Agent Governance"),
    `Operation: ${result.operation}`,
    `Mode: ${result.mode}`,
  ];
  const data = result.data;
  if (result.operation === "status") {
    lines.push(
      `Agents: ${safeCount(data?.agents)}`,
      `Policies: ${safeCount(data?.policies)}`,
      `By status: ${formatSafeRecord(data?.byStatus)}`,
    );
  } else if (result.operation === "list") {
    const agents = Array.isArray(data) ? data : [];
    lines.push(`Agents: ${agents.length}`);
    for (const agent of agents) {
      lines.push(
        `  ${safeTerminalText(agent?.agentId, 160)}  ${safeTerminalText(agent?.status, 32)}  `
        + `${safeTerminalText(agent?.name, 128)}  ${safeTerminalText(agent?.classification?.family, 64)}`,
      );
    }
  } else if (result.operation === "show") {
    const agent = data?.agent ?? {};
    const policy = data?.effectivePolicy ?? {};
    lines.push(
      `Agent: ${safeTerminalText(agent.agentId, 160)}`,
      `Name: ${safeTerminalText(agent.name, 128)}`,
      `Status: ${safeTerminalText(agent.status, 32)}`,
      `Owner: ${safeTerminalText(agent.ownerUserId, 160)}`,
      `Family: ${safeTerminalText(agent.classification?.family, 64)}`,
      `Risk: ${safeTerminalText(agent.riskLevel, 32)}`,
      `Granted tools: ${formatSafeList(policy.grantedTools ?? agent.grantedTools)}`,
      `Expires: ${safeTerminalText(agent.expiresAt ?? policy.expiresAt, 64)}`,
      `Policy hash: ${safeTerminalText(agent.policyHash ?? policy.policyHash, 160)}`,
    );
  } else if (result.operation === "generate") {
    lines.push(
      `Agent: ${safeTerminalText(data?.agentId, 160)}`,
      `Status: ${safeTerminalText(data?.status, 32)}`,
      `Granted tools: ${formatSafeList(data?.grantedTools)}`,
      `Expires: ${safeTerminalText(data?.expiresAt, 64)}`,
      output.yellow("Automatic retry: forbidden; inspect the Agent list before another generate request."),
    );
  } else if (result.operation === "run") {
    lines.push(
      `Status: ${safeTerminalText(data?.status, 64)}`,
      `Agent: ${safeTerminalText(data?.governance?.agentId, 160)}`,
      `Provider: ${safeTerminalText(data?.provider?.id, 160)}`,
      `Iterations: ${safeCount(data?.iterations?.used)}/${safeCount(data?.iterations?.max)}`,
      "",
      safeTerminalBlock(data?.finalAnswer, 8_000),
      "",
      output.yellow("Automatic retry: forbidden; inspect agents show and approvals before another run."),
    );
  } else if (result.operation === "revoke") {
    lines.push(
      `Revoked: ${formatSafeList(data?.revoked)}`,
      output.yellow("Automatic retry: forbidden; reconcile with agents list before another revoke."),
    );
  } else if (result.operation === "approvals") {
    const approvals = Array.isArray(data) ? data : [];
    lines.push(`Pending approvals: ${approvals.length}`);
    for (const approval of approvals) {
      lines.push(
        `  ${safeTerminalText(approval?.id, 160)}  ${safeTerminalText(approval?.agentId, 160)}  `
        + `${safeTerminalText(approval?.toolName, 160)}  ${safeTerminalText(approval?.status, 32)}`,
        `    Review: ${formatSafeReview(approval?.review)}`,
      );
    }
  } else {
    lines.push(
      `Approval: ${safeTerminalText(data?.id, 160)}`,
      `Status: ${safeTerminalText(data?.status, 32)}`,
      `Agent: ${safeTerminalText(data?.agentId, 160)}`,
      `Tool: ${safeTerminalText(data?.toolName, 160)}`,
      output.yellow("Automatic retry: forbidden; reconcile with agents approvals."),
    );
  }
  output.write(`${lines.join("\n")}\n\n`);
}

function safeTerminalText(value, maxLength) {
  return String(value ?? "n/a")
    .replace(/[\u0000-\u001f\u007f\u001b]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function safeTerminalBlock(value, maxLength) {
  return String(value ?? "n/a")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u001b]/gu, "")
    .slice(0, maxLength);
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function formatSafeList(value) {
  return Array.isArray(value) && value.length > 0
    ? value.slice(0, 100).map((item) => safeTerminalText(item, 160)).join(", ")
    : "none";
}

function formatSafeRecord(value) {
  if (!isPlainRecord(value)) return "none";
  return Object.entries(value)
    .slice(0, 32)
    .map(([key, count]) => `${safeTerminalText(key, 64)}=${safeCount(count)}`)
    .join(", ") || "none";
}

function formatSafeReview(value) {
  if (!isPlainRecord(value)) return "unavailable";
  try {
    return safeTerminalText(JSON.stringify(value), 4_000);
  } catch {
    return "unavailable";
  }
}

function projectAgentApproval(value) {
  if (!isPlainRecord(value)) throw new Error("invalid Agent approval response");
  const output = {};
  for (const key of [
    "id",
    "agentId",
    "toolName",
    "argumentsHash",
    "status",
    "requestedAt",
    "expiresAt",
    "decidedAt",
    "decidedBy",
  ]) {
    if (typeof value[key] === "string") output[key] = value[key].slice(0, 4_000);
  }
  if (value.review !== undefined) output.review = sanitizeAgentReview(value.review);
  return Object.freeze(output);
}

function sanitizeAgentReview(value, depth = 0) {
  if (depth > 8) return "[truncated]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 16_000);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeAgentReview(item, depth + 1));
  }
  if (!isPlainRecord(value)) return "[unsupported]";
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 100)
      .map(([key, item]) => [
        key.slice(0, 160),
        AGENT_REVIEW_SENSITIVE_KEY.test(key)
          ? "[redacted]"
          : sanitizeAgentReview(item, depth + 1),
      ]),
  );
}

function createSafeAgentGovernanceFailure(error, { operation, mutation }) {
  const rawCode = typeof error?.code === "string" && /^[A-Za-z0-9_:-]{1,128}$/u.test(error.code)
    ? error.code
    : null;
  const transportUncertain = new Set([
    "GATEWAY_CLIENT_ABORTED",
    "GATEWAY_CLIENT_TIMEOUT",
    "GATEWAY_HTTP_ERROR",
    "GATEWAY_NETWORK_ERROR",
    "GATEWAY_PROTOCOL_ERROR",
  ]).has(rawCode);
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : null;
  const unknown = mutation && (transportUncertain || statusCode === null || statusCode >= 500);
  return new CliAgentGovernanceFailure(
    unknown
      ? "AGENT_GOVERNANCE_OUTCOME_UNKNOWN"
      : rawCode ?? "AGENT_GOVERNANCE_REQUEST_REJECTED",
    {
      operation,
      mutation,
      status: unknown ? "unknown-reconcile-required" : "rejected",
    },
  );
}

// Forge remains a read-only status surface until provider/effect commands
// share the console's explicit confirmation and reconciliation gates.
function trimUrl(url) {
  return String(url ?? "").replace(/[/]+$/, "");
}
async function runForge(options, output) {
  const get = async (path) => {
    const response = await fetch(`${trimUrl(options.url)}${path}`, {
      headers: options.adminKey ? { authorization: `Bearer ${options.adminKey}` } : {},
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    return { status: response.status, payload: await response.json().catch(() => ({})) };
  };
  const result = await get("/forge/status");
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

async function runClients(options, output) {
  if (!options.adminKey) {
    throw new CliUsageError(
      "The clients command requires an admin key.",
      { hint: "Pass --admin-key or set AGENT_CONSOLE_ADMIN_KEY." },
    );
  }
  if (options.positionals.length === 1) {
    return runLocalClientLifecycle(options, output);
  }

  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });
  const [statusResponse, registryResponse, onboarding] = await Promise.all([
    client.localClientsStatus(),
    client.localClients({ includeDisabled: true, limit: 100 }),
    loadLocalClientOnboarding(client),
  ]);
  const status = projectLocalClientStatus(unwrapEnvelope(statusResponse));
  const registry = projectLocalClientRegistry(unwrapEnvelope(registryResponse));
  const result = {
    ok: true,
    gatewayUrl: options.url,
    mode: status.executionEnabled === true ? "governed-execution" : "preview-only",
    status,
    registry,
    onboarding,
  };

  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    output.write([
      "",
      output.bold("Local client management"),
      `Gateway: ${options.url}`,
      `Mode: ${result.mode}`,
      `Status: ${status.status ?? "unknown"}`,
      `Clients: ${registry.total ?? 0}`,
      "",
      status.executionEnabled === true
        ? output.yellow("Execution is enabled only through governed adapters.")
        : output.muted("Execution is preview-only; no local application action was performed."),
      "",
      ...renderLocalClientOnboarding(onboarding, output),
      "",
    ].join("\n"));
  }
  return 0;
}

function projectLocalClientStatus(value) {
  if (
    !isPlainRecord(value)
    || !new Set(["ready", "preview-ready", "degraded"]).has(value.status)
    || typeof value.executionEnabled !== "boolean"
    || !isPlainRecord(value.boundaries)
    || typeof value.boundaries.previewOnly !== "boolean"
    || value.boundaries.tenantScoped !== true
    || value.boundaries.observedApplicationsRoutable !== false
    || typeof value.boundaries.executionAdapterConfigured !== "boolean"
  ) {
    throw new Error("invalid local-client status response");
  }
  return Object.freeze({
    status: value.status,
    executionEnabled: value.executionEnabled,
    boundaries: Object.freeze({
      previewOnly: value.boundaries.previewOnly,
      tenantScoped: true,
      observedApplicationsRoutable: false,
      executionAdapterConfigured: value.boundaries.executionAdapterConfigured,
      ...(typeof value.boundaries.executionRequested === "boolean"
        ? { executionRequested: value.boundaries.executionRequested }
        : {}),
      ...(typeof value.boundaries.executionReady === "boolean"
        ? { executionReady: value.boundaries.executionReady }
        : {}),
      ...(typeof value.boundaries.executionMode === "string"
        && new Set(["ready", "preview-only", "blocked"]).has(value.boundaries.executionMode)
        ? { executionMode: value.boundaries.executionMode }
        : {}),
      ...(Array.isArray(value.boundaries.executionBlockers)
        ? { executionBlockers: Object.freeze(value.boundaries.executionBlockers.map(projectSafeLifecycleLabel)) }
        : {}),
    }),
  });
}

async function runLocalClientLifecycle(options, output) {
  const operation = options.positionals[0];
  const mutation = isLocalClientLifecycleMutation(options);
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });

  try {
    let data;
    if (operation === "list") {
      data = projectLocalClientRegistry(unwrapEnvelope(await client.localClients({
        includeDisabled: options.lifecycleIncludeDisabled,
        limit: options.lifecycleLimit ?? 100,
        offset: options.lifecycleOffset ?? 0,
        capabilities: options.lifecycleCapabilities,
      })));
    } else if (operation === "inspect") {
      data = projectLocalClientInspection(
        unwrapEnvelope(await client.inspectLocalClient(options.lifecycleClientId)),
        options.lifecycleClientId,
      );
    } else if (operation === "discover") {
      const request = {
        dryRun: !options.lifecycleApply,
        ...(options.lifecycleMaxProcesses === null
          ? {}
          : { maxProcesses: options.lifecycleMaxProcesses }),
        ...(options.lifecycleIncludeUnknown ? { includeUnknown: true } : {}),
        ...(options.lifecycleIncludeSystemProcesses ? { includeSystemProcesses: true } : {}),
        ...(options.lifecycleIncludeMissingAsDisabled
          ? { includeMissingAsDisabled: true }
          : {}),
        ...(options.lifecycleAutoDiscoverAll ? { autoDiscoverAll: true } : {}),
      };
      data = projectLocalClientDiscovery(
        unwrapEnvelope(await client.discoverLocalClients(request)),
        request,
      );
    } else if (operation === "register") {
      const adapterBinding = options.lifecycleAdapterId === null
        ? {}
        : {
            adapterId: options.lifecycleAdapterId,
            adapterType: options.lifecycleAdapterType,
            adapterVersion: options.lifecycleAdapterVersion,
            manifestSha256: options.lifecycleManifestSha256,
          };
      const request = {
        clientId: options.lifecycleClientId,
        ...(options.lifecycleDisplayName === null
          ? {}
          : { displayName: options.lifecycleDisplayName }),
        capabilityIds: options.lifecycleCapabilities,
        ...adapterBinding,
        ...(options.lifecycleProtocolVersion === null
          ? {}
          : { protocolVersion: options.lifecycleProtocolVersion }),
      };
      data = projectLocalClientMutationResult(
        unwrapEnvelope(await client.registerLocalClient(request)),
        operation,
        options.lifecycleClientId,
      );
    } else if (operation === "verify") {
      const request = {
        clientId: options.lifecycleClientId,
        expectedRevision: options.lifecycleRevision,
        expectedAdapter: {
          id: options.lifecycleAdapterId,
          type: options.lifecycleAdapterType,
          version: options.lifecycleAdapterVersion,
        },
        expectedManifestSha256: options.lifecycleManifestSha256,
      };
      data = projectLocalClientVerification(
        unwrapEnvelope(await client.verifyLocalClient(request)),
        request,
      );
    } else if (operation === "disable") {
      data = projectLocalClientMutationResult(
        unwrapEnvelope(await client.disableLocalClient({
          clientId: options.lifecycleClientId,
          reason: options.lifecycleReason ?? "manual_disable",
        })),
        operation,
        options.lifecycleClientId,
      );
    } else if (operation === "revoke") {
      data = projectLocalClientMutationResult(
        unwrapEnvelope(await client.revokeLocalClient({
          clientId: options.lifecycleClientId,
          expectedRevision: options.lifecycleRevision,
          reason: options.lifecycleReason ?? "manual_revoke",
        })),
        operation,
        options.lifecycleClientId,
      );
    } else {
      const request = { dryRun: !options.lifecycleApply };
      data = projectLocalClientSmartManage(
        unwrapEnvelope(await client.smartManageLocalClients(request)),
        request,
      );
    }

    const result = {
      ok: true,
      command: "clients",
      operation,
      mode: mutation
        ? "governed-mutation"
        : new Set(["discover", "smart-manage"]).has(operation)
          ? "dry-run"
          : "read-only",
      ...(mutation ? { retryAllowed: false } : { writesPerformed: false }),
      data,
    };
    if (options.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      renderLocalClientLifecycle(result, output);
    }
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw createSafeLocalClientLifecycleFailure(error, { operation, mutation });
  }
}

function projectLocalClientRegistry(value) {
  if (
    !isPlainRecord(value)
    || !isNonNegativeSafeInteger(value.total)
    || !Array.isArray(value.clients)
    || !isPlainRecord(value.pagination)
    || !isNonNegativeSafeInteger(value.pagination.offset)
    || !Number.isSafeInteger(value.pagination.limit)
    || value.pagination.limit < 1
    || !isNonNegativeSafeInteger(value.pagination.returned)
    || typeof value.pagination.includeDisabled !== "boolean"
  ) {
    throw new Error("invalid local-client registry response");
  }
  const clients = value.clients.map(projectManagedLocalClient);
  if (clients.length !== value.pagination.returned || clients.length > value.total) {
    throw new Error("inconsistent local-client registry response");
  }
  return Object.freeze({
    source: "registry-list",
    total: value.total,
    clients: Object.freeze(clients),
    pagination: Object.freeze({
      offset: value.pagination.offset,
      limit: value.pagination.limit,
      returned: value.pagination.returned,
      includeDisabled: value.pagination.includeDisabled,
    }),
  });
}

function projectLocalClientInspection(value, expectedClientId) {
  if (
    !isPlainRecord(value)
    || value.source !== "registry-list"
    || value.independentAuthority !== false
    || value.clientId !== expectedClientId
    || typeof value.found !== "boolean"
    || !Number.isSafeInteger(value.pagesScanned)
    || value.pagesScanned < 1
    || (value.found ? !isPlainRecord(value.client) : value.client !== null)
  ) {
    throw new Error("invalid local-client inspection response");
  }
  return Object.freeze({
    source: "registry-list",
    independentAuthority: false,
    clientId: expectedClientId,
    found: value.found,
    pagesScanned: value.pagesScanned,
    client: value.found ? projectManagedLocalClient(value.client) : null,
  });
}

function projectLocalClientDiscovery(value, request) {
  if (
    !isPlainRecord(value)
    || value.strategy !== "system-scan"
    || value.dryRun !== request.dryRun
    || !isNonNegativeSafeInteger(value.discovered)
    || typeof value.includeUnknown !== "boolean"
    || (request.dryRun && typeof value.includeMissingAsDisabled !== "boolean")
    || typeof value.includedSystemProcesses !== "boolean"
    || typeof value.autoDiscoverAll !== "boolean"
    || !Number.isSafeInteger(value.maxProcesses)
    || value.maxProcesses < 1
  ) {
    throw new Error("invalid local-client discovery response");
  }
  const droppedCount = projectLocalClientDiscoveryDroppedCount(value.dropped);
  const source = projectSafeLifecycleLabel(value.source);
  const common = {
    source,
    strategy: "system-scan",
    dryRun: value.dryRun,
    discovered: value.discovered,
    includeUnknown: value.includeUnknown,
    includeMissingAsDisabled: typeof value.includeMissingAsDisabled === "boolean"
      ? value.includeMissingAsDisabled
      : request.includeMissingAsDisabled === true || request.autoDiscoverAll === true,
    includeSystemProcesses: value.includedSystemProcesses,
    autoDiscoverAll: value.autoDiscoverAll,
    maxProcesses: value.maxProcesses,
    droppedCount,
  };
  if (request.dryRun) {
    if (!Array.isArray(value.candidates)) {
      throw new Error("invalid local-client discovery preview");
    }
    return Object.freeze({
      ...common,
      candidates: Object.freeze(value.candidates.map(projectManagedLocalClient)),
      writesPerformed: false,
    });
  }
  if (!Array.isArray(value.inserted) || !Array.isArray(value.updated)) {
    throw new Error("invalid local-client discovery mutation result");
  }
  return Object.freeze({
    ...common,
    inserted: Object.freeze(projectClientIdList(value.inserted)),
    updated: Object.freeze(projectClientIdList(value.updated)),
    registry: projectLocalClientRegistry(value.registry),
  });
}

function projectLocalClientMutationResult(value, operation, expectedClientId) {
  if (!isPlainRecord(value) || !isPlainRecord(value.client)) {
    throw new Error("invalid local-client mutation response");
  }
  const allowedActions = {
    register: new Set(["created", "updated"]),
    disable: new Set(["disabled"]),
    revoke: new Set(["revoked", "already-revoked"]),
  }[operation];
  if (!allowedActions.has(value.action)) {
    throw new Error("invalid local-client mutation action");
  }
  if (operation !== "register" && value.mode !== "applied") {
    throw new Error("invalid local-client mutation mode");
  }
  const client = projectManagedLocalClient(value.client);
  if (client.clientId !== expectedClientId) {
    throw new Error("local-client mutation target mismatch");
  }
  return Object.freeze({
    action: value.action,
    ...(operation === "register" ? {} : { mode: "applied" }),
    client,
  });
}

function projectLocalClientVerification(value, request) {
  if (
    !isPlainRecord(value)
    || value.promotionVersion !== "local-client-verification-promotion-v1"
    || value.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || value.clientId !== request.clientId
    || !Number.isSafeInteger(value.revision)
    || value.revision < request.expectedRevision
    || value.state !== "verified"
    || value.trustDecision !== "verified"
    || !isPlainRecord(value.adapter)
    || value.adapter.id !== request.expectedAdapter.id
    || value.adapter.type !== request.expectedAdapter.type
    || value.adapter.version !== request.expectedAdapter.version
    || value.manifestSha256 !== request.expectedManifestSha256
    || !Array.isArray(value.capabilityIds)
    || !isPlainRecord(value.verification)
    || !SHA256_PATTERN.test(value.verification.fingerprint)
    || !isNonNegativeSafeInteger(value.verification.verifiedAtMs)
    || !isNonNegativeSafeInteger(value.verification.expiresAtMs)
    || value.verification.verifiedAtMs >= value.verification.expiresAtMs
  ) {
    throw new Error("invalid local-client verification response");
  }
  return Object.freeze({
    promotionVersion: value.promotionVersion,
    descriptorVersion: value.descriptorVersion,
    clientId: value.clientId,
    revision: value.revision,
    state: "verified",
    trustDecision: "verified",
    adapter: Object.freeze({
      id: value.adapter.id,
      type: value.adapter.type,
      version: value.adapter.version,
    }),
    manifestSha256: value.manifestSha256,
    capabilityIds: Object.freeze(projectCapabilityList(value.capabilityIds)),
    verification: Object.freeze({
      fingerprint: value.verification.fingerprint,
      verifiedAtMs: value.verification.verifiedAtMs,
      expiresAtMs: value.verification.expiresAtMs,
    }),
  });
}

function projectLocalClientSmartManage(value, request) {
  if (
    !isPlainRecord(value)
    || value.action !== "smart-manage"
    || value.dryRun !== request.dryRun
    || typeof value.includeDiscoveryOnly !== "boolean"
    || !isPlainRecord(value.discovery)
    || value.discovery.dryRun !== request.dryRun
    || !isNonNegativeSafeInteger(value.discovery.discovered)
  ) {
    throw new Error("invalid local-client smart-manage response");
  }
  const droppedCount = projectLocalClientDiscoveryDroppedCount(value.discovery.dropped);
  const maintenance = value.maintenance === null
    ? null
    : projectLocalClientMaintenanceSummary(value.maintenance);
  return Object.freeze({
    action: "smart-manage",
    dryRun: value.dryRun,
    includeDiscoveryOnly: value.includeDiscoveryOnly,
    discovery: Object.freeze({
      source: projectSafeLifecycleLabel(value.discovery.source),
      dryRun: value.discovery.dryRun,
      discovered: value.discovery.discovered,
      includeUnknown: value.discovery.includeUnknown === true,
      includeMissingAsDisabled: value.discovery.includeMissingAsDisabled === true,
      includeSystemProcesses: value.discovery.includeSystemProcesses === true,
      autoDiscoverAll: value.discovery.autoDiscoverAll === true,
      droppedCount,
    }),
    maintenance,
    recommendationCount: Array.isArray(value.recommendations)
      ? value.recommendations.length
      : 0,
    registrySnapshotCount: Array.isArray(value.registrySnapshot)
      ? value.registrySnapshot.length
      : 0,
    ...(request.dryRun ? { writesPerformed: false } : {}),
  });
}

function projectLocalClientDiscoveryDroppedCount(value) {
  if (Array.isArray(value)) return value.length;
  const keys = [
    "filteredSystemProcessCount",
    "filteredUnknownCount",
    "duplicateProcessCount",
  ];
  if (
    !hasExactKeys(value, keys)
    || keys.some((key) => !isNonNegativeSafeInteger(value[key]))
  ) {
    throw new Error("invalid local-client discovery drop summary");
  }
  return keys.reduce((total, key) => total + value[key], 0);
}

function projectLocalClientMaintenanceSummary(value) {
  if (!isPlainRecord(value) || typeof value.dryRun !== "boolean") {
    throw new Error("invalid local-client maintenance response");
  }
  const summary = isPlainRecord(value.summary) ? value.summary : {};
  const counts = isPlainRecord(value.counts) ? value.counts : {};
  return Object.freeze({
    dryRun: value.dryRun,
    staleCandidates: projectOptionalCount(value.staleCandidates),
    autoRiskRecoveries: projectOptionalCount(value.autoRiskRecoveries),
    summary: Object.freeze({
      totalClients: projectOptionalCount(summary.totalClients),
      staleCandidates: projectOptionalCount(summary.staleCandidates),
      riskCandidates: projectOptionalCount(summary.riskCandidates),
      appliedChanges: projectOptionalCount(summary.appliedChanges),
    }),
    counts: Object.freeze({
      staleDisabledCount: projectOptionalCount(counts.staleDisabledCount),
      autoRiskRecoveredCount: projectOptionalCount(counts.autoRiskRecoveredCount),
      riskDisabledCount: projectOptionalCount(counts.riskDisabledCount),
      riskMarkedCount: projectOptionalCount(counts.riskMarkedCount),
    }),
  });
}

function projectManagedLocalClient(value) {
  if (
    !isPlainRecord(value)
    || !LOCAL_CLIENT_ID_PATTERN.test(value.clientId ?? "")
    || !new Set(["observed", "declared", "pending_approval", "verified", "disabled", "revoked"]).has(value.state)
    || typeof value.enabled !== "boolean"
    || typeof value.routable !== "boolean"
    || !Array.isArray(value.capabilityIds)
    || !isPlainRecord(value.health)
    || !new Set(["healthy", "degraded", "unhealthy", "unknown"]).has(value.health.status)
    || !new Set(["unverified", "declared", "verified", "rejected"]).has(value.trustDecision)
    || (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || value.revision < 1))
  ) {
    throw new Error("invalid managed local-client projection");
  }
  return Object.freeze({
    clientId: value.clientId,
    displayName: projectSafeDisplayName(value.displayName, value.clientId),
    state: value.state,
    enabled: value.enabled,
    routable: value.routable,
    ...projectOptionalDeclarationFields(value),
    capabilityIds: Object.freeze(projectCapabilityList(value.capabilityIds)),
    health: Object.freeze({
      status: value.health.status,
      ...(Number.isFinite(value.health.latencyMs)
        ? { latencyMs: value.health.latencyMs }
        : {}),
      ...(validIsoDate(value.health.lastSeenAt) ? { lastSeenAt: value.health.lastSeenAt } : {}),
      ...(validIsoDate(value.health.leaseExpiresAt)
        ? { leaseExpiresAt: value.health.leaseExpiresAt }
        : {}),
    }),
    trustDecision: value.trustDecision,
    ...(value.revision === undefined ? {} : { revision: value.revision }),
  });
}

function projectOptionalDeclarationFields(value) {
  const output = {};
  for (const key of ["adapterId", "adapterType", "adapterVersion", "protocolVersion"]) {
    if (value[key] === null) output[key] = null;
    else if (typeof value[key] === "string" && LOCAL_CLIENT_DECLARATION_PATTERN.test(value[key])) {
      output[key] = value[key];
    }
  }
  if (value.manifestSha256 === null) output.manifestSha256 = null;
  else if (SHA256_PATTERN.test(value.manifestSha256 ?? "")) {
    output.manifestSha256 = value.manifestSha256;
  }
  return output;
}

function projectCapabilityList(values) {
  const capabilities = values.map((value) => String(value).trim().toLowerCase());
  if (capabilities.some((value) => !LOCAL_CLIENT_CAPABILITY_PATTERN.test(value))) {
    throw new Error("invalid local-client capability projection");
  }
  return [...new Set(capabilities)];
}

function projectClientIdList(values) {
  if (values.some((value) => !LOCAL_CLIENT_ID_PATTERN.test(value ?? ""))) {
    throw new Error("invalid local-client id projection");
  }
  return [...new Set(values)];
}

function projectSafeDisplayName(value, fallback) {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 128
    && value === value.trim()
    && !/[\\/\u0000-\u001f\u007f]/u.test(value)
    ? value
    : fallback;
}

function projectSafeLifecycleLabel(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._:-]{0,127}$/u.test(value)) {
    throw new Error("invalid local-client response label");
  }
  return value;
}

function projectOptionalCount(value) {
  return isNonNegativeSafeInteger(value) ? value : 0;
}

function isLocalClientLifecycleMutation(options) {
  const operation = options.positionals[0];
  return LOCAL_CLIENT_LIFECYCLE_ALWAYS_MUTATING.has(operation)
    || (new Set(["discover", "smart-manage"]).has(operation) && options.lifecycleApply);
}

function createSafeLocalClientLifecycleFailure(error, { operation, mutation }) {
  const rawCode = typeof error?.code === "string" ? error.code : null;
  const allowlisted = SAFE_LOCAL_CLIENT_LIFECYCLE_ERROR_CODES.has(rawCode);
  const safeCode = allowlisted ? rawCode : "LOCAL_CLIENT_LIFECYCLE_UNAVAILABLE";
  const transportUncertain = new Set([
    "GATEWAY_CLIENT_ABORTED",
    "GATEWAY_CLIENT_TIMEOUT",
    "GATEWAY_HTTP_ERROR",
    "GATEWAY_NETWORK_ERROR",
    "GATEWAY_PROTOCOL_ERROR",
  ]).has(safeCode);
  const unknown = mutation && (
    transportUncertain
    || !allowlisted
    || (Number.isInteger(error?.statusCode) && error.statusCode >= 500)
  );
  return new CliLocalClientFailure(
    unknown ? "LOCAL_CLIENT_LIFECYCLE_OUTCOME_UNKNOWN" : safeCode,
    {
      operation,
      mutation,
      status: unknown ? "unknown-reconcile-required" : "rejected",
    },
  );
}

function renderLocalClientLifecycle(result, output) {
  const lines = [
    "",
    output.bold("Governed local-client lifecycle"),
    `Operation: ${result.operation}`,
    `Mode: ${result.mode}`,
  ];
  if (result.operation === "list") {
    lines.push(`Clients: ${result.data.total}`, "Configuration writes: none");
  } else if (result.operation === "inspect") {
    lines.push(
      `Client: ${result.data.clientId}`,
      `Found: ${result.data.found}`,
      "Source: registry-list (not an independent authoritative read)",
      "Configuration writes: none",
    );
  } else if (!isLocalClientLifecycleMutation({
    positionals: [result.operation],
    lifecycleApply: result.mode === "governed-mutation",
  })) {
    lines.push(
      `Discovered: ${result.data.discovery?.discovered ?? result.data.discovered ?? 0}`,
      "Configuration writes: none (dry-run)",
    );
  } else {
    const clientId = result.data.clientId ?? result.data.client?.clientId ?? null;
    if (clientId) lines.push(`Client: ${clientId}`);
    lines.push(
      `Status: ${result.data.action ?? result.data.state ?? "completed"}`,
      output.yellow("Automatic retry: forbidden; reconcile before another attempt."),
    );
  }
  output.write(`${lines.join("\n")}\n\n`);
}

async function runClientsOnboarding(options, output, receiptRoot) {
  const operation = options.positionals[0];
  const mutation = LOCAL_CLIENT_ONBOARDING_MUTATIONS.has(operation);
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: options.adminKey
      ? { authorization: `Bearer ${options.adminKey}` }
      : {},
  });

  try {
    let data;
    if (operation === "profiles") {
      data = {
        profiles: projectLocalClientOnboardingProfiles(
          unwrapEnvelope(await client.localClientOnboardingProfiles()),
        ),
        certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
      };
    } else if (operation === "inspect") {
      data = projectLocalClientOnboardingInspection(
        unwrapEnvelope(
          await client.localClientOnboardingProfile(options.onboardingProfileId),
        ),
        options.onboardingProfileId,
      );
    } else if (operation === "verify") {
      data = projectLocalClientOnboardingVerification(
        unwrapEnvelope(
          await client.verifyLocalClientOnboardingProfile(options.onboardingProfileId),
        ),
        options.onboardingProfileId,
      );
    } else if (operation === "plan") {
      const receipt = options.onboardingAction === "rollback"
        ? readBoundedLocalClientOnboardingReceipt({
            path: options.onboardingReceiptFile,
            root: receiptRoot,
            expectedProfileId: options.onboardingProfileId,
          })
        : undefined;
      const request = {
        profileId: options.onboardingProfileId,
        action: options.onboardingAction,
        ...(receipt === undefined ? {} : { receipt }),
      };
      data = projectLocalClientOnboardingPlan(
        unwrapEnvelope(await client.planGovernedLocalClientOnboarding(request)),
        request,
      );
    } else if (operation === "approve") {
      data = projectLocalClientOnboardingApproval(
        unwrapEnvelope(await client.approveGovernedLocalClientOnboarding(
          { planId: options.onboardingPlanId },
          { idempotencyKey: options.idempotencyKey },
        )),
        options.onboardingPlanId,
      );
    } else {
      const method = {
        apply: "applyGovernedLocalClientOnboarding",
        rollback: "rollbackGovernedLocalClientOnboarding",
        recover: "recoverGovernedLocalClientOnboarding",
      }[operation];
      data = projectLocalClientOnboardingMutationOutcome(
        unwrapEnvelope(await client[method](
          { planId: options.onboardingPlanId },
          { idempotencyKey: options.idempotencyKey },
        )),
        operation,
        options.onboardingPlanId,
      );
    }

    const result = {
      ok: true,
      command: "clients-onboarding",
      operation,
      mode: mutation ? "governed-mutation" : "read-only",
      ...(mutation ? { retryAllowed: false } : { writesPerformed: false }),
      data,
    };
    if (options.json) {
      output.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      renderLocalClientOnboardingCommand(result, output);
    }
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw createSafeLocalClientOnboardingFailure(error, { operation, mutation });
  }
}

function projectLocalClientOnboardingInspection(value, expectedProfileId) {
  if (!isPlainRecord(value)) throw new Error("invalid onboarding inspection");
  const profiles = projectLocalClientOnboardingProfiles(
    [value.profile],
    [expectedProfileId],
  );
  if (
    profiles.length !== 1
    || profiles[0].profileId !== expectedProfileId
    || typeof value.recoveryRequired !== "boolean"
    || typeof value.journalCorrupt !== "boolean"
    || !isNonNegativeSafeInteger(value.pendingTransactionCount)
    || !isNonNegativeSafeInteger(value.storedPlanCount)
    || value.available !== true
  ) {
    throw new Error("invalid onboarding inspection");
  }
  return Object.freeze({
    profile: profiles[0],
    installation: projectLocalClientOnboardingVerification(
      value.installation,
      expectedProfileId,
    ),
    recoveryRequired: value.recoveryRequired,
    journalCorrupt: value.journalCorrupt,
    pendingTransactionCount: value.pendingTransactionCount,
    storedPlanCount: value.storedPlanCount,
    available: true,
  });
}

function projectLocalClientOnboardingVerification(value, expectedProfileId) {
  if (
    !isPlainRecord(value)
    || value.profileId !== expectedProfileId
    || typeof value.installed !== "boolean"
    || !new Set(["exact", "absent", "different"]).has(value.state)
    || value.installed !== (value.state === "exact")
    || value.format !== "json-only"
    || value.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding verification");
  }
  return Object.freeze({
    profileId: expectedProfileId,
    installed: value.installed,
    state: value.state,
    format: "json-only",
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    redacted: true,
  });
}

function projectLocalClientOnboardingPlan(value, request) {
  if (
    !isPlainRecord(value)
    || value.apiVersion !== "local-client-governed-onboarding-api-v1"
    || value.planVersion !== "local-client-governed-onboarding-plan-v1"
    || !LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN.test(value.planId)
    || value.profileId !== request.profileId
    || value.action !== request.action
    || !isNonNegativeSafeInteger(value.createdAtMs)
    || !isNonNegativeSafeInteger(value.expiresAtMs)
    || value.createdAtMs >= value.expiresAtMs
    || value.writesPerformed !== false
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding plan");
  }
  return Object.freeze({
    apiVersion: value.apiVersion,
    planVersion: value.planVersion,
    planId: value.planId,
    profileId: value.profileId,
    action: value.action,
    createdAtMs: value.createdAtMs,
    expiresAtMs: value.expiresAtMs,
    writesPerformed: false,
    redacted: true,
  });
}

function projectLocalClientOnboardingApproval(value, expectedPlanId) {
  if (
    !isPlainRecord(value)
    || value.apiVersion !== "local-client-governed-onboarding-api-v1"
    || value.operation !== "approve"
    || value.status !== "approved"
    || typeof value.approvalId !== "string"
    || value.approvalId.length < 1
    || value.approvalId.length > 256
    || value.planId !== expectedPlanId
    || !validIsoDate(value.approvedAt)
    || !validIsoDate(value.expiresAt)
    || Date.parse(value.approvedAt) >= Date.parse(value.expiresAt)
    || value.writesPerformed !== false
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding approval");
  }
  return Object.freeze({
    apiVersion: value.apiVersion,
    operation: "approve",
    status: "approved",
    approvalId: value.approvalId,
    planId: value.planId,
    approvedAt: value.approvedAt,
    expiresAt: value.expiresAt,
    writesPerformed: false,
    redacted: true,
  });
}

function projectLocalClientOnboardingMutationOutcome(value, operation, expectedPlanId) {
  if (
    !isPlainRecord(value)
    || value.accepted !== true
    || !new Set(["completed", "replayed"]).has(value.status)
    || !new Set(["created", "replayed"]).has(value.idempotencyStatus)
    || typeof value.replayed !== "boolean"
    || value.replayed !== (value.status === "replayed")
    || value.replayable !== true
    || typeof value.operationInvoked !== "boolean"
    || value.retryAllowed !== false
  ) {
    throw new Error("invalid onboarding mutation outcome");
  }
  return Object.freeze({
    accepted: true,
    status: value.status,
    idempotencyStatus: value.idempotencyStatus,
    replayed: value.replayed,
    replayable: true,
    operationInvoked: value.operationInvoked,
    retryAllowed: false,
    result: projectLocalClientOnboardingMutationResult(
      value.result,
      operation,
      expectedPlanId,
    ),
  });
}

function projectLocalClientOnboardingMutationResult(value, operation, expectedPlanId) {
  const expectedAction = operation === "apply" ? null : operation;
  if (
    !isPlainRecord(value)
    || value.apiVersion !== "local-client-governed-onboarding-api-v1"
    || value.operation !== operation
    || !LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.has(value.profileId)
    || value.planId !== expectedPlanId
    || value.status !== "completed"
    || value.redacted !== true
    || (expectedAction === null
      ? !new Set(["enable", "disable"]).has(value.action)
      : value.action !== expectedAction)
  ) {
    throw new Error("invalid onboarding mutation result");
  }
  const receipt = operation === "apply"
    ? projectLocalClientOnboardingApplyReceipt(value.receipt, value.profileId)
    : projectLocalClientOnboardingReceiptSummary(value.receipt, operation, value.profileId);
  return Object.freeze({
    apiVersion: value.apiVersion,
    operation,
    profileId: value.profileId,
    action: value.action,
    planId: value.planId,
    status: "completed",
    receipt,
    redacted: true,
  });
}

function projectLocalClientOnboardingReceiptSummary(value, operation, expectedProfileId) {
  if (
    !isPlainRecord(value)
    || value.profileId !== expectedProfileId
    || value.format !== "json-only"
    || value.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
    || value.redacted !== true
  ) {
    throw new Error("invalid onboarding mutation receipt");
  }
  if (
    operation === "rollback"
    && (
      value.rollbackVersion !== "local-client-onboarding-rollback-v1"
      || !new Set(["enable", "disable"]).has(value.action)
      || !LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN.test(value.planId)
    )
  ) {
    throw new Error("invalid onboarding rollback receipt");
  }
  if (
    operation === "recover"
    && value.recoveryVersion !== "local-client-onboarding-recovery-v1"
  ) {
    throw new Error("invalid onboarding recovery receipt");
  }
  return Object.freeze({
    ...(operation === "rollback"
      ? {
          rollbackVersion: value.rollbackVersion,
          action: value.action,
          planId: value.planId,
        }
      : { recoveryVersion: value.recoveryVersion }),
    profileId: value.profileId,
    format: "json-only",
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    redacted: true,
  });
}

function readBoundedLocalClientOnboardingReceipt({ path, root, expectedProfileId }) {
  let rootPath;
  let unresolvedPath;
  let receiptPath;
  let fileStat;
  try {
    rootPath = realpathSync(root);
    unresolvedPath = resolve(rootPath, path);
    if (lstatSync(unresolvedPath).isSymbolicLink()) {
      throw new CliUsageError("Rollback receipt files cannot be symbolic links.");
    }
    receiptPath = realpathSync(unresolvedPath);
    const relativePath = relative(rootPath, receiptPath);
    if (isAbsolute(relativePath) || /^\.\.(?:[\\/]|$)/u.test(relativePath)) {
      throw new CliUsageError("Rollback receipt file must stay within the current working directory.");
    }
    fileStat = statSync(receiptPath);
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw new CliUsageError("Rollback receipt file is unavailable or unsafe.");
  }
  if (
    !fileStat.isFile()
    || fileStat.size < 2
    || fileStat.size > LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES
  ) {
    throw new CliUsageError(
      `Rollback receipt file must be a JSON file no larger than ${LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES} bytes.`,
    );
  }
  let rawReceipt;
  try {
    rawReceipt = readFileSync(receiptPath, "utf8");
  } catch {
    throw new CliUsageError("Rollback receipt file is unavailable or unsafe.");
  }
  if (Buffer.byteLength(rawReceipt, "utf8") > LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES) {
    throw new CliUsageError(
      `Rollback receipt file must be a JSON file no larger than ${LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES} bytes.`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(rawReceipt);
  } catch {
    throw new CliUsageError("Rollback receipt file must contain valid JSON.");
  }
  try {
    return projectLocalClientOnboardingApplyReceipt(parsed, expectedProfileId);
  } catch {
    throw new CliUsageError(
      "Rollback receipt must be an exact redacted local-client onboarding apply receipt.",
    );
  }
}

function projectLocalClientOnboardingApplyReceipt(value, expectedProfileId) {
  const topKeys = [
    "receiptVersion",
    "profileId",
    "action",
    "planId",
    "transaction",
    "receiptDigest",
    "format",
    "certificationStatus",
    "redacted",
  ];
  const transactionKeys = [
    "receiptVersion",
    "transactionId",
    "planId",
    "targetFingerprint",
    "beforeSha256",
    "afterSha256",
    "backupSha256",
    "afterIdentityFingerprint",
    "committedAtMs",
    "receiptDigest",
  ];
  if (
    !hasExactKeys(value, topKeys)
    || value.receiptVersion !== "local-client-onboarding-receipt-v1"
    || value.profileId !== expectedProfileId
    || !new Set(["enable", "disable"]).has(value.action)
    || !LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN.test(value.planId)
    || !SHA256_PATTERN.test(value.receiptDigest)
    || value.format !== "json-only"
    || value.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
    || value.redacted !== true
    || !hasExactKeys(value.transaction, transactionKeys)
    || value.transaction.receiptVersion !== "local-client-config-receipt-v1"
    || !LOCAL_CLIENT_ONBOARDING_TRANSACTION_ID_PATTERN.test(value.transaction.transactionId)
    || !transactionKeys.slice(2, 8).every((key) => SHA256_PATTERN.test(value.transaction[key]))
    || !isNonNegativeSafeInteger(value.transaction.committedAtMs)
    || !SHA256_PATTERN.test(value.transaction.receiptDigest)
    || !value.planId.endsWith(`:${value.transaction.planId}`)
  ) {
    throw new Error("invalid onboarding apply receipt");
  }
  return Object.freeze({
    receiptVersion: value.receiptVersion,
    profileId: value.profileId,
    action: value.action,
    planId: value.planId,
    transaction: Object.freeze({
      receiptVersion: value.transaction.receiptVersion,
      transactionId: value.transaction.transactionId,
      planId: value.transaction.planId,
      targetFingerprint: value.transaction.targetFingerprint,
      beforeSha256: value.transaction.beforeSha256,
      afterSha256: value.transaction.afterSha256,
      backupSha256: value.transaction.backupSha256,
      afterIdentityFingerprint: value.transaction.afterIdentityFingerprint,
      committedAtMs: value.transaction.committedAtMs,
      receiptDigest: value.transaction.receiptDigest,
    }),
    receiptDigest: value.receiptDigest,
    format: "json-only",
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    redacted: true,
  });
}

function createSafeLocalClientOnboardingFailure(error, { operation, mutation }) {
  const rawCode = typeof error?.code === "string" ? error.code : null;
  const safeCode = SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(rawCode)
    ? rawCode
    : "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE";
  const transportUncertain = new Set([
    "GATEWAY_CLIENT_ABORTED",
    "GATEWAY_CLIENT_TIMEOUT",
    "GATEWAY_HTTP_ERROR",
    "GATEWAY_NETWORK_ERROR",
    "GATEWAY_PROTOCOL_ERROR",
  ]).has(safeCode);
  const unknown = UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(safeCode)
    || (
      mutation
      && (
        transportUncertain
        || !SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(rawCode)
      )
    );
  return new CliOnboardingFailure(
    unknown
      ? (UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(safeCode)
          ? safeCode
          : "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN")
      : safeCode,
    {
      operation,
      status: unknown ? "unknown-reconcile-required" : "rejected",
    },
  );
}

function renderLocalClientOnboardingCommand(result, output) {
  const lines = [
    "",
    output.bold("Governed local-client onboarding"),
    `Operation: ${result.operation}`,
    `Mode: ${result.mode}`,
  ];
  if (result.operation === "profiles") {
    lines.push(
      ...result.data.profiles.map((profile) => `  - ${profile.profileId} (${profile.client})`),
      "Configuration writes: none",
    );
  } else if (result.operation === "inspect") {
    lines.push(
      `Profile: ${result.data.profile.profileId}`,
      `Installation state: ${result.data.installation.state}`,
      `Recovery required: ${result.data.recoveryRequired}`,
      "Configuration writes: none",
    );
  } else if (result.operation === "verify") {
    lines.push(
      `Profile: ${result.data.profileId}`,
      `Installation state: ${result.data.state}`,
      "Configuration writes: none",
    );
  } else if (result.operation === "plan") {
    lines.push(
      `Plan: ${result.data.planId}`,
      `Profile: ${result.data.profileId}`,
      `Action: ${result.data.action}`,
      "Configuration writes: none",
    );
  } else if (result.operation === "approve") {
    lines.push(
      `Plan: ${result.data.planId}`,
      `Status: ${result.data.status}`,
      "Configuration writes: none",
      output.yellow("Automatic retry: forbidden; reconcile before another attempt."),
    );
  } else {
    lines.push(
      `Plan: ${result.data.result.planId}`,
      `Status: ${result.data.status}`,
      `Idempotency: ${result.data.idempotencyStatus}`,
      "Receipt: redacted",
      output.yellow("Automatic retry: forbidden; reconcile before another attempt."),
    );
  }
  output.write(`${lines.join("\n")}\n\n`);
}

function hasExactKeys(value, keys) {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validIsoDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

async function loadLocalClientOnboarding(client) {
  try {
    const response = await client.localClientOnboardingProfiles();
    return Object.freeze({
      available: true,
      profiles: projectLocalClientOnboardingProfiles(unwrapEnvelope(response)),
      certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
    });
  } catch (error) {
    if (
      error?.statusCode !== 503
      && error?.code !== "LOCAL_CLIENT_ONBOARDING_DISABLED"
    ) {
      throw error;
    }
    return Object.freeze({
      available: false,
      code: redactLocalClientOnboardingErrorCode(error),
    });
  }
}

function projectLocalClientOnboardingProfiles(value, expectedProfileIds = null) {
  const rawProfiles = Array.isArray(value)
    ? value
    : Array.isArray(value?.profiles)
      ? value.profiles
      : [];
  const definitions = expectedProfileIds === null
    ? LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS
    : LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.filter((definition) => (
        expectedProfileIds.includes(definition.profileId)
      ));
  if (
    definitions.length < 1
    || definitions.length !== (expectedProfileIds?.length ?? definitions.length)
    || rawProfiles.length !== definitions.length
    || new Set(rawProfiles.map((profile) => profile?.profileId)).size !== rawProfiles.length
  ) {
    throw new Error("invalid local-client onboarding profile set");
  }
  const profilesById = new Map(rawProfiles.map((profile) => [profile?.profileId, profile]));
  return Object.freeze(definitions.map((definition) => {
    const profile = profilesById.get(definition.profileId);
    if (
      !profile
      || profile.client !== definition.client
      || profile.format !== "json-only"
      || profile.containerKey !== definition.containerKey
      || profile.serverName !== "unified-ai-system"
      || profile.transport !== "stdio"
      || !Array.isArray(profile.supportedActions)
      || profile.supportedActions.length !== 2
      || profile.supportedActions[0] !== "enable"
      || profile.supportedActions[1] !== "disable"
      || profile.certificationStatus !== LOCAL_CLIENT_ONBOARDING_CERTIFICATION
      || !new Set(["aes-256-gcm", "0600-plaintext"]).has(profile.backupProtection)
      || profile.redacted !== true
    ) {
      throw new Error("invalid local-client onboarding profile");
    }
    return Object.freeze({
      profileId: definition.profileId,
      client: profile.client,
      format: profile.format,
      containerKey: profile.containerKey,
      serverName: profile.serverName,
      transport: profile.transport,
      backupProtection: profile.backupProtection,
      supportedActions: Object.freeze([...profile.supportedActions]),
      certificationStatus: profile.certificationStatus,
      redacted: true,
    });
  }));
}

function redactLocalClientOnboardingErrorCode(error) {
  return SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(error?.code)
    ? error.code
    : "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE";
}

function renderLocalClientOnboarding(onboarding, output) {
  if (!onboarding.available) {
    return [
      output.muted(`Onboarding profiles: unavailable (${onboarding.code})`),
      output.muted("inspection only; no config changed"),
    ];
  }
  const labelsByClient = new Map(
    LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS.map((definition) => [definition.client, definition.label]),
  );
  return [
    output.bold("Supported onboarding profiles"),
    ...onboarding.profiles.map((profile) => (
      `  - ${labelsByClient.get(profile.client)}: ${profile.profileId} (${profile.backupProtection} backup)`
    )),
    `Certification: ${onboarding.certificationStatus}`,
    output.muted("inspection only; no config changed"),
  ];
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
  agents <operation> Governed Agent status, lifecycle, execution, and approvals
                     status, list, show, generate, run, revoke, approvals, approve, reject
  clients [operation]
                   discover, list, inspect, register, verify, disable, revoke, smart-manage
  clients-onboarding <operation>
                   Governed profiles, inspection, planning, and explicit mutations
  demo [prompt]    Run an isolated credential-free demonstration
  serve            Start the local gateway
  status           Inspect gateway and chat readiness
  enhance [prompt] Preview a structured prompt without calling a model
  forge status       Read-only Forge status (provider/mutation commands disabled)
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
  --admin-key <uai-…>         Admin virtual key (clients/onboarding mutations/spend)
  --client-id <id>            Bounded lifecycle client identifier
  --display-name <name>       Safe display name for register
  --capability <id>           Repeatable list filter or register capability
  --include-disabled          Include disabled clients in list
  --limit <n>                 Registry page size, 1-100
  --offset <n>                Registry page offset
  --apply                     Apply discover/smart-manage; default is dry-run
  --max-processes <n>         System discovery bound, 1-10000
  --include-unknown           Include unknown processes in discovery preview/apply
  --include-system-processes  Include system processes in discovery preview/apply
  --include-missing-as-disabled
                               Mark missing discovered clients disabled when applied
  --auto-discover-all         Enable the service's bounded full-process discovery mode
  --revision <n>              Exact current revision for verify or revoke
  --adapter-id <id>           Exact adapter identifier for register or verify
  --adapter-type <type>       Exact adapter type for register or verify
  --adapter-version <semver>  Exact adapter version for register or verify
  --manifest-sha256 <sha256>  Exact manifest binding for register or verify
  --protocol-version <value>  Optional bounded register protocol identifier
  --reason <value>            Allowlisted disable or revoke reason
  --agent-id <agt_...>        Server-issued Agent identifier
  --approval-id <appr_...>    Server-issued Agent approval identifier
  --name <name>               Agent name for agents generate
  --task <text>               Agent task for agents generate
  --goal <text>               Execution goal for agents run
  --tool <name>               Repeatable requested/run tool identifier
  --ttl-seconds <n>           Agent lifetime, 1-2592000 seconds
  --parent-agent-id <agt_...> Optional parent for agents generate
  --max-iterations <n>        Agent run iteration bound, 1-25
  --run-timeout-ms <n>        Agent wall-clock bound, 1000-120000ms (transport adds 5s)
  --tool-mode <mode>          none or readonly
  --provider-id <id>          Explicit Agent run provider
  --model-id <id>             Explicit Agent run model
  --cascade                   Revoke the Agent and descendants
  --profile-id <id>           Onboarding profile for inspect, verify, or plan
  --action <action>           enable, disable, rollback, or recover (plan only)
  --plan-id <id>              Server-issued onboarding plan for mutations
  --receipt-file <json>       Redacted apply receipt for a rollback plan
  --idempotency-key <key>     Explicit mutation key; never generated or retried
  --yes                       Confirm one governed client mutation
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
  # First set AGENT_CONSOLE_ADMIN_KEY in the environment; do not put it in argv.
  pnpm gateway agents status
  pnpm gateway agents list
  pnpm gateway agents generate --name report-reader --task "Read the report" --tool file_read --yes
  pnpm gateway agents run --agent-id agt_<id> --goal "Read README" --tool file_read --yes
  pnpm gateway agents approvals --agent-id agt_<id>
  pnpm gateway agents approve --approval-id appr_<id> --yes
  pnpm gateway agents revoke --agent-id agt_<id> --reason operator_requested --yes
  pnpm gateway clients
  pnpm gateway clients list --include-disabled
  pnpm gateway clients inspect --client-id desktop-browser
  pnpm gateway clients discover --max-processes 200
  pnpm gateway clients discover --apply --yes
  pnpm gateway clients revoke --client-id desktop-browser --revision 7 --yes
  pnpm gateway clients-onboarding profiles
  pnpm gateway clients-onboarding inspect --profile-id cursor-mcp-json
  pnpm gateway clients-onboarding plan --profile-id cursor-mcp-json --action enable
  pnpm gateway clients-onboarding approve --plan-id onboarding_<sha256> --yes --idempotency-key <key>
  pnpm gateway clients-onboarding apply --plan-id onboarding_<sha256> --yes --idempotency-key <new-key>
  pnpm gateway spend
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
  clients discover and smart-manage are dry-run unless --apply --yes is explicit.
  lifecycle mutations require a scoped control-plane key and --yes and are never retried automatically.
  clients inspect is a bounded registry-list helper, not an independent authoritative read.
  onboarding profiles, inspect, verify, and plan never write client config.
  onboarding mutations require a scoped control-plane key, --yes, and an explicit idempotency key.
  mutation requests are sent once; unknown outcomes require reconciliation, not retry.
  Agent generate, run, revoke, approve, and reject require --yes and are sent once.
  Agent approval decisions remain human CLI operations; the MCP model surface cannot decide them.
  Agent runs default to tool-mode none and fake-provider routing unless explicitly configured.
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
    !["chat", "demo", "enhance", "clients", "clients-onboarding", "agents", "forge"].includes(options.command)
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
    || options.onboardingReceiptFile !== null
    || options.idempotencyKey !== null;
  if (options.command !== "clients-onboarding" && onboardingOptionsUsed) {
    throw new CliUsageError(
      "--profile-id, --action, --plan-id, --receipt-file, and --idempotency-key are only valid with clients-onboarding.",
    );
  }
  const lifecycleOptionsUsed = localClientLifecycleOptionsUsed(options);
  if (options.command !== "clients" && lifecycleOptionsUsed) {
    throw new CliUsageError(
      "Local-client lifecycle options are only valid with the clients command.",
    );
  }
  const agentOptionsUsed = agentGovernanceOptionsUsed(options);
  if (options.command !== "agents" && agentOptionsUsed) {
    throw new CliUsageError("Agent Governance options are only valid with the agents command.");
  }
  if (options.agentReason !== null && !new Set(["agents", "clients"]).has(options.command)) {
    throw new CliUsageError("--reason is only valid with agents or clients.");
  }
  if (!new Set(["clients", "clients-onboarding", "agents"]).has(options.command) && options.confirmed) {
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
  if (options.command === "forge") {
    validateForgeOptions(options);
  }
  if (options.allowRealProvider && options.command !== "chat"
    && !(options.command === "agents" && options.positionals[0] === "run")) {
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
    && !["agents", "chat", "clients", "clients-onboarding", "doctor", "enhance", "forge", "spend", "status"].includes(options.command)
  ) {
    throw new CliUsageError(
      "--url and --timeout are only valid with networked gateway commands.",
    );
  }
  if (options.json && options.command === "serve") {
    throw new CliUsageError("--json is not supported by serve.");
  }

  if (["agents", "chat", "clients", "clients-onboarding", "doctor", "enhance", "forge", "spend", "status"].includes(options.command)) {
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

function validateAgentGovernanceOptions(options) {
  if (options.prompt !== null || options.positionals.length !== 1) {
    throw new CliUsageError(
      "agents requires exactly one operation: status, list, show, generate, run, revoke, approvals, approve, or reject.",
    );
  }
  const operation = options.positionals[0];
  if (!AGENT_GOVERNANCE_SUBCOMMANDS.has(operation)) {
    throw new CliUsageError(`Unsupported agents operation: ${operation}`);
  }
  if (!options.adminKey) {
    throw new CliUsageError(
      `${operation} requires a scoped Agent Governance key.`,
      { hint: "Set AGENT_CONSOLE_ADMIN_KEY or pass --admin-key." },
    );
  }

  const mutation = AGENT_GOVERNANCE_MUTATIONS.has(operation);
  if (mutation && !options.confirmed) {
    throw new CliUsageError(`${operation} requires explicit --yes confirmation.`);
  }
  if (!mutation && options.confirmed) {
    throw new CliUsageError("--yes is only valid with generate, run, revoke, approve, or reject.");
  }

  const needsAgentId = new Set(["show", "run", "revoke"]).has(operation);
  const allowsAgentId = needsAgentId || operation === "approvals";
  if (needsAgentId && !AGENT_ID_PATTERN.test(options.agentId ?? "")) {
    throw new CliUsageError(`${operation} requires a valid server-issued --agent-id.`);
  }
  if (allowsAgentId && options.agentId !== null && !AGENT_ID_PATTERN.test(options.agentId)) {
    throw new CliUsageError("--agent-id must be a valid server-issued Agent identifier.");
  }
  if (!allowsAgentId && options.agentId !== null) {
    throw new CliUsageError("--agent-id is only valid with show, run, revoke, or approvals.");
  }

  const needsApprovalId = operation === "approve" || operation === "reject";
  if (needsApprovalId && !AGENT_APPROVAL_ID_PATTERN.test(options.agentApprovalId ?? "")) {
    throw new CliUsageError(`${operation} requires a valid server-issued --approval-id.`);
  }
  if (!needsApprovalId && options.agentApprovalId !== null) {
    throw new CliUsageError("--approval-id is only valid with approve or reject.");
  }

  if (operation === "generate") {
    options.agentName = normalizeAgentText(options.agentName, "--name", 128);
    options.agentTask = normalizeAgentText(options.agentTask, "--task", 4_000);
    if (options.agentParentId !== null && !AGENT_ID_PATTERN.test(options.agentParentId)) {
      throw new CliUsageError("--parent-agent-id must be a valid server-issued Agent identifier.");
    }
  } else if (options.agentName !== null || options.agentTask !== null
    || options.agentTtlSeconds !== null || options.agentParentId !== null) {
    throw new CliUsageError("--name, --task, --ttl-seconds, and --parent-agent-id are only valid with generate.");
  }

  if (operation === "run") {
    options.agentGoal = normalizeAgentText(options.agentGoal, "--goal", 4_000);
    if (options.agentToolMode !== null && !new Set(["none", "readonly"]).has(options.agentToolMode)) {
      throw new CliUsageError("--tool-mode must be none or readonly.");
    }
    if (options.agentToolMode === "none" && options.agentTools.length > 0) {
      throw new CliUsageError("--tool cannot be combined with --tool-mode none.");
    }
    for (const [flag, value] of [["--provider-id", options.agentProviderId], ["--model-id", options.agentModelId]]) {
      if (value !== null && (value.length > 256 || !/^[A-Za-z0-9._:/-]+$/u.test(value))) {
        throw new CliUsageError(`${flag} must be a bounded provider/model identifier.`);
      }
    }
    if (options.agentProviderId !== null
      && options.agentProviderId !== "local-fake-provider"
      && !options.allowRealProvider) {
      throw new CliUsageError(
        "An explicitly selected non-fake Agent provider requires --allow-real-provider.",
      );
    }
  } else if (options.agentGoal !== null || options.agentMaxIterations !== null
    || options.agentRunTimeoutMs !== null
    || options.agentToolMode !== null || options.agentProviderId !== null
    || options.agentModelId !== null || options.allowRealProvider) {
    throw new CliUsageError(
      "--goal, --max-iterations, --run-timeout-ms, --tool-mode, --provider-id, and --model-id are only valid with agents run.",
    );
  }

  if (!new Set(["generate", "run"]).has(operation) && options.agentTools.length > 0) {
    throw new CliUsageError("--tool is only valid with generate or run.");
  }
  const tools = options.agentTools.map((value) => String(value).trim());
  if (tools.some((value) => !AGENT_TOOL_NAME_PATTERN.test(value))) {
    throw new CliUsageError("--tool values must be bounded registered-tool identifiers.");
  }
  options.agentTools = [...new Set(tools)];

  if (operation === "revoke") {
    if (options.agentReason !== null) {
      options.agentReason = normalizeAgentText(options.agentReason, "--reason", 500);
    }
  } else if (options.agentReason !== null || options.agentCascade) {
    throw new CliUsageError("--reason and --cascade are only valid with revoke.");
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

function normalizeAgentText(value, flag, maxLength) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new CliUsageError(`${flag} must be non-empty, bounded, and free of control characters.`);
  }
  return normalized;
}

function validateForgeOptions(options) {
  if (options.prompt !== null || options.positionals.length !== 1 || options.positionals[0] !== "status") {
    throw new CliUsageError(
      "Only read-only forge status is available; provider and mutation subcommands remain disabled.",
    );
  }
}

function validateLocalClientLifecycleOptions(options) {
  if (options.prompt !== null || options.positionals.length > 1) {
    throw new CliUsageError(
      "clients accepts at most one operation: discover, list, inspect, register, verify, disable, revoke, or smart-manage.",
    );
  }
  if (options.positionals.length === 0) {
    if (localClientLifecycleOptionsUsed(options) || options.confirmed) {
      throw new CliUsageError("Lifecycle options require an explicit clients operation.");
    }
    return;
  }

  const operation = options.positionals[0];
  if (!LOCAL_CLIENT_LIFECYCLE_SUBCOMMANDS.has(operation)) {
    throw new CliUsageError(`Unsupported clients operation: ${operation}`);
  }
  if (!options.adminKey) {
    throw new CliUsageError(
      `${operation} requires an admin key.`,
      { hint: "Pass --admin-key or set AGENT_CONSOLE_ADMIN_KEY." },
    );
  }

  const mutation = isLocalClientLifecycleMutation(options);
  if (mutation && !options.confirmed) {
    throw new CliUsageError(`${operation} requires explicit --yes confirmation.`);
  }
  if (!mutation && options.confirmed) {
    throw new CliUsageError("--yes is only valid with an applied lifecycle mutation.");
  }
  if (options.lifecycleApply && !new Set(["discover", "smart-manage"]).has(operation)) {
    throw new CliUsageError("--apply is only valid with discover or smart-manage.");
  }

  const requiresClientId = new Set(["inspect", "register", "verify", "disable", "revoke"])
    .has(operation);
  if (requiresClientId) {
    if (!LOCAL_CLIENT_ID_PATTERN.test(options.lifecycleClientId ?? "")) {
      throw new CliUsageError(
        `${operation} requires a lowercase letter-leading --client-id using letters, digits, dot, underscore, or hyphen.`,
      );
    }
  } else if (options.lifecycleClientId !== null) {
    throw new CliUsageError("--client-id is only valid with inspect, register, verify, disable, or revoke.");
  }

  const normalizedCapabilities = options.lifecycleCapabilities
    .map((value) => String(value).trim());
  if (normalizedCapabilities.some((value) => (
    value !== value.toLowerCase()
    || !LOCAL_CLIENT_CAPABILITY_PATTERN.test(value)
  ))) {
    throw new CliUsageError(
      "--capability values must be bounded lowercase identifiers without paths or whitespace.",
    );
  }
  options.lifecycleCapabilities = [...new Set(normalizedCapabilities)];
  if (!new Set(["list", "register"]).has(operation) && options.lifecycleCapabilities.length > 0) {
    throw new CliUsageError("--capability is only valid with list or register.");
  }
  if (operation === "register" && options.lifecycleCapabilities.length === 0) {
    throw new CliUsageError("register requires at least one --capability.");
  }

  const listOptionsUsed = options.lifecycleIncludeDisabled
    || options.lifecycleLimit !== null
    || options.lifecycleOffset !== null;
  if (operation !== "list" && listOptionsUsed) {
    throw new CliUsageError("--include-disabled, --limit, and --offset are only valid with list.");
  }

  const discoveryOptionsUsed = options.lifecycleMaxProcesses !== null
    || options.lifecycleIncludeUnknown
    || options.lifecycleIncludeSystemProcesses
    || options.lifecycleIncludeMissingAsDisabled
    || options.lifecycleAutoDiscoverAll;
  if (operation !== "discover" && discoveryOptionsUsed) {
    throw new CliUsageError("System discovery options are only valid with discover.");
  }

  if (options.lifecycleDisplayName !== null) {
    if (
      operation !== "register"
      || options.lifecycleDisplayName.length < 1
      || options.lifecycleDisplayName.length > 128
      || options.lifecycleDisplayName !== options.lifecycleDisplayName.trim()
      || /[\\/\u0000-\u001f\u007f]/u.test(options.lifecycleDisplayName)
    ) {
      throw new CliUsageError("--display-name is only valid for register and cannot contain a path or control characters.");
    }
  }

  const adapterValues = [
    options.lifecycleAdapterId,
    options.lifecycleAdapterType,
    options.lifecycleAdapterVersion,
    options.lifecycleManifestSha256,
  ];
  const adapterCount = adapterValues.filter((value) => value !== null).length;
  if (new Set(["register", "verify"]).has(operation)) {
    if ((operation === "verify" && adapterCount !== 4) || (adapterCount !== 0 && adapterCount !== 4)) {
      throw new CliUsageError(
        `${operation} requires the complete adapter binding: --adapter-id, --adapter-type, --adapter-version, and --manifest-sha256.`,
      );
    }
    if (
      adapterCount === 4
      && (
        !LOCAL_CLIENT_DECLARATION_PATTERN.test(options.lifecycleAdapterId)
        || !LOCAL_CLIENT_DECLARATION_PATTERN.test(options.lifecycleAdapterType)
        || !LOCAL_CLIENT_SEMVER_PATTERN.test(options.lifecycleAdapterVersion)
        || !SHA256_PATTERN.test(options.lifecycleManifestSha256)
      )
    ) {
      throw new CliUsageError("The adapter binding is invalid or not canonically formatted.");
    }
  } else if (adapterCount > 0) {
    throw new CliUsageError("Adapter binding options are only valid with register or verify.");
  }

  if (options.lifecycleProtocolVersion !== null) {
    if (
      operation !== "register"
      || !LOCAL_CLIENT_DECLARATION_PATTERN.test(options.lifecycleProtocolVersion)
    ) {
      throw new CliUsageError("--protocol-version is only valid with register and must be a bounded identifier.");
    }
  }

  if (new Set(["verify", "revoke"]).has(operation)) {
    if (!Number.isSafeInteger(options.lifecycleRevision) || options.lifecycleRevision < 1) {
      throw new CliUsageError(`${operation} requires the exact current --revision.`);
    }
  } else if (options.lifecycleRevision !== null) {
    throw new CliUsageError("--revision is only valid with verify or revoke.");
  }

  if (options.lifecycleReason !== null) {
    const allowed = operation === "disable"
      ? LOCAL_CLIENT_DISABLE_REASONS
      : operation === "revoke"
        ? LOCAL_CLIENT_REVOKE_REASONS
        : null;
    if (!allowed?.has(options.lifecycleReason)) {
      throw new CliUsageError("--reason is only valid with disable or revoke and must use an allowlisted value.");
    }
  }
}

function localClientLifecycleOptionsUsed(options) {
  return options.lifecycleClientId !== null
    || options.lifecycleDisplayName !== null
    || options.lifecycleCapabilities.length > 0
    || options.lifecycleIncludeDisabled
    || options.lifecycleLimit !== null
    || options.lifecycleOffset !== null
    || options.lifecycleApply
    || options.lifecycleMaxProcesses !== null
    || options.lifecycleIncludeUnknown
    || options.lifecycleIncludeSystemProcesses
    || options.lifecycleIncludeMissingAsDisabled
    || options.lifecycleAutoDiscoverAll
    || options.lifecycleRevision !== null
    || options.lifecycleAdapterId !== null
    || options.lifecycleAdapterType !== null
    || options.lifecycleAdapterVersion !== null
    || options.lifecycleManifestSha256 !== null
    || options.lifecycleProtocolVersion !== null
    || (options.command === "clients" && options.lifecycleReason !== null);
}

function validateLocalClientOnboardingOptions(options) {
  if (options.prompt !== null || options.positionals.length !== 1) {
    throw new CliUsageError(
      "clients-onboarding requires exactly one operation: profiles, inspect, verify, plan, approve, apply, rollback, or recover.",
    );
  }
  const operation = options.positionals[0];
  if (!LOCAL_CLIENT_ONBOARDING_SUBCOMMANDS.has(operation)) {
    throw new CliUsageError(`Unsupported clients-onboarding operation: ${operation}`);
  }
  const needsProfile = new Set(["inspect", "verify", "plan"]).has(operation);
  if (needsProfile) {
    if (!LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.has(options.onboardingProfileId)) {
      throw new CliUsageError(
        "--profile-id must be claude-compatible-mcp-json, cursor-mcp-json, or vscode-mcp-json.",
      );
    }
  } else if (options.onboardingProfileId !== null) {
    throw new CliUsageError("--profile-id is only valid with inspect, verify, or plan.");
  }

  if (operation === "plan") {
    if (!LOCAL_CLIENT_ONBOARDING_ACTIONS.has(options.onboardingAction)) {
      throw new CliUsageError(
        "plan requires --action enable, disable, rollback, or recover.",
      );
    }
    if (options.onboardingAction === "rollback") {
      if (options.onboardingReceiptFile === null) {
        throw new CliUsageError("A rollback plan requires --receipt-file <redacted-json>.");
      }
    } else if (options.onboardingReceiptFile !== null) {
      throw new CliUsageError("--receipt-file is only valid for a rollback plan.");
    }
  } else {
    if (options.onboardingAction !== null) {
      throw new CliUsageError("--action is only valid with plan.");
    }
    if (options.onboardingReceiptFile !== null) {
      throw new CliUsageError("--receipt-file is only valid for a rollback plan.");
    }
  }

  const mutation = LOCAL_CLIENT_ONBOARDING_MUTATIONS.has(operation);
  if (mutation) {
    if (!options.adminKey) {
      throw new CliUsageError(
        `${operation} requires an admin key.`,
        { hint: "Pass --admin-key or set AGENT_CONSOLE_ADMIN_KEY." },
      );
    }
    if (!options.confirmed) {
      throw new CliUsageError(`${operation} requires explicit --yes confirmation.`);
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(options.idempotencyKey ?? "")) {
      throw new CliUsageError(
        `${operation} requires a valid explicit --idempotency-key (1-255 visible ASCII characters).`,
      );
    }
    if (!LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN.test(options.onboardingPlanId ?? "")) {
      throw new CliUsageError(
        `${operation} requires a valid server-issued --plan-id.`,
      );
    }
  } else {
    if (options.confirmed || options.idempotencyKey !== null) {
      throw new CliUsageError("--yes and --idempotency-key are only valid with onboarding mutations.");
    }
    if (options.onboardingPlanId !== null) {
      throw new CliUsageError("--plan-id is only valid with onboarding mutations.");
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

function assertFlagHasNoInlineValue(flag, inlineValue) {
  if (inlineValue !== null) {
    throw new CliUsageError(`${flag} does not accept a value.`);
  }
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
