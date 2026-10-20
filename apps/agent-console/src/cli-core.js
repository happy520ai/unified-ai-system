import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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
import { readVerificationSource, readWindowsVerificationHistory } from "./verificationHistory.ts";
import { projectWorkforceCodeDeliveryReview, formatWorkforceCodeDeliveryReview } from "./workforceCodeDeliveryReview.ts";
import { projectWorkforceWorkflowHandoffReview, formatWorkforceWorkflowHandoffReview, assertWorkforceWorkflowOptionsHash } from "./workforceWorkflowHandoffReview.ts";
import { projectWorkforceConsensusApproval, formatWorkforceConsensusReview, assertConsensusOptionsHash } from "./workforceConsensusReview.ts";
import { projectWorkforceExternalRunnerApproval, formatWorkforceExternalRunnerReview } from "./workforceExternalRunnerReview.ts";
import { runOperatorCommand, validateOperatorOptions, projectForgeApprovalReview, projectTaijiApprovalReview } from "./operatorCommands.ts";
import { runContextCodecCommand, validateContextCodecOptions } from "./contextCodecCommands.ts";
import { runWorkforceCommands, validateWorkforceOptions } from "./workforceCommands.ts";
import { runAgentTaskCommand, validateAgentTaskOptions, projectGovernedAgentTaskApproval } from "./agentTaskCommands.ts";

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

import {
  COMMANDS,
  WORKFLOW_OPERATIONS,
  WORKFLOW_ID_PATTERN,
  WORKFLOW_STATUSES,
  WORKFLOW_ERROR_CODES,
  AGENT_GOVERNANCE_SUBCOMMANDS,
  AGENT_GOVERNANCE_MUTATIONS,
  AGENT_ID_PATTERN,
  AGENT_APPROVAL_ID_PATTERN,
  AGENT_TOOL_NAME_PATTERN,
  AGENT_REVIEW_SENSITIVE_KEY,
  ENHANCEMENT_PROFILES,
  ENHANCEMENT_LANGUAGES,
  LOCAL_CLIENT_LIFECYCLE_SUBCOMMANDS,
  LOCAL_CLIENT_LIFECYCLE_ALWAYS_MUTATING,
  LOCAL_CLIENT_DISABLE_REASONS,
  LOCAL_CLIENT_REVOKE_REASONS,
  SAFE_LOCAL_CLIENT_LIFECYCLE_ERROR_CODES,
  LOCAL_CLIENT_ID_PATTERN,
  LOCAL_CLIENT_CAPABILITY_PATTERN,
  LOCAL_CLIENT_DECLARATION_PATTERN,
  LOCAL_CLIENT_SEMVER_PATTERN,
  LOCAL_CLIENT_ONBOARDING_SUBCOMMANDS,
  LOCAL_CLIENT_ONBOARDING_MUTATIONS,
  LOCAL_CLIENT_ONBOARDING_ACTIONS,
  LOCAL_CLIENT_ONBOARDING_CERTIFICATION,
  LOCAL_CLIENT_ONBOARDING_PROFILE_DEFINITIONS,
  SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES,
  UNKNOWN_LOCAL_CLIENT_ONBOARDING_ERROR_CODES,
  LOCAL_CLIENT_ONBOARDING_PROFILE_IDS,
  LOCAL_CLIENT_ONBOARDING_RECEIPT_MAX_BYTES,
  LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN,
  LOCAL_CLIENT_ONBOARDING_REGISTRY_PLAN_ID_PATTERN,
  LOCAL_CLIENT_ONBOARDING_TRANSACTION_ID_PATTERN,
  SHA256_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  CONTROL_CENTER_VISIBLE_ID_PATTERN,
  CONTROL_CENTER_MODEL_PREVIEW_LIMIT,
  CONTROL_CENTER_MANIFEST_SCHEMA,
  CONTROL_CENTER_MANIFEST_SCHEMA_V2,
  CONTROL_CENTER_MANIFEST_MAX_BYTES,
  CONTROL_CENTER_IDEMPOTENCY_PREFIX_PATTERN,
  COMMAND_ALIASES,
  localClientOnboardingProfileFormat
} from "./cli-constants.js";
import { CliUsageError } from "./cli-errors.js";
import { parseCliArgs as parseCliArgsImpl } from "./cli-arg-parser.js";
import {
  addPositional,
  splitFlag,
  readFlagValue,
  assertFlagHasNoInlineValue,
  parseIntegerOption,
} from "./cli-parser-helpers.js";
import {
  validateWorkflowOrCredentialOptions,
  validateAgentGovernanceOptions,
  validateControlCenterOptions,
  validateLocalClientOnboardingOptions,
} from "./cli-validation.js";

