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
import { unwrapEnvelope } from "./cli-shared-helpers.js";

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

async function runAgents(options, output) {
  if (options.positionals[0] === "task") return runAgentTaskCommand(options, output);
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
  if (value.effectType === "agent:long-task" && value.reviewable === true) {
    return `Complete Agent task approval:\n${JSON.stringify(value, null, 2)}`;
  }
  if (value.effectType === "taiji:capability" && value.reviewable === true) {
    return `Taiji: ${value.taiji.effect}\nPolicy: ${value.policyHash}\nRequest hash: ${value.taiji.paramsHash}\n${JSON.stringify(value.taiji.params, null, 2)}`;
  }
  if (value.effectType === "forge:orchestrate" && value.reviewable === true) {
    return `Forge goal: ${safeTerminalBlock(value.forge.goal, 65536)}\nGoal digest: ${value.forge.goalDigest}\nPolicy: ${safeTerminalText(value.policyHash, 160)}\nOptions hash: ${value.forge.optionsHash}\n${JSON.stringify(value.forge.options, null, 2)}`;
  }
  if (value.effectType === "workforce:execute" && value.reviewable === true
    && value.workforce?.options?.externalRunner) {
    const workforce = value.workforce;
    return [`Workforce goal: ${workforce.goal}`, `Plan: ${workforce.planId}; digest: ${workforce.planDigest}; policy: ${value.policyHash}`,
      `Options hash: ${workforce.optionsHash}`, ...formatWorkforceExternalRunnerReview(workforce.options.externalRunner)].join("\n");
  }
  if (value.effectType === "workforce:execute" && value.reviewable === true
    && value.workforce?.options?.workflowHandoff && !value.workforce.options.roleExecution) {
    const workforce = value.workforce;
    return [`Workforce goal: ${safeTerminalBlock(workforce.goal, 4_000)}`,
      `Plan: ${safeTerminalText(workforce.planId, 160)}; digest: ${safeTerminalText(workforce.planDigest, 160)}; policy: ${safeTerminalText(value.policyHash, 160)}`,
      `Options hash: ${workforce.optionsHash}`,
      ...formatWorkforceWorkflowHandoffReview(workforce.options.workflowHandoff)].join("\n");
  }
  if (value.effectType === "workforce:execute" && value.reviewable === true && value.workforce?.options?.roleExecution) {
    const workforce = value.workforce;
    const profile = workforce.options.roleExecution;
    const selection = workforce.options.selectionReview;
    const codeDelivery = workforce.options.codeDelivery;
    const workflowHandoff = workforce.options.workflowHandoff;
    const consensusReview = workforce.options.consensusReview;
    const text = (item) => safeTerminalText(item, 256);
    return [
      `Workforce goal: ${safeTerminalBlock(workforce.goal, 4_000)}`,
      `Plan: ${text(workforce.planId)}; digest: ${text(workforce.planDigest)}; policy: ${text(value.policyHash)}`,
      `Employee model execution: required; profile: ${text(profile.profileId)}; hash: ${text(profile.profileHash)}`,
      `Request dispatch hard limit: ${profile.maxTotalRequests}; Concurrent roles: ${profile.maxConcurrentRoles}`,
      ...(codeDelivery === undefined ? [] : formatWorkforceCodeDeliveryReview(codeDelivery)),
      ...(workflowHandoff === undefined ? [] : [`Options hash: ${workforce.optionsHash}`, ...formatWorkforceWorkflowHandoffReview(workflowHandoff)]),
      ...(consensusReview === undefined ? [] : [`Options hash: ${workforce.optionsHash}`, ...formatWorkforceConsensusReview(consensusReview)]),
      ...(selection === undefined ? [] : [
        `Deterministic selection rules: v${selection.version}; catalog/configuration hash: ${text(selection.catalogHash)}`,
        `Selection hash: ${text(selection.selectionHash)}; task type: ${text(selection.taskType)}; execution mode: ${text(selection.executionMode)}`,
        `Selected role scope: ${selection.roleIds.map(text).join(", ")}`,
      ]),
      "Input tokens use an estimate before dispatch and upstream usage validation after completion.",
      "Output tokens use an upstream parameter limit and upstream usage validation after completion.",
      "Token limits do not guarantee a prepaid cap. Unknown usage and USD cost remain null; consumed tokens cannot be undone.",
      ...profile.bindings.map((binding) => `  ${text(binding.roleId)} / ${text(binding.employeeId)} -> ${text(binding.providerId)} / ${text(binding.modelId)}; `
        + `requests<=${binding.maxRequests}; input estimate=${binding.maxInputTokens}; output parameter=${binding.maxOutputTokens}; timeout=${binding.timeoutMs}ms`),
      ...(selection === undefined ? [] : [
        ...selection.assignments.map(({ binding, qualification }) =>
          `  Qualification ${text(binding.roleId)} / ${text(binding.employeeId)}: ${text(qualification.qualificationId)}; `
          + `status=${text(qualification.status)}; origin=${text(qualification.origin)}; execution mode=${text(qualification.executionMode)}\n`
          + `    Qualified roles: ${qualification.roleIds.map(text).join(", ")}; task types: ${qualification.taskTypes.map(text).join(", ")}\n`
          + `    Evidence: ${text(qualification.evidenceHash)}; valid until: ${text(qualification.validUntil)}`),
        `Rejected candidates: ${selection.rejected.length}`,
        ...selection.rejected.map(({ employeeId, reason }) => `  ${text(employeeId)}: ${text(reason)}`),
      ]),
    ].join("\n");
  }
  if (value.effectType === "workflow:artifact-write" && value.reviewable === true && isPlainRecord(value.workflow)) {
    const { content, ...binding } = value.workflow;
    return `${safeTerminalText(JSON.stringify({ ...binding, policyHash: value.policyHash }), 4_000)}\nComplete Markdown content:\n${safeTerminalBlock(content, 16_000)}\nEnd of complete Markdown content.`;
  }
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
  if (value.review !== undefined) {
    if (value.review?.effectType === "workflow:artifact-write" && value.review.reviewable === true) {
      const content = value.review.workflow?.content;
      if (typeof content !== "string" || content.length > 16_000 || Buffer.byteLength(content, "utf8") > 65_536
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content)
        || value.review.workflow.contentBytes !== Buffer.byteLength(content, "utf8")
        || value.review.workflow.contentHash !== `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`) {
        throw new Error("invalid or incomplete workflow approval review");
      }
    }
    const profile = value.review?.workforce?.options?.roleExecution;
    const selectionSource = value.review?.workforce?.options?.selectionReview;
    const codeSource = value.review?.workforce?.options?.codeDelivery;
    const handoffSource = value.review?.workforce?.options?.workflowHandoff;
    const consensusSource = value.review?.workforce?.options?.consensusReview;
    const externalSource = value.review?.workforce?.options?.externalRunner;
    let externalRunner;
    if (externalSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true
        || typeof value.review.policyHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value.review.policyHash)) throw new Error("Invalid Workforce external runner approval review.");
      externalRunner = projectWorkforceExternalRunnerApproval(value.review.workforce);
    }
    let consensusReview;
    if (consensusSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true) throw new Error("Invalid Workforce consensus approval review.");
      consensusReview = projectWorkforceConsensusApproval(value.review.workforce);
    }
    let workflowHandoff;
    if (handoffSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true) {
        throw new Error("invalid or incomplete Workforce workflow handoff review");
      }
      workflowHandoff = projectWorkforceWorkflowHandoffReview(handoffSource);
      if (workflowHandoff.goal !== value.review.workforce.goal) throw new Error("invalid Workforce workflow handoff goal");
      assertWorkforceWorkflowOptionsHash(value.review.workforce.options, value.review.workforce.optionsHash);
    }
    let codeDelivery;
    if (codeSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true || profile === undefined) {
        throw new Error("invalid or incomplete Workforce code delivery review");
      }
      codeDelivery = projectWorkforceCodeDeliveryReview(codeSource, profile);
    }
    let selection;
    if (selectionSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true || profile === undefined) {
        throw new Error("invalid or incomplete Workforce selection review");
      }
      selection = projectWorkforceSelectionReview(selectionSource, profile);
    }
    output.review = sanitizeAgentReview(value.review);
    if (value.review?.effectType === "agent:long-task") {
      output.review = projectGovernedAgentTaskApproval(value.review);
    }
    if (value.review?.effectType === "forge:orchestrate" && value.review.reviewable === true) {
      output.review = projectForgeApprovalReview(value.review);
    }
    if (value.review?.effectType === "taiji:capability" && value.review.reviewable === true) {
      output.review = projectTaijiApprovalReview(value.review);
    }
    if (value.review?.effectType === "workforce:execute" && value.review.reviewable === true && profile !== undefined) {
      const bounded = (number, maximum) => Number.isSafeInteger(number) && number >= 1 && number <= maximum;
      if (!isPlainRecord(profile) || profile.version !== 1 || profile.mode !== "gateway-llm-required"
        || !Array.isArray(profile.bindings) || profile.bindings.length < 1 || profile.bindings.length > 128
        || !bounded(profile.maxConcurrentRoles, Math.min(8, profile.bindings.length))
        || !bounded(profile.maxTotalRequests, profile.bindings.length * 5)
        || profile.bindings.some((binding) => !isPlainRecord(binding)
          || !bounded(binding.maxRequests, 5) || !bounded(binding.maxInputTokens, 1_000_000)
          || !bounded(binding.maxOutputTokens, 1_000_000) || !bounded(binding.timeoutMs, 3_600_000))) {
        throw new Error("invalid or incomplete Workforce approval budget");
      }
      // Preserve only these validated numeric limits; the generic secret-key
      // redactor must still hide credential or token strings in every review.
      output.review.workforce.options.roleExecution.bindings = profile.bindings.map((binding) => ({
        ...sanitizeAgentReview(binding), maxInputTokens: binding.maxInputTokens, maxOutputTokens: binding.maxOutputTokens,
      }));
    }
    // Restore only the exact validated decision, including numeric token limits.
    if (selection !== undefined) output.review.workforce.options.selectionReview = selection;
    if (codeDelivery !== undefined) output.review.workforce.options.codeDelivery = codeDelivery;
    if (workflowHandoff !== undefined) {
      output.review.workforce.options.workflowHandoff = workflowHandoff;
      assertWorkforceWorkflowOptionsHash(output.review.workforce.options, output.review.workforce.optionsHash);
    }
    if (consensusReview !== undefined) {
      output.review.workforce.options.consensusReview = consensusReview;
      assertConsensusOptionsHash(output.review.workforce.options, output.review.workforce.optionsHash);
    }
    // This path has independently validated every native field; retain the entire prompt beyond generic display limits.
    if (externalRunner !== undefined) output.review.workforce = externalRunner;
  }
  return Object.freeze(output);
}

