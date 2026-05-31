# Phase3979A OpenCode Autopilot Governor

## Goal

Add a bounded OpenCode autopilot governance layer that can:

1. hold a task queue,
2. pick the next safe task automatically,
3. enforce a strict command whitelist,
4. run `preflight -> diagnose -> execute -> review`,
5. stop automatically on verifier failure,
6. stop automatically on out-of-scope mutation,
7. stop automatically on request or cost cap breach,
8. write a report and blocker every round, and
9. persist a next-day resume state file.

## Boundary

- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.
- Do not read or print `.env`, API keys, secrets, or credentials.
- Do not commit, push, deploy, or release.
- Do not change the default `/chat` behavior.
- Do not bypass the existing `runner-control` or `safe-overnight-policy` guardrails.
- Do not call paid providers.

## Files

- `docs/automation/opencode-autopilot-task-queue.json`
- `docs/project-brain/opencode-autopilot-policy.json`
- `docs/project-brain/opencode-autopilot-state.json`
- `tools/phase3979a/run-opencode-autopilot-governor.mjs`
- `tools/phase3979a/read-opencode-autopilot-status.mjs`
- `tools/phase3979a/verify-opencode-autopilot-governor.mjs`
- `package.json`
- `opencode.jsonc`

## Execution Model

The runner is governance-first and dry-run-first:

1. Reads queue, policy, runner control, and safe overnight policy.
2. Stops immediately when paused or stop-requested.
3. Selects the next pending task from the queue using the persisted state.
4. Validates command whitelist and budget before execution.
5. Executes stage commands in order:
   - `preflight`
   - `diagnose`
   - `execute`
   - `review`
6. Detects new mutation deltas from `git status --porcelain` and stops if any delta escapes the task allowlist or managed paths.
7. Writes JSON and Markdown round reports plus an updated resume state.

## Verification

```powershell
node --check tools/phase3979a/run-opencode-autopilot-governor.mjs
node --check tools/phase3979a/read-opencode-autopilot-status.mjs
node --check tools/phase3979a/verify-opencode-autopilot-governor.mjs
cmd /c pnpm run verify:phase3979a-opencode-autopilot-governor
cmd /c pnpm run status:phase3979a-opencode-autopilot
cmd /c pnpm run verify:gvc-safe-overnight-mode
```

## Expected Outputs

- `apps/ai-gateway-service/evidence/phase3979a-opencode-autopilot-governor/latest-run.json`
- `apps/ai-gateway-service/evidence/phase3979a-opencode-autopilot-governor/latest-run.md`
- `apps/ai-gateway-service/evidence/phase3979a-opencode-autopilot-governor/round-*.json`
- `apps/ai-gateway-service/evidence/phase3979a-opencode-autopilot-governor/round-*.md`
- `docs/project-brain/opencode-autopilot-state.json`

## Seal Rule

This phase is `sealed/pass` only when:

- whitelist enforcement is active,
- budget stop is active,
- verifier-fail stop is active,
- out-of-scope stop is active,
- round reports are written,
- resume state is written, and
- the verifier passes without claiming workspace clean.
