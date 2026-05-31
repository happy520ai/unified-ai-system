# Phase789 Smoke Result Classifier

## Goal

分类 smoke 结果，严格区分 pass、marker missing、provider error、credential invalid、rate limit、timeout、gate block、no approval。

## Verified facts

- aggregateClassification=not_executed_no_approval
- smokePassedNewModelCount=0

## Boundaries

- MODEL_SMOKE_OK marker required for pass
- marker missing is not pass

## Outputs

- provider-expansion/smoke/smoke-classification-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
