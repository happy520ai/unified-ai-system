# Phase966 God Marker Rerun Approval Intake

## Goal

Read the rerun template and true approval input before any provider rerun.

## Facts

- approvalPresent=true
- recommended_sealed=true
- blocker=null

## Boundaries

- No approval means no Provider request.
- NVIDIA-only and credentialRef-only.

## Outputs

- apps/ai-gateway-service/evidence/phase966_970/god-marker-rerun-approval-intake-result.json

## Non-claims

- This phase does not mutate Phase941-960 original failed evidence.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not modify selectable model state.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase is not human review and not a seven-day soak.
