# Agent Workforce Local Operator Runbook

This runbook is for local operators running the Agent Workforce Preview
console. The product is preview-only and does not execute code.

## Install dependencies

```powershell
cmd /c pnpm install
```

## Start

```powershell
cmd /c pnpm dev:phase7b
```

## Stop

```powershell
cmd /c pnpm stop:phase9c
```

## Status

```powershell
cmd /c pnpm status:phase10a
```

## Health

```powershell
cmd /c pnpm health:phase12a
```

## Doctor

```powershell
cmd /c pnpm doctor:phase13a
```

## Open /ui

Open the local service UI, then enter the Agent Workforce panel. Choose a
template, generate a plan, save it, review history, and export JSON or
Markdown.

## Agent Workforce verification

```powershell
cmd /c pnpm run verify:phase180a-final-product-decision-gate
cmd /c pnpm run verify:phase179a-full-preview-regression-sweep
cmd /c pnpm run verify:phase171a-verification-matrix
```

## Common questions

- Does it execute code? No. It does not execute code.
- Does it call oh-my-codex? No.
- Does it create worktrees? No.
- Is it preview-only? Yes. Execution disabled, External Runner disabled, and
  workflow run disabled are intentional states.
