import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const panelPath = "apps/ai-gateway-service/src/ui/TianshuCapabilityAtomPreviewPanel.js";
const missionPath = "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js";
const panelText = readText(panelPath);
const missionText = readText(missionPath);

const checks = [
  check("panel_exists", panelText.length > 0),
  check("mission_imports_panel", missionText.includes("renderTianshuCapabilityAtomPreviewPanel")),
  check("preview_marker_present", panelText.includes("data-tianshu-capability-atom-preview")),
  check("dry_run_boundary_present", panelText.includes("dry-run only")),
  check("provider_blocker_visible", panelText.includes("provider_stability_not_verified")),
  check("execution_allowed_false_visible", panelText.includes("executionAllowed=false")),
  check("provider_calls_false_visible", panelText.includes("providerCallsMade=false")),
  check("chat_gateway_false_visible", panelText.includes("chatGatewayExecuteModified=false")),
];
const passed = checks.every((item) => item.passed);
const result = {
  phase: "Phase1948P",
  name: "Tianshu Capability Atom Preview Smoke",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "tianshu_capability_preview_smoke_failed",
  uiPreviewReady: passed,
  providerCallsMade: false,
  rawSecretRead: false,
  chatGatewayExecuteModified: false,
  productionReadyClaimed: false,
  commercialReadyClaimed: false,
  checks,
};

writeJson("apps/ai-gateway-service/evidence/phase1941_1950/tianshu-capability-ui-smoke-result.json", result);
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

function readText(relativePath) {
  try {
    return readFileSync(join(process.cwd(), relativePath), "utf8");
  } catch {
    return "";
  }
}

function writeJson(relativePath, value) {
  const target = join(process.cwd(), relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
