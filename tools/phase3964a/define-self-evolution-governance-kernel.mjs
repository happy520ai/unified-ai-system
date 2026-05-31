import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getSelfEvolutionPolicy } from "../../apps/ai-gateway-service/src/self-evolution/selfEvolutionPolicy.js";

const repoRoot = process.cwd();
const docPath = "docs/phase3964a-self-evolution-governance-kernel.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3964a-self-evolution-governance-kernel/result.json";

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

export function defineSelfEvolutionGovernanceKernel() {
  const policy = getSelfEvolutionPolicy();
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    selfEvolutionKernelDefined: true,
    policy,
    autonomousCodeMutationAllowed: policy.autonomousCodeMutationAllowed,
    autonomousProviderCallAllowed: policy.autonomousProviderCallAllowed,
    autonomousSecretReadAllowed: policy.autonomousSecretReadAllowed,
    autonomousDeployAllowed: policy.autonomousDeployAllowed,
    autonomousChatRouteChangeAllowed: policy.autonomousChatRouteChangeAllowed,
    autonomousChatGatewayExecuteChangeAllowed: policy.autonomousChatGatewayExecuteChangeAllowed,
    humanApprovalRequiredForHighRisk: policy.humanApprovalRequiredForHighRisk,
    lowValuePhaseExpansionBlocked: policy.lowValuePhaseExpansionBlocked,
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
    `# Phase3964A Self Evolution Governance Kernel\n\n## Goal\n\nDefine a governed self-evolution kernel for observation, diagnosis, proposal generation, dry-run checks, and human approval gates.\n\n## Kernel Policy\n\n\`\`\`json\n${JSON.stringify(policy, null, 2)}\n\`\`\`\n\n## Allowed\n\n- Observe product evidence and blockers.\n- Diagnose likely next Product Work Mode tasks.\n- Propose low-risk dry-run repairs.\n- Run verifiers and write evidence.\n\n## Blocked\n\n- Autonomous code mutation.\n- Autonomous Provider calls.\n- Autonomous secret reads.\n- Autonomous deploy/release/tag/artifact actions.\n- Autonomous /chat or /chat-gateway/execute changes.\n- Low-value phase expansion.\n\n## Rollback\n\n- Delete \`apps/ai-gateway-service/src/self-evolution/selfEvolutionPolicy.js\` only if no later phase depends on it.\n- Delete \`apps/ai-gateway-service/src/self-evolution/selfEvolutionLedgerSchema.js\` only if no later phase depends on it.\n- Delete \`apps/ai-gateway-service/src/self-evolution/selfEvolutionValueGate.js\` only if no later phase depends on it.\n- Delete \`tools/phase3964a/\`.\n- Delete \`docs/phase3964a-self-evolution-governance-kernel.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3964a-self-evolution-governance-kernel/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = defineSelfEvolutionGovernanceKernel();
  console.log(JSON.stringify({
    completed: result.completed,
    blocker: result.blocker,
    selfEvolutionKernelDefined: result.selfEvolutionKernelDefined,
    autonomousCodeMutationAllowed: result.autonomousCodeMutationAllowed,
    lowValuePhaseExpansionBlocked: result.lowValuePhaseExpansionBlocked,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
