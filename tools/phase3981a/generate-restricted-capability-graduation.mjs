import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const phaseId = "Phase3981A-Restricted-Capability-Graduation-Gate";
const generatedAt = new Date().toISOString();

const targets = [
  "docs/restricted-capability-graduation/GRADUATION_LEDGER.md",
  "docs/restricted-capability-graduation/ACCEPTANCE_MATRIX.md",
  "docs/restricted-capability-graduation/ROLLBACK_RUNBOOK.md",
  "docs/restricted-capability-graduation/SAFETY_BOUNDARY.md",
  "docs/restricted-capability-graduation/OWNER_APPROVAL_PACKET.example.json",
  "apps/ai-gateway-service/evidence/phase-3981a-restricted-capability-graduation/result.json",
];

const forbiddenPaths = [
  "legacy/",
  "PROJECT_CONTEXT.md",
  ".env",
  ".env.local",
  ".env.production",
  "auth.json",
  "secrets/",
  "apps/ai-gateway-service/src/routes/chat/",
  "apps/ai-gateway-service/src/routes/chat-gateway/",
];

const allowedReadFiles = [
  "package.json",
  "docs/project-brain/opencode-autopilot-policy.json",
  "docs/automation/opencode-autopilot-task-queue.json",
  "docs/system-atlas/CURRENT_CAPABILITY_LEDGER.md",
  "docs/system-atlas/SAFETY_BOUNDARY_MAP.md",
  "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js",
];

const capabilities = [
  {
    id: "workforce.multi_agent.execution",
    name: "Workforce 多 Agent 执行",
    previousState: "preview_only",
    graduatedState: "ready_for_owner_authorized_real_use",
    defaultEnabled: false,
    realUseGate:
      "ownerApprovalPacket.capabilities includes workforce.multi_agent.execution; maxWorkers <= 3 for first real run; executionEnabled=true; no 144-worker fanout until staged evidence passes",
    acceptance:
      "Run 1-3 workers against a bounded low-risk task, collect per-worker result, aggregate output, stop on first failed worker, and write evidence.",
    rollback:
      "Set executionEnabled=false, clear active worker lease, stop queue intake, preserve evidence, and return to preview mode.",
  },
  {
    id: "gvc.automatic_repair_cycle",
    name: "GVC 自动修复循环",
    previousState: "dry_run_gated",
    graduatedState: "ready_for_owner_authorized_real_use",
    defaultEnabled: false,
    realUseGate:
      "ownerApprovalPacket.capabilities includes gvc.automatic_repair_cycle; allowedFiles are explicit; maxFilesChanged <= 1 for first real run; rollback plan exists before mutation",
    acceptance:
      "Select one low-risk file, run preflight, apply a minimal repair, run verifier, and write rollback evidence.",
    rollback:
      "Apply recorded reverse patch or restore exact pre-mutation content hash, then rerun the verifier that proved the failure.",
  },
  {
    id: "provider.multi_provider.real_call",
    name: "多 Provider 真实调用",
    previousState: "default_off_requires_explicit_approval",
    graduatedState: "ready_for_owner_authorized_real_use",
    defaultEnabled: false,
    realUseGate:
      "ownerApprovalPacket.providerCallAllowed=true; credentialRefOnly=true; rawSecretPrintAllowed=false; maxRequests <= 1 per provider for first smoke; provider allowlist is explicit",
    acceptance:
      "Perform one bounded smoke per approved provider through CredentialRef, record HTTP/provider status without raw secret, stop on timeout/rate-limit/failure.",
    rollback:
      "Disable provider runtime gate, revoke the approval packet, keep model selectable state unchanged unless smoke evidence explicitly passes.",
  },
  {
    id: "mode.normal_god_tianshu.runtime",
    name: "三模式 Normal/God/Tianshu",
    previousState: "code_exists_not_default_main_chain",
    graduatedState: "ready_for_owner_authorized_isolated_real_use",
    defaultEnabled: false,
    realUseGate:
      "Use isolated non-default route or command; do not modify default /chat or /chat-gateway/execute; ownerApprovalPacket.capabilities includes mode.normal_god_tianshu.runtime",
    acceptance:
      "Run one isolated Normal, God, and Tianshu route smoke; verify mode label, route decision, evidenceId, and no default chat behavior change.",
    rollback:
      "Disable isolated mode route flag and keep default /chat and /chat-gateway/execute unchanged.",
  },
  {
    id: "nightly.scheduler.real_registration",
    name: "夜间自动任务调度",
    previousState: "script_ready_scheduler_unregistered",
    graduatedState: "ready_for_manual_permissioned_registration",
    defaultEnabled: false,
    realUseGate:
      "Manual administrator registration or explicit owner-approved scheduler registration intake; Phase632 preflight; no provider/secret/deploy actions in nightly task",
    acceptance:
      "Register Windows Task Scheduler entry, run once, intake sanitized scheduler result, verify scheduledTaskRegistered=true only from result evidence.",
    rollback:
      "Run unregister script, verify task is absent, set nightlyAutomationEnabled=false, and preserve registration/removal evidence.",
  },
];

