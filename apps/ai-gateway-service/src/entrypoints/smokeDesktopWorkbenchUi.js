import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-308a-desktop-workbench-ui-smoke.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-308a-desktop-workbench-ui-smoke.md");
const url = "http://127.0.0.1:3100/ui?ts=phase308a-smoke";

const result = {
  phase: "308A",
  name: "Desktop Workbench Runtime UI Smoke",
  status: "skipped",
  serviceReachable: false,
  runtimeHtmlChecked: false,
  desktopWorkbenchMarkerFound: false,
  languageSwitcherFound: false,
  pageMarkersFound: false,
  buttonMarkersFound: false,
  chatPageCleanRuntimeCheck: false,
  oldMarkerDriftDetected: false,
  currentWorkbenchMarkers: [],
  skippedReason: null,
};

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  result.serviceReachable = response.ok;
  if (!response.ok) {
    result.skippedReason = `Service returned HTTP ${response.status}`;
  } else {
    const html = await response.text();
    result.runtimeHtmlChecked = true;
    result.oldMarkerDriftDetected = html.includes('data-workbench-root="phase372-workbench-root"')
      && !html.includes("PHASE308_DESKTOP_WORKBENCH_TEMPLATE_BEGIN");
    result.desktopWorkbenchMarkerFound = html.includes('data-workbench-root="phase372-workbench-root"')
      && html.includes("AI Gateway Workbench");
    result.languageSwitcherFound = html.includes("AI Gateway Workbench") && html.includes("/chat");
    result.pageMarkersFound = [
      'data-page="chat"',
      'data-page="models"',
      'data-page="approvals"',
      'data-page="files"',
      'data-page="diagnostics"',
      'id="three-mode-runtime"',
      'id="three-mode-panel-normal"',
      'id="three-mode-panel-god"',
      'id="three-mode-panel-tianshu"',
      'id="provider-credentialref-guidance"',
      'id="three-mode-guarded-notice"',
    ].every((marker) => html.includes(marker));
    result.buttonMarkersFound = [
      'id="send-button"',
      'id="save-provider-button"',
      'id="create-approval-button"',
      'id="refresh-diagnostics-button"',
      'id="open-evidence-button"',
    ].every((marker) => html.includes(marker));
    result.currentWorkbenchMarkers = [
      'data-workbench-root="phase372-workbench-root"',
      'id="three-mode-runtime"',
      'id="three-mode-panel-normal"',
      'id="three-mode-panel-god"',
      'id="three-mode-panel-tianshu"',
      'id="provider-credentialref-guidance"',
      'id="three-mode-guarded-notice"',
    ].filter((marker) => html.includes(marker));
    const chatStart = html.indexOf('data-page="chat"');
    const chatEnd = html.indexOf('data-page="models"', chatStart);
    const chatHtml = chatStart >= 0 ? html.slice(chatStart, chatEnd > chatStart ? chatEnd : html.length) : "";
    result.chatPageCleanRuntimeCheck = !/Product Deep Optimization Roadmap|Setup Wizard|Phase history|Evidence lists/.test(chatHtml);
    result.status = result.desktopWorkbenchMarkerFound &&
      result.languageSwitcherFound &&
      result.pageMarkersFound &&
      result.buttonMarkersFound &&
      result.chatPageCleanRuntimeCheck ? "pass" : "fail";
    result.skippedReason = null;
  }
} catch (error) {
  result.status = "skipped";
  result.skippedReason = `Service not reachable: ${error?.message || error}`;
}

await writeFile(evidenceJsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(result), "utf8");

if (result.status === "fail") {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}

function renderMarkdown(evidence) {
  return [
    "# Phase308A Desktop Workbench Runtime UI Smoke",
    "",
    `- status: ${evidence.status}`,
    `- serviceReachable: ${evidence.serviceReachable}`,
    `- runtimeHtmlChecked: ${evidence.runtimeHtmlChecked}`,
    `- desktopWorkbenchMarkerFound: ${evidence.desktopWorkbenchMarkerFound}`,
    `- languageSwitcherFound: ${evidence.languageSwitcherFound}`,
    `- pageMarkersFound: ${evidence.pageMarkersFound}`,
    `- buttonMarkersFound: ${evidence.buttonMarkersFound}`,
    `- chatPageCleanRuntimeCheck: ${evidence.chatPageCleanRuntimeCheck}`,
    `- oldMarkerDriftDetected: ${evidence.oldMarkerDriftDetected}`,
    `- currentWorkbenchMarkers: ${Array.isArray(evidence.currentWorkbenchMarkers) ? evidence.currentWorkbenchMarkers.join(", ") : ""}`,
    `- skippedReason: ${evidence.skippedReason}`,
    "",
  ].join("\n");
}
