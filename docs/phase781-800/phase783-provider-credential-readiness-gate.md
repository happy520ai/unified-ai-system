# Phase783 Provider Credential Readiness Gate

## Goal

检查 provider allowlist 和 CredentialRef 引用状态；无 approval 时保持 credential_missing。

## Verified facts

- approvalInputPresent=false
- credentialReady=false
- readinessStatus=credential_missing

## Boundaries

- rawSecretRead=false
- authJsonRead=false
- nonAllowlistedProviderBlocked=true

## Outputs

- apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
