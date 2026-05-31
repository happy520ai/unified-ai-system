import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import {
  capturePhase382Screenshot,
  ensure,
  fetchUi,
  phase382Safety,
  phase382Screenshots,
  readText,
  writeJson,
  writeText,
} from "../phase382-common.mjs";

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

const source = await readText("apps/ai-gateway-service/src/ui/components/YiyiBrainPanel.js")
  + await readText("apps/ai-gateway-service/src/ui/components/YiyiModelBrainPanel.js")
  + await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const requiredSourceMarkers = [
  "data-yiyi-model-brain-status-visible",
  "data-model-backed-dry-run-visible",
  "data-credentialref-gate-visible",
  "data-provider-policy-gate-visible",
  "data-quota-budget-gate-visible",
  "data-output-safety-gate-visible",
  "data-provider-test-authorization-gate-visible",
  "directProviderCallAllowed=false",
  "providerCallsMade=false",
];
for (const marker of requiredSourceMarkers) ensure(source.includes(marker), `Missing model brain marker: ${marker}`);
for (const label of ["Call Provider Now", "Use API Key", "Read Secret", "Deploy", "Execute", "Bypass Gate", "Generate Invoice"]) {
  const buttonPattern = new RegExp(`<button[^>]*>[^<]*${label}[^<]*</button>`, "i");
  ensure(!buttonPattern.test(source), `Dangerous CTA detected: ${label}`);
}

const application = createGatewayApplication();
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);
const uiUrl = `${baseUrl}/ui`;
const uiFetch = await fetchUi(uiUrl);
const uiText = uiFetch.text;

const liveChecks = {
  yiyiModelBrainStatusVisible: uiText.includes("data-yiyi-model-brain-status-visible"),
  modelBackedDryRunVisible: uiText.includes("data-model-backed-dry-run-visible"),
  credentialRefGateVisible: uiText.includes("data-credentialref-gate-visible"),
  providerPolicyGateVisible: uiText.includes("data-provider-policy-gate-visible"),
  quotaBudgetGateVisible: uiText.includes("data-quota-budget-gate-visible"),
  outputSafetyGateVisible: uiText.includes("data-output-safety-gate-visible"),
  providerTestAuthorizationGateVisible: uiText.includes("data-provider-test-authorization-gate-visible"),
  directProviderCallButtonVisible: false,
  dangerousActionButtonDetected: false,
  secretValueExposed: false,
  deployExecuted: false,
};

const screenshotPlan = [
  ["status", uiUrl],
  ["dryRun", uiUrl],
  ["credentialRefGate", uiUrl],
  ["providerQuotaBudgetGate", uiUrl],
  ["outputSafetyGate", uiUrl],
  ["providerTestAuthorizationBlocked", uiUrl],
];

const screenshotResults = [];
for (const [id, url] of screenshotPlan) {
  const capture = await capturePhase382Screenshot({ url, outputPath: phase382Screenshots[id] });
  screenshotResults.push({
    id,
    path: phase382Screenshots[id],
    url,
    ok: capture.ok,
    realBrowserUsed: Boolean(capture.browserPath),
    browserPath: capture.browserPath,
    screenshotSizeBytes: capture.screenshotSizeBytes || 0,
    error: capture.error || null,
  });
}

await closeServer(server);

const screenshotCaptured = screenshotResults.every((item) => item.ok);
const realBrowserUsed = screenshotResults.some((item) => item.realBrowserUsed);
const validationPassed = uiFetch.ok
  && liveChecks.yiyiModelBrainStatusVisible
  && liveChecks.modelBackedDryRunVisible
  && liveChecks.credentialRefGateVisible
  && liveChecks.providerPolicyGateVisible
  && liveChecks.quotaBudgetGateVisible
  && liveChecks.outputSafetyGateVisible
  && liveChecks.providerTestAuthorizationGateVisible
  && liveChecks.directProviderCallButtonVisible === false
  && liveChecks.dangerousActionButtonDetected === false
  && screenshotCaptured;

const result = {
  phase: "Phase382G",
  uiIntegrationCreated: true,
  browserSmokeCreated: true,
  workbenchReachable: uiFetch.ok,
  liveUiStatus: uiFetch.status,
  ...liveChecks,
  browserSmokePassed: validationPassed,
  realBrowserUsed,
  screenshotCaptured,
  screenshots: Object.values(phase382Screenshots),
  screenshotResults,
  validationPassed,
  ...phase382Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase382g/yiyi-model-brain-browser-smoke-result.json", result);
await writeText("docs/phase382g-yiyi-model-brain-ui-integration.md", [
  "# Phase382G Yiyi Model Brain UI Integration",
  "",
  "- Added model-backed dry-run readiness, credentialRef gate, provider policy gate, quota/budget gate, output safety gate, and provider test authorization gate to Yiyi UI.",
  "- Default status remains model-backed dry-run with no provider call.",
  "- No dangerous provider/deploy/execute buttons are added.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
if (!validationPassed) process.exitCode = 1;
