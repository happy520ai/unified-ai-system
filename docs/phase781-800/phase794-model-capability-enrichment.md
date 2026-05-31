# Phase794 Model Capability Enrichment from Discovery/Smoke

## Goal

根据 discovery/smoke 结果补充能力标签；无新增模型时 enrichment count 为 0。

## Verified facts

- enrichedModelCount=0

## Boundaries

- capability enrichment does not imply selectable
- no provider call

## Outputs

- apps/ai-gateway-service/evidence/model-library/provider-expansion/model-capability-enrichment-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
