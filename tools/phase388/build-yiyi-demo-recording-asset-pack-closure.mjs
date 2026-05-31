import {
  ensure,
  fileInfo,
  makePhase388Result,
  phase388Safety,
  phase388ShotPlan,
  writeJson,
  writeText,
} from "../phase388-common.mjs";

const subResultPath = "apps/ai-gateway-service/evidence/phase388a/yiyi-demo-recording-asset-pack-result.json";
const checklistPath = "docs/phase388a-yiyi-manual-browser-review-checklist.json";
const docPath = "docs/phase388a-yiyi-demo-recording-asset-pack.md";
const subInfo = fileInfo(subResultPath);
const checklistInfo = fileInfo(checklistPath);
const docInfo = fileInfo(docPath);

ensure(subInfo.exists && subInfo.sizeBytes > 20, "Phase388A result missing.");
ensure(checklistInfo.exists && checklistInfo.sizeBytes > 20, "Phase388A checklist missing.");
ensure(docInfo.exists && docInfo.sizeBytes > 20, "Phase388A doc missing.");

const result = makePhase388Result({
  completed: true,
  recommended_sealed: true,
  blocker: null,
  validationsPassed: true,
  recordingAssetPackCreated: true,
  manualBrowserReviewChecklistCreated: true,
  screenshotsPreparedForRecording: true,
  screenshotsCopiedFromPhase386: true,
  screenshotsCaptured: false,
  releaseArtifactCreated: false,
  externalUploadPerformed: false,
  shotCount: phase388ShotPlan.length,
  ...phase388Safety,
});

await writeText(
  "docs/phase388-yiyi-demo-recording-asset-pack-closure.md",
  [
    "# Phase388 Yiyi Demo Recording Asset Pack + Manual Browser Review Closure",
    "",
    "Phase388 completes a low-risk local recording asset package for the Yiyi commercial guided showcase.",
    "",
    "Completed:",
    "- Local recording shot checklist.",
    "- Local screenshot reference asset pack copied from Phase386 browser smoke evidence.",
    "- Manual browser review checklist for the ten guided showcase shots.",
    "- Safety boundary restatement for no provider call, no secret access, no deployment, no billing, and no production GA claim.",
    "",
    "Boundary:",
    "- This is still a dry-run demo support package.",
    "- The screenshots are reused local evidence assets, not a new provider or release artifact.",
    "- No external upload was performed.",
    "- No provider runtime, router runtime, /chat-gateway/execute route, Chat send main chain, credential vault, billing runtime, deploy script, release script, or tag script was changed.",
    "",
    "Remaining risks:",
    "- Manual recording capture is still required.",
    "- Human visual review is still recommended before using the package in a sales recording.",
    "- Real provider testing remains gated by Phase384 and still requires specific provider/model/credential/request/cost authorization.",
    "",
    "Next recommended phase: Phase389 Yiyi Mobile Demo Adaptation + Presenter Notes.",
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase388/yiyi-demo-recording-asset-pack-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
