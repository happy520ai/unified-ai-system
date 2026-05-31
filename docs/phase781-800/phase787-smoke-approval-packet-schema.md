# Phase787 Smoke Approval Packet Schema

## Goal

定义 bounded model smoke approval 输入格式。

## Verified facts

- smokePrompt=Reply with exactly: MODEL_SMOKE_OK
- maxSmokeRequests<=5
- maxRetries=0

## Boundaries

- allowSecretRead=false
- allowDeploy=false
- smoke does not mean production ready

## Outputs

- provider-expansion/approvals/smoke-approval-schema.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
