# Phase595 Codex Context Real Usage Trial Note

## Purpose

This note records a real usage trial for the Codex Context Gateway without changing Codex config or base_url. Codex Context Gateway remains an independent context sub-gateway: it prepares project state, evidence references, relevant file scope, prompt pack, freshness state, and token budget material before a task.

## Usage Flow

1. Read `.codex-context/current-context-pack.md` before starting the task.
2. Check `.codex-context/context-freshness-report.json` and stop if `stale=true`.
3. Read `.codex-context/relevant-files.json` and use it as the default file scope.
4. Read `.codex-context/codex-prompt-pack.md` for task boundaries and validation commands.
5. Execute only the scoped task and write evidence.

## Relevant Files

`relevant-files.json` limits the default read surface so Codex does not start with a full repository scan. If a task needs an out-of-scope file, the operator or runner must record a concrete reason before reading it.

## Token Budget

The token budget report keeps the context pack bounded. Current policy supports 8k, 16k, and 32k modes with summarize, truncate, or reference-only behavior. The trial uses the generated pack estimate instead of treating the whole repository as prompt context.

## Stale Guard

The freshness gate protects against stale context. A stale context pack is not a model result and must not be used as if it reflects the latest repository state.

## Safety Boundary

- No Codex config change.
- No Codex base_url change.
- No real Codex relay connection.
- No project Provider call.
- No secret, API key, token, webhook, or `.env` content read or printed.
- No `/chat` or `/chat-gateway/execute` runtime change.
- No deploy, release, tag, or artifact upload.
- No workspace clean claim.

## Next Step

Use Phase596 to repeat this trial across several small tasks and compare file reads, token estimates, stale guard behavior, and avoided full-repository scan evidence.
