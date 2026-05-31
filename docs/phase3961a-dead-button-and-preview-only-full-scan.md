# Phase3961A Dead Button And Preview-Only Full Scan

## Goal

Run a repository-local UI scan for dead buttons, misleading real-action buttons, preview-only controls, dangerous action wording, and missing boundary copy.

## Scope

- apps/ai-gateway-service/src/ui
- Mission Control panels
- mode cards
- provider panels
- evidence panels
- command palette style entries
- owner trial/sample task entries

## Result Summary

- scannedFileCount=205
- scannedButtonCount=99
- deadButtonCount=69
- disabledButExplainedCount=1
- previewOnlyButtonCount=26
- misleadingRealActionButtonCount=4
- dangerousActionButtonCount=4
- missingBoundaryCopyCount=4

## Boundary

This phase does not modify UI behavior. It adds no real execution button, calls no Provider, reads no secret, and does not deploy.

## Rollback

- Delete `tools/phase3961a/`.
- Delete `docs/phase3961a-dead-button-and-preview-only-full-scan.md`.
- Delete `apps/ai-gateway-service/evidence/phase3961a-dead-button-and-preview-only-full-scan/`.
- Restore package.json scripts and README/AGENTS managed block entries.
