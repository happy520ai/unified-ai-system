# Phase793 High-risk / Failed / Deprecated Model Guard

## Goal

阻止 high-risk / failed / deprecated / blocked 模型进入 selectable。

## Verified facts

- blockedModelCount=0
- failedDeprecatedBlocked=true
- highRiskBlocked=true

## Boundaries

- blocked statuses cannot become selectable
- future manual review required

## Outputs

- provider-expansion/blocked/high-risk-failed-deprecated-guard-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
