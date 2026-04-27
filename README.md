# PME 移动地球

PME 移动地球 is the current product name for this local AI Gateway, chat, and
knowledge-base system. The repository remains the same monorepo for the agent
console and AI Gateway service.

The legacy projects under `legacy/` are read-only references. New development
belongs only in `apps/` and `packages/`.

## Layout

- `apps/agent-console`: upper-level agent interaction entrypoint.
- `apps/ai-gateway-service`: AI Gateway service entrypoint and future runtime.
- `packages/shared-contracts`: shared public protocol types.
- `packages/shared-sdk`: shared clients and adapters.
- `packages/shared-config`: shared configuration defaults and loaders.
- `packages/shared-utils`: shared utility helpers.

## Current Phase

Phase 136A publishes the existing `v0.1.0-rc.1` GitHub prerelease:

```powershell
cmd /c pnpm verify:phase136a-release-publish-execution
```

The execution record is `docs/RELEASE_PUBLISH_EXECUTION.md`. The release is
published and remains a prerelease for tag `v0.1.0-rc.1`. This phase does not
upload release assets, publish packages or images, deploy cloud infrastructure,
expose the service to the public internet, or complete global release.

Phase 135A records the publish and asset-upload preflight for the existing
`v0.1.0-rc.1` GitHub draft prerelease:

```powershell
cmd /c pnpm verify:phase135a-release-publish-preflight
```

The preflight document is `docs/RELEASE_PUBLISH_PREFLIGHT.md`. It confirms the
draft prerelease still exists, is not published, has no uploaded assets, and
requires an explicit later confirmation phrase before any publish or asset
upload. This phase does not publish the draft release, upload assets, publish
packages or images, deploy cloud infrastructure, expose the service to the
public internet, or complete global release.

Phase 134A creates the real `v0.1.0-rc.1` GitHub draft prerelease:

```powershell
cmd /c pnpm verify:phase134a-release-creation-execution
```

The execution record is `docs/RELEASE_CREATION_EXECUTION.md`. The tag
`v0.1.0-rc.1` points to `bdba42b600d712acb77926774c75254b8c290ea6`, whose
remote `Phase117A Release Gate` passed before creation. The GitHub Release is
draft and prerelease. This phase does not publish the draft release, upload
release artifacts, publish packages or images, deploy cloud infrastructure,
expose the service to the public internet, or complete global release.

Phase 133A records the final GitHub Release creation confirmation pack:

```powershell
cmd /c pnpm verify:phase133a-release-creation-confirmation
```

The confirmation pack is `docs/RELEASE_CREATION_CONFIRMATION.md`. It records
the exact confirmation phrase required before a later real release phase may
create `v0.1.0-rc.1`: `创建 GitHub Release v0.1.0-rc.1`. This phase is
read-only: it does not create a git tag, create a GitHub Release, upload
release artifacts, publish packages or images, deploy cloud infrastructure,
expose the service to the public internet, or complete global release.

Phase 132A records the release version, tag, and release notes decision pack:

```powershell
cmd /c pnpm verify:phase132a-release-decision-pack
```

The decision pack is `docs/RELEASE_DECISION_PACK.md`. It proposes candidate
version `0.1.0`, candidate tag `v0.1.0-rc.1`, a draft prerelease posture, and
release notes text. This is documentation and verification only: it does not
create a git tag, create a GitHub Release, upload release artifacts, publish
packages or images, deploy cloud infrastructure, expose the service to the
public internet, or complete global release.

Phase 131A records the GitHub Release and artifact preflight:

```powershell
cmd /c pnpm verify:phase131a-release-artifact-preflight
```

The preflight document is `docs/RELEASE_PREFLIGHT.md`. This is a read-only
release readiness record only: it checks repository, latest Release Gate,
current release/tag state, and release-boundary wording, but it does not create
a git tag, create a GitHub Release, upload release artifacts, publish packages
or images, deploy cloud infrastructure, expose the service to the public
internet, or complete global release.

Phase 130A cleans up the non-blocking GitHub Actions Node.js 20 runtime
deprecation warning:

```powershell
cmd /c pnpm verify:phase130a-actions-node24-warning-cleanup
```

The Phase117A Release Gate now uses Node 24 action versions:
`actions/checkout@v5` and `actions/setup-node@v5`. Setup Node's automatic
package-manager cache is disabled to preserve the existing install behavior.
This is warning cleanup only: it preserves the existing release-readiness gate
and does not create a GitHub Release, publish packages or images, deploy cloud
infrastructure, expose the service to the public internet, or complete global
release.

Phase 129A records the remote release-readiness status:

```powershell
cmd /c pnpm verify:phase129a-remote-release-status
```

The private GitHub repository is pushed, `origin/master` is tracked, and the
latest observed Phase117A Release Gate on the pushed remote head has concluded
successfully. The status document is `docs/REMOTE_RELEASE_STATUS.md`. This is
a remote delivery/readiness record only: it does not create a GitHub Release,
publish packages or images, deploy cloud infrastructure, expose the service to
the public internet, or complete global release.

Phase 128A records the GitHub remote creation and push:

```powershell
cmd /c pnpm verify:phase128a-github-remote-push
```

The private GitHub repository `happy520ai/unified-ai-system` exists, `origin`
points to `https://github.com/happy520ai/unified-ai-system.git`, and local
`master` tracks `origin/master`. The remote `master` head matches the pushed
local commit. GitHub Actions may be triggered by the push; this phase records
the real run status but does not claim Actions passed unless the remote run
actually concludes successfully.

The first remote run exposed a CI-only Docker Compose prerequisite: the runner
does not have local `.env`. The release gate now prepares a temporary `.env`
from `.env.example` before `verify:phase116a-docker-compose-runtime`; this file
uses placeholder/blank values only and must not contain real secrets.

Phase 127A records the GitHub remote target preflight:

```powershell
cmd /c pnpm verify:phase127a-github-remote-target-preflight
```

GitHub CLI is authenticated as `happy520ai`, but the inferred target repository
`happy520ai/unified-ai-system` does not exist or is not accessible. Existing
repositories under the account include PME legacy-oriented names, so this phase
does not select them for the current `unified-ai-system` mainline. No remote is
configured and no push was attempted.

The safe next command is to create or provide the intended repository URL:

```powershell
gh repo create happy520ai/unified-ai-system --private
git remote add origin https://github.com/happy520ai/unified-ai-system.git
git push -u origin master
```

Phase 126A records that GitHub authentication is ready:

```powershell
cmd /c pnpm verify:phase126a-github-auth-ready
```

GitHub CLI is installed and authenticated as `happy520ai`. The evidence records
the login and auth readiness without storing GitHub tokens. No git remote is
configured yet, no push was attempted, and no remote GitHub Actions run has
passed. The remaining required input is the target GitHub repository URL.

```powershell
git remote add origin <github-repo-url>
git push -u origin master
```

Phase 125A records the GitHub authentication preflight:

```powershell
cmd /c pnpm verify:phase125a-github-auth-preflight
```

GitHub CLI is installed, but browser-based `gh auth login` did not complete in
the Codex shell. No GitHub token was recorded in evidence, no git remote is
configured, no push was attempted, and no remote GitHub Actions run has passed.
The remaining manual step is to complete GitHub login in a normal PowerShell
window and provide a repository URL.

```powershell
gh auth login
git remote add origin <github-repo-url>
git push -u origin master
```

Phase 124A records GitHub CLI installation:

```powershell
cmd /c pnpm verify:phase124a-github-cli-install
```

GitHub CLI 2.91.0 is installed at `C:\Program Files\GitHub CLI\gh.exe`, and the
machine PATH contains the GitHub CLI directory. The current PowerShell session
may still need to be closed and reopened before `gh` resolves without a full
path. GitHub CLI is not authenticated yet, and no git remote is configured.
This phase does not log in to GitHub, store tokens, configure a remote, push,
open a PR, trigger GitHub Actions, deploy infrastructure, publish releases, or
claim remote Actions passed.

Simplest next commands:

```powershell
# Close and reopen PowerShell first if gh is not recognized.
gh --version
gh auth login
git remote add origin <github-repo-url>
git push -u origin master
```

Phase 123A records GitHub CLI readiness after the install attempt:

```powershell
cmd /c pnpm verify:phase123a-github-cli-readiness
```

`gh` is still not available in PATH. The validation environment can see
`winget`, and Chocolatey is also available, but the prior `choco install gh -y`
attempt did not leave GitHub CLI installed. No git remote is configured yet.
This phase records the blocker and the simplest next commands without
installing system packages, configuring a remote, pushing code, opening a PR,
triggering GitHub Actions, deploying infrastructure, publishing releases, or
claiming remote Actions passed.

Simplest next commands for the later remote-publish phase:

```powershell
winget install --id GitHub.cli --accept-package-agreements --accept-source-agreements
gh auth login
git remote add origin <github-repo-url>
git push -u origin master
```

If `winget` is unavailable in the active shell, run PowerShell as Administrator
and use `choco install gh -y` instead.

Phase 122A records the GitHub remote publish preflight:

```powershell
cmd /c pnpm verify:phase122a-github-remote-publish-preflight
```

The local initial commit exists, but remote publishing is still blocked because
no git remote is configured and GitHub CLI (`gh`) is not available in PATH.
This phase records the blocker and the next commands without configuring a
remote, pushing code, opening a PR, triggering GitHub Actions, deploying
infrastructure, publishing releases, or claiming remote Actions passed.

Next commands for the later remote-publish phase:

```powershell
winget install --id GitHub.cli
gh auth login
git remote add origin <github-repo-url>
git push -u origin master
```

Phase 121A creates the local initial commit:

```powershell
cmd /c pnpm verify:phase121a-git-initial-commit-execution
```

The zero-byte root artifact `{console.error(e.message)` has been removed.
`legacy/` is now ignored as a local read-only reference and is not tracked in
the initial commit. Real `.env` files remain ignored, while `.env.example` and
`.env.enterprise.example` are tracked as safe templates. This phase may create
the first local commit only. It does not configure a git remote, push, open a
PR, trigger GitHub Actions, publish releases, deploy infrastructure, or claim
remote Actions passed.

Remaining remote-publish blockers after this phase are: no git remote and no
GitHub CLI (`gh`) in PATH.

Phase 120A records the initial commit preflight:

```powershell
cmd /c pnpm verify:phase120a-git-initial-commit-preflight
```

It confirms the project git top-level, prior Phase 119A/118A evidence, staged
file state, remote state, GitHub CLI state, and first-commit manual decisions.
It also makes the safe `.env.enterprise.example` template trackable while
keeping real `.env` files ignored.

This phase did not stage files, create commits, configure remotes, push, open
a PR, trigger GitHub Actions, publish releases, deploy infrastructure, or claim
remote Actions passed. At Phase 120A time, the recorded commit-before-publish
items were: decide whether to delete or intentionally ignore the zero-byte root
artifact `{console.error(e.message)`, decide whether `legacy/` should be
tracked as a read-only reference or ignored before the first commit, create the
initial commit, configure a git remote, and install/authenticate GitHub CLI
(`gh`) or use an equivalent authenticated connector.

Phase 119A records local git repository readiness:

```powershell
cmd /c pnpm verify:phase119a-git-repo-readiness
```

`unified-ai-system` now has its own local `.git` repository, and the project
git top-level is the project root. Local runtime folders and secret files are
kept out of git through `.gitignore`, including `.env`, `.codex/`, `.data/`,
`.tmp/`, and `node_modules/`.

This phase does not stage files, create an initial commit, configure a remote,
push, open a PR, or trigger GitHub Actions. Remaining remote-publish blockers
are: no initial commit, no git remote, and no GitHub CLI (`gh`) in PATH.

