import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { writeEvidenceWithRenderer } from "../entrypoints/entrypointUtils.js";

const execFileAsync = promisify(execFile);

export const FIVE_CAPABILITY_PHASE = "Phase1962A";
export const FIVE_CAPABILITY_MODE = "five-real-capability-activation";
export const FIVE_CAPABILITY_EVIDENCE_DIR = "apps/ai-gateway-service/evidence/phase1962a";
export const FIVE_CAPABILITY_RESULT_PATH =
  `${FIVE_CAPABILITY_EVIDENCE_DIR}/five-real-capability-activation-result.json`;
export const FIVE_CAPABILITY_MARKDOWN_PATH =
  `${FIVE_CAPABILITY_EVIDENCE_DIR}/five-real-capability-activation-result.md`;

export function buildStatusCapabilities({ codex, opencode }) {
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

export async function inspectCli(command, args) {
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

export function createSafetyBoundary(extra = {}) {
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

export async function saveEvidence(rootPath, result) {
  const evidenceDir = resolve(rootPath, dirname(FIVE_CAPABILITY_RESULT_PATH));
  const jsonPath = resolve(rootPath, FIVE_CAPABILITY_RESULT_PATH);
  const mdPath = resolve(rootPath, FIVE_CAPABILITY_MARKDOWN_PATH);
  await writeEvidenceWithRenderer(evidenceDir, jsonPath, mdPath, result, formatMarkdown);
}

export async function writeText(rootPath, relativePath, text) {
  const absolutePath = resolve(rootPath, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(text).trimEnd()}\n`, "utf8");
}

export function formatMarkdown(result) {
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

export function sanitizeCliOutput(text) {
  return redactSecrets(String(text || "").replace(/\u001b\[[0-9;]*m/g, "").trim());
}

export function redactSecrets(value) {
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
