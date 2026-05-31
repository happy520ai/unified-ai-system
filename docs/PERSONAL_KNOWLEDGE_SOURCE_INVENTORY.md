# Personal Knowledge Source Inventory

Phase 246A defines the self-use source inventory for project Knowledge/RAG.
It remains preview-only: local keyword retrieval, source load/list, RAG chat,
citation/highlight, and file/SQLite persistence only.

This phase does not add production vector RAG, GraphRAG, enterprise ACL sync,
multi-tenant knowledge base, production knowledge governance, real Codex exec,
workflow runner, worktree creation, automatic commit/push, or unattended
automatic development.

## 1. Purpose

The inventory tells the operator which `unified-ai-system` materials belong in
the self-use project knowledge base and how each source should be weighted.

## 2. Sources To Include

Include:

- `README.md`
- `AGENTS.md`
- `docs/`
- `apps/ai-gateway-service/evidence/`
- `.codex-handoff/`
- `package.json`
- `apps/ai-gateway-service/package.json`

Do not default-import `legacy/`. It is historical reference only.

## 3. Source Use

`README.md`:

- Use for broad project overview, command discovery, and local use flow.

`AGENTS.md`:

- Use for repository rules, ownership boundaries, phase boundaries, and
  forbidden actions.

`docs/`:

- Use for phase narratives, final manuals, closure snapshots, and current
  operator guidance.

`apps/ai-gateway-service/evidence/`:

- Use for machine-readable proof that a phase passed, failed, or skipped.

`.codex-handoff/`:

- Use for manual handoff, result review, feedback, and working-loop context.
  Treat it as review material until evidence seals it.

`package.json` and `apps/ai-gateway-service/package.json`:

- Use for command availability and verifier script mapping.

## 4. Questions By Source

- README: What is the system for and how do I start it?
- AGENTS: What is forbidden or owned by each package?
- docs: What did a phase claim to seal?
- evidence: Did the verifier pass?
- `.codex-handoff`: What was handed off or reviewed?
- package files: Which command exists and where does it run?

## 5. Boundary Reference Only

These sources can provide boundary context but should not override current
facts by themselves:

- old phase docs
- old evidence
- old handoff drafts
- commercial reports
- `legacy/` historical references

## 6. Legacy Rule

`legacy/` is historical reference only. It is not imported by default, not used
as current project status, and not treated as the active implementation.

## 7. Stale Evidence Guard

Do not treat old evidence as current status by default.

- Check phase number.
- Check generated timestamp.
- Check whether a later final or closure phase supersedes it.
- Prefer `passed` evidence over handoff claims.
- Mark stale evidence as context, not current fact.

## 8. Current Fact Priority

Use this order:

1. Latest phase evidence.
2. docs final/closure.
3. README/AGENTS.
4. older evidence.
5. legacy reference.

Do not treat an old phase as current status when a newer closure or evidence
file exists.

## 9. UI Prompt

The `/ui` Personal Operator Console should show Knowledge Source Inventory:

- Source inventory
- Source purpose
- Current fact priority
- Stale evidence guard
- Legacy is historical reference only

## 10. Required Verification

```powershell
cmd /c pnpm run verify:phase246a-personal-knowledge-source-inventory
```

## 11. Boundary

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

## 12. Final Conclusion

Phase 246A makes the source inventory explicit for local self-use Knowledge/RAG.
It is not production RAG or enterprise knowledge governance.