Phase 118A records the remote GitHub Actions gate preflight:

```powershell
cmd /c pnpm verify:phase118a-remote-cicd-gate-preflight
```

The local release gate workflow is ready, but a real remote GitHub Actions run
has not been executed from this workspace. Current remote-run prerequisites are
not complete: no git remote is configured for this project checkout, no initial
commit has been created, and the GitHub CLI (`gh`) is not available in PATH.
Phase 118A records these facts without pushing code, opening a PR, or
pretending a remote workflow passed.

To complete a later real remote gate run, create the initial commit, configure
a GitHub remote, install/authenticate GitHub CLI or use an equivalent
authenticated GitHub connector, then push a branch or open a PR so
`.github/workflows/release-gate.yml` can run on GitHub Actions.

Phase 117A adds the minimal CI/CD release gate:

```powershell
cmd /c pnpm verify:phase117a-cicd-release-gate
```

The workflow lives at:

```text
.github/workflows/release-gate.yml
```

It runs on pull requests, pushes to `main` / `master`, and manual dispatch. The
gate installs dependencies, runs workspace checks, secret safety, ordinary user
journey, setup readiness, Docker runtime, and Docker Compose runtime:

```powershell
pnpm install --frozen-lockfile
pnpm -r --if-present check
pnpm verify:phase107a-secret-safety
pnpm verify:phase105a-user-journey
pnpm verify:phase104a-first-run-setup
pnpm verify:phase115a-docker-runtime-recheck
pnpm verify:phase116a-docker-compose-runtime
```

This is CI/CD gate validation only. It does not deploy infrastructure, publish
packages, push container images, create releases, provision cloud services, or
complete global release.

Phase 116A closes the local Docker Compose runtime check:

```powershell
cmd /c pnpm verify:phase116a-docker-compose-runtime
```

Docker Compose now builds and starts the `ai-gateway-service` service from
`docker-compose.yml`, verifies `/health/check`, `/setup/readiness`, and `/ui`
on `http://127.0.0.1:3100`, then shuts the Compose project down. Because the
Compose file intentionally maps `3100:3100`, stop the local pnpm service before
running this verification if it is already using port 3100:

```powershell
cmd /c pnpm stop:phase9c
cmd /c pnpm verify:phase116a-docker-compose-runtime
cmd /c pnpm start:pme
```

This is a local Docker Compose runtime pass for `ai-gateway-service` only. It
is not cloud deployment, not CI/CD automation, not production deployment, not
public multi-user release, and not global release.

Phase 115A closes the local Docker runtime recheck:

```powershell
cmd /c pnpm verify:phase115a-docker-runtime-recheck
```

Docker CLI, Docker Compose, Docker daemon, and the Linux Docker engine now pass
locally. The root Linux `Dockerfile` builds successfully, the container runs,
and smoke checks pass for `/health/check`, `/setup/readiness`, and `/ui`.
This required repairing the WSL MSI registration so
`C:\Windows\System32\wsl.exe --version` works, switching Docker Desktop back
to the Linux engine, and excluding nested `node_modules` from Docker build
context through `.dockerignore`.

This is a local Docker runtime pass for `ai-gateway-service` only. It is not
cloud deployment, not CI/CD automation, not production deployment, not public
multi-user release, and not global release.

Phase 114A adds the non-Docker user manual release pack:

```powershell
cmd /c pnpm verify:phase114a-user-manual-release-pack
```

The ordinary-user manual is:

```text
docs/USER_MANUAL.md
```

It documents the current local pnpm startup path, `/ui`, Setup Wizard, Model
Import / API Key setup, Chat, Knowledge/RAG, Agent Workforce preview,
save/export flows, secret-safety expectations, and known release limits. This
is a non-Docker local/internal testing release pack only. It does not make
Docker runtime, CI/CD, cloud deployment, public multi-user production
deployment, real multi-agent execution, or global release complete.

Phase 113B records the original Docker runtime blocker and installation prerequisites:

```powershell
cmd /c pnpm verify:phase113b-docker-blocker-docs
```

Docker CLI prerequisites were later rechecked on 2026-04-27. The local Docker
daemon can now answer the prerequisite commands on the Windows/Hyper-V engine:

- `docker --version`
- `docker compose version`
- `docker ps`

That intermediate state was not a Docker runtime pass for the project because
the Docker daemon was still on the Windows engine while the root `Dockerfile`
uses the Linux image `node:22-bookworm-slim`. Phase 115A later repaired WSL,
switched Docker Desktop to the Linux engine, and verified real local Docker
build/run successfully. Phase 110A static Docker readiness is not the same as
Docker runtime passing and must not be used as Docker build/run evidence.

Phase 112A records the current non-Docker deliverable status:

```powershell
cmd /c pnpm verify:phase112a-non-docker-release-check
```

Current deliverable status checklist:

- Local pnpm startup is available through `pnpm install` and
  `cmd /c pnpm start:pme`.
- `/ui` is available after the service starts at `http://127.0.0.1:3100/ui`.
- Setup Wizard is available through the Web UI and `GET /setup/readiness`.
- Model Import / API Key guidance has been hardened for unknown providers,
  provider selection, Base URL guidance, and masked key handling.
- Knowledge/RAG is available through the bounded local knowledge and RAG
  routes, with local keyword retrieval as the default user path.
- Agent Workforce preview is available for deterministic plan generation,
  save/history/read/delete, and task-package export.
- Secret redaction and evidence safety have passed
  `cmd /c pnpm verify:phase107a-secret-safety`.
- Docker local runtime now passes through Phase 115A:
  `cmd /c pnpm verify:phase115a-docker-runtime-recheck`.
- Minimal CI/CD gate exists through Phase 117A, but no cloud deployment,
  release automation, package publish, image push, or global release has been
  created.

Phase 111B adds the CI/CD and release-gate design boundary:

```powershell
cmd /c pnpm verify:phase111b-cicd-gate-design
```

Docker local runtime now passes through Phase 115A and Compose runtime through
Phase 116A. Phase 117A later adds a real GitHub Actions release gate. Phase
111B remains the design boundary only and does not itself complete CI/CD
automation, cloud deployment, release automation, or global release.

Future CI/CD release gates should include:

- install: `pnpm install`
- lint/check: `cmd /c pnpm -r --if-present check`
- secret scan: `cmd /c pnpm verify:phase107a-secret-safety`
- user journey: `cmd /c pnpm verify:phase105a-user-journey`
- setup readiness: `cmd /c pnpm verify:phase104a-first-run-setup`
- Docker build/run: build the image, run the container, then verify
  `/health/check`, `/setup/readiness`, and `/ui`
- smoke health: `cmd /c pnpm health:phase12a`
- artifact/evidence scan: verify evidence and logs contain no plaintext API
  keys and do not claim unverified global release

Phase 110A adds the minimal local Docker startup baseline:

```powershell
cmd /c pnpm verify:phase110a-docker-readiness
```

It adds a root `Dockerfile`, `.dockerignore`, and a minimal
`docker-compose.yml` for running only `apps/ai-gateway-service` locally. This
is local container startup only; it is not cloud deployment, not CI/CD, not a
production cluster, and not global release.

Build and run with Docker:

```powershell
docker build -t pme-mobile-earth-ai-gateway .
docker run --rm --env-file .env -p 3100:3100 pme-mobile-earth-ai-gateway
```

Or use Docker Compose:

```powershell
cmd /c pnpm stop:phase9c
docker compose up --build ai-gateway-service
```

Then open the UI and verify local readiness:

```text
http://127.0.0.1:3100/ui
http://127.0.0.1:3100/health/check
http://127.0.0.1:3100/setup/readiness
```

The Docker files do not contain real API keys. Use `.env` locally and keep real
secrets out of git. The Compose file only starts `ai-gateway-service`; it does
not add Postgres, pgvector, Redis, cloud services, or release automation.
Use `cmd /c pnpm verify:phase116a-docker-compose-runtime` for the repeatable
local Compose runtime smoke.

Phase 109A adds the deployment, Docker, and production-run documentation
hardening check:

```powershell
cmd /c pnpm verify:phase109a-deployment-readiness
```

This is a documentation and readiness boundary only. It does not perform a
cloud deployment, does not add CI/CD, and does not mean Docker or production
deployment is complete.

Local development startup:

```powershell
pnpm install
cmd /c pnpm start:pme
```

Then open:

```text
http://127.0.0.1:3100/ui
```

Intranet test startup uses the same managed entrypoint after setting a private
`.env` or shell environment for provider keys and service URL. Keep the
service bound to a trusted internal network only. For this repository, the
current recommended verification sequence is:

```powershell
cmd /c pnpm verify:phase104a-first-run-setup
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm -r --if-present check
```

Phase 109A did not seal Docker. Phase 110A now provides the local Docker
startup baseline; any future cloud deployment must still include real
build/run and deployment verification before documentation may call it
complete.

Do not expose this service directly to the public internet for multi-user
access. Production deployment still requires auth, tenant isolation, encrypted
secret vault, rate limit, audit retention, backup/restore policy, TLS/reverse
proxy hardening, and a dedicated security review.

Phase 108A adds the access, permission, and multi-user release boundary
closure for the current product surface:

```powershell
cmd /c pnpm verify:phase108a-access-boundary
```

The current system can be run and tested locally, but it should not be exposed
directly to the public internet for multiple users. Before production
deployment, the product still needs a real account system, auth, tenant
isolation, encrypted secret vault, rate limit, audit retention, and a dedicated
security review. Phase 108A is a boundary and readiness wording closure; it
does not mean that the account system, production multi-tenant isolation,
enterprise security, or global release is complete.

