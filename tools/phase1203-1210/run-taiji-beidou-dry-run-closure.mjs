import {
  closureExecutionReportPath,
  closureReportPath,
  closureResultPath,
  phaseBoundary,
  phaseKeys,
  phaseRange,
  readJsonIfExists,
  resultPathFor,
  validationPathFor,
  writeJson,
  writeText,
} from "./phase1203-1210-common.mjs";

const phaseResults = {};
const validations = {};
for (const key of phaseKeys) {
  phaseResults[key] = await readJsonIfExists(resultPathFor(key), null);
  validations[key] = await readJsonIfExists(validationPathFor(key), null);
}

const phaseSummary = Object.fromEntries(phaseKeys.map((key) => [
  key,
  {
    completed: validations[key]?.completed === true && phaseResults[key]?.completed === true,
    recommended_sealed: validations[key]?.recommended_sealed === true && phaseResults[key]?.recommended_sealed === true,
    blocker: validations[key]?.blocker ?? phaseResults[key]?.blocker ?? null,
  },
]));

const allCompleted = Object.values(phaseSummary).every((summary) => summary.completed === true);
const allSealed = Object.values(phaseSummary).every((summary) => summary.recommended_sealed === true);
const allBlockersNull = Object.values(phaseSummary).every((summary) => summary.blocker === null);
const completed = allCompleted && allSealed && allBlockersNull;

const closure = {
  phase: phaseRange,
  completed,
  recommended_sealed: completed,
  blocker: completed ? null : "phase_summary_not_all_sealed",
  phase1203: phaseSummary.phase1203,
  phase1204: phaseSummary.phase1204,
  phase1205: phaseSummary.phase1205,
  phase1206: phaseSummary.phase1206,
  phase1207: phaseSummary.phase1207,
  phase1208: phaseSummary.phase1208,
  phase1209: phaseSummary.phase1209,
  phase1210: phaseSummary.phase1210,
  allBlockersNull,
  capabilityCandidatesGenerated: phaseResults.phase1203?.capabilityCandidatesGenerated === true,
  plannerAlignmentGenerated: phaseResults.phase1204?.plannerAlignmentGenerated === true,
  evidenceReplayPreviewGenerated: phaseResults.phase1205?.evidenceReplayPreviewGenerated === true,
  safetyCostSourcesGenerated: phaseResults.phase1206?.safetyCostSourcesGenerated === true,
  capabilityCellsGenerated: phaseResults.phase1207?.capabilityCellsGenerated === true,
  repairPruneReweightGenerated: phaseResults.phase1208?.repairPruneReweightGenerated === true,
  missionControlReadOnlyPreviewGenerated: phaseResults.phase1209?.missionControlReadOnlyPreviewGenerated === true,
  mainChainApprovalPacketGenerated: phaseResults.phase1210?.mainChainApprovalPacketGenerated === true,
  mainChainIntegrationExecuted: false,
  chatIntegrationExecuted: false,
  chatGatewayExecuteIntegrationExecuted: false,
  approvalPacketOnly: true,
  nextRecommendation: "Phase1211 Taiji / Beidou Scenario Matrix Expansion",
  ...phaseBoundary(),
};

await writeJson(closureResultPath, closure);
await writeText(closureReportPath, `# Phase1203-1210 Taiji / Beidou Dry-run Closure Report

${phaseRange} turns Phase1201 / Phase1202 outputs into a synthetic dry-run candidate generation loop.

## Closure

- completed=${closure.completed}
- recommended_sealed=${closure.recommended_sealed}
- blocker=${closure.blocker ?? "null"}
- allBlockersNull=${closure.allBlockersNull}
- capabilityCandidatesGenerated=${closure.capabilityCandidatesGenerated}
- plannerAlignmentGenerated=${closure.plannerAlignmentGenerated}
- evidenceReplayPreviewGenerated=${closure.evidenceReplayPreviewGenerated}
- safetyCostSourcesGenerated=${closure.safetyCostSourcesGenerated}
- capabilityCellsGenerated=${closure.capabilityCellsGenerated}
- repairPruneReweightGenerated=${closure.repairPruneReweightGenerated}
- missionControlReadOnlyPreviewGenerated=${closure.missionControlReadOnlyPreviewGenerated}
- mainChainApprovalPacketGenerated=${closure.mainChainApprovalPacketGenerated}

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatGatewayExecuteModified=false
- mainChainIntegrationExecuted=false
- deployExecuted=false
- realSemanticValidationClaimed=false
- syntheticOnly=true

## Conclusion

Phase1203-1210 已形成 Taiji / Beidou dry-run 能力候选生成闭环。
Phase1210 仅生成 main-chain entry approval packet。
未真实进入主链。
未修改 /chat。
未修改 /chat-gateway/execute。
未调用 Provider。
未读取 secret。
未部署。
未声明真实语义验证。
`);

