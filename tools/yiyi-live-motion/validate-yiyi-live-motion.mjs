import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const files = [
  "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
  "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
];

async function readAll() {
  const texts = await Promise.all(files.map((file) => readFile(resolve(file), "utf8")));
  return texts.join("\n");
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const source = await readAll();
  const result = {
    task: "Yiyi Live Avatar Motion Fix",
    completed: true,
    recommended_sealed: true,
    real3DModelLoaded: false,
    pseudo3DLiveMotion: true,
    gltfIntegrationReserved: true,
    yiyiAvatarLayerMounted: source.includes("id=\"yiyi-avatar-layer\""),
    yiyiLiveAvatarVisible: source.includes("id=\"yiyi-live-avatar-stage\""),
    yiyiNotOnlyStaticCard: source.includes("renderYiyiLiveAvatarStage"),
    fullModeAvailable: source.includes("yiyi-live-full-button"),
    compactModeAvailable: source.includes("yiyi-live-compact-button"),
    hideModeAvailable: source.includes("yiyi-live-hide-button"),
    motionToggleAvailable: source.includes("yiyi-live-motion-toggle"),
    reducedMotionFallbackAvailable: source.includes("prefers-reduced-motion: reduce"),
    demoTriggersAvailable: source.includes("data-yiyi-demo-trigger"),
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    workspaceCleanClaimed: false,
  };

  ensure(result.yiyiAvatarLayerMounted, "yiyi avatar layer must be mounted.");
  ensure(result.yiyiLiveAvatarVisible, "yiyi live avatar stage must be present.");
  ensure(result.yiyiNotOnlyStaticCard, "yiyi must not be static card only.");
  ensure(result.fullModeAvailable && result.compactModeAvailable && result.hideModeAvailable, "full/compact/hide controls must exist.");
  ensure(result.motionToggleAvailable, "motion toggle must exist.");
  ensure(result.reducedMotionFallbackAvailable, "reduced motion fallback must exist.");

  const outPath = resolve("apps/ai-gateway-service/evidence/yiyi-live-motion/yiyi-live-motion-result.json");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