Phase 32A adds the first enterprise governance foundation on top of the
bounded product surface: optional token authentication, tenant context,
role-based permission checks, protected enterprise/session/roles/audit routes,
and JSONL audit recording for authorization decisions. It is a real enforced
foundation when enabled, not a full enterprise IAM/SSO/SAML/OIDC system,
policy engine, governance automation platform, or admin console.
Phase 33A exposes that enterprise foundation in the Web console so an operator
can inspect governance health, current session, role permissions, and audit
records from `/ui` using the configured enterprise token.
Phase 34A hardens the enterprise foundation with token expiry, revoked-token
rejection, cross-tenant denial checks, and a protected security readiness
diagnostic route. It is still a bounded enterprise safety layer, not full
SSO/IAM, user lifecycle management, or compliance automation.
Phase 35A adds hash-only managed user/token lifecycle persistence: an admin can
list managed users, create/update a token-backed user, revoke that user, and
verify that revoked state survives a fresh service application instance. Token
values are not returned by the API or stored as plaintext.
Phase 36A adds filtered enterprise audit query/export so operators can retrieve
bounded audit evidence by outcome, code, path, user, tenant, or time window and
export JSON/JSONL content without broad system log scanning.
Phase 37A adds enterprise deployment/ops readiness, hash-only backup creation,
and restore validation dry-run. It verifies deploy-time configuration, writes a
bounded JSON backup under the configured enterprise backup directory, and
validates that backup without mutating the live service.
Phase 38A adds redacted enterprise production startup readiness: it checks
real-provider startup configuration, enterprise auth/token posture, durable
knowledge storage, audit path, backup path, and secret presence without
exposing secret values.
Phase 40A adds a read-only Web console deployment preflight view: it aggregates
existing service health, deployment readiness, startup readiness, security
readiness, and vector readiness responses into a UI Go/No-Go panel without
adding a new backend business route.
Phase 41A adds a browser-local enterprise config wizard in `/ui`: operators can
paste a private `.env` draft for missing-config checks without uploading,
saving, or echoing secret values.
Phase 42A adds a read-only enterprise handoff manifest check that verifies the
deployment documents, environment template, default scripts, enterprise
aggregate command, and boundary wording without release automation.
Phase 43A adds a read-only enterprise acceptance report that summarizes
existing evidence, documents, commands, and official boundaries without calling
providers, provisioning infrastructure, or running release automation.
Phase 44A adds a protected read-only Web console entry for that acceptance
report at `GET /enterprise/acceptance/report`; it only reads the Phase43A
report/evidence and does not call providers, mutate runtime data, provision
infrastructure, or run release automation.
Phase 45A adds a read-only enterprise release-candidate dry-run that checks
delivery docs, scripts, evidence, UI markers, safe environment template, and
boundary wording without creating packages, publishing releases, calling
providers, provisioning infrastructure, or recording secret values.
Phase 46A exposes the Phase45A release-candidate dry-run through a protected
read-only Web console route at `GET /enterprise/release-candidate/dry-run`;
it only reads existing evidence and does not create packages, publish releases,
call providers, provision infrastructure, or record secret values.
Phase 47A adds a protected read-only enterprise overview at
`GET /enterprise/overview`; it aggregates governance health, readiness,
acceptance evidence, and release-candidate dry-run evidence without provider
calls, runtime mutation, packaging, release automation, or infrastructure
provisioning.
Phase 48A keeps that route unchanged and adds a readable one-screen Web
summary in `/ui`: overall status, governance, deployment, startup, security,
vector readiness, acceptance, release-candidate, and safety are shown as
status rows while the raw JSON remains available for diagnosis.
Phase 49A keeps the same Web API surface and improves `/ui` Chinese
readability: visible labels, buttons, placeholders, and side-panel summaries
are Chinese-first while existing English markers remain available for bounded
verification.
Phase 31A adds bounded, real user-facing experience capabilities on top of the
frozen command set: streaming Chat-first output through `/chat/rag/stream`,
provider visibility/selection through the UI and `/providers`, retryable
fallback execution when `AI_GATEWAY_FALLBACK_ENABLED=true`, a runtime dashboard
at `/dashboard/status`, heuristic evaluation/scoring, long-term memory backed
by the knowledge store, explicit text connector import, optional auth/tenant
headers, query-time GraphRAG-style result graphs, and the existing safe local
workflow loop. These are minimum usable loops that a user can open, click, and
verify; they are not enterprise IAM, broad external crawling, arbitrary local
automation, governance automation, or release automation.
Phase 30A adds a minimal safe local business workflow automation loop:
`POST /workflow/run` may retrieve local knowledge, compose a Markdown report,
and write one controlled artifact under the managed workflow output directory.
It does not execute arbitrary local commands, scan broad files, automate the
OS, or run external connectors. Phase 29A adds a bounded service-side RAG chat
entry at `POST /chat/rag`:
the service retrieves local knowledge, injects structured citations, and then
routes the augmented prompt through the existing gateway provider path. The
default `/chat` NVIDIA single-provider lane remains unchanged. Phase 26A turns
the Web surface into a minimal Chat-first foreground at
`http://127.0.0.1:3100/ui`: files can be dropped directly into the chat
surface for bounded knowledge loading, and user prompts now call `/chat/rag`
so knowledge retrieval happens in the service layer. Business workflow
automation is now limited to the safe Phase 30A local loop. Phase 25A adds the
minimal Web visual operation console at
`http://127.0.0.1:3100/ui` when `ai-gateway-service` is running. The console is
a static operation surface that calls existing health and knowledge APIs only.
Phase 27 adds local durable knowledge persistence for daily managed startup:
`dev:phase7b` enables `file-sqlite` storage under `.data/knowledge`, so
documents imported through the Web chat/file load path are restored after
service restart and machine reboot. The retrieval mode remains local keyword;
pgvector/Supabase remains an explicit vector mode covered by `verify:phase23`.
Phase 24Z is sealed for the final delivery guide and real-usage knowledge
sample load/retrieve validation. Phase 23Z is sealed for the real vector
production-readiness path: with
explicit vector configuration, `verify:phase23` has passed real Gemini
embedding plus pgvector write/read/retrieve. The default usable knowledge
baseline remains local-keyword/in-memory unless vector mode is explicitly
enabled.
Phase 22Z seals the current-boundary knowledge quality baseline and
off-by-default next-gen knowledge infrastructure base. Phase 21Z seals the
current-boundary knowledge usable state.
Phase 21C is sealed for the minimal agent-console to knowledge retrieval chain.
Phase 21B is sealed for minimal local knowledge source loading on top of the AI
Gateway baseline. Phase 21A is sealed for the minimal local knowledge entry.
Phase 19A is sealed for the final default command set freeze
and closure summary. Phase 18F is sealed for the default command set real-operation
regression and final documentation closure. Phases 9C, 10A, 11A, 12A, 13A,
14A, 15A, and 16C are sealed for managed startup, stop, status, restart,
health, doctor, help, idle, and logs. Phase 8A is sealed for single-command
integration acceptance orchestration. Phase 7A is sealed through Phase 7A-5:
`apps/agent-console` calls `apps/ai-gateway-service` over HTTP using the shared
SDK, and the service routes `POST /chat` to NVIDIA only.

Default command set:

```powershell
cmd /c pnpm help:phase14a
cmd /c pnpm start:pme
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm logs:phase16a
cmd /c pnpm restart:phase11a
cmd /c pnpm idle:phase15a
cmd /c pnpm stop:phase9c
cmd /c pnpm verify:phase7a
cmd /c pnpm verify:phase8a-4
cmd /c pnpm verify:phase21
cmd /c pnpm verify:phase22
cmd /c pnpm verify:phase23
cmd /c pnpm verify:phase24
cmd /c pnpm verify:phase25a
cmd /c pnpm verify:phase26a
cmd /c pnpm verify:phase27
cmd /c pnpm verify:phase28a
cmd /c pnpm verify:phase29a
cmd /c pnpm verify:phase30a
cmd /c pnpm verify:phase31a
cmd /c pnpm verify:phase32a
cmd /c pnpm verify:phase33a
cmd /c pnpm verify:phase34a
cmd /c pnpm verify:phase35a
cmd /c pnpm verify:phase36a
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
cmd /c pnpm verify:phase49a
cmd /c pnpm verify:phase50a
cmd /c pnpm verify:phase51a
cmd /c pnpm verify:phase52a
cmd /c pnpm verify:phase53a
cmd /c pnpm verify:phase54a
cmd /c pnpm verify:phase55a
cmd /c pnpm verify:phase56a
cmd /c pnpm verify:phase57a
cmd /c pnpm verify:phase58a
cmd /c pnpm verify:phase59a
cmd /c pnpm verify:phase60a
cmd /c pnpm verify:phase61a
cmd /c pnpm verify:phase62a
cmd /c pnpm verify:phase63a
cmd /c pnpm verify:phase64a
cmd /c pnpm verify:phase65a
cmd /c pnpm verify:phase66a
cmd /c pnpm verify:phase67a
cmd /c pnpm verify:phase68a
cmd /c pnpm verify:phase69a
cmd /c pnpm verify:phase70a
cmd /c pnpm verify:phase71a
cmd /c pnpm verify:phase72a
cmd /c pnpm verify:phase73a
cmd /c pnpm verify:phase74a
cmd /c pnpm verify:phase75a
cmd /c pnpm verify:phase76a
cmd /c pnpm verify:phase76b
cmd /c pnpm verify:phase76c
cmd /c pnpm verify:phase76d
cmd /c pnpm verify:phase76e
cmd /c pnpm verify:phase76f
cmd /c pnpm verify:phase76g
cmd /c pnpm verify:phase76h
cmd /c pnpm verify:phase76i
cmd /c pnpm verify:phase76j
cmd /c pnpm verify:phase76k
cmd /c pnpm verify:phase78a
cmd /c pnpm verify:phase79a
cmd /c pnpm verify:phase80a
cmd /c pnpm verify:phase81a
cmd /c pnpm verify:phase82a
cmd /c pnpm verify:phase83a
cmd /c pnpm verify:phase84a
cmd /c pnpm verify:phase85a
cmd /c pnpm verify:phase86a
cmd /c pnpm verify:phase87a
cmd /c pnpm verify:phase88a
cmd /c pnpm verify:phase89a
cmd /c pnpm verify:phase90a
cmd /c pnpm verify:phase91a
cmd /c pnpm verify:phase92a
cmd /c pnpm verify:phase93a
cmd /c pnpm verify:phase94a
cmd /c pnpm verify:phase95a
cmd /c pnpm verify:phase96a
cmd /c pnpm verify:phase97a
cmd /c pnpm verify:phase98a
cmd /c pnpm verify:phase99a
cmd /c pnpm verify:phase100a
cmd /c pnpm verify:phase101a
cmd /c pnpm verify:phase102a-workforce
cmd /c pnpm verify:phase102b-workforce-ux
cmd /c pnpm verify:phase102c-workforce-product-closure
cmd /c pnpm verify:phase102d-workforce-plan-store
cmd /c pnpm verify:phase102e-workforce-user-guide
cmd /c pnpm verify:phase103a-product-readiness
cmd /c pnpm verify:phase104a-first-run-setup
cmd /c pnpm verify:phase76l
cmd /c pnpm verify:phase76m
cmd /c pnpm verify:phase76n
cmd /c pnpm verify:phase76o
cmd /c pnpm verify:phase76p
cmd /c pnpm verify:phase76q
cmd /c pnpm verify:phase76r
cmd /c pnpm verify:phase76s
cmd /c pnpm verify:phase8a-model-import
cmd /c pnpm verify:enterprise
cmd /c pnpm verify:phase21a
cmd /c pnpm verify:phase21b
cmd /c pnpm verify:phase21c
```

