# Phase606R Open Source Minimum Readiness Lock

## Purpose

Phase606R locks the repository into a minimum state where another developer can clone the project, read the main guidance, and run a dry-run demo path without needing a real Provider, deployment, release, tag, artifact upload, or production account.

This is not a deployment. It is not a public release. It does not claim production readiness, real Provider connectivity, hosted service availability, SLA, or complete SaaS security.

## Readiness Scope

- Clone-readable project guidance.
- Dry-run demo guidance that avoids real Provider calls.
- Contributor safety rules for secrets, config files, provider boundaries, and destructive commands.
- Known limits for open-source review.
- Evidence-backed lock that imports the Phase605R safe low-risk batch result.

## Required Boundaries

- No real Provider call is required.
- No OpenAI, Claude, OpenRouter, MiMo, NVIDIA, or other Provider is called.
- No secret, webhook, raw endpoint value, or API key is read or printed.
- No user or project Codex config is written.
- `/chat` and `/chat-gateway/execute` are not modified.
- No deployment, release, tag creation, or artifact upload is performed.
- `legacy/` and `PROJECT_CONTEXT.md` remain untouched.
- The workspace is not claimed clean.

## Minimum Readiness Decision

Phase606R is sealed when the verifier confirms:

- Phase605R safe batch evidence exists and is sealed.
- The clone/read/dry-run demo docs exist.
- README and AGENTS managed blocks include Phase606R boundary language.
- The package script for the Phase606R verifier exists.
- The generated docs and evidence do not overclaim production or real Provider readiness.
