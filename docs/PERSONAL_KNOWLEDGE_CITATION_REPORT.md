# Personal Knowledge Citation Report

Phase 249A defines how self-use Knowledge/RAG answers cite sources and avoid
unsupported project-state claims.

## 1. Purpose

Every answer about current project state must explain what source it used.
No-source assertions are not accepted as current status.

## 2. Status Citation Sources

For project status, cite:

- latest phase evidence
- final/closure docs
- README
- AGENTS
- relevant `.codex-handoff` review only as working-loop context

## 3. Phase Evidence Citation Rules

- Cite evidence path.
- Cite `status`.
- Cite conclusion.
- Cite disabled safety fields when discussing boundaries.
- Do not cite failed evidence as sealed.

## 4. Docs Citation Rules

- Prefer final/closure docs.
- Use phase docs for narrative and boundary.
- Mark older docs as historical when superseded.

## 5. README / AGENTS Citation Rules

- README supports user-facing overview and commands.
- AGENTS supports repository rules and hard boundaries.
- Neither replaces latest phase evidence.

## 6. Codex Handoff / Review Citation Rules

- Use handoff/review files as working-loop sources.
- Do not treat handoff text as sealed fact.
- Require matching verifier evidence before saying done.

## 7. Missing Citation

If citation is missing:

- Mark the answer uncertain.
- Ask for re-query or verification.
- Do not assert current state.

## 8. Stale Citation

When a citation is stale:

- Mention the phase and timestamp.
- Compare with newer evidence.
- Prefer latest closure and passed evidence.

## 9. Forbidden Citation Conclusions

Do not allow:

- Do not allow no-source assertion of current status.
- Do not allow commercial suggestion described as implemented capability.
- Do not allow preview-only described as production-ready.
- Do not allow production vector RAG or GraphRAG claims.
- Do not allow enterprise ACL sync claims.
- Do not allow multi-tenant knowledge base claims.

## 10. UI Prompt

The `/ui` Personal Operator Console should show Citation Report:

- Required citations
- Phase evidence citation
- Docs citation
- Handoff citation caution
- Missing citation means uncertain

## 11. Required Verification

```powershell
cmd /c pnpm run verify:phase249a-personal-knowledge-citation-report
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

Phase 249A makes citation required for self-use project status answers.
