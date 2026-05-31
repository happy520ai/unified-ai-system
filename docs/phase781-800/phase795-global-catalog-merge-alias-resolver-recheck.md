# Phase795 Global Catalog Merge + Alias Resolver Recheck

## Goal

将 expansion records 与 Phase761-780 seed 做 dry-run merge 和 alias recheck。

## Verified facts

- mergeInputCount=420
- expansionRecordCount=0
- aliasCount=0

## Boundaries

- no selectable mutation
- dry-run merge only

## Outputs

- apps/ai-gateway-service/evidence/model-library/provider-expansion/catalog-merge-alias-recheck-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