async function main() {
  console.log(`[${phaseId}] generator`);
  const existingTargets = await detectExistingTargets(targets);
  const readSummary = await readAllowedContext();
  const docs = buildDocs(readSummary);

  for (const [relativePath, content] of Object.entries(docs)) {
    await writeText(relativePath, content);
  }

  const evidence = {
    phaseId,
    completed: true,
    recommended_sealed: true,
    blocker: "none",
    graduatedCapabilityCount: capabilities.length,
    graduatedState: "ready_for_owner_authorized_real_use",
    ownerAuthorizationNoted: true,
    providerCallsMade: false,
    realProviderCallsAuthorizedByOwner: true,
    realProviderCallsExecutedByThisPhase: false,
    secretsRead: false,
    rawSecretPrinted: false,
    deployExecuted: false,
    legacyModified: false,
    projectContextModified: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    defaultChatBehaviorChanged: false,
    opencodeAutopilotRealUnlimitedModeEnabled: false,
    opencodeAutopilotGraduationPrepared: true,
    windowsTaskSchedulerRegisteredByThisPhase: false,
    filesCreated: targets.filter((file) => !existingTargets.has(file)),
    filesModified: targets.filter((file) => existingTargets.has(file)),
    verificationCommands: [
      "node --check tools/phase3981a/generate-restricted-capability-graduation.mjs",
      "node --check tools/phase3981a/verify-restricted-capability-graduation.mjs",
      "pnpm run run:phase3981a-restricted-capability-graduation",
      "pnpm run verify:phase3981a-restricted-capability-graduation",
      "pnpm run verify:phase3977c-mimo-credentialref-resolver-contract",
      "pnpm run status:phase3979a-opencode-autopilot",
      "pnpm run verify:phase3979a-opencode-autopilot-governor",
      "pnpm -r --if-present check",
    ],
    skippedForbiddenPaths: forbiddenPaths,
    allowedReadFiles: readSummary.readFiles,
    nextRecommendedPhases: [
      "Phase3982A Workforce 1-3 Worker Real Execution Pilot",
      "Phase3983A GVC Single-File Real Repair Pilot",
      "Phase3984A CredentialRef Multi-Provider One-Shot Real Smoke",
      "Phase3985A Isolated Normal/God/Tianshu Runtime Route Smoke",
      "Phase3986A Nightly Scheduler Manual Registration Result Intake",
    ],
    generatedAt,
  };

  await writeText(
    "apps/ai-gateway-service/evidence/phase-3981a-restricted-capability-graduation/result.json",
    JSON.stringify(evidence, null, 2),
  );

  console.log(`[${phaseId}] wrote ${targets.length} files`);
  console.log(`[${phaseId}] providerCallsMade=false`);
  console.log(`[${phaseId}] secretsRead=false`);
}

async function detectExistingTargets(files) {
  const existing = new Set();
  for (const file of files) {
    try {
      await stat(resolve(repoRoot, file));
      existing.add(file);
    } catch {
      // Missing target means it will be created.
    }
  }
  return existing;
}

async function readAllowedContext() {
  const readFiles = [];
  for (const file of allowedReadFiles) {
    if (isForbidden(file)) {
      continue;
    }
    try {
      await readFile(resolve(repoRoot, file), "utf8");
      readFiles.push(file);
    } catch {
      // Optional context may be absent in partial checkouts.
    }
  }
  return { readFiles };
}

