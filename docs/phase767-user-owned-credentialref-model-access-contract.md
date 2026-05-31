# Phase767 User-owned CredentialRef Model Access Contract

## Goal

定义用户自有 API Key 的 credentialRef-only 接入协议。

## Verified facts

- required field: credentialRef
- required field: providerFamily
- required field: providerId
- required field: scope
- required field: owner
- required field: createdBy
- required field: status

## Boundaries

- forbidden raw field: apiKey
- forbidden raw field: secret
- forbidden raw field: token
- forbidden raw field: rawBaseUrl
- forbidden raw field: webhookSecret

## Outputs

- userOwnedCredentialRefContractReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
