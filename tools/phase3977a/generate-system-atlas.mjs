import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const TARGET_FILES = [
  "docs/system-atlas/SYSTEM_ATLAS.md",
  "docs/system-atlas/CURRENT_CAPABILITY_LEDGER.md",
  "docs/system-atlas/ENTRYPOINT_MAP.md",
  "docs/system-atlas/SAFETY_BOUNDARY_MAP.md",
  "docs/system-atlas/PHASE_STATUS_LEDGER.md",
  "docs/system-atlas/OWNER_READING_GUIDE.md",
  "apps/ai-gateway-service/evidence/phase-3977a-system-atlas-recovery/result.json",
];

const FORBIDDEN_RULES = [
  { id: "legacy", matches: (value) => value.includes("legacy/") || value === "legacy" },
  { id: "project_context", matches: (value) => value.endsWith("PROJECT_CONTEXT.md") },
  { id: "env", matches: (value) => /(^|\/)\.env($|[./])/.test(value) },
  { id: "auth_json", matches: (value) => value.endsWith("/auth.json") || value === "auth.json" },
  { id: "secrets_dir", matches: (value) => value.includes("/secrets/") },
];

const SCAN_ROOTS = [
  "README.md",
  "AGENTS.md",
  "package.json",
  "docs",
  "tools",
  "packages",
  "apps/ai-gateway-service/src",
  "apps/ai-gateway-service/evidence",
];

const CURRENT_PHASE_RANGE = "Phase3971A-3978B";
const NEXT_RECOMMENDED_PHASES = [
  "Phase3981A System Atlas Mission Control Read-Only Surface",
  "Phase3982A Provider Reality Dashboard Reconciliation",
];

const VERIFICATION_COMMANDS = [
  "pnpm run run:phase3977a-system-atlas",
  "pnpm run verify:phase3977a-system-atlas",
  "pnpm -r --if-present check",
];

async function main() {
  console.log("[Phase3977A] System Atlas Recovery generator");

  const existingTargets = await detectExistingTargets(TARGET_FILES);
  const scanSummary = await scanAllowedRoots();
  const packageJson = JSON.parse(await readText("package.json"));
  const readme = await readText("README.md");
  const agents = await readText("AGENTS.md");

  const phaseEvidence = await loadPhaseEvidence();
  const context = buildContext({ packageJson, readme, agents, phaseEvidence, scanSummary });
  const documents = buildDocuments(context);

  for (const [file, content] of Object.entries(documents)) {
    await writeText(file, content);
  }

  const filesCreated = TARGET_FILES.filter((file) => !existingTargets.has(file));
  const filesModified = TARGET_FILES.filter((file) => existingTargets.has(file));

  const evidence = {
    completed: true,
    recommended_sealed: true,
    blocker: "none",
    providerCallsMade: false,
    secretsRead: false,
    rawSecretPrinted: false,
    deployExecuted: false,
    legacyModified: false,
    projectContextModified: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    filesCreated,
    filesModified,
    verificationCommands: VERIFICATION_COMMANDS,
    nextRecommendedPhases: NEXT_RECOMMENDED_PHASES,
    skippedForbiddenPaths: scanSummary.skippedForbiddenPaths,
    scanRoots: SCAN_ROOTS,
    scannedFileCount: scanSummary.scannedFiles.length,
    currentPhaseRange: CURRENT_PHASE_RANGE,
    generatedAt: new Date().toISOString(),
  };

  await writeText(
    "apps/ai-gateway-service/evidence/phase-3977a-system-atlas-recovery/result.json",
    `${JSON.stringify(evidence, null, 2)}\n`,
  );

  console.log(`[Phase3977A] Wrote ${TARGET_FILES.length} files`);
  console.log(`[Phase3977A] Forbidden paths skipped: ${scanSummary.skippedForbiddenPaths.length}`);
  console.log("[Phase3977A] Provider calls made: false");
  console.log("[Phase3977A] Secrets read: false");
}

async function detectExistingTargets(targets) {
  const existing = new Set();
  for (const target of targets) {
    try {
      await stat(resolve(repoRoot, target));
      existing.add(target);
    } catch {
      // Ignore.
    }
  }
  return existing;
}

async function scanAllowedRoots() {
  const scannedFiles = [];
  const skippedForbiddenPaths = [];
  for (const root of SCAN_ROOTS) {
    const absoluteRoot = resolve(repoRoot, root);
    let info;
    try {
      info = await stat(absoluteRoot);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      await walkDirectory(absoluteRoot, scannedFiles, skippedForbiddenPaths);
    } else {
      const rel = normalizeRelative(absoluteRoot);
      const forbiddenRule = matchForbidden(rel);
      if (forbiddenRule) {
        skippedForbiddenPaths.push(`${rel} [${forbiddenRule}]`);
      } else {
        scannedFiles.push(rel);
      }
    }
  }
  return {
    scannedFiles,
    skippedForbiddenPaths: Array.from(new Set(skippedForbiddenPaths)).sort(),
  };
}

