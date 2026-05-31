# Phase606R-Fix Interactive Terminal Preflight Checklist

## Scope

`manualExecutionOnly=true`

This checklist prepares the next manual interactive terminal one-shot. Phase606R-Fix itself
does not execute Codex and does not make a new request.

## Required Checks Before Manual Execution

- Confirm current phase is later than Phase606R-Fix and explicitly authorized for execution.
- Confirm `maxRequests=1`.
- Confirm `retryLimit=0`.
- Confirm selected provider is `crs`.
- Confirm Phase605R root cause is `stdin_is_not_a_terminal`.
- Confirm the command will be run from a real interactive terminal.
- Confirm `.codex-context/current-context-pack.md` exists.
- Confirm `.codex-context/context-freshness-report.json` exists and reports `stale=false`.
- Confirm `.codex-context/relevant-files.json` exists.
- Confirm no full repository scan is requested.
- Confirm no file edits are requested.
- Confirm no secret reads are requested.
- Confirm auth.json must not be read.
- Confirm do not write any config.toml file.
- Confirm `codexConfigModified=false` before and after the manual attempt.
- Confirm no deploy/release/tag/push/commit/artifact upload is allowed.

## Stop Conditions

Stop before execution if any item is false:

- final confirmation missing
- context stale
- selected provider not `crs`
- terminal is non-interactive
- command would require auth.json inspection
- command would require Codex config write
- request count would exceed 1
- retry count would exceed 0

## Evidence Policy

Record only sanitized fields in the result input JSON. Do not paste raw stderr if it contains a
secret-like value, raw webhook, raw base_url, token, credential, local auth content, or private
account data.

