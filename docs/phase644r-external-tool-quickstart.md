# Phase644R External Tool Quickstart

Run the dry-run tool pack locally:

```powershell
cmd /c pnpm install
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run codex:external-tool:preflight
```

Then inspect:

```powershell
cmd /c pnpm run verify:phase641r-external-tool-cli-wrapper
cmd /c pnpm run verify:phase644r-external-tool-open-source-dry-run-tool-pack
```

No Provider call is required. Do not place API keys in docs, evidence, logs, or
examples.
