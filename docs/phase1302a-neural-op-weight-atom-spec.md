# Phase1302A Neural-op Manifest + Weight Atom Spec

## 1. Scope

Phase1302A is schema/spec only.

- 不执行模型
- 不训练
- 不下载模型
- 不接主链
- 不调用 Provider
- 不读取 secret
- 不修改 `/chat`
- 不修改 `/chat-gateway/execute`

This phase defines the manifest language for future Neural Fabric work. It does not implement runtime behavior.

## 2. Terms

### neural-op

`neural-op` is a manifest-level operation descriptor. It describes a capability, its bucket, evidence policy, execution boundary, safety boundary, optional adapter atoms, optional router ops, and optional weight atom references.

It is not a model call. It is not a Provider adapter. It does not execute anything by itself.

### weight-atom

`weight-atom` is a reference-only descriptor for model weights or weight-like artifacts. In Phase1302A it may only describe source, shape, storage reference, verification state, runtime policy, and safety policy.

It must not embed raw weights. It must not download weights. It must not train weights.

### adapter-atom

`adapter-atom` is an embedded schema definition inside `neural-op.schema.json`. It describes a future adapter contract shape for inputs, outputs, and runtime boundary.

It is spec-only in this phase. Its runtime boundary requires runtimeEnabled=false, providerCallsAllowed=false, and secretReadAllowed=false.

### router-op

`router-op` is an embedded schema definition inside `neural-op.schema.json`. It describes candidate policy, selection gate, fallback policy, and routing mode.

It is explain-only or dry-run preview in this phase. It must not route real requests into Provider execution or the main chain.

## 3. Schema Files

- `packages/neural-fabric-runtime/specs/neural-op.schema.json`
- `packages/neural-fabric-runtime/specs/weight-atom.schema.json`

The package name is `@unified-ai-system/neural-fabric-runtime`, but this phase only creates schema/spec files and a package-level spec check.

## 4. Required Boundaries

The schemas intentionally encode the following hard constants:

- `modelExecutionAllowed=false`
- `providerCallsAllowed=false`
- `trainingAllowed=false`
- `modelDownloadAllowed=false`
- `mainChainIntegrationAllowed=false`
- `secretReadAllowed=false`

These constants are part of the contract. Future phases must not loosen them inside Phase1302A artifacts.

## 5. Relationship To Phase1301A

Phase1301A defines Neural Fabric as a PME governance and capability semantics layer. Phase1302A turns that concept into two stable schema artifacts:

- `neural-op`: operation and routing semantics.
- `weight-atom`: weight reference semantics.

The phase still remains below runtime and below main-chain integration.

## 6. Validation

Required commands:

```powershell
node --check tools/phase1302a/*.mjs
pnpm run verify:phase1302a-neural-op-spec
pnpm run verify:phase107a-secret-safety
pnpm -r --if-present check
```

## 7. Completion Criteria

Phase1302A can be considered sealed only when:

- both schema files exist and parse as JSON;
- `neural-op` defines `adapter-atom` and `router-op`;
- `weight-atom` blocks training, download, model execution, Provider calls, and main-chain integration;
- the verifier writes evidence;
- no Provider, secret, model execution, training, download, `/chat`, or `/chat-gateway/execute` work occurs.

