export function createAdaptiveBranchPlan(envelope, bridge) {
  const branchTemplates = [
    {
      branchId: "branch-product-path",
      title: "Product path",
      assignedEmployees: ["emp-product-chief", "emp-ux-researcher"],
      objective: "Frame the task, user outcome, and acceptance evidence.",
      expectedOutput: "product_acceptance_plan",
    },
    {
      branchId: "branch-engineering-path",
      title: "Engineering path",
      assignedEmployees: ["emp-ai-gateway-engineer", "emp-qa-engineer"],
      objective: "Map implementation steps, dry-run route, and regression checks.",
      expectedOutput: "engineering_execution_plan",
    },
    {
      branchId: "branch-safety-path",
      title: "Safety path",
      assignedEmployees: ["emp-security-chief"],
      objective: "Check secret, provider, deploy, release, and external IM boundaries.",
      expectedOutput: "safety_boundary_review",
    },
  ];

  return {
    planId: "phase578-adaptive-branch-plan",
    envelopeId: envelope.envelopeId,
    sourceBridgeId: bridge.bridgeId,
    branchCount: branchTemplates.length,
    maxActiveBranches: 3,
    maxActiveEmployees: 3,
    maxBrainCalls: 0,
    branches: branchTemplates.map((branch, index) => ({
      ...branch,
      sequence: index + 1,
      status: "planned",
      dryRunOnly: true,
      providerCallsMade: false,
    })),
    rejectedBranches: [],
    providerCallsMade: false,
  };
}

export function validateAdaptiveBranchPlan(plan) {
  return {
    valid:
      plan?.branchCount === 3 &&
      plan?.maxActiveBranches <= 3 &&
      plan?.maxActiveEmployees <= 3 &&
      plan?.maxBrainCalls === 0 &&
      Array.isArray(plan?.branches) &&
      plan.branches.every((branch) => branch.status === "planned" && branch.providerCallsMade === false),
    activeBranchCount: plan?.branches?.length || 0,
  };
}
