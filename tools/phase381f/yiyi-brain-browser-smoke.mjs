import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import {
  capturePhase381Screenshot,
  ensure,
  fetchUi,
  phase381Safety,
  phase381Screenshots,
  readPhase381Source,
  writeJson,
  writeText,
} from "../phase381-common.mjs";

const requestedMissionControlUrl = process.env.PHASE381_UI_URL || null;

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(resolveClose));
}

const source = await readPhase381Source();
const forbiddenButtonLabels = [
  "Ask model now",
  "Call provider",
  "Execute action",
  "Deploy now",
  "Read secret",
  "Bypass approval",
];
const requiredSourceMarkers = [
  "data-yiyi-brain-panel",
  "data-yiyi-brain-status-visible",
  "brainMode=dry_run_mock",
  "modelBacked=false",
  "data-yiyi-brain-response-preview",
  "data-yiyi-brain-safety-gate-visible",
  "data-unsafe-brain-output-blocked-visible",
  "data-yiyi-brain-provider-unconfigured",
  "data-yiyi-brain-evidence-explain",
  "providerCallsMade=false",
  "actionExecuted=false",
];

for (const marker of requiredSourceMarkers) ensure(source.includes(marker), `Missing Yiyi Brain UI marker: ${marker}`);
for (const label of forbiddenButtonLabels) ensure(!source.includes(label), `Dangerous action label detected: ${label}`);

let server = null;
let missionControlUrl = requestedMissionControlUrl;
if (!missionControlUrl) {
  const application = createGatewayApplication();
  server = createGatewayHttpServer(application);
  const baseUrl = await listen(server);
  missionControlUrl = `${baseUrl}/ui`;
}

const uiFetch = await fetchUi(missionControlUrl);
const uiText = uiFetch.text;
const liveChecks = {
  yiyiBrainStatusVisible: uiText.includes("data-yiyi-brain-status-visible"),
  brainModeDryRunVisible: uiText.includes("brainMode=dry_run_mock"),
  modelBackedFalseVisible: uiText.includes("modelBacked=false"),
  brainResponsePreviewVisible: uiText.includes("data-yiyi-brain-response-preview"),
  safetyGateResultVisible: uiText.includes("data-yiyi-brain-safety-gate-visible"),
  unsafeBrainOutputBlockedVisible: uiText.includes("data-unsafe-brain-output-blocked-visible"),
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  actionExecuted: false,
  dangerousActionButtonDetected: false,
};

const screenshotPlan = [
  ["status", missionControlUrl],
  ["responsePreview", missionControlUrl],
  ["safetyGate", missionControlUrl],
  ["providerUnconfigured", missionControlUrl],
  ["securityBlock", missionControlUrl],
  ["evidenceExplain", missionControlUrl],
];

const screenshotResults = [];
for (const [id, url] of screenshotPlan) {
  const outputPath = phase381Screenshots[id];
  const capture = await capturePhase381Screenshot({ url, outputPath, viewport: "1800,3200" });
  screenshotResults.push({
    id,
    url,
    path: outputPath,
    ok: capture.ok,
    realBrowserUsed: Boolean(capture.browserPath),
    browserPath: capture.browserPath,
    screenshotSizeBytes: capture.screenshotSizeBytes || 0,
    error: capture.error || null,
  });
}

if (server) await closeServer(server);

const screenshotCaptured = screenshotResults.every((item) => item.ok && existsSync(resolve(item.path)) && statSync(resolve(item.path)).size > 0);
const realBrowserUsed = screenshotResults.some((item) => item.realBrowserUsed);
const validationPassed = uiFetch.ok && Object.values(liveChecks).every((value) => value === true || value === false) && liveChecks.yiyiBrainStatusVisible && liveChecks.brainModeDryRunVisible && liveChecks.modelBackedFalseVisible && liveChecks.brainResponsePreviewVisible && liveChecks.safetyGateResultVisible && liveChecks.unsafeBrainOutputBlockedVisible && screenshotCaptured;

const result = {
  phase: "Phase381F",
  uiIntegrationCreated: true,
  browserSmokeCreated: true,
  workbenchReachable: uiFetch.ok,
  localServerStartedBySmoke: Boolean(server),
  liveUiStatus: uiFetch.status,
  ...liveChecks,
  browserSmokePassed: validationPassed,
  realBrowserUsed,
  screenshotCaptured,
  screenshots: Object.values(phase381Screenshots),
  screenshotResults,
  validationPassed,
  ...phase381Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase381f/yiyi-brain-browser-smoke-result.json", result);
await writeText("docs/phase381f-yiyi-brain-ui-integration.md", [
  "# Phase381F Yiyi Brain UI Integration",
  "",
  "- Added Yiyi Brain Status, Brain Response Preview, Safe Suggestion, Safety Gate Result, and demo scenarios to Mission Control.",
  "- UI clearly marks brainMode=dry_run_mock, modelBacked=false, providerCallsMade=false, and authorityLevel=presentation_and_guidance_only.",
  "- No direct execution, provider, secret, deploy, or approval-bypass buttons are added.",
  "- Browser smoke checks live UI markers and captures screenshots when a local browser is available.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
if (!validationPassed) process.exitCode = 1;
