# Phase1903A Owner Automation Real Capability Seal Architecture

## Goal

Phase1903A defines the architecture for sealing real Owner Automation desktop actions. It does not execute desktop automation and does not call Providers.

## Action Runtime Schema

- Whitelist starts with `create_desktop_spreadsheet`.
- Batch runtime is named `batch_create_desktop_spreadsheets`.
- Output directory is restricted to `Desktop`.
- Every output filename appends a timestamp.
- Overwrite, delete, move, desktop scan, and reading other Desktop files are forbidden.

## Approval Input Schema

- Real run requires an owner approval input file.
- `ownerApproved=true` is required.
- `allowRealDesktopFileCreation=true` is required.
- `allowOverwrite=false`, `allowDesktopScan=false`, and `allowReadOtherDesktopFiles=false` are required.
- Approval templates are not real approvals.

## Evidence Schema

- Evidence records action id, dry-run status, approval gate status, created file count, and safety flags.
- Evidence never records API keys, secrets, auth.json contents, or raw CredentialRef values.

## Safety Boundary Matrix

| Area | Allowed | Blocked |
| --- | --- | --- |
| Desktop output | Create timestamped CSV/XLSX test files after approval | Overwrite/delete/move/scan/read other Desktop files |
| Command Palette | Dry-run preview and approval-bound real-run | Ungated real run |
| Batch | Dry-run by default, approval-bound real run up to 3 | Infinite batch, glob, wildcard, directory listing |
| /chat | Action proposal, approval-bound local execution only | Direct real desktop action from a sentence |
| Provider | No Provider calls | OpenAI/Claude/OpenRouter/MiMo/NVIDIA calls |

## Rollback Matrix

- Remove `apps/ai-gateway-service/src/owner-automation/`.
- Revert Command Palette real-run and batch UI additions.
- Revert `/chat` local action proposal/gate hook in `apps/ai-gateway-service/src/http/httpServer.js`.
- Remove `tools/phase1903a` through `tools/phase1912a`.
- Remove `docs/phase1903a` through `docs/phase1912a`.
- Remove `apps/ai-gateway-service/evidence/phase1903a` through `phase1912a`.
- Remove added package scripts.
- Do not use `git reset --hard` or `git clean`.

## Route Matrix

- Command Palette -> dry-run
- Command Palette -> approval-bound real-run
- /chat -> action proposal
- /chat -> approval-bound execution only
- /chat-gateway/execute untouched by default

## Boundary

- providerCallsMade=false
- secretValueExposed=false
- chatIntegrationBoundaryDefined=true
- `/chat-gateway/execute` default chain remains unchanged
