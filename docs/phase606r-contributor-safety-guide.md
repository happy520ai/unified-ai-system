# Phase606R Contributor Safety Guide

## Default Posture

Contributors should treat this project as a local-first dry-run AI Gateway Workbench unless a later phase explicitly authorizes real Provider execution.

## Forbidden Actions

- Do not read, print, or commit API keys, tokens, webhooks, raw endpoint values, or `.env` contents.
- Do not write `~/.codex/config.toml` or project `.codex/config.toml`.
- Do not modify `/chat` or `/chat-gateway/execute` for open-source readiness work.
- Do not call OpenAI, Claude, OpenRouter, MiMo, NVIDIA, or any real Provider.
- Do not deploy, release, tag, publish, or upload artifacts.
- Do not modify `legacy/` or `PROJECT_CONTEXT.md`.
- Do not claim the workspace is clean unless it is explicitly verified clean.

## Allowed Low-Risk Work

- Documentation cleanup.
- Evidence index cleanup.
- Local verifier additions.
- Dry-run demo guide improvements.
- README and AGENTS managed block synchronization.
- Known limits and contributor safety documentation.

## Review Rule

Any change that needs real credentials, real Provider requests, deployment, release, or persistent config writes must become a separate explicitly approved phase.
