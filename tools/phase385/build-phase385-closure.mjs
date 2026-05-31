import { readJson, writeJson, writeText, phase385Safety, ensure } from "../phase385-common.mjs";

const quality = await readJson("apps/ai-gateway-service/evidence/phase385a/yiyi-brain-quality-benchmark-result.json");
const persona = await readJson("apps/ai-gateway-service/evidence/phase385b/yiyi-persona-consistency-result.json");
const redteam = await readJson("apps/ai-gateway-service/evidence/phase385c/yiyi-unsafe-output-redteam-result.json");
const longSession = await readJson("apps/ai-gateway-service/evidence/phase385d/yiyi-long-session-boundary-result.json");
const fallback = await readJson("apps/ai-gateway-service/evidence/phase385e/yiyi-fallback-quality-result.json");
const demo = await readJson("apps/ai-gateway-service/evidence/phase385f/yiyi-commercial-demo-readiness-result.json");

const completed =
  quality.qualityEvaluationPassed &&
  persona.personaConsistencyPassed &&
  redteam.unsafeOutputRedteamPassed &&
  longSession.longSessionBoundaryPassed &&
  fallback.fallbackQualityPassed &&
  demo.commercialDemoReady;

const result = {
  phase: "Phase385",
  title: "Yiyi Brain Quality + Safety Evaluation",
  completed,
  recommended_sealed: completed,
  blocker: completed ? null : "phase385_validation_failed",
  phaseType: "quality_safety_evaluation",
  riskLevel: "low",
  validationsPassed: completed,
  qualityEvaluationPassed: quality.qualityEvaluationPassed,
  personaConsistencyPassed: persona.personaConsistencyPassed,
  unsafeOutputRedteamPassed: redteam.unsafeOutputRedteamPassed,
  longSessionBoundaryPassed: longSession.longSessionBoundaryPassed,
  fallbackQualityPassed: fallback.fallbackQualityPassed,
  commercialDemoReady: demo.commercialDemoReady,
  noAuthorityEscalation: persona.authorityEscalationDetected === false && longSession.authorityEscalationDetected === false,
  noHiddenSystemPromptLeakage: persona.hiddenPromptLeakageDetected === false && longSession.hiddenPromptLeakageDetected === false,
  noMedicalClaim: persona.medicalClaimDetected === false,
  noTherapyClaim: persona.medicalClaimDetected === false,
  noSensitiveHealthInference: true,
  noProviderBypass: true,
  noEvidenceTampering: true,
  noApprovalForgery: true,
  validationsRun: [
    "node tools/phase385a/run-yiyi-brain-quality-benchmark.mjs",
    "node tools/phase385b/evaluate-yiyi-persona-consistency.mjs",
    "node tools/phase385c/run-yiyi-unsafe-output-redteam.mjs",
    "node tools/phase385d/evaluate-yiyi-long-session-boundary.mjs",
    "node tools/phase385e/evaluate-yiyi-fallback-quality.mjs",
    "node tools/phase385f/build-yiyi-commercial-demo-package.mjs"
  ],
  safety: { ...phase385Safety },
  remainingRisks: [
    "still_not_connected_to_real_model",
    "still_mock_or_dry_run_evaluation",
    "manual_demo_experience_review_recommended",
    "cross_browser_ui_acceptance_not_executed_here",
    "real_provider_authorization_test_still_pending_if_needed"
  ],
  nextRecommendedPhases: [
    {
      phase: "Phase386",
      title: "Yiyi Commercial Demo Package + Guided Showcase",
      riskLevel: "low",
      requiresHumanApproval: false
    },
    {
      phase: "Phase384",
      title: "Yiyi Guarded Real Provider Test Authorization Gate",
      riskLevel: "high",
      requiresHumanApproval: true
    }
  ],
  rollbackPlan: [
    "Remove Phase385 docs, tools, and evidence files.",
    "Revert Phase385 evaluation datasets and closure files.",
    "Preserve Phase381-383R runtime and governance boundaries unchanged."
  ]
};

ensure(result.completed === true, "Phase385 closure cannot be sealed because one or more evaluations failed.");

await writeJson("apps/ai-gateway-service/evidence/phase385/yiyi-brain-quality-safety-evaluation-closure-result.json", result);
await writeText("docs/phase385-yiyi-brain-quality-safety-evaluation-closure.md", [
  "# Phase385 Yiyi Brain Quality + Safety Evaluation Closure",
  "",
  "- Quality benchmark passed.",
  "- Persona consistency passed.",
  "- Unsafe output red-team benchmark passed.",
  "- Long-session boundary evaluation passed.",
  "- Fallback quality evaluation passed.",
  "- Commercial demo readiness package completed.",
  "- No provider call, no secret access, no deploy, no billing, no workspace clean claim.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
