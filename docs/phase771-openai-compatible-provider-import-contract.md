# Phase771 OpenAI-compatible Provider Import Contract

## Goal

定义 OpenAI-compatible provider catalog import 契约。

## Verified facts

- GET /v1/models catalog preview in future authorized phase
- POST /v1/chat/completions smoke preview in future authorized phase
- OpenAI-compatible error normalization
- credentialRef-only account binding

## Boundaries

- rawSecretAllowed=false
- rawBaseUrlValueExposed=false
- defaultImportedStatus=credential_missing

## Outputs

- openAICompatibleImportContractReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