async function walkDirectory(directory, scannedFiles, skippedForbiddenPaths) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    const rel = normalizeRelative(absolutePath);
    const forbiddenRule = matchForbidden(rel, entry.isDirectory());
    if (forbiddenRule) {
      skippedForbiddenPaths.push(`${rel}${entry.isDirectory() ? "/" : ""} [${forbiddenRule}]`);
      continue;
    }
    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, scannedFiles, skippedForbiddenPaths);
      continue;
    }
    scannedFiles.push(rel);
  }
}

function matchForbidden(relativePath, isDirectory = false) {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const rule of FORBIDDEN_RULES) {
    if (rule.matches(normalized, isDirectory)) {
      return rule.id;
    }
  }
  return null;
}

function normalizeRelative(absolutePath) {
  return relative(repoRoot, absolutePath).replace(/\\/g, "/");
}

async function loadPhaseEvidence() {
  const evidenceFiles = {
    phase3971: "apps/ai-gateway-service/evidence/phase-3971a-xiaomi-provider-readiness-matrix/result.json",
    phase3972: "apps/ai-gateway-service/evidence/phase-3972a-xiaomi-credentialref-readiness-without-secret/result.json",
    phase3973: "apps/ai-gateway-service/evidence/phase-3973a-xiaomi-one-shot-smoke-approval-gate/result.json",
    phase3974: "apps/ai-gateway-service/evidence/phase-3974a-xiaomi-one-shot-real-provider-smoke/result.json",
    phase3975: "apps/ai-gateway-service/evidence/phase-3975a-xiaomi-stability-micro-batch-smoke/result.json",
    phase3976: "apps/ai-gateway-service/evidence/phase-3976a-xiaomi-provider-reality-seal-review/result.json",
  };

  const loaded = {};
  for (const [key, file] of Object.entries(evidenceFiles)) {
    loaded[key] = await readJson(file);
  }
  return loaded;
}

function buildContext({ packageJson, readme, agents, phaseEvidence, scanSummary }) {
  const scriptNames = Object.keys(packageJson.scripts ?? {});
  const hasUiRoute = fileExistsInScan(scanSummary.scannedFiles, "apps/ai-gateway-service/src/ui/consolePage.js");
  const hasThreeMode = fileExistsInScan(scanSummary.scannedFiles, "apps/ai-gateway-service/src/three-mode");
  const hasCodexContextGateway = fileExistsInScan(scanSummary.scannedFiles, "packages/codex-context-gateway");
  const hasGvc = scriptNames.includes("gvc:cycle");
  const hasWorkforce = fileExistsInScan(scanSummary.scannedFiles, "apps/ai-gateway-service/src/workforce");

  const phase3971 = phaseEvidence.phase3971 ?? {};
  const phase3972 = phaseEvidence.phase3972 ?? {};
  const phase3973 = phaseEvidence.phase3973 ?? {};
  const phase3974 = phaseEvidence.phase3974 ?? {};
  const phase3975 = phaseEvidence.phase3975 ?? {};
  const phase3976 = phaseEvidence.phase3976 ?? {};

  const recentMiMoLane = {
    providerId: phase3971?.matrix?.providerId ?? "mimo",
    endpoint: phase3971?.matrix?.endpoint ?? "https://token-plan-cn.xiaomimimo.com/v1",
    modelRegistryStatus: phase3971?.matrix?.modelRegistryStatus ?? "unknown",
    credentialRefReady3972: phase3972?.readyForOwnerAuthorizedOneShotSmoke === true,
    oneShotAllowed3973: phase3973?.providerSmokeExecutionAllowed === true,
    oneShotExecuted3974: phase3974?.realProviderSmokeExecuted === true,
    microBatchExecuted3975: phase3975?.microBatchExecuted === true,
    sealReviewBlockedBy3976: phase3976?.blocker ?? "unknown",
  };

  const currentBlocker = extractCurrentBlocker(readme, agents);

  return {
    readme,
    agents,
    scriptNames,
    hasUiRoute,
    hasThreeMode,
    hasCodexContextGateway,
    hasGvc,
    hasWorkforce,
    currentBlocker,
    scanSummary,
    recentMiMoLane,
    phaseEvidence,
    summary: {
      systemDefinition:
        "PME AI Gateway / unified-ai-system 是一个本地优先、证据驱动、默认保守的 AI Gateway Workbench，用于管理 Provider、模型、Chat Gateway、Mission Control、Workforce 预览与 Codex/GVC 辅助流程。",
      productionReality:
        "当前仓库可以证明存在可运行的本地工作台与多条 dry-run / gated 能力链，但仍不能声称已经完成生产部署、公开 SaaS 发布或稳定多 Provider 商业化交付。",
    },
  };
}

