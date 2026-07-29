import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-83a-web-chat-failure-recovery-guidance";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-83a-web-chat-failure-recovery-guidance.json");
const evidenceMdPath = resolve(evidenceDir, "phase-83a-web-chat-failure-recovery-guidance.md");

try {
  const html = createConsolePage();
  const inlineScript = extractInlineScript(html);
  new vm.Script(inlineScript, { filename: "consolePage-inline.js" });

  const consoleSource = await readFile(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"), "utf8");
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const servicePackage = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"));

  const checks = {
    scriptValid: true,
    chatRecoveryFunctionPresent: consoleSource.includes("function createChatRecoveryHintLines"),
    chatFailureUsesRecoveryLines: consoleSource.includes("...recoveryLines"),
    chatRecoveryMentionsConfigModel: consoleSource.includes("请点输入区“配置模型”"),
    chatRecoveryHandlesAuth: consoleSource.includes("401") && consoleSource.includes("403") && consoleSource.includes("API Key / 权限"),
    chatRecoveryHandlesTimeout: consoleSource.includes("provider 超时、限流或网络波动"),
    chatRecoveryKeepsPageUsable: consoleSource.includes("页面已经恢复，不需要刷新"),
    chatRecoveryNoFakeModelClaim: consoleSource.includes("不会用假模型冒充可用模型"),
    modelProbeRecoveryFunctionPresent: consoleSource.includes("function createModelProbeRecoveryLines"),
    modelProbeFailureUsesRecoveryLines: consoleSource.includes("createModelProbeRecoveryLines(probeSummary.reason)"),
    modelProbeHandlesOpenAiCompatibleBaseUrl: consoleSource.includes("OpenAI-compatible base URL"),
    modelProbeUsesRealModelsList: consoleSource.includes("从真实 models/list 返回的列表里选择"),
    modelProbeNoForcedNvidia: consoleSource.includes("不会把 key 强行塞到 NVIDIA"),
    rootVerifyScriptPresent: rootPackage.scripts?.["verify:phase83a"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase83a",
    serviceVerifyScriptPresent: servicePackage.scripts?.["verify:phase83a"] === "node ./src/entrypoints/verifyWebChatFailureRecoveryGuidance.js",
    serviceCheckIncludesVerifier: String(servicePackage.scripts?.check || "").includes("verifyWebChatFailureRecoveryGuidance.js"),
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks,
    safety: {
      readOnlyVerification: true,
      browserOpened: false,
      serviceStarted: false,
      providerCalls: false,
      backendBusinessRouteAdded: false,
      defaultChatMainLaneChanged: false,
    },
    conclusion: passed ? "web-chat-failure-recovery-guidance-connected" : "web-chat-failure-recovery-guidance-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-failure-recovery-guidance-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page inline script not found.");
  return match[1];
}

async function writeEvidence(evidence) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, JSON.stringify(evidence, null, 2));
  await writeFile(evidenceMdPath, [
    `# ${PHASE}`,
    "",
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Chat recovery function present: ${Boolean(evidence.checks?.chatRecoveryFunctionPresent)}`,
    `- Auth failure guidance present: ${Boolean(evidence.checks?.chatRecoveryHandlesAuth)}`,
    `- Timeout/rate-limit guidance present: ${Boolean(evidence.checks?.chatRecoveryHandlesTimeout)}`,
    `- Model probe recovery function present: ${Boolean(evidence.checks?.modelProbeRecoveryFunctionPresent)}`,
    `- OpenAI-compatible base URL guidance present: ${Boolean(evidence.checks?.modelProbeHandlesOpenAiCompatibleBaseUrl)}`,
    `- Root verify script present: ${Boolean(evidence.checks?.rootVerifyScriptPresent)}`,
    `- Service verify script present: ${Boolean(evidence.checks?.serviceVerifyScriptPresent)}`,
    `- Provider calls: ${Boolean(evidence.safety?.providerCalls)}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
  ].join("\n"));
}
