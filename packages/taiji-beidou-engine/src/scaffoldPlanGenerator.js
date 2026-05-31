export function generateScaffoldPlan(spec, manifest) {
  const base = `capabilities/_generated_dry_run/${manifest.capabilityId}`;
  return {
    scaffoldPlanVersion: "phase651-666-scaffold-plan-v1",
    capabilityId: manifest.capabilityId,
    runtimeEnabled: false,
    files: {
      adapter: `${base}/adapter.dry-run.js`,
      fixture: `${base}/fixture.json`,
      verifier: `${base}/validate-${manifest.capabilityId}.mjs`,
      evidence: `apps/ai-gateway-service/evidence/phase651_666/capability-${manifest.capabilityId}.json`,
      docs: `${base}/README.md`,
      rollback: `${base}/rollback.md`,
    },
    steps: [
      "compile natural language spec",
      "classify immune risk",
      "generate manifest draft",
      "generate dry-run adapter plan",
      "generate verifier/evidence/rollback plan",
      "write registry preview only",
    ],
    forbiddenSteps: [
      "enable runtime",
      "call provider",
      "read secret",
      "modify /chat",
      "modify /chat-gateway/execute",
      "write Codex config",
      "deploy or release",
    ],
    inputs: spec,
  };
}

export function generateScaffoldPlans(specs, manifests) {
  return specs.map((spec, index) => generateScaffoldPlan(spec, manifests[index]));
}
