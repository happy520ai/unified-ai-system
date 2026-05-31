export function runSandboxDryRun(spec, manifest, scaffoldPlan) {
  return {
    dryRunVersion: "phase651-666-sandbox-dry-run-v1",
    capabilityId: manifest.capabilityId,
    status: "passed",
    runtimeEnabled: false,
    adapterKind: "dry_run",
    fixtureGenerated: true,
    scaffoldPlanGenerated: Boolean(scaffoldPlan),
    providerCallsMade: false,
    secretRead: false,
    codexConfigModified: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
    output: {
      summary: `Dry-run adapter preview generated for ${spec.displayName}.`,
      evidenceRequired: true,
      runtimeGate: "approval_required_before_runtime",
    },
  };
}

export function runSandboxDryRuns(specs, manifests, scaffoldPlans) {
  return specs.map((spec, index) => runSandboxDryRun(spec, manifests[index], scaffoldPlans[index]));
}
