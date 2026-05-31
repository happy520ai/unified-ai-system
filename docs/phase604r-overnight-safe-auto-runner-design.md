# Phase604R Overnight Safe Auto Runner Design

## Scope

Phase604R defines a safe overnight queue for low-risk Codex maintenance work. It does not start a long-running loop, daemon, scheduled worker, provider request, deployment, release, tag creation, artifact transfer, or production rollout.

## Low-Risk Task Types

- Documentation completion and cross-link checks.
- Evidence index completion using existing local evidence files.
- Verifier creation for dry-run and local-only checks.
- UI dry-run copy wording fixes within the approved Mission Control and Codex Context Gateway UI files.
- Sample dry-run entry checks that do not call providers.
- Open-source readiness notes, local quickstart drafts, known limits, and contributor safety guidance.
- README and AGENTS managed block synchronization.
- Token-saving workflow checks around context pack, stale gate, and relevant-files scope.

## High-Risk Forbidden Types

- Reading, copying, printing, or scanning API keys, secrets, webhooks, auth tokens, or raw endpoint values.
- Calling OpenAI, Claude, OpenRouter, MiMo, NVIDIA, or any real provider.
- Writing user or project Codex config files.
- Modifying `/chat` or `/chat-gateway/execute`.
- Editing `legacy/` or `PROJECT_CONTEXT.md`.
- Starting background runners, daemon loops, relay/proxy processes, or unattended shell loops.
- Deployment, release, tag creation, artifact transfer, remote repository mutation, or generated billing artifacts.
- Restoring Yiyi, 3D, Character, floating avatar, or related modules.

## Stop Conditions

- Any task requests secret access, provider calls, deployment, release, tag creation, artifact transfer, or persistent config writes.
- Any task touches a forbidden path.
- Any validator reports stale context, missing relevant-files scope, or unsafe validation commands.
- Any UI task needs changes outside the allowed Mission Control or Codex Context Gateway UI files.
- Any operation would require human approval, paid API use, or production behavior.

## Evidence Policy

- Each queue item must produce local evidence only.
- Evidence may record paths, command names, pass/fail state, and sanitized summaries.
- Evidence must not contain API keys, webhook values, raw endpoint values, auth tokens, account identifiers, or provider response payloads.
- Evidence must include `workspaceCleanClaimed=false`.

## Validation Policy

- Every queue task must include explicit validation commands.
- Validation commands must be local-only and must not include deployment, release, tag creation, publish, or upload commands.
- The queue verifier must reject non-low-risk tasks and any task that allows provider calls, secret access, deployment, or high-risk auto-continue.
- Long-running execution is not part of this phase.

## Rollback Policy

- Rollback is file-scoped and must be described per task.
- No `git reset --hard`, destructive clean, or broad revert is allowed.
- Rollback notes must preserve evidence unless the user explicitly asks to remove generated evidence.

## Token-Saving Policy

- Prefer `.codex-context/current-context-pack.md` as the first read.
- Stop if context is stale.
- Use `.codex-context/relevant-files.json` as the default scope.
- Avoid full-repository scans except for narrowly scoped verifier checks.
- Reuse existing docs and evidence indexes instead of rereading unrelated trees.

## Open-Source Readiness Policy

- Open-source preparation is documentation and hygiene only in this phase.
- It may prepare checklists for license, quickstart, known limits, contributor safety, evidence index, and local dry-run guidance.
- It must not publish packages, create releases, push remotes, expose secrets, or claim the repository is ready for public release without later dedicated verification.
