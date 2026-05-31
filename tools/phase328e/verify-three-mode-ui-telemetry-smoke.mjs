import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const serviceUi = await readFile(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"), "utf8");
const agentClient = await readFile(resolve(repoRoot, "apps/agent-console/src/apiClient.js"), "utf8");
const evidencePath = resolve(repoRoot, "apps/agent-console/evidence/phase328e/three-mode-ui-telemetry-smoke.json");

const checks = {
  telemetryVisible: serviceUi.includes('id="three-mode-telemetry-output"'),
  latencyVisible: serviceUi.includes("latencyMs"),
  costEstimateVisible: serviceUi.includes("estimatedCost") && serviceUi.includes("estimatedOnly"),
  quotaBudgetVisible: serviceUi.includes("quotaStatus") && serviceUi.includes("budgetStatus"),
  policyStatusVisible: serviceUi.includes("policyStatus"),
  credentialStatusVisible: serviceUi.includes("credentialStatus"),
  safetyBadgeVisible: serviceUi.includes('id="three-mode-safety-badge"'),
  quickChatPreserved: serviceUi.includes('id="chat-form"') && serviceUi.includes("/chat-gateway/execute"),
  apiTelemetryExtractorPresent: agentClient.includes("extractThreeModeTelemetry"),
};

const evidence = {
  phase: "Phase328E",
  status: Object.values(checks).every(Boolean) ? "pass" : "fail",
  ...checks,
  billingClaimed: false,
  costVisibility: "estimate_or_unknown_only",
  generatedAt: new Date().toISOString(),
};

await mkdir(resolve(repoRoot, "apps/agent-console/evidence/phase328e"), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== "pass") process.exitCode = 1;
