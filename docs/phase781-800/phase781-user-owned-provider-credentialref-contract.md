# Phase781 User-owned Provider CredentialRef Contract

## Goal

建立用户自带 Provider API Key 的 CredentialRef-only 接入契约。

## Verified facts

- credentialRefOnly=true
- rawSecretAllowed=false
- allowlistedProviderFamilies=18

## Boundaries

- forbidden input: apiKey
- forbidden input: secret
- forbidden input: token
- forbidden input: webhook
- forbidden input: rawBaseUrl
- forbidden input: authJson

## Outputs

- apps/ai-gateway-service/evidence/phase781_800/user-owned-credentialref-contract-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
