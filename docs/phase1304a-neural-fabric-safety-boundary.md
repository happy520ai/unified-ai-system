# Phase1304A Neural Fabric Safety Boundary Verifier

## 1. Scope

Phase1304A is a safety-boundary verifier only.

- no eval
- no vm2
- no new Function
- no child_process.exec
- no Provider
- no secret reads
- no `/chat` modification
- no `/chat-gateway/execute` modification

This phase does not add runtime inference, provider integration, secret access, or main-chain wiring.

## 2. What It Verifies

The verifier asserts the following boundary facts:

- `noEval=true`
- `noVm2=true`
- `noNewFunction=true`
- `noChildProcessExec=true`
- `providerCallsMade=false`
- `secretRead=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`

These values are treated as hard safety outputs, not suggestions.

## 3. Files In Scope

- `tools/phase1304a/verify-neural-fabric-safety-boundary.mjs`
- `apps/ai-gateway-service/evidence/phase1304a/safety-boundary-result.json`
- `docs/phase1301a-neural-fabric-feasibility-whitepaper.md`
- `docs/phase1302a-neural-op-weight-atom-spec.md`
- `packages/neural-fabric-runtime/package.json`
- `packages/neural-fabric-runtime/src/index.js`
- `packages/neural-fabric-runtime/src/canonicalize.js`
- `packages/neural-fabric-runtime/src/contentAddress.js`
- `packages/neural-fabric-runtime/specs/neural-op.schema.json`
- `packages/neural-fabric-runtime/specs/weight-atom.schema.json`

## 4. Boundary Rules

The verifier must not:

- call Provider
- read secrets
- read `.env`
- call `eval`
- use `vm2`
- construct `new Function`
- use child-process exec paths
- modify `/chat`
- modify `/chat-gateway/execute`

## 5. Validation

Required commands:

```powershell
node --check tools/phase1304a/verify-neural-fabric-safety-boundary.mjs
pnpm run verify:phase1304a-neural-fabric-safety-boundary
pnpm run verify:phase107a-secret-safety
pnpm -r --if-present check
```

## 6. Seal Criteria

Phase1304A can be considered sealed only when:

- the verifier writes evidence;
- every listed safety check is true;
- no Provider, secret, `/chat`, or `/chat-gateway/execute` mutation occurs;
- the result file records the boundary facts explicitly.