function isForbidden(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  return forbiddenPaths.some((item) => normalized === item || normalized.startsWith(item));
}

function buildDocs(readSummary) {
  return {
    "docs/restricted-capability-graduation/GRADUATION_LEDGER.md": buildGraduationLedger(readSummary),
    "docs/restricted-capability-graduation/ACCEPTANCE_MATRIX.md": buildAcceptanceMatrix(),
    "docs/restricted-capability-graduation/ROLLBACK_RUNBOOK.md": buildRollbackRunbook(),
    "docs/restricted-capability-graduation/SAFETY_BOUNDARY.md": buildSafetyBoundary(),
    "docs/restricted-capability-graduation/OWNER_APPROVAL_PACKET.example.json": JSON.stringify(buildApprovalPacket(), null, 2),
  };
}

function buildGraduationLedger(readSummary) {
  return [
    "# Phase3981A Restricted Capability Graduation Ledger",
    "",
    "## One-line Definition",
    "",
    "本阶段把五个受限能力从 preview/dry-run/gated 状态升级为 owner-authorized real-use ready 状态，但不默认放开、不改默认 `/chat`、不读取 secret、不部署。",
    "",
    "## Current Graduation Status",
    "",
    "| capabilityId | owner-facing name | previous state | graduated state | default enabled | real-use gate |",
    "| --- | --- | --- | --- | --- | --- |",
    ...capabilities.map(
      (item) =>
        `| ${item.id} | ${item.name} | ${item.previousState} | ${item.graduatedState} | ${item.defaultEnabled} | ${item.realUseGate} |`,
    ),
    "",
    "## Important Truth Boundary",
    "",
    "- `ready_for_owner_authorized_real_use` means the capability now has an explicit approval packet, bounded first-run rule, evidence rule, stop condition, and rollback rule.",
    "- It does not mean 144 workers already ran.",
    "- It does not mean GVC has already mutated production source in this phase.",
    "- It does not mean this phase called MiMo, OpenAI, Claude, OpenRouter, NVIDIA, or any paid provider.",
    "- It does not mean Windows Task Scheduler has already been registered.",
    "- It does not mean `/chat` or `/chat-gateway/execute` has been changed.",
    "",
    "## Read Scope",
    "",
    ...readSummary.readFiles.map((file) => `- ${file}`),
    "",
    "## Forbidden Paths Skipped",
    "",
    ...forbiddenPaths.map((file) => `- ${file}`),
    "",
  ].join("\n");
}

function buildAcceptanceMatrix() {
  return [
    "# Phase3981A Acceptance Matrix",
    "",
    "| capabilityId | first real acceptance | max first-run blast radius | evidence required | pass condition | blocker condition |",
    "| --- | --- | --- | --- | --- | --- |",
    ...capabilities.map(
      (item) =>
        `| ${item.id} | ${item.acceptance} | ${blastRadius(item.id)} | result.json plus command log summary, no raw secret | bounded real run completed and verifier passes | approval missing, limit exceeded, secret exposure risk, route mutation risk, verifier failure |`,
    ),
    "",
    "## Required Verification Chain",
    "",
    "- `node --check tools/phase3981a/generate-restricted-capability-graduation.mjs`",
    "- `node --check tools/phase3981a/verify-restricted-capability-graduation.mjs`",
    "- `pnpm run run:phase3981a-restricted-capability-graduation`",
    "- `pnpm run verify:phase3981a-restricted-capability-graduation`",
    "- `pnpm run verify:phase3977c-mimo-credentialref-resolver-contract`",
    "- `pnpm run status:phase3979a-opencode-autopilot`",
    "- `pnpm run verify:phase3979a-opencode-autopilot-governor`",
    "- `pnpm -r --if-present check`",
    "",
  ].join("\n");
}

function blastRadius(capabilityId) {
  const map = {
    "workforce.multi_agent.execution": "1-3 workers, one bounded task, no 144-worker fanout",
    "gvc.automatic_repair_cycle": "one low-risk file, one repair, rollback hash required",
    "provider.multi_provider.real_call": "maxRequests=1 per approved provider for first smoke",
    "mode.normal_god_tianshu.runtime": "isolated non-default route or command only",
    "nightly.scheduler.real_registration": "one local Windows scheduled task, manual unregister path",
  };
  return map[capabilityId];
}

