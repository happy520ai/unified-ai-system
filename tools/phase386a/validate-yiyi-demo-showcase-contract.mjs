import {
  assertPhase386SafetyFlags,
  ensure,
  makeResult,
  phase386Contract,
  phase386Safety,
  writeJson,
  writeText,
} from "../phase386-common.mjs";

ensure(phase386Contract.phase === "Phase386", "Phase must be Phase386.");
ensure(phase386Contract.demoMode === "guided_showcase", "Demo mode must be guided_showcase.");
ensure(phase386Contract.providerCallsAllowed === false, "Provider calls must not be allowed.");
ensure(phase386Contract.modelBrainEnabledByDefault === false, "Model brain must be disabled by default.");
ensure(phase386Contract.deployAllowed === false, "Deploy must not be allowed.");
ensure(phase386Contract.billingAllowed === false, "Billing must not be allowed.");
ensure(phase386Contract.showcaseSteps.length === 10, "Showcase must contain 10 steps.");

const requiredSteps = [
  "welcome",
  "mission_control_overview",
  "normal_mode_preview",
  "god_mode_arena_preview",
  "tianshu_planning_preview",
  "security_shield_demo",
  "red_team_block_demo",
  "evidence_replay_demo",
  "yiyi_brain_status",
  "closing_summary",
];
for (const step of requiredSteps) {
  ensure(phase386Contract.showcaseSteps.includes(step), `Missing showcase step: ${step}`);
}

const result = makeResult({
  phase: "Phase386A",
  demoNarrativeCreated: true,
  showcaseContractCreated: true,
  showcaseStepCount: phase386Contract.showcaseSteps.length,
  targetAudience: phase386Contract.targetAudience,
  ...phase386Safety,
});
assertPhase386SafetyFlags(result);

await writeJson("docs/phase386a-yiyi-demo-showcase-contract.json", phase386Contract);
await writeText(
  "docs/phase386a-yiyi-demo-narrative.md",
  [
    "# Phase386A Yiyi Demo Narrative",
    "",
    "Phase386 packages Yiyi and Mission Control as a guided commercial demo. The user should immediately understand that this is an Agent-managed AI Mission Control experience rather than a plain chatbot.",
    "",
    "Narrative pillars:",
    "- Yiyi is the Mission Companion who explains panels, risk signals, and evidence.",
    "- Normal / God / Tianshu modes show different levels of task handling.",
    "- Security Shield and Red Team Playground make safety visible and playable.",
    "- Evidence Replay shows trace, blocked actions, fallback reason, and local replay posture.",
    "- Yiyi Brain remains dry-run/mock by default; model-backed testing requires explicit authorization.",
    "",
    "Safety position:",
    "- providerCallsMade=false.",
    "- rawSecretAccessed=false.",
    "- deployExecuted=false.",
    "- billingExecuted=false.",
    "- productionGaClaimed=false.",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase386a/yiyi-demo-showcase-contract-result.json", result);

console.log(JSON.stringify(result, null, 2));