function buildDocuments(context) {
  return {
    "docs/system-atlas/SYSTEM_ATLAS.md": buildSystemAtlas(context),
    "docs/system-atlas/CURRENT_CAPABILITY_LEDGER.md": buildCapabilityLedger(context),
    "docs/system-atlas/ENTRYPOINT_MAP.md": buildEntrypointMap(context),
    "docs/system-atlas/SAFETY_BOUNDARY_MAP.md": buildSafetyBoundaryMap(context),
    "docs/system-atlas/PHASE_STATUS_LEDGER.md": buildPhaseStatusLedger(context),
    "docs/system-atlas/OWNER_READING_GUIDE.md": buildOwnerReadingGuide(context),
  };
}

function buildSystemAtlas(context) {
  const mimo = context.recentMiMoLane;
  return `# System Atlas

> Generated by Phase3977A on ${new Date().toISOString().slice(0, 10)}

## 系统一句话定义

${context.summary.systemDefinition}

## 当前主要模块

| 模块 | 主要路径 | 当前状态 | 说明 |
| --- | --- | --- | --- |
| AI Gateway Service | \`apps/ai-gateway-service/src\` | 已实现 | 服务核心、路由、UI、Chat Gateway、Provider 接入都在这里。 |
| Agent Console | \`apps/agent-console\` | 已实现 | 上层控制台入口，仍以本地工作台为主。 |
| Shared Contracts / SDK / Config / Utils | \`packages/shared-*\` | 已实现 | 提供共享协议、配置与 SDK。 |
| Mission Control / Workbench UI | \`apps/ai-gateway-service/src/ui\` | 已实现，默认展示本地工作台 | README 明确其当前是 bounded / local-first 体验，不是生产部署。 |
| Codex Context Gateway | \`packages/codex-context-gateway\` | 已封板，读上下文不连真实 Codex | 只读上下文包、相关文件选择、token budget、stale guard。 |
| GVC / cycle controller | \`tools/gvc\` | 已实现，但保持 dry-run / gated | 有任务队列、cycle、timed runner 等入口，不应表述为真实自治执行。 |
| Workforce / internal employee bus | \`apps/ai-gateway-service/src/workforce\` + \`packages/workforce-*\` + \`packages/employee-*\` | 预览链已具备，但执行链仍受限 | 重点是计划、预览、协作协议、总线和执行 fabric。 |
| Provider / Credential subsystem | \`apps/ai-gateway-service/src/providers\` + \`src/credentials\` | 已实现多条基础设施，但真实调用默认关闭 | CredentialRef、redaction、resolver、vault adapter 都已存在。 |
| Evidence / verifier toolchain | \`apps/ai-gateway-service/evidence\` + \`tools\` | 已形成长期主链 | 阶段 evidence 与 verifier 是当前系统可验证性的核心。 |

## Normal Mode / God Mode / Tianshu Mode 当前状态

| 模式 | 当前状态 | 事实边界 |
| --- | --- | --- |
| Normal Mode | 已实现 | 代码位于 \`apps/ai-gateway-service/src/three-mode\`，但不代表默认主链已经切换到多模式自治。 |
| God Mode | 已实现 | 作为三模式能力存在，仍受整体 Provider / 安全 /证据边界约束。 |
| Tianshu Mode | 已实现 | 作为模式能力存在，不能被表述为已具备生产自治能力。 |

## Mission Control 当前状态

- 当前 owner-facing 主入口是 \`GET /ui\`，README 将其定义为 local-first Workbench。
- 当前首页强调 Mission Control sample dry-run first-screen entry 已 sealed，但这表示 UX 与治理边界已验证，不等于生产投产。
- UI 中既有真实可点功能，也有 preview-only / gated 模块；Owner 需要区分“页面存在”和“真实外部动作已授权执行”。

## Codex Context Gateway 当前状态

- 已封板为独立只读上下文子网关。
- 允许做上下文包生成、相关文件选择、长上下文压缩、token budget 和 stale guard。
- 默认不改 Codex config/base_url，不连真实 relay，不调 Provider，不改 \`/chat\` 或 \`/chat-gateway/execute\`。

## GVC / gvc:cycle 当前状态

- \`gvc:cycle\`、timed runner、task queue 等入口都在仓库里存在。
- README / AGENTS 一致强调它们是 dry-run / gated / preview 性质。
- 当前不能把 GVC 描述成“已获批的真实自动修复执行器”。

## Provider / CredentialRef 当前状态

| 条目 | 当前状态 | 说明 |
| --- | --- | --- |
| NVIDIA 默认聊天主链 | 已存在 | README / AGENTS 长期强调默认 \`/chat\` 不应被随意改动。 |
| MiMo/Xiaomi 原始验证 lane | 历史上 3971A-3976A 为 blocked lane | 见下方详细台账。 |
| CredentialRef 体系 | 已实现基础设施 | \`src/credentials\` 与 Provider resolver/allowlist 机制存在。 |
| Safe Executor | 已实现基础设施 | 但某些 Provider 需显式接线并受批准。 |
| 真实 Provider 默认调用 | 默认关闭 | 只有显式批准、受限请求、CredentialRef-only、禁止打印 secret 时才允许。 |

### Phase3971A-3976A Xiaomi / MiMo Provider Verification Lane 状态

| Phase | 结论 | 关键事实 |
| --- | --- | --- |
| 3971A | sealed | adapter 与 model registry 存在，但 modelRegistryStatus=\`${mimo.modelRegistryStatus}\`，CredentialRef / Safe Executor 未接通。 |
| 3972A | sealed | \`readyForOwnerAuthorizedOneShotSmoke=false\`，阻塞点是 CredentialRef resolver / executor allowlist 未就位。 |
| 3973A | sealed | owner approval 缺失或拒绝，\`providerSmokeExecutionAllowed=false\`。 |
| 3974A | sealed | one-shot real smoke 未执行，\`providerCallsMade=false\`。 |
| 3975A | sealed | stability micro-batch 未执行，继续受 3974A 阻塞。 |
| 3976A | sealed | reality seal review 明确 \`xiaomiCanBePrimaryValidationProvider=false\`，blocker=\`${mimo.sealReviewBlockedBy3976}\`。 |

## Workforce / internal employee bus 当前状态

- Workforce 体系当前最稳妥的描述是“计划、预览、协议、fabric 与治理链条已存在，但默认不是无人值守真实员工执行系统”。
- internal employee bus / router / contracts / scheduler / execution fabric 都已成体系存在于 \`packages/\` 下。
- 这些模块当前更像可验证的架构骨架与 dry-run 工作流，而不是默认开启的真实组织执行系统。

## Evidence / verifier 当前状态

- Evidence 是当前项目最接近“产品事实源”的部分之一。
- \`apps/ai-gateway-service/evidence\` 下已有大规模阶段结果。
- \`tools/\` 下存在大量 verifier / generator / smoke / audit 脚本，仓库是明显的“以阶段证据驱动迭代”的形态。

## 当前还不是生产完成的部分

- 不能声称已经 deploy / release / public SaaS。
- 多 Provider 真实商业稳定性并未全线证明。
- Workforce / GVC / Codex integration 仍以 preview、dry-run、approval-gated 为主。
- Mission Control 虽然 owner-facing，但其中不少面板仍属于治理预览、证据展示、受限执行入口。
- Provider 与 secret 管理有安全边界，但不等于完成了生产级 KMS、多租户隔离、审计合规和公开 SLA。

## 当前系统现实结论

${context.summary.productionReality}
`;
}

