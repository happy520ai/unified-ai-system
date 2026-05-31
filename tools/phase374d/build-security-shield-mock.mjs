import { writeJson, writeText } from "../phase373-common.mjs";

const shield = {
  taskRiskLevel: "medium",
  promptInjectionRisk: "low",
  secretLeakRisk: "none",
  providerCallRisk: "blocked",
  deployRisk: "blocked",
  billingRisk: "none",
  recommendedMode: "tianshu_dry_run",
  humanApprovalRequired: false,
  guards: [
    ["Prompt Injection Guard", "active"],
    ["Secret Leak Guard", "active"],
    ["System Prompt Leak Guard", "active"],
    ["Provider Call Gate", "blocked"],
    ["CredentialRef Gate", "active"],
    ["Dangerous Action Lock", "blocked"],
    ["Approval Gate", "requires_approval"],
    ["Quota / Budget Guard", "dry_run_only"],
    ["Evidence Recorder", "active"],
    ["Rollback Path Status", "available"],
  ],
};

const result = {
  phase: "Phase374D",
  securityShieldMockGenerated: true,
  shield,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  approvalForged: false,
};

await writeJson("docs/phase374d-security-shield-contract.json", shield);
await writeText("docs/phase374d-security-shield-copy.md", [
  "# Phase374D Security Shield Copy",
  "",
  "- Prompt Injection Guard: active",
  "- Secret Leak Guard: active",
  "- Provider Call Gate: blocked",
  "- CredentialRef Gate: active",
  "- Evidence Recorder: active",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase374d/security-shield-mock-result.json", result);

console.log(JSON.stringify(result, null, 2));
