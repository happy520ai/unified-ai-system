import { weaveCapabilityAtomsDryRun } from "./capabilityAtomWeaveDryRun.js";
import { evaluateCapabilityRiskGate } from "./tianshuCapabilityRiskGate.js";

const DEFAULT_TASK = "帮我检查今天系统状态，并告诉我下一步该做什么";

export function createTianshuCapabilityReadout(taskText = DEFAULT_TASK, atoms) {
  const candidateAtoms = atoms.map((atom) => ({
    atomId: atom.atomId,
    title: atom.title,
    capabilityTags: atom.capabilityTags,
    riskLevel: atom.riskLevel,
    requiresProvider: atom.requiresProvider,
    requiresSecret: atom.requiresSecret,
  }));
  const selectedTitles = [
    "owner_daily_status_check",
    "evidence_replay_summary",
    "secret_safety_check",
    "ui_smoke_check",
  ];
  const selectedAtoms = atoms.filter((atom) => selectedTitles.includes(atom.title));
  const rejectedAtoms = atoms
    .filter((atom) => !selectedTitles.includes(atom.title))
    .map((atom) => ({
      atomId: atom.atomId,
      title: atom.title,
      reason: atom.title === "provider_stability_check"
        ? atom.blockerExplanation ?? "真实 Provider 稳定性未验证"
        : "不属于今日状态检查的最小闭环",
      blocker: atom.blocker ?? null,
      blockerExplanation: atom.blockerExplanation ?? null,
    }));
  const weave = weaveCapabilityAtomsDryRun(atoms, selectedTitles);
  const riskGate = evaluateCapabilityRiskGate(atoms, { providerAuthorized: false, ownerApprovalPresent: false });
  const providerBlocked = riskGate.blockedCapabilities.find((item) => item.title === "provider_stability_check");

  return {
    taskUnderstanding: {
      input: taskText,
      intent: "owner_daily_system_status_check",
      language: "zh-CN",
    },
    candidateAtoms,
    selectedAtoms: selectedAtoms.map(toReadoutAtom),
    rejectedAtoms,
    dependencyGraph: weave.dependencyGraph,
    routeAffinityScore: 0.86,
    evidenceCoherenceScore: 0.91,
    riskFieldScore: providerBlocked ? 0.42 : 0.8,
    executionReadinessScore: 0.58,
    blockedCapabilities: riskGate.blockedCapabilities,
    approvalRequiredCapabilities: riskGate.approvalRequiredCapabilities,
    dryRunOnlyCapabilities: riskGate.dryRunOnlyCapabilities,
    finalTianshuPlan: [
      "读取本地 owner daily status 和 evidence replay。",
      "确认 secret safety 和 UI smoke 仍通过。",
      "保留 provider_stability_not_verified 阻塞项。",
      "NVIDIA one-shot route 已 timeout_blocked，下一步优先做 route repair 或 alternative provider authorization。",
    ],
    executionAllowed: false,
    providerStabilityBlockerPreserved: Boolean(providerBlocked),
    dryRunWeave: weave,
    riskGate,
  };
}

function toReadoutAtom(atom) {
  return {
    atomId: atom.atomId,
    title: atom.title,
    riskLevel: atom.riskLevel,
    allowedEffects: atom.allowedEffects,
    evidenceRefs: atom.evidenceRefs,
  };
}
