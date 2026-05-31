import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const inputPath = "docs/provider-smoke/owner-real-provider-smoke-approval.input.json";
const docPath = "docs/phase3967a-owner-approval-gate-for-real-provider-smoke.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3967a-owner-approval-gate-for-real-provider-smoke/result.json";

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

export function prepareOwnerProviderSmokeApprovalGate() {
  const approvalInput = {
    decision: "approved_execute_one_shot_real_provider_smoke | rejected",
    provider: "",
    maxRequests: 1,
    providerCallAllowed: false,
    secretReadAllowed: false,
    credentialRefOnly: true,
    rawSecretPrintAllowed: false,
    deployAllowed: false,
    chatRouteChangeAllowed: false,
    chatGatewayExecuteChangeAllowed: false,
  };
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: "owner_real_provider_smoke_approval_missing",
    providerSmokeApprovalGatePrepared: true,
    providerSmokeExecutionAllowed: false,
    providerCallsMade: false,
    secretRead: false,
    credentialRefOnly: true,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    controlledMutationExpansionAttempted: false,
    approvalInputPath: inputPath,
  };

  writeJson(inputPath, approvalInput);
  writeText(
    docPath,
    `# Phase3967A Owner Approval Gate For Real Provider Smoke\n\n## Goal\n\nPrepare an owner approval gate for a future one-shot real Provider smoke. This phase does not execute any real Provider call and does not read raw secrets.\n\n## Approval Input\n\n\`${inputPath}\`\n\nThe owner must explicitly set a future approval packet before any real smoke can run. The default template keeps \`providerCallAllowed=false\`.\n\n## Current Decision\n\n- providerSmokeApprovalGatePrepared=true\n- providerSmokeExecutionAllowed=false\n- blocker=owner_real_provider_smoke_approval_missing\n- credentialRefOnly=true\n- providerCallsMade=false\n- secretRead=false\n- deployExecuted=false\n\n## Rollback\n\n- Delete \`tools/phase3967a/\`.\n- Delete \`docs/phase3967a-owner-approval-gate-for-real-provider-smoke.md\`.\n- Delete \`docs/provider-smoke/owner-real-provider-smoke-approval.input.json\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3967a-owner-approval-gate-for-real-provider-smoke/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = prepareOwnerProviderSmokeApprovalGate();
  console.log(JSON.stringify({
    completed: result.completed,
    blocker: result.blocker,
    providerSmokeApprovalGatePrepared: result.providerSmokeApprovalGatePrepared,
    providerSmokeExecutionAllowed: result.providerSmokeExecutionAllowed,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
