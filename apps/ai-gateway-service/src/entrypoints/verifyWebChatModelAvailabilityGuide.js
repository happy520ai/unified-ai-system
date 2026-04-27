import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-82a-web-chat-model-availability-guide";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-82a-web-chat-model-availability-guide.json");
const evidenceMdPath = resolve(evidenceDir, "phase-82a-web-chat-model-availability-guide.md");

try {
  const html = createConsolePage();
  const inlineScript = extractInlineScript(html);
  new vm.Script(inlineScript, { filename: "consolePage-inline.js" });

  const consoleSource = await readFile(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"), "utf8");
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const servicePackage = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"));

  const checks = {
    modelStatusBarPresent: html.includes("id=\"composer-model-status\""),
    configButtonPresent: html.includes("id=\"composer-model-config-button\""),
    configButtonPhaseMarker: html.includes("data-phase=\"phase82a-model-config-entry\""),
    configButtonLabel: html.includes(">配置模型</button>"),
    configButtonAriaLabel: html.includes("aria-label=\"打开模型配置向导\""),
    availabilityGuidePresent: html.includes("id=\"composer-model-guide\""),
    availabilityGuidePhaseMarker: html.includes("data-phase=\"phase82a-model-availability-guide\""),
    availabilityGuideExplainsAutoModelDetection: html.includes("自动识别可用模型"),
    clickHandlerPresent: consoleSource.includes("composerModelConfigButton?.addEventListener(\"click\", () => openModelConfigFromComposer())"),
    clickUsesLocalCommandCenter: consoleSource.includes("await handleChatCommandCenter(\"配置模型\")"),
    clickDoesNotOverwriteDraft: !consoleSource.includes("input.value = \"配置模型\";"),
    disabledWhileGenerating: consoleSource.includes("composerModelConfigButton.disabled = chatSending"),
    rootVerifyScriptPresent: rootPackage.scripts?.["verify:phase82a"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase82a",
    serviceVerifyScriptPresent: servicePackage.scripts?.["verify:phase82a"] === "node ./src/entrypoints/verifyWebChatModelAvailabilityGuide.js",
    serviceCheckIncludesVerifier: String(servicePackage.scripts?.check || "").includes("verifyWebChatModelAvailabilityGuide.js"),
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
    conclusion: passed ? "web-chat-model-availability-guide-connected" : "web-chat-model-availability-guide-not-connected",
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
    conclusion: "web-chat-model-availability-guide-not-connected",
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
    `- Config button present: ${Boolean(evidence.checks?.configButtonPresent)}`,
    `- Availability guide present: ${Boolean(evidence.checks?.availabilityGuidePresent)}`,
    `- Click opens local model config command: ${Boolean(evidence.checks?.clickUsesLocalCommandCenter)}`,
    `- Draft overwrite avoided: ${Boolean(evidence.checks?.clickDoesNotOverwriteDraft)}`,
    `- Root verify script present: ${Boolean(evidence.checks?.rootVerifyScriptPresent)}`,
    `- Service verify script present: ${Boolean(evidence.checks?.serviceVerifyScriptPresent)}`,
    `- Provider calls: ${Boolean(evidence.safety?.providerCalls)}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
  ].join("\n"));
}
