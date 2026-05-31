# Personal Knowledge Live Trial

Phase 252A defines a real self-use Knowledge/RAG trial flow. It is
preview-only and does not enable production RAG or GraphRAG.

## 1. Trial Goal

Prove the operator can ask project-status questions over selected current
project sources with citations, freshness checks, blocker judgment, and a next
task output.

## 2. Pre-trial Checks

Before the trial:

- Verify Phase 245A is passed.
- Confirm starter pack sources.
- Confirm dirty workspace is visible when present.
- Confirm no secrets are imported.
- Confirm Knowledge/RAG is local/self-use preview only.

## 3. Recommended Sources

Use:

- README
- AGENTS
- personal closure docs
- personal knowledge docs
- latest evidence
- package scripts

## 4. Recommended Questions

- What is the current project status?
- What is the current blocker?
- Which phases are sealed?
- What is Knowledge/RAG boundary?
- What should the next task be?

## 5. Expected Answer Format

Each answer should include:

- answer
- cited sources
- freshness note
- blocker note
- what not to conclude
- next action candidate

## 6. Citation Check

Pass only when citations point to current docs or latest passed evidence.

## 7. Freshness Check

Pass only when stale evidence is not treated as current fact.

## 8. Blocker Judgment

The answer should say whether blocker is none, dirty workspace, missing
evidence, failed verification, or boundary risk.

## 9. Next Task Generation

Generate a next task only as manual handoff text with allowed scope, blocked
scope, verification, expected evidence, and stop condition.

## 10. Stop Conditions

Stop when:

- citation is missing
- evidence is failed or missing
- Do not continue when an answer claims production RAG or GraphRAG.
- Do not continue when an answer treats dirty workspace as clean.
- Do not continue when an answer proposes real Codex exec, worktree, workflow runner, or commit/push.

## 11. Pass / Fail Decision

passed: answers are cited, fresh, boundary-safe, and useful for next action.

failed: citation, freshness, boundary, or evidence checks fail.

## Required live-trial markers

- answers cite sources
- freshness is checked
- blocker is identified
- next task is generated
- stop condition is checked
- preview-only boundaries are preserved
- no production vector RAG
- no GraphRAG
- no enterprise ACL sync
- no multi-tenant knowledge base
- no real Codex exec
- no workflow runner
- no worktree creation
- no auto commit/push
- no unattended development

中文说明：

- 回答必须引用来源，不能无来源断言当前状态。
- 每次回答必须检查 freshness，避免旧 evidence 或旧 phase 误导。
- 必须识别 blocker，不能把 blocked 状态写成 passed。
- 可以生成下一步任务建议，但不自动进入执行。
- Knowledge/RAG 仍是自用 preview-only，不是生产级 vector RAG / GraphRAG。
- 不接真实 Codex exec、不创建 worktree、不接 workflow runner、不自动 commit/push。

## 12. UI Prompt

The `/ui` Personal Operator Console should show Knowledge Live Trial:

- Trial goal
- Pre-trial checks
- Recommended sources
- Recommended questions
- Citation and freshness checks
- Stop condition

## 13. Required Verification

```powershell
cmd /c pnpm run verify:phase252a-personal-knowledge-live-trial
```

## 14. Boundary

This phase must not:

- Modify `legacy/`
- Create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit or push
- Do not change the default NVIDIA `/chat` mainline
- Do not promise unattended automatic development
- Do not promise production-grade vector RAG or GraphRAG
- Do not promise enterprise ACL sync
- Do not promise multi-tenant knowledge base
- Do not promise production knowledge governance
- Do not describe preview-only capability as production-ready
- Do not write real API keys
- Do not treat approval-preview as execution authorization
- Do not describe dirty workspace as clean
- Do not forge phase evidence

## 15. Final Conclusion

Phase 252A defines a self-use trial for cited, fresh, boundary-safe project
knowledge answers.