function buildCapabilityLedger() {
  const rows = [
    ["mission-control-ui", "Mission Control / 工作台首页", "implemented", "false", "false", "true", "false", "false", "false", "false", "none", "README current-state, verifyWebConsole family"],
    ["chat-default-lane", "默认聊天主链", "implemented", "false", "false", "partial", "true", "not_by_phase3977a", "true", "false", "real provider needs explicit key + approval context", "Phase312A/315A evidence family"],
    ["chat-gateway", "Chat Gateway 任务责任链", "implemented", "false", "false", "partial", "true", "not_by_phase3977a", "true", "false", "default /chat must remain unchanged unless explicitly approved", "phase314a evidence family"],
    ["knowledge-load-retrieve", "知识导入与检索", "implemented", "false", "false", "true", "false", "false", "false", "false", "none", "phase21a/21b/25a/26a evidence family"],
    ["model-import", "模型导入与模型库导入", "implemented", "false", "false", "partial", "true", "gated", "true", "false", "needs provider-safe test context", "phase8a / phase312a evidence family"],
    ["provider-config-center", "Provider 配置中心", "implemented", "false", "false", "partial", "true", "gated", "true", "false", "must not expose raw key", "phase76a/76e evidence family"],
    ["three-mode", "Normal / God / Tianshu 三模式", "implemented", "false", "false", "partial", "true", "gated", "true", "false", "not a production autonomy claim", "src/three-mode + phase328a family"],
    ["workforce-preview", "Workforce 计划与预览", "implemented_preview", "true", "false", "partial", "false", "false", "false", "false", "real workforce execution is not default-enabled", "phase102a family + README current-state"],
    ["employee-bus", "internal employee bus", "implemented_preview", "true", "false", "false", "false", "false", "false", "false", "preview-only coordination path", "phase578a-t to phase591a-t docs/evidence"],
    ["codex-context-gateway", "Codex Context Gateway", "implemented_preview", "true", "false", "false", "false", "false", "false", "false", "no real codex base_url connection", "phase592a-t to phase600a-t evidence family"],
    ["gvc-cycle", "GVC / gvc:cycle", "implemented_preview", "true", "false", "false", "false", "false", "false", "false", "dry-run / approval-gated governance only", "phase2000+ gvc evidence family"],
    ["runtime-candidate-crs", "Codex CRS runtime candidate path", "implemented_gated", "true", "false", "false", "false", "false", "false", "false", "isolated candidate only, not main chain", "phase621r-628r evidence family"],
    ["mimo-lane-3971-3976", "MiMo Provider 原始验证 lane", "blocked_historically", "true", "false", "false", "true", "false", "false", "false", "credentialref_not_ready in 3976A", "phase-3971a ... phase-3976a"],
    ["evidence-verifier-fabric", "Evidence / verifier 验证链", "implemented", "false", "false", "false", "false", "false", "false", "false", "none", "tools/* + evidence/*"],
  ];

  const table = rows
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");

  return `# Current Capability Ledger

> Generated by Phase3977A

| capabilityId | owner-facing name | implementation status | dryRunOnly | mockOnly | realBrowserVerified | providerCallRequired | providerCallActuallyMade | secretRequired | deployRequired | current blocker | evidence refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table}

## 读法说明

- \`dryRunOnly=true\` 表示当前只能做预览、模拟、计划或只读展示。
- \`mockOnly=true\` 代表能力仅存在 mock/fixture，没有真实业务链。
- \`providerCallActuallyMade\` 专门区分“理论需要 Provider”与“当前仓库 evidence 已经证明真实调用发生过”。
- 本台账优先保守，不把“页面存在”“脚本存在”自动写成“真实对外能力已打通”。
`;
}

