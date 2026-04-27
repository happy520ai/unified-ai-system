# Unified AI System User Manual

Phase 114A is the non-Docker release pack for local and internal users. It
collects the current usable pnpm path, Web UI path, setup flow, model setup,
Knowledge/RAG flow, Agent Workforce preview, safety rules, and known release
limits in one ordinary-user manual.

Phase 115A later verified local Docker runtime for this project. These
PowerShell commands should pass before running the Docker validation:

```powershell
docker --version
docker compose version
docker ps
```

The local Docker validation command is:

```powershell
cmd /c pnpm verify:phase115a-docker-runtime-recheck
```

The local Docker Compose validation command is:

```powershell
cmd /c pnpm stop:phase9c
cmd /c pnpm verify:phase116a-docker-compose-runtime
cmd /c pnpm start:pme
```

The minimal CI/CD release gate validation command is:

```powershell
cmd /c pnpm verify:phase117a-cicd-release-gate
```

The gate file is `.github/workflows/release-gate.yml`. It checks local release
readiness in GitHub Actions, but it does not deploy, publish, push images, or
create a global release.

The remote GitHub Actions preflight command is:

```powershell
cmd /c pnpm verify:phase118a-remote-cicd-gate-preflight
```

It checks whether the local workflow can be executed remotely. It does not push
code, open a PR, trigger GitHub Actions, deploy, publish, or claim a remote
pass.

The local git repository readiness command is:

```powershell
cmd /c pnpm verify:phase119a-git-repo-readiness
```

It records whether this project is an independent local git repository and
whether it is ready for remote GitHub execution. It does not stage, commit,
configure a remote, push, open a PR, or trigger GitHub Actions.

The initial commit preflight command is:

```powershell
cmd /c pnpm verify:phase120a-git-initial-commit-preflight
```

It records staged-file state, safe env template tracking, root artifact
cleanup decisions, legacy tracking decisions, remote state, and GitHub CLI
state before the first commit. It does not stage, commit, configure a remote,
push, open a PR, or trigger GitHub Actions.

The local initial commit execution check is:

```powershell
cmd /c pnpm verify:phase121a-git-initial-commit-execution
```

It verifies that the first local commit exists, no files remain staged, the
zero-byte root artifact was removed, `legacy/` is ignored as a local read-only
reference, real `.env` files remain ignored, and safe env templates are
tracked. It does not configure a remote, push, open a PR, trigger GitHub
Actions, deploy, publish, or claim a remote pass.

The GitHub remote publish preflight command is:

```powershell
cmd /c pnpm verify:phase122a-github-remote-publish-preflight
```

It records whether this local commit can be published to GitHub. It does not
configure a remote, push code, open a PR, trigger GitHub Actions, deploy,
publish, or claim a remote pass.

The GitHub CLI readiness command is:

```powershell
cmd /c pnpm verify:phase123a-github-cli-readiness
```

It records whether `gh`, `winget`, and Chocolatey are usable for the next
remote-publish step. In the current validated state, `gh` is still not
available in PATH, `winget` is available in the validation environment, and
Chocolatey is available but the prior install attempt did not leave GitHub CLI
installed. It does not install system packages, configure a remote, push code,
open a PR, trigger GitHub Actions, deploy, publish, or claim a remote pass.

The GitHub CLI install verification command is:

```powershell
cmd /c pnpm verify:phase124a-github-cli-install
```

