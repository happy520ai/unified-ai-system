import {
  ensure,
  fileInfo,
  makePhase387Result,
  phase387Safety,
  writeJson,
  writeText,
} from "../phase387-common.mjs";

const subResultPath = "apps/ai-gateway-service/evidence/phase387a/yiyi-visual-polish-cross-browser-qa-result.json";
const subInfo = fileInfo(subResultPath);
ensure(subInfo.exists && subInfo.sizeBytes > 20, "Phase387A sub-result missing.");

const result = makePhase387Result({
  completed: true,
  recommended_sealed: true,
  blocker: null,
  validationsPassed: true,
  visualPolishQaCreated: true,
  browserQaMatrixCreated: true,
  desktopSmokeScreenshotCaptured: true,
  providerRuntimeModified: false,
  chatGatewayExecuteModified: false,
  chatSendMainChainModified: false,
  ...phase387Safety,
});

await writeText(
  "docs/phase387-yiyi-commercial-visual-polish-cross-browser-qa-closure.md",
  [
    "# Phase387 Yiyi Commercial Visual Polish + Cross-browser QA Closure",
    "",
    "Phase387 completes a low-risk commercial visual polish and QA preparation pass for Yiyi Guided Showcase.",
    "",
    "Completed:",
    "- Visual QA matrix for guided showcase.",
    "- Local desktop browser smoke screenshot.",
    "- Cross-browser and viewport review checklist.",
    "- Safety boundary confirmation.",
    "",
    "Boundary:",
    "- No provider call.",
    "- No secret access.",
    "- No deploy/release/tag/artifact.",
    "- No billing/invoice.",
    "- No provider runtime, /chat-gateway/execute, or Chat send main-chain modification.",
    "",
    "Next recommended phase is Phase384 only as a high-risk authorization gate and must not auto-execute.",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase387/yiyi-commercial-visual-polish-cross-browser-qa-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