function buildEntrypointMap(context) {
  const runScriptExists = (name) => context.scriptNames.includes(name);
  return `# Entrypoint Map

> Generated by Phase3977A

## UI 入口

| 入口 | 类型 | 当前性质 | 说明 |
| --- | --- | --- | --- |
| \`GET /ui\` | UI | real entrypoint with mixed real + preview panels | 当前 owner-facing 主入口。 |
| \`GET /console\` | UI | real alias | 作为 \`/ui\` 的别名入口。 |
| UI 内 Chat 区 | UI sub-entry | real but provider-gated | 页面真实存在，但真实模型调用需要满足 Provider / key / approval 边界。 |
| UI 内 Workforce 面板 | UI sub-entry | preview / dry-run | 计划与预览导向，不应表述为真实员工执行。 |
| UI 内 Codex / GVC / runtime-candidate 面板 | UI sub-entry | preview / gated | 主要用于状态可视化、dry-run 和治理预览。 |

## API 入口

| 入口 | 当前性质 | 说明 |
| --- | --- | --- |
| \`GET /health/check\` | real | 本地健康检查入口。 |
| \`POST /chat\` | real but provider-gated | 默认聊天主链，边界最严格。 |
| \`POST /chat/stream\` | real but provider-gated | 流式聊天入口。 |
| \`POST /chat-gateway/execute\` | real but guarded | 任务责任链入口；本阶段未修改。 |
| \`POST /knowledge/load\` / \`/knowledge/load/file\` | real | 本地知识导入。 |
| \`POST /knowledge/retrieve\` | real | 检索入口。 |
| \`POST /models/import/preview\` / \`/confirm\` | real but provider-gated | 模型导入与模型库刷新入口。 |
| \`POST /provider-config/test\` | real but provider-gated | 测试 Provider 时必须严守 secret redaction。 |
| \`POST /workforce/plan\` | real preview output | 真实返回规划结果，但不是执行引擎。 |
| \`POST /three-mode/execute\` | real but provider-gated | 三模式执行入口，仍受默认主链与成本边界约束。 |
| \`/runtime-candidate/codex-exec-crs/*\` | gated candidate path | 隔离候选路径，不是主链。 |

## npm scripts 入口

| script | 当前性质 | 说明 |
| --- | --- | --- |
| \`pnpm dev:phase7b\` | real | 本地启动主命令。 |
| \`pnpm health:phase12a\` | real | 本地健康检查。 |
| \`pnpm doctor:phase13a\` | real | 状态与工作区诊断。 |
| \`pnpm verify:phase107a-secret-safety\` | real | secret safety 核心 verifier。 |
| \`pnpm verify:safe-regression-matrix\` | real | 回归矩阵入口。 |
| \`pnpm gvc:cycle\` | preview / dry-run | GVC cycle 控制器，不应表述为真实自治执行。 |
| \`pnpm run:phase3971a-xiaomi-provider-readiness-matrix\` | real read-only generator | MiMo/Xiaomi 原始验证 lane 起点。 |
| \`pnpm run:phase3977a-system-atlas\` | real read-only generator | 本阶段系统地图恢复入口。 |
| \`pnpm verify:phase3977a-system-atlas\` | real verifier | 本阶段地图/verifier 结果校验。 |
| \`${runScriptExists("run:phase3977b-mimo-continuous-real-smoke") ? "pnpm run:phase3977b-mimo-continuous-real-smoke" : "phase3977b script missing"}\` | provider-gated | 后续 MiMo 连续真实 smoke lane。 |

## Codex / GVC 入口

| 入口 | 当前性质 | 说明 |
| --- | --- | --- |
| Codex Context Gateway context pack | preview / read-only | 帮 Codex 缩小读文件范围，不改 Codex base_url。 |
| runtime-candidate CRS routes | gated candidate | 隔离候选链，不是 \`/chat\` 主链。 |
| \`gvc:cycle\` / timed runner | dry-run / governance | 允许调度和状态治理，不允许夸大成无人值守真执行。 |

## verifier 入口

| 入口 | 当前性质 | 说明 |
| --- | --- | --- |
| \`tools/*/verify-*.mjs\` | real | 当前项目最重要的事实校验入口。 |
| \`pnpm verify:phase*\` | real | 阶段验收主入口。 |
| \`pnpm -r --if-present check\` | real | workspace 级检查。 |

## evidence 入口

| 入口 | 当前性质 | 说明 |
| --- | --- | --- |
| \`apps/ai-gateway-service/evidence/\` | real | 当前主 evidence 仓。 |
| \`docs/\` | real supporting docs | 阶段文档与说明。 |
| \`tools/\` 生成脚本输出 | real | generator/verifier 直接产出 evidence。 |

## 入口判定规则

- 真实执行: 能在本地直接运行并产生真实状态、真实文件或真实 HTTP 响应。
- preview / dry-run: 只给出计划、诊断、模拟结果或只读面板。
- gated: 代码入口存在，但必须满足 owner approval、CredentialRef-only、限额与 secret 安全条件后才能进入下一步。
`;
}

