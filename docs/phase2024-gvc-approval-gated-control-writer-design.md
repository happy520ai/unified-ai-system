# Phase2024-GVC-Approval-Gated-Control-Writer-Design

## Goal

Phase2024 designs an approval-gated writer for GVC Runner control changes. It prepares the schema, approval packet, and dry-run verifier for a future pause/resume/stop writer.

## Scope

- Design approval-gated writer for `pause`, `resume`, and `stop`.
- Generate a control writer approval schema.
- Generate `docs/approvals/gvc-runner-control-writer-approval-required.json`.
- Verify alignment with Phase2023 dry-run command bridge.
- Keep `wouldWriteControlFile=true` and `realWritePerformed=false` in dry-run evidence.

## Approval-Gated Writer Design

The future writer may only target:

```text
docs/project-brain/runner-control.json
```

The future writer must require:

- owner approval record id
- selected command intent
- expected result
- rollback plan
- dry-run evidence reference
- before-write snapshot

## Boundaries

- No real write to `runner-control.json`.
- No real write to any control file.
- No process signal.
- No real stop/start/kill runner.
- No Provider call.
- No secret read.
- No deploy, release, tag, artifact upload, push, or commit.
- No `/chat` modification.
- No `/chat-gateway/execute` modification.
- No `legacy/` modification.
- No `PROJECT_CONTEXT.md` modification.

## Approval Packet

Approval packet:

```text
docs/approvals/gvc-runner-control-writer-approval-required.json
```

This packet is not an approval. It is an owner-fillable approval-required template for a future Phase2025 candidate.

## Schema

Schema:

```text
docs/phase2024-gvc-runner-control-writer-approval.schema.json
```

The schema keeps `approved=false` in Phase2024 and requires future real write to be gated by owner approval.

## Verification

Run:

```powershell
pnpm run verify:phase2024-gvc-approval-gated-control-writer-design
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

## Phase2025 Eligibility

Phase2025 may be considered only after the owner fills and explicitly approves the approval packet. Without that approval, Phase2025 must remain blocked or dry-run only.
