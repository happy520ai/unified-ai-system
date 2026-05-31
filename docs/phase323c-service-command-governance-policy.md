# Phase323C Service Command Governance Policy

本文件只定义 `apps/ai-gateway-service` package scripts 的推荐入口分层，不删除任何既有 scripts，不移动任何 entrypoints。

## Service Daily Core Commands

- `check`
- `build`
- `start`

## Service Workbench Regression Commands

- `verify:phase321a-workbench-product-recovery`
- `verify:phase322a-workbench-chat-gateway-real-nvidia`
- `verify:phase319a-functional-landing`

## Service Model-Library Commands

- `verify:phase313a-model-usability-matrix`
- `verify:phase312a-unified-model-library`
- `verify:phase314a-chat-gateway-task-closure`

## Service Safety Commands

- `verify:phase107a-secret-safety`

## Service Historical-Compatible Commands

- `benchmark:model-tier-routing`
- `benchmark:quality-cost-routing`
- `benchmark:rag-source-selection`
- `benchmark:response-cache`
- `benchmark:response-cache-hardening`
- `benchmark:system-capability`
- `benchmark:token-saving`
- `codex:desktop:audit`
- `codex:desktop:ingest`
- `codex:desktop:loop`
- `codex:desktop:reset-ready`
- `codex:desktop:review`
- `codex:desktop:send`
- `codex:desktop:status`
- `codex:desktop:test:internal`
- `codex:loop:status`
- `handoff:next-task`
- `import:public-knowledge:preview`
- `run:phase278a-free-model-daily-knowledge-enrichment`
- `run:phase290a-provider-cost-free-model-governance`

## Service Archive-Candidate Policy

- `smoke:phase308a-desktop-workbench-ui`
- `smoke:phase312a-chat-ui-runtime`
- `smoke:phase312a-nvidia-real-models`
- `smoke:phase313a-dry-run-model-verification-plan`
- `smoke:phase313a-nvidia-model-usability`
- `smoke:phase314a-chat-gateway-dry-run`
- `smoke:phase314a-nvidia-task-closure`
- `smoke:phase315a-chat-gateway-acceptance`
- `smoke:phase315a-human-journey-acceptance`
- `smoke:phase315a-nvidia-latency-timeout`
- `smoke:phase315a-provider-latency-dry-run`
- `smoke:phase315a-ui-acceptance`
- `smoke:phase316a-actual-ui-clickability`
- `smoke:phase317a-real-ui-runtime-click`
- `smoke:phase318a-chat-feature-realization`
- `smoke:phase319a-functional-landing`
- `smoke:phase320a-real-browser-full-module`
- `smoke:phase321a-workbench-product-recovery`
- `smoke:phase322a-workbench-chat-gateway-real-nvidia`
- `verify:phase100a`

## Forbidden-Dangerous Policy

- `run:phase282a-commit-readiness-preflight`
- `run:phase283a-ui-release-readiness-preflight`
- `run:phase284a-final-commit-package-clean-baseline-gate`
- `run:phase289a-deployment-runtime-stability`
- `verify:phase109a-deployment-readiness`
- `verify:phase112a-non-docker-release-check`
- `verify:phase114a-user-manual-release-pack`
- `verify:phase117a-cicd-release-gate`
- `verify:phase120a-git-initial-commit-preflight`
- `verify:phase121a-git-initial-commit-execution`
- `verify:phase128a-github-remote-push`
- `verify:phase129a-remote-release-status`
- `verify:phase131a-release-artifact-preflight`
- `verify:phase132a-release-decision-pack`
- `verify:phase133a-release-creation-confirmation`
- `verify:phase134a-release-creation-execution`
- `verify:phase135a-release-publish-preflight`
- `verify:phase136a-release-publish-execution`
- `verify:phase137a-release-draft-rollback`
- `verify:phase282a-commit-readiness-preflight`
- `verify:phase283a-ui-release-readiness-preflight`
- `verify:phase284a-final-commit-package-clean-baseline-gate`
- `verify:phase289a-deployment-runtime-stability`

## Notes

- governance source refreshed from `docs\phase323c-script-governance-policy.md`
- inventory source refreshed from `docs\phase323c-script-entrypoint-inventory.json`
- 本阶段不删除 service scripts，不移动 entrypoints。
