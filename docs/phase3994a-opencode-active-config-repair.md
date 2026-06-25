# Phase3994A OpenCode Active Config Repair

## Goal

Phase3994A fixes the real restart surface for OpenCode MCP, LSP, and plugin loading by validating and repairing the active config layers:

- repo root `opencode.jsonc` / `opencode.json`
- project `.opencode/opencode.jsonc` / `.opencode/opencode.json`
- global `C:\Users\Administrator\.config\opencode\opencode.jsonc` / `opencode.json`

## Root Cause

Phase3993A verified the repo-root config, but OpenCode Desktop restart can still read stale global or project active config. The global JSON had a BOM, lacked formatter `$FILE`, did not include `filesystem_project`, and `opencode-tool-search` did not always load `task` and `skill`. The project `.opencode` folder also had no active `opencode.json/jsonc`.

## Boundaries

- providerCalled=false
- paidApiCalled=false
- no MiMo, OpenAI, Claude, or OpenRouter call
- no embedding batch training
- default /chat unchanged
- legacy/ unchanged
- no PROJECT_CONTEXT.md
- no commit, push, deploy, or release
- no API key or .env secret read/printed
- workspace clean is not claimed

## Repair

The repair script:

- regenerates root `opencode.json` from root `opencode.jsonc`
- copies project config into `.opencode/opencode.jsonc` and `.opencode/opencode.json`
- rewrites global OpenCode config with safe MCP/LSP/plugin defaults
- preserves destructive action denies
- changes `filesystem_*` to `ask` so project-scoped filesystem MCP is usable only with approval
- backs up changed global/project/root config files before overwriting

## Validation

Run:

```powershell
pnpm run run:phase3994a-opencode-active-config-repair
pnpm run verify:phase3994a-opencode-active-config-repair
node --test apps\ai-gateway-service\src\entrypoints\opencodeActiveConfigReadinessCore.test.js
```

OpenCode Desktop must be fully closed and restarted after repair for the running app process to reload global and project .opencode config. This phase verifies file-level readiness; it does not claim a real GUI MCP/LSP/plugin invocation unless that is manually tested after restart.

The launcher `tools/phase3993a/start-opencode-with-lsp.cmd` now sets `OPENCODE_CONFIG_DIR` and `OPENCODE_CONFIG` before starting OpenCode. This forces the desktop sidecar to load `C:\Users\Administrator\.config\opencode\opencode.json` plus the project `.opencode/opencode.json`, then opens the `E:\AI-Data\AI网关系统\unified-ai-system` workspace.

The Windows user environment is also configured with `OPENCODE_CONFIG_DIR=C:\Users\Administrator\.config\opencode`, `OPENCODE_EXPERIMENTAL=true`, and `OPENCODE_EXPERIMENTAL_LSP_TOOL=true` so future OpenCode launches use the same global config directory. `OPENCODE_CONFIG` is intentionally not persisted globally because it is project-specific.
