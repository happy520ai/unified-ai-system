# Phase632C Token Budget Mandatory Gate

## Gate Fields

tokenBudgetRequired=true
tokenBudgetDeclaredBeforeTask=true
estimatedTokensRequired=true
tokenBudgetRespectedRequired=true
stopWhenBudgetMissing=true

## Policy

Every future Codex task must have a declared token budget before execution work starts. The context pack must include the budget and estimated token count, and the operator must confirm the task can fit within that budget.

## Enforcement

- Require a token budget before reading implementation files.
- Require estimated token count or a bounded estimate from the current context pack.
- Stop when the token budget is absent or already exceeded.
- Prefer concise targeted reads over broad repository discovery.
- Preserve evidence with summaries rather than long raw logs.

## Boundary

Phase632C does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not deploy, release, tag, push, or commit, and does not claim workspace clean.
