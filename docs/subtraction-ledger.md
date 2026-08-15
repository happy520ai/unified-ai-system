# Subtraction Ledger (D-Track)

Record of the "subtract before adding" decisions from the 2026-08
beyond-industry roadmap. Archive-first: code is disabled or annotated in
place and stays reversible; physical removal is a dedicated follow-up PR per
item so quality-trend assertions and public-clone evidence can be rebalanced
deliberately (D5).

## Executed (2026-08-15)

| Item | Decision | Evidence |
| --- | --- | --- |
| D4 forge-core embedding | The gateway-side embedding (`application/forgeGatewayService.js`) is dead code — zero callers; the gateway never started forge. Default flipped to explicit opt-in (`FORGE_ENABLED !== "true"` returns null) and the module is annotated as an archived, unwired embedding. `packages/forge-core` itself is untouched (its 2,683 package tests keep running). | `git grep createForgeGatewayService` → only the definition. |
| Dead route modules archived | `http/routes/legacyRoutes.js` and `http/enterpriseRoutes.js` have zero importers (live routes: `httpServerRoutes01-06`, `httpServerCapabilityRoutes.js`). Annotated `ARCHIVED` in place; the permission-consistency checker still scans them, so their tables stay accurate. | `git grep` importers → none. |
| Dead API key manager revived or removed | `enterprise/apiKeyManager.js` was dead code; it is now the live backing store for virtual keys (P1.1). | P1.1 commit. |

## Documented for follow-up removal PRs

| Item | Inventory | Why not removed now |
| --- | --- | --- |
| D2 taiji-beidou preview hooks | Three invocation sites can short-circuit responses: `httpServerChatRoutes.js:69`, `httpServerRoutes02.js:377`, `httpServerRoutes06.js:306`, plus `src/gateway/taijiBeidou*` and `src/capabilities/aiNeurogenesisCompiler.js` imports from `@unified-ai-system/taiji-beidou-engine`. | Unwiring changes observable route behavior (dry-run short-circuits); needs its own test-triage PR. The engine package remains a workspace member. |
| D3 three-mode / capabilities simulation layer | `three-mode/`, `capabilities/` (godReviewCellExecutor, selfEvolutionPipeline, aiNeurogenesisCompiler, tianshu) execute as preview/dry-run only. | Routes are contract-tested; 410-ing or deleting them requires re-balancing route permission tables, runtime route coverage (currently 131), and quality evidence assertions in the same change. |
| forge-core package (92k lines) | Overlaps the gateway's own orchestration/budget/metrics. | Removal or extraction is a repository-level decision (workspace, CI matrix, quality trend history). The gateway-side embedding is already disabled (above), so the runtime surface is already clean. |

Rule going forward: any subtraction PR must keep `pnpm check`, `pnpm test`,
`pnpm check:public`, and `pnpm verify:public-clone` green and must re-balance
`tools/quality-evidence-assertions.*.json` explicitly (D5) — no silent
quality-score drops.
