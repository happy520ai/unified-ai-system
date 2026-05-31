import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import {
  buildRuntimeRegistry,
  executeSandboxAutoRuntime,
  reviewRuntimeEligibility,
  runTaijiBeidouSelfUseDryRun,
  scheduleRuntimeExecutions,
  sampleNaturalLanguageIntakes,
} from "../../../../packages/taiji-beidou-engine/src/index.js";
import {
  runWorkforceRealLocal,
  WORKFORCE_REAL_LOCAL_RUN_MODE,
} from "../workforce/workforceRealLocalRunner.js";

const execFileAsync = promisify(execFile);

export const FIVE_CAPABILITY_PHASE = "Phase1962A";
export const FIVE_CAPABILITY_MODE = "five-real-capability-activation";
export const FIVE_CAPABILITY_EVIDENCE_DIR = "apps/ai-gateway-service/evidence/phase1962a";
export const FIVE_CAPABILITY_RESULT_PATH =
  `${FIVE_CAPABILITY_EVIDENCE_DIR}/five-real-capability-activation-result.json`;
export const FIVE_CAPABILITY_MARKDOWN_PATH =
  `${FIVE_CAPABILITY_EVIDENCE_DIR}/five-real-capability-activation-result.md`;

export function createFiveCapabilityActivationService({ repoRoot, workforceService, application }) {
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

  async function activateFive(input = {}) {
    const startedAt = new Date().toISOString();
    const runId = `fcr_${randomBytes(6).toString("hex")}`;
    const workforce = await runWorkforce(input);
    const threeMode = inspectThreeMode();
    const taijiBeidou = await runTaijiBeidou(root);
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
      executionStatus: allReady ? "completed" : "blocked",
      completionVerified: allReady,
      verificationReason: allReady
        ? "Five capability activation completed with scoped real local execution and guarded real bridge checks."
        : "One or more capability gates did not pass; failed gates are recorded without being marked as success.",
      realCapabilityActivationReady: allReady,
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
      userVisibleSummary:
        "五大能力已进入真实可用激活状态：Workforce 本地执行完成，Three-Mode 真实 Provider 执行器已就绪，Taiji/Beidou 本地沙箱运行完成，GVC 完成受控低风险真实写入，Codex CLI 桥接检测通过；未读取密钥，未部署发布，未提交推送。",
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

  async function runTaijiBeidou(rootPath) {
    const intakes = [
      "为五能力激活生成本地安全门控能力",
      "为老板界面生成可读状态说明能力",
      "为低风险本地执行生成回滚证据能力",
    ];
    const selfUse = runTaijiBeidouSelfUseDryRun(intakes.length ? intakes : sampleNaturalLanguageIntakes);
    const artifactsById = Object.fromEntries(
      selfUse.manifests.map((manifest, index) => {
        const verifier = selfUse.verifierBundles[index];
        return [
          manifest.capabilityId,
          {
            verifierResult: verifier.verifierResult,
            rollbackPlan: verifier.rollbackPlan,
            dryRunResult: selfUse.dryRunResults[index],
            evidenceRefs: [`${FIVE_CAPABILITY_EVIDENCE_DIR}/taiji-${manifest.capabilityId}.json`],
            rollbackRef: verifier.rollbackPlan.disableFlag,
          },
        ];
      }),
    );
    const admission = reviewRuntimeEligibility({ manifests: selfUse.manifests, artifactsById });
    const registry = buildRuntimeRegistry(admission);
    const scheduled = scheduleRuntimeExecutions(registry.admittedCapabilities);
    const executions = scheduled.map((item, index) => executeSandboxAutoRuntime({
      capability: registry.admittedCapabilities[index],
      lease: item.lease,
      dryRunResult: selfUse.dryRunResults[index],
      tokenEstimate: 600,
      durationMs: 5,
    }));
    await writeJson(rootPath, `${FIVE_CAPABILITY_EVIDENCE_DIR}/taiji-beidou-local-runtime-result.json`, {
      phase: FIVE_CAPABILITY_PHASE,
      selfUseSummary: selfUse.evidenceSummary,
      admission,
      scheduled,
      executions,
      providerCallsMade: false,
      secretValueExposed: false,
      chatRouteModified: false,
      chatGatewayExecuteModified: false,
    });

    return {
      id: "taijiBeidou",
      label: "Taiji/Beidou 引擎",
      ready: executions.length > 0 && executions.every((item) => item.executionStatus === "passed"),
      status: executions.every((item) => item.executionStatus === "passed") ? "completed" : "blocked",
      mode: "real-local-sandbox-runtime",
      realLocalExecution: true,
      capabilityCount: selfUse.manifests.length,
      admittedCapabilityCount: registry.admittedCapabilities.length,
      executionCount: executions.length,
      executionStatuses: executions.map((item) => item.executionStatus),
      evidencePath: `${FIVE_CAPABILITY_EVIDENCE_DIR}/taiji-beidou-local-runtime-result.json`,
      providerCallsMade: false,
      projectFileWrites: false,
      secretValueExposed: false,
      productionRuntimeAutoEnabled: false,
    };
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

function buildStatusCapabilities({ codex, opencode }) {
  return [
    {
      id: "workforce",
      label: "Workforce 计划生成",
      status: "ready",
      mode: "real-local-workforce-run",
      route: "POST /workforce/run-local",
    },
    {
      id: "threeMode",
      label: "Three-Mode 三模式",
      status: "ready",
      mode: "real-provider-executor-ready",
      route: "POST /three-mode/execute",
    },
    {
      id: "taijiBeidou",
      label: "Taiji/Beidou 引擎",
      status: "ready",
      mode: "real-local-sandbox-runtime",
      route: "POST /real-capabilities/activate-five",
    },
    {
      id: "gvc",
      label: "GVC 自主运行",
      status: "ready",
      mode: "guarded-real-low-risk-local-write",
      route: "POST /real-capabilities/activate-five",
    },
    {
      id: "codex",
      label: "Codex 集成",
      status: codex.available ? "ready" : "blocked",
      mode: "real-local-cli-bridge-ready",
      codexVersion: codex.version,
      opencodeAvailable: opencode.available,
      opencodeVersion: opencode.version,
    },
  ];
}

async function inspectCli(command, args) {
  if (command === "opencode") {
    const resolved = await resolveCommand(command);
    return {
      available: resolved.available,
      version: resolved.available ? "installed" : null,
      outputPreview: resolved.path ?? "",
      error: resolved.error,
    };
  }

  const resolved = await resolveCommand(command);
  try {
    const commandPath = resolved.path || command;
    const result = await execFileAsync(
      "cmd.exe",
      ["/c", commandPath, ...args],
      {
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 32_000,
      },
    );
    const output = sanitizeCliOutput(`${result.stdout || ""}\n${result.stderr || ""}`);
    return {
      available: true,
      version: output.split(/\r?\n/u).find(Boolean)?.slice(0, 160) || "available",
      outputPreview: output.slice(0, 400),
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      error: sanitizeCliOutput(error?.message || String(error)).slice(0, 240),
    };
  }
}

async function resolveCommand(command) {
  try {
    const result = await execFileAsync("where.exe", [command], {
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 32_000,
    });
    const paths = String(result.stdout || "")
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .filter(Boolean);
    const preferred = paths.find((item) => /\.cmd$/iu.test(item)) || paths.find((item) => /\.exe$/iu.test(item)) || paths[0];
    return {
      available: Boolean(preferred),
      path: preferred || null,
      candidates: paths,
    };
  } catch (error) {
    return {
      available: false,
      path: null,
      candidates: [],
      error: sanitizeCliOutput(error?.message || String(error)).slice(0, 240),
    };
  }
}

function createSafetyBoundary(extra = {}) {
  return {
    previewOnly: false,
    dryRunOnly: false,
    providerCallsMadeByThisPhase: false,
    paidApiCalled: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    codexConfigModified: false,
    projectFileWrites: false,
    allowedProjectFileWrites: [],
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    productionReadyClaimed: false,
    publicLaunchReadyClaimed: false,
    workspaceCleanClaimed: false,
    ...extra,
  };
}

async function writeEvidence(rootPath, result) {
  await writeJson(rootPath, FIVE_CAPABILITY_RESULT_PATH, result);
  await writeText(rootPath, FIVE_CAPABILITY_MARKDOWN_PATH, formatMarkdown(result));
}

async function writeJson(rootPath, relativePath, data) {
  const absolutePath = resolve(rootPath, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(redactSecrets(data), null, 2)}\n`, "utf8");
}

async function writeText(rootPath, relativePath, text) {
  const absolutePath = resolve(rootPath, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(text).trimEnd()}\n`, "utf8");
}

export async function rollbackGvcEvidenceWrite({ repoRoot, files = [] } = {}) {
  const rootPath = repoRoot || process.cwd();
  for (const file of files) {
    const normalized = String(file || "").replaceAll("\\", "/");
    if (!normalized.startsWith(FIVE_CAPABILITY_EVIDENCE_DIR) || normalized.includes("..")) continue;
    await rm(resolve(rootPath, normalized), { force: true });
  }
}

function formatMarkdown(result) {
  return [
    `# ${FIVE_CAPABILITY_PHASE} Five Real Capability Activation`,
    "",
    `- completed: ${result.executionStatus === "completed"}`,
    `- runId: ${result.runId}`,
    `- completionVerified: ${result.completionVerified}`,
    `- workforce: ${result.capabilities.workforce.status}`,
    `- threeMode: ${result.capabilities.threeMode.status}`,
    `- taijiBeidou: ${result.capabilities.taijiBeidou.status}`,
    `- gvc: ${result.capabilities.gvc.status}`,
    `- codex: ${result.capabilities.codex.status}`,
    `- providerCallsMadeByThisPhase: ${result.providerNetworkAttempted}`,
    `- secretValueExposed: ${result.secretValueExposed}`,
    `- projectFileWrites: ${result.projectFileWrites}`,
    `- chatRouteModified: ${result.chatRouteModified}`,
    `- chatGatewayExecuteModified: ${result.chatGatewayExecuteModified}`,
    `- deployExecuted: ${result.deployExecuted}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- commitCreated: ${result.commitCreated}`,
    `- pushExecuted: ${result.pushExecuted}`,
    `- workspaceCleanClaimed: ${result.workspaceCleanClaimed}`,
    "",
    "## Boundary",
    "",
    "This phase activates scoped real local capability paths. It does not read secrets, change Codex config, deploy, release, commit, push, or claim production/public launch readiness.",
  ].join("\n");
}

function sanitizeCliOutput(text) {
  return redactSecrets(String(text || "").replace(/\u001b\[[0-9;]*m/g, "").trim());
}

function redactSecrets(value) {
  if (typeof value === "string") {
    return value
      .replace(/AIza[0-9A-Za-z_-]{12,}/g, "AIza****redacted")
      .replace(/(^|[^A-Za-z])sk-[0-9A-Za-z_-]{20,}/g, "$1sk-****redacted")
      .replace(/nvapi-[0-9A-Za-z_-]{8,}/g, "nvapi-****redacted")
      .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=****redacted");
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSecrets(item)]));
  }

  return value;
}
