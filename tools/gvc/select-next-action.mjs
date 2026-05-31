import { readProjectBrain } from "./read-project-brain.mjs";
import { validateRiskGate } from "./validate-risk-gate.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const riskRank = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

function isWithinRisk(actionRiskLevel, maxRiskLevel) {
  return riskRank[actionRiskLevel] <= riskRank[maxRiskLevel];
}

export function selectNextAction(options = {}) {
  const repoRoot = options.repoRoot;
  const maxRiskLevel = options.maxRiskLevel || "L2";
  const exactRiskLevel = options.exactRiskLevel || null;
  const brain = readProjectBrain({ repoRoot });
  const candidates = brain.nextActions.actions
    .filter((action) => action.status === "ready")
    .filter((action) => (exactRiskLevel ? action.riskLevel === exactRiskLevel : true))
    .filter((action) => isWithinRisk(action.riskLevel, maxRiskLevel))
    .map((action) => ({
      action,
      gate: validateRiskGate({ repoRoot, task: action, writeApprovalPacket: false }),
    }))
    .filter(({ gate }) => gate.decision === "allowed")
    .sort((left, right) => {
      const riskDelta = riskRank[left.action.riskLevel] - riskRank[right.action.riskLevel];
      if (riskDelta !== 0) return riskDelta;
      return right.action.priority - left.action.priority;
    });

  return candidates[0]?.action || null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const maxRiskLevel = process.argv[2] || "L2";
  const exactRiskLevel = process.argv[3] || null;
  console.log(JSON.stringify(selectNextAction({ maxRiskLevel, exactRiskLevel }), null, 2));
}
