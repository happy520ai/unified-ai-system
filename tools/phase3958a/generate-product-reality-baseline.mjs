import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

const inputs = {
  phase3957:
    "apps/ai-gateway-service/evidence/phase3957a-controlled-mutation-hard-stop/result.json",
  dogfooding:
    "apps/ai-gateway-service/evidence/phase1451-1475-real-local-dogfooding-intake/real-local-dogfooding-intake-result.json",
  credentialSetup:
    "apps/ai-gateway-service/evidence/phase1958p_credentialsetup/phase1958p-credentialsetup-seal-result.json",
  ownerStatus:
    "apps/ai-gateway-service/evidence/owner-facing-status-report/owner-facing-status-report-result.json",
  providerCallImpl:
    "apps/ai-gateway-service/evidence/phase1932p-provider-call-impl/safe-provider-call-implementation-result.json",
};

const docPath = "docs/phase3958a-product-reality-baseline-compression.md";
const resultPath =
  "apps/ai-gateway-service/evidence/phase3958a-product-reality-baseline-compression/result.json";

function fullPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function readJsonIfPresent(relativePath) {
  if (!existsSync(fullPath(relativePath))) return null;
  return JSON.parse(await readFile(fullPath(relativePath), "utf8"));
}

function value(value, fallback = "unknown") {
  return value === undefined || value === null ? fallback : String(value);
}

function bool(value) {
  return value === true ? "true" : "false";
}

function phaseItem({
  phaseName,
  goal,
  whyNow,
  targetFiles,
  verificationCommands,
  rollbackPlan,
  providerCallAllowed = false,
  secretReadAllowed = false,
  deployAllowed = false,
  chatModified = false,
  chatGatewayExecuteModified = false,
}) {
  return [
    `### ${phaseName}`,
    "",
    `- phaseName: ${phaseName}`,
    `- goal: ${goal}`,
    `- whyNow: ${whyNow}`,
    `- targetFiles: ${targetFiles.join(", ")}`,
    `- providerCallAllowed: ${providerCallAllowed}`,
    `- secretReadAllowed: ${secretReadAllowed}`,
    `- deployAllowed: ${deployAllowed}`,
    `- chatModified: ${chatModified}`,
    `- chatGatewayExecuteModified: ${chatGatewayExecuteModified}`,
    `- verificationCommands: ${verificationCommands.join(" ; ")}`,
    `- rollbackPlan: ${rollbackPlan}`,
    "",
  ].join("\n");
}