User-facing startup entry: `start:pme`, which runs a first-run preflight and then
reuses the managed `dev:phase7b` startup path. Long-running entries:
`dev:phase7b` and `restart:phase11a`.
Read-only entries: `help:phase14a`, `status:phase10a`, `doctor:phase13a`, and
`logs:phase16a`. One-shot validation or cleanup entries: `health:phase12a`,
`idle:phase15a`, `stop:phase9c`, `verify:phase7a`, `verify:phase8a-4`, and
`verify:phase21` / `verify:phase22` / `verify:phase23` /
`verify:phase21a` / `verify:phase21b` / `verify:phase21c`,
`verify:phase24`, `verify:phase25a`, `verify:phase26a`,
`verify:phase27`, `verify:phase28a`, `verify:phase29a`, and
`verify:phase30a` / `verify:phase31a` / `verify:phase32a` /
`verify:phase33a` / `verify:phase34a` / `verify:phase35a` /
`verify:phase36a` / `verify:phase37a` / `verify:phase38a` /
`verify:phase40a` / `verify:phase41a` / `verify:phase42a` /
`verify:phase43a` / `verify:phase44a` /
`verify:phase45a` /
`verify:phase46a` /
`verify:phase47a` /
`verify:phase48a` /
`verify:phase49a` /
`verify:phase50a` /
`verify:phase51a` /
`verify:phase52a` /
`verify:phase53a` /
`verify:phase54a` /
`verify:phase55a` /
`verify:phase56a` /
`verify:phase57a` /
`verify:phase58a` /
`verify:phase59a` /
`verify:phase60a` /
`verify:phase61a` /
`verify:phase62a` /
`verify:phase63a` /
`verify:phase64a` /
`verify:phase65a` /
`verify:phase66a` /
`verify:phase67a` /
`verify:phase68a` /
`verify:phase69a` /
`verify:phase70a` /
`verify:phase71a` /
`verify:phase72a` /
`verify:phase73a` /
`verify:phase74a` /
`verify:phase75a` /
`verify:phase76a` /
`verify:phase76b` /
`verify:phase76c` /
`verify:phase76d` /
`verify:phase76e` /
`verify:phase76f` /
`verify:phase76g` /
`verify:phase76h` /
`verify:phase76i` /
`verify:phase76j` /
`verify:phase76k` /
`verify:phase76l` /
`verify:phase76m` /
`verify:phase76n` /
`verify:phase76o` /
`verify:phase76p` /
`verify:phase76q` /
`verify:phase76r` /
`verify:phase76s` /
`verify:enterprise`.
Phase 27 persistence validation is available as `verify:phase27`; it checks
that an imported knowledge document is written to local JSON plus SQLite and
can be retrieved after a fresh service application is created with the same
persistence directory.
Phase 28A documented feature closure validation is available as
`verify:phase28a`; it checks that the currently documented feature set is
connected through docs, UI, service health, file-type discovery, file import,
local retrieval, persistence wording, and readiness diagnostics.
Phase 29A service RAG validation is available as `verify:phase29a`; it checks
`POST /chat/rag` end to end: local knowledge retrieve, structured citations,
gateway provider answer, and Web UI wiring.
Phase 30A local workflow validation is available as `verify:phase30a`; it
checks `GET /workflow/health`, `GET /workflow/actions`, `POST /workflow/plan`,
and `POST /workflow/run`. The run path is an allowlisted local automation loop:
`knowledge.retrieve` -> `report.compose` -> `artifact.write` only. The artifact
write is constrained to the managed workflow output directory, and the workflow
service does not execute shell commands, scan arbitrary files, automate the OS,
or call external connectors.
Phase 31A experience-capability validation is available as `verify:phase31a`;
it checks the Chat-first UI markers plus real HTTP/SSE loops for dashboard,
provider list, optional auth status, streaming RAG chat, retryable fallback to
a backup provider, long-term memory, explicit text connector import,
evaluation/scoring, query-time graph retrieval, and safe workflow execution.
The default `/chat` lane remains NVIDIA single-provider unless explicitly
configured otherwise.
Phase 32A enterprise governance validation is available as `verify:phase32a`;
it checks optional enterprise auth, tenant identity, admin/viewer RBAC,
protected route denial, and audit recording. Enable it with
`PME_ENTERPRISE_AUTH_ENABLED=true` plus either `PME_ENTERPRISE_USERS_JSON` or
`PME_AUTH_TOKEN`. This is the enterprise safety foundation only; it is not full
IAM, SSO, SAML/OIDC, lifecycle management, or a policy administration console.
Phase 33A enterprise admin console validation is available as
`verify:phase33a`; it checks the Web console enterprise panel and the same
protected governance routes from an operator-facing surface.
Phase 34A enterprise security hardening validation is available as
`verify:phase34a`; it checks security readiness, token expiry rejection,
revoked-token rejection, cross-tenant denial, protected audit visibility, and
the Web console security-readiness control.
Phase 35A enterprise user lifecycle validation is available as
`verify:phase35a`; it checks the protected managed user API, hash-only token
storage, managed token authentication, token revocation, persistence across a
fresh service application instance, audit records, and the Web console managed
user controls.
Phase 36A enterprise audit export validation is available as
`verify:phase36a`; it checks filtered audit query, JSON/JSONL export, denied
event evidence, and the Web console audit export control.
Phase 37A enterprise ops readiness validation is available as
`verify:phase37a`; it checks protected deployment readiness, admin-only backup
creation, hash-only enterprise user backup content, restore validation dry-run,
path containment for restore validation, and Web console backup/readiness
controls.
Phase 38A enterprise startup readiness validation is available as
`verify:phase38a`; it checks protected production-startup readiness for real
NVIDIA provider configuration, enterprise auth/token posture, durable knowledge
storage, audit path, backup path, and redacted secret presence. It does not
call the provider and does not print API keys.
Phase 40A enterprise deployment preflight validation is available as
`verify:phase40a`; it checks that `/ui` exposes a read-only deployment
preflight panel over existing readiness endpoints and that those endpoints can
be read with an admin token without leaking secrets.
Phase 41A enterprise config wizard validation is available as
`verify:phase41a`; it checks that `/ui` exposes a browser-local `.env` draft
checker that reports missing required settings and secret presence without
uploading, saving, or echoing secret values.
Phase 42A enterprise handoff manifest validation is available as
`verify:phase42a`; it checks the handoff manifest, delivery docs, runbook,
operation manual, `.env.enterprise.example`, enterprise scripts, and UI safety
markers. It is read-only and does not provision infrastructure or run release
automation.
Phase 43A enterprise acceptance report validation is available as
`verify:phase43a`; it summarizes existing evidence, required docs, command
coverage, and boundary markers into `docs/ENTERPRISE_ACCEPTANCE_REPORT.md`.
It is read-only over existing artifacts and does not call providers,
provision infrastructure, or run release automation.
Phase 44A enterprise acceptance report UI validation is available as
`verify:phase44a`; it checks the protected read-only
`GET /enterprise/acceptance/report` route and the Web console panel that
displays the existing Phase43A report/evidence. It does not call providers,
mutate runtime data, provision infrastructure, run release automation, or
record secret values.
Phase 45A enterprise release-candidate dry-run validation is available as
`verify:phase45a`; it checks the current handoff docs, operation manual,
environment template, enterprise scripts, existing evidence, UI safety markers,
and official boundaries. It is read-only and does not create a package,
publish a release, call providers, provision infrastructure, mutate runtime
data, or record secret values.
Phase 46A enterprise release-candidate UI validation is available as
`verify:phase46a`; it checks the protected read-only
`GET /enterprise/release-candidate/dry-run` route and the Web console panel
that displays the existing Phase45A evidence. It does not create packages,
publish releases, call providers, mutate runtime data, provision
infrastructure, run release automation, or record secret values.
Phase 47A enterprise overview UI validation is available as
`verify:phase47a`; it checks the protected read-only
`GET /enterprise/overview` route and the Web console panel that consolidates
governance health, readiness, acceptance report evidence, and
release-candidate dry-run evidence. It does not call providers, mutate runtime
data, create packages, publish releases, provision infrastructure, run release
automation, or record secret values.
Phase 48A enterprise overview readability validation is available as
`verify:phase48a`; it checks that the same Web console overview has a readable
one-screen summary and keeps the raw JSON view for diagnosis. It does not add a
new backend business route, call providers, mutate runtime data, create
packages, publish releases, provision infrastructure, run release automation,
or record secret values.
Phase 49A Web Chinese readability validation is available as
`verify:phase49a`; it checks that the Chat-first foreground and hidden
capability panel expose readable Chinese labels for daily use, governance,
knowledge, workflow, scoring, GraphRAG, and default-command surfaces. It is
display-only and does not add backend routes, call providers, mutate runtime
data, publish releases, or provision infrastructure.
Phase 50A help readability validation is available as `verify:phase50a`; it
checks that `help:phase14a` is served through the UTF-8 `tools/phase14a/help.mjs`
script and prints readable Chinese command/boundary text. It is read-only and
does not start services, stop processes, call providers, mutate runtime data,
refresh evidence outside its own verifier, publish releases, or provision
infrastructure.
Phase 51A Web user readability validation is available as `verify:phase51a`;
it checks that the first screen explains the daily command flow, keeps advanced
capabilities hidden in the side panel by default, and does not reintroduce the
manual source/document form into the main user path. It is display-only and
does not add backend routes, call providers, mutate runtime data, publish
releases, or provision infrastructure.
Phase 52A Web browser visual validation is available as `verify:phase52a`; it
starts a temporary service instance, renders `/ui` with a local headless
Chrome/Edge browser, and saves a screenshot evidence PNG. It is browser-render
only and does not add backend routes, call providers, mutate runtime data,
publish releases, or provision infrastructure.
Phase 53A Web chat interaction validation is available as `verify:phase53a`;
it renders `/ui` in a local headless browser, submits a prompt through the real
Chat-first form, and verifies that the page receives a bounded service-side
RAG answer through `/chat/rag/stream`. It uses the local fake provider only and
does not change the default NVIDIA `/chat` lane, add backend routes, call real
providers, publish releases, or provision infrastructure.
Phase 54A Web file upload interaction validation is available as
`verify:phase54a`; it renders `/ui` in a local headless browser, injects a
small text file through the real file input, verifies `/knowledge/load/file`,
then asks through Chat-first and verifies `/chat/rag/stream` can retrieve the
uploaded content. It uses the local fake provider only and does not change the
default NVIDIA `/chat` lane, add backend routes, call real providers, publish
releases, or provision infrastructure.
Phase 55A Web multi-file upload validation is available as `verify:phase55a`;
it renders `/ui` in a local headless browser, injects multiple files through
the real file input, verifies one small file is loaded through
`/knowledge/load/file`, verifies an oversized file is skipped with the 100MB
message, then asks through Chat-first and verifies `/chat/rag/stream` can
retrieve the loaded content. It uses the local fake provider only and does not
change the default NVIDIA `/chat` lane, add backend routes, call real
providers, publish releases, or provision infrastructure.
Phase 56A Web chat error readability validation is available as
`verify:phase56a`; it renders `/ui` in a local headless browser, simulates a
bounded `/chat/rag/stream` plus fallback `/chat/rag` failure inside the browser,
and verifies the Chat-first surface shows a readable error state with HTTP
status and error code. It does not call real providers, add backend routes,
change the default NVIDIA `/chat` lane, publish releases, or provision
infrastructure.
Phase 57A Web chat no-hit readability validation is available as
`verify:phase57a`; it renders `/ui` in a local headless browser, asks a query
that should not match local knowledge, and verifies `/chat/rag/stream` returns
a readable no-hit / insufficient-data instruction instead of implying the
system failed. It uses the local fake provider only and does not change the
default NVIDIA `/chat` lane, add backend routes, call real providers, publish
releases, or provision infrastructure.
Phase 58A Web chat empty-input readability validation is available as
`verify:phase58a`; it renders `/ui` in a local headless browser, submits a
whitespace-only chat message, and verifies the Chat-first surface shows a clear
system hint without sending `/chat/rag/stream`, `/chat/rag`, or `/chat`
requests. It does not call providers, add backend routes, change the default
NVIDIA `/chat` lane, publish releases, or provision infrastructure.
Phase 59A Web provider-list failure readability validation is available as
`verify:phase59a`; it renders `/ui` in a local headless browser, simulates a
bounded `/providers` failure before the page loads, and verifies the Chat-first
surface explains that the provider list is unavailable while the service will
continue using the server-side default route. It does not send chat requests,
call providers, add backend routes, change the default NVIDIA `/chat` lane,
publish releases, or provision infrastructure.
Phase 60A Web chat sending-state validation is available as `verify:phase60a`;
it renders `/ui` in a local headless browser, simulates a slow streaming chat
response, verifies the send button switches to `生成中`, and verifies a duplicate
submit is blocked with a readable system hint while only one `/chat/rag/stream`
request is sent. It does not call real providers, add backend routes, change
the default NVIDIA `/chat` lane, publish releases, or provision infrastructure.
Phase 61A Web chat complete-readability validation is available as
`verify:phase61a`; it renders `/ui` in a local headless browser and verifies
the remaining user-visible chat recovery paths: SSE `error` events are treated
as real failures, streaming failure can fall back to ordinary RAG, fallback
failure shows a readable next-step message, empty streams get a clear no-text
message, and the send button always returns to `发送`. It does not call real
providers, add backend routes, change the default NVIDIA `/chat` lane, publish
releases, or provision infrastructure.
Phase 62A Web chat session-persistence validation is available as
`verify:phase62a`; it renders `/ui` in a local headless browser and verifies
that chat messages are saved in the current browser, restored after reload, and
can be cleared from the UI. It uses local browser storage only, does not add
backend business routes, does not call real providers, and does not change the
default NVIDIA `/chat` lane.
Phase 63A Web chat abort validation is available as `verify:phase63a`; it
renders `/ui` in a local headless browser, simulates a long streaming answer,
clicks `停止生成`, verifies the stream is aborted, verifies no fallback request is
sent after a user stop, and verifies the UI returns to a send-ready state with a
clear stopped message. It does not call real providers, add backend routes,
change the default NVIDIA `/chat` lane, publish releases, or provision
infrastructure.
Phase 64A Web chat keyboard validation is available as `verify:phase64a`; it
renders `/ui` in a local headless browser, verifies `Enter` sends the chat,
`Shift+Enter` preserves a newline before sending, and focus returns to the chat
input after the response. It does not call real providers, add backend routes,
change the default NVIDIA `/chat` lane, publish releases, or provision
infrastructure.
Phase 65A Web chat message actions validation is available as
`verify:phase65a`; it renders `/ui` in a local headless browser and verifies
copy answer, copy citations, and retry last prompt actions on assistant
messages. It is UI-only, uses a simulated stream, and does not call real
providers, add backend routes, change the default NVIDIA `/chat` lane, publish
releases, or provision infrastructure.
Phase 66A Web chat citation readability validation is available as
`verify:phase66a`; it renders `/ui` in a local headless browser and verifies
that retrieved citations appear as a readable citation list with expandable
details and per-citation copy actions. It is UI-only, uses a simulated stream,
and does not call real providers, add backend routes, change the default
NVIDIA `/chat` lane, publish releases, or provision infrastructure.
Phase 67A Web chat status feedback validation is available as
`verify:phase67a`; it renders `/ui` in a local headless browser and verifies
that each assistant answer shows gateway connection, knowledge retrieval,
generation, and completion status separately from the saved answer text. It is
UI-only, uses a simulated stream, and does not call real providers, add backend
routes, change the default NVIDIA `/chat` lane, publish releases, or provision
infrastructure.
Phase 68A Web chat Markdown-lite rendering validation is available as
`verify:phase68a`; it renders `/ui` in a local headless browser and verifies
assistant answers can safely display paragraphs, bullet lists, numbered lists,
code blocks, and http/https links while unsafe links render as plain text and
raw answer text remains available for copy/history. It is UI-only, uses a
simulated stream, and does not call real providers, add backend routes, change
the default NVIDIA `/chat` lane, publish releases, or provision infrastructure.
Phase 69A Web chat code-block tools validation is available as
`verify:phase69a`; it renders `/ui` in a local headless browser and verifies
assistant answers can show inline code, fenced code blocks with a language
toolbar, a per-code-block copy button, and horizontal scrolling for long code
lines. It is UI-only, uses a simulated stream, and does not call real
providers, add backend routes, change the default NVIDIA `/chat` lane, publish
releases, or provision infrastructure.
Phase 70A Web chat Markdown block validation is available as `verify:phase70a`;
it renders `/ui` in a local headless browser and verifies assistant answers can
safely display blockquotes, Markdown tables, and horizontal dividers while
preserving the raw answer for copy/history. It is UI-only, uses a simulated
stream, and does not call real providers, add backend routes, change the
default NVIDIA `/chat` lane, publish releases, or provision infrastructure.
Phase 71A Web chat long-answer viewport validation is available as
`verify:phase71a`; it renders `/ui` in a local headless browser and verifies
long streaming answers auto-follow when the user is at the bottom, preserve a
manual scroll position when the user reads earlier content, and keep the final
answer visible after completion. It is UI-only, uses a simulated stream, and
does not call real providers, add backend routes, change the default NVIDIA
`/chat` lane, publish releases, or provision infrastructure.
Phase 72A Web chat composer validation is available as `verify:phase72a`; it
renders `/ui` in a local headless browser and verifies the Chat input area has
empty-send protection, auto-resizing textarea behavior, visible shortcut/count
feedback, Shift+Enter newline preservation, Ctrl/Cmd+Enter send, and focus
restoration after send. It is UI-only, uses a simulated stream, and does not
call real providers, add backend routes, change the default NVIDIA `/chat`
lane, publish releases, or provision infrastructure.
Phase 73A Web chat mobile viewport validation is available as
`verify:phase73a`; it renders `/ui` at a phone-sized viewport and verifies the
page has no horizontal or whole-document scroll, the chat shell, history, and
composer stay inside the viewport, mobile quick-start content is compacted, and
primary controls remain visible. It is UI-only and does not call real
providers, add backend routes, change the default NVIDIA `/chat` lane, publish
releases, or provision infrastructure.

