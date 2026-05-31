import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();

const paths = Object.freeze({
  doc: "docs/phase1917a-guarded-real-provider-stability-authorization-packet.md",
  riskLedger: "docs/phase1917a-provider-test-risk-ledger.md",
  rollbackPlan: "docs/phase1917a-provider-test-rollback-plan.md",
  report: "docs/phase1917a-execution-report.md",
  template: "docs/approvals/phase1917a/provider-stability-test-authorization.input.json.template",
  result: "apps/ai-gateway-service/evidence/phase1917a/provider-stability-authorization-packet-result.json",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

const template = {
  approved: false,
  decision: "pending_owner_approval",
  providerId: "",
  modelId: "",
  credentialRef: "",
  maxRequests: 3,
  maxCostUsd: 0,
  timeoutMs: 30000,
  environment: "local",
  allowRealProviderCall: false,
  allowSecretRead: false,
  allowRawKeyOutput: false,
  rollback: "disable provider stability test flag",
};

const result = {
  phase: "Phase1917A",
  name: "Guarded Real Provider Stability Authorization Packet",
  completed: true,
  recommended_sealed: true,
  blocker: "provider_stability_owner_authorization_required_before_real_call",
  authorizationPacketGenerated: true,
  authorizationTemplateGenerated: true,
  riskLedgerGenerated: true,
  rollbackPlanGenerated: true,
  realProviderStabilityTestExecuted: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Phase1918A World-Class First Screen Lock",
};

await writeJson(paths.template, template);
await writeText(
  paths.doc,
  `# Phase1917A Guarded Real Provider Stability Authorization Packet

This phase prepares the authorization packet only.

- provider stability test prepared: true
- provider stability test executed: false
- real provider call: false
- authorization required before execution: true
`,
);
await writeText(
  paths.riskLedger,
  `# Phase1917A Provider Test Risk Ledger

P0:
- Raw secret or API key exposure remains forbidden.
- Provider call without owner approval remains forbidden.

P1:
- Cost cap must be explicit before any future test.
- maxRequests must stay bounded.
`,
);
await writeText(
  paths.rollbackPlan,
  `# Phase1917A Provider Test Rollback Plan

- Keep allowRealProviderCall=false until owner approval exists.
- Disable provider stability test flag.
- Remove docs/approvals/phase1917a/provider-stability-test-authorization.input.json if a future approval is withdrawn.
- Do not read raw credentials.
`,
);
await writeText(
  paths.report,
  `# Phase1917A Execution Report

- completed: true
- recommended_sealed: true
- blocker: provider_stability_owner_authorization_required_before_real_call
- authorizationTemplateGenerated: true
- realProviderStabilityTestExecuted: false
- providerCallsMade: false
- secretValueExposed: false
- productionReadyClaimed: false
`,
);
await writeJson(paths.result, result);

console.log(JSON.stringify(result, null, 2));
