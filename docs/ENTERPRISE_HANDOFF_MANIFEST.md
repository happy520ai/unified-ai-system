# Enterprise Handoff Manifest

Phase42A freezes the current enterprise handoff checklist for PME. This file is
a deployment handoff manifest, not release automation and not infrastructure
provisioning.

## Scope

This manifest covers the bounded enterprise delivery surface that already
exists in this repository. It is not full enterprise platform completion by
itself:

- Default command set and managed start/stop/status/logs flow.
- Enterprise governance, RBAC, audit, managed user lifecycle, security
  readiness, backup, restore validation dry-run, production startup readiness,
  deployment preflight UI, browser-local config wizard, acceptance report UI,
  release-candidate dry-run checks, enterprise overview UI checks, and the
  enterprise overview readable summary.
- Knowledge local-keyword default mode and explicit vector/pgvector production
  readiness checks.
- Safe environment template and deployment runbook.

## Required Handoff Artifacts

- `README.md`
- `AGENTS.md`
- `docs/DELIVERY_GUIDE.md`
- `docs/OPERATION_MANUAL.md`
- `docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md`
- `docs/ENTERPRISE_HANDOFF_MANIFEST.md`
- `docs/ENTERPRISE_ACCEPTANCE_REPORT.md`
- `.env.enterprise.example`

## Required Enterprise Checks

Run these before handoff:

```powershell
cmd /c pnpm verify:phase37a
cmd /c pnpm verify:phase38a
cmd /c pnpm verify:phase40a
cmd /c pnpm verify:phase41a
cmd /c pnpm verify:phase42a
cmd /c pnpm verify:phase43a
cmd /c pnpm verify:phase44a
cmd /c pnpm verify:phase45a
cmd /c pnpm verify:phase46a
cmd /c pnpm verify:phase47a
cmd /c pnpm verify:phase48a
cmd /c pnpm verify:enterprise
cmd /c pnpm -r --if-present check
```

`verify:enterprise` is the bounded aggregate for the enterprise readiness line.
It must remain a verification aggregate only. It must not provision
infrastructure, mutate deployment environments, run release automation, or call
external providers.

`verify:phase43a` creates `docs/ENTERPRISE_ACCEPTANCE_REPORT.md` as a read-only
summary of existing evidence, required docs, command coverage, and boundary
markers. It must not call providers, provision infrastructure, create releases,
or record secret values.

`verify:phase44a` checks the protected read-only Web console acceptance report
view at `GET /enterprise/acceptance/report`. It reads the existing Phase43A
report/evidence only and must not call providers, mutate runtime data,
provision infrastructure, run release automation, or record secret values.

`verify:phase45a` checks the release-candidate handoff surface in read-only
mode: delivery docs, operation manual, safe environment template, enterprise
scripts, existing evidence, UI safety markers, and boundary wording. It must
not create packages, publish releases, call providers, mutate runtime data,
provision infrastructure, run release automation, or record secret values.

`verify:phase46a` checks the protected read-only Web console release-candidate
view at `GET /enterprise/release-candidate/dry-run`. It reads the existing
Phase45A evidence only and must not create packages, publish releases, call
providers, mutate runtime data, provision infrastructure, run release
automation, or record secret values.

`verify:phase47a` checks the protected read-only Web console enterprise
overview at `GET /enterprise/overview`. It aggregates existing governance
health, readiness, acceptance evidence, and release-candidate dry-run evidence
only and must not call providers, mutate runtime data, create packages,
publish releases, provision infrastructure, run release automation, or record
secret values.

`verify:phase48a` checks the read-only one-screen enterprise overview summary
inside `/ui` while keeping the raw JSON diagnostics available. It must not add
backend business behavior, call providers, mutate runtime data, create
packages, publish releases, provision infrastructure, run release automation,
or record secret values.

## Environment Template Rules

Use `.env.enterprise.example` as a template only.

- Keep real API keys, tokens, database passwords, and pooler URIs outside git.
- Keep placeholder values such as `<set-in-local-secret-store>` in the template.
- Use `KNOWLEDGE_INFRA_MODE=local-keyword` by default.
- Enable vector mode only when the real embedding provider and pgvector pooler
  configuration are intentionally supplied.
- Use a Supabase pooler URI for pgvector. Do not use the direct
  `db.<project>.supabase.co:5432` host in this environment.

## Go / No-Go Checklist

Go when all of these are true:

- `cmd /c pnpm verify:enterprise` passes.
- `cmd /c pnpm verify:phase45a` passes as a release-candidate dry-run only.
- `cmd /c pnpm verify:phase46a` passes as a release-candidate Web view only.
- `cmd /c pnpm verify:phase47a` passes as an enterprise overview Web view only.
- `cmd /c pnpm verify:phase48a` passes as an enterprise overview readable
  summary only.
- `cmd /c pnpm verify:phase21`, `verify:phase22`, `verify:phase23`, and
  `verify:phase24` pass for the intended knowledge mode.
- `cmd /c pnpm -r --if-present check` passes.
- The Web console `/ui` shows deployment preflight, config wizard, and
  acceptance report surfaces.
- Startup readiness reports configured real NVIDIA provider, enterprise auth,
  durable knowledge path, audit path, backup path, and redacted secret presence.
- Evidence and logs do not contain plaintext provider keys, auth tokens, or
  database passwords.

No-Go when any of these are true:

- Enterprise auth is enabled without an active admin token.
- Real provider startup is expected but `NVIDIA_API_KEY` is missing.
- Vector mode is enabled without embedding or pgvector configuration.
- Audit, backup, or knowledge persistence paths are not writable.
- Any evidence, HTTP response, log, or document contains plaintext secrets.

## Explicit Non-Goals

This manifest does not claim completion of SSO/IAM, SCIM, MFA, SIEM,
infrastructure provisioning, release automation, broad external crawling,
production GraphRAG, or governance workflow automation.
