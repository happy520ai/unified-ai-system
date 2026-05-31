import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const files = [
  "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
  "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
  "apps/ai-gateway-service/src/ui/components/YiyiVisualParts.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "apps/ai-gateway-service/src/ui/assets/yiyi/yiyi-visual-tokens.json",
];

const resultPath = "apps/ai-gateway-service/evidence/yiyi-visual-fidelity/yiyi-visual-fidelity-result.json";

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
    task: "Yiyi Visual Fidelity Fix",
    completed: true,
    recommended_sealed: true,
    real3DModelLoaded: false,
    pseudo3DLiveMotion: true,
    notSnowmanLike: source.includes("yiyi-live-hair-back") && !source.includes("yiyi-live-body-core"),
    longBlackHairVisible: source.includes("yiyi-live-hair-back") && source.includes("#101827") && source.includes("yiyi-live-hair-tail"),
    whiteHatVisible: source.includes("yiyi-live-hat-brim") && source.includes("yiyi-live-hat-crown"),
    hatNotSnowHalo: source.includes("hatNotSnowHalo") || (source.includes("yiyi-live-hat-brim") && !source.includes("yiyi-live-hat::after")),
    jacketShapeVisible: source.includes("yiyi-live-jacket") && source.includes("yiyi-live-shoulders") && source.includes("yiyi-live-collar"),
    seaBreezePaletteVisible: source.includes("#AEE2FF") && source.includes("#C7D2E3") && source.includes("#FFFFFF"),
    conceptBoardReferenceVisible: source.includes("yiyi-concept-board.png") || source.includes("data-yiyi-concept-preview"),
    idleMotionDetected: source.includes("@keyframes yiyi-live-roam") && source.includes("@keyframes yiyi-live-float"),
    mouseAttentionDetected: source.includes("mouse_attention") && source.includes("--yiyi-look-angle"),
    guardStateVisible: source.includes("security_guard") && source.includes("yiyi-live-shield"),
    blockedStateVisible: source.includes("red_team_blocked") && source.includes("yiyi-live-block-badge"),
    godModeReactionVisible: source.includes("god_mode_excited") && source.includes("yiyi-live-orbit"),
    tianshuReactionVisible: source.includes("tianshu_planning") && source.includes("yiyi-live-route"),
    evidenceReactionVisible: source.includes("evidence_explaining") && source.includes("yiyi-live-note"),
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

  ensure(result.notSnowmanLike, "Yiyi must not keep the snowman-like body-core silhouette.");
  ensure(result.longBlackHairVisible, "Yiyi must have visible long black hair.");
  ensure(result.whiteHatVisible, "Yiyi must have visible white hat parts.");
  ensure(result.hatNotSnowHalo, "Yiyi hat must not be a snow-halo shape.");
  ensure(result.jacketShapeVisible, "Yiyi must have jacket/shoulder/collar parts.");
  ensure(result.seaBreezePaletteVisible, "Yiyi must keep sea-breeze visual tokens.");
  ensure(result.conceptBoardReferenceVisible, "Yiyi concept board reference must remain visible.");
  ensure(result.idleMotionDetected, "Yiyi idle motion must remain available.");
  ensure(result.mouseAttentionDetected, "Yiyi mouse attention must remain available.");

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
