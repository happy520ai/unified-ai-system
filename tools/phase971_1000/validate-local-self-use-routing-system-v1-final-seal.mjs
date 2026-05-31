import { exists, ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildLocalSelfUseV1FinalSeal } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const requiredFiles = [
  "packages/model-routing-engine/src/round2SupplementalEvidenceIntake.js",
  "packages/model-routing-engine/src/round2BlockerClearanceSupplement.js",
  "packages/model-routing-engine/src/round2ClosureLedger.js",
  "packages/model-routing-engine/src/routeEvidenceIntegrityRecheck.js",
  "packages/model-routing-engine/src/disabledRoutePolicyConfigDesign.js",
  "packages/model-routing-engine/src/routePolicyTuningCandidatePack.js",
  "packages/model-routing-engine/src/guardedRuntimePolicyPreview.js",
  "packages/model-routing-engine/src/policyRollbackSafeModePack.js",
  "packages/model-routing-engine/src/localSelfUseConsoleModel.js",
  "packages/model-routing-engine/src/localRegressionRoutineAutomation.js",
  "packages/model-routing-engine/src/evidenceLedgerAutomation.js",
  "packages/model-routing-engine/src/issueLedgerAutomation.js",
  "packages/model-routing-engine/src/dailyUseJournalAutomation.js",
  "packages/model-routing-engine/src/sevenDaySoakEntryFramework.js",
  "packages/model-routing-engine/src/localSelfUseV1ReadinessAudit.js",
  "packages/model-routing-engine/src/localSelfUseV1FinalSeal.js",
  "apps/ai-gateway-service/src/ui/components/LocalSelfUseRoutingV1Panel.js",
  "apps/ai-gateway-service/src/ui/components/LocalSelfUseEvidenceLedgerPanel.js",
  "apps/ai-gateway-service/src/ui/components/LocalSelfUseIssueLedgerPanel.js",
  "apps/ai-gateway-service/src/ui/components/SevenDaySoakEntryPanel.js",
  "apps/ai-gateway-service/src/ui/copy/localSelfUseRoutingV1Copy.js",
  "apps/ai-gateway-service/src/ui/copy/localSelfUseEvidenceLedgerCopy.js",
  "apps/ai-gateway-service/src/ui/copy/localSelfUseIssueLedgerCopy.js",
  "apps/ai-gateway-service/src/ui/copy/sevenDaySoakEntryCopy.js",
  paths.supplementalSeal,
  paths.policySeal,
  paths.consoleSeal,
  paths.automationSeal,
  paths.soakSeal,
  paths.readinessAudit,
  paths.safetyRecheck,
  paths.noDeployClosure,
];
const missing = requiredFiles.filter((file) => !exists(file));
const supplemental = readJsonIfPresent(paths.supplementalSeal) || {};
const policy = readJsonIfPresent(paths.policySeal) || {};
const consoleSeal = readJsonIfPresent(paths.consoleSeal) || {};
const automation = readJsonIfPresent(paths.automationSeal) || {};
const soak = readJsonIfPresent(paths.soakSeal) || {};
const readiness = readJsonIfPresent(paths.readinessAudit) || {};
const safety = readJsonIfPresent(paths.safetyRecheck) || {};
const final = buildLocalSelfUseV1FinalSeal({ supplemental, policy, consoleSeal, automation, soak, readiness, safety });

if (missing.length > 0) {
  final.recommended_sealed = false;
  final.blocker = `missing:${missing[0]}`;
}

writeJson(paths.final, final);
writeDoc("docs/phase971-1000/phase1000-local-self-use-routing-system-v1-final-seal.md", {
  title: "Phase1000 Local Self-use Routing System v1 Final Seal",
  goal: "Seal local self-use routing system v1 readiness without production, server, deploy, or completed soak claims.",
  facts: [
    `recommended_sealed=${final.recommended_sealed}`,
    `localSelfUseReady=${final.localSelfUseReady}`,
    `routingSystemV1Ready=${final.routingSystemV1Ready}`,
    `realSevenDaySoakCompleted=${final.realSevenDaySoakCompleted}`,
  ],
  boundaries: ["No Provider requests this phase.", "No deploy/server/production traffic claim."],
  outputs: [paths.final],
});
writeDoc("docs/phase971-1000/phase971-1000-local-self-use-routing-system-v1-final-closure.md", {
  title: "Phase971-1000 Local Self-use Routing System v1 Final Closure",
  goal: "Aggregate v1 supplemental closure, policy design, console, automation, soak framework, and final safety boundaries.",
  facts: [`blocker=${final.blocker}`, `providerCallsMadeThisPhase=${final.providerCallsMadeThisPhase}`],
  boundaries: ["Local self-use ready is not production ready."],
  outputs: [paths.final],
});
writeDoc("docs/phase971-1000/phase971-1000-execution-report.md", {
  title: "Phase971-1000 Execution Report",
  goal: "Summarize execution outputs and non-claims.",
  facts: [
    `completed=${final.completed}`,
    `recommended_sealed=${final.recommended_sealed}`,
    `newProviderRequestsThisPhase=${final.newProviderRequestsThisPhase}`,
  ],
  boundaries: ["No workspace clean claim.", "No commit or push."],
  outputs: [paths.final],
});

if (missing.length > 0) {
  console.error(JSON.stringify({ ok: false, missing, final }, null, 2));
  process.exit(1);
}

if (final.recommended_sealed !== true) {
  console.error(JSON.stringify({ ok: false, final }, null, 2));
  process.exit(1);
}

logResult({
  ok: true,
  completed: final.completed,
  recommended_sealed: final.recommended_sealed,
  blocker: final.blocker,
  localSelfUseReady: final.localSelfUseReady,
});
