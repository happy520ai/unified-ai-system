import { readPhaseResult, requirePhaseResult, writePhaseResult } from "../phase1203-1210/run-phase1203-1210-helpers.mjs";
import { docsPathFor, writeText } from "../phase1203-1210/phase1203-1210-common.mjs";

const readout = requirePhaseResult("phase1203", await readPhaseResult("phase1203"));
const cells = requirePhaseResult("phase1207", await readPhaseResult("phase1207"));
const preview = requirePhaseResult("phase1209", await readPhaseResult("phase1209"));

const mainChainEntryApprovalPacket = {
  packetId: "phase1210-main-chain-entry-approval-packet",
  requestsMainChainCandidateEntry: true,
  requestScope: [
    "Review dry-run capability candidates",
    "Review planner alignment preview",
    "Review safety and cost source blocks",
    "Review capability cell evidence refs",
  ],
  notRequestedScope: [
    "No /chat modification",
    "No /chat-gateway/execute modification",
    "No provider runtime enablement",
    "No real provider call",
    "No secret or CredentialRef value read",
    "No deploy, release, tag, or artifact upload",
  ],
  ownerApproved: false,
  mainChainIntegrationAllowed: false,
  chatModificationAllowed: false,
  chatGatewayExecuteModificationAllowed: false,
  providerCallAllowed: false,
  secretReadAllowed: false,
  deploymentAllowed: false,
};

const riskLedger = [
  risk("main_chain_runtime_regression", "high", "keep approvalPacketOnly=true until explicit owner approval"),
  risk("provider_cost_or_secret_boundary", "high", "providerCallAllowed=false and secretReadAllowed=false by default"),
  risk("dry_run_overclaim", "medium", "realSemanticValidationClaimed=false and syntheticOnly=true"),
];

const rollbackPlan = [
  "Remove Phase1203-1210 tools, docs, evidence, engine modules, package scripts, and the read-only Mission Control preview panel.",
  "Keep Phase1201, Phase1202, legacy, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, CredentialRef runtime, deployment scripts, and release scripts untouched.",
];

const noFlagRegressionPlan = [
  "Run AIO closure verifier.",
  "Run secret safety verifier.",
  "Run safe regression matrix.",
  "Run taiji-beidou-engine check.",
  "Run workspace check without claiming workspace clean.",
];

const requiredHumanApprovalFields = [
  "ownerApproved",
  "mainChainIntegrationAllowed",
  "chatModificationAllowed",
  "chatGatewayExecuteModificationAllowed",
  "providerCallAllowed",
  "secretReadAllowed",
  "deploymentAllowed",
  "riskAcceptedBy",
  "approvalTimestamp",
];

const futureExecutionGate = {
  gateId: "phase1211_or_later_high_risk_gate",
  blockedUntilOwnerApproval: true,
  maxFutureScopeWithoutNewApproval: "scenario_matrix_expansion_only",
  runtimeIntegrationExecuted: false,
};

const result = await writePhaseResult("phase1210", {
  mainChainEntryApprovalPacket,
  riskLedger,
  rollbackPlan,
  noFlagRegressionPlan,
  requiredHumanApprovalFields,
  futureExecutionGate,
  approvalPacketOnly: true,
  mainChainIntegrationExecuted: false,
  chatIntegrationExecuted: false,
  chatGatewayExecuteIntegrationExecuted: false,
  providerRuntimeEnabled: false,
  sourceSummary: {
    candidateCapabilityCount: readout.candidateCapabilities.length,
    capabilityCellCount: cells.capabilityCells.length,
    previewId: preview.missionControlPreview.previewId,
  },
});

await writeText(docsPathFor("phase1210"), `# Phase1210 Main-chain Entry Human Approval Packet

A. 是否请求进入主链候选

是，仅请求进入“未来候选审批材料”评审；不执行真实主链接入。

B. 请求范围

- Review Phase1203 candidate readout.
- Review Phase1204 Tianshu planner alignment dry-run.
- Review Phase1205 Evidence Replay preview.
- Review Phase1206 safety negative and cost sources.
- Review Phase1207-1208 dry-run capability cells and repair/prune/reweight report.
- Review Phase1209 Mission Control read-only preview.

C. 不请求范围

- 不请求真实接入 /chat。
- 不请求真实接入 /chat-gateway/execute。
- 不请求启用 provider runtime。
- 不请求读取 secret / CredentialRef value。
- 不请求 deploy / release / tag / artifact。

D. 是否允许修改 /chat

chatModificationAllowed=false

E. 是否允许修改 /chat-gateway/execute

chatGatewayExecuteModificationAllowed=false

F. 是否允许真实 Provider 调用

providerCallAllowed=false

G. 是否允许 secret / CredentialRef 读取

secretReadAllowed=false

H. 是否允许 deploy / release / tag / artifact

deploymentAllowed=false

I. rollback plan

${rollbackPlan.map((line) => `- ${line}`).join("\n")}

J. emergency disable plan

- Keep mainChainIntegrationAllowed=false.
- Keep providerRuntimeEnabled=false.
- Remove the read-only Mission Control preview if it causes operator confusion.

K. no-flag regression plan

${noFlagRegressionPlan.map((line) => `- ${line}`).join("\n")}

L. approval fields

${requiredHumanApprovalFields.map((field) => `- ${field}`).join("\n")}

M. explicit owner decision placeholder

- ownerApproved=false
- mainChainIntegrationAllowed=false
- chatModificationAllowed=false
- chatGatewayExecuteModificationAllowed=false
- providerCallAllowed=false
- secretReadAllowed=false
- deploymentAllowed=false
- ownerDecisionPlaceholder=WAITING_FOR_EXPLICIT_OWNER_APPROVAL

## Boundary

- This approval packet is synthetic dry-run evidence only.
- approvalPacketOnly=true
- mainChainIntegrationExecuted=false
- chatIntegrationExecuted=false
- chatGatewayExecuteIntegrationExecuted=false
- providerRuntimeEnabled=false
- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- syntheticOnly=true
`);

if (!result.recommended_sealed) process.exitCode = 1;

function risk(id, severity, mitigation) {
  return {
    id,
    severity,
    mitigation,
    accepted: false,
  };
}
