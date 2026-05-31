# Personal Knowledge Maintenance Loop

Phase 253A defines how the operator keeps project knowledge current after each
manual Codex round.

## 1. Purpose

The maintenance loop prevents the knowledge base from becoming noisy, stale, or
commercially misframed.

## 2. Documents To Check After Each Codex Round

Check:

- changed docs
- new phase docs
- new evidence
- README
- AGENTS
- package scripts
- Codex handoff/review files

## 3. New Phase Evidence

Add new phase evidence only after the verifier passes. Failed evidence stays
available as history but not current fact.

## 4. New Docs

Add new docs when they are final, reviewed, and supported by evidence.

## 5. Older Evidence

Keep older evidence but lower its priority behind latest phase evidence and
closure snapshots.

## 6. README/AGENTS Sync

Sync README/AGENTS only when boundaries or commands actually change. Do not
rewrite them for every trial.

## 7. Current Blocker Record

Record current blocker as:

- none
- dirty workspace
- failed verifier
- missing evidence
- stale knowledge
- boundary risk

## 8. Next Step Record

Record one next step from Decision Dashboard and Action Queue.

## 9. Noise Prevention

- Do not import broad old directories.
- Do not duplicate the same evidence repeatedly.
- Do not import raw logs with possible secrets.
- Do not let old commercial wording override current self-use facts.

## 10. Commercial Misframe Prevention

Commercial reports remain context only unless a later phase revives that route.
Do not describe commercial suggestions as current implemented capabilities.

## 11. Stop Maintenance

Stop and wait for human judgment when:

- sources conflict
- verification failed
- evidence is missing
- dirty workspace overlap is unclear
- boundary risk appears

## Required maintenance-loop markers

- Add new phase evidence only after the verifier passes.
- Keep older evidence but lower its priority behind latest phase evidence.
- Sync README/AGENTS only when boundaries or commands actually change.
- record the current blocker
- record the next safe action
- Prevent commercial suggestions from becoming current implementation facts.
- Stop maintenance
- new phase evidence is added
- new docs are added
- old evidence is downgraded
- README and AGENTS are synchronized
- current blocker is recorded
- next task is recorded
- duplicate knowledge is avoided
- commercial claims are not treated as current facts
- maintenance can stop for human decision
- answers cite sources
- freshness is checked
- blocker is identified
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

- 每轮 Codex 之后，新的 phase evidence 和 docs 可以纳入知识维护。
- 旧 evidence 要保留但降权，不能当成最新事实。
- README / AGENTS 只能做边界和口径同步，不能替代最新 evidence。
- 当前 blocker 和下一步任务必须记录。
- 避免重复知识、噪音知识和旧商业口径污染当前事实。
- 知识维护可以停止并等待人工判断。
- Knowledge/RAG 仍是 preview-only 自用范围，不是生产级 vector RAG / GraphRAG。
- 不接真实 Codex exec、不创建 worktree、不接 workflow runner、不自动 commit/push。

## 12. UI Prompt

The `/ui` Personal Operator Console should show Maintenance Loop:

- New evidence update
- New docs update
- Older evidence lowered
- README/AGENTS sync
- Blocker and next step
- Stop for human judgment

## 13. Required Verification

```powershell
cmd /c pnpm run verify:phase253a-personal-knowledge-maintenance-loop
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

Phase 253A keeps self-use knowledge current after manual Codex rounds without
turning the system into unattended automation.
