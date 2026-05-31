# Phase632A Context Pack Mandatory Gate

## Gate Fields

contextPackRequired=true
contextPackMustBeReadFirst=true
contextPackExistsRequired=true
contextPackHashRequired=true

## Policy

Every future Codex task must begin by reading `.codex-context/current-context-pack.md`. If the context pack is missing, unreadable, or lacks a context hash, the task must stop before reading broader project files.

The context pack is the first token-saving boundary. It gives the task summary, current hash, token budget, safety boundary, and relevant file summary before any implementation work begins.

## Enforcement

- Read `.codex-context/current-context-pack.md` first.
- Confirm the context pack exists and contains a hash.
- Confirm the task scope is compatible with the context pack.
- Stop and record a blocker if the pack is missing or stale-related checks cannot be completed.

## Boundary

Phase632A does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not deploy, release, tag, push, or commit, and does not claim workspace clean.