Phase 74A Web chat first-screen polish validation is available as
`verify:phase74a`; it renders `/ui` at a desktop viewport and verifies the
opening screen behaves like a clean chat product entry: the command checklist is
collapsed by default, the greeting is short, the side panel is hidden, and the
input remains the primary action. It is UI-only and does not call real
providers, add backend routes, change the default NVIDIA `/chat` lane, publish
releases, or provision infrastructure.

Phase 75A Web chat final experience validation is available as
`verify:phase75a`; it renders `/ui`, sends a simulated streaming chat request,
and verifies the final chat surface: structured user/assistant bubbles with
labels and timestamps, readable citations, copy/retry actions, long-answer
overflow handling, and a visible scroll-to-bottom recovery control. It remains
UI-only over simulated provider output and does not call real providers, add
backend routes, change the default NVIDIA `/chat` lane, publish releases, or
provision infrastructure.
Phase 76A Web chat command-center validation is available as
`verify:phase76a`; it renders `/ui` in a local browser and verifies bounded
chat-window command cards for model configuration, service status, health, and
knowledge status. These cards call existing safe HTTP APIs only, do not persist
API keys, do not add backend routes, and do not change the default NVIDIA
`/chat` lane.
Phase 76B Web chat config persistence validation is available as
`verify:phase76b`; it verifies that the model configuration card can remember a
provider/model selection in current-browser storage across reloads while never
persisting API key draft values. Generated startup templates are redacted and
do not change server runtime configuration by themselves.
Phase 76C Web chat config wizard validation is available as `verify:phase76c`;
it verifies that the same model configuration flow is presented as a guided
three-step card with current status, next action, safe secret handling, and a
copyable redacted startup template. It remains a browser UI experience layer and
does not change the backend chat lane or persist API key values.
Phase 76D Web chat config effect-status validation is available as
`verify:phase76d`; it verifies that the chat card clearly shows whether a model
choice is effective for the current chat, remembered for the next browser
session, or only ready to become long-lived after copying the startup template
and restarting the managed service. It remains UI feedback only and does not
mutate service runtime configuration.
Phase 76E Web chat config availability-probe validation is available as
`verify:phase76e`; it verifies that the model configuration wizard exposes a
user-triggered “检测当前模型是否可用” action. The action reuses the existing
`/chat` route to perform a tiny availability probe, shows a clear pass/fail
status in the card, does not persist API key draft values, does not add backend
business routes, and does not alter the default chat main lane.
Phase 76F Web chat one-click model apply/probe validation is available as
`verify:phase76f`; it verifies that the same configuration wizard provides a
single primary “一键应用并检测” action for ordinary users. The action applies the
selected provider/model to the current browser chat and immediately runs the
same existing `/chat` availability probe. It remains a UI convenience layer and
does not store API keys, add backend routes, or mutate service runtime config.
Phase 76G Web chat model config collapse validation is available as
`verify:phase76g`; it verifies that the ordinary path keeps only the primary
“一键应用并检测” and “记住默认选择” actions visible, while advanced actions such as
single apply, single probe, clearing preferences, API key draft checks, startup
templates, and raw diagnostics stay collapsed behind “更多选项” or “高级启动配置”.
It remains a front-end usability layer and does not change provider execution,
store API keys, add backend routes, or mutate service runtime config.
Phase 76H Web chat model status-bar validation is available as
`verify:phase76h`; it verifies that the composer shows the current chat model,
probe status, and remember-default status next to the input area. The composer
configuration button opens the same chat-native model configuration wizard, and
the one-click apply/probe result is reflected back into the composer status bar.
It remains a front-end usability layer and does not change provider execution,
store API keys, add backend routes, or mutate service runtime config.
Phase 76I Web chat smart composer guidance validation is available as
`verify:phase76i`; it verifies that the input hint changes with empty input,
typed input, model checking, model probe success/failure, and sending state.
It remains a front-end usability layer and does not change provider execution,
store API keys, add backend routes, or mutate service runtime config.
Phase 76J Web chat top-provider minimization validation is available as
`verify:phase76j`; it verifies that the header provider dropdown is collapsed
behind a lightweight model-settings entry by default, while the same
`provider-select` remains available when expanded. It remains a front-end
usability layer and does not call providers, add backend routes, or mutate
service runtime config.
Phase 76K Web chat composer actions polish validation is available as
`verify:phase76k`; it verifies that the main input area keeps daily actions
lightweight: upload remains visible, clear-chat is collapsed behind a more menu,
and stop-generation only appears while an answer is being generated. It remains
a front-end usability layer and does not call providers, add backend routes, or
mutate service runtime config.
Phase 76L Web chat knowledge upload receipt validation is available as
`verify:phase76l`; it verifies that uploading a file produces a readable chat
receipt, updates the input placeholder and composer hint to show the document
is now in the knowledge base, and the next chat can retrieve that uploaded
content through the existing RAG stream. It remains a front-end usability layer
over existing knowledge load and chat routes.
Phase 76M Web chat citation insight validation is available as
`verify:phase76m`; it verifies that knowledge hits are shown as readable
citation insight cards with source/document metadata, score, matched terms,
score breakdown, and highlighted snippets. It remains a front-end usability
layer and does not change the default NVIDIA `/chat` lane or knowledge
retrieval contract.
Phase 76N Web chat runtime API Key add validation is available as
`verify:phase76n`; it verifies that the chat-native model wizard can accept an
API Key, store it only in the current local service memory, immediately run the
existing `/chat` probe, clear the secret field, and avoid writing the secret to
browser storage, logs, or evidence. This is a bounded runtime convenience path:
service restart clears the runtime key, and long-lived keys should still be set
through startup environment variables.
Phase 76O Web chat API Key auto-match validation is available as
`verify:phase76o`; it verifies that the chat-native model wizard can detect a
key family before storing it, surface safe provider/model candidates, let the
user manually choose a model, then add the key memory-only and probe through the
existing `/chat` path. It now uses a bounded provider catalog plus live
provider `/models` discovery when the key family is unambiguous. Ambiguous
generic keys such as `sk-` are not sprayed across providers; the UI presents
candidate providers and only probes the user-selected lane. Detection does not
store the key, does not log the key value, and refuses to force an unrecognized
or non-chat key into NVIDIA. A reachable provider `/models` list is treated as
model catalog discovery only; it does not prove the API key can run chat. The
existing `/chat` probe remains the real usability check. `Local Fake Provider`
and `Local Fake Model` are test-only entries and should not be treated as real
model matches for user keys.
Phase 76P Web chat model capability matcher validation is available as
`verify:phase76p`; it verifies that API Key detection now returns structured
provider/model capability profiles for chat, vision, reasoning, coding,
tool-use, structured output, image generation, audio input, speech output,
video generation, embedding, rerank, and moderation where the provider catalog
or live model metadata supports those distinctions. The chat model dropdown
must only contain models that are executable by the current chat lane; other
capabilities may be recognized and displayed as diagnostics, but must not be
pretended to be one-click chat models. Generic `sk-` keys remain
provider-choice-required and are not sprayed across vendors. Unknown key
families do not auto-select NVIDIA. `Local Fake Provider` remains test-only
and is excluded from real/unknown key fallback.
Phase 76Q Web chat user API catalog coverage validation is available as
`verify:phase76q`; it verifies the provider families observed from the local
user API workbook without recording secret values. The matcher now recognizes
iFlytek Spark, Baidu Qianfan, Tencent Hunyuan, Zhipu AI, SiliconFlow,
DashScope, ModelScope, Gemini, Cloudflare Workers AI, Groq, Hugging Face,
OpenAI, Coze, and generic OpenAI-compatible relay clues. Generic or relay
`sk-` keys still require provider confirmation or a base URL; they must not be
sprayed across vendors, must not default to OpenAI without proof, and must not
fall back to fake/NVIDIA. DashScope/Bailian-shaped `sk-` keys with a 32-hex
body are treated as DashScope candidates and verified through the DashScope
compatible-mode model path.
Phase 76R Web chat generic OpenAI-compatible runtime validation is available
as `verify:phase76r`; it verifies that a pasted relay/custom credential
containing both an API Key and a base URL can be parsed, added memory-only as
`generic-openai-compatible`, and used through the existing `/chat` path against
an OpenAI-compatible `/chat/completions` endpoint. Generic relay keys without a
base URL remain not actionable, because the system cannot safely infer where to
send the secret.
Phase 76S Web chat model-list probe validation is available as
`verify:phase76s`; it verifies the explicit user-triggered `/models` probing
path for ambiguous API keys. Safe default paste mode still does not spray a
generic `sk-` key across vendors and does not default to OpenAI. When the user
clicks the model auto-detect action, the service may make bounded model-list
requests only to catalogued candidate providers, mark providers that reject the
key as `auth-failed`, and recommend the provider only when its model-list API
authenticates and returns usable models. This route must never store or log the
API Key, and the final `/chat` probe remains the real chat-usability check.
The model import line is validated by `verify:phase8a-model-import`: pasted
keys are cleaned and probed through provider model-list APIs, discovered models
come only from those API responses, ambiguous multi-provider hits require user
selection, and confirmation stores the key memory-only in the local dev
registry without changing the default NVIDIA `/chat` lane.
Phase 87A Web chat model config usability-status validation is available as
`verify:phase87a`; it verifies that the successful API Key/model configuration
path explains, in the chat UI, which provider was identified, which model was
selected, whether it was added to the current service, whether `/chat` probing
passed, whether the default choice was remembered, and that API keys are not
stored in browser state, chat history, logs, or evidence.
Phase 88A Web chat model config first-chat validation is available as
`verify:phase88a`; it verifies that immediately after the same successful
configuration flow, a real first user prompt from the chat composer uses the
new runtime provider/model through `/chat/stream`, receives a streamed answer,
clears the input, returns focus to the composer, and still avoids storing API
keys in browser state, chat history, logs, or evidence. It uses a local mock
OpenAI-compatible provider only and does not change the default NVIDIA `/chat`
lane.
Phase 89A Web chat model config restart-persistence validation is available as
`verify:phase89a`; it verifies that a local-file runtime model configuration
survives browser reload and same-port service restart, restores the remembered
provider/model selection, and sends chat through `/chat/stream` without
requiring the API Key to be entered again. It uses a temporary local credential
file plus a local mock OpenAI-compatible provider, then removes the temporary
file after verification.
Phase 90A Web chat model config restart-status readability validation is
available as `verify:phase90a`; it verifies that after browser reload and
same-port service restart, the chat composer visibly explains that the model
and API Key were restored from local user configuration, remain usable after
service restart, and can be used directly without re-entering the key. It does
not pretend a fresh `/chat` probe has already been rerun, does not call real
providers, and does not alter the default NVIDIA `/chat` lane.
Phase 91A Web chat restored-config recovery validation is available as
`verify:phase91a`; it verifies that when a locally restored runtime model later
fails during chat, the assistant error and composer status tell the user to
re-check the restored API Key, provider, base URL, and model. The composer
action changes to `重新检测模型` while the page remains usable. It uses simulated
browser failures only, does not call real providers, and does not alter the
default NVIDIA `/chat` lane.
Phase 92A Web chat model-config repair-loop validation is available as
`verify:phase92a`; it verifies that clicking the restored-config recovery
action opens the model configuration wizard in repair mode, carries forward the
current provider/model/base URL where available, focuses the API Key repair
path, and can re-run the existing `/chat` availability probe after replacing
the local runtime credential. It uses simulated browser failures and repair
responses only, does not call real providers, and does not alter the default
NVIDIA `/chat` lane.
Phase 93A Web chat continue-after-repair validation is available as
`verify:phase93a`; it verifies that after a restored model failure is repaired
and the model probe passes, the repair card offers `继续刚才的问题` and can resend
the previously failed prompt without the user typing it again. It uses
simulated browser failures and repair responses only, does not call real
providers, and does not alter the default NVIDIA `/chat` lane.
Phase 94A Web chat model-config repair visual polish validation is available
as `verify:phase94a`; it verifies that the repair success card keeps only the
most useful next-step text visible, folds diagnostic details under
`查看检测细节`, and makes `继续刚才的问题` the primary first action when a failed
prompt can be resumed. It remains UI-only, uses simulated provider responses,
does not call real providers, and does not alter the default NVIDIA `/chat`
lane.
Phase 95A Web chat model-config ready-to-chat validation is available as
`verify:phase95a`; it verifies that clicking `继续聊天` after a successful model
probe focuses the chat input, changes the placeholder and composer hint to a
clear ready-to-chat state, and updates the session status without saving API
keys in browser storage or evidence. It remains UI-only over the existing
model import and `/chat` paths and does not alter the default NVIDIA `/chat`
lane.
Phase 96A Web chat ready-first-message validation is available as
`verify:phase96a`; it verifies the end-user flow after model configuration:
the successful model config state returns focus to the chat input, the first
typed message sends through the selected runtime model, the input clears, the
assistant answer returns, and focus comes back to the composer. It delegates to
the existing Phase 95A and Phase 88A browser checks, uses local mock provider
responses, keeps secrets out of evidence, and does not alter the default
NVIDIA `/chat` lane.
Phase 97A Web chat model-config aggregate validation is available as
`verify:phase97a`; it aggregates the successful model configuration path,
first configured-message path, repair-and-continue path, repair success visual
polish, ready-to-chat state, and ready-first-message flow into one browser
regression command. It reuses existing bounded checks, uses local mock provider
responses, keeps secrets out of evidence, and does not alter the default
NVIDIA `/chat` lane.
Phase 98A Web chat model-config user-journey validation is available as
`verify:phase98a`; it verifies the visible end-user path from the composer model
prompt, through the three-step configuration wizard, one-click add/detect,
success explanation, and the final continue-to-chat focus state. It uses a
local mock provider, keeps API keys out of evidence/browser state, and does not
alter the default NVIDIA `/chat` lane.
Phase 99A Web chat model-config visual final validation is available as
`verify:phase99a`; it delegates the Phase 98A browser journey, checks the
captured screenshot evidence, and verifies the visible composer prompt, wizard,
success state, and ready-to-chat guidance remain readable. It uses local mock
provider evidence only, keeps secrets out of evidence, and does not alter the
default NVIDIA `/chat` lane.
Phase 100A Web chat model-config stage-freeze validation is available as
`verify:phase100a`; it aggregates provider model import, explicit model-list
probing, successful and repaired configuration regressions, ready-first-message
behavior, and the final visual user journey into one bounded stage-freeze
command. It reuses existing evidence, uses local mocks only, keeps secrets out
of evidence, and keeps the default NVIDIA `/chat` lane unchanged.