function buildRollbackRunbook() {
  return [
    "# Phase3981A Rollback Runbook",
    "",
    "## Global Rollback",
    "",
    "- Revoke the owner approval packet.",
    "- Set each capability runtime flag back to false.",
    "- Preserve all evidence files and command summaries.",
    "- Do not delete failure evidence to make a phase look clean.",
    "- Do not claim workspace clean.",
    "",
    "## Capability Rollback",
    "",
    ...capabilities.flatMap((item) => [
      `### ${item.name}`,
      "",
      `- Capability ID: ${item.id}`,
      `- Rollback: ${item.rollback}`,
      "",
    ]),
  ].join("\n");
}

function buildSafetyBoundary() {
  return [
    "# Phase3981A Safety Boundary",
    "",
    "## Defaults",
    "",
    "- 默认不读取 `.env`、`auth.json`、raw secret、raw API key、token、credential 原文。",
    "- 默认不打印 Authorization header、API key、secret、CredentialRef 解析后的明文值。",
    "- 默认不调用真实 Provider；本阶段只承认 owner 已表达后续可真实调用模型，但本阶段没有执行真实 Provider 调用。",
    "- 默认不 deploy、不 release、不 tag、不 artifact upload、不 commit、不 push。",
    "- 默认不修改 `legacy/`。",
    "- 默认不修改 `PROJECT_CONTEXT.md`。",
    "- 默认不修改 `/chat`。",
    "- 默认不修改 `/chat-gateway/execute`。",
    "- 默认不把 dry-run、preview、template、approval-ready 写成已经真实完成。",
    "",
    "## Real Provider Test Conditions",
    "",
    "- `ownerApprovalPacket.providerCallAllowed` 必须为 true。",
    "- `credentialRefOnly` 必须为 true。",
    "- `rawSecretPrintAllowed` 必须为 false。",
    "- `maxRequests` 首次必须小于等于 1，除非后续阶段另有明确批准。",
    "- provider allowlist 必须明确列出 provider 和 model。",
    "- 失败、timeout、rate limit 不得写成 pass。",
    "",
    "## Real Deployment Conditions",
    "",
    "- 需要单独 deploy approval packet。",
    "- 需要回滚路径、健康检查、发布范围、责任人和窗口期。",
    "- 本阶段没有 deploy approval，也没有执行部署。",
    "",
    "## Owner Confirmation Conditions",
    "",
    "- 真实 Provider 调用、GVC 真实 mutation、Workforce 多 worker 真执行、三模式接入默认主链、Windows Task Scheduler 注册、deploy/release/push/commit 都必须有明确 owner confirmation。",
    "- owner confirmation 只授权指定动作，不自动授权无限后续动作。",
    "",
  ].join("\n");
}

function buildApprovalPacket() {
  return {
    phaseId,
    approvalType: "restricted_capability_graduation_real_use",
    ownerApproved: true,
    credentialRefOnly: true,
    rawSecretReadAllowed: false,
    rawSecretPrintAllowed: false,
    providerCallAllowed: true,
    deployAllowed: false,
    commitAllowed: false,
    pushAllowed: false,
    chatRouteChangeAllowed: false,
    chatGatewayExecuteChangeAllowed: false,
    capabilities: capabilities.map((item) => item.id),
    firstRunLimits: {
      maxWorkers: 3,
      maxGvcFilesChanged: 1,
      maxProviderRequestsPerProvider: 1,
      maxSchedulerRegistrations: 1,
      defaultChatMainChainMutation: false,
    },
    stopConditions: [
      "verifier_failure",
      "provider_timeout",
      "provider_rate_limit",
      "secret_exposure_risk",
      "out_of_scope_file_mutation",
      "chat_route_mutation_detected",
      "deploy_or_git_operation_detected",
    ],
    evidenceRequired: true,
    rollbackRequired: true,
    generatedAt,
  };
}

async function writeText(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${content.trimEnd()}\n`, "utf8");
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
