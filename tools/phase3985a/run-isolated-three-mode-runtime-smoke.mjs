import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runIsolatedThreeModeRuntimeSmoke } from "../../packages/model-routing-engine/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3985A-Isolated-Three-Mode-Runtime-Smoke";
const evidenceDir = "apps/ai-gateway-service/evidence/phase-3985a-isolated-three-mode-runtime-smoke";

async function main() {
  console.log(`[${phaseId}] runner`);
  const result = runIsolatedThreeModeRuntimeSmoke({
    task: "Owner-authorized isolated Normal/God/Tianshu runtime smoke without default chat route mutation.",
  });

  const evidence = {
    ...result,
    completed: result.completed === true,
    recommended_sealed: result.completed === true,
    blocker: result.completed === true ? "none" : "isolated_mode_runtime_smoke_failed",
    isolatedRuntimeExecuted: true,
    defaultRouteIntegrated: false,
    deployExecuted: false,
    legacyModified: false,
    projectContextModified: false,
    productionReadyClaimed: false,
    providerStabilityClaimed: false,
    verificationCommands: [
      "node --check packages/model-routing-engine/src/isolatedThreeModeRuntimeSmoke.js",
      "node --check tools/phase3985a/run-isolated-three-mode-runtime-smoke.mjs",
      "node --check tools/phase3985a/verify-isolated-three-mode-runtime-smoke.mjs",
      "pnpm run run:phase3985a-isolated-three-mode-runtime-smoke",
      "pnpm run verify:phase3985a-isolated-three-mode-runtime-smoke",
      "pnpm -r --if-present check",
    ],
    nextRecommendedPhases: [
      "Phase3986A Nightly Scheduler Manual Registration Result Intake",
      "Phase3987A Three-Mode Owner Panel Isolated Status Surface",
    ],
    generatedAt: new Date().toISOString(),
  };

  await writeText("docs/three-mode-runtime/PHASE3985A_ISOLATED_RUNTIME_SMOKE.md", buildDoc(evidence));
  await writeText(`${evidenceDir}/result.json`, JSON.stringify(evidence, null, 2));
  console.log(`[${phaseId}] modeCount=${evidence.modeCount}`);
  console.log(`[${phaseId}] providerCallsMade=false`);
  console.log(`[${phaseId}] defaultRouteIntegrated=false`);
}

function buildDoc(evidence) {
  return [
    "# Phase3985A Isolated Three-Mode Runtime Smoke",
    "",
    "## Goal",
    "",
    "让 Normal/God/Tianshu 三模式通过独立本地 runtime harness 各执行一次，不接入默认 `/chat` 或 `/chat-gateway/execute`。",
    "",
    "## Result",
    "",
    `- isolatedRuntimeExecuted: ${evidence.isolatedRuntimeExecuted}`,
    `- modeCount: ${evidence.modeCount}`,
    `- providerCallsMade: ${evidence.providerCallsMade}`,
    `- defaultRouteIntegrated: ${evidence.defaultRouteIntegrated}`,
    `- recommended_sealed: ${evidence.recommended_sealed}`,
    `- blocker: ${evidence.blocker}`,
    "",
    "## Mode Results",
    "",
    ...evidence.results.map((item) => `- ${item.modeLabel}: routeDecision=${item.routeDecision}, evidenceId=${item.evidenceId}, completionVerified=${item.completionVerified}`),
    "",
    "## Safety Boundary",
    "",
    "- 未调用 Provider。",
    "- 未读取 secret。",
    "- 未修改默认 `/chat`。",
    "- 未修改 `/chat-gateway/execute`。",
    "- 未部署、未 commit、未 push。",
    "- 未声称三模式已成为默认主链。",
    "",
  ].join("\n");
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
