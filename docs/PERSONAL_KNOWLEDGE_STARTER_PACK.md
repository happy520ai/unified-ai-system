# Personal Knowledge Starter Pack

Phase 247A defines the first import set for the self-use project knowledge
base. It remains preview-only: local keyword retrieval, source load/list, RAG
chat, citation/highlight, and file/SQLite persistence only.

## 1. Purpose

The starter pack keeps the first import small, current, and useful for daily
project questions.

## 2. First Recommended Import Files

Start with:

- `README.md`
- `AGENTS.md`
- `docs/PERSONAL_VALUE_CLOSURE_SNAPSHOT.md`
- `docs/PERSONAL_OPERATOR_MANUAL_FINAL.md`
- `docs/PERSONAL_REVIEW_EVIDENCE_LOOP.md`
- `docs/PERSONAL_ACTION_QUEUE.md`
- `docs/PERSONAL_LIVE_TRIAL.md`
- `docs/PERSONAL_DECISION_DASHBOARD.md`
- latest evidence for phases 237A-245A
- `package.json`
- `apps/ai-gateway-service/package.json`

## 3. Why These First

- They describe current self-use status.
- They encode hard boundaries.
- They contain the latest sealed personal value conclusions.
- They map commands to verifier scripts.
- They reduce noise compared with importing everything.

## 4. Query Value By File

- README: startup and overview.
- AGENTS: rules and boundaries.
- closure docs: current final conclusions.
- personal operator docs: daily use and review loop.
- evidence files: proof of pass/fail state.
- package files: command availability.

## 5. Recommended Queries

- What is the current project status?
- What is the current blocker?
- Which personal value phases are sealed?
- What cannot be promised?
- Which verification command proves this?
- What should the next Codex handoff contain?

## 6. Not Recommended For First Import

Do not first-import:

- bulk `legacy/`
- old handoff drafts
- raw logs
- `.env`
- files that may contain secrets
- old commercial reports as current facts
- unrelated generated evidence

## 7. Noise Control

- Import a small set first.
- Prefer current closure docs.
- Prefer latest evidence.
- Exclude historical or duplicate sources.
- Re-import only after a verifier passes.

## 8. Dirty Workspace Knowledge Updates

When the workspace is dirty:

- Do not describe the workspace as clean.
- Treat uncommitted content as provisional.
- Prefer sealed evidence over dirty draft files.
- Only update knowledge posture after verification passes.

## 9. Refresh After A Codex Round

After a manual Codex round:

1. Review the result.
2. Run the matching verifier.
3. Refresh evidence only after it passes.
4. Add the new final doc or evidence to the starter pack.
5. Keep rejected or failed results out of current facts.

## 10. UI Prompt

The `/ui` Personal Operator Console should show Knowledge Starter Pack:

- Starter files
- Why first
- Query value
- Noise control
- Dirty workspace refresh

## 11. Required Verification

```powershell
cmd /c pnpm run verify:phase247a-personal-knowledge-starter-pack
```

## 12. Boundary

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

## 13. Final Conclusion

Phase 247A gives the operator a small, useful first import set for daily
self-use project questions.