Phase 101A freezes the ordinary-user model configuration copy with
`verify:phase101a`. The Web chat model setup surface now presents the simple
flow `配置模型 -> 粘贴 Key -> 识别可用模型 -> 一键检测并保存 -> 继续聊天`,
while advanced settings and startup templates stay collapsed for users who need
them. The check delegates the existing visual path, uses local mocks only, keeps
secrets out of evidence, and does not enable new routing or fallback behavior.
Phase 102A adds the minimal Agent Workforce product skeleton with
`verify:phase102a-workforce`. It exposes `GET /workforce/health`,
`GET /workforce/agents`, and `POST /workforce/plan`, plus SDK and Web console
preview wiring. The first version is deterministic and rule-based: it shows the
7-role AI company team and a task plan preview only. It does not call real LLMs,
run agents concurrently, execute code, write project files, change the default
NVIDIA `/chat` lane, change provider registry behavior, or connect to workflow
execution.

Phase 102B hardens the Agent Workforce preview experience with
`verify:phase102b-workforce-ux`. The Web console now shows example goals,
empty-goal guidance, loading/success/error status, structured role cards,
task/deliverable/acceptance/risk/next-action sections, and a Markdown copy
button. `/workforce/plan` also returns `planVersion`, `createdAt`, `summary`,
and `userFriendlyStatus`. It remains a preview-only deterministic planner and
must not execute agents, code, workflow runs, provider calls, or project-file
writes.

Phase 102C closes the Agent Workforce preview product loop with
`verify:phase102c-workforce-product-closure`. The `/ui` preview now supports
example goals, clear empty/invalid/too-long goal feedback, Markdown copy, JSON
export, clear/restart, visible max-length guidance, and structured plan sections
that ordinary users can read. `/workforce/plan` exposes `limitations`,
`markdown`, `exportableJson`, and `recommendedNextStep`. It still does not call
real LLMs, execute agents, run code, write user project files, attach workflow
execution, alter provider registry, or change the default NVIDIA `/chat` lane.

Phase 102D adds the dev-only Agent Workforce plan store with
`verify:phase102d-workforce-plan-store`. The service exposes
`POST /workforce/plans/save`, `GET /workforce/plans`,
`GET /workforce/plans/:id`, `DELETE /workforce/plans/:id`, and
`GET /workforce/plans/:id/export`; the Web console can save plans, reload
history, delete saved plans, and export task packages as JSON or Markdown. This
store is a local development plan history only: it must not save API keys,
write user project files, execute agents, call real LLMs, attach workflow runs,
alter provider registry behavior, or change the default NVIDIA `/chat` lane.

Phase 102E seals the Agent Workforce preview user guide with
`verify:phase102e-workforce-user-guide`. For ordinary users, Agent Workforce is
an AI company planning surface: enter a goal, generate a 7-role team plan, read
the role split, tasks, deliverables, acceptance criteria, risks, and next
actions, then copy Markdown, save history, or export a JSON/Markdown task
package. It is useful for requirement decomposition, team-role thinking, task
planning, and preparing a handoff package for a human developer or a later
explicit safe-execution mainline. It is not a real multi-agent executor: it
does not call real LLMs, run 144 staff, execute code, modify files, start
workflow runs, auto-ship product changes, alter provider registry behavior, or
change the default NVIDIA `/chat` lane.