await writeText(closureExecutionReportPath, `# Phase1203-1210 Execution Report

A. 是否完成：${closure.completed ? "是" : "否"}
B. 是否推荐封板：${closure.recommended_sealed ? "是" : "否"}
C. blocker：${closure.blocker ?? "null"}

D. Phase 范围：
Phase1203～Phase1210-AIO

E. 各 Phase 状态：
Phase1203：completed=${closure.phase1203.completed}, recommended_sealed=${closure.phase1203.recommended_sealed}, blocker=${closure.phase1203.blocker ?? "null"}
Phase1204：completed=${closure.phase1204.completed}, recommended_sealed=${closure.phase1204.recommended_sealed}, blocker=${closure.phase1204.blocker ?? "null"}
Phase1205：completed=${closure.phase1205.completed}, recommended_sealed=${closure.phase1205.recommended_sealed}, blocker=${closure.phase1205.blocker ?? "null"}
Phase1206：completed=${closure.phase1206.completed}, recommended_sealed=${closure.phase1206.recommended_sealed}, blocker=${closure.phase1206.blocker ?? "null"}
Phase1207：completed=${closure.phase1207.completed}, recommended_sealed=${closure.phase1207.recommended_sealed}, blocker=${closure.phase1207.blocker ?? "null"}
Phase1208：completed=${closure.phase1208.completed}, recommended_sealed=${closure.phase1208.recommended_sealed}, blocker=${closure.phase1208.blocker ?? "null"}
Phase1209：completed=${closure.phase1209.completed}, recommended_sealed=${closure.phase1209.recommended_sealed}, blocker=${closure.phase1209.blocker ?? "null"}
Phase1210：completed=${closure.phase1210.completed}, recommended_sealed=${closure.phase1210.recommended_sealed}, blocker=${closure.phase1210.blocker ?? "null"}

F. 新增能力：
1. Capability Candidate Readout
2. Tianshu Planner Alignment dry-run
3. Field Reasoning Evidence Replay preview
4. Safety Negative Sources + Cost Sources
5. Capability Cell Generation dry-run
6. Repair / Prune / Reweight dry-run
7. Mission Control read-only preview
8. Main-chain entry approval packet only

G. 修改文件：
见最终 Codex 回复。

H. Evidence：
- apps/ai-gateway-service/evidence/phase1203-1210-taiji-beidou-dry-run-closure/taiji-beidou-dry-run-closure-result.json
- apps/ai-gateway-service/evidence/phase1203-1210-taiji-beidou-dry-run-closure/taiji-beidou-dry-run-closure-validation-result.json

I. 验证命令：
- pnpm run smoke:phase1203-1210-taiji-beidou-dry-run-closure
- pnpm run verify:phase1203-1210-taiji-beidou-dry-run-closure

J. Provider 调用：
false

K. secret / auth.json 读取：
false

L. 是否下载 GloVe：
false

M. 是否修改 /chat：
false

N. 是否修改 /chat-gateway/execute：
false

O. 是否真实主链接入：
false

P. 是否 deploy/release/tag/artifact：
false

Q. 是否 commit/push：
false

R. 是否声称 workspace clean：
false

S. 是否声明真实语义验证：
false，仅 synthetic dry-run

T. Phase1210 审批包结论：
approvalPacketOnly=true
ownerApproved=false
mainChainIntegrationAllowed=false

U. 下一步建议：
Phase1211 Taiji / Beidou Scenario Matrix Expansion
`);

console.log(JSON.stringify({
  phase: closure.phase,
  completed: closure.completed,
  recommended_sealed: closure.recommended_sealed,
  blocker: closure.blocker,
}, null, 2));

if (!closure.recommended_sealed) process.exitCode = 1;
