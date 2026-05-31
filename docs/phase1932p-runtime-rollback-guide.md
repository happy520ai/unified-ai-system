# Phase1932P-Runtime Rollback Guide

Rollback is limited to removing the Phase1932P-Runtime additions:

- `apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js`
- `tools/phase1932p-runtime/`
- `docs/phase1932p-runtime-*.md`
- `apps/ai-gateway-service/evidence/phase1932p-runtime/`

Also remove the Phase1932P-Runtime package scripts from `package.json`.

Do not use `git reset --hard` or `git clean`. Do not modify `legacy/`, `PROJECT_CONTEXT.md`, `.env`, `auth.json`, or `/chat-gateway/execute`.
