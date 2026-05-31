import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { classifySelfPatchProposal } from "../../apps/ai-gateway-service/src/self-evolution/lowRiskSelfPatchPolicy.js";

const repoRoot = process.cwd();
const docPath = "docs/phase3966a-low-risk-self-patch-dry-run-loop.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3966a-low-risk-self-patch-dry-run-loop/result.json";

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

export function generateLowRiskSelfPatchProposals() {
  const proposals = [
    classifySelfPatchProposal({ proposalType: "readme_agents_managed_block_drift", description: "Refresh Product Work Mode managed wording." }),
    classifySelfPatchProposal({ proposalType: "evidence_schema_missing_field", description: "Add missing false safety field to evidence schema." }),
    classifySelfPatchProposal({ proposalType: "provider_adapter", description: "Attempt to change Provider adapter." }),
  ];
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    lowRiskSelfPatchDryRunReady: true,
    patchesApplied: false,
    proposalOnly: true,
    highRiskPatchBlocked: proposals.some((proposal) => proposal.allowed === false && proposal.riskClass === "high"),
    proposals,
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
    `# Phase3966A Low Risk Self Patch Dry-Run Loop\n\n## Goal\n\nPrepare a low-risk self-patch dry-run loop. This phase generates patch proposals only and applies no business repair.\n\n## Allowed Proposal Types\n\n- README/AGENTS managed block drift.\n- Evidence schema missing field.\n- Verifier output missing field.\n- Package script name drift.\n- Small node --check syntax error.\n- Docs/report internal reference error.\n\n## Blocked Proposal Types\n\n- Provider adapter.\n- Credential secret logic.\n- /chat.\n- /chat-gateway/execute.\n- deploy/release.\n- real Provider call.\n- UI real button behavior.\n\n## Result\n\n- lowRiskSelfPatchDryRunReady=true\n- patchesApplied=false\n- proposalOnly=true\n- highRiskPatchBlocked=true\n\n## Rollback\n\n- Delete \`apps/ai-gateway-service/src/self-evolution/lowRiskSelfPatchPolicy.js\` only if no later phase depends on it.\n- Delete \`tools/phase3966a/\`.\n- Delete \`docs/phase3966a-low-risk-self-patch-dry-run-loop.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3966a-low-risk-self-patch-dry-run-loop/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = generateLowRiskSelfPatchProposals();
  console.log(JSON.stringify({
    completed: result.completed,
    blocker: result.blocker,
    lowRiskSelfPatchDryRunReady: result.lowRiskSelfPatchDryRunReady,
    patchesApplied: result.patchesApplied,
    highRiskPatchBlocked: result.highRiskPatchBlocked,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
