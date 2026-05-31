# Personal Knowledge UI Guide

Phase 251A explains how to use `/ui` Knowledge/RAG for self-use project
queries. The UI remains preview-only.

## 1. Entering Knowledge Areas

After opening `/ui`:

1. Start from Personal Operator Console.
2. Read Project Knowledge Pack.
3. Read Knowledge Source Inventory.
4. Use Knowledge/RAG areas for source load/list and RAG chat.
5. Return results to Decision Dashboard.

## 2. Viewing Knowledge Sources

Use source load/list to confirm which files are loaded. Prefer the starter
pack before importing broad directories.

## 3. Understanding Source Load/List

Source load/list means:

- local file-oriented source visibility
- self-use project material selection
- not enterprise ingestion
- not ACL sync
- not multi-tenant governance

## 4. Using RAG Chat

Ask narrow questions:

- current status
- blocker
- latest phase
- verification commands
- evidence path
- boundary

## 5. Citation / Highlight

Check citation/highlight before trusting an answer. If no source is cited, mark
the answer uncertain.

## 6. Trust Check

Trust an answer more when:

- citations point to latest passed evidence
- final/closure docs agree
- README/AGENTS boundary agrees
- dirty workspace is acknowledged

## 7. Stale Answer Detection

An answer may be stale when:

- it cites old evidence
- it cites failed evidence
- it ignores latest closure
- Do not trust it when it claims production RAG or GraphRAG.

## 8. Convert To Next Codex Task

Convert a Knowledge/RAG answer into a Next Codex Task only when it provides:

- goal
- allowed scope
- blocked scope
- verification
- evidence expectation
- stop condition

## 9. Convert To Decision Dashboard Input

Use the answer as input for:

- current status
- blocker
- recommended next step
- option A/B/C
- stop/continue decision

## 10. UI Boundary

Current UI is preview-only:

- local keyword retrieval
- source load/list
- RAG chat
- citation/highlight
- file/SQLite persistence

Do not promise production vector RAG or GraphRAG.
Do not promise enterprise ACL sync or multi-tenant knowledge base.
Do not promise production knowledge governance.

## 11. UI Prompt

The `/ui` Personal Operator Console should show Knowledge UI Guide:

- Enter knowledge area
- Source load/list
- RAG chat
- Citation/highlight
- Trust and stale answer check
- Convert to next task

## 12. Required Verification

```powershell
cmd /c pnpm run verify:phase251a-personal-knowledge-ui-guide
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

Phase 251A makes the self-use Knowledge/RAG UI path clear without expanding
the product boundary.
