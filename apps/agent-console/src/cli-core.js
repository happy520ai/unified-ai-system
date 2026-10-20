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
import {
  runWorkflowOrCredentialCommand,
  runSpend,
} from "./cliSupportCommands.js";

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
import {
  CLI_VERSION,
  DEFAULT_GATEWAY_URL,
} from "./cliPaths.js";
export { CLI_VERSION, DEFAULT_GATEWAY_URL } from "./cliPaths.js";
import {
  runVerificationHistory,
  runEnhance,
  runDemo,
  runServe,
} from "./cliServeCommands.js";
import {
  runStatus,
  runDoctor,
  runChat,
} from "./cliStatusCommands.js";


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

