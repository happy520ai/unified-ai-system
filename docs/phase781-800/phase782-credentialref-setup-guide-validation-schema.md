# Phase782 CredentialRef Setup Guide + Validation Schema

## Goal

提供 CredentialRef 设置指南和引用形态校验，不读取 raw secret。

## Verified facts

- operator creates/stores provider credential outside this phase
- operator supplies credentialRef id only
- readiness gate validates ref shape and provider allowlist
- discovery/smoke require explicit approval packets
- smoke pass can only create selectable_candidate in this phase

## Boundaries

- credentialRef is an opaque reference only
- credential_ready does not mean smoke_passed or selectable

## Outputs

- credentialRef setup guide ready

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
