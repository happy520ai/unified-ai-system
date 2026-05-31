# Phase641R External Tool CLI Usage

## Quick Usage

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run codex:external-tool:preflight
cmd /c pnpm run verify:phase641r-external-tool-cli-wrapper
```

## What It Does

The wrapper checks whether a future external Codex relay/tool workflow has the
minimum context needed to save tokens:

- current context pack
- relevant files
- freshness report
- token budget report
- stale=false
- full repo scan avoided
- output budget required

## What It Does Not Do

- It does not execute `codex exec`.
- It does not call a Provider.
- It does not read auth.json.
- It does not write Codex config.
- It does not modify `/chat`.
- It does not modify `/chat-gateway/execute`.
- It does not modify provider runtime.
- It does not deploy, release, push, or commit.