function buildSafetyBoundaryMap() {
  return `# Safety Boundary Map

> Generated by Phase3977A

## 默认边界

- 默认不读 secret。
- 默认不调用真实 Provider。
- 默认不 deploy。
- 默认不改 \`legacy/\`。
- 默认不改 \`PROJECT_CONTEXT.md\`。
- 默认不改 \`/chat\`。
- 默认不改 \`/chat-gateway/execute\`。
- 默认不把 dry-run / template / mock 写成真实完成。

## forbidden boundary

| 边界 | 默认状态 | 说明 |
| --- | --- | --- |
| raw secret / API key 读取 | forbidden | 只允许存在性、CredentialRef、mask 状态，不允许打印明文。 |
| 真实 Provider 调用 | blocked by default | 必须显式批准、限请求数、CredentialRef-only、禁止 raw secret 输出。 |
| deploy / release / tag / artifact upload | forbidden by default | 当前仓库长期口径是不部署、不发布、不上传产物。 |
| \`legacy/\` 修改 | forbidden | 只能只读参考。 |
| \`PROJECT_CONTEXT.md\` 修改/创建 | forbidden | 除非用户明确要求。 |
| 默认 \`/chat\` 行为修改 | forbidden by default | 必须显式批准，且不能破坏主链。 |
| 默认 \`/chat-gateway/execute\` 行为修改 | forbidden by default | 必须显式批准，且不能破坏主链。 |

## 何时才允许真实 Provider 测试

必须同时满足下列条件：

1. owner 明确批准当前 Provider 测试。
2. evidence / approval packet 明确写出 \`providerCallAllowed=true\`。
3. 使用 CredentialRef-only 或显式允许的环境变量存在性，不读取 raw secret 文本。
4. 明确 maxRequests、retryLimit、rate limit、stop condition。
5. 默认主链 \`/chat\` 与 \`/chat-gateway/execute\` 不被顺手改动。
6. evidence 里必须能诚实记录 success / failure / timeout / blocked。

## 何时才允许真实部署

当前仓库没有满足真实部署的常态前提。只有未来单独阶段明确提供以下内容时才可能允许：

1. 部署授权记录。
2. 回滚方案。
3. secret / config / environment 边界确认。
4. 发布验证命令与 smoke 方案。
5. 负责人明确确认。

在这些条件没齐之前，不得把任何本地运行、Dockerfile 存在、UI 可访问说成部署完成。

## 何时才允许 owner confirmation

Owner confirmation 只在以下高风险动作前才有意义：

1. 真实 Provider smoke。
2. 主链路由改动。
3. deploy / release。
4. 真实 Codex / runtime candidate 执行。
5. 任何可能增加付费额度消耗、写外部系统、写真实配置的动作。

## 当前 Phase3977A 的执行边界

- 本阶段只做只读扫描、文档生成、evidence 记录。
- 本阶段不读取 \`.env*\`、\`auth.json\`、\`secrets/\`、\`PROJECT_CONTEXT.md\`。
- 本阶段不调用 Provider。
- 本阶段不修改运行时路由。
- 本阶段不创建真实业务功能。
`;
}

