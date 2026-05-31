# Personal Knowledge Freshness Guard

Phase 250A prevents old docs, old evidence, and old phase framing from
misleading current project decisions.

## 1. Current Fact Order

Use this order:

1. Latest passed phase evidence.
2. Latest closure snapshot.
3. Current final/operator docs.
4. README/AGENTS.
5. Older evidence.
6. Historical `legacy/` reference.

## 2. Latest Evidence Rule

Latest passed evidence wins when it directly verifies the same phase or
capability.

## 3. Phase Number Rule

Higher phase numbers usually supersede older phase framing, but only when the
higher phase has passed evidence.

## 4. Closure Snapshot Rule

Closure snapshots summarize completed lines and should guide current answers
when their evidence is passed.

## 5. Stale Evidence Warning

Warn when:

- evidence is old
- status is failed
- status is missing
- a newer phase changes the framing
- a handoff claim lacks verifier evidence

## 6. Dirty Workspace Warning

Dirty workspace means:

- current files may contain provisional changes
- do not describe workspace as clean
- cite passed evidence before calling a result sealed

## 7. Timestamp Caution

Document update time does not equal current truth. Verification status and
phase order matter more.

## 8. Conflict Handling

When sources conflict:

1. Prefer latest passed evidence.
2. Prefer closure docs over older plans.
3. Mark unresolved conflicts uncertain.
4. Require re-verification when current status matters.

## 9. Marking Uncertain

Use `uncertain` when:

- citation is missing
- evidence is stale
- dirty workspace overlaps the answer
- phase status is failed or missing

## 10. Re-verification Triggers

Require re-verification when:

- evidence is missing
- verifier failed
- docs changed after evidence
- package scripts changed
- boundary claims are unclear
- dirty workspace could affect the answer

## 11. UI Prompt

The `/ui` Personal Operator Console should show Freshness Guard:

- Current fact order
- Latest evidence first
- Phase number caution
- Closure snapshot priority
- Dirty workspace warning
- Mark uncertain

## 12. Required Verification

```powershell
cmd /c pnpm run verify:phase250a-personal-knowledge-freshness-guard
```

## 13. Boundary

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

## 14. Final Conclusion

Phase 250A adds freshness rules so Knowledge/RAG answers can say when an answer
is current, stale, or uncertain.