function buildDoc({ phase3957, dogfooding, credentialSetup, ownerStatus, providerCallImpl }) {
  const nextPhases = [
    phaseItem({
      phaseName: "Phase3959A-ProductRealityOwnerDailyUseLedgerIntake",
      goal: "把 owner daily use 的真实记录入口从模板状态压缩成可填写、可校验、可导入的本地证据闭环。",
      whyNow: "Phase1451-1475 已证明框架存在，但 realOwnerDogfoodingRecordCount=0，商业化前必须先有真实使用记录。",
      targetFiles: [
        "docs/phase3959a-owner-daily-use-ledger-intake.md",
        "tools/phase3959a/verify-owner-daily-use-ledger-intake.mjs",
        "apps/ai-gateway-service/evidence/phase3959a-owner-daily-use-ledger-intake/result.json",
        "package.json",
        "README.md",
        "AGENTS.md",
      ],
      verificationCommands: [
        "node --check tools/phase3959a/verify-owner-daily-use-ledger-intake.mjs",
        "pnpm run verify:phase3959a-owner-daily-use-ledger-intake",
        "pnpm run verify:phase107a-secret-safety",
      ],
      rollbackPlan:
        "删除 tools/phase3959a、docs/phase3959a-owner-daily-use-ledger-intake.md、对应 evidence，并还原 package/managed block。",
    }),
    phaseItem({
      phaseName: "Phase3960A-OwnerHomeDeadButtonAndNavigationRealityAudit",
      goal: "对 owner-facing /ui 首屏、导航、主要按钮做真实可达性审计并输出死按钮清单。",
      whyNow: "当前不能声称全站死按钮扫描完成，Owner Workbench 要先知道哪些入口只是展示、哪些入口可用。",
      targetFiles: [
        "docs/phase3960a-owner-home-dead-button-navigation-audit.md",
        "tools/phase3960a/verify-owner-home-dead-button-navigation-audit.mjs",
        "apps/ai-gateway-service/evidence/phase3960a-owner-home-dead-button-navigation-audit/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3960a/verify-owner-home-dead-button-navigation-audit.mjs",
        "pnpm run verify:phase3960a-owner-home-dead-button-navigation-audit",
      ],
      rollbackPlan: "删除 Phase3960A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3961A-ProviderCredentialRefReadinessRealityCheck",
      goal: "只用 masked / credentialRef 状态压缩 Provider 凭证可用性，不读取明文 secret，不发起 Provider 请求。",
      whyNow: "OpenRouter credentialRef 仍 missing，NVIDIA 安全实现存在但未代表连续稳定商用。",
      targetFiles: [
        "docs/phase3961a-provider-credentialref-readiness-reality-check.md",
        "tools/phase3961a/verify-provider-credentialref-readiness-reality-check.mjs",
        "apps/ai-gateway-service/evidence/phase3961a-provider-credentialref-readiness-reality-check/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3961a/verify-provider-credentialref-readiness-reality-check.mjs",
        "pnpm run verify:phase3961a-provider-credentialref-readiness-reality-check",
        "pnpm run verify:phase107a-secret-safety",
      ],
      rollbackPlan: "删除 Phase3961A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3962A-ChatGatewayEvidenceTruthfulnessAudit",
      goal: "审计 Chat Gateway 相关 evidence 口径，确保 providerCalled、completionVerified、evidenceId、失败原因不会误导用户。",
      whyNow: "产品价值核心在真实执行证据，下一步需要保证 UI/文档不会把 dry-run 或失败说成成功。",
      targetFiles: [
        "docs/phase3962a-chat-gateway-evidence-truthfulness-audit.md",
        "tools/phase3962a/verify-chat-gateway-evidence-truthfulness-audit.mjs",
        "apps/ai-gateway-service/evidence/phase3962a-chat-gateway-evidence-truthfulness-audit/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3962a/verify-chat-gateway-evidence-truthfulness-audit.mjs",
        "pnpm run verify:phase3962a-chat-gateway-evidence-truthfulness-audit",
      ],
      rollbackPlan: "删除 Phase3962A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3963A-OwnerAutomationDryRunToApprovalGapReport",
      goal: "把 Owner Automation 当前 display-only / dry-run 与真实执行所需 approval gate 差距列成可执行修复队列。",
      whyNow: "Phase1889A-1901A 已说明 realRunButtonEnabled=false，必须先区分展示、审批、真实本地动作。",
      targetFiles: [
        "docs/phase3963a-owner-automation-dryrun-to-approval-gap-report.md",
        "tools/phase3963a/verify-owner-automation-dryrun-to-approval-gap-report.mjs",
        "apps/ai-gateway-service/evidence/phase3963a-owner-automation-dryrun-to-approval-gap-report/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3963a/verify-owner-automation-dryrun-to-approval-gap-report.mjs",
        "pnpm run verify:phase3963a-owner-automation-dryrun-to-approval-gap-report",
      ],
      rollbackPlan: "删除 Phase3963A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3964A-WorkbenchProviderConfigUsabilityBaseline",
      goal: "基线化 Provider 配置页面的信息架构、可理解性、错误提示与不可用模型展示规则。",
      whyNow: "多 Provider 商业化前，owner 必须能看懂 key 状态、模型状态、失败原因和不可调用边界。",
      targetFiles: [
        "docs/phase3964a-workbench-provider-config-usability-baseline.md",
        "tools/phase3964a/verify-workbench-provider-config-usability-baseline.mjs",
        "apps/ai-gateway-service/evidence/phase3964a-workbench-provider-config-usability-baseline/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3964a/verify-workbench-provider-config-usability-baseline.mjs",
        "pnpm run verify:phase3964a-workbench-provider-config-usability-baseline",
      ],
      rollbackPlan: "删除 Phase3964A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3965A-RealRollbackDrillDesignNoExecution",
      goal: "设计真实 rollback drill 的输入、步骤、证据和停止条件，但本阶段不执行破坏性回滚。",
      whyNow: "当前不能声称真实 rollback drill 完成，先建立不破坏工作区的演练设计与批准包。",
      targetFiles: [
        "docs/phase3965a-real-rollback-drill-design-no-execution.md",
        "tools/phase3965a/verify-real-rollback-drill-design-no-execution.mjs",
        "apps/ai-gateway-service/evidence/phase3965a-real-rollback-drill-design-no-execution/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3965a/verify-real-rollback-drill-design-no-execution.mjs",
        "pnpm run verify:phase3965a-real-rollback-drill-design-no-execution",
      ],
      rollbackPlan: "删除 Phase3965A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3966A-ProductRealityP0P1RepairQueue",
      goal: "把 P0/P1 blockers 转成一份可排序、可验证、可回滚的 Product Work repair queue。",
      whyNow: "Phase3958A 已压缩真实状态，下一步要把 blocker 从描述转成修复队列，而不是继续写阶段 marker。",
      targetFiles: [
        "docs/phase3966a-product-reality-p0-p1-repair-queue.md",
        "tools/phase3966a/verify-product-reality-p0-p1-repair-queue.mjs",
        "apps/ai-gateway-service/evidence/phase3966a-product-reality-p0-p1-repair-queue/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3966a/verify-product-reality-p0-p1-repair-queue.mjs",
        "pnpm run verify:phase3966a-product-reality-p0-p1-repair-queue",
      ],
      rollbackPlan: "删除 Phase3966A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3967A-OwnerDailyReportRealityCompression",
      goal: "生成一份 owner 可读的每日真实状态报告模板，默认隐藏 phase 噪音，只显示能用、不能用、下一步。",
      whyNow: "长期阶段信息已经过载，owner daily use 需要低认知负担的真实产品状态入口。",
      targetFiles: [
        "docs/phase3967a-owner-daily-report-reality-compression.md",
        "tools/phase3967a/verify-owner-daily-report-reality-compression.mjs",
        "apps/ai-gateway-service/evidence/phase3967a-owner-daily-report-reality-compression/result.json",
        "package.json",
      ],
      verificationCommands: [
        "node --check tools/phase3967a/verify-owner-daily-report-reality-compression.mjs",
        "pnpm run verify:phase3967a-owner-daily-report-reality-compression",
      ],
      rollbackPlan: "删除 Phase3967A 新增 docs/tools/evidence，并还原 package scripts。",
    }),
    phaseItem({
      phaseName: "Phase3968A-SelfEvolutionGovernanceKernelValueGate",
      goal: "为 Self Evolution / GVC / Taiji / Beidou 后续任务建立 Product Work Value Gate，阻止低价值自动扩张。",
      whyNow: "Phase3957A 已停止 file-count 惯性，下一步要把 value gate 变成可验证治理内核。",
      targetFiles: [
        "docs/phase3968a-self-evolution-governance-kernel-value-gate.md",
        "tools/phase3968a/verify-self-evolution-governance-kernel-value-gate.mjs",
        "apps/ai-gateway-service/evidence/phase3968a-self-evolution-governance-kernel-value-gate/result.json",
        "package.json",
        "README.md",
        "AGENTS.md",
      ],
      verificationCommands: [
        "node --check tools/phase3968a/verify-self-evolution-governance-kernel-value-gate.mjs",
        "pnpm run verify:phase3968a-self-evolution-governance-kernel-value-gate",
      ],
      rollbackPlan:
        "删除 Phase3968A 新增 docs/tools/evidence，并还原 package scripts 与 README/AGENTS managed block。",
    }),
  ];

  return [
    "# Phase3958A Product Reality Baseline Compression",
    "",
    "## Scope",
    "",
    "本阶段只压缩 Phase1-Phase3957A 之后的真实产品状态，不开发新功能，不调用 Provider，不读取 secret，不 deploy，不继续扩 controlled mutation 文件数量。",
    "",
    `Phase3957A 前置状态：completed=${bool(phase3957?.completed)}, recommendedSealed=${bool(
      phase3957?.recommendedSealed,
    )}, controlledMutationHardCap=${value(phase3957?.controlledMutationHardCap)}, expansionTo57Allowed=${bool(
      phase3957?.expansionTo57Allowed,
    )}, productWorkRedirectRequired=${bool(phase3957?.productWorkRedirectRequired)}.`,
    "",
    "## A. 已真实具备的能力",
    "",
    "- 项目已经具备 local-first AI Gateway Workbench / Mission Control / evidence-driven 阶段验证骨架，且 README / AGENTS managed block 能记录当前规则边界。",
    "- Phase3896A-3956A 已 sealed/pass，证明 controlled mutation 工程链路在 56 个文件范围内可被计划、应用、回滚审计、验证；但这只证明工程 harness 能跑。",
    "- Phase3957A 已把 controlled mutation expansion 硬停止在 56 files，并要求后续转入 Product Work Mode / Product Reality / Owner Daily Use / Self Evolution Governance。",
    "- Phase1932P 生成了 credentialRef-only 的 safe provider call implementation 证据，`credentialRef:nvidia:default` 可作为实现边界引用；该阶段 realProviderCallExecutedThisPhase=false。",
    "- Phase2015 owner-facing status report 已生成 owner 可读 dry-run 状态报告，显示 GVC 低风险 evidence task 可继续 dry-run。",
    "- Phase1451-1475 已建立真实本地 dogfooding intake 框架、ledger 模板、issue repair loop 与 evidence linkage。",
    "- Phase1958P 已生成 OpenRouter CredentialRef 设置包和 masked readiness checker，可在不暴露 secret 的前提下表达 missing 状态。",
    "",
    "## B. dry-run / mock / template 能力",
    "",
    "- Workforce / GVC / Taiji / Beidou / Codex Context Gateway / runtime candidate / owner automation 等长期链路大量处于 dry-run、preview、template、approval packet、intake、display-only 或 guarded design 状态。",
    "- Owner automation command palette 现有证据表明 registeredActionCount 可展示，但 realRunButtonEnabled=false，不能说已经具备真实桌面执行能力。",
    "- GVC owner-facing status report 的 source 是 dry-runOnly=true，realExecutionPerformed=false。",
    "- Codex / custom provider / runtime candidate 多数阶段证明的是受控命令、dry-run candidate、manual intake 或 isolated preview，不代表主链自动执行能力。",
    "- controlled mutation 56 文件通过不代表产品体验提升，不代表 owner 闭环完成，也不代表 Provider 稳定。",
    "",
    "## C. 未完成真实验证的能力",
    "",
    "- 真实 Provider 连续稳定测试尚未完成；Phase1932P 只生成 safe implementation，providerCallsMade=false。",
    "- 多 Provider 商业可用尚未完成；Phase1958P 显示 OpenRouter credentialRef 仍 missing。",
    "- owner daily use 连续闭环尚未完成；Phase1451-1475 显示 realOwnerDogfoodingRecordCount=0。",
    "- 真实 rollback drill 尚未完成；已有 rollback/emergency disable 边界不能等同于真实演练完成。",
    "- 全站死按钮扫描尚未完成；现有 UI/verifier 不能替代完整 owner journey 按钮审计。",
    "- 真实生产部署尚未完成；本阶段也未 deploy、未 release、未 tag、未 artifact upload。",
    "- 真实桌面动作执行闭环尚未完成；当前 owner automation 仍有 dry-run / approval / display-only 差距。",
    "",
    "## D. 禁止误称的能力",
    "",
    "- 不得声称 production ready。",
    "- 不得声称多 Provider 已稳定商用。",
    "- 不得声称 owner dogfooding 已完成。",
    "- 不得声称 deploy 已完成。",
    "- 不得声称 controlled mutation 提升了产品体验。",
    "- 不得把 dry-run / preview / template / approval packet 写成真实执行。",
    "- 不得把 Provider 未调用、credential missing、manual intake missing 写成 pass。",
    "",
    "## E. P0/P1/P2 blocker",
    "",
    "### P0",
    "",
    "- Provider stability 未形成连续真实 smoke 证据；默认仍不得调用 paid Provider 或绕过 credentialRef。",
    "- secret / credential / auth.json / .env 明文读取仍是硬禁止；后续 Provider readiness 只能用 masked / credentialRef 状态。",
    "- deploy / release / tag / artifact upload 仍未完成且默认禁止，不能声称生产上线。",
    "- `/chat` 与 `/chat-gateway/execute` 主链仍需保持稳定，未授权阶段不得改默认行为。",
    "",
    "### P1",
    "",
    `- Owner dogfooding 缺真实记录：realOwnerDogfoodingRecordCount=${value(
      dogfooding?.realOwnerDogfoodingRecordCount,
    )}, blocker=${value(dogfooding?.blocker)}.`,
    `- OpenRouter credentialRef 尚不可解析：openRouterCredentialRefResolvable=${bool(
      credentialSetup?.openRouterCredentialRefResolvable,
    )}, blocker=${value(credentialSetup?.blocker)}.`,
    "- Owner automation 从 dry-run/display-only 到 approval-gated real action 的差距仍未关闭。",
    "- Chat Gateway 的 evidence truthfulness 需要压测，避免 providerCalled=false 或 completionVerified=false 被 UI 误读为完成。",
    "",
    "### P2",
    "",
    "- Owner-facing UI 需要降低 phase/evidence 噪音，优先显示能用、不能用、下一步。",
    "- Provider 配置页需要更清晰表达 key 状态、模型状态、失败原因和不可调用边界。",
    "- README/AGENTS managed block 信息量极大，需要阶段压缩视图支撑日常使用。",
    "",
    "## F. 下一轮最多 10 个 Product Work Mode 阶段",
    "",
    ...nextPhases,
    "## Evidence Inputs Read",
    "",
    `- Phase3957A hard stop: ${inputs.phase3957}`,
    `- Dogfooding intake: ${inputs.dogfooding}`,
    `- Credential setup: ${inputs.credentialSetup}`,
    `- Owner-facing status report: ${inputs.ownerStatus}`,
    `- Safe provider call implementation: ${inputs.providerCallImpl}`,
    "",
    "## Non-actions",
    "",
    "- providerCallsMade=false",
    "- secretRead=false",
    "- chatModified=false",
    "- chatGatewayExecuteModified=false",
    "- legacyModified=false",
    "- projectContextModified=false",
    "- deployExecuted=false",
    "- workspaceCleanClaimed=false",
    "",
  ].join("\n");
}

