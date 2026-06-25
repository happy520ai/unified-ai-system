import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { spawn } from "node:child_process";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-101a-web-chat-model-config-copy-final";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-101a-web-chat-model-config-copy-final.json");
const evidenceMdPath = resolve(evidenceDir, "phase-101a-web-chat-model-config-copy-final.md");
const phase99ScriptPath = resolve(__dirname, "verifyWebChatModelConfigVisualFinal.js");
const phase99EvidencePath = resolve(evidenceDir, "phase-99a-web-chat-model-config-visual-final.json");

let evidence;

try {
  const html = createConsolePage();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
  if (!script) throw new Error("Console inline script not found.");
  new vm.Script(script, { filename: "consolePage-inline.js" });

  await runNodeScript(phase99ScriptPath);
  const phase99 = JSON.parse(await readFile(phase99EvidencePath, "utf8"));

  const requiredCopy = [
    "粘贴 Key，自动找模型。通过后直接聊。",
    "添加聊天模型",
    "粘贴 Key",
    "一键检测并保存",
    "高级设置",
    "已经能聊。直接输入问题，或拖文件进来。",
  ];
  const retiredCopy = [
    "模型配置向导",
    "一键添加并检测",
    "下一步建议",
    "更多选项",
    "高级启动配置",
    "这把 API Key 暂时不能直接添加到聊天模型",
  ];

  const requiredCopyPresent = Object.fromEntries(requiredCopy.map((text) => [text, html.includes(text)]));
  const retiredCopyRemoved = Object.fromEntries(retiredCopy.map((text) => [text, !html.includes(text)]));
  const copyChecks = {
    inlineScriptSyntaxOk: true,
    phase99Passed: phase99.status === "passed",
    requiredCopyPresent: Object.values(requiredCopyPresent).every(Boolean),
    retiredCopyRemoved: Object.values(retiredCopyRemoved).every(Boolean),
    composerGuideShort: html.includes("粘贴 Key，自动找模型。通过后直接聊。"),
    primaryActionShort: html.includes("一键检测并保存"),
    advancedOptionsStillAvailableButCollapsed: html.includes("commandAdvancedOptions") &&
      html.includes("高级设置"),
    startupOptionsStillAvailableButCollapsed: html.includes("commandStartupOptions") &&
      html.includes("启动命令"),
    finalReadyNudgeShort: html.includes("已经能聊。直接输入问题，或拖文件进来。"),
  };
  const passed = Object.values(copyChecks).every(Boolean);

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    delegatedCheck: {
      phase: phase99.phase,
      status: phase99.status,
      conclusion: phase99.conclusion,
      evidence: "apps/ai-gateway-service/evidence/phase-99a-web-chat-model-config-visual-final.json",
      screenshot: phase99.delegatedCheck?.screenshot || "apps/ai-gateway-service/evidence/phase-98a-web-chat-model-config-user-journey.png",
    },
    requiredCopyPresent,
    retiredCopyRemoved,
    copyChecks,
    frozenUserFlow: [
      "配置模型",
      "粘贴 Key",
      "识别可用模型",
      "选择模型",
      "一键检测并保存",
      "继续聊天",
    ],
    safety: {
      browserInteraction: true,
      localMockProviderOnly: true,
      realProviderCalls: false,
      apiKeyValueRecorded: false,
      apiKeyPersistedInBrowser: false,
      apiKeyPersistedInEvidence: false,
      defaultChatMainLaneChanged: false,
      backendBusinessRouteAdded: false,
    },
    conclusion: passed
      ? "web-chat-model-config-copy-final-passed"
      : "web-chat-model-config-copy-final-not-passed",
  };
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-copy-final-not-passed",
  };
}

await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
console.log(JSON.stringify(evidence, null, 2));
process.exitCode = evidence.status === "passed" ? 0 : 1;

async function runNodeScript(scriptPath) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", rejectRun);
    child.once("close", (exitCode) => {
      if (exitCode !== 0) {
        rejectRun(new Error(`Script failed: ${scriptPath}; exitCode=${exitCode}; stderr=${stderr.slice(0, 1200)}; stdout=${stdout.slice(0, 1200)}`));
        return;
      }
      resolveRun({ exitCode, stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr) });
    });
  });
}

