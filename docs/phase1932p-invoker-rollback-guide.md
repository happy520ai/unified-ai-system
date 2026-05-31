# Phase1932P-Invoker Rollback Guide

Remove:
- `apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.js`
- `apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.contract.js`
- `tools/phase1932p-invoker/`
- `apps/ai-gateway-service/evidence/phase1932p-invoker/`
- `docs/phase1932p-invoker-*.md`

Then revert only the Phase1932P-Invoker edits in:
- `apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js`
- `tools/phase1932p/run-guarded-real-provider-stability-test.mjs`
- `tools/phase1932p/validate-guarded-real-provider-stability-test.mjs`
- `package.json`

Do not use `git reset --hard` or `git clean`.
