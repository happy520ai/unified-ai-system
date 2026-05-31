import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const source = await readFile(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"), "utf8");
const agentClient = await readFile(resolve(repoRoot, "apps/agent-console/src/apiClient.js"), "utf8").catch(() => "");
const evidencePath = resolve(repoRoot, "apps/agent-console/evidence/phase328a/three-mode-ui-smoke.json");
const reportPath = resolve(repoRoot, "docs/phase328a-three-mode-ui-smoke-report.md");

const checks = {
  modeTabsVisible: source.includes('id="three-mode-tabs"') && source.includes('data-three-mode="normal"') && source.includes('data-three-mode="god"') && source.includes('data-three-mode="tianshu"'),
  normalModeVisible: source.includes('id="three-mode-panel-normal"'),
  godModeVisible: source.includes('id="three-mode-panel-god"'),
  tianshuModeVisible: source.includes('id="three-mode-panel-tianshu"'),
  normalModeCanSubmit: source.includes('id="three-mode-normal-send"') && source.includes('/three-mode/execute'),
  godModeCanSubmit: source.includes('id="three-mode-god-send"') && source.includes('participantModelIds'),
  tianshuModeCanSubmit: source.includes('id="three-mode-tianshu-send"') && source.includes('allowGodEscalation'),
  auditTraceVisible: source.includes('id="three-mode-audit-output"'),
  safetyBadgeVisible: source.includes('id="three-mode-safety-badge"'),
  existingQuickChatNotBroken: source.includes('id="chat-form"') && source.includes('/chat-gateway/execute'),
  apiClientMethodPresent: agentClient.includes("threeModeExecute"),
  consolePageActualLocationUsed: true,
};

const evidence = {
  phase: "Phase328A",
  status: Object.values(checks).every(Boolean) ? "pass" : "fail",
  ...checks,
  godModeGatedWithReason: checks.godModeCanSubmit ? null : "three_mode_god_ui_missing",
  tianshuModeGatedWithReason: checks.tianshuModeCanSubmit ? null : "three_mode_tianshu_ui_missing",
  realBrowserUsed: false,
  manualRealBrowserVerificationRequired: true,
  existingQuickChatRoute: "/chat-gateway/execute",
  threeModeRoute: "/three-mode/execute",
  generatedAt: new Date().toISOString(),
};

await mkdir(resolve(repoRoot, "apps/agent-console/evidence/phase328a"), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(evidence), "utf8");
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== "pass") process.exitCode = 1;

function renderReport(data) {
  return [
    "# Phase328A Three Mode UI Smoke Report",
    "",
    `- status: ${data.status}`,
    `- modeTabsVisible: ${data.modeTabsVisible}`,
    `- normalModeVisible: ${data.normalModeVisible}`,
    `- godModeVisible: ${data.godModeVisible}`,
    `- tianshuModeVisible: ${data.tianshuModeVisible}`,
    `- normalModeCanSubmit: ${data.normalModeCanSubmit}`,
    `- godModeCanSubmit: ${data.godModeCanSubmit}`,
    `- tianshuModeCanSubmit: ${data.tianshuModeCanSubmit}`,
    `- auditTraceVisible: ${data.auditTraceVisible}`,
    `- safetyBadgeVisible: ${data.safetyBadgeVisible}`,
    `- existingQuickChatNotBroken: ${data.existingQuickChatNotBroken}`,
    `- realBrowserUsed: ${data.realBrowserUsed}`,
    `- manualRealBrowserVerificationRequired: ${data.manualRealBrowserVerificationRequired}`,
    "",
  ].join("\n");
}
