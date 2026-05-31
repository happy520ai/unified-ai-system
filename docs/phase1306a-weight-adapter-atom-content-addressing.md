# Phase1306A Weight Atom + Adapter Atom Content Addressing

## Goal

Implement content addressing for weight and adapter atom fixtures without touching real model files.

## Scope

- Tiny fixture only.
- No model download.
- No user folder reads.
- No disk scan.
- No training.
- No Provider call.

## Required Checks

- sameContentSameHash=true
- differentContentDifferentHash=true
- metadataCanonicalized=true

## Result

`packages/neural-fabric-runtime/src/atomContentAddressDryRun.js` exports `runAtomContentAddressDryRun()`.

## Evidence

`apps/ai-gateway-service/evidence/phase1306a/weight-adapter-content-addressing-result.json`