function projectWorkforceSelectionReview(value, profile) {
  const invalid = () => { throw new Error("invalid or incomplete Workforce selection review"); };
  const record = (value, keys) => {
    if (!hasExactKeys(value, keys) || Reflect.ownKeys(value).length !== keys.length
      || Object.values(Object.getOwnPropertyDescriptors(value)).some((property) => !("value" in property))) invalid();
    return value;
  };
  const array = (value, maximum) => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
      || Reflect.ownKeys(value).length !== value.length + 1) invalid();
    for (let index = 0; index < value.length; index++) if (!("value" in (Object.getOwnPropertyDescriptor(value, String(index)) ?? {}))) invalid();
    return value;
  };
  const identifier = (value) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value)
      // Credential-like text is not printable selection evidence, even with a matching hash.
      || /\b(?:xox[abprs]-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{20,}|(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}|npm_[A-Za-z0-9]{20,}|tp-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|hf_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16})\b/iu.test(value)
      || /\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*:[A-Za-z0-9._:/-]{4,}/iu.test(value)) invalid();
    return value;
  };
  const tags = (value, maximum) => {
    const items = array(value, maximum).map(identifier);
    if (!items.length || new Set(items).size !== items.length || JSON.stringify([...items].sort()) !== JSON.stringify(items)) invalid();
    return items;
  };
  const sha = (value) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
  const digest = (value) => `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
  const bindingKeys = ["roleId", "employeeId", "providerId", "modelId", "maxRequests", "maxInputTokens", "maxOutputTokens", "timeoutMs"];
  const profileKeys = ["version", "mode", "profileId", "maxTotalRequests", "maxConcurrentRoles", "bindings"];
  record(profile, [...profileKeys, "profileHash"]);
  const source = record(value, ["version", "catalogHash", "selectionHash", "taskType", "roleIds", "executionMode",
    "assignments", "rejected", "maxConcurrentRoles", "maxTotalRequests"]);
  if (source.version !== 1 || !sha(source.catalogHash) || !sha(source.selectionHash)
    || !["fake", "real"].includes(source.executionMode)) invalid();
  const taskType = identifier(source.taskType);
  const roleIds = tags(source.roleIds, 3);
  const bindings = array(profile.bindings, 3).map((value) => {
    const binding = record(value, bindingKeys);
    bindingKeys.slice(0, 4).forEach((key) => identifier(binding[key]));
    if ([binding.roleId, binding.employeeId].some((value) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value))
      || binding.timeoutMs < 1000) invalid();
    return Object.fromEntries(bindingKeys.map((key) => [key, binding[key]]));
  });
  if (JSON.stringify(roleIds) !== JSON.stringify(bindings.map(({ roleId }) => roleId))
    || source.maxConcurrentRoles !== profile.maxConcurrentRoles || source.maxTotalRequests !== profile.maxTotalRequests
    || profile.maxTotalRequests < bindings.length || profile.maxTotalRequests > bindings.reduce((sum, binding) => sum + binding.maxRequests, 0)) invalid();
  const assignments = array(source.assignments, 3).map((value, index) => {
    const item = record(value, ["binding", "qualification"]);
    const supplied = record(item.binding, bindingKeys); const binding = bindings[index];
    if (!binding || bindingKeys.some((key) => supplied[key] !== binding[key])) invalid();
    const q = record(item.qualification, ["qualificationId", "employeeId", "providerId", "modelId", "roleIds", "taskTypes",
      "status", "origin", "executionMode", "evidenceHash", "validUntil"]);
    const qualifiedRoles = tags(q.roleIds, 7); const taskTypes = tags(q.taskTypes, 16);
    if (q.employeeId !== binding.employeeId || q.providerId !== binding.providerId || q.modelId !== binding.modelId
      || !qualifiedRoles.includes(binding.roleId) || !taskTypes.includes(taskType) || q.status !== "accepted"
      || q.executionMode !== source.executionMode || !["synthetic", "reviewed"].includes(q.origin)
      || q.origin === "synthetic" && q.executionMode !== "fake" || !sha(q.evidenceHash)
      || !validIsoDate(q.validUntil) || new Date(q.validUntil).toISOString() !== q.validUntil) invalid();
    return { binding, qualification: { qualificationId: identifier(q.qualificationId), employeeId: binding.employeeId,
      providerId: binding.providerId, modelId: binding.modelId, roleIds: qualifiedRoles, taskTypes, status: "accepted",
      origin: q.origin, executionMode: q.executionMode, evidenceHash: q.evidenceHash, validUntil: q.validUntil } };
  });
  if (assignments.length !== bindings.length || new Set(bindings.map(({ employeeId }) => employeeId)).size !== bindings.length) invalid();
  const rejected = array(source.rejected, 5).map((value) => {
    const item = record(value, ["employeeId", "reason"]);
    if (!["not_enabled", "not_qualified", "not_selected"].includes(item.reason)) invalid();
    return { employeeId: identifier(item.employeeId), reason: item.reason };
  });
  if (assignments.length + rejected.length > 5 || new Set(rejected.map(({ employeeId }) => employeeId)).size !== rejected.length
    || rejected.some((item) => bindings.some((binding) => binding.employeeId === item.employeeId))) invalid();
  // S1 hashes this explicit order; the profile uses alphabetical canonical keys.
  const decision = { version: 1, catalogHash: source.catalogHash, taskType, roleIds, executionMode: source.executionMode,
    assignments, rejected, maxConcurrentRoles: profile.maxConcurrentRoles, maxTotalRequests: profile.maxTotalRequests };
  const profileInput = { ...Object.fromEntries(profileKeys.map((key) => [key, profile[key]])), bindings };
  if (source.selectionHash !== digest(JSON.stringify(decision)) || profile.profileId !== `selection-${source.selectionHash.slice(7)}`
    || profile.profileHash !== digest(JSON.stringify(profileInput, [...new Set([...profileKeys, ...bindingKeys])].sort()))) invalid();
  return Object.freeze({ ...decision, selectionHash: source.selectionHash });
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

function trimUrl(url) {
  return String(url ?? "").replace(/[/]+$/, "");
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

async function runControlCenter(options, output, configRoot) {
  if (!options.adminKey) {
    throw new CliUsageError(
      "The local AI control center requires an admin key.",
      { hint: "Set AGENT_CONSOLE_ADMIN_KEY or pass --admin-key." },
    );
  }

  if ((options.positionals[0] ?? "status") === "configure") {
    return runControlCenterConfigure(options, output, configRoot);
  }
  const result = await loadControlCenterSnapshot(options);
  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderControlCenter(result, output);
  }
  return result.ok ? 0 : 1;
}

async function loadControlCenterSnapshot(options) {
  const headers = { authorization: `Bearer ${options.adminKey}` };
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers,
  });

  let health;
  let readiness;
  let status;
  let registry;
  let onboarding;
  let modelCatalog;
  let budget;
  let stage = "snapshot";
  const startedAt = Date.now();
  try {
    const [
      healthEnvelope,
      readinessEnvelope,
      statusEnvelope,
      registryEnvelope,
      loadedOnboarding,
      modelsPayload,
      spendPayload,
    ] = await Promise.all([
      readControlCenterSurface("health", () => client.health()),
      readControlCenterSurface("setup-readiness", () => client.setupReadiness()),
      readControlCenterSurface("clients-status", () => client.localClientsStatus()),
      readControlCenterSurface("clients-registry", () => client.localClients({ includeDisabled: true, limit: 100 })),
      readControlCenterSurface("onboarding-profiles", () => loadLocalClientOnboarding(client)),
      readControlCenterSurface("models", () => fetchControlCenterJson(options, "/v1/models")),
      readControlCenterSurface("budget", () => fetchControlCenterJson(options, "/enterprise/spend-report")),
    ]);
    stage = "health";
    health = unwrapEnvelope(healthEnvelope);
    stage = "setup-readiness";
    readiness = unwrapEnvelope(readinessEnvelope);
    stage = "clients-status";
    status = projectLocalClientStatus(unwrapEnvelope(statusEnvelope));
    stage = "clients-registry";
    registry = projectLocalClientRegistry(unwrapEnvelope(registryEnvelope));
    stage = "onboarding-verification";
    onboarding = await inspectControlCenterOnboarding(client, loadedOnboarding);
    stage = "models";
    modelCatalog = projectControlCenterModels(modelsPayload);
    stage = "budget";
    budget = projectControlCenterBudget(spendPayload);
  } catch (error) {
    if (error instanceof CliControlCenterFailure) throw error;
    throw new CliControlCenterFailure(stage, error, Date.now() - startedAt);
  }

  const providers = projectControlCenterProviders(health.providers);
  const gateway = Object.freeze({
    url: options.url,
    status: boundedControlCenterText(health.status, "unknown", 64),
    providerMode: boundedControlCenterText(health.providerMode, "unknown", 64),
    realProviderEnabled: health.realProviderEnabled === true,
    chatReady: readiness.readiness?.chat?.ready === true,
    providers,
  });
  const managedClients = Object.freeze({
    status: status.status,
    executionMode: status.executionEnabled === true ? "governed-execution" : "preview-only",
    registered: registry.total,
    routable: registry.clients.filter((entry) => entry.routable === true).length,
    verified: registry.clients.filter((entry) => entry.trustDecision === "verified").length,
    onboarding,
  });
  const toolsShared = onboarding.available
    && onboarding.serverName === "unified-ai-system"
    && onboarding.transport === "stdio"
    && onboarding.installedProfileCount >= 2;
  const tools = Object.freeze({
    serverName: onboarding.serverName,
    transport: onboarding.transport,
    supportedProfileCount: onboarding.profiles.length,
    installedProfileCount: onboarding.installedProfileCount,
    sharedByMultipleClients: toolsShared,
    certificationStatus: onboarding.certificationStatus,
  });
  const checks = Object.freeze([
    controlCenterCheck(
      "gateway",
      gateway.status === "ready" && gateway.chatReady,
      "Gateway health and chat readiness",
    ),
    controlCenterCheck(
      "models",
      modelCatalog.count > 0,
      "At least one model is exposed through the shared gateway URL",
    ),
    controlCenterCheck(
      "budget",
      budget.activeKeys > 0,
      "At least one active tenant virtual key is governed by the shared budget ledger",
    ),
    controlCenterCheck(
      "clients",
      onboarding.installedProfileCount >= 2,
      "At least two client profiles point to the same gateway-managed MCP server",
    ),
    controlCenterCheck(
      "tools",
      toolsShared,
      "Installed client profiles share the unified-ai-system stdio MCP server",
    ),
  ]);
  const nextActions = buildControlCenterNextActions({
    checks,
    onboarding,
  });
  const result = Object.freeze({
    ok: checks.every((check) => check.ready),
    command: "control-center",
    mode: "read-only",
    writesPerformed: false,
    gateway,
    shared: Object.freeze({
      models: modelCatalog,
      budget,
      tools,
    }),
    clients: managedClients,
    checks,
    nextActions,
    assurance: Object.freeze({
      level: "control-plane-observed",
      nativeModelLoginRerouted: false,
      realClientCertified: false,
      limitations: Object.freeze([
        "MCP onboarding does not reroute a client's native login or native model channel.",
        "This read-only snapshot does not certify a real client or a real Provider call.",
      ]),
    }),
  });

  return result;
}

async function runControlCenterConfigure(options, output, configRoot) {
  const manifest = readControlCenterManifest({
    path: options.controlCenterManifestFile,
    root: configRoot,
    expectedGatewayUrl: options.url,
  });
  const snapshot = await loadControlCenterSnapshot(options);
  const requiredCheckIds = new Set(["gateway", "models", "budget"]);
  const coreChecks = snapshot.checks.filter((check) => requiredCheckIds.has(check.id));
  const profilesById = new Map(
    snapshot.clients.onboarding.profiles.map((profile) => [profile.profileId, profile]),
  );
  const selectedProfiles = manifest.profiles.map((profileId) => {
    const profile = profilesById.get(profileId);
    return profile
      ? Object.freeze({
          ...profile,
          serverName: snapshot.shared.tools.serverName,
          transport: snapshot.shared.tools.transport,
        })
      : null;
  });
  const preflightReady = coreChecks.every((check) => check.ready)
    && snapshot.clients.onboarding.available
    && snapshot.shared.tools.serverName === "unified-ai-system"
    && selectedProfiles.every(Boolean);
  if (!preflightReady) {
    const result = Object.freeze({
      ok: false,
      command: "control-center",
      operation: "configure",
      mode: "preflight",
      clientConfigWritesPerformed: false,
      manifest,
      plans: Object.freeze([]),
      completed: Object.freeze([]),
      retryAllowed: false,
      atomicAcrossClients: false,
      status: "preflight-failed",
      nextActions: snapshot.nextActions,
    });
    writeControlCenterConfigureResult(result, options, output);
    return 1;
  }

  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });
  const plans = [];
  const planningStartedAt = Date.now();
  try {
    for (const profileId of manifest.profiles) {
      const request = { profileId, action: "enable" };
      plans.push(projectLocalClientOnboardingPlan(
        unwrapEnvelope(await client.planGovernedLocalClientOnboarding(request)),
        request,
      ));
    }
  } catch (error) {
    throw new CliControlCenterFailure("onboarding-plan", error, Date.now() - planningStartedAt);
  }

  if (!options.lifecycleApply) {
    const result = Object.freeze({
      ok: true,
      command: "control-center",
      operation: "configure",
      mode: "plan",
      clientConfigWritesPerformed: false,
      manifest,
      plans: Object.freeze(plans),
      completed: Object.freeze([]),
      retryAllowed: false,
      atomicAcrossClients: false,
      status: "planned",
      nextAction:
        "Review this exact output, then run configure --apply --yes with an explicit idempotency-key prefix.",
    });
    writeControlCenterConfigureResult(result, options, output);
    return 0;
  }

  const completed = [];
  let failure = null;
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    let mutationOperation = "approve";
    try {
      const approval = projectLocalClientOnboardingApproval(
        unwrapEnvelope(await client.approveGovernedLocalClientOnboarding(
          { planId: plan.planId },
          { idempotencyKey: `${options.idempotencyKey}:approve:${index + 1}` },
        )),
        plan.planId,
      );
      mutationOperation = "apply";
      const outcome = projectLocalClientOnboardingMutationOutcome(
        unwrapEnvelope(await client.applyGovernedLocalClientOnboarding(
          { planId: plan.planId },
          { idempotencyKey: `${options.idempotencyKey}:apply:${index + 1}` },
        )),
        "apply",
        plan.planId,
      );
      if (outcome.result.profileId !== plan.profileId || outcome.result.action !== "enable") {
        throw new Error("control-center apply result did not match its plan");
      }
      completed.push(Object.freeze({
        profileId: plan.profileId,
        planId: plan.planId,
        approvalId: approval.approvalId,
        status: outcome.status,
        idempotencyStatus: outcome.idempotencyStatus,
        receipt: outcome.result.receipt,
      }));
    } catch (error) {
      const safe = createSafeLocalClientOnboardingFailure(error, {
        operation: mutationOperation,
        mutation: true,
      });
      failure = Object.freeze({
        operation: mutationOperation,
        profileId: plan.profileId,
        planId: plan.planId,
        status: safe.status,
        code: safe.code,
        retryAllowed: false,
      });
      break;
    }
  }

  const selectedOnboarding = Object.freeze({
    available: true,
    profiles: Object.freeze(selectedProfiles),
    certificationStatus: snapshot.clients.onboarding.certificationStatus,
  });
  const verification = await inspectControlCenterOnboarding(client, selectedOnboarding);
  const allExact = verification.profiles.length === manifest.profiles.length
    && verification.profiles.every((profile) => profile.installed && profile.state === "exact");
  const ok = failure === null && completed.length === plans.length && allExact;
  const clientConfigOutcomeUnknown = failure?.operation === "apply"
    && failure.status === "unknown-reconcile-required";
  const result = Object.freeze({
    ok,
    command: "control-center",
    operation: "configure",
    mode: "governed-mutation",
    clientConfigWritesPerformed: completed.length > 0 ? true : clientConfigOutcomeUnknown ? null : false,
    clientConfigOutcomeUnknown,
    manifest,
    plans: Object.freeze(plans),
    completed: Object.freeze(completed),
    verification,
    ...(failure === null ? {} : { failure }),
    retryAllowed: false,
    atomicAcrossClients: false,
    automaticRollbackPerformed: false,
    status: ok ? "completed" : completed.length > 0 ? "partial" : clientConfigOutcomeUnknown ? "unknown-reconcile-required" : "failed",
    nextAction: ok
      ? "Restart or reload each configured client, then rerun control-center for a fresh runtime observation."
      : "Do not retry automatically. Preserve completed receipts and reconcile the failed profile first.",
  });
  writeControlCenterConfigureResult(result, options, output);
  return ok ? 0 : 1;
}

function readControlCenterManifest({ path, root, expectedGatewayUrl }) {
  const value = readBoundedJsonFile({
    path,
    root,
    label: "Control-center manifest",
    maxBytes: CONTROL_CENTER_MANIFEST_MAX_BYTES,
  });
  if (
    !hasExactKeys(value, ["schema", "gatewayUrl", "profiles"])
    || ![CONTROL_CENTER_MANIFEST_SCHEMA, CONTROL_CENTER_MANIFEST_SCHEMA_V2].includes(value.schema)
    || typeof value.gatewayUrl !== "string"
    || !Array.isArray(value.profiles)
    || value.profiles.length < 2
    || value.profiles.length > (value.schema === CONTROL_CENTER_MANIFEST_SCHEMA ? 3 : 6)
    || new Set(value.profiles).size !== value.profiles.length
    || value.profiles.some((profileId) => !localClientOnboardingProfileFormat(profileId)
      || (value.schema === CONTROL_CENTER_MANIFEST_SCHEMA && localClientOnboardingProfileFormat(profileId) !== "json-only"))
  ) {
    throw new CliUsageError(
      "Control-center manifest must select unique supported profiles: v1 accepts two or three JSON profiles; v2 accepts two to six profiles.",
    );
  }
  const gatewayUrl = normalizeControlCenterGatewayUrl(value.gatewayUrl);
  if (gatewayUrl !== normalizeControlCenterGatewayUrl(expectedGatewayUrl)) {
    throw new CliUsageError("Control-center manifest gatewayUrl must exactly match --url.");
  }
  return Object.freeze({
    schema: value.schema,
    gatewayUrl,
    profiles: Object.freeze([...value.profiles]),
  });
}

function normalizeControlCenterGatewayUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new CliUsageError("Control-center manifest gatewayUrl is invalid.");
  }
  if (
    !new Set(["http:", "https:"]).has(parsed.protocol)
    || parsed.username.length > 0
    || parsed.password.length > 0
    || parsed.search.length > 0
    || parsed.hash.length > 0
  ) {
    throw new CliUsageError(
      "Control-center manifest gatewayUrl must be an http(s) URL without credentials, query, or fragment.",
    );
  }
  return trimUrl(parsed.toString());
}

function writeControlCenterConfigureResult(result, options, output) {
  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const lines = [
    "",
    output.bold("Local AI control center configuration"),
    `Status: ${result.status}`,
    `Mode: ${result.mode}`,
    `Profiles: ${result.manifest.profiles.join(", ")}`,
    `Plans: ${result.plans.length}`,
    `Completed: ${result.completed.length}`,
    ...(result.clientConfigOutcomeUnknown ? ["Client configuration outcome: unknown; reconcile before another mutation."] : []),
    `Cross-client atomicity: ${result.atomicAcrossClients ? "yes" : "no"}`,
    `Automatic retry: ${result.retryAllowed ? "allowed" : "forbidden"}`,
    "",
    ...result.plans.map((plan) => `  - ${plan.profileId}: ${plan.planId}`),
    "",
    result.nextAction ?? result.nextActions?.join(" ") ?? "",
    output.muted("Use --json and preserve every redacted receipt before a mutation."),
    "",
  ];
  output.write(`${lines.join("\n")}\n`);
}

async function fetchControlCenterJson(options, path) {
  let response;
  try {
    response = await fetch(`${trimUrl(options.url)}${path}`, {
      headers: { authorization: `Bearer ${options.adminKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch {
    throw new Error("CONTROL_CENTER_NETWORK_UNAVAILABLE");
  }
  if (!response.ok) {
    throw new Error(`CONTROL_CENTER_HTTP_${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("CONTROL_CENTER_RESPONSE_INVALID");
  }
}

async function readControlCenterSurface(surface, read) {
  const startedAt = Date.now();
  try { return await read(); }
  catch (error) { throw new CliControlCenterFailure(surface, error, Date.now() - startedAt); }
}

class CliControlCenterFailure extends Error {
  constructor(surface, cause, durationMs) {
    super(`The control-center could not read ${surface}.`);
    this.surface = surface;
    const knownCode = typeof cause?.code === "string" && SAFE_LOCAL_CLIENT_ONBOARDING_ERROR_CODES.has(cause.code)
      ? cause.code
      : typeof cause?.message === "string" && /^CONTROL_CENTER_(?:HTTP_[1-5]\d{2}|NETWORK_UNAVAILABLE|RESPONSE_INVALID)$/u.test(cause.message)
        ? cause.message
        : "CONTROL_CENTER_RESPONSE_INVALID";
    this.code = knownCode;
    this.durationMs = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : null;
  }
}

async function inspectControlCenterOnboarding(client, onboarding) {
  if (!onboarding.available) {
    return Object.freeze({
      available: false,
      code: onboarding.code,
      serverName: null,
      transport: null,
      certificationStatus: null,
      installedProfileCount: 0,
      profiles: Object.freeze([]),
    });
  }
  const installations = await Promise.all(onboarding.profiles.map(async (profile) => {
    try {
      const value = projectLocalClientOnboardingVerification(
        unwrapEnvelope(await client.verifyLocalClientOnboardingProfile(profile.profileId)),
        profile.profileId,
      );
      return Object.freeze({
        profileId: profile.profileId,
        client: profile.client,
        installed: value.installed,
        state: value.state,
      });
    } catch (error) {
      return Object.freeze({
        profileId: profile.profileId,
        client: profile.client,
        installed: false,
        state: "unavailable",
        code: redactLocalClientOnboardingErrorCode(error),
      });
    }
  }));
  const serverNames = new Set(onboarding.profiles.map((profile) => profile.serverName));
  const transports = new Set(onboarding.profiles.map((profile) => profile.transport));
  return Object.freeze({
    available: true,
    serverName: serverNames.size === 1 ? [...serverNames][0] : null,
    transport: transports.size === 1 ? [...transports][0] : null,
    certificationStatus: onboarding.certificationStatus,
    installedProfileCount: installations.filter((entry) => entry.installed).length,
    profiles: Object.freeze(installations),
  });
}

function projectControlCenterProviders(rawProviders) {
  if (!Array.isArray(rawProviders) || rawProviders.length > 1_000) {
    throw new Error("invalid control-center provider list");
  }
  return Object.freeze(rawProviders.map((provider) => {
    const id = provider?.id ?? provider?.name;
    if (!CONTROL_CENTER_VISIBLE_ID_PATTERN.test(id ?? "")) {
      throw new Error("invalid control-center provider identifier");
    }
    return id;
  }));
}

function projectControlCenterModels(payload) {
  if (
    !isPlainRecord(payload)
    || payload.object !== "list"
    || !Array.isArray(payload.data)
    || payload.data.length > 10_000
  ) {
    throw new Error("invalid control-center model response");
  }
  const models = payload.data.map((model) => {
    const id = model?.id;
    const providerId = model?.unified_ai?.provider_id ?? model?.owned_by;
    const executionMode = model?.unified_ai?.execution_mode ?? "unknown";
    if (
      !CONTROL_CENTER_VISIBLE_ID_PATTERN.test(id ?? "")
      || !CONTROL_CENTER_VISIBLE_ID_PATTERN.test(providerId ?? "")
      || !new Set(["fake", "real", "unknown"]).has(executionMode)
    ) {
      throw new Error("invalid control-center model record");
    }
    return Object.freeze({ id, providerId, executionMode });
  });
  const preview = models.slice(0, CONTROL_CENTER_MODEL_PREVIEW_LIMIT);
  return Object.freeze({
    count: models.length,
    items: Object.freeze(preview),
    truncated: preview.length !== models.length,
  });
}

function projectControlCenterBudget(payload) {
  const data = unwrapEnvelope(payload);
  const totals = data?.totals;
  const fields = ["keys", "activeKeys", "tokensUsed", "requestCount", "keysOverSoftBudget"];
  if (
    !isPlainRecord(data)
    || !isPlainRecord(totals)
    || !fields.every((field) => Number.isSafeInteger(totals[field]) && totals[field] >= 0)
  ) {
    throw new Error("invalid control-center budget response");
  }
  return Object.freeze({
    window: boundedControlCenterText(data.window, "current-budget-window", 128),
    keys: totals.keys,
    activeKeys: totals.activeKeys,
    tokensUsed: totals.tokensUsed,
    requestCount: totals.requestCount,
    keysOverSoftBudget: totals.keysOverSoftBudget,
  });
}

function boundedControlCenterText(value, fallback, maximum) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : fallback;
}

function controlCenterCheck(id, ready, detail) {
  return Object.freeze({ id, ready, detail });
}

function buildControlCenterNextActions({ checks, onboarding }) {
  const missing = new Set(checks.filter((check) => !check.ready).map((check) => check.id));
  const actions = [];
  if (missing.has("gateway")) actions.push("Run: pnpm gateway status");
  if (missing.has("models")) actions.push("Configure at least one gateway model and repeat control-center.");
  if (missing.has("budget")) actions.push("Create or activate a tenant virtual key with a reviewed budget.");
  if (missing.has("clients") || missing.has("tools")) {
    if (!onboarding.available || onboarding.profiles.length === 0) {
      actions.push("Enable governed local-client onboarding and inspect its registered profiles.");
    } else {
      actions.push(
        "Plan the reviewed manifest: pnpm gateway control-center configure --manifest docs/examples/local-ai-control-center.json --json",
      );
    }
  }
  return Object.freeze(actions);
}

function renderControlCenter(result, output) {
  const mark = (ready) => ready ? output.green("[ready]") : output.yellow("[setup]");
  const checks = new Map(result.checks.map((check) => [check.id, check]));
  const profiles = result.clients.onboarding.profiles;
  const lines = [
    "",
    output.bold("Local AI control center"),
    output.muted("One read-only view of shared models, budget, tools, and clients"),
    "",
    `  ${mark(checks.get("gateway").ready)} gateway  ${result.gateway.status}; chat ${result.gateway.chatReady ? "ready" : "needs attention"}`,
    `  ${mark(checks.get("models").ready)} models   ${result.shared.models.count} through ${result.gateway.url}`,
    `  ${mark(checks.get("budget").ready)} budget   ${result.shared.budget.activeKeys} active keys; ${result.shared.budget.tokensUsed} tokens used`,
    `  ${mark(checks.get("clients").ready)} clients  ${result.shared.tools.installedProfileCount}/${result.shared.tools.supportedProfileCount} onboarding profiles installed`,
    `  ${mark(checks.get("tools").ready)} tools    ${result.shared.tools.serverName ?? "unavailable"} via ${result.shared.tools.transport ?? "unavailable"}`,
    "",
    ...profiles.map((profile) => `  - ${profile.client}: ${profile.state}`),
    "",
    result.ok
      ? output.green("Control center ready for multiple opted-in clients.")
      : output.yellow("Control center needs setup before multiple clients share the gateway."),
    output.muted("Read-only inspection; no client config, credential, model route, or budget was changed."),
  ];
  if (result.nextActions.length > 0) {
    lines.push("", output.bold("Next actions"), ...result.nextActions.map((action) => `  - ${action}`));
  }
  lines.push("");
  output.write(`${lines.join("\n")}\n`);
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
