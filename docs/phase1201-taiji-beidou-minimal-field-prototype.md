# Phase1201 Taiji / Beidou Minimal Field Prototype

## Status

- Phase: Phase1201
- Goal: engineer a minimal local physics-field prototype for Taiji / Beidou concept-space experiments.
- Verification mode: synthetic-dry-run only.
- Sealed condition: `king - man + woman` ranks `queen` as the top steady-state candidate in the synthetic concept space.
- Non-claim: this is not a real GloVe semantic validation and does not prove broad analogy quality.

## Scope

This phase creates a local experiment module under `packages/taiji-beidou-engine`.
It does not connect the main AI Gateway runtime, `/chat`, `/chat-gateway/execute`, provider runtime, Codex config, or any external model provider.

## Prototype Mapping

- Concept space: deterministic local vectors in `createSyntheticConceptSpace()`.
- Physical sources: signed source words from `king - man + woman`.
- External potential / total energy: quadratic target potential `E(x)=0.5*||x-(king-man+woman)||^2`.
- Energy gradient: `grad E(x)=x-(king-man+woman)`.
- Evolution: local gradient descent from the `king` vector.
- Readout: nearest words by Euclidean distance, excluding source words.

## GloVe Boundary

The user prototype references `gensim.downloader.api.load("glove-wiki-gigaword-50")`.
That call can download external data, so this phase does not execute it by default.

真实 GloVe 下载默认禁止。只有显式设置以下环境变量，未来的独立扩展才可以进入下载路径：

```bash
ALLOW_TAIJI_GLOVE_DOWNLOAD=true
```

Phase1201 itself uses synthetic vectors and records `gloveDownloaded=false`.

## Evidence

- Dry-run evidence: `apps/ai-gateway-service/evidence/phase1201-physics-field/taiji-beidou-minimal-field-dry-run-result.json`
- Final evidence: `apps/ai-gateway-service/evidence/phase1201-physics-field/taiji-beidou-minimal-field-result.json`
- Validation evidence: `apps/ai-gateway-service/evidence/phase1201-physics-field/taiji-beidou-minimal-field-validation-result.json`
- Execution boundary note: `apps/ai-gateway-service/evidence/phase1201-physics-field/taiji-beidou-minimal-field-execution-boundary-note.json`

## Verification

```powershell
cmd /c pnpm run smoke:phase1201-taiji-beidou-minimal-field:dry-run
cmd /c pnpm run verify:phase1201-taiji-beidou-minimal-field
```

## Safety Boundary

- providerCallsMade=false
- externalNetworkUsed=false
- gloveDownloaded=false
- secretValueExposed=false
- authJsonRead=false
- chatBehaviorChanged=false
- chatGatewayExecuteBehaviorChanged=false
- deploy/release/tag/artifact=false
- commit/push=false
- workspaceCleanClaimed=false
- realSemanticVerificationCompleted=false

## Execution Boundary Note

Phase1201 module evidence records only the isolated dry-run prototype.
If an operator starts the broader managed service while validating local health,
that service may execute routes unrelated to this module. Such observations must
be disclosed in the execution boundary note and must not be mixed into the module
dry-run result.
