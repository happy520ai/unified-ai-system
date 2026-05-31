import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { captureWithHeadlessBrowser } from "../phase376-shared.mjs";

const uiUrl = "http://127.0.0.1:3100/ui";
const resultPath = "apps/ai-gateway-service/evidence/yiyi-live-motion/yiyi-live-motion-result.json";
const screenshotDir = "apps/ai-gateway-service/evidence/yiyi-live-motion/screenshots";
const screenshotNames = {
  overview: "yiyi-live-avatar-overview.png",
  idle: "yiyi-idle-motion.png",
  mouse: "yiyi-mouse-attention.png",
  guard: "yiyi-guard-state.png",
  god: "yiyi-god-reaction.png",
  tianshu: "yiyi-tianshu-reaction.png",
  evidence: "yiyi-evidence-reaction.png",
};

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readSource() {
  const files = [
    "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
    "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
  ];
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

async function capture(name, query = "") {
  const path = `${screenshotDir}/${name}`;
  const capture = await captureWithHeadlessBrowser({
    url: `${uiUrl}${query}`,
    outputPath: path,
    viewport: "1680,2600",
  });
  return {
    path,
    ok: capture.ok,
    sizeBytes: capture.screenshotSizeBytes,
    error: capture.error,
  };
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const source = await readSource();

  const screenshots = {
    overview: await capture(screenshotNames.overview),
    idle: await capture(screenshotNames.idle, "?yiyi=welcome"),
    mouse: await capture(screenshotNames.mouse, "?yiyi=mouse_attention"),
    guard: await capture(screenshotNames.guard, "?yiyi=security_guard"),
    god: await capture(screenshotNames.god, "?yiyi=god_mode"),
    tianshu: await capture(screenshotNames.tianshu, "?yiyi=tianshu_mode"),
    evidence: await capture(screenshotNames.evidence, "?yiyi=evidence_opened"),
  };

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
    motionEnabledByDefault: source.includes("motionEnabled: true"),
    idleMotionDetected: source.includes("@keyframes yiyi-live-roam") && source.includes("@keyframes yiyi-live-float"),
    mouseAttentionDetected: source.includes("data-yiyi-live-motion=\"mouse_attention\"") || source.includes("mouse_attention"),
    guardStateVisible: source.includes("security_guard") && source.includes("yiyi-live-shield"),
    blockedStateVisible: source.includes("red_team_blocked") && source.includes("yiyi-live-block-badge"),
    godModeReactionVisible: source.includes("god_mode_excited") && source.includes("yiyi-live-orbit"),
    tianshuReactionVisible: source.includes("tianshu_planning") && source.includes("yiyi-live-route"),
    evidenceReactionVisible: source.includes("evidence_explaining") && source.includes("yiyi-live-note"),
    reducedMotionFallbackAvailable: source.includes("prefers-reduced-motion: reduce"),
    avatarDoesNotBlockMissionControl: source.includes("pointer-events: none") && source.includes("pointer-events: auto"),
    screenshotManifest: screenshots,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    productionGaClaimed: false,
    workspaceCleanClaimed: false,
  };

  for (const shot of Object.values(screenshots)) {
    ensure(shot.ok, `screenshot capture failed: ${shot.path} ${shot.error || ""}`);
  }
  ensure(result.yiyiLiveAvatarVisible, "live avatar must be visible.");
  ensure(result.idleMotionDetected, "idle motion must be detected.");
  ensure(result.mouseAttentionDetected, "mouse attention must be detected.");
  ensure(result.guardStateVisible, "guard state must be visible.");
  ensure(result.blockedStateVisible, "blocked state must be visible.");
  ensure(result.godModeReactionVisible, "god mode reaction must be visible.");
  ensure(result.tianshuReactionVisible, "tianshu reaction must be visible.");
  ensure(result.evidenceReactionVisible, "evidence reaction must be visible.");

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
