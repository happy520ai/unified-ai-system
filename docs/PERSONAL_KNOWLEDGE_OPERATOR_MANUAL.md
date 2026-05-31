# Personal Knowledge Operator Manual

Phase 254A consolidates Phases 246A-253A into a daily self-use Knowledge/RAG
operator manual.

## 1. Daily Knowledge Use

Every day:

1. Open `/ui`.
2. Read Personal Operator Console.
3. Check Knowledge Source Inventory.
4. Use Starter Pack.
5. Ask a Query Template.
6. Check citations.
7. Check freshness.
8. Feed result into Decision Dashboard or Next Codex Task.

## 2. First Source Selection

Start with README, AGENTS, closure docs, latest evidence, and package scripts.
Do not import broad `legacy/` content by default.

## 3. Asking Project Status

Ask: What is the current project status? Require latest evidence and closure
docs.

## 4. Asking Blocker

Ask: What is the current blocker? Require evidence, dirty workspace caution,
and boundary status.

## 5. Asking Next Step

Ask: What should I do next? Require Decision Dashboard and Action Queue context.

## 6. Reading Citations

Trust answers only when citations point to current docs or passed evidence.

## 7. Reading Freshness

Check phase number, evidence status, closure snapshot, and dirty workspace
state.

## 8. Conflict Handling

If sources conflict, mark uncertain and require re-verification.

## 9. Generating Next Codex Task

Turn an answer into manual handoff text only. Include goal, allowed scope,
blocked scope, verification, evidence, and stop condition.

## 10. Maintaining Knowledge

After each manual Codex round, add new docs/evidence only after verification
passes. Keep old evidence as history with lower priority.

## 11. Current Cannot-promised List

Do not promise any of these:

- Do not promise production vector RAG.
- Do not promise GraphRAG.
- Do not promise enterprise ACL sync.
- Do not promise multi-tenant knowledge base.
- Do not promise production knowledge governance.
- Do not promise real Codex exec.
- Do not promise workflow runner.
- Do not promise worktree creation.
- Do not promise automatic commit/push.
- Do not promise unattended automatic development.

## 12. Common Query List

- Current project status
- Current blocker
- Latest completed phase
- Sealed capabilities
- Preview-only capabilities
- Cannot-promised capabilities
- Next recommended action
- Required verification commands
- Latest evidence path
- Stop or continue decision

## 13. Common Verification Commands

```powershell
cmd /c pnpm run verify:phase254a-personal-knowledge-operator-manual
cmd /c pnpm run verify:phase253a-personal-knowledge-maintenance-loop
cmd /c pnpm run verify:phase252a-personal-knowledge-live-trial
cmd /c pnpm run verify:phase251a-personal-knowledge-ui-guide
cmd /c pnpm run verify:phase250a-personal-knowledge-freshness-guard
cmd /c pnpm run verify:phase249a-personal-knowledge-citation-report
cmd /c pnpm run verify:phase248a-personal-knowledge-query-templates
cmd /c pnpm run verify:phase247a-personal-knowledge-starter-pack
cmd /c pnpm run verify:phase246a-personal-knowledge-source-inventory
```

## 14. Stop Rules

Stop when:

- citations are missing
- evidence is missing or failed
- stale evidence conflicts with current closure
- dirty workspace is hidden
- Do not continue when an answer claims production RAG or GraphRAG.
- Do not continue when an answer claims enterprise ACL sync or multi-tenant knowledge base.
- Do not continue when an answer claims unattended development.

## 15. UI Prompt

The `/ui` Personal Operator Console should show Knowledge Operator Manual:

- Daily knowledge use
- First source selection
- Citation and freshness
- Conflict handling
- Next Codex task
- Stop rules

## 16. Boundary

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

## 17. Final Conclusion

Phase 254A gives the operator a daily manual for self-use Knowledge/RAG project
questions.
