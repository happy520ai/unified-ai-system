# Phase3968A Product Work Mode Dashboard

## Goal

Add a read-only Product Work Mode status panel to Mission Control.

## Panel Shows

- controlled mutation hard cap = 56
- Product Reality Baseline status
- Owner Daily Use status
- Provider Reality Matrix status
- CredentialRef Readiness status
- Dead Button Scan status
- Self Evolution Governance status
- Real Provider Smoke owner approval requirement
- current blockers

## Boundary

No real execution button, no Provider call button, no deploy button, no secret-read entry, no /chat change, and no /chat-gateway/execute change.

## Rollback

- Delete `apps/ai-gateway-service/src/ui/components/ProductWorkModeDashboardPanel.js`.
- Remove the import and render call from `apps/ai-gateway-service/src/ui/components/MissionControlPanel.js`.
- Delete `tools/phase3968a/`.
- Delete `docs/phase3968a-product-work-mode-dashboard.md`.
- Delete `apps/ai-gateway-service/evidence/phase3968a-product-work-mode-dashboard/`.
- Restore package.json scripts and README/AGENTS managed block entries.
