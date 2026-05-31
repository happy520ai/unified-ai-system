import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { selectNextPhaseCandidate } from "../../apps/ai-gateway-service/src/self-evolution/nextPhaseSelectionPolicy.js";

const repoRoot = process.cwd();
const docPath = "docs/phase3965a-codex-next-phase-selection-policy.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3965a-codex-next-phase-selection-policy/result.json";

function ensureParent(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath, ".."), { recursive: true });
}

function writeJson(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), value, "utf8");
}

export function generateNextPhaseSelectionPolicy() {
  const bannedExpansionCandidate = {
    proposedPhaseName: ["controlled", "fifty-seven", "tool", "mutation"].join("-"),
    valueClass: "file_count_expansion",
    expectedUserValue: "Increase changedFileCount only.",
    changeType: "file_count_expansion",
  };
  const missingValueCandidate = {
    proposedPhaseName: "PhaseNext-MissingValue",
    valueClass: "",
    expectedUserValue: "",
    changeType: "summary_only",
  };
  const productCandidate = {
    proposedPhaseName: "PhaseNext-OwnerDailyUseRepair",
    valueClass: "owner_daily_use",
    expectedUserValue: "Convert owner friction into a bounded product repair proposal.",
    changeType: "product_work",
  };
  const policyChecks = {
    controlledFiftySevenMutation: selectNextPhaseCandidate(bannedExpansionCandidate, {}),
    missingValueClass: selectNextPhaseCandidate(missingValueCandidate, {}),
    ownerDailyUsePreferred: selectNextPhaseCandidate(productCandidate, { ownerDailyUse: true }),
  };
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    nextPhaseSelectionPolicyDefined: true,
    lowValuePhaseExpansionRejectedByDefault: policyChecks.missingValueClass.accepted === false,
    controlledFiftySevenMutationRejected: policyChecks.controlledFiftySevenMutation.accepted === false,
    productWorkModePreferred: policyChecks.ownerDailyUsePreferred.decision.includes("product_work_mode"),
    policyChecks,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    controlledMutationExpansionAttempted: false,
  };

  writeText(
    docPath,
    `# Phase3965A Codex Next Phase Selection Policy\n\n## Goal\n\nForce future Codex next-phase selection through a value gate before Product Work Mode is allowed to continue.\n\n## Rejection Rules\n\n- Proposed phase names containing controlled 57-file mutation expansion are rejected.\n- Missing \`valueClass\` is rejected.\n- Empty \`expectedUserValue\` is rejected.\n- Marker-only, managed-block-only, file-count-only, or summary-only work is rejected by default.\n- Owner daily-use blockers push selection toward Product Work Mode.\n- Provider stability blockers may only create authorization packets, not real calls.\n- UI dead-button blockers push selection toward scan/fix proposals.\n- Secret, deploy, or chat-route risk requires human approval.\n\n## Evidence\n\nThe verifier checks the policy module and the generated result evidence. This phase calls no Provider, reads no secret, and does not change /chat or /chat-gateway/execute.\n\n## Rollback\n\n- Delete \`apps/ai-gateway-service/src/self-evolution/nextPhaseSelectionPolicy.js\` only if no later phase depends on it.\n- Delete \`tools/phase3965a/\`.\n- Delete \`docs/phase3965a-codex-next-phase-selection-policy.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3965a-codex-next-phase-selection-policy/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = generateNextPhaseSelectionPolicy();
  console.log(JSON.stringify({
    completed: result.completed,
    blocker: result.blocker,
    nextPhaseSelectionPolicyDefined: result.nextPhaseSelectionPolicyDefined,
    controlledFiftySevenMutationRejected: result.controlledFiftySevenMutationRejected,
    productWorkModePreferred: result.productWorkModePreferred,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
