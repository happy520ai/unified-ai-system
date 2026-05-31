# Phase308D Actual Screenshot UI Acceptance Repair

## A. Goal And Boundary

Phase308D repairs the actual `/ui` screenshot failures reported after Phase308C. It is UI, copy, verifier, evidence, and documentation reconciliation only. It does not change backend routes, provider behavior, `/chat` defaults, agent-runner execution logic, patch runner behavior, or auto review behavior.

## B. Screenshot Failures

The failed screenshot showed old English or mixed labels in the sidebar, model page, Inspector, Local Agent workflow, and command search placeholder. It also showed a dangerous `.env` / API key example and proved that the previous verifier was too marker-oriented.

## C. Actual UI Repair

The repaired UI must render Chinese-first labels in the real `createConsolePage()` HTML:

- Sidebar: 快速对话, 全局搜索, 知识库, 模型配置, 本地智能体, 审批任务, 安全修复, 使用帮助, 系统设置, 诊断中心.
- Models page: 模型配置 with Provider, Base URL, Model ID, API Key 状态, disabled save reason, and safety notes.
- Inspector: 当前上下文, 当前任务, 安全边界, 审批与文件, 证据 / 回滚.
- Local Agent: 确认执行, 预览意图, 生成补丁方案, 批准应用, 运行自动审查, 停止 / 重置当前操作.
- Command search placeholder: 搜索页面、功能、知识库、本地智能体、安全修复、帮助.

## D. Dangerous Example Removal

The UI must not contain examples that ask to read `.env` or reveal an API key. Safe examples must use bounded repo-relative files.

## E. Verifier Upgrade

The Phase308C verifier and the Phase308D verifier must call `createConsolePage()` and inspect the returned HTML. They must not pass by checking only i18n keys, source markers, hidden compatibility text, or evidence.

The verifier separates actual visible Chinese UI from the English `en-US` i18n dictionary so bilingual support remains valid while Chinese screenshot acceptance is still strict.

## F. Phase303A-305A Evidence Self-lock Reconciliation

Phase303A-305A reconciliation is allowed only after the actual UI checks pass. The verifier may stop treating a stale evidence `status=fail` as a permanent blocker, but it must keep all safety-field checks for full_open, commit, push, deploy, release, legacy, PROJECT_CONTEXT.md, default NVIDIA `/chat`, and workspace clean claims.

## G. Safety Boundary

- No `full_open`.
- No commit / push / deploy / release.
- No `.env` / secrets reads.
- No `legacy/` modification.
- No `PROJECT_CONTEXT.md`.
- No backend route or execution logic change.
- Workspace dirty is informational only and must not be called clean.

## H. Acceptance Checklist

- Real rendered `/ui` no longer shows old sidebar subtitles in Chinese mode.
- Model page is a useful 模型配置 page, not an empty Models / Providers / Plugins shell.
- Inspector is user-facing Chinese, not debug English.
- Local Agent flow is Chinese-first and keeps approval boundaries.
- Dangerous secret examples are removed.
- Search placeholder is Chinese-first.
- Sidebar toggle and automation confirm run remain functional.
- Phase308C and Phase308D verifiers pass with actual rendered HTML checks.
- Phase303A-305A verifier passes after self-lock reconciliation.

## I. Not Claimed

This phase does not claim production release, cloud deployment, public multi-user readiness, provider save capability, paid provider calls, automatic repair, automatic apply, automatic commit, automatic push, automatic deploy, automatic release, or clean workspace.

## J. Next Suggestion

After verification passes, reopen `http://127.0.0.1:3100/ui?ts=308d` for screenshot acceptance. Do not start a later phase automatically.
