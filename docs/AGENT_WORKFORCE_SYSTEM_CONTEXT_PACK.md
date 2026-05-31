# Agent Workforce System Context Pack

Phase: 221A

## One-line System Summary

`unified-ai-system` is currently a local AI Gateway + Agent Workforce Preview
console. It supports a local `/ui`, the NVIDIA `/chat` main lane,
Knowledge/RAG preview, Agent Workforce plan generation, Codex handoff, and a
manual/controlled Codex result feedback bridge.

## Completed Capabilities

- `/ui` local web console.
- Setup readiness checks.
- NVIDIA `/chat` main lane.
- Knowledge/RAG preview.
- Agent Workforce Preview.
- Product templates for common planning flows.
- Saved plans and history.
- JSON and Markdown export.
- Codex Desktop Handoff Pack.
- Manual / controlled Codex bridge.
- Codex result inbox and feedback outbox.
- Controlled Codex loop dry-run.
- Real browser UI trial passed.

## Current Agent Workforce State

- Phase 142A-199A completed.
- Preview product baseline sealed.
- UX polish closure sealed.
- Manual trial baseline sealed.
- Real browser UI trial passed.
- Phase 200A-220A adds real UI final seal, Codex Desktop handoff, manual
  result bridge, feedback generation, and controlled loop dry-run.

## Strict Boundaries

- no real Agent execution
- no automatic Codex execution by default
- no worktree creation
- no workflow run hookup
- no external runner dispatch
- no default NVIDIA `/chat` lane change
- no legacy changes
- no `PROJECT_CONTEXT.md`
- no automatic commit or push
- no plaintext API keys in logs, evidence, handoff, inbox, review, or run files
- preview baseline is not a production execution release

## Default Verification Commands

```powershell
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm -r --if-present check
```

## Handoff Use

Use this context pack when creating Agent Workforce task packages or Codex
handoffs so generated tasks understand the current product state, completed
preview baselines, and boundaries that must not be crossed.
