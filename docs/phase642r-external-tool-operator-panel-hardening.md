# Phase642R External Tool Operator Panel Hardening

## Goal

Harden the Mission Control / Codex Context Gateway panel as a read-only
external tool status surface. It presents the Codex/crs gateway as an external
Codex relay/token-saving tool, not a main-chain runtime.

## Read-Only State

- External Codex Relay Tool
- toolMode=external_tool
- Phase632 preflight mandatory
- context pack status
- relevant files status
- token budget status
- stale gate status
- full repo scan forbidden
- output budget required
- model_provider=crs repeated_pass under controlled test
- nightly safe runner fallback available
- Task Scheduler registration status
- not /chat integrated
- not /chat-gateway/execute integrated
- not provider runtime
- not production ready
- not release ready

## Forbidden UI Additions

- No "execute codex exec now" button.
- No Provider call button.
- No /chat integration button.
- No /chat-gateway/execute mutation button.
- No deploy, release, tag, push, or commit button.
- No secret/auth.json input.
