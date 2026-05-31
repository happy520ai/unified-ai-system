import { existsSync } from "node:fs";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, repoPath, writeDoc, writeJson } from "./phase966-970-common.mjs";
import { buildGodMarkerRerunFinalSeal } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();

const requiredFiles = [
  "packages/model-routing-engine/src/godMarkerRerunApprovalIntake.js",
  "packages/model-routing-engine/src/godPromptMarkerContract.js",
  "packages/model-routing-engine/src/godDualReviewerSmallScopeRerun.js",
  "packages/model-routing-engine/src/godRerunEvidenceRebinder.js",
  "packages/model-routing-engine/src/godMarkerRerunFinalSeal.js",
  paths.approval,
  paths.contract,
  paths.rerun,
  paths.rebind,
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(repoPath(file))) failures.push(`missing:${file}`);
}

const approvalGate = readJsonIfPresent(paths.approval) || {};
const contract = readJsonIfPresent(paths.contract) || {};
const rerunResult = readJsonIfPresent(paths.rerun) || {};
const rebind = readJsonIfPresent(paths.rebind) || {};
const final = {
  ...buildGodMarkerRerunFinalSeal({ approvalGate, contract, rerunResult, rebind }),
  ...baseSafety(),
};

if (approvalGate.authorizationComplete !== true) {
  expect(final.recommended_sealed === false, "missing_approval_must_not_seal");
  expect(final.blocker === "phase966_970_approval_missing", "missing_approval_blocker");
  expect(final.providerCallsMade === false, "missing_approval_no_provider_calls");
  expect(final.totalProviderRequests === 0, "missing_approval_zero_requests");
}
if (final.providerCallsMade === true) {
  expect(final.totalProviderRequests > 0, "provider_calls_require_request_count");
  expect(final.totalProviderRequests <= 4, "request_count_limit");
}
expect(final.phase941960OriginalEvidenceMutated === false, "original_evidence_not_mutated");
expect(final.routePolicyAppliedToRuntime === false, "runtime_policy_not_applied");
expect(final.rawSecretRead === false, "raw_secret_false");
expect(final.secretValueExposed === false, "secret_false");
expect(final.authJsonRead === false, "auth_json_false");
expect(final.chatBehaviorChangedByDefault === false, "chat_false");
expect(final.chatGatewayExecuteBehaviorChangedByDefault === false, "execute_false");
expect(final.deployExecuted === false, "deploy_false");
expect(final.releaseExecuted === false, "release_false");
expect(final.tagCreated === false, "tag_false");
expect(final.artifactUploaded === false, "artifact_false");
expect(final.unsupportedClaimCount === 0, "unsupported_zero");
expect(final.hallucinatedFactCount === 0, "hallucinated_zero");

if (failures.length) {
  final.recommended_sealed = false;
  final.blocker = final.blocker || failures[0];
}

writeJson(paths.final, final);
writeDoc("phase970-god-mode-marker-rerun-final-seal.md", {
  title: "Phase970 God Mode Marker Rerun Final Seal",
  goal: "Seal the small-scope God marker rerun or preserve an honest blocker.",
  facts: [
    `recommended_sealed=${final.recommended_sealed}`,
    `blocker=${final.blocker}`,
    `totalProviderRequests=${final.totalProviderRequests}`,
  ],
  boundaries: ["No old evidence mutation.", "No runtime route policy application."],
  outputs: [paths.final],
});
writeDoc("phase966-970-god-mode-small-scope-marker-rerun.md", {
  title: "Phase966-970 God Mode Small-scope Marker Rerun",
  goal: "Aggregate approval, contract preview, rerun, rebind, and final seal evidence.",
  facts: [
    `approvalPresent=${final.approvalPresent}`,
    `godDualReviewerRerunExecuted=${final.godDualReviewerRerunExecuted}`,
    `godModeSmallScopeRerunPassed=${final.godModeSmallScopeRerunPassed}`,
  ],
  boundaries: ["NVIDIA-only.", "CredentialRef-only.", "No full Phase941-960 rerun."],
  outputs: [paths.final],
});
writeDoc("phase966-970-execution-report.md", {
  title: "Phase966-970 Execution Report",
  goal: "Record execution status for the God marker small-scope rerun.",
  facts: [
    `providerCallsMade=${final.providerCallsMade}`,
    `responseClassification=${final.responseClassification}`,
    `realSevenDaySoakCompleted=${final.realSevenDaySoakCompleted}`,
  ],
  boundaries: ["No workspace clean claim.", "No commit or push."],
  outputs: [paths.final],
});

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, final }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  completed: final.completed,
  recommended_sealed: final.recommended_sealed,
  blocker: final.blocker,
  totalProviderRequests: final.totalProviderRequests,
}, null, 2));

function expect(condition, label) {
  if (!condition) failures.push(label);
}
