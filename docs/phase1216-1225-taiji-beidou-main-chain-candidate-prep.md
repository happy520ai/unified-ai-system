# Phase1216-1225 Taiji / Beidou Main-chain Candidate Prep

## Goal

Define Taiji / Beidou as a main-chain candidate layer with a reviewable contract, no-flag regression baseline, default-off shadow adapter, flag gate, rollback plan, approval review, candidate gate designs for /chat and /chat-gateway/execute, shadow test preparation, and an authorization gate.

## Status

- completed=true
- recommended_sealed=true
- blocker=null
- mainChainCandidateContractReady=true
- shadowAdapterReady=true
- shadowAdapterDefaultEnabled=false
- flagGated=true
- rollbackReady=true
- approvalGateReady=true
- testExecuted=false

## Phase Outputs

- Phase1216: Main-chain Candidate Contract Design
- Phase1217: No-flag Regression Baseline
- Phase1218: Shadow Runtime Adapter Design
- Phase1219: Flag-gated Shadow Adapter Implementation
- Phase1220: Shadow Adapter Verifier + Rollback
- Phase1221: Main-chain Entry Approval Review
- Phase1222: /chat Candidate Gate Design
- Phase1223: /chat-gateway/execute Candidate Gate Design
- Phase1224: Guarded Main-chain Shadow Test Preparation
- Phase1225: Guarded Main-chain Shadow Test Authorization Gate

## Default Flags

- TAIJI_BEIDOU_SHADOW_ENABLED=false
- TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatDefaultChanged=false
- chatGatewayExecuteModified=false
- chatGatewayExecuteDefaultChanged=false
- mainChainIntegrationExecuted=false
- mainChainDefaultEnabled=false
- providerRuntimeEnabled=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- syntheticOnly=true

## Phase1225 Authorization Gate Conclusion

Phase1225 stops at the authorization gate. authorizationMissing=true, ownerApproved=false, testExecuted=false, and realShadowTestExecuted=false. A future Phase1226-1235 requires explicit owner authorization before any real shadow test, provider call, secret access, main-chain integration, /chat default change, or /chat-gateway/execute default change.