It records that GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe`
and that the machine PATH contains the GitHub CLI directory. If the current
PowerShell session still does not recognize `gh`, close and reopen PowerShell.
This phase does not log in to GitHub, store tokens, configure a remote, push
code, open a PR, trigger GitHub Actions, deploy, publish, or claim a remote
pass.

The GitHub authentication preflight command is:

```powershell
cmd /c pnpm verify:phase125a-github-auth-preflight
```

It records that GitHub CLI is installed but GitHub authentication is still not
complete. Browser-based login must be completed by the user in a normal
PowerShell window. This phase does not store tokens in evidence, configure a
remote, push code, open a PR, trigger GitHub Actions, deploy, publish, or
claim a remote pass.

The GitHub authenticated-ready command is:

```powershell
cmd /c pnpm verify:phase126a-github-auth-ready
```

It records that GitHub CLI is installed and authenticated while keeping tokens
out of evidence. It does not configure a remote, push code, open a PR, trigger
GitHub Actions, deploy, publish, or claim a remote pass. A target GitHub
repository URL is still required before remote publishing can continue.

The GitHub remote target preflight command is:

```powershell
cmd /c pnpm verify:phase127a-github-remote-target-preflight
```

It records whether the inferred target repository `happy520ai/unified-ai-system`
exists. Existing PME legacy-oriented repositories are not selected for this
mainline. This phase does not create a GitHub repository, configure a remote,
push code, open a PR, trigger GitHub Actions, deploy, publish, or claim a
remote pass.

The GitHub remote push verification command is:

```powershell
cmd /c pnpm verify:phase128a-github-remote-push
```

It records that the private repository `happy520ai/unified-ai-system` exists,
`origin` is configured, and local `master` has been pushed to `origin/master`.
It records the real GitHub Actions run status if one is triggered, but it does
not claim remote Actions passed until the observed run conclusion is `success`.
The GitHub Actions release gate prepares a temporary `.env` from `.env.example`
before Docker Compose runtime validation; this temporary file must use only
placeholder/blank values and must not contain real secrets.

The remote release-readiness status command is:

```powershell
cmd /c pnpm verify:phase129a-remote-release-status
```

It records the private GitHub repository, `origin/master` tracking, latest
observed remote Release Gate status, and `docs/REMOTE_RELEASE_STATUS.md`. It
does not create a GitHub Release, publish packages or container images, deploy
cloud infrastructure, expose public production access, or complete global
release.

The GitHub Actions Node.js 20 warning cleanup command is:

```powershell
cmd /c pnpm verify:phase130a-actions-node24-warning-cleanup
```

It verifies that the Release Gate uses Node 24 action versions:
`actions/checkout@v5` and `actions/setup-node@v5`. This is warning cleanup
only; it does not deploy, publish, push images, create a GitHub Release, or
complete global release.

The GitHub Release and artifact preflight command is:

```powershell
cmd /c pnpm verify:phase131a-release-artifact-preflight
```

It records repository state, the latest remote Release Gate result, existing
release/tag state, and `docs/RELEASE_PREFLIGHT.md`. It is read-only and does
not create a tag, create a GitHub Release, upload artifacts, publish packages
or images, deploy, or complete global release.

The release version, tag, and release notes decision-pack command is:

```powershell
cmd /c pnpm verify:phase132a-release-decision-pack
```

It records candidate version `0.1.0`, candidate tag `v0.1.0-rc.1`, draft
prerelease posture, and release notes text in
`docs/RELEASE_DECISION_PACK.md`. It is read-only and does not create a tag,
create a GitHub Release, upload artifacts, publish packages or images, deploy,
or complete global release.

This still does not mean cloud deployment, full CI/CD release automation,
public multi-user production deployment, global release, or real multi-agent
execution is complete.

## 1. Install And Start Locally

From the repository root:

```powershell
pnpm install
cmd /c pnpm start:pme
```

When the service is ready, open:

```text
http://127.0.0.1:3100/ui
```

Useful local checks:

```powershell
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
```

Stop the managed local service:

```powershell
cmd /c pnpm stop:phase9c
```

## 2. Configure `.env`

Copy `.env.example` to a private local `.env` file, then fill only the provider
keys you actually use. Do not commit `.env`.

Minimum NVIDIA-style local chat setup:

```powershell
$env:NVIDIA_API_KEY='<your-nvidia-key>'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
$env:AI_GATEWAY_PROVIDER_MODE='real'
$env:AI_GATEWAY_REAL_PROVIDER_ENABLED='true'
$env:AI_GATEWAY_ROUTE_MODE='fixed'
$env:AI_GATEWAY_DEFAULT_PROVIDER='nvidia'
$env:AI_GATEWAY_ENABLED_PROVIDERS='nvidia'
$env:AI_GATEWAY_SERVICE_URL='http://127.0.0.1:3100'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
cmd /c pnpm start:pme
```

The default `/chat` lane remains NVIDIA single-provider unless a later explicit
mainline changes and verifies that boundary.

## 3. First-Run Setup Wizard

After startup, open `/ui`. The first screen includes the setup/readiness path.
The service-side readiness route is:

```text
GET /setup/readiness
```

The setup flow helps confirm that Chat, Model Import, Knowledge/RAG, and Agent
Workforce preview are available for the current local run.

## 4. Add A Model Or API Key

Use the Web UI model setup/import controls. For best results:

- Choose a provider when the key format is ambiguous.
- Fill Base URL for OpenAI-compatible custom providers.
- Do not paste masked keys such as `****abcd`; masked keys are not real keys.
- Keep real keys out of screenshots, logs, docs, evidence, and commits.

If provider detection is unknown, the UI should ask for provider selection or a
Base URL instead of silently sending an unusable key.

## 5. Chat

Use the main Chat-first surface at:

```text
http://127.0.0.1:3100/ui
```

User prompts go through the bounded RAG chat path when using the Web UI. The
default service `/chat` contract and NVIDIA single-provider lane remain
unchanged.

## 6. Knowledge/RAG

The current default knowledge path is local keyword retrieval. In the Web UI,
you can drop supported local files into the chat surface for bounded import,
then ask questions that cite local knowledge.

Supported user path:

- Load files through the Web UI or `POST /knowledge/load/file`.
- Retrieve local knowledge through `POST /knowledge/retrieve`.
- Ask RAG questions through `/chat/rag` or `/chat/rag/stream`.

This is not a broad external crawler, production GraphRAG system, or automatic
project file scanner.

## 7. Agent Workforce Preview

Agent Workforce is a planning preview. It can generate an AI-team-style task
plan with roles, deliverables, acceptance criteria, risks, next actions, saved
history, read/delete, Markdown copy, JSON export, and task-package export.

Current boundary:

- It does not execute code.
- It does not modify user project files.
- It does not connect to workflow run.
- It does not start 144 real concurrent employees.
- It is not a real multi-agent executor.

## 8. Save And Export

Use the Agent Workforce controls in `/ui` to:

- Save generated plans.
- Read plan history.
- Delete saved plans.
- Copy Markdown.
- Export JSON.
- Export a task package.

Do not store real API keys or secrets inside saved plans or exported task
packages.

## 9. Current Release Limits

The current product is suitable for local and internal testing.

Complete locally:

- Local Docker runtime build/run through
  `cmd /c pnpm verify:phase115a-docker-runtime-recheck`.
- Local Docker Compose runtime through
  `cmd /c pnpm verify:phase116a-docker-compose-runtime`.
- Minimal CI/CD release gate through
  `cmd /c pnpm verify:phase117a-cicd-release-gate`.
- Remote GitHub Actions preflight through
  `cmd /c pnpm verify:phase118a-remote-cicd-gate-preflight`.
- Local git repository initialized through
  `cmd /c pnpm verify:phase119a-git-repo-readiness`.
- Initial commit preflight recorded through
  `cmd /c pnpm verify:phase120a-git-initial-commit-preflight`.
- Local initial commit created through
  `cmd /c pnpm verify:phase121a-git-initial-commit-execution`.
- GitHub remote publish preflight recorded through
  `cmd /c pnpm verify:phase122a-github-remote-publish-preflight`.
- GitHub CLI readiness/install blocker recorded through
  `cmd /c pnpm verify:phase123a-github-cli-readiness`.
- GitHub CLI installed and recorded through
  `cmd /c pnpm verify:phase124a-github-cli-install`.
- GitHub authentication preflight recorded through
  `cmd /c pnpm verify:phase125a-github-auth-preflight`.
- GitHub CLI authentication readiness recorded through
  `cmd /c pnpm verify:phase126a-github-auth-ready`.
- GitHub remote target preflight recorded through
  `cmd /c pnpm verify:phase127a-github-remote-target-preflight`.
- GitHub private repository created and `master` pushed through
  `cmd /c pnpm verify:phase128a-github-remote-push`.
- Remote release-readiness status recorded through
  `cmd /c pnpm verify:phase129a-remote-release-status`.

Not complete yet:

- Cloud deployment.
- Automated deployment or release publishing.
- GitHub Release creation.
- Package or container image publishing.
- Current shell PATH refresh if `gh` is still not recognized before reopening
  PowerShell.
- Pushed GitHub branch or pull request.
- Public multi-user production deployment.
- Complex account system.
- Tenant isolation.
- Production-grade encrypted secret vault.
- Rate limiting and audit retention.
- Dedicated security review.
- Real multi-agent execution.
- Global release.

Do not expose this service directly to the public internet for multi-user
access.

## 10. Phase 114A Verification

Use:

```powershell
cmd /c pnpm verify:phase114a-user-manual-release-pack
```

Recommended regression commands after this phase:

```powershell
cmd /c pnpm verify:phase113b-docker-blocker-docs
cmd /c pnpm verify:phase115a-docker-runtime-recheck
cmd /c pnpm verify:phase116a-docker-compose-runtime
cmd /c pnpm verify:phase117a-cicd-release-gate
cmd /c pnpm verify:phase118a-remote-cicd-gate-preflight
cmd /c pnpm verify:phase119a-git-repo-readiness
cmd /c pnpm verify:phase120a-git-initial-commit-preflight
cmd /c pnpm verify:phase121a-git-initial-commit-execution
cmd /c pnpm verify:phase122a-github-remote-publish-preflight
cmd /c pnpm verify:phase123a-github-cli-readiness
cmd /c pnpm verify:phase124a-github-cli-install
cmd /c pnpm verify:phase125a-github-auth-preflight
cmd /c pnpm verify:phase126a-github-auth-ready
cmd /c pnpm verify:phase127a-github-remote-target-preflight
cmd /c pnpm verify:phase128a-github-remote-push
cmd /c pnpm verify:phase129a-remote-release-status
cmd /c pnpm verify:phase112a-non-docker-release-check
cmd /c pnpm verify:phase107a-secret-safety
cmd /c pnpm verify:phase105a-user-journey
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm -r --if-present check
```