Phase 103A adds the global product-readiness hardening check with
`verify:phase103a-product-readiness`. It verifies that `/ui` explains the core
entry points for Chat, API Key model import, Knowledge/RAG, Workflow, Agent
Workforce, and Enterprise/readiness in user-readable language; that unknown or
masked API keys produce clear next-step guidance instead of empty “model 0”
states; and that Agent Workforce remains a preview-only planner. It does not
claim global release completion, does not enable real multi-provider routing or
fallback execution, does not call real LLMs for Workforce, does not alter the
default NVIDIA `/chat` lane, and must keep API keys out of logs and evidence.

Phase 104A adds the first-run setup wizard check with
`verify:phase104a-first-run-setup`. It adds the read-only `GET /setup/readiness`
route and a `/ui` first-use guide for ordinary users: check service readiness,
add or detect a model, start chatting, try Agent Workforce planning, optionally
use Knowledge/RAG, and understand preview/dev-only limits before production
release. The readiness route aggregates existing health, model import, chat,
knowledge, and workforce state without calling real providers, exposing API
keys, changing the default NVIDIA `/chat` lane, or enabling real Agent
execution.

Phase 105A adds the ordinary-user end-to-end journey regression with
`verify:phase105a-user-journey`. It checks that a user can open `/ui`, read the
Setup Wizard, call `/setup/readiness`, understand Chat readiness, see clear
Model Import / API Key failure guidance, find Knowledge/RAG guidance, generate
an Agent Workforce plan, save it, list history, export it, delete the temporary
saved plan, and recover from readable error messages.

普通用户从 0 到 1 使用流程：

```powershell
cmd /c pnpm start:pme
# open http://127.0.0.1:3100/ui
```

Then follow the page: run the Setup Wizard readiness check, add or detect a
model, start Chat, optionally upload documents for Knowledge/RAG, then use
Agent Workforce to generate a planning package. If API Key detection fails,
choose the provider manually or fill the OpenAI-compatible Base URL; the
system must not guess models from API Key text. Agent Workforce task packages
can be saved, reloaded from history, copied as Markdown, or exported as JSON
for human review or a later explicitly approved execution mainline. Current
preview/dev-only surfaces must not be represented as global release completion,
real fallback execution, or real multi-Agent code execution.

Phase 106A adds the local installation, startup, and pre-delivery readiness
closure with `verify:phase106a-delivery-readiness`. It checks that a new tester
has enough documentation and placeholders to install dependencies, configure
runtime environment variables, start the service, open `/ui`, run readiness,
validate the ordinary-user journey, and understand preview/dev-only limits.

Phase 107A adds the release-before-secret-safety check with
`verify:phase107a-secret-safety`. It scans the documented release surface,
`apps/`, `packages/`, `docs`, and evidence text files for real-looking API keys
or credential URLs, verifies model-import masking, and confirms setup readiness
does not expose key values. Real API keys must stay out of README, AGENTS,
`.env.example`, UI text, logs, and evidence. The current local runtime
credential store is a developer convenience, not a production secret vault.

## 从 0 启动

1. Install prerequisites:

```powershell
node --version
pnpm --version
cmd /c pnpm install
```

2. Prepare local environment values. Copy `.env.example` to your own local
environment file or set values in PowerShell. Do not commit real API keys.
Minimum placeholders include `NVIDIA_API_KEY`, `NVIDIA_MODEL`,
`NVIDIA_BASE_URL`, `AI_GATEWAY_SERVICE_URL`, `OPENAI_API_KEY`,
`GEMINI_API_KEY`, and `OPENAI_COMPATIBLE_BASE_URL`.

3. Start PME:

```powershell
cmd /c pnpm start:pme
```

4. Open the Web console:

```text
http://127.0.0.1:3100/ui
```

5. Follow the Setup Wizard: run readiness, add or detect a model, then start
Chat. If API Key / baseUrl detection fails, select the provider manually or
fill the OpenAI-compatible base URL and retry. The system must not guess models
from API Key text.

6. Validate the delivery-ready path:

```powershell
cmd /c pnpm verify:phase106a-delivery-readiness
cmd /c pnpm verify:phase105a-user-journey
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
```

If startup or readiness fails, check `cmd /c pnpm status:phase10a`,
`cmd /c pnpm logs:phase16a`, and the readable error card in `/ui`. Current
preview/dev-only surfaces include Agent Workforce plan preview/history/export,
model-import guidance, and bounded readiness panels. They are not a claim that
global release, production fallback execution, full IAM/SSO, or real multi-Agent
code execution is complete.

Enterprise aggregate validation is available as `verify:enterprise`; it only
chains `verify:phase32a`, `verify:phase33a`, `verify:phase34a`,
`verify:phase35a`, `verify:phase36a`, `verify:phase37a`,
`verify:phase38a`, `verify:phase40a`, `verify:phase41a`, and
`verify:phase42a`, `verify:phase43a`, `verify:phase44a`, and
`verify:phase45a`, `verify:phase46a`, `verify:phase47a`, and
`verify:phase48a`.
Phase 24 delivery validation is available as `verify:phase24`; it is not a new
runtime command family and only checks the delivery guide plus a bounded
real-usage knowledge sample load/retrieve.
The real-operation regression is established for this frozen command set.
Phase 31A now provides real minimum loops for streaming output, multi-provider
visibility/selection, retryable fallback execution, dashboard, heuristic
evaluation/scoring, long-term memory, explicit text connector import, optional
auth/tenant headers, and query-time GraphRAG-style result graphs. These are
bounded product surfaces, not full DataEyes, enterprise governance/dashboard,
production GraphRAG, arbitrary external connector crawling, enterprise
auth/tenant, streaming platform infrastructure, or release automation. The
bounded service-side RAG chat path is available through `/chat/rag` and
`/chat/rag/stream`; it does not change the default NVIDIA `/chat` lane. The
real vector production path is covered only by the explicit `verify:phase23`
configuration and does not change the default local-keyword mode.
Phase 32A through Phase 47A add a real protected-route governance, security
hardening, managed token lifecycle, audit evidence, and bounded deployment
ops/backup/startup/preflight readiness plus local config-check layer for
enterprise use, plus read-only handoff, acceptance report, acceptance UI, and
release-candidate dry-run/UI and enterprise overview checks. They do not turn
the system into a full enterprise platform or release automation system by
themselves.

Daily use is now in defect-driven standby. Report one concrete issue at a time
with this template:

```text
复现命令：
实际失败：
期望表现：
唯一失败点：
关键输出：
```

Delivery guide:

```powershell
cmd /c pnpm verify:phase24
```

The final delivery guide is `docs/DELIVERY_GUIDE.md`. The Phase 24 validation
loads the local real-usage sample at
`apps/ai-gateway-service/knowledge-samples/real-usage-sample.md` through
`POST /knowledge/load`, retrieves it through `POST /knowledge/retrieve`, and
checks top hit, snippet, highlights, matched terms, score breakdown, and
metadata. If vector mode is explicitly configured, it also runs the bounded
Gemini embedding plus pgvector probe over the same sample documents; otherwise
the vector path remains configured-capable but inactive for that run.

Detailed Chinese operation manual:

```text
docs/OPERATION_MANUAL.md
```

Enterprise deployment runbook and safe environment template:

```text
docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md
docs/ENTERPRISE_HANDOFF_MANIFEST.md
docs/ENTERPRISE_ACCEPTANCE_REPORT.md
.env.enterprise.example
```

Phase 39A adds these delivery artifacts only. It does not add commands,
dependencies, business logic, SSO/IAM, SIEM, infrastructure provisioning, or
release automation.

Minimal Web console:

```powershell
cmd /c pnpm dev:phase7b
# then open http://127.0.0.1:3100/ui
cmd /c pnpm verify:phase25a
cmd /c pnpm verify:phase26a
```

The Web console is now Chat-first. It supports chat through the service-side
`/chat/rag` path, chat-window document drops, service health, knowledge health,
knowledge sources, document file import, keyword retrieve result inspection,
vector readiness, chat-window command cards, and default command hints.
Document import is bounded to `POST /knowledge/load/file` and supports
text-like files, PDF, Word `.docx`, and Excel `.xls` / `.xlsx` up to 100MB per
file; legacy binary `.doc` is not part of this minimal parser. The Web UI now
calls `/chat/rag`; the service performs knowledge retrieve and returns
structured citations with the answer. This does not change the service `/chat`
contract, the NVIDIA single-provider lane, or the default local-keyword
knowledge mode.
Workflow automation is the bounded Phase 30A loop only: it can retrieve local
knowledge, compose a report, and write one managed artifact. It is not an
arbitrary local command runner, file scanner, OS automation layer, or external
connector system.

Default daily knowledge persistence:

```powershell
cmd /c pnpm dev:phase7b
cmd /c pnpm verify:phase27
```

The managed daily startup sets `KNOWLEDGE_STORAGE_MODE=file-sqlite` and uses
`.data/knowledge` as the persistence directory unless those environment
variables are overridden. This gives two local durable stores at once:
`knowledge-documents.json` for simple file backup/inspection and
`knowledge-documents.sqlite` for a steadier long-term local store. The
pgvector/Supabase path is still explicit: set `KNOWLEDGE_INFRA_MODE=vector`
and the Phase 23 vector environment variables, then run `verify:phase23` to
validate the real embedding plus pgvector write/read/retrieve path. Local
keyword retrieval remains available when vector mode is not configured.

Default Phase 23Z knowledge production-readiness gate:

```powershell
cmd /c pnpm verify:phase23
```

`verify:phase23` runs the Phase 22 aggregate knowledge check and then checks
the Phase 23 keyword quality v2 plus real vector production-readiness gate.
With explicit Gemini embedding and pgvector pooler configuration, this gate has
passed a real embedding -> pgvector write -> read -> vector retrieve probe.
Keyword retrieval remains local-keyword by default, with stronger
normalization, stopword filtering, field weighting, exact/phrase/contiguous
boosts, stable top hit ordering, snippets, highlights, matched terms,
`topHit`, `topChunk`, `topDocument`, and score breakdown.

The real vector production gate requires explicit external prerequisites:
`KNOWLEDGE_INFRA_MODE=vector`, `KNOWLEDGE_EMBEDDING_PROVIDER`,
`KNOWLEDGE_EMBEDDING_MODEL`, `KNOWLEDGE_EMBEDDING_API_KEY`,
`KNOWLEDGE_VECTOR_STORE=pgvector`, and `PGVECTOR_CONNECTION_STRING`.
`PGVECTOR_TABLE` and `KNOWLEDGE_VECTOR_NAMESPACE` may scope the target table
and namespace. Without these prerequisites and a real embedding plus pgvector
write/read/retrieve probe, Phase 23Z must be treated as blocked, not as a
production vector delivery. With the prerequisites present and the probe
passing, Phase 23Z is considered production-vector-delivered for this bounded
knowledge path. This does not affect the default local-keyword knowledge mode.

Default Phase 22Z knowledge quality and infra acceptance:

```powershell
cmd /c pnpm verify:phase22
```

`verify:phase22` runs the Phase 21 aggregate knowledge check and the Phase 22
quality/infra check. The default knowledge mode remains `local-keyword` with
`in-memory` storage and `embedding: not-configured`. Keyword retrieval now
returns normalized query data, weighted keyword ranking, stable top hit/rank,
matched terms, snippets, highlights, score breakdown, and document metadata.
The next-gen infrastructure base exposes an off-by-default readiness path for
embedding provider and vector store interfaces, including pgvector config
diagnostics. When not explicitly enabled, it reports disabled/not-configured
state and does not affect local-keyword retrieval. The current config entry
names are `KNOWLEDGE_INFRA_MODE`, `KNOWLEDGE_EMBEDDING_PROVIDER`,
`KNOWLEDGE_EMBEDDING_MODEL`, `KNOWLEDGE_EMBEDDING_API_KEY`,
`KNOWLEDGE_EMBEDDING_BASE_URL`, `KNOWLEDGE_VECTOR_STORE`,
`PGVECTOR_CONNECTION_STRING`, `PGVECTOR_TABLE`, and
`KNOWLEDGE_VECTOR_NAMESPACE`.

