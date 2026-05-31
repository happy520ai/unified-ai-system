# Phase961-965 God Mode Round 2 Failure Audit

## Scope

This phase audits the Phase941-960 God Mode `god_dual_reviewer` failure and prepares a marker/scoring fix design. It does not execute a provider rerun.

## Source Evidence

- `apps/ai-gateway-service/evidence/phase941_960/real-route-quality-test-round2-final-result.json`
- `apps/ai-gateway-service/evidence/phase941_960/god-mode-round2-real-route-result.json`
- `docs/phase941-960/`

## Findings

- Phase941-960 executed 8 real NVIDIA external provider requests.
- `god_dual_reviewer` used `nvidia/llama-3.3-nemotron-super-49b-v1` through `credentialRef:nvidia:default`.
- The provider call was authentic: `externalProviderApiCallConfirmed=true`, `networkAttemptRecorded=true`, and `responseSource=external_provider`.
- The route failed correctly with `responseClassification=marker_missing`.
- The expected marker was `evidence`; the recorded signal match was false.
- The failed route remains failed. This phase does not relabel it as pass.

## Root Cause Classification

Root cause class: `prompt_marker_contract_mismatch`.

The prior prompt asked for a concise two-reviewer assessment and included a marker expectation, but it did not define a fixed review subject, exact output sections, or mandatory marker placement. The model produced a generic assessment template instead of a response that satisfied the literal marker contract. This is a prompt and scoring contract issue, not a provider authenticity issue.

## Prompt Fix Design

Future small-scope rerun prompt:

```text
Review this fixed claim: AI Gateway routing evidence must distinguish real external provider responses from dry-run or simulated responses. Return exactly three sections: Reviewer A Evidence, Reviewer B Evidence, and Verdict. Each reviewer section must include the literal marker EVIDENCE: followed by one short reason. The Verdict section must include pass or needs_followup.
```

Required markers:

- `Reviewer A Evidence`
- `Reviewer B Evidence`
- `EVIDENCE:`
- `Verdict`

## Scoring Fix Design

- Keep external provider authenticity as a hard gate.
- Do not accept provider success alone as route pass.
- Treat `marker_missing` as failed and cap score at 60.
- Require two reviewer sections, required markers, and a verdict section.
- Use case-insensitive marker matching with whitespace normalization.
- Do not mutate runtime route policy in this phase.

## Small-Scope Rerun Template

Prepared template:

- `model-routing/approvals/phase966_970-god-mode-marker-rerun.template.json`

The template is not executable by itself. It has `templateOnly=true`, `executeNow=false`, and `allowProviderCall=false`. A future run requires a separate human-approved `.input.json` file.

## Final Seal

- completed=true
- recommended_sealed=true
- blocker=null
- godDualReviewerFailureAudited=true
- markerMismatchRootCauseClassified=true
- godModePromptFixDesignReady=true
- godModeScoringFixDesignReady=true
- smallScopeRerunApprovalTemplateReady=true
- providerCallsMade=false
- newProviderRequestsThisPhase=0
- routePolicyAppliedToRuntime=false
- chatBehaviorChangedByDefault=false
- chatGatewayExecuteBehaviorChangedByDefault=false
- deployExecuted=false

## Non-Claims

- This phase did not call a Provider.
- This phase did not read secrets or auth.json.
- This phase did not change default `/chat` behavior.
- This phase did not change default `/chat-gateway/execute` behavior.
- This phase did not modify selectable state.
- This phase did not deploy, release, tag, upload artifacts, commit, or push.
- This phase did not execute the small-scope rerun.
