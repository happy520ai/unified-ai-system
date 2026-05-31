# Phase606R-Fix Interactive Terminal One-Shot Command Pack

## Scope

`manualExecutionOnly=true`

This Phase606R-Fix artifact prepares the next guarded one-shot for a human-operated
interactive terminal. It does not execute Codex, does not call a provider, and does not write
Codex config.

## Imported Facts

- `modelProviderOverrideHonored=true`
- `selectedProviderId=crs`
- `firstOneShotRootCause=stdin_is_not_a_terminal`
- `noNewOneShotExecuted=true`

## Manual Command

Run this command only in a real interactive terminal after completing the Phase606R preflight
checklist and receiving explicit execution approval for the next phase.

```powershell
cd E:\AI-Data\AI网关系统\unified-ai-system

codex -c model_provider="crs" "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK."
```

## Expected Response

The only passing response is:

```text
CONTEXT_GATEWAY_MODEL_PROVIDER_OK
```

## Manual Evidence Capture

After the manual execution, fill in:

`docs/phase606r-interactive-terminal-result.input.example.json`

Do not paste raw secret values, raw webhook values, raw base_url values, auth tokens, or
`auth.json` content.

## Hard Boundaries

- Do not read `auth.json`.
- Do not write `~/.codex/config.toml`.
- Do not write project `.codex/config.toml`.
- Do not modify `/chat`.
- Do not modify `/chat-gateway/execute`.
- Do not deploy, release, tag, push, commit, or upload artifacts.
- Do not claim workspace clean.