export { CliUsageError };

import {
  CliLocalClientFailure,
  CliOnboardingFailure,
  createSafeLocalClientOnboardingFailure,
  hasExactKeys,
  isPlainRecord,
  loadLocalClientOnboarding,
  localClientLifecycleOptionsUsed,
  localClientLifecycleOptionsUsedExcludingApply,
  projectLocalClientOnboardingApproval,
  projectLocalClientOnboardingMutationOutcome,
  projectLocalClientOnboardingPlan,
  projectLocalClientOnboardingVerification,
  projectLocalClientRegistry,
  projectLocalClientStatus,
  readBoundedJsonFile,
  redactLocalClientOnboardingErrorCode,
  runClients,
  runClientsOnboarding,
  validIsoDate,
  validateLocalClientLifecycleOptions,
} from "./cli-local-client.js";
import {
  runControlCenter,
  CliControlCenterFailure,
} from "./cliControlCenter.js";
import {
  runAgents,
  CliAgentGovernanceFailure,
} from "./cliAgentGovernance.js";
import { unwrapEnvelope } from "./cli-shared-helpers.js";
import {
  createOutput,
  validateOptions,
  resolvePrompt,
  runChildProcess,
  reportFailure,
} from "./cliRuntime.js";


export function parseCliArgs(
  argv,
  env = process.env,
) {
  return parseCliArgsImpl(argv, env, validateOptions);
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
      case "workflow":
      case "providers":
        return await runWorkflowOrCredentialCommand(options, output);
      case "status":
        return await runStatus(options, output);
      case "doctor":
        return await runDoctor(options, runtime, output);
      case "verification":
        return runVerificationHistory(options, runtime, output);
      case "enhance":
        return await runEnhance(options, output, runtime.stdin ?? process.stdin);
      case "chat":
        return await runChat(options, output, runtime.stdin ?? process.stdin);
      case "codec":
        return await runContextCodecCommand(options, output);
      case "workforce":
        return await runWorkforceCommands(options, output);
      case "clients":
        return await runClients(options, output);
      case "clients-onboarding":
        return await runClientsOnboarding(options, output, runtime.cwd ?? process.cwd());
      case "control-center":
        return await runControlCenter(options, output, runtime.cwd ?? process.cwd());
      case "spend":
        return await runSpend(options, output);
      case "forge":
      case "knowledge":
      case "routing":
      case "taiji":
        return await runOperatorCommand(options, output);
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

function runVerificationHistory(options, runtime, output) {
  const root = runtime.verificationRepoRoot ?? repoRoot;
  const source = readVerificationSource(root);
  const result = readWindowsVerificationHistory(root, { source, now: Date.now(),
    platform: process.platform, arch: process.arch, nodeVersion: process.version });
  const sourceAfter = readVerificationSource(root);
  if (source.head !== sourceAfter.head || source.worktree !== sourceAfter.worktree) {
    result.ok = false; result.status = "source_changed_during_read";
  }
  if (options.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    output.write(`Local Windows verification: ${result.status}\nLocal checkout: ${source.head ?? "unknown"} (${source.worktree})\n`);
    output.write("Local unsigned summaries; running deployment and release approval are not verified.\n");
    for (const run of result.runs) {
      output.write(`${run.runId}  ${run.status}  ${run.assessment}\n`);
      for (const stage of run.stages ?? []) {
        const count = stage.counts;
        output.write(`  ${stage.id}: ${stage.status}${count ? ` (${count.passed} passed, ${count.failed} failed, ${count.skipped} skipped)` : ""}\n`);
      }
    }
    output.write(`${result.nextAction}\n`);
  }
  return result.ok ? 0 : 2;
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
      // The report is only produced under --evidence, so the command that
      // reproduces this artifact has to carry the flag.
      "--evidence",
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

async function runWorkflowOrCredentialCommand(options, output) {
  const operation = options.positionals[0];
  const credential = options.command === "providers";
  const mutation = credential || operation === "run" || operation === "recover";
  const target = credential ? { providerId: options.agentProviderId } : { workflowId: options.workflowId };
  const client = createGatewayClient({ baseUrl: options.url, timeoutMs: options.timeoutMs, headers: { authorization: `Bearer ${options.adminKey}` } });
  try {
    let data;
    if (credential) {
      data = projectCredentialClear(unwrapEnvelope(await client.clearRuntimeProviderCredential(target)), target.providerId);
    } else if (operation === "run") {
      data = projectWorkflowCompletion(unwrapEnvelope(await client.workflowRun({
        workflowId: options.workflowId, goal: options.agentGoal, agentId: options.agentId,
        ...(options.workflowArtifactName === null ? {} : { artifactName: options.workflowArtifactName }),
      })), options.workflowId);
    } else if (operation === "list") {
      const result = unwrapEnvelope(await client.workflowRuns({ limit: options.lifecycleLimit ?? 50 }));
      if (!isPlainRecord(result) || !Array.isArray(result.runs) || result.runs.length > (options.lifecycleLimit ?? 50)) throw new Error("invalid workflow list");
      data = { runs: result.runs.map(row => projectWorkflowInspection(row)) };
    } else {
      const result = operation === "status" ? await client.workflowRunStatus(options.workflowId) : await client.recoverWorkflowRun(options.workflowId);
      data = projectWorkflowInspection(unwrapEnvelope(result), options.workflowId);
    }
    const ok = credential || !mutation || data.status === "completed";
    const nextAction = credential
      ? "Scope: this runtime credential store. Environment/configuration credentials may still apply; upstream keys, in-flight requests and other processes are unchanged."
      : workflowNextAction(operation, data, options.workflowId);
    const result = { ok, command: options.command, operation, ...target, retryAllowed: false, data, nextAction };
    if (options.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      const rows = credential
        ? [`Provider ${data.providerId}: ${data.removed ? "runtime credential removed" : "no runtime override was present"}`]
        : operation === "list" ? [`Workflows: ${data.runs.length}`, ...data.runs.map(row => `${row.workflowId}: ${row.status} / ${row.stage}`)]
          : [`Workflow ${data.workflowId}: ${data.status}`, ...(data.stage ? [`Stage: ${data.stage}`] : []), ...(data.artifact ? [`Artifact: ${data.artifact.fileName} (sha256 ${data.artifact.sha256})`] : [])];
      output.write(`${rows.join("\n")}\n${nextAction}\n`);
    }
    return ok ? 0 : 1;
  } catch (error) {
    const payload = isPlainRecord(error?.responseBody?.error) ? error.responseBody.error : {};
    const details = isPlainRecord(payload.details) ? payload.details : {};
    const code = payload.code;
    const notStarted = credential && code === "provider_runtime_credential_clear_audit_unavailable" && details.operationStarted === false;
    const uncertain = mutation && !notStarted && (code === "WORKFLOW_OUTCOME_UNKNOWN" || code === "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN"
      || !Number.isInteger(error?.statusCode) || error.statusCode >= 500);
    let receipt;
    if (credential && code === "provider_runtime_credential_clear_result_audit_unconfirmed" && details.operationCommitted === true) {
      try { receipt = projectCredentialClear(details, target.providerId); } catch { /* An invalid receipt cannot prove completion. */ }
    }
    const failure = { ok: false, command: options.command, operation, ...target, retryAllowed: false,
      status: uncertain ? "unknown-reconcile-required" : "rejected",
      code: !credential && WORKFLOW_ERROR_CODES.has(code) ? code : credential ? notStarted ? "CREDENTIAL_CLEAR_NOT_STARTED" : uncertain ? "CREDENTIAL_CLEAR_OUTCOME_UNKNOWN" : "CREDENTIAL_CLEAR_REJECTED"
        : uncertain ? "WORKFLOW_OUTCOME_UNKNOWN" : "WORKFLOW_REQUEST_REJECTED",
      ...(receipt ? { receipt } : {}),
      ...(!credential && code === "TOOL_APPROVAL_REQUIRED" && /^appr_[A-Za-z0-9_-]{1,128}$/u.test(details.approvalId ?? "") ? { approvalId: details.approvalId } : {}),
      nextAction: !credential && operation === "run" && code === "APPROVAL_REVIEW_UNAVAILABLE"
        ? "The gateway has no safe approval review for this workflow policy. Keep the approval requirement; do not fabricate approval or retry automatically."
        : !credential && operation === "run" && code === "TOOL_APPROVAL_REQUIRED"
        ? "Use agents approvals --agent-id " + options.agentId + "; review the exact file_write request, then repeat the original workflow request and ID."
        : !credential && operation === "run" && (code === "AGENT_NOT_FOUND" || code === "AGENT_EXPIRED" || code === "AGENT_EXECUTION_FENCED")
          ? "Inspect agents show --agent-id " + options.agentId + " and obtain valid current authorization before repeating this workflow ID."
          : credential ? "Inspect /providers and the audit trail before another clear; do not clear a replacement credential automatically."
        : options.workflowId ? `Inspect workflow status --workflow-id ${options.workflowId}; preserve this ID and the original input.` : "Check gateway authentication and workflow history availability.",
    };
    output.writeError(options.json ? `${JSON.stringify(failure, null, 2)}\n`
      : `${failure.code}: ${failure.status}\n${credential ? `Provider: ${target.providerId}` : `Workflow: ${target.workflowId ?? "history"}`}\n${failure.nextAction}\n`);
    return 1;
  }
}

function projectWorkflowCompletion(value, expectedId) {
  if (!isPlainRecord(value) || value.workflowId !== expectedId || value.status !== "completed") throw new Error("invalid workflow result");
  const artifact = value.artifact;
  if (!isPlainRecord(artifact) || !/^[A-Za-z0-9._-]{1,100}\.md$/iu.test(artifact.fileName ?? "")
    || !/^[a-f0-9]{64}$/u.test(artifact.sha256 ?? "") || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0) throw new Error("invalid workflow artifact");
  return { workflowId: expectedId, status: "completed", artifact: { fileName: artifact.fileName, bytes: artifact.bytes, sha256: artifact.sha256 } };
}

function projectWorkflowInspection(value, expectedId = null) {
  if (!isPlainRecord(value) || !WORKFLOW_ID_PATTERN.test(value.workflowId ?? "") || expectedId !== null && value.workflowId !== expectedId
    || !WORKFLOW_STATUSES.has(value.status) || !new Set(["knowledge.retrieve", "report.compose", "artifact.write"]).has(value.stage)
    || !Number.isSafeInteger(value.attempt) || value.attempt < 1 || typeof value.canResume !== "boolean" || typeof value.outcomeUnknown !== "boolean"
    || !new Set([null, "run-safe-remaining-stages", "recheck-governance-only"]).has(value.resumeAction)
    || value.canResume !== (value.resumeAction !== null) || value.persistence?.automaticRedispatch !== false
    || value.persistence?.storageMode !== "single-host-sqlite"
    || value.status === "completed" && (value.canResume || value.outcomeUnknown)
    || value.status === "completed" && expectedId !== null && !value.result
    || value.outcomeUnknown && !new Set(["publishing", "unknown"]).has(value.status)
    || value.resumeAction === "recheck-governance-only" && !value.outcomeUnknown) throw new Error("invalid workflow inspection");
  return {
    workflowId: value.workflowId, status: value.status, stage: value.stage, attempt: value.attempt,
    canResume: value.canResume, resumeAction: value.resumeAction, outcomeUnknown: value.outcomeUnknown,
    errorCode: WORKFLOW_ERROR_CODES.has(value.error?.code) ? value.error.code : value.error ? "WORKFLOW_EXECUTION_FAILED" : null,
    ...(value.result && value.status === "completed" ? { artifact: projectWorkflowCompletion(value.result, value.workflowId).artifact } : {}),
  };
}

function projectCredentialClear(value, providerId) {
  if (!isPlainRecord(value) || value.providerId !== providerId || typeof value.removed !== "boolean"
    || value.scope !== "runtime-credential-store" || value.appliesTo !== "subsequent-credential-lookups"
    || ["inFlightRequestsCancelled", "providerKeyRevoked", "otherCredentialSourcesModified", "otherProcessesInvalidated"].some(key => value[key] !== false)) throw new Error("invalid clear receipt");
  return { providerId, removed: value.removed, scope: value.scope, appliesTo: value.appliesTo,
    inFlightRequestsCancelled: false, providerKeyRevoked: false, otherCredentialSourcesModified: false, otherProcessesInvalidated: false };
}

function workflowNextAction(operation, data, workflowId) {
  if (operation === "list") return "Use workflow status with the recorded ID. No workflow was resumed.";
  if (data.status === "completed") return "Recorded completion; repeat this ID only with the original input. Later user edits are preserved.";
  if (data.resumeAction === "recheck-governance-only") return "Artifact reconciled. Explicitly rerun the original request with current Agent authorization to finish result governance only.";
  if (data.resumeAction === "run-safe-remaining-stages") return "Review the failure, then explicitly rerun the original request and ID to continue safe stages.";
  return data.outcomeUnknown ? `Run workflow recover --workflow-id ${workflowId}; no automatic retry or new ID.`
    : `Use workflow status --workflow-id ${workflowId}; the current execution claim may still be active.`;
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
  workflow <operation> Persisted workflow run, list, status, or recover
  providers clear-credential  Clear one Provider runtime override by explicit ID
  agents <operation> Governed Agent status, lifecycle, execution, and approvals
  agents task <op>    Prepare, plan, confirm, run, schedule, status, pause or cancel one original long task
                     status, list, show, generate, run, revoke, approvals, approve, reject
  clients [operation]
                   discover, list, inspect, register, verify, disable, revoke, smart-manage
  clients-onboarding <operation>
                   Governed profiles, inspection, planning, and explicit mutations
  control-center [configure]
                   Inspect readiness or apply one reviewed multi-client manifest
  demo [prompt]    Run an isolated credential-free demonstration
  serve            Start the local gateway
  status           Inspect gateway and chat readiness
  enhance [prompt] Preview a structured prompt without calling a model
  codec <operation>  preview, compare --input case.json (explicit data/model comparison)
  knowledge          health, sources, load, retrieve
  routing            modes, preview (local simulation; no model call)
  forge              status, runs, polish, quality, memory, recall, orchestrate, taiji, workforce
  taiji              status, run <id>, evaluate, activate, execute, revoke, repair, reweight, prune
  workforce          status <execution-id>, handoff-recover or native-recover --input recovery.json --yes
  chat [prompt]    Send one chat request to a running gateway
  spend            Show per-key token spend and budget status
  doctor           Check the local toolchain and gateway connection
  verification     Read local Windows verification summaries and retained failures
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
  --admin-key <uai-…>         Scoped gateway key for authenticated operator commands
  --manifest <json>           Bounded control-center desired-state manifest
  --input <json>              Bounded JSON payload for knowledge/routing/Forge/Taiji/Workforce
  --mode <mode>               keyword/vector retrieval or answer-path/quality-cost preview
  --source-id <id>            Knowledge retrieval source filter (repeatable)
  --passes <1..10>            Forge polish pass limit
  --max-output-tokens <n>     Forge per-model-call output cap, default 4096 (1–16384)
  --audio-output <file.wav>   Save an approved Forge speech task to a new local file
  --client-id <id>            Bounded lifecycle client identifier
  --display-name <name>       Safe display name for register
  --capability <id>           Repeatable list filter or register capability
  --include-disabled          Include disabled clients in list
  --limit <n>                 Client/workflow list size, 1-100
  --offset <n>                Registry page offset
  --apply                     Apply discover/smart-manage or a control-center manifest
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
  --goal <text>               Goal for agents run or workflow run
  --workflow-id <id>          Stable workflow ID; required for run/status/recover
  --artifact-name <name>      Optional Markdown filename for workflow run
  --tool <name>               Repeatable requested/run tool identifier
  --ttl-seconds <n>           Agent lifetime, 1-2592000 seconds
  --parent-agent-id <agt_...> Optional parent for agents generate
  --max-iterations <n>        Agent run iteration bound, 1-25
  --run-timeout-ms <n>        Agent wall-clock bound, 1000-120000ms (transport adds 5s)
  --tool-mode <mode>          none or readonly
  --provider-id <id>          Agent provider or providers clear-credential target
  --model-id <id>             Explicit Agent run model
  --cascade                   Revoke the Agent and descendants
  --profile-id <id>           Onboarding profile for inspect, verify, or plan
  --action <action>           enable, disable, rollback, or recover (plan only)
  --plan-id <id>              Server-issued onboarding plan for mutations
  --receipt-file <json>       Redacted apply receipt for a rollback plan
  --idempotency-key <key>     Explicit mutation key/prefix; never retried automatically
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
  pnpm gateway workflow run --workflow-id report-001 --agent-id agt_<id> --goal "Prepare a local report"
  pnpm gateway workflow list --limit 50
  pnpm gateway workflow status --workflow-id report-001
  pnpm gateway workflow recover --workflow-id report-001
  pnpm gateway providers clear-credential --provider-id bai
  pnpm gateway agents list
  pnpm gateway agents generate --name report-reader --task "Read the report" --tool file_read --yes
  pnpm gateway agents run --agent-id agt_<id> --goal "Read README" --tool file_read --yes
  pnpm gateway agents approvals --agent-id agt_<id>
  pnpm gateway agents approve --approval-id appr_<id> --yes
  pnpm gateway agents task prepare --agent-id agt_<id> --input prepare.json --yes
  pnpm gateway agents task plan <original-task-uuid> --agent-id agt_<id> --input revision.json --yes
  pnpm gateway agents task confirm <original-task-uuid> --agent-id agt_<id> --input confirmation.json --yes
  pnpm gateway agents task run <original-task-uuid> --agent-id agt_<id> --input chunk.json --yes
  pnpm gateway agents task status <original-task-uuid> --agent-id agt_<id>
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
  pnpm gateway control-center
  pnpm gateway control-center configure --manifest docs/examples/local-ai-control-center.json --json
  pnpm gateway control-center configure --manifest docs/examples/local-ai-control-center.json --apply --yes --idempotency-key <prefix> --json
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
  Agent task commands preserve the original UUID and exact revision; run performs one explicit bounded chunk, never an automatic loop.
  Plan/run use the fixed server profile; non-fake provider requests require --allow-real-provider. Profile, model, path and command overrides are forbidden.
  Agent task confirmation consumes an already-approved complete plan; decide it first with the existing agents approve command.
  Workflow run requires a stable ID and a server-issued Agent with the existing file_write authorization.
  Workflow recovery reconciles the recorded artifact; it never automatically resumes a run.
  Provider clearing removes only the runtime override; environment keys, upstream keys, in-flight requests and other processes remain separate.
  These explicit workflow/provider commands use the supplied ID as intent and add no --yes requirement.
  knowledge load and forge polish/memory/orchestrate preview locally until --yes is supplied.
  workforce handoff-recover previews the three original IDs until --yes; recovery may write the approved report but never reruns employees or resumes the parent.
  workforce native-recover requires only original executionId, operationId and agentId; it never starts another native turn or automatically resumes the parent.
  codec preview --input case.json performs local encoding only. codec compare --input case.json --yes makes at most two exact-model requests.
  Codec compares a supplied expected JSON answer and reported usage; fake observations remain synthetic, and unknown outcomes are never retried automatically.
  Forge model calls select local-fake-provider/local-fake-model by default; non-fake selection requires --allow-real-provider.
  Forge orchestration may return approval-required (exit 3); use agents approvals/approve and repeat the exact request.
  routing preview, Forge quality, taiji and workforce preview do not run a model or activate a capability.
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
  control-center status is read-only and does not reroute a client's native login or model channel.
  control-center configure plans by default; --apply requires --yes and an explicit idempotency prefix.
  multi-client apply is ordered and fail-stop, not cross-file atomic; preserve JSON receipts.
`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
