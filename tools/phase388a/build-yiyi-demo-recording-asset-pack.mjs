import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ensure,
  fileInfo,
  makePhase388Result,
  phase388Safety,
  phase388ShotPlan,
  writeJson,
  writeText,
} from "../phase388-common.mjs";

const sourceScreenshotDir = "apps/ai-gateway-service/evidence/phase386f/screenshots";
const phase388ScreenshotDir = "apps/ai-gateway-service/evidence/phase388/screenshots";
const screenshotNames = [
  "yiyi-guided-showcase-overview.png",
  "yiyi-guided-showcase-welcome.png",
  "yiyi-guided-showcase-normal.png",
  "yiyi-guided-showcase-god.png",
  "yiyi-guided-showcase-tianshu.png",
  "yiyi-guided-showcase-security.png",
  "yiyi-guided-showcase-redteam.png",
  "yiyi-guided-showcase-evidence.png",
  "yiyi-guided-showcase-brain-status.png",
  "yiyi-guided-showcase-closing.png",
];

const shotChecklist = phase388ShotPlan.map((shotId, index) => {
  const screenshotName = screenshotNames[index];
  return {
    shotId,
    order: index + 1,
    screenshotName,
    sourceScreenshotPath: `${sourceScreenshotDir}/${screenshotName}`,
    assetScreenshotPath: `${phase388ScreenshotDir}/${screenshotName}`,
    reviewFocus:
      shotId === "overview"
        ? "Confirm Mission Control, Yiyi avatar, guided showcase, and safety bar are visible in the first frame."
        : shotId === "redteam"
          ? "Confirm blocked action posture is clear and does not imply real provider execution."
          : shotId === "brain_status"
            ? "Confirm model brain disabled by default and dry-run status are visible."
            : "Confirm the guided showcase step is readable and ready for manual recording.",
    manualBrowserReviewRequired: true,
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
  };
});

for (const name of screenshotNames) {
  const source = resolve(sourceScreenshotDir, name);
  const target = resolve(phase388ScreenshotDir, name);
  ensure(existsSync(source), `Missing Phase386 screenshot source: ${source}`);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

const copiedScreenshots = screenshotNames.map((name) => fileInfo(`${phase388ScreenshotDir}/${name}`));
for (const item of copiedScreenshots) {
  ensure(item.exists && item.sizeBytes > 0, `Phase388 screenshot asset missing or empty: ${item.path}`);
}

const checklist = {
  phase: "Phase388A",
  title: "Yiyi Demo Recording Asset Pack + Manual Browser Review Checklist",
  packageType: "local_demo_recording_asset_pack",
  source: "Phase386 guided showcase browser screenshots",
  manualRecordingRequired: true,
  manualBrowserReviewRequired: true,
  assetsCopiedFromPhase386: true,
  screenshotsAreReusedEvidenceAssets: true,
  screenshotsAreNotNewProviderEvidence: true,
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
  shotChecklist,
};

await writeJson("docs/phase388a-yiyi-manual-browser-review-checklist.json", checklist);
await writeText(
  "docs/phase388a-yiyi-demo-recording-asset-pack.md",
  [
    "# Phase388A Yiyi Demo Recording Asset Pack",
    "",
    "Phase388A prepares a local recording asset pack for the Yiyi Guided Showcase.",
    "",
    "Scope:",
    "- Reuse the Phase386 guided showcase screenshots as local recording reference assets.",
    "- Build a per-shot manual browser review checklist.",
    "- Keep the package local and evidence-only.",
    "- Keep provider calls, secret access, deployment, release, billing, and production GA claims disabled.",
    "",
    "Important boundary:",
    "- These screenshots are reused local evidence assets from Phase386.",
    "- This phase does not create a release artifact and does not upload anything externally.",
    "- This phase does not execute a real provider test.",
    "",
    "Shot list:",
    ...shotChecklist.map((item) => `- ${item.order}. ${item.shotId}: ${item.screenshotName}`),
  ].join("\n"),
);

const result = makePhase388Result({
  phase: "Phase388A",
  recordingAssetPackCreated: true,
  manualBrowserReviewChecklistCreated: true,
  screenshotsCopied: true,
  screenshotsCaptured: false,
  screenshotSourcePhase: "Phase386F",
  screenshotNames,
  screenshotAssets: copiedScreenshots,
  shotChecklist,
  ...phase388Safety,
});

await writeJson("apps/ai-gateway-service/evidence/phase388a/yiyi-demo-recording-asset-pack-result.json", result);
console.log(JSON.stringify(result, null, 2));
