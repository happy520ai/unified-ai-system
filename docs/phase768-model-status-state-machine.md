# Phase768 Model Status State Machine

## Goal

建立 discovered 到 selectable 的模型状态机和失败态。

## Verified facts

- happyPath=discovered -> cataloged -> credential_missing -> credential_ready -> smoke_pending -> smoke_passed -> selectable_candidate -> selectable
- failureStates=failed, high_risk, blocked, deprecated

## Boundaries

- dryRunDefaultMaxStatus=credential_missing
- selectable requires future smoke evidence

## Outputs

- modelStatusStateMachineReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
