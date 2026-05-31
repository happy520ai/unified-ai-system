import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildPolicyRollbackSafeModePack } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildPolicyRollbackSafeModePack();
writeJson(paths.rollbackSafeMode, result);
writeDoc("docs/phase971-1000/phase979-policy-rollback-safe-mode-pack.md", {
  title: "Phase979 Policy Rollback Safe Mode Pack",
  goal: "Prepare local rollback and safe mode controls as documentation and evidence.",
  facts: [`rollbackReady=${result.rollbackReady}`, `safeModeReady=${result.safeModeReady}`],
  boundaries: ["Prepared pack only.", "No runtime switches toggled."],
  outputs: [paths.rollbackSafeMode],
});
logResult(result);
