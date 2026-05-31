# Phase609R-Fix Manual Interactive Terminal Run Instruction

## Purpose

This capture kit prepares the missing manual result input for the Phase607R/Phase608R interactive terminal intake chain.

Codex must not execute the one-shot in this phase.

## Required Manual Execution

The user must open a real interactive terminal and manually execute the command from:

`docs/phase606r-interactive-terminal-one-shot-command-pack.md`

The passing acknowledgement remains:

```text
CONTEXT_GATEWAY_MODEL_PROVIDER_OK
```

## Capture Rules

After the manual terminal run, fill in:

`docs/phase607r-interactive-terminal-result.input.json`

Use `docs/phase607r-interactive-terminal-result.input.template.json` as the shape only. Do not treat the template as real evidence.

Required capture boundaries:

- Record only sanitized stdout and sanitized stderr.
- Do not record raw base_url values.
- Do not record API keys, secrets, tokens, webhooks, or auth.json content.
- Do not read `~/.codex/auth.json`.
- requestAttemptCount must be less than or equal to 1.
- retryAttemptCount must equal 0.
- `authJsonAccessed` must remain false.
- `codexConfigModified` must remain false.
- `projectCodexConfigModified` must remain false.

## This Phase Boundary

- codexOneShotExecutedByThisPhase=false
- providerCallsMadeByThisPhase=false
- requestAttemptCountNotIncreased=true
- authJsonRead=false
- codexConfigModified=false
- projectCodexConfigModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- pushExecuted=false
- commitCreated=false
- workspaceCleanClaimed=false

## Next Step

After the real manual result input exists, rerun:

```powershell
cmd /c node tools/phase608r/validate-manual-result-intake-review.mjs
```
