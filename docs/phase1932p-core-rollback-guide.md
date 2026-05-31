# Phase1932P-Core Rollback Guide

To roll back this phase only, remove:
- `apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.js`
- `apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js`
- `tools/phase1932p-core/`
- `apps/ai-gateway-service/evidence/phase1932p-core/`
- `docs/phase1932p-core-*.md`

Then revert only the Phase1932P-Core edits in:
- `apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js`
- `tools/phase1932p/run-guarded-real-provider-stability-test.mjs`
- `tools/phase1932p/validate-guarded-real-provider-stability-test.mjs`
- `package.json`

Do not use `git reset --hard` or `git clean`.
