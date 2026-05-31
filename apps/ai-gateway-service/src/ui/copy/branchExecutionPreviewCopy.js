export const branchExecutionPreviewCopy = Object.freeze({
  title: "Adaptive Branch Execution Fabric",
  subtitle:
    "Unified IO, internal employee bus, branch fanout, result merger, load governance, and failure injection stay in dry-run preview.",
  boundaryBadges: [
    "unified-input",
    "unified-output",
    "internal-bus",
    "adaptive-branches",
    "result-merger",
    "load-governance",
    "failure-injection",
    "no-provider-call",
    "no-secret",
  ],
  cards: [
    ["Unified IO Envelope", "One task envelope carries input, branch outputs, merge result, evidence, and safety fields."],
    ["Internal Bus Bridge", "Branches exchange structured internal messages only; no Feishu or WeCom send is performed."],
    ["Adaptive Branches", "Product, Engineering, and Safety branches run as bounded dry-run previews with active caps."],
    ["Result Merger", "Accepted, rejected, and conflicted branch outputs are visible before any final recommendation."],
  ],
  previews: {
    plan: "Branch plan created: product, engineering, and safety paths. maxActiveBranches=3; maxActiveEmployees=3; maxBrainCalls=0.",
    execute:
      "Dry-run branches executed. Product and Engineering outputs completed; providerCallsMade=false; rawSecretAccessed=false.",
    merge:
      "Result merger accepted verified branch outputs and kept rejected/conflicted outputs outside the final summary.",
    load:
      "Load governance kept three active employees and rejected overflow employees with employee_load_governance_limit.",
    failure:
      "Failure injection handled timeout, employee_unavailable, and merge_conflict without marking failed branches as pass.",
  },
});
