import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildGuardedRuntimePolicyPreview } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildGuardedRuntimePolicyPreview({ candidates: readJsonIfPresent(paths.tuningCandidates) || {} });
writeJson(paths.guardedPreview, result);
writeDoc("docs/phase971-1000/phase978-guarded-runtime-policy-preview.md", {
  title: "Phase978 Guarded Runtime Policy Preview",
  goal: "Preview future runtime policy changes, risks, rollback, verifier, and approval gate.",
  facts: [`guardedRuntimePolicyPreviewReady=${result.guardedRuntimePolicyPreviewReady}`, `approvalRequired=${result.approvalRequired}`],
  boundaries: ["Preview only.", "No default /chat or execute behavior change."],
  outputs: [paths.guardedPreview],
});
logResult(result);
