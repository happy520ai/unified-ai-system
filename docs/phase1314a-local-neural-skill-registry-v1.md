# Phase1314A Local Neural Skill Registry v1

## Goal

Create a local Neural Fabric skill registry v1 that registers mock skills only. The registry records stable metadata for future routing and governance experiments without connecting to real external models or Providers.

## Scope

- Local registry only.
- Mock skills only.
- No real external model registration.
- No Provider integration.
- No Provider calls.
- No runtime inference.
- No model download.
- No training.
- No secret, API key, token, `.env`, or `auth.json` reads.
- No `/chat` or `/chat-gateway/execute` integration.

## Registry Fields

Every skill entry must include:

- `skillId`
- `atomId`
- `capability`
- `backend`
- `status`
- `riskLevel`
- `revoked`
- `evidenceRef`

## Mock Registry Entries

The initial registry contains only mock-local entries:

| skillId | atomId | capability | backend | status | riskLevel | revoked |
| --- | --- | --- | --- | --- | --- | --- |
| `mock.summarize.preview` | `atom.mock.summary.v1` | `summarize` | `mock-local` | `mock-only` | `low` | `false` |
| `mock.route.selector` | `atom.mock.router.v1` | `route-select` | `mock-local` | `mock-only` | `low` | `false` |
| `mock.revoked.fixture` | `atom.mock.revoked.v1` | `negative-control` | `mock-local` | `mock-only` | `medium` | `true` |

The revoked entry is a negative-control fixture for later governance and router policy checks. It is not a real external model and must not be executed.

## Safety Boundary

- realExternalModelRegistered=false
- providerConnected=false
- providerCallsMade=false
- secretRead=false
- secretValueExposed=false
- networkUsed=false
- chatModified=false
- chatGatewayExecuteModified=false

## Implementation Files

- `packages/neural-fabric-runtime/src/skillRegistry.js`
- `packages/neural-fabric-runtime/tools/check-skill-registry.mjs`
- `tools/phase1314a/verify-local-skill-registry.mjs`

## Evidence

`apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json`

## Verification

```powershell
node --check packages/neural-fabric-runtime/src/skillRegistry.js
node --check packages/neural-fabric-runtime/tools/check-skill-registry.mjs
node --check tools/phase1314a/verify-local-skill-registry.mjs
node packages/neural-fabric-runtime/tools/check-skill-registry.mjs
pnpm --filter @unified-ai-system/neural-fabric-runtime check
pnpm run verify:phase1314a-local-skill-registry
pnpm run verify:phase107a-secret-safety
pnpm -r --if-present check
```
