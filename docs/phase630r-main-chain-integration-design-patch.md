# Phase630R-Fix Main Chain Integration Design Patch

## Purpose

Phase630R-Fix prepares a future main-chain integration design patch for the CRS Codex exec capability. It does not apply the patch and does not wire runtime traffic.

designOnly=true
patchPreviewOnly=true
noRuntimeModification=true
noChatModification=true
noChatGatewayExecuteModification=true
noProviderRuntimeModification=true
futurePhaseRequiredForImplementation=true

## Source Inputs

- Phase612R-Fix: CRS custom model_provider via guarded codex exec 3/3 repeated_pass.
- Phase613R-Fix: capability boundary sealed.
- Phase621R-628R: isolated runtime candidate path sealed.
- Phase629R-Fix: final human approval packet sealed.

## Design Patch Scope

The design patch may describe how a future phase could add guarded candidate routing metadata near the main chain. It must not edit the actual `/chat` route implementation, `/chat-gateway/execute` implementation, or provider runtime in this phase.

## Non-Claims

mainChainIntegrated=false
productionReadyClaimed=false
releaseReadyClaimed=false
