# Phase3962A Provider Reality Status Matrix

## Goal

Generate a Provider reality matrix from existing evidence only. This phase does not call Providers and does not read raw secrets.

## Providers Covered

- NVIDIA
- OpenAI
- Claude
- OpenRouter
- MiMo

## Hard Rules

- OpenRouter credentialRef missing remains a blocker unless future real evidence proves otherwise.
- Providers without continuous real smoke are not marked stable.
- Unauthorized Provider calls are not allowed.
- Raw secrets are not read.
- Production readiness is not claimed.

## Matrix Output

See `docs/provider-reality-status-matrix.json`.

## Current Conclusion

NVIDIA has historical partial chat-model smoke evidence, but continuous stability is not verified. OpenAI, Claude, OpenRouter, and MiMo remain blocked by authorization and CredentialRef readiness. OpenRouter specifically remains blocked by `openrouter_credentialref_missing`.

## Rollback

- Delete `tools/phase3962a/`.
- Delete `docs/phase3962a-provider-reality-status-matrix.md`.
- Delete `docs/provider-reality-status-matrix.json`.
- Delete `apps/ai-gateway-service/evidence/phase3962a-provider-reality-status-matrix/`.
- Restore package.json scripts and README/AGENTS managed block entries.
