# Safe Refactor Harness

## A. Phase294A 目标和边界
Phase294A is a local-only, static-guardrail-only phase. It does not perform real refactors, file moves, provider path changes, business logic changes, local agent execution, worktree creation, workflow runner execution, release, deploy, commit, push, or real Codex exec.

This phase exists to add a local safety harness before any future low-risk extraction work starts in Phase295A.

## B. 上游 Phase285A-293A 依赖
Phase294A depends on the already verified Phase285A-293A baseline, especially:

- Phase292A Architecture Refactor Readiness Plan
- Phase293A Module Boundary Map and Dependency Direction Review

Phase294A does not replace those phases. It only adds one more local static guardrail layer on top of them.

## C. 当前允许的依赖方向规则
The currently allowed dependency direction rules are:

- `apps/ai-gateway-service` may depend on `packages/shared-contracts`
- `apps/ai-gateway-service` may depend on `packages/shared-sdk`
- `apps/ai-gateway-service` may depend on `packages/shared-config`
- `apps/ai-gateway-service` may depend on `packages/shared-utils`
- `apps/agent-console` may depend on shared packages through stable package surfaces
- `packages/shared-sdk` may depend on `packages/shared-contracts`
- `packages/shared-sdk` may depend on `packages/shared-config`
- `packages/shared-sdk` may depend on `packages/shared-utils`
- `packages/shared-config` may depend on `packages/shared-utils`

These rules describe the current safe direction baseline only. They do not claim the architecture is already fully refactored.

## D. 当前禁止的依赖方向规则
The currently forbidden dependency direction rules are:

- `packages/shared-*` must not depend on `apps/*`
- `apps/agent-console` must not treat `apps/ai-gateway-service/src/*` as a stable public API
- shared packages must not depend on provider adapter internals
- `legacy/` must not become a runtime dependency target
- `PROJECT_CONTEXT.md` must not be created and must not enter the workflow

Historical coupling that already exists may be recorded as warning, but it must not be presented as a newly approved direction.

## E. Provider 边界保护规则
Provider boundary protection rules for Phase294A are:

- Do not move or rename default NVIDIA `/chat` mainline paths
- Do not move provider adapters, registries, credential stores, or provider mapping files
- Do not promote provider internals into shared package public surfaces
- Do not claim provider path normalization, consolidation, or extraction is complete
- Do not call paid API, MiMo API, embedding, or external provider API

Phase294A checks these boundaries statically. It does not change them.

## F. legacy/ 与 PROJECT_CONTEXT.md 边界规则
Boundary rules for `legacy/` and `PROJECT_CONTEXT.md` are:

- `legacy/` remains read-only reference only
- No modification under `legacy/`
- No runtime import target under `legacy/`
- `PROJECT_CONTEXT.md` must not exist
- Any attempt to introduce either into the active runtime path is a boundary violation

## G. 外部调用禁止规则
Phase294A forbids all external execution and external API use, including:

- paid API
- MiMo
- embedding
- external provider call
- release
- deploy
- commit
- push
- workflow runner
- real Codex exec

The verifier only performs local static checks and local file reads.

## H. 文件移动 / 真实重构禁止规则
Phase294A forbids:

- file moves
- file renames
- file deletion as refactor work
- directory reshaping
- real module extraction
- provider path migration
- default NVIDIA `/chat` path change
- business logic refactor

If a change would alter runtime ownership or path structure, it is outside the scope of this phase.

## I. Harness 检查项清单
The harness checks the following:

1. Phase294A document exists
2. Phase294A evidence JSON exists
3. Phase294A evidence Markdown exists
4. Root `package.json` contains `verify:phase294a-safe-refactor-harness`
5. Service `package.json` contains `verify:phase294a-safe-refactor-harness`
6. Phase292A verifier entrypoint still exists
7. Phase293A verifier entrypoint still exists
8. `PROJECT_CONTEXT.md` does not exist
9. Evidence JSON keeps all required safety flags at `false` and `paidApiCallCount=0`
10. Document contains all required section markers

## J. 失败等级定义：fatal / warning / informational
Failure levels are defined as:

- `fatal`: the harness contract is broken and Phase295A must not start
- `warning`: historical coupling or risk is present and must be carried forward carefully
- `informational`: a local observation or status note with no blocking effect

Only an actual contract break should be treated as fatal in this phase.

## K. Phase295A 启动前必须满足的条件
Before Phase295A starts, all of the following must hold:

- Phase292A verifier still passes
- Phase293A verifier still passes
- Phase294A verifier passes
- `PROJECT_CONTEXT.md` still does not exist
- No new fatal boundary breach is introduced
- No real refactor has been performed under the name of Phase294A
- No provider path change has been introduced
- No default NVIDIA `/chat` mainline change has been introduced

## L. 不可声称能力说明
Phase294A must not claim any of the following:

- real architecture refactor completed
- real module extraction completed
- provider boundary redesign completed
- production-safe multi-agent execution completed
- release or deploy completed
- workspace clean
- default NVIDIA `/chat` mainline changed safely
- Phase295A already started

Phase294A is only a local static safety harness for future low-risk work.
