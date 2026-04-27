# Release Decision Pack

Phase 132A records a draft version, tag, and release-notes decision pack for
`unified-ai-system`.

## Scope

- Repository: `happy520ai/unified-ai-system`
- Branch: `master`
- Candidate version: `0.1.0`
- Candidate tag: `v0.1.0-rc.1`
- Candidate release title: `unified-ai-system v0.1.0-rc.1`
- Recommended GitHub Release state: draft
- Recommended release maturity: prerelease
- Verification command: `cmd /c pnpm verify:phase132a-release-decision-pack`

This is a read-only decision pack. It does not create a git tag, create a
GitHub Release, upload release assets, publish packages, push container images,
deploy cloud infrastructure, expose public production access, or complete
global release.

For verifier clarity:

- It does not create a git tag.
- It does not create a GitHub Release.
- It does not upload release assets.
- It does not publish packages.
- It does not publish container images.
- It does not deploy cloud infrastructure.

## Release Notes Draft

### Summary

This release candidate packages the current local and private-remote delivery
state of `unified-ai-system`: a usable local AI Gateway service with Web UI,
first-run setup guidance, model import guidance, Chat, Knowledge/RAG, Agent
Workforce planning preview, Docker runtime validation, Docker Compose runtime
validation, and a passing GitHub Actions release-readiness gate.

### Included Capabilities

- Local pnpm startup path through `cmd /c pnpm start:pme`.
- Browser UI at `/ui`.
- Setup Wizard and `/setup/readiness`.
- Model Import guidance with API key masking and provider/base URL prompts.
- Chat and bounded service-side RAG flow.
- Knowledge/RAG local document path.
- Agent Workforce planning preview with save, history, export, and delete.
- Local Docker runtime verification for `ai-gateway-service`.
- Local Docker Compose runtime verification for `ai-gateway-service`.
- GitHub Actions Release Gate with Node 24 action versions.
- Secret-safety scan covering repository docs, apps, packages, and evidence.

### Verified Gates

- `cmd /c pnpm verify:phase107a-secret-safety`
- `cmd /c pnpm verify:phase114a-user-manual-release-pack`
- `cmd /c pnpm verify:phase117a-cicd-release-gate`
- `cmd /c pnpm verify:phase129a-remote-release-status`
- `cmd /c pnpm verify:phase130a-actions-node24-warning-cleanup`
- `cmd /c pnpm verify:phase131a-release-artifact-preflight`
- `cmd /c pnpm -r --if-present check`
- Remote GitHub Actions `Phase117A Release Gate`

### Explicit Non-Goals

- No GitHub Release has been created by this phase.
- No git tag has been created by this phase.
- No release artifact has been uploaded by this phase.
- No package or container image has been published.
- No cloud deployment has been performed.
- No public multi-user production deployment is complete.
- No global release is complete.
- Agent Workforce remains a planning preview, not real multi-agent execution.
- No 144-worker execution is enabled.

### Known Limits Before Public Production

- Public multi-user production still requires a full account system, tenant
  isolation, production-grade secret storage, rate limits, audit retention,
  TLS/reverse-proxy hardening, backup/restore policy, and security review.
- Package publishing, container image publishing, cloud deployment, and release
  automation remain explicit future phases.
- Real provider API keys must remain outside repository docs, evidence, and
  committed files.

## Suggested Manual Release Steps Later

These commands are examples for a later explicit release phase only. Do not run
them as part of Phase 132A:

```powershell
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
gh release create v0.1.0-rc.1 --draft --prerelease --title "unified-ai-system v0.1.0-rc.1" --notes-file <release-notes-file>
```

Before any later real release, re-run the remote Release Gate on the exact
release commit and confirm secret-safety evidence remains clean.
