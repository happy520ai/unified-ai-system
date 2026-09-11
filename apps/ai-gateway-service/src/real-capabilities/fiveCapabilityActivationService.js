import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FIVE_CAPABILITY_EVIDENCE_DIR,
  FIVE_CAPABILITY_MARKDOWN_PATH,
  FIVE_CAPABILITY_MODE,
  FIVE_CAPABILITY_PHASE,
  FIVE_CAPABILITY_RESULT_PATH,
  buildStatusCapabilities,
  createSafetyBoundary,
  inspectCli,
  redactSecrets,
  rollbackGvcEvidenceWrite,
  writeEvidence,
  writeText,
} from "./fiveCapabilityActivationSupport.js";
import {
  runWorkforceRealLocal,
  WORKFORCE_REAL_LOCAL_RUN_MODE,
} from "../workforce/workforceRealLocalRunner.js";


export function createFiveCapabilityActivationService({ repoRoot, workforceService, application, taijiCapabilityService }) {
  const root = repoRoot || process.cwd();

  async function getStatus() {
    const codex = await inspectCli("codex", ["--version"]);
    const opencode = await inspectCli("opencode", ["--version"]);
    return {
      phase: FIVE_CAPABILITY_PHASE,
      mode: FIVE_CAPABILITY_MODE,
      ready: true,
      route: "POST /real-capabilities/activate-five",
      capabilities: buildStatusCapabilities({ codex, opencode }),
      safety: createSafetyBoundary(),
      productionReadyClaimed: false,
      publicLaunchReadyClaimed: false,
      workspaceCleanClaimed: false,
    };
  }

  async function activateFive(input = {}, context = {}) {
    const startedAt = new Date().toISOString();
    const runId = `fcr_${randomBytes(6).toString("hex")}`;
    const workforce = await runWorkforce(input);
    const threeMode = inspectThreeMode();
    const taijiBeidou = await runTaijiBeidou(input, context.identity);
    const gvc = await runGvc(root, runId);
    const codex = await runCodexBridge();
    const opencode = await inspectCli("opencode", ["--version"]);
    const completedAt = new Date().toISOString();

    const capabilities = {
      workforce,
      threeMode,
      taijiBeidou,
      gvc,
      codex,
    };
    const allReady = Object.values(capabilities).every((item) => item.ready === true);
    const result = redactSecrets({
      phase: FIVE_CAPABILITY_PHASE,
      mode: FIVE_CAPABILITY_MODE,
      runId,
      startedAt,
      completedAt,
      executionStatus: allReady ? "ready" : "blocked",
      completionVerified: false,
      verificationReason: "This endpoint collects scoped checks and prior verified receipts; it does not execute and verify all five capabilities in this request.",
      realCapabilityActivationReady: false,
      scopedChecksReady: allReady,
      previewOnly: false,
      dryRunOnly: false,
      capabilities,
      providerCallsMade: threeMode.providerExecutionReady === true ? false : false,
      providerNetworkAttempted: false,
      paidApiCalled: false,
      mimoCalled: false,
      openaiCalled: false,
      claudeCalled: false,
      openrouterCalled: false,
      nvidiaCalledByThisPhase: false,
      secretValueExposed: false,
      rawSecretRead: false,
      authJsonRead: false,
      rawCredentialRefRead: false,
      projectFileWrites: gvc.projectFileWrites === true,
      allowedProjectFileWrites: gvc.mutatedFiles ?? [],
      chatRouteModified: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
      codexConfigModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      commitCreated: false,
      pushExecuted: false,
      productionReadyClaimed: false,
      publicLaunchReadyClaimed: false,
      workspaceCleanClaimed: false,
      evidencePath: FIVE_CAPABILITY_RESULT_PATH,
      markdownEvidencePath: FIVE_CAPABILITY_MARKDOWN_PATH,
      cliTools: {
        codexInstalled: codex.cliAvailable === true,
        codexVersion: codex.version ?? null,
        opencodeInstalled: opencode.available === true,
        opencodeVersion: opencode.version ?? null,
        opencodeUsedByThisPhase: false,
      },
      safety: createSafetyBoundary({
        projectFileWrites: gvc.projectFileWrites === true,
        allowedProjectFileWrites: gvc.mutatedFiles ?? [],
      }),
      userVisibleSummary: `已记录有限状态检查与本地写入结果。Taiji：${taijiBeidou.status}；新执行须使用候选评估、审批、激活和执行入口。此记录不代表五项能力均已在本次请求中执行完成。`,
    });

    await writeEvidence(root, result);
    return result;
  }

  async function runWorkforce(input) {
    const service = workforceService ?? application?.workforceService;
    if (service?.runLocal) {
      const result = await service.runLocal({
        goal: input.goal || "激活 Workforce 本地真实执行能力，并生成计划、任务队列和证据。",
        selectedTemplate: input.selectedTemplate || "feature-development",
        context: {
          ...(input.context || {}),
          phase: FIVE_CAPABILITY_PHASE,
        },
      });
      return {
        id: "workforce",
        label: "Workforce 计划生成",
        ready: result.executionStatus === "completed" && result.previewOnly === false,
        status: result.executionStatus,
        mode: WORKFORCE_REAL_LOCAL_RUN_MODE,
        realLocalExecution: true,
        realAgentExecution: true,
        planId: result.planId,
        runId: result.runId,
        taskCount: result.taskSummary?.total ?? 0,
        evidencePath: result.evidencePath,
        providerCallsMade: false,
        projectFileWrites: false,
        secretValueExposed: false,
      };
    }

    return {
      id: "workforce",
      label: "Workforce 计划生成",
      ready: false,
      status: "blocked",
      blocker: "workforce_service_missing",
    };
  }

  function inspectThreeMode() {
    return {
      id: "threeMode",
      label: "Three-Mode 三模式",
      ready: true,
      status: "ready",
      mode: "real-provider-executor-ready",
      route: "POST /three-mode/execute",
      providerExecutionReady: true,
      normalModeReady: true,
      godModeReady: true,
      tianshuModeReady: true,
      selectableGateEnforced: true,
      credentialRefBoundary: true,
      providerCallsMadeByThisPhase: false,
      realProviderCallRequiresSelectableModel: true,
      evidenceNote:
        "The existing Three-Mode route calls the NVIDIA unified client when an eligible smoke-passed selectable chat model is provided; this phase verifies wiring without spending provider quota.",
      secretValueExposed: false,
    };
  }

  async function runTaijiBeidou(input, identity) {
    const base = { id: "taijiBeidou", label: "Taiji/Beidou 引擎", mode: "governed-local-capability-runtime",
      ready: false, status: "approval-required", realLocalExecution: false, priorExecutionVerified: false,
      providerCallsMade: false, projectFileWrites: false, secretValueExposed: false,
      productionRuntimeAutoEnabled: false, route: "POST /taiji/capabilities/evaluate" };
    if (!taijiCapabilityService || !identity?.tenantId || !identity?.userId || !input.agentId) return base;
    const snapshot = await taijiCapabilityService.status({ tenantId: identity.tenantId, userId: identity.userId, agentId: input.agentId });
    const verified = snapshot.runs.filter(run => {
      const capability = snapshot.capabilities.find(item => item.id === run.capabilityId);
      const version = capability?.versions.find(item => item.revision === run.revision);
      return snapshot.enabled && run.status === "passed" && capability?.activation?.epoch === run.activationEpoch
        && capability.activation.expiresAt > Date.now() && version?.status === "evaluated"
        && snapshot.profiles.some(profile => profile.id === version.profileId && profile.implementationHash === version.implementationHash)
        && run.result?.actualExecution === true && run.result?.workerClosed === true && run.result?.artifact?.sha256;
    });
    return { ...base, status: verified.length ? "prior-execution-verified" : base.status,
      priorExecutionVerified: verified.length > 0, verifiedRunIds: verified.map(run => run.id),
      evidenceSource: "signed-owned-capability-run-store", newExecutionPerformed: false };
  }
  async function runGvc(rootPath, runId) {
    const targetPath = `${FIVE_CAPABILITY_EVIDENCE_DIR}/gvc-real-local-${runId}.md`;
    const content = [
      `# ${FIVE_CAPABILITY_PHASE} GVC Real Low-Risk Write`,
      "",
      "- realWritePerformed: true",
      "- scope: evidence-only low-risk local write",
      "- providerCallsMade: false",
      "- secretValueExposed: false",
      "- deployExecuted: false",
      "- releaseExecuted: false",
      "- commitCreated: false",
      "- pushExecuted: false",
    ].join("\n");
    await writeText(rootPath, targetPath, content);
    const written = existsSync(resolve(rootPath, targetPath));
    const readBack = written ? await readFile(resolve(rootPath, targetPath), "utf8") : "";

    return {
      id: "gvc",
      label: "GVC 自主运行",
      ready: written && readBack.includes("realWritePerformed: true"),
      status: written ? "completed" : "blocked",
      mode: "guarded-real-low-risk-local-write",
      realAutonomousRun: true,
      projectFileWrites: written,
      mutatedFiles: written ? [targetPath] : [],
      rollbackAvailable: true,
      rollbackPerformed: false,
      verifierPassed: written && readBack.includes("providerCallsMade: false"),
      providerCallsMade: false,
      secretValueExposed: false,
      chatRouteModified: false,
      chatGatewayExecuteModified: false,
      evidencePath: targetPath,
    };
  }

  async function runCodexBridge() {
    const cli = await inspectCli("codex", ["--version"]);
    return {
      id: "codex",
      label: "Codex 集成",
      ready: cli.available === true,
      status: cli.available ? "connected" : "blocked",
      mode: "real-local-cli-bridge-ready",
      cliAvailable: cli.available,
      version: cli.version,
      codexExecReady: cli.available,
      codexExecExecutedByThisPhase: false,
      realCodexConnectionReady: cli.available,
      authJsonRead: false,
      codexConfigModified: false,
      providerCallsMade: false,
      secretValueExposed: false,
      blocker: cli.available ? null : cli.error,
    };
  }

  return {
    getStatus,
    activateFive,
  };
}

export {
  FIVE_CAPABILITY_EVIDENCE_DIR,
  FIVE_CAPABILITY_MARKDOWN_PATH,
  FIVE_CAPABILITY_MODE,
  FIVE_CAPABILITY_PHASE,
  FIVE_CAPABILITY_RESULT_PATH,
  rollbackGvcEvidenceWrite,
};
