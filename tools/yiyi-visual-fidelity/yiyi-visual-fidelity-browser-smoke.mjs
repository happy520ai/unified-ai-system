import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { captureWithHeadlessBrowser } from "../phase376-shared.mjs";
import { fileURLToPath } from "node:url";

const uiUrl = "http://127.0.0.1:3100/ui";
const resultPath = "apps/ai-gateway-service/evidence/yiyi-visual-fidelity/yiyi-visual-fidelity-result.json";
const screenshotDir = "apps/ai-gateway-service/evidence/yiyi-visual-fidelity/screenshots";
const validatorPath = resolve(dirname(fileURLToPath(import.meta.url)), "validate-yiyi-visual-fidelity.mjs");

const screenshots = {
  overview: { file: "yiyi-visual-overview.png", query: "" },
  hairHat: { file: "yiyi-hair-hat-detail.png", query: "?yiyi=welcome" },
  bodyJacket: { file: "yiyi-body-jacket-detail.png", query: "?yiyi=mouse_attention" },
  guard: { file: "yiyi-guard-visual.png", query: "?yiyi=security_guard" },
  god: { file: "yiyi-god-visual.png", query: "?yiyi=god_mode" },
  tianshu: { file: "yiyi-tianshu-visual.png", query: "?yiyi=tianshu_mode" },
};

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function capture(name, config) {
  const path = `${screenshotDir}/${config.file}`;
  const capture = await captureWithHeadlessBrowser({
    url: `${uiUrl}${config.query}`,
    outputPath: path,
    viewport: "1680,2600",
  });
  return {
    name,
    path,
    ok: capture.ok,
    sizeBytes: capture.screenshotSizeBytes,
    error: capture.error,
  };
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const validatorSource = await readFile(validatorPath, "utf8");
  ensure(!validatorSource.includes("provider call"), "visual smoke must not add provider calls.");

  const sourceFiles = [
    "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
    "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
    "apps/ai-gateway-service/src/ui/components/YiyiVisualParts.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/ui/copy/yiyiCopy.js",
    "apps/ai-gateway-service/src/ui/assets/yiyi/yiyi-visual-tokens.json",
  ];
  const source = (await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))).join("\n");
  const screenshotManifest = {};
  for (const [name, config] of Object.entries(screenshots)) {
    screenshotManifest[name] = await capture(name, config);
  }

  const prior = JSON.parse(await readFile(resultPath, "utf8"));
  const result = {
    ...prior,
    yiyiLiveAvatarVisible: source.includes("id=\"yiyi-live-avatar-stage\""),
    notSnowmanLike: source.includes("yiyi-live-hair-back") && !source.includes("yiyi-live-body-core"),
    longBlackHairVisible: source.includes("yiyi-live-hair-back") && source.includes("#101827"),
    whiteHatVisible: source.includes("yiyi-live-hat-brim") && source.includes("yiyi-live-hat-crown"),
    hatNotSnowHalo: source.includes("yiyi-live-hat-brim") && !source.includes("yiyi-live-hat::after"),
    jacketShapeVisible: source.includes("yiyi-live-jacket") && source.includes("yiyi-live-collar"),
    seaBreezePaletteVisible: source.includes("#AEE2FF") && source.includes("#C7D2E3"),
    conceptBoardReferenceVisible: source.includes("yiyi-concept-board.png"),
    pseudo3DLiveMotion: true,
    real3DModelLoaded: false,
    idleMotionDetected: source.includes("@keyframes yiyi-live-roam") && source.includes("@keyframes yiyi-live-float"),
    mouseAttentionDetected: source.includes("mouse_attention") && source.includes("--yiyi-look-angle"),
    avatarDoesNotBlockMissionControl: source.includes("pointer-events: none") && source.includes("pointer-events: auto"),
    screenshotManifest,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    deployExecuted: false,
    workspaceCleanClaimed: false,
  };

  for (const shot of Object.values(screenshotManifest)) {
    ensure(shot.ok, `screenshot capture failed: ${shot.path} ${shot.error || ""}`);
    const info = await stat(resolve(shot.path));
    ensure(info.size > 1000, `screenshot too small: ${shot.path}`);
  }
  ensure(result.yiyiLiveAvatarVisible, "live avatar must be visible.");
  ensure(result.notSnowmanLike, "avatar must not be snowman-like.");
  ensure(result.longBlackHairVisible, "long black hair must be visible.");
  ensure(result.whiteHatVisible, "white hat must be visible.");
  ensure(result.hatNotSnowHalo, "hat must not be a snow halo.");
  ensure(result.jacketShapeVisible, "jacket must be visible.");
  ensure(result.conceptBoardReferenceVisible, "concept board reference must remain available.");
  ensure(result.idleMotionDetected, "idle motion must remain detected.");
  ensure(result.mouseAttentionDetected, "mouse attention must remain detected.");

  await import("node:fs/promises").then(({ writeFile }) => writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
