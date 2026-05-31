# Phase786 Discovery Result Normalizer

## Goal

把 discovery 结果标准化为 Global Model Catalog record；无 discovery 时数量为 0。

## Verified facts

- normalizedModelCount=0

## Boundaries

- discovered does not mean smokePassed
- normalized models are not selectable

## Outputs

- provider-expansion/discovery/discovery-normalized-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
