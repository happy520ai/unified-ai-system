# Phase1310A Neural Fabric Governance Spec

## Goal

Define the Neural Fabric governance layer for capability, epoch, revocation, and signature policy without enabling runtime behavior.

This phase is limited to docs/spec/verifier work. It does not implement real signing keys, does not generate private keys, does not read secret material, does not call Providers, and does not connect Neural Fabric to `/chat` or `/chat-gateway/execute`.

## Governance Terms

### capability

A capability is a declared permission surface for a Neural Fabric artifact such as `neural-op`, `weight-atom`, `adapter-atom`, `router-op`, or a governance policy. Phase1310A capabilities are metadata-only. They may describe, validate schema, dry-run score, render read-only status, or write evidence. They must deny provider calls, model execution, model training, model downloads, secret reads, private key generation, main-chain integration, `/chat` mutation, and `/chat-gateway/execute` mutation.

### epoch

An epoch is a versioned governance window for a capability policy. It records an `epochId`, monotonic `sequence`, state, activation policy, and rollback policy. Activation requires verifier pass and evidence. Any future runtime use must require explicit human approval outside this phase.

### revocation

Revocation is the governance path for disabling or blocking capabilities. It records revocation status, reasons, affected capability IDs, and emergency-disable allowance. Revocation can be triggered by safety boundary violations, schema incompatibility, stale epoch, missing evidence, failed manual review, or superseding policy.

### signature policy

The signature policy defines how signatures should be represented at the metadata level. Phase1310A supports `schema_only`, `metadata_only`, and `manual_review_required` verification modes. It may require a detached signature in a future phase, but this phase does not implement real signing keys, does not generate private keys, and does not read secret material.

## Schema Contract

The canonical schema is:

`packages/neural-fabric-runtime/specs/capability-policy.schema.json`

Required root fields:

- `schemaVersion`
- `kind`
- `id`
- `capability`
- `epoch`
- `revocation`
- `signaturePolicy`
- `safety`

The root `kind` is fixed to `capability-policy`.

## Safety Boundary

- Scope: docs/spec/verifier.
- 不实现真实签名密钥。
- 不生成私钥。
- 不读取 secret。
- No Provider calls.
- No model execution.
- No model training.
- No model download.
- No `/chat` modification.
- No `/chat-gateway/execute` modification.
- No main-chain integration.
- No production readiness claim.

## Evidence

Phase1310A writes:

`apps/ai-gateway-service/evidence/phase1310a/governance-spec-result.json`

Evidence must record:

- `providerCallsMade=false`
- `secretRead=false`
- `secretValueExposed=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
- `trainingExecuted=false`
- `modelDownloaded=false`
- `workspaceCleanClaimed=false`

## Verification

```powershell
node --check tools/phase1310a/verify-neural-fabric-governance-spec.mjs
pnpm run verify:phase1310a-neural-fabric-governance-spec
pnpm --filter @unified-ai-system/neural-fabric-runtime check
pnpm run verify:phase107a-secret-safety
pnpm -r --if-present check
```