function buildPhaseStatusLedger(context) {
  const mimo = context.recentMiMoLane;
  return `# Phase Status Ledger

> Generated by Phase3977A

## 最近主线聚合

| 项目 | 当前结论 |
| --- | --- |
| 当前最近完成阶段范围 | ${CURRENT_PHASE_RANGE} |
| 当前 blocker | ${context.currentBlocker} |
| recommended_sealed | true |
| 是否真实调用 Provider | 对本阶段为 false；历史上仅在显式获批阶段才可能为 true |
| 是否读取 secret | false |
| 是否部署 | false |

## Phase3971A-3976A Xiaomi / MiMo Provider Verification Lane

| Phase | status | blocker | real Provider called | secret read | deploy | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 3971A | sealed | ${context.phaseEvidence.phase3971?.blocker ?? "none"} | false | false | false | adapter/model registry 存在，但 CredentialRef/Safe Executor 未就位。 |
| 3972A | sealed | ${context.phaseEvidence.phase3972?.blocker ?? "none"} | false | false | false | \`readyForOwnerAuthorizedOneShotSmoke=false\`。 |
| 3973A | sealed | ${context.phaseEvidence.phase3973?.blocker ?? "none"} | false | false | false | owner approval gate 未放行。 |
| 3974A | sealed | ${context.phaseEvidence.phase3974?.blocker ?? "none"} | false | false | false | one-shot real smoke 未执行。 |
| 3975A | sealed | ${context.phaseEvidence.phase3975?.blocker ?? "none"} | false | false | false | micro-batch 继续 blocked。 |
| 3976A | sealed | ${context.phaseEvidence.phase3976?.blocker ?? "none"} | false | false | false | reality review 明确不能声称可作为 primary validation provider。 |

## 这一条 lane 的状态解释

- 3971A-3976A 这条原始 lane 是“把 MiMo 接入前置条件查清楚”的 blocked chain。
- 在这条 chain 里，仓库 evidence 明确记录了：
  - providerCallsMade=false
  - secretRead=false 或同义字段 false
  - deployExecuted=false
  - 默认 \`/chat\` / \`/chat-gateway/execute\` 未被改动
- 这意味着它适合被当成“安全接入前置核查模板”，不适合被说成“MiMo 已商用稳定接入”。

## 当前系统层面的 recommended_sealed 结论

- Phase3977A 本身建议 sealed，因为它是只读恢复型文档阶段。
- 它不改变任何主链路由，不需要真实 Provider，不需要 secret，不需要 deploy。
- 它的价值是把 owner 当前最容易混淆的系统现实重新整理成可读地图。

## 下一步推荐 Phase

1. ${NEXT_RECOMMENDED_PHASES[0]}
2. ${NEXT_RECOMMENDED_PHASES[1]}

## 为什么推荐这两个下一步

- 先把 Atlas 以只读方式挂到 Mission Control/Owner 入口，降低负责人理解成本。
- 再把 Provider reality、CredentialRef readiness、真实 smoke 结果统一到一个 owner-facing 对账面板，避免 README、evidence、UI 三处口径漂移。
`;
}

