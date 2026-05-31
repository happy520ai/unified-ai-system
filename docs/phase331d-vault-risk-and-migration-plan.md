# Phase331D Vault Risk And Migration Plan

- Risk: no real vault backend configured.
- Migration: keep env/internal test and encrypted reference paths guarded until vaultReferenceAdapter is verified.
- Secret safety: never return raw secret values from adapter calls.
