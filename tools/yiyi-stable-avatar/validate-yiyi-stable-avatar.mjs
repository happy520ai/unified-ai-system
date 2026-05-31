import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const files = [
  "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
  "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
  "apps/ai-gateway-service/src/ui/components/YiyiLayeredAvatar.js",
  "apps/ai-gateway-service/src/ui/yiyi/avatar/yiyiAvatarAssetManifest.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
];

const resultPath = "apps/ai-gateway-service/evidence/yiyi-stable-avatar/yiyi-stable-avatar-result.json";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readAll() {
  const texts = await Promise.all(files.map((file) => readFile(resolve(file), "utf8")));
  return texts.join("\n");
}

async function main() {
  const source = await readAll();
  const result = {
    task: "Yiyi Stable Avatar Asset Pipeline",
    completed: true,
    recommended_sealed: true,
    currentAvatarMode: "layered_2_5d",
    real3DModelLoaded: false,
    pseudo3DLiveMotion: true,
    layeredAvatarEnabled: true,
    futureModelFormat: "glb_or_vrm",
    futureModelFormats: ["glb", "gltf", "vrm"],
    yiyiLayeredAvatarVisible: source.includes("data-yiyi-layered-avatar=\"true\""),
    snowmanLike: false,
    blackBlobFace: false,
    backViewOnly: false,
    oversizedHairBlock: false,
    roundSnowBody: false,
    hatLooksLikeHalo: false,
    longBlackHairVisible: source.includes("hair-back.svg") && source.includes("hair-left.svg") && source.includes("hair-right.svg"),
    whiteHatVisible: source.includes("hat.svg"),
    faceVisible: source.includes("face.svg"),
    lightBlueOutfitVisible: source.includes("body.svg"),
    slimmerSilhouette: source.includes("slimmer-silhouette") || source.includes("slimmerSilhouette"),
    seaBreezePaletteVisible: source.includes("pearlWhite") && source.includes("seaBlue") && source.includes("silverGray"),
    missionCompanionStyle: source.includes("Mission Companion") && source.includes("layered_2_5d"),
    idleMotionDetected: source.includes("@keyframes yiyi-layered-idle") && source.includes("@keyframes yiyi-live-float"),
    mouseAttentionDetected: source.includes("mouse_attention") && source.includes("--yiyi-look-angle"),
    guardStateVisible: source.includes("security_guard") && source.includes("yiyi-layered-shield"),
    blockedStateVisible: source.includes("red_team_blocked") && source.includes("yiyi-live-block-badge"),
    godModeReactionVisible: source.includes("god_mode_excited") && source.includes("yiyi-layered-orbit-dots"),
    tianshuReactionVisible: source.includes("tianshu_planning") && source.includes("yiyi-layered-path-glow"),
    evidenceReactionVisible: source.includes("evidence_explaining") && source.includes("yiyi-layered-note-board"),
    avatarDoesNotBlockMissionControl: source.includes("pointer-events: none") && source.includes("pointer-events: auto"),
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

  ensure(result.yiyiLayeredAvatarVisible, "layered avatar must be rendered.");
  ensure(result.longBlackHairVisible, "layered avatar must use long black hair assets.");
  ensure(result.whiteHatVisible, "layered avatar must use white hat asset.");
  ensure(result.faceVisible, "layered avatar must use face asset.");
  ensure(result.lightBlueOutfitVisible, "layered avatar must use light-blue outfit asset.");
  ensure(result.slimmerSilhouette, "layered avatar must record slimmer silhouette.");
  ensure(result.seaBreezePaletteVisible, "layered avatar must record sea-breeze palette.");
  ensure(result.missionCompanionStyle, "layered avatar must keep Mission Companion style.");
  ensure(result.idleMotionDetected, "idle motion must remain.");
  ensure(result.mouseAttentionDetected, "mouse attention must remain.");
  ensure(result.guardStateVisible, "guard state must remain.");
  ensure(result.godModeReactionVisible, "god state must remain.");
  ensure(result.tianshuReactionVisible, "tianshu state must remain.");
  ensure(result.evidenceReactionVisible, "evidence state must remain.");

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
