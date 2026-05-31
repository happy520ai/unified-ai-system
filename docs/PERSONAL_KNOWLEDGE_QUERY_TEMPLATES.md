# Personal Knowledge Query Templates

Phase 248A defines the operator's daily Knowledge/RAG question templates.
Current mode remains preview-only local/self-use knowledge lookup.

Every template includes:

- question
- expected sources
- expected answer format
- stale evidence caution
- what not to conclude

## 1. Current Project Status

question: 当前项目做到哪了？

expected sources: latest phase evidence, docs final/closure, README, AGENTS.

expected answer format: current status, sealed phases, current blocker, next
decision point, citations.

stale evidence caution: older evidence may be historical only.

what not to conclude: do not claim production-ready, real execution, or clean
workspace unless current evidence proves it.

## 2. Current Blocker

question: 当前 blocker 是什么？

expected sources: latest evidence, closure docs, dirty workspace notes.

expected answer format: blocker, severity, why it blocks, recommended unblock
task.

stale evidence caution: a blocker can be superseded by later passed evidence.

what not to conclude: do not call blocker none when dirty workspace is relevant.

## 3. Latest Completed Phase

question: 最近完成的 phase 是什么？

expected sources: latest evidence directory, phase closure docs.

expected answer format: phase id, status, evidence path, conclusion.

stale evidence caution: sort by phase and verified status, not only timestamp.

what not to conclude: do not treat a failed phase as complete.

## 4. Sealed Capabilities

question: 哪些能力已经封板？

expected sources: closure snapshots and passed evidence.

expected answer format: capability list, phase id, evidence citation.

stale evidence caution: old sealed capability may be superseded or narrowed.

what not to conclude: do not broaden preview capability into production.

## 5. Preview-only Capabilities

question: 哪些能力只是 preview-only？

expected sources: AGENTS, personal docs, evidence safety fields.

expected answer format: capability, preview boundary, disabled fields.

stale evidence caution: verify latest safety fields.

what not to conclude: do not imply real Agent execution or real Codex exec.

## 6. Cannot-promised Capabilities

question: 哪些不能承诺？

expected sources: AGENTS, closure docs, safety evidence.

expected answer format: cannot-do list and reason.

stale evidence caution: check latest closure before answering.

what not to conclude: do not promise production vector RAG, GraphRAG,
enterprise ACL sync, multi-tenant knowledge base, or unattended development.

## 7. Recommended Next Step

question: 下一步推荐做什么？

expected sources: Decision Dashboard, Action Queue, latest evidence.

expected answer format: recommended route, reason, not recommended action,
verification.

stale evidence caution: rerun verifier if latest evidence is missing.

what not to conclude: do not automatically enter the next route.

## 8. Next Codex Task

question: Codex 下一轮该做什么？

expected sources: Action Queue, Decision Dashboard, Review & Evidence Loop.

expected answer format: bounded manual handoff with goal, allowed files,
blocked scope, verification, evidence, stop condition.

stale evidence caution: use latest passed phase.

what not to conclude: do not run Codex or enable real `codex exec`.

## 9. Required Verification Commands

question: 必须跑哪些验证命令？

expected sources: docs and package scripts.

expected answer format: command list, purpose, expected evidence.

stale evidence caution: package scripts can change after docs.

what not to conclude: do not mark complete without actually running commands.

## 10. Latest Evidence

question: 最近 evidence 在哪里？

expected sources: `apps/ai-gateway-service/evidence/`.

expected answer format: evidence path, status, conclusion, safety flags.

stale evidence caution: do not cite failed evidence as sealed.

what not to conclude: do not forge evidence.

## 11. Knowledge/RAG Boundary

question: Knowledge/RAG 当前边界是什么？

expected sources: knowledge docs, closure docs, evidence safety fields.

expected answer format: current local capabilities and cannot-do list.

stale evidence caution: old RAG demos may not be current.

what not to conclude: do not claim production vector RAG or GraphRAG.

## 12. Commercialization Fit

question: 现在是否适合商业化？

expected sources: personal closure, commercial report, decision dashboard.

expected answer format: yes/no/maybe, reason, next condition.

stale evidence caution: Phase 237A+ shifted priority to self-use.

what not to conclude: do not treat commercial advice as implemented product.

## 13. Real Codex Exec Fit

question: 现在是否适合真实 Codex exec？

expected sources: AGENTS, personal closure, Codex bridge docs.

expected answer format: readiness status, blockers, explicit gate required.

stale evidence caution: dry-run evidence is not real execution evidence.

what not to conclude: do not claim real Codex exec is enabled.

## 14. Stop Expansion

question: 现在是否应该停止扩线？

expected sources: Decision Dashboard, Action Queue, evidence.

expected answer format: stop/continue, reason, safe next action.

stale evidence caution: unresolved failed verifier means stop.

what not to conclude: do not continue when boundaries are unclear.

## 15. UI Prompt

The `/ui` Personal Operator Console should show Query Templates:

- Status question
- Blocker question
- Phase question
- Verification question
- Boundary question
- Stop question

## 16. Required Verification

```powershell
cmd /c pnpm run verify:phase248a-personal-knowledge-query-templates
```

## 17. Boundary

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

## 18. Final Conclusion

Phase 248A gives the operator reusable cited question templates for self-use
project knowledge lookup.
