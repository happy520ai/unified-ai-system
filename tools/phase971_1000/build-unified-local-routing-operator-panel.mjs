import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildUnifiedLocalRoutingOperatorPanelModel } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildUnifiedLocalRoutingOperatorPanelModel({
  normal: readJsonIfPresent(paths.normalConsole) || {},
  god: readJsonIfPresent(paths.godConsole) || {},
  tianshu: readJsonIfPresent(paths.tianshuConsole) || {},
});
writeJson(paths.operatorPanel, result);
writeDoc("docs/phase971-1000/phase984-unified-local-routing-operator-panel.md", {
  title: "Phase984 Unified Local Routing Operator Panel",
  goal: "Prepare read-only Mission Control operator panel data.",
  facts: [`localSelfUseReady=${result.localSelfUseReady}`, `dangerousButtonDetected=${result.dangerousButtonDetected}`],
  boundaries: ["Read-only panel.", "No deploy, release, secret, provider force-call, or default enable buttons."],
  outputs: [paths.operatorPanel, "apps/ai-gateway-service/src/ui/components/LocalSelfUseRoutingV1Panel.js"],
});
logResult(result);
