# Phase1915A Rollback Guide

1. Delete the Phase1915A docs:
   - `docs/phase1915a-one-button-boss-mode-daily-loop.md`
   - `docs/phase1915a-owner-daily-report-contract.md`
   - `docs/phase1915a-execution-report.md`
   - `docs/phase1915a-overnight-execution-summary.md`
   - `docs/phase1915a-rollback-guide.md`

2. Delete the Phase1915A tools folder:
   - `tools/phase1915a/`

3. Delete the Phase1915A evidence folder:
   - `apps/ai-gateway-service/evidence/phase1915a/`

4. Remove the Phase1915A scripts from `package.json`.

5. Re-run the safety regressions:
   - `pnpm verify:phase107a-secret-safety`
   - `pnpm verify:phase321a-workbench-product-recovery`
   - `pnpm smoke:phase308a-desktop-workbench-ui`
   - `pnpm -r --if-present check`

6. Do not scan Desktop during rollback.