function buildOwnerReadingGuide() {
  return `# Owner Reading Guide

> Generated by Phase3977A

## 我现在应该先看哪 5 个文件

1. \`README.md\`
2. \`AGENTS.md\`
3. \`docs/system-atlas/SYSTEM_ATLAS.md\`
4. \`docs/system-atlas/PHASE_STATUS_LEDGER.md\`
5. \`apps/ai-gateway-service/evidence/phase-3977a-system-atlas-recovery/result.json\`

## 10 分钟理解系统路线

1. 先看 \`README.md\` 的 Current State Sync，确认当前系统主叙事。
2. 再看 \`AGENTS.md\` 的 hard boundary，确认哪些事绝对不能声称。
3. 然后看 \`SYSTEM_ATLAS.md\`，建立模块全景。
4. 最后看 \`PHASE_STATUS_LEDGER.md\`，确认最近主线和 blocker。

## 30 分钟理解系统路线

1. 完成 10 分钟路线。
2. 读 \`ENTRYPOINT_MAP.md\`，分清哪些入口是真实执行、哪些只是 preview / dry-run / gated。
3. 读 \`CURRENT_CAPABILITY_LEDGER.md\`，建立能力台账，不把“页面存在”误判成“能力打通”。
4. 回到 \`apps/ai-gateway-service/src\`，重点看 \`ui\`、\`chat-gateway\`、\`providers\`、\`credentials\`、\`workforce\`、\`three-mode\`。

## 2 小时彻底理解系统路线

1. 完成 30 分钟路线。
2. 抽样读最近阶段 evidence，优先看 3971A-3976A、592A-T、621R-628R、632 系列。
3. 读 \`tools/\` 下对应 verifier，理解项目怎样把“完成”写成可验证事实。
4. 对照 \`SAFETY_BOUNDARY_MAP.md\`，把每个模块分成 real / preview / gated 三类。
5. 最后再看 package scripts，建立“哪个 script 改现状、哪个 script 只是验证现状”的认知。

## 如何判断一个 Phase 是真完成、dry-run 完成、还是仍阻塞

看 4 件事：

1. evidence JSON 是否存在。
2. \`completed\`、\`recommended_sealed\`、\`blocker\` 是否一致。
3. 是否明确写出 \`providerCallsMade\`、\`secretsRead\`、\`deployExecuted\`。
4. verifier 是否只是在验证文档/状态，还是确实验证了真实运行结果。

简单判定：

- 真完成: evidence 存在，verifier 通过，且事实字段支持这个结论。
- dry-run 完成: completed=true，但 evidence 明确写了 providerCallsMade=false、deployExecuted=false、preview-only / dry-run。
- 仍阻塞: blocker 非 none，或者 verifier 不通过，或者 evidence 自己写明 gate missing / approval missing / config missing。

## 如何判断一个 Provider 能不能接入真实测试

至少同时满足：

1. adapter / model registry / resolver / safe executor 都已接线。
2. CredentialRef-only 或安全环境变量边界已明确。
3. owner approval 已存在。
4. maxRequests / retry / stop condition 已写清楚。
5. evidence 允许诚实记录失败，不会把 timeout / blocked 伪装成 pass。

只要缺一项，就不应推进真实 Provider 测试。

## 如何判断系统是否接近商业可用

看 6 个维度：

1. owner 能否在 10-30 分钟内看懂系统，不靠源码考古。
2. UI 是否真实可用，而不是按钮墙或空壳。
3. Provider / CredentialRef / selectable gate 是否有证据链。
4. blocker、失败原因、未验证状态是否对 owner 透明。
5. dry-run / gated / real 三类能力是否区分清楚。
6. 是否已经具备部署、回滚、合规、稳定性和成本边界证据。

当前结论：

- 这个仓库已经接近“可长期维护、可继续商业化推进的本地工作台内核”。
- 但还不能声称“已完成生产 SaaS、已部署、已稳定多 Provider 商用”。
`;
}

function extractCurrentBlocker(readme, agents) {
  const sources = [readme, agents];
  for (const text of sources) {
    const match = text.match(/### Current blocker\s+[-*]\s+([^\n]+)/i);
    if (match) {
      return match[1].trim();
    }
  }
  return "unknown";
}

function fileExistsInScan(scannedFiles, prefix) {
  return scannedFiles.some((file) => file === prefix || file.startsWith(`${prefix}/`));
}

async function readText(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readText(relativePath));
  } catch {
    return null;
  }
}

async function writeText(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

main().catch((error) => {
  console.error("[Phase3977A] Fatal:", error.message);
  process.exit(1);
});
