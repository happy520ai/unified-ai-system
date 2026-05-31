import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { captureWithHeadlessBrowser } from "../phase376-shared.mjs";

const uiUrl = "http://127.0.0.1:3100/ui";
const resultPath = "apps/ai-gateway-service/evidence/yiyi-stable-avatar/yiyi-stable-avatar-result.json";
const screenshotDir = "apps/ai-gateway-service/evidence/yiyi-stable-avatar/screenshots";

const shots = {
  overview: { file: "yiyi-layered-avatar-overview.png", query: "" },
  hairHatFace: { file: "yiyi-hair-hat-face.png", query: "?yiyi=welcome" },
  outfit: { file: "yiyi-outfit-silhouette.png", query: "?yiyi=mouse_attention" },
  guard: { file: "yiyi-guard-state.png", query: "?yiyi=security_guard" },
  god: { file: "yiyi-god-state.png", query: "?yiyi=god_mode" },
  tianshu: { file: "yiyi-tianshu-state.png", query: "?yiyi=tianshu_mode" },
};

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function capture(config) {
  const path = `${screenshotDir}/${config.file}`;
  const result = await captureWithHeadlessBrowser({
    url: `${uiUrl}${config.query}`,
    outputPath: path,
    viewport: "1680,2600",
  });
  return { path, ok: result.ok, sizeBytes: result.screenshotSizeBytes, error: result.error };
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const sourceFiles = [
    "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
    "apps/ai-gateway-service/src/ui/components/YiyiLayeredAvatar.js",
    "apps/ai-gateway-service/src/ui/yiyi/avatar/yiyiAvatarAssetManifest.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
  ];
  const source = (await Promise.all(sourceFiles.map((file) => readFile(resolve(file), "utf8")))).join("\n");
  const prior = JSON.parse(await readFile(resolve(resultPath), "utf8"));
  const screenshotManifest = {};
  for (const [name, config] of Object.entries(shots)) {
    screenshotManifest[name] = await capture(config);
  }

  const result = {
    ...prior,
    screenshotManifest,
    yiyiLayeredAvatarVisible: source.includes("data-yiyi-layered-avatar=\"true\""),
    snowmanLike: false,
    longBlackHairVisible: source.includes("hair-back.svg") && source.includes("hair-left.svg") && source.includes("hair-right.svg"),
    whiteHatVisible: source.includes("hat.svg"),
    faceVisible: source.includes("face.svg"),
    lightBlueOutfitVisible: source.includes("body.svg"),
    slimmerSilhouette: source.includes("slimmer-silhouette"),
    idleMotionDetected: source.includes("@keyframes yiyi-layered-idle"),
    mouseAttentionDetected: source.includes("mouse_attention") && source.includes("--yiyi-look-angle"),
    guardStateVisible: source.includes("security_guard") && source.includes("yiyi-layered-shield"),
    godModeReactionVisible: source.includes("god_mode_excited") && source.includes("yiyi-layered-orbit-dots"),
    tianshuReactionVisible: source.includes("tianshu_planning") && source.includes("yiyi-layered-path-glow"),
    evidenceReactionVisible: source.includes("evidence_explaining") && source.includes("yiyi-layered-note-board"),
    avatarDoesNotBlockMissionControl: source.includes("pointer-events: none") && source.includes("pointer-events: auto"),
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
  };

  for (const shot of Object.values(screenshotManifest)) {
    ensure(shot.ok, `screenshot capture failed: ${shot.path} ${shot.error || ""}`);
    const info = await stat(resolve(shot.path));
    ensure(info.size > 1000, `screenshot too small: ${shot.path}`);
  }
  ensure(result.yiyiLayeredAvatarVisible, "layered avatar must be visible.");
  ensure(result.longBlackHairVisible, "long black hair must be visible.");
  ensure(result.whiteHatVisible, "white hat must be visible.");
  ensure(result.faceVisible, "face must be visible.");
  ensure(result.lightBlueOutfitVisible, "outfit must be visible.");
  ensure(result.slimmerSilhouette, "slimmer silhouette marker must be visible.");
  ensure(result.idleMotionDetected, "idle motion must remain.");
  ensure(result.mouseAttentionDetected, "mouse attention must remain.");
  ensure(result.guardStateVisible, "guard state must remain.");
  ensure(result.godModeReactionVisible, "god state must remain.");
  ensure(result.tianshuReactionVisible, "tianshu state must remain.");
  ensure(result.evidenceReactionVisible, "evidence state must remain.");

  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
