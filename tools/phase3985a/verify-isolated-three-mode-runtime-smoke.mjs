import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3985A-Isolated-Three-Mode-Runtime-Smoke";
const evidencePath = "apps/ai-gateway-service/evidence/phase-3985a-isolated-three-mode-runtime-smoke/result.json";

async function main() {
  console.log(`[${phaseId}] verifier`);
  const evidence = JSON.parse(await readRequired(evidencePath));
  const doc = await readRequired("docs/three-mode-runtime/PHASE3985A_ISOLATED_RUNTIME_SMOKE.md");
  const source = await readRequired("packages/model-routing-engine/src/isolatedThreeModeRuntimeSmoke.js");
  const index = await readRequired("packages/model-routing-engine/src/index.js");
  const modes = new Set((evidence.results || []).map((item) => item.mode));

  const checks = [
    ["phase id", evidence.phaseId === phaseId],
    ["completed true", evidence.completed === true],
    ["recommended sealed", evidence.recommended_sealed === true],
    ["blocker none", evidence.blocker === "none"],
    ["isolated runtime executed", evidence.isolatedRuntimeExecuted === true],
    ["mode count 3", evidence.modeCount === 3],
    ["normal present", modes.has("normal")],
    ["god present", modes.has("god")],
    ["tianshu present", modes.has("tianshu")],
    ["all completed", evidence.results.every((item) => item.executionStatus === "completed" && item.completionVerified === true)],
    ["all evidence ids", evidence.results.every((item) => typeof item.evidenceId === "string" && item.evidenceId.startsWith("phase3985a:"))],
    ["all route decisions", evidence.results.every((item) => typeof item.routeDecision === "string" && item.routeDecision.length > 0)],
    ["providerCallsMade false", evidence.providerCallsMade === false],
    ["secretRead false", evidence.secretRead === false],
    ["rawSecretPrinted false", evidence.rawSecretPrinted === false],
    ["chat route unchanged", evidence.chatRouteModified === false],
    ["chat gateway unchanged", evidence.chatGatewayExecuteModified === false],
    ["default chat unchanged", evidence.defaultChatBehaviorChanged === false],
    ["default route not integrated", evidence.defaultRouteIntegrated === false],
    ["deploy false", evidence.deployExecuted === false],
    ["legacy false", evidence.legacyModified === false],
    ["project context false", evidence.projectContextModified === false],
    ["no production claim", evidence.productionReadyClaimed === false],
    ["source has harness", source.includes("runIsolatedThreeModeRuntimeSmoke")],
    ["index exports harness", index.includes("runIsolatedThreeModeRuntimeSmoke")],
    ["doc states not default", doc.includes("未声称三模式已成为默认主链")],
  ];

  let failed = false;
  for (const [label, ok] of checks) {
    if (!ok) failed = true;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`);
  }

  if (failed) {
    console.error(`[${phaseId}] FAIL`);
    process.exit(1);
  }

  console.log(`[${phaseId}] PASS`);
}

async function readRequired(relativePath) {
  try {
    return await readFile(resolve(repoRoot, relativePath), "utf8");
  } catch (error) {
    throw new Error(`missing required file ${relativePath}: ${error.message}`);
  }
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