export async function generateProductRealityBaseline() {
  const evidence = {
    phase3957: await readJsonIfPresent(inputs.phase3957),
    dogfooding: await readJsonIfPresent(inputs.dogfooding),
    credentialSetup: await readJsonIfPresent(inputs.credentialSetup),
    ownerStatus: await readJsonIfPresent(inputs.ownerStatus),
    providerCallImpl: await readJsonIfPresent(inputs.providerCallImpl),
  };

  if (!evidence.phase3957) {
    throw new Error(`Missing required Phase3957A evidence: ${inputs.phase3957}`);
  }
  if (evidence.phase3957.controlledMutationHardCap !== 56) {
    throw new Error("Phase3957A controlledMutationHardCap must be 56.");
  }
  if (evidence.phase3957.expansionTo57Allowed !== false) {
    throw new Error("Phase3957A expansionTo57Allowed must be false.");
  }

  const doc = buildDoc(evidence);
  await mkdir(dirname(fullPath(docPath)), { recursive: true });
  await writeFile(fullPath(docPath), doc, "utf8");

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    phase: "Phase3958A-ProductRealityBaselineCompression",
    controlledMutationHardCapRespected: true,
    controlledMutationExpansionAttempted: false,
    productRealityBaselineGenerated: true,
    productionReadyClaimed: false,
    providerStabilityClaimed: false,
    ownerDogfoodingClaimedComplete: false,
    deployClaimed: false,
    dryRunMockTemplateClearlySeparated: true,
    maxNextProductWorkPhases: 10,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    workspaceCleanClaimed: false,
    inputEvidence: inputs,
    baselineDocPath: docPath,
    nextProductWorkPhaseNames: [
      "Phase3959A-ProductRealityOwnerDailyUseLedgerIntake",
      "Phase3960A-OwnerHomeDeadButtonAndNavigationRealityAudit",
      "Phase3961A-ProviderCredentialRefReadinessRealityCheck",
      "Phase3962A-ChatGatewayEvidenceTruthfulnessAudit",
      "Phase3963A-OwnerAutomationDryRunToApprovalGapReport",
      "Phase3964A-WorkbenchProviderConfigUsabilityBaseline",
      "Phase3965A-RealRollbackDrillDesignNoExecution",
      "Phase3966A-ProductRealityP0P1RepairQueue",
      "Phase3967A-OwnerDailyReportRealityCompression",
      "Phase3968A-SelfEvolutionGovernanceKernelValueGate",
    ],
  };

  await mkdir(dirname(fullPath(resultPath)), { recursive: true });
  await writeFile(fullPath(resultPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");

  return result;
}

export async function main() {
  const result = await generateProductRealityBaseline();
  console.log(JSON.stringify({
    status: "passed",
    phase: result.phase,
    productRealityBaselineGenerated: result.productRealityBaselineGenerated,
    controlledMutationHardCapRespected: result.controlledMutationHardCapRespected,
    controlledMutationExpansionAttempted: result.controlledMutationExpansionAttempted,
    providerCallsMade: result.providerCallsMade,
    secretRead: result.secretRead,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      status: "failed",
      blocker: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exit(1);
  });
}