Default Phase 21Z knowledge acceptance:

```powershell
cmd /c pnpm verify:phase21
```

`verify:phase21` is the current knowledge aggregate check. It only chains
`verify:phase21a`, `verify:phase21b`, and `verify:phase21c`; it does not add a
new validation system or new business logic. The frozen knowledge capability is:
`GET /knowledge/health`, `GET /knowledge/sources`, `POST /knowledge/load`,
`POST /knowledge/retrieve`, shared SDK `knowledgeLoad` /
`knowledgeRetrieve`, and the `agent-console` verifier that calls knowledge
through the SDK. The boundary remains local-keyword, in-memory, non-vector, and
not mixed into the default NVIDIA `/chat` path.

Default Phase 21C agent-console knowledge chain:

```powershell
cmd /c pnpm verify:phase21c
```

`verify:phase21c` checks that `apps/agent-console` can use the shared SDK to
call `ai-gateway-service` knowledge retrieval over HTTP. It loads a bounded
local source through `POST /knowledge/load`, retrieves it through
`POST /knowledge/retrieve`, and records structured evidence for the returned
knowledge result. This proves the upper entry can use knowledge without mixing
knowledge into the default `/chat` path. It remains local-keyword,
in-memory, non-vector, and does not add embeddings, vector databases,
pgvector, GraphRAG, long-term memory, auth/tenant, external connectors, or a
production RAG pipeline.

Default Phase 21B local knowledge source load:

```powershell
cmd /c pnpm verify:phase21b
```

`verify:phase21b` checks the minimal `POST /knowledge/load` path by loading a
local text document set with `sourceId`, `documentId`, content, and metadata,
then verifying the loaded source through `GET /knowledge/sources` and keyword
retrieval through `POST /knowledge/retrieve`. This remains in-memory,
local-keyword, non-vector document loading. It is not a full ingestion
pipeline, external document connector, embedding path, vector database,
pgvector, GraphRAG, long-term memory, auth/tenant layer, or production
knowledge platform.

Default Phase 21A local knowledge entry:

```powershell
cmd /c pnpm verify:phase21a
```

`verify:phase21a` checks the new local knowledge service entrypoints:
`GET /knowledge/health`, `GET /knowledge/sources`, and
`POST /knowledge/retrieve`. This is a bounded in-memory keyword retrieval
baseline for the PME 移动地球 operating knowledge. It does not use
external embeddings, vector databases, pgvector, GraphRAG, tenant auth,
connectors, governance dashboards, or a provider lane. Chat generation remains
NVIDIA single-provider through `/chat`.

Default Phase 16C managed output/log view:

```powershell
cmd /c pnpm logs:phase16a
```

`logs:phase16a` reads only the `logPath` recorded in the current Phase 9C
managed startup state. It does not scan files, system logs, processes, ports,
or network endpoints, and it does not start, stop, restart, call providers,
refresh evidence, or change managed startup state. If no current managed
state/log path exists, it reports that there is no attributable output.

Default Phase 15A idle check:

```powershell
cmd /c pnpm idle:phase15a
```

`idle:phase15a` composes the existing safe stop and status commands:
`stop:phase9c` followed by `status:phase10a`. It does not introduce a new kill
strategy, does not widen the stop scope, and does not bypass the Phase 9C PID
ownership mechanism. Its expected resting state is `stopped`.

Default Phase 14A command overview:

```powershell
cmd /c pnpm help:phase14a
```

`help:phase14a` prints the current default command set and boundary summary.
It is read-only: it does not start, stop, restart, run health checks, call
providers, refresh evidence, or change managed startup state.

Default Phase 13A doctor check:

```powershell
cmd /c pnpm doctor:phase13a
```

`doctor:phase13a` is a read-only self-check that runs `status:phase10a` and the
workspace check. It does not start, stop, restart, scan ports, scan broad
process lists, call providers, refresh evidence, or change managed startup
state. Use `health:phase12a` separately when you only need to know whether the
local service is ready.

Default Phase 12A health check:

```powershell
cmd /c pnpm health:phase12a
```

`health:phase12a` checks the existing ai-gateway-service health route by
calling `/health/check` on the running local service. It does
not call NVIDIA or any other provider, does not introduce broad network scans,
port scans, or business behavior, and is intended to answer the user-facing
question "is the local service ready?". When real provider smoke evidence is
explicitly needed, use `cmd /c pnpm verify:phase7a-1` or
`cmd /c pnpm verify:phase7a`.

Default Phase 11A managed restart:

```powershell
cmd /c pnpm restart:phase11a
```

`restart:phase11a` only composes the existing safe stop and start commands:
`stop:phase9c` followed by `dev:phase7b`. It does not introduce a new kill
strategy, does not widen the stop scope, and does not bypass the Phase 9C PID
ownership mechanism. Like `dev:phase7b`, it becomes a long-running command
after startup begins.

Default Phase 10A managed status check:

```powershell
cmd /c pnpm status:phase10a
```

`status:phase10a` reads the Phase 9C managed startup state and checks only the
recorded owner PID. It reports `running`, `stopped`, or `stale` without changing
processes or state, and it does not use broad process scans, process-name
matching, or port probing.

Default Phase 9C managed startup:

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
cmd /c pnpm dev:phase7b
```

Default Phase 9C directed stop/cleanup:

```powershell
cmd /c pnpm stop:phase9c
```

`dev:phase7b` wraps the existing `ai-gateway-service` and `agent-console`
workspace `start` scripts with a minimal PID ownership record. It uses the
current NVIDIA single-provider runtime environment, fills the existing default
NVIDIA runtime variables when they are not set, starts the service first, waits
for `/health/check` to report ready, and only then runs the console startup
request. A retryable NVIDIA provider timeout during that console startup
request is logged as a startup warning rather than treated as a failed service
start; real provider response validation remains covered by `verify:phase7a-1`,
`verify:phase7a`, and `verify:phase8a-4`. `stop:phase9c` only stops the
recorded managed startup process tree; it does not use broad process-name
kills or port kills. The stop command is only authoritative for processes
started through this managed `dev:phase7b` entrypoint.

Default Phase 8A readiness/wait validation:

```powershell
$env:NVIDIA_API_KEY='<your-nvidia-key>'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
cmd /c pnpm verify:phase8a-4
```

`verify:phase8a-4` starts `ai-gateway-service`, waits for the service health
check to report ready, runs `agent-console`, then runs `verify:phase7a` and
cleans up the service process. Service readiness remains a hard requirement.
If the console or Phase 7A verification reaches the real NVIDIA request stage
and fails only with retryable `NVIDIA_REQUEST_TIMEOUT`, the command records a
warning instead of treating readiness/wait orchestration as failed. Other
failures remain hard failures. It reuses existing workspace scripts and keeps
the NVIDIA single-provider boundary; it does not enter DataEyes,
multi-provider execution, fallback execution, scoring, governance, dashboard,
knowledge, streaming, or release automation.

Phase 7B startup command retained by the Phase 9C wrapper:

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
cmd /c pnpm dev:phase7b
```

`dev:phase7b` reuses the existing `ai-gateway-service` and `agent-console`
workspace `start` scripts through the managed Phase 9C wrapper, with the
service readiness check gating the console startup request. Default Phase 7A
validation remains:

```powershell
$env:NVIDIA_API_KEY='<your-nvidia-key>'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
cmd /c pnpm verify:phase7a
```

`verify:phase7a` runs `verify:phase7a-1`, `verify:phase7a-2`, and the
workspace check in one command. Minimal acceptance is: service health is ready,
`POST /chat` exists, `agent-console` calls the service through the shared SDK,
selected provider is `nvidia`, execution mode is `real`, execution status is
`success`, and output is present. Evidence is recorded in
`apps/ai-gateway-service/evidence/phase-7a-1-service-entry.*` and
`apps/agent-console/evidence/phase-7a-2-console-service-chain.*`.

Phase 7B boundary: NVIDIA is the only real provider in scope. This solidifies
single-command startup wording only; it does not enter DataEyes, multi-provider
execution, fallback execution, scoring, governance, dashboard, knowledge,
streaming, release automation, or the next phase.

Phase 7E is sealed as the NVIDIA single-provider service runtime baseline:
`apps/agent-console` calls `apps/ai-gateway-service` over HTTP using the shared
SDK, the shared contracts define the minimal chat/health shapes, and the
service routes `POST /chat` to NVIDIA only.

Runtime configuration entry points are listed in `.env.example`. For manual
development, set the NVIDIA/runtime variables in your shell, start the service
first, then run the console against it:

```powershell
$env:NVIDIA_API_KEY='<your-nvidia-key>'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
$env:AI_GATEWAY_PROVIDER_MODE='real'
$env:AI_GATEWAY_REAL_PROVIDER_ENABLED='true'
$env:AI_GATEWAY_ROUTE_MODE='fixed'
$env:AI_GATEWAY_DEFAULT_PROVIDER='nvidia'
$env:AI_GATEWAY_ENABLED_PROVIDERS='nvidia'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
cmd /c pnpm start:ai-gateway-service
```

In a second shell:

```powershell
$env:AI_GATEWAY_SERVICE_URL='http://127.0.0.1:3100'
cmd /c pnpm start:agent-console
```

Default Phase 7E validation:

```powershell
cmd /c pnpm verify:phase7e
cmd /c pnpm -r --if-present check
```

Minimal acceptance for Phase 7E is: service health is ready, `POST /chat`
exists, `agent-console` calls the service through the shared SDK, selected
provider is `nvidia`, execution mode is `real`, execution status is `success`,
output is present, the controlled missing-key error returns a stable
`code/message/provider` summary, and service logs include request/provider
success and failure events. Evidence is recorded in
`apps/ai-gateway-service/evidence/phase-7a-1-service-entry.*`,
`apps/agent-console/evidence/phase-7a-2-console-service-chain.*`, and
`apps/agent-console/evidence/phase-7d-error-logging.*`.

Phase 7E boundary: NVIDIA is the only real provider in scope. This does not
enter DataEyes, multi-provider execution, fallback execution, scoring,
governance, dashboard, knowledge, release automation, or the next phase.

Phase 6N is sealed at the NVIDIA single-provider `real-with-key` closure.
Repository-local evidence is recorded in
`apps/ai-gateway-service/evidence/nvidia-real-route-smoke.*`.

Current formal conclusion: NVIDIA `real-with-key` returned `httpStatus: 200`,
`success: true`, `selectedProvider: nvidia`, and
`externalSuccessEvidence: true`. The AI Gateway service check also passed.

Verification commands:

```powershell
$env:AI_GATEWAY_SMOKE_MODE='real-with-key'
$env:NVIDIA_API_KEY='<your-nvidia-key>'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
node .\apps\ai-gateway-service\src\entrypoints\smokeNvidiaRoute.js
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service check
```

Success acceptance for this phase is a `smoke:nvidia-route` result with
`nvidiaApiKeyPresent: true`, `nvidia-real-with-key-route`, `httpStatus: 200`,
`success: true`, `selectedProvider: nvidia`, and
`externalSuccessEvidence: true` in the evidence file.

Phase 6N boundary: fake remains available, NVIDIA is the only real provider in
scope for that sealed phase, and the system does not enter DataEyes,
multi-provider execution, fallback execution, scoring, governance, dashboard,
knowledge, release automation, or the next phase.
