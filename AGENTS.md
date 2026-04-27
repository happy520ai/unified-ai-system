# Repository Guidance

## Boundaries

- Do not modify or develop directly in `legacy/`.
- Use `legacy/claudcodesrc-ponponon-master` and `legacy/ai-gateway-workspace`
  only as read-only references.
- Put application entrypoints under `apps/`.
- Put reusable contracts, SDK code, config, and utilities under `packages/`.
- Keep changes small, verifiable, and reversible.

## Ownership

- `apps/agent-console` owns upper-level interaction.
- `apps/ai-gateway-service` owns AI Gateway service behavior.
- `packages/shared-contracts` owns public protocol types.
- `packages/shared-sdk` owns shared client and adapter surfaces.
- `packages/shared-config` owns shared configuration contracts/defaults.
- `packages/shared-utils` owns implementation-neutral helpers.

## Migration Rule

Do not bulk-copy old repositories into the new system. Migrate only focused,
high-confidence files after an explicit mapping step.

## Secrets and Evidence

- Do not print or commit provider API keys.
- Provider smoke evidence may record key presence, selected provider, status,
  and success fields, but not secret values.
- Only refresh provider smoke evidence after the matching real smoke succeeds.

## Phase 108A Access Boundary

Phase 108A is verified by:

```powershell
cmd /c pnpm verify:phase108a-access-boundary
```

It only records the current account, permission, and multi-user release
boundary. Do not describe it as account system complete, multi-tenant complete,
enterprise security complete, or global release complete. The current product
is suitable for local/internal testing; public multi-user production deployment
still requires auth, tenant isolation, encrypted secret vault, rate limit,
audit retention, and a dedicated security review.

## Phase 109A Deployment Boundary

Phase 109A is verified by:

```powershell
cmd /c pnpm verify:phase109a-deployment-readiness
```

It only hardens local/intranet deployment instructions and production-run
boundaries. Do not describe Phase 109A as production deployment complete,
Docker complete, cloud deployment complete, CI/CD complete, or global release
complete. If Dockerfile/docker-compose files are absent or unverified, say they
are not sealed. Do not add cloud deployment, heavy CI/CD, or public multi-user
exposure without an explicit new mainline and matching verification.

## Phase 110A Docker Boundary

Phase 110A is verified by:

```powershell
cmd /c pnpm verify:phase110a-docker-readiness
```

It adds the minimal local Docker startup baseline for `ai-gateway-service`.
Docker local startup is not cloud deployment, CI/CD, production deployment,
production secret management, or global release. Do not add database,
pgvector, Redis, cloud platform, or release automation containers under this
phase. Do not put real API keys into Dockerfile, docker-compose, evidence, or
docs.

## Phase 111B CI/CD Gate Design Boundary

Phase 111B is verified by:

```powershell
cmd /c pnpm verify:phase111b-cicd-gate-design
```

It is design and documentation only. Do not describe Phase 111B as CI/CD
complete, release automation complete, Docker runtime passed, cloud deployment
complete, or global release complete. Phase 117A later adds the explicit
minimal `.github/workflows` release gate. Do not add release automation, cloud
deployment, package publishing, container image pushing, or Docker runtime pass
evidence under Phase 111B.

## Phase 112A Non-Docker Release Check Boundary

Phase 112A is verified by:

```powershell
cmd /c pnpm verify:phase112a-non-docker-release-check
```

It records the non-Docker deliverable status only. Do not describe Phase 112A
as global release complete, CI/CD complete, cloud deployment complete, or
release automation complete. Docker runtime was completed later by Phase 115A,
not by Phase 112A. Minimal CI/CD release gate execution was introduced later
by Phase 117A; deployment and release automation remain incomplete until a
later explicit mainline and matching verification.

## Phase 113B Docker Blocker Docs Boundary

Phase 113B is verified by:

```powershell
cmd /c pnpm verify:phase113b-docker-blocker-docs
```

It only documents the original Docker CLI blocker and installation
prerequisites. Phase 115A later records the real local Docker build/run pass.
Do not treat Phase 110A static Docker readiness as Docker runtime passing. Do
not create CI/CD files, cloud deployment, or release automation under this
phase.

## Phase 114A User Manual Release Pack Boundary

Phase 114A is verified by:

```powershell
cmd /c pnpm verify:phase114a-user-manual-release-pack
```

It only closes the non-Docker user manual and local release-pack instructions
in `docs/USER_MANUAL.md`. Do not describe Phase 114A as CI/CD complete. Do
not describe Phase 114A as global release complete. Do not describe Phase 114A
as cloud deployment complete, public multi-user production deployment complete,
or real multi-agent execution complete. Docker runtime was completed later by
Phase 115A, not by Phase 114A. Do not add CI/CD files, cloud deployment, or
release automation under this phase.

## Phase 115A Docker Runtime Recheck Boundary

Phase 115A is verified by:

```powershell
cmd /c pnpm verify:phase115a-docker-runtime-recheck
```

It verifies local Docker runtime only for the root Linux `Dockerfile` and
`ai-gateway-service`: Docker CLI, Compose, daemon, Linux engine, image build,
container run, `/health/check`, `/setup/readiness`, and `/ui`. It does not
create CI/CD, cloud deployment, production deployment, public multi-user
release, release automation, or global release. It does not call real providers
and must not record plaintext API keys.

## Phase 116A Docker Compose Runtime Boundary

Phase 116A is verified by:

```powershell
cmd /c pnpm verify:phase116a-docker-compose-runtime
```

It verifies local Docker Compose runtime only for `docker-compose.yml` and
`ai-gateway-service`: Linux Docker engine, Compose config, Compose build/up,
`/health/check`, `/setup/readiness`, `/ui`, and Compose down cleanup. Because
the Compose file maps `3100:3100`, the local pnpm service may need to be
stopped before the verification and restarted afterward. Phase 116A does not
create CI/CD, cloud deployment, production deployment, public multi-user
release, release automation, or global release. It does not call real providers
and must not record plaintext API keys.

## Phase 117A CI/CD Release Gate Boundary

Phase 117A is verified by:

```powershell
cmd /c pnpm verify:phase117a-cicd-release-gate
```

It adds the minimal GitHub Actions release-readiness gate at
`.github/workflows/release-gate.yml`. The gate may install dependencies and run
workspace check, secret safety, user journey, setup readiness, Docker runtime,
and Docker Compose runtime validations. It does not deploy infrastructure. It
does not publish packages. It does not push container images. It does not
create GitHub releases. It does not provision cloud services, complete release
automation, or complete global release. It must not call real providers and
must not record plaintext API keys. If CI prepares a temporary `.env` for
Docker Compose, it must come from placeholder-only `.env.example` and must not
contain real secrets.

## Phase 118A Remote CI/CD Gate Preflight Boundary

Phase 118A is verified by:

```powershell
cmd /c pnpm verify:phase118a-remote-cicd-gate-preflight
```

It records whether the Phase 117A GitHub Actions gate can be executed remotely
from the current workspace. It may inspect git root, branch, remote
configuration, local project tracking status, and GitHub CLI availability. It
must not push, open a PR, trigger a remote workflow, deploy infrastructure,
publish packages, push container images, create releases, or claim GitHub
Actions passed unless a real remote run is observed and recorded. If remote
execution prerequisites are missing, record the blocker honestly.

## Phase 119A Git Repository Readiness Boundary

Phase 119A is verified by:

```powershell
cmd /c pnpm verify:phase119a-git-repo-readiness
```

It may initialize `unified-ai-system` as a local standalone git repository and
record git readiness. It may update ignore rules for local runtime files and
secret files. It must not stage files, create commits, configure remotes, push,
open PRs, trigger remote workflows, publish releases, or claim remote GitHub
Actions passed. If remote URL, initial commit, or GitHub CLI authentication are
missing, record those blockers honestly.

## Phase 120A Git Initial Commit Preflight Boundary

Phase 120A is verified by:

```powershell
cmd /c pnpm verify:phase120a-git-initial-commit-preflight
```

It records the initial-commit preflight only. It may verify git top-level,
staged-file state, safe env template tracking, prior Git readiness evidence,
remote state, GitHub CLI state, and manual decisions required before the first
commit. It must not stage files, create commits, configure remotes, push, open
PRs, trigger remote workflows, publish releases, deploy infrastructure, or
claim remote GitHub Actions passed. If root artifacts, legacy tracking choice,
remote URL, initial commit, or GitHub CLI authentication are unresolved, record
those blockers honestly.

## Phase 121A Git Initial Commit Execution Boundary

Phase 121A is verified by:

```powershell
cmd /c pnpm verify:phase121a-git-initial-commit-execution
```

It may remove the zero-byte root artifact `{console.error(e.message)`, ignore
`legacy/` as a local read-only reference, stage the intended initial project
files, and create the first local commit. It must not modify files under
`legacy/`, configure remotes, push, open PRs, trigger remote workflows, publish
releases, deploy infrastructure, or claim remote GitHub Actions passed. It must
keep real `.env` files ignored and may track only safe environment templates
such as `.env.example` and `.env.enterprise.example`.

## Phase 122A GitHub Remote Publish Preflight Boundary

Phase 122A is verified by:

```powershell
cmd /c pnpm verify:phase122a-github-remote-publish-preflight
```

It records GitHub remote publish prerequisites only: local commit state, git
remote state, GitHub CLI availability/authentication, and remote Actions
execution blockers. It must not configure remotes, push, open PRs, trigger
remote workflows, publish releases, deploy infrastructure, or claim remote
GitHub Actions passed. If the GitHub repository URL, `gh` installation, or
authentication is missing, record those blockers honestly.

## Phase 123A GitHub CLI Readiness Boundary

Phase 123A is verified by:

```powershell
cmd /c pnpm verify:phase123a-github-cli-readiness
```

It records GitHub CLI readiness and installation blockers only: `gh`
availability, `gh auth status`, `winget` availability, Chocolatey availability,
local commit state, and git remote state. It must not install system packages,
configure remotes, push, open PRs, trigger remote workflows, publish releases,
deploy infrastructure, or claim remote GitHub Actions passed. If `gh` is still
missing, `winget` is unavailable, Chocolatey installation requires an elevated
shell, the GitHub repository URL is missing, or authentication is missing,
record those blockers honestly.

## Phase 124A GitHub CLI Install Boundary

Phase 124A is verified by:

```powershell
cmd /c pnpm verify:phase124a-github-cli-install
```

It records that GitHub CLI has been installed and captures the remaining
remote-publish blockers: current shell PATH refresh status, `gh auth status`,
and git remote state. It may install GitHub CLI through `winget` or Chocolatey
when explicitly continuing the remote-publish setup, but it must not log in to
GitHub, store tokens in evidence, configure remotes, push, open PRs, trigger
remote workflows, publish releases, deploy infrastructure, or claim remote
GitHub Actions passed. If authentication or the GitHub repository URL is
missing, record those blockers honestly.

## Phase 125A GitHub Auth Preflight Boundary

Phase 125A is verified by:

```powershell
cmd /c pnpm verify:phase125a-github-auth-preflight
```

It records GitHub authentication readiness after the CLI installation:
installed CLI state, `gh auth status`, browser-login attempt status, git remote
state, and remaining remote-publish blockers. It must not store GitHub tokens
in evidence, configure remotes, push, open PRs, trigger remote workflows,
publish releases, deploy infrastructure, or claim remote GitHub Actions passed.
If browser login is not completed by the user or the GitHub repository URL is
missing, record those blockers honestly.

## Phase 126A GitHub Auth Ready Boundary

Phase 126A is verified by:

```powershell
cmd /c pnpm verify:phase126a-github-auth-ready
```

It records GitHub authentication readiness after the user completes `gh auth
login`: installed CLI state, authenticated account, sanitized auth status, git
remote state, and remaining remote-publish blockers. It must not store GitHub
tokens in evidence, configure remotes, push, open PRs, trigger remote
workflows, publish releases, deploy infrastructure, or claim remote GitHub
Actions passed. If the GitHub repository URL is missing, record that blocker
honestly.

## Phase 127A GitHub Remote Target Preflight Boundary

Phase 127A is verified by:

```powershell
cmd /c pnpm verify:phase127a-github-remote-target-preflight
```

It records the remote target preflight only: authenticated GitHub account,
inferred repository availability, candidate repository listing, git remote
state, and remaining remote-publish blockers. It must not create a GitHub
repository, configure remotes, push, open PRs, trigger remote workflows,
publish releases, deploy infrastructure, or claim remote GitHub Actions passed.
Do not select PME legacy repositories for the current `unified-ai-system`
mainline unless the user explicitly requests that target.

## Phase 128A GitHub Remote Push Boundary

Phase 128A is verified by:

```powershell
cmd /c pnpm verify:phase128a-github-remote-push
```

It may create the private GitHub repository `happy520ai/unified-ai-system`,
configure `origin`, and push local `master` to `origin/master`. It records the
remote Actions status if a workflow is triggered, but it must not claim remote
Actions passed unless the observed run conclusion is `success`. It must not
open PRs, deploy infrastructure, publish releases, expose secrets, or claim
global release complete.

## Phase 129A Remote Release Status Boundary

Phase 129A is verified by:

```powershell
cmd /c pnpm verify:phase129a-remote-release-status
```

It records remote release-readiness status only: private repository state,
`origin/master` tracking, remote head matching, latest observed GitHub Actions
Release Gate status, the remote status document, and remaining product limits.
It must not create GitHub Releases, publish packages, publish container images,
deploy cloud infrastructure, expose public production access, enable real
multi-agent execution, or claim global release complete.

## Default Command Set Freeze

Phase 19A freezes the current default command set:

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
cmd /c pnpm verify:phase76l
cmd /c pnpm verify:phase76m
cmd /c pnpm verify:phase76n
cmd /c pnpm verify:phase76o
cmd /c pnpm verify:phase76p
cmd /c pnpm verify:phase76q
cmd /c pnpm verify:phase76r
cmd /c pnpm verify:phase76s
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
cmd /c pnpm verify:phase105a-user-journey
cmd /c pnpm verify:phase106a-delivery-readiness
cmd /c pnpm verify:phase107a-secret-safety
cmd /c pnpm verify:phase108a-access-boundary
cmd /c pnpm verify:phase109a-deployment-readiness
cmd /c pnpm verify:phase110a-docker-readiness
cmd /c pnpm verify:phase111b-cicd-gate-design
cmd /c pnpm verify:phase112a-non-docker-release-check
cmd /c pnpm verify:phase113b-docker-blocker-docs
cmd /c pnpm verify:phase8a-model-import
cmd /c pnpm verify:enterprise
cmd /c pnpm verify:phase21a
cmd /c pnpm verify:phase21b
cmd /c pnpm verify:phase21c
```

`start:pme` is the user-facing startup entry; it runs the first-run preflight
and then reuses the managed `dev:phase7b` startup path. Long-running entries are
`dev:phase7b` and `restart:phase11a`. Read-only
entries are `help:phase14a`, `status:phase10a`, `doctor:phase13a`, and
`logs:phase16a`. `health:phase12a` is a local service-readiness check against
`/health/check`; it must not call a provider. One-shot validation or cleanup entries are
`idle:phase15a`, `stop:phase9c`, `verify:phase7a`, `verify:phase8a-4`, and
`verify:phase21` / `verify:phase22` / `verify:phase23` /
`verify:phase24` / `verify:phase25a` / `verify:phase26a` /
`verify:phase27` / `verify:phase28a` / `verify:phase29a` /
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
`verify:phase8a-model-import` /
`verify:enterprise` /
`verify:phase21a` / `verify:phase21b` / `verify:phase21c`. Default `/chat`
generation remains NVIDIA single-provider only. The default knowledge entry remains local keyword
retrieval with source load. Phase 23Z has passed the explicit real Gemini
embedding plus pgvector write/read/retrieve probe behind `verify:phase23`.
Phase 24Z adds `verify:phase24` for delivery guide presence and bounded
real-usage knowledge sample load/retrieve validation.
Phase 25A adds the minimal static Web console at `GET /ui` and `GET /console`,
with validation through `verify:phase25a`. The UI must remain an operation
surface over existing health and knowledge APIs only.
Phase 29A adds bounded service-side RAG chat:

```powershell
cmd /c pnpm verify:phase29a
```

`verify:phase29a` checks `POST /chat/rag` end to end: local knowledge retrieve,
structured citations, gateway provider answer, and Web UI wiring. `/chat/rag`
may retrieve local keyword knowledge and inject bounded citation snippets into
the prompt sent through the gateway provider path. It must not replace or
change the default `/chat` NVIDIA single-provider lane, and it must not expand
into GraphRAG, long-term memory, external connectors, auth/tenant,
governance/dashboard, release automation, or local command execution without an
explicit new mainline.

Phase 26A makes `/ui` Chat-first, with validation through `verify:phase26a`.
Users may drop files directly into the chat surface for bounded
`POST /knowledge/load/file` import. User prompts should call `/chat/rag` so
the service layer performs local keyword retrieval and returns citations. Keep
this bounded: do not change the service `/chat` contract, the NVIDIA
single-provider lane, or the default `local-keyword` knowledge mode as part of
this phase.
Phase 26A business workflow automation was planning preview only and must not
execute local commands, mutate files, or bypass existing safety boundaries.
Phase 30A adds the minimal safe local execution loop:

```powershell
cmd /c pnpm verify:phase30a
```

`verify:phase30a` checks `GET /workflow/health`, `GET /workflow/actions`,
`POST /workflow/plan`, and `POST /workflow/run`. The only executable workflow
sequence is allowlisted as `knowledge.retrieve` -> `report.compose` ->
`artifact.write`. Artifact writes are constrained to the managed workflow
output directory. This must not become arbitrary shell execution, broad file
scanning, OS automation, external connector automation, or a way to bypass the
default NVIDIA chat and local knowledge boundaries.

Phase 31A adds the bounded user-facing experience-capability check:

```powershell
cmd /c pnpm verify:phase31a
```

`verify:phase31a` checks that the Web UI and service expose real minimum loops
for `/chat/rag/stream`, provider visibility/selection, retryable fallback
execution, `/dashboard/status`, heuristic `/evaluation/score`, long-term
memory through the knowledge store, explicit text connector import, optional
auth/tenant headers, query-time graph retrieval, and the safe Phase 30A
workflow run. Keep this bounded: it is not full DataEyes, enterprise
governance/dashboard, arbitrary connector crawling, production GraphRAG, full
IAM/auth tenancy, arbitrary local automation, streaming platform
infrastructure, or release automation. Default `/chat` generation remains
NVIDIA single-provider unless an explicit provider configuration changes the
runtime.

Phase 32A adds the bounded enterprise governance foundation:

```powershell
cmd /c pnpm verify:phase32a
```

`verify:phase32a` checks optional token authentication, tenant identity,
role-based route permissions, protected enterprise session/roles/audit routes,
and JSONL audit recording for authorization decisions. Keep this as a
protected-route governance foundation. Do not represent it as full enterprise
IAM, SSO, SAML/OIDC, user lifecycle management, policy administration,
compliance workflow automation, or a complete governance dashboard without an
explicit new mainline and matching verification.

Phase 33A adds the bounded enterprise admin console check:

```powershell
cmd /c pnpm verify:phase33a
```

`verify:phase33a` checks that `/ui` exposes an enterprise governance panel for
governance health, current session, roles/permissions, and audit log viewing,
and that those buttons map to the protected Phase 32A routes. Keep it as an
operator-facing view over existing enterprise governance routes. Do not turn it
into full user lifecycle management, SSO configuration, broad policy editing,
or compliance workflow automation without an explicit new mainline.

Phase 34A adds the bounded enterprise security hardening check:

```powershell
cmd /c pnpm verify:phase34a
```

`verify:phase34a` checks token expiry rejection, revoked-token rejection,
cross-tenant denial, protected security readiness diagnostics, protected audit
visibility, and the Web console security-readiness control. Keep it as a
minimal security hardening layer over the Phase 32A/33A foundation. Do not
represent it as full enterprise IAM, SSO, SAML/OIDC, user lifecycle
management, policy administration, compliance workflow automation, SIEM, or a
complete security operations console without an explicit new mainline and
matching verification.

Phase 35A adds the bounded enterprise managed user/token lifecycle check:

```powershell
cmd /c pnpm verify:phase35a
```

`verify:phase35a` checks protected managed user listing, admin-only
create/update, hash-only token persistence, managed token authentication,
revocation, persistence across a fresh service application instance, audit
records, and Web console managed user controls. Keep token values out of API
responses and evidence. This remains local JSON lifecycle management, not full
SSO/IAM, SCIM, directory sync, password login, MFA, policy administration, or
compliance workflow automation.

Phase 36A adds the bounded enterprise audit query/export check:

```powershell
cmd /c pnpm verify:phase36a
```

`verify:phase36a` checks filtered audit listing, JSON export, JSONL export,
denied-event evidence, and the Web console audit export control. Keep this as
bounded local audit evidence over the Phase 32A-35A foundation. Do not turn it
into SIEM, retention policy automation, tamper-proof audit storage, compliance
case management, or broad system log scanning without an explicit new mainline
and matching verification.

Phase 37A adds the bounded enterprise deployment/ops readiness and backup check:

```powershell
cmd /c pnpm verify:phase37a
```

`verify:phase37a` checks protected deployment readiness, admin-only backup
creation, hash-only managed user backup content, restore validation dry-run,
restore path containment, and the Web console readiness/backup controls. Backup
creation must not export plaintext tokens. Restore validation must stay a
dry-run unless a later explicit mainline adds and verifies live restore
mutation. Do not turn this into broad filesystem backup, SIEM, release
automation, or infrastructure provisioning without an explicit new mainline and
matching verification.

Phase 38A adds the bounded enterprise production startup readiness check:

```powershell
cmd /c pnpm verify:phase38a
```

`verify:phase38a` checks protected startup readiness for real NVIDIA provider
configuration, enterprise auth/token posture, durable knowledge storage, audit
path, backup path, and redacted secret presence. It must report whether secrets
are present without printing secret values. It must not call providers, mutate
data, start deployment infrastructure, or claim SSO/IAM/provisioning is
complete.

Phase 40A adds the bounded enterprise deployment preflight UI check:

```powershell
cmd /c pnpm verify:phase40a
```

`verify:phase40a` checks that `/ui` exposes a read-only deployment preflight
panel that aggregates existing service health, deployment readiness, startup
readiness, security readiness, and vector readiness responses. It must not add
a new backend business route, mutate enterprise data, create backups, call
providers, leak secrets, or claim infrastructure provisioning is complete.

Phase 41A adds the bounded enterprise config wizard UI check:

```powershell
cmd /c pnpm verify:phase41a
```

`verify:phase41a` checks that `/ui` exposes a browser-local `.env` draft
checker for enterprise startup configuration. It must not upload pasted config,
save config, echo secret values, add a backend business route, mutate
environment variables, or claim secret-manager/IAM provisioning is complete.

Phase 42A adds the bounded enterprise handoff manifest check:

```powershell
cmd /c pnpm verify:phase42a
```

`verify:phase42a` checks the enterprise handoff manifest, deployment runbook,
delivery guide, operation manual, safe environment template, enterprise script
aggregate, and Web console safety markers. It must remain read-only and must
not provision infrastructure, create releases, run release automation, mutate
runtime configuration, or record secret values.

Phase 43A adds the bounded enterprise acceptance report check:

```powershell
cmd /c pnpm verify:phase43a
```

`verify:phase43a` summarizes existing evidence, required docs, command
coverage, and boundary markers into `docs/ENTERPRISE_ACCEPTANCE_REPORT.md`.
It must remain read-only over existing artifacts and must not call providers,
provision infrastructure, create releases, run release automation, mutate
runtime data, or record secret values.

Phase 44A adds the bounded enterprise acceptance report UI check:

```powershell
cmd /c pnpm verify:phase44a
```

`verify:phase44a` checks the protected read-only
`GET /enterprise/acceptance/report` route and the Web console panel that reads
the existing Phase43A report/evidence. It must remain a read-only view over
existing artifacts and must not call providers, provision infrastructure,
create releases, run release automation, mutate runtime data, or record secret
values.

Phase 45A adds the bounded enterprise release-candidate dry-run check:

```powershell
cmd /c pnpm verify:phase45a
```

`verify:phase45a` checks delivery docs, the operation manual, safe environment
template, enterprise scripts, existing evidence, Web console safety markers,
and official boundary wording. It must remain a read-only dry-run over existing
artifacts. It must not create packages, publish releases, call providers,
provision infrastructure, mutate runtime data, run release automation, or
record secret values.

Phase 46A adds the bounded enterprise release-candidate UI check:

```powershell
cmd /c pnpm verify:phase46a
```

`verify:phase46a` checks the protected read-only
`GET /enterprise/release-candidate/dry-run` route and the Web console panel
that reads existing Phase45A dry-run evidence. It must remain a read-only view
over existing artifacts and must not create packages, publish releases, call
providers, provision infrastructure, mutate runtime data, run release
automation, or record secret values.

Phase 47A adds the bounded enterprise overview UI check:

```powershell
cmd /c pnpm verify:phase47a
```

`verify:phase47a` checks the protected read-only `GET /enterprise/overview`
route and the Web console panel that aggregates governance health, deployment
readiness, startup readiness, security readiness, vector readiness, acceptance
report evidence, and release-candidate dry-run evidence. It must remain a
read-only overview over existing routes/artifacts and must not call providers,
mutate runtime data, create packages, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 48A adds the bounded enterprise overview readability check:

```powershell
cmd /c pnpm verify:phase48a
```

`verify:phase48a` checks that `/ui` renders the existing enterprise overview
as a readable one-screen summary while preserving the raw JSON output for
diagnosis. It is UI-only and must not add a new backend business route, call
providers, mutate runtime data, create packages, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 49A adds the bounded Web Chinese readability check:

```powershell
cmd /c pnpm verify:phase49a
```

`verify:phase49a` checks readable Chinese labels in the Chat-first foreground
and hidden capability panel. It is display-only and must not add backend
business routes, call providers, mutate runtime data, create packages, publish
releases, provision infrastructure, run release automation, or record secret
values.

Phase 50A adds the bounded help readability check:

```powershell
cmd /c pnpm verify:phase50a
```

`verify:phase50a` checks that `help:phase14a` uses the UTF-8
`tools/phase14a/help.mjs` script and prints readable Chinese command and
boundary text. It is read-only and must not start services, stop processes,
call providers, mutate runtime data, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 51A adds the bounded Web user readability check:

```powershell
cmd /c pnpm verify:phase51a
```

`verify:phase51a` checks that `/ui` explains the daily command flow on the
first screen, keeps advanced capabilities hidden in the side panel by default,
and does not reintroduce the manual source/document form into the main user
path. It is display-only and must not add backend business routes, call
providers, mutate runtime data, publish releases, provision infrastructure,
run release automation, or record secret values.

Phase 52A adds the bounded Web browser visual check:

```powershell
cmd /c pnpm verify:phase52a
```

`verify:phase52a` starts a temporary service instance, renders `/ui` with a
local headless Chrome/Edge browser, and writes a screenshot evidence PNG. It is
browser-render only and must not add backend business routes, call providers,
mutate runtime data, publish releases, provision infrastructure, run release
automation, or record secret values.

Phase 53A adds the bounded Web chat interaction check:

```powershell
cmd /c pnpm verify:phase53a
```

`verify:phase53a` starts a temporary service instance, renders `/ui` in a
local headless browser, submits a prompt through the real Chat-first form, and
verifies that the page receives a bounded service-side RAG answer through
`/chat/rag/stream`. It must use the local fake provider only and must not
change the default NVIDIA `/chat` lane, add backend business routes, call real
providers, publish releases, provision infrastructure, run release automation,
or record secret values.

Phase 54A adds the bounded Web file upload interaction check:

```powershell
cmd /c pnpm verify:phase54a
```

`verify:phase54a` starts a temporary service instance, renders `/ui` in a local
headless browser, injects a small text file through the real file input,
verifies `/knowledge/load/file`, then asks through Chat-first and verifies
`/chat/rag/stream` can retrieve the uploaded content. It must use the local
fake provider only and must not change the default NVIDIA `/chat` lane, add
backend business routes, call real providers, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 55A adds the bounded Web multi-file upload and oversize skip check:

```powershell
cmd /c pnpm verify:phase55a
```

`verify:phase55a` starts a temporary service instance, renders `/ui` in a local
headless browser, injects multiple files through the real file input, verifies
one small file is loaded through `/knowledge/load/file`, verifies an oversized
file is skipped with the 100MB message, then asks through Chat-first and
verifies `/chat/rag/stream` can retrieve the loaded content. It must use the
local fake provider only and must not change the default NVIDIA `/chat` lane,
add backend business routes, call real providers, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 56A adds the bounded Web chat error readability check:

```powershell
cmd /c pnpm verify:phase56a
```

`verify:phase56a` starts a temporary service instance, renders `/ui` in a local
headless browser, simulates a bounded `/chat/rag/stream` plus fallback
`/chat/rag` failure inside the browser, and verifies the Chat-first surface
shows a readable error state with HTTP status and error code. It must not call
real providers, add backend business routes, change the default NVIDIA `/chat`
lane, publish releases, provision infrastructure, run release automation, or
record secret values.

Phase 57A adds the bounded Web chat no-hit readability check:

```powershell
cmd /c pnpm verify:phase57a
```

`verify:phase57a` starts a temporary service instance, renders `/ui` in a local
headless browser, asks a query that should not match local knowledge, and
verifies `/chat/rag/stream` returns a readable no-hit / insufficient-data
instruction. It must use the local fake provider only and must not call real
providers, add backend business routes, change the default NVIDIA `/chat` lane,
publish releases, provision infrastructure, run release automation, or record
secret values.

Phase 58A adds the bounded Web chat empty-input readability check:

```powershell
cmd /c pnpm verify:phase58a
```

`verify:phase58a` starts a temporary service instance, renders `/ui` in a local
headless browser, submits a whitespace-only chat message, and verifies the
Chat-first surface shows a clear system hint without sending `/chat/rag/stream`,
`/chat/rag`, or `/chat` requests. It must not call providers, add backend
business routes, change the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, run release automation, or record secret values.

Phase 59A adds the bounded Web provider-list failure readability check:

```powershell
cmd /c pnpm verify:phase59a
```

`verify:phase59a` starts a temporary service instance, renders `/ui` in a local
headless browser, simulates a bounded `/providers` failure before the page
loads, and verifies the Chat-first surface explains that the provider list is
temporarily unavailable while the service will continue with the server-side
default route. It must not send chat requests, call providers, add backend
business routes, change the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, run release automation, or record secret values.

Phase 60A adds the bounded Web chat sending-state readability check:

```powershell
cmd /c pnpm verify:phase60a
```

`verify:phase60a` starts a temporary service instance, renders `/ui` in a local
headless browser, simulates a slow streaming chat response, verifies the send
button switches to `生成中`, and verifies a duplicate submit is blocked with a
readable system hint while only one `/chat/rag/stream` request is sent. It must
not call real providers, add backend business routes, change the default NVIDIA
`/chat` lane, publish releases, provision infrastructure, run release
automation, or record secret values.

Phase 61A adds the bounded Web chat complete-readability check:

```powershell
cmd /c pnpm verify:phase61a
```

`verify:phase61a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies the remaining user-visible chat recovery paths:
SSE `error` events are treated as real failures, streaming failure can fall back
to ordinary RAG, fallback failure shows a readable next-step message, empty
streams get a clear no-text message, and the send button always returns to
`发送`. It must not call real providers, add backend business routes, change the
default NVIDIA `/chat` lane, publish releases, provision infrastructure, run
release automation, or record secret values.

Phase 62A adds the bounded Web chat session-persistence check:

```powershell
cmd /c pnpm verify:phase62a
```

`verify:phase62a` starts a temporary service instance, renders `/ui` in a local
headless browser, simulates one chat answer, verifies the current browser saves
the prompt/answer in local storage, verifies the conversation is restored after
reload, and verifies the clear button removes the stored messages. It must not
call real providers, add backend business routes, change the default NVIDIA
`/chat` lane, publish releases, provision infrastructure, run release
automation, or record secret values.

Phase 63A adds the bounded Web chat abort/stop-generation check:

```powershell
cmd /c pnpm verify:phase63a
```

`verify:phase63a` starts a temporary service instance, renders `/ui` in a local
headless browser, simulates a long streaming answer, clicks `停止生成`, verifies
the stream is aborted, verifies no ordinary RAG fallback request is sent after
the user stop, and verifies the UI returns to a send-ready state with a clear
stopped message. It must not call real providers, add backend business routes,
change the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 64A adds the bounded Web chat keyboard interaction check:

```powershell
cmd /c pnpm verify:phase64a
```

`verify:phase64a` starts a temporary service instance, renders `/ui` in a local
headless browser, verifies `Enter` sends the chat, verifies `Shift+Enter`
keeps a newline before sending, and verifies focus returns to the chat input
after the response. It must not call real providers, add backend business
routes, change the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 65A adds the bounded Web chat message actions check:

```powershell
cmd /c pnpm verify:phase65a
```

`verify:phase65a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies assistant message actions for copying the
answer, copying citations, and retrying the previous prompt. It must remain a
UI interaction check over simulated stream output. Do not make it call real
providers, add backend business routes, alter the default NVIDIA `/chat` lane,
publish releases, provision infrastructure, run release automation, or record
secret values.

Phase 66A adds the bounded Web chat citation readability check:

```powershell
cmd /c pnpm verify:phase66a
```

`verify:phase66a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies that assistant message citations render as a
readable expandable list with per-citation copy actions. It must remain a UI
interaction check over simulated stream output. Do not make it call real
providers, add backend business routes, alter the default NVIDIA `/chat` lane,
publish releases, provision infrastructure, run release automation, or record
secret values.

Phase 67A adds the bounded Web chat status feedback check:

```powershell
cmd /c pnpm verify:phase67a
```

`verify:phase67a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies that each assistant answer shows connection,
knowledge retrieval, generation, and completion status separately from the
saved answer text. It must remain a UI interaction check over simulated stream
output. Do not make it call real providers, add backend business routes, alter
the default NVIDIA `/chat` lane, publish releases, provision infrastructure,
run release automation, or record secret values.

Phase 68A adds the bounded Web chat Markdown-lite rendering check:

```powershell
cmd /c pnpm verify:phase68a
```

`verify:phase68a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies that assistant answers safely render paragraphs,
lists, code blocks, and http/https links while unsafe links render as plain
text and raw answer text remains available for copy/history. It must remain a
UI interaction check over simulated stream output. Do not make it call real
providers, add backend business routes, alter the default NVIDIA `/chat` lane,
publish releases, provision infrastructure, run release automation, or record
secret values.

Phase 69A adds the bounded Web chat code-block tools check:

```powershell
cmd /c pnpm verify:phase69a
```

`verify:phase69a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies that assistant answers support inline code,
fenced code blocks with a language toolbar, per-code-block copy, and horizontal
scrolling for long code lines. It must remain a UI interaction check over
simulated stream output. Do not make it call real providers, add backend
business routes, alter the default NVIDIA `/chat` lane, publish releases,
provision infrastructure, run release automation, or record secret values.

Phase 70A adds the bounded Web chat Markdown block readability check:

```powershell
cmd /c pnpm verify:phase70a
```

`verify:phase70a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies that assistant answers support blockquotes,
Markdown tables, and horizontal dividers while preserving raw answer text for
copy/history. It must remain a UI interaction check over simulated stream
output. Do not make it call real providers, add backend business routes, alter
the default NVIDIA `/chat` lane, publish releases, provision infrastructure,
run release automation, or record secret values.

Phase 71A adds the bounded Web chat long-answer viewport check:

```powershell
cmd /c pnpm verify:phase71a
```

`verify:phase71a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies that long streaming answers auto-follow when the
user is at the bottom, preserve manual scroll position when the user reads
earlier content, and keep the final answer visible after completion. It must
remain a UI interaction check over simulated stream output. Do not make it call
real providers, add backend business routes, alter the default NVIDIA `/chat`
lane, publish releases, provision infrastructure, run release automation, or
record secret values.

Phase 72A adds the bounded Web chat composer polish check:

```powershell
cmd /c pnpm verify:phase72a
```

`verify:phase72a` starts a temporary service instance, renders `/ui` in a local
headless browser, and verifies that the Chat input area prevents empty sends,
auto-resizes for multi-line drafts, shows shortcut/count feedback, preserves
Shift+Enter for new lines, supports Ctrl/Cmd+Enter send, and restores focus
after send. It must remain a UI interaction check over simulated stream output.
Do not make it call real providers, add backend business routes, alter the
default NVIDIA `/chat` lane, publish releases, provision infrastructure, run
release automation, or record secret values.

Phase 73A adds the bounded Web chat mobile viewport check:

```powershell
cmd /c pnpm verify:phase73a
```

`verify:phase73a` starts a temporary service instance, renders `/ui` in a
phone-sized headless browser viewport, and verifies that the page avoids
horizontal and whole-document scrolling, keeps the chat shell/history/composer
inside the viewport, compacts mobile quick-start content, and keeps primary
controls visible. It must remain a UI interaction check over simulated provider
configuration only. Do not make it call real providers, add backend business
routes, alter the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 74A adds the bounded Web chat first-screen polish check:

```powershell
cmd /c pnpm verify:phase74a
```

`verify:phase74a` starts a temporary service instance, renders `/ui` in a
desktop headless browser viewport, and verifies that the first screen is a
clean chat entry: the command checklist is collapsed by default, the initial
assistant greeting is short, the side panel is hidden, and the input remains
the primary action. It must remain UI-only over simulated provider
configuration. Do not make it call real providers, add backend business routes,
alter the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 75A adds the bounded Web chat final experience check:

```powershell
cmd /c pnpm verify:phase75a
```

`verify:phase75a` starts a temporary service instance, renders `/ui` in a
desktop headless browser viewport, sends one simulated streaming chat request,
and verifies the final chat surface: structured user/assistant bubbles with
labels and timestamps, readable citations, copy/retry actions, long-answer
overflow handling, and a scroll-to-bottom recovery control. It must remain
UI-only over simulated provider output. Do not make it call real providers, add
backend business routes, alter the default NVIDIA `/chat` lane, publish
releases, provision infrastructure, run release automation, or record secret
values.

Phase 76A adds the bounded Web chat command-center check:

```powershell
cmd /c pnpm verify:phase76a
```

`verify:phase76a` starts a temporary service instance, renders `/ui` in a
desktop headless browser viewport, and verifies that the chat input can open
local command cards for model configuration, service status, health, and
knowledge status. These cards may call existing safe HTTP APIs such as
`/providers`, `/config/runtime`, `/health/check`, `/knowledge/health`, and
`/knowledge/sources`; they must not persist API keys, add backend business
routes, alter the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, run release automation, or record secret values.

Phase 76B adds the bounded Web chat config-persistence check:

```powershell
cmd /c pnpm verify:phase76b
```

`verify:phase76b` verifies that the chat model configuration card can persist a
provider/model preference in current-browser storage and restore it after page
reload. It must persist provider/model choice only. It must not store API key
draft values, send secrets to the service, add backend business routes, alter
the default NVIDIA `/chat` lane, publish releases, provision infrastructure,
run release automation, or record secret values.

Phase 76C adds the bounded Web chat config-wizard polish check:

```powershell
cmd /c pnpm verify:phase76c
```

`verify:phase76c` verifies that the chat model configuration flow is presented
as a user-facing three-step wizard with current status, model choice, safe
secret handling, and a redacted startup configuration template. It remains UI
polish over the existing command card. It must not store API key draft values,
send secrets to the service, add backend business routes, alter the default
NVIDIA `/chat` lane, publish releases, provision infrastructure, run release
automation, or record secret values.

Phase 76D adds the bounded Web chat config effect-status check:

```powershell
cmd /c pnpm verify:phase76d
```

`verify:phase76d` verifies that the chat model configuration card clearly shows
whether the selected model is effective for the current chat, remembered for the
next browser session, or only ready for long-lived service startup after copying
the redacted startup template and restarting the managed service. It remains UI
feedback only. It must not store API key draft values, send secrets to the
service, add backend business routes, alter the default NVIDIA `/chat` lane,
publish releases, provision infrastructure, run release automation, or mutate
service runtime configuration by itself.

Phase 76E adds the bounded Web chat config availability-probe check:

```powershell
cmd /c pnpm verify:phase76e
```

`verify:phase76e` verifies that the chat model configuration card exposes a
user-triggered availability check for the currently selected provider/model. The
check may reuse the existing `/chat` route for a tiny probe and must show a
clear pass/fail status in the card. It must not store API key draft values,
create new backend business routes, mutate service runtime configuration,
alter the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, or run release automation.

Phase 76F adds the bounded Web chat one-click apply/probe check:

```powershell
cmd /c pnpm verify:phase76f
```

`verify:phase76f` verifies that the chat model configuration card exposes a
single primary “一键应用并检测” action. The action may apply the selected
provider/model to the current browser chat and immediately reuse the existing
`/chat` route for a small availability probe. It must not persist API key draft
values, create backend business routes, mutate service runtime configuration,
alter the default NVIDIA `/chat` lane, publish releases, provision
infrastructure, or run release automation.

Phase 76G adds the bounded Web chat config advanced-options collapse check:

```powershell
cmd /c pnpm verify:phase76g
```

`verify:phase76g` verifies that the chat model configuration card keeps the
ordinary path simple by showing the primary apply-and-probe and remember-default
actions first, while less common actions stay collapsed behind the advanced
options areas. It must remain a UI usability layer only: do not store API keys,
do not create backend business routes, do not mutate service runtime
configuration, and do not change the default chat main lane.

Phase 76H adds the bounded Web chat model status-bar check:

```powershell
cmd /c pnpm verify:phase76h
```

`verify:phase76h` verifies that the composer shows the current chat model,
probe status, and remember-default state beside the input area. The composer
configuration button may open the same chat-native model configuration wizard,
and the one-click apply/probe result may sync back into the composer status
bar. It must remain a UI usability layer only: do not store API keys, do not
create backend business routes, do not mutate service runtime configuration,
and do not change the default chat main lane.

Phase 76I adds the bounded Web chat smart composer guidance check:

```powershell
cmd /c pnpm verify:phase76i
```

`verify:phase76i` verifies that the input hint changes with empty input, typed
input, model checking, model probe success/failure, and sending state. It must
remain a UI usability layer only: do not store API keys, do not create backend
business routes, do not mutate service runtime configuration, and do not change
the default chat main lane.

Phase 76J adds the bounded Web chat top-provider minimization check:

```powershell
cmd /c pnpm verify:phase76j
```

`verify:phase76j` verifies that the header provider dropdown is collapsed behind
a lightweight model-settings entry by default, while the same `provider-select`
remains available when expanded. It must remain a UI usability layer only: do
not call providers, do not create backend business routes, do not mutate service
runtime configuration, and do not change the default chat main lane.

Phase 76K adds the bounded Web chat composer actions polish check:

```powershell
cmd /c pnpm verify:phase76k
```

`verify:phase76k` verifies that the main input area keeps daily actions light:
upload remains visible, clear-chat is collapsed behind a more menu, and
stop-generation only appears while an answer is being generated. It must remain
a UI usability layer only: do not call providers, do not create backend business
routes, do not mutate service runtime configuration, and do not change the
default chat main lane.

Phase 76L adds the bounded Web chat knowledge upload receipt check:

```powershell
cmd /c pnpm verify:phase76l
```

`verify:phase76l` verifies that a file upload produces a readable chat receipt,
updates the input placeholder and composer hint to show the document is now in
the knowledge base, and the next chat can retrieve that uploaded content
through the existing RAG stream. It must remain a UI usability layer over the
existing knowledge load and chat routes: do not add backend business routes, do
not call real providers, and do not change the default chat main lane.

Phase 76M adds the bounded Web chat citation insight check:

```powershell
cmd /c pnpm verify:phase76m
```

`verify:phase76m` verifies that Web chat knowledge hits are shown as readable
citation insight cards with source/document metadata, score, matched terms,
score breakdown, and highlighted snippets. It must remain a UI usability layer:
do not change the default NVIDIA `/chat` lane, provider execution, knowledge
retrieval contract, backend routes, release automation, or infrastructure
provisioning.

Phase 76N adds the bounded Web chat runtime API Key add check:

```powershell
cmd /c pnpm verify:phase76n
```

`verify:phase76n` verifies that the chat-native model wizard can accept an API
Key, store it only in the current local service memory, immediately run the
existing `/chat` probe, clear the secret field, and avoid writing the secret to
browser storage, logs, or evidence. This is the only allowed runtime credential
convenience path in this line. It must stay memory-only, must not persist API
keys, must not record secret values in evidence, must not change the default
NVIDIA `/chat` lane, and must not replace the long-lived startup environment
variable path.

Phase 76O adds the bounded Web chat API Key auto-match check:

```powershell
cmd /c pnpm verify:phase76o
```

`verify:phase76o` verifies that the chat-native model wizard can detect a
pasted API Key family before storing it, surface safe provider/model
candidates, let the user manually choose a model, and then use the existing
memory-only runtime credential route plus `/chat` probe. Detection may use a
bounded provider catalog plus live provider `/models` discovery when the key
family is unambiguous. Ambiguous generic keys such as `sk-` must not be sprayed
across providers; the UI should present candidate providers and only probe the
user-selected lane. Detection must not store or log the key value, must not
persist secrets, must not change the default NVIDIA `/chat` lane, and must
refuse to force an unknown or non-chat key family into NVIDIA. A provider
`/models` response is catalog discovery, not proof that the API key can run
chat; the existing `/chat` probe is the real usability check. `Local Fake
Provider` / `Local Fake Model` are test-only entries and must not be presented
as real user-key matches.

Phase 76P adds the bounded Web chat model capability matcher check:

```powershell
cmd /c pnpm verify:phase76p
```

`verify:phase76p` verifies that API Key detection returns structured
provider/model capability profiles across chat, vision, reasoning, coding,
tool-use, structured output, image generation, audio input, speech output,
video generation, embedding, rerank, and moderation where catalog or live
model metadata supports those distinctions. The chat dropdown may only contain
models executable by the current chat lane. Recognized-only capabilities must
be shown as diagnostics rather than fake one-click chat models. Generic `sk-`
keys must stay provider-choice-required and must not be sprayed across vendors.
Unknown key families must not auto-select NVIDIA. `Local Fake Provider` /
`Local Fake Model` remain test-only and must be excluded from real/unknown key
fallback. This check must not add new provider execution paths, image/audio/
video generation executors, persistent secret storage, release automation, or
changes to the default NVIDIA `/chat` lane without an explicit new mainline.

```powershell
cmd /c pnpm verify:phase76q
```

`verify:phase76q` verifies user API workbook provider coverage without
recording secret values. It must keep the detector able to recognize iFlytek
Spark, Baidu Qianfan, Tencent Hunyuan, Zhipu AI, SiliconFlow, DashScope,
ModelScope, Gemini, Cloudflare Workers AI, Groq, Hugging Face, OpenAI, Coze,
and generic OpenAI-compatible relay clues. OpenAI-compatible providers may be
chat candidates only when the runtime has a bounded adapter and endpoint.
Generic `sk-` or relay keys must remain provider-choice-required or require a
base URL; do not spray secrets across vendors, do not default ambiguous `sk-`
keys to OpenAI without proof, do not auto-fallback to NVIDIA, and do not treat
`Local Fake Provider` / `Local Fake Model` as real user-key matches.
DashScope/Bailian-shaped `sk-` keys with a 32-hex body should be treated as
DashScope candidates and verified through the DashScope compatible-mode model
path.

```powershell
cmd /c pnpm verify:phase76r
```

`verify:phase76r` verifies the runtime usability path for generic
OpenAI-compatible relay/custom providers. A pasted credential containing both
an API Key and a base URL may be parsed into a memory-only
`generic-openai-compatible` credential, runtime endpoint, and runtime model,
then probed through the existing `/chat` path. The key must be extracted before
calling the upstream endpoint, the endpoint must come only from the pasted base
URL or explicit request body, and no secret value may be written to evidence.
Generic relay keys without a base URL must remain not actionable; do not guess
relay endpoints, do not send secrets to multiple providers, and do not change
the default NVIDIA `/chat` lane.

Phase 76S adds the bounded Web chat model-list probe check:

```powershell
cmd /c pnpm verify:phase76s
```

`verify:phase76s` verifies the explicit user-triggered model-list probing path.
Safe default paste mode must not spray a generic `sk-` key across vendors and
must not default to OpenAI without proof. When the user explicitly clicks the
auto-detect action, the detector may make bounded `/models` requests only to
catalogued candidate providers, mark rejecting providers as `auth-failed`, and
recommend a provider only when its model-list API authenticates and returns
usable models. The route must not store, log, persist, or write API Key values
to evidence. The existing `/chat` probe remains the real chat-usability check.

The model import line is validated by:

```powershell
cmd /c pnpm verify:phase8a-model-import
```

`verify:phase8a-model-import` checks `POST /models/import/preview` and
`POST /models/import/confirm`. Preview may clean a pasted key and call bounded
provider model-list APIs for NVIDIA, OpenAI/OpenAI-compatible, DashScope, and
Gemini candidates. Models must come from provider model-list responses, not key
text or hard-coded guesses. Multiple authenticated providers must return
`needs_user_selection`; unknown keys must return `needs_provider_selection`;
invalid unique-provider keys must return `invalid_api_key`. Confirm may store a
selected model and memory-only key in the local dev registry/runtime credential
store, but it must not persist secrets, write plaintext keys to evidence, alter
the default NVIDIA `/chat` lane, enable fallback execution, or start
multi-provider routing.

`verify:phase87a` checks the successful model configuration path from the
user's point of view. After provider models discovery, runtime confirm, `/chat`
probe, and remember-default, the Web UI must clearly explain provider
identified, model selected, current-service readiness, `/chat` probe success,
chat-ready state, remember-default state, and API key safety. It must use a
local mock provider only and must not call real providers, persist browser
secrets, alter the default NVIDIA `/chat` lane, enable fallback execution, or
start multi-provider routing.

`verify:phase88a` checks the immediate first-chat experience after a successful
model configuration. The browser must configure a local mock
OpenAI-compatible model, remember it, send a real first prompt through the chat
composer, route that prompt through `/chat/stream` with the configured runtime
provider/model, receive a streamed answer, clear the input, restore focus, and
avoid storing API keys in browser state, chat history, logs, or evidence. It
must not call real providers, alter the default NVIDIA `/chat` lane, enable
fallback execution, start multi-provider routing, or add a new backend route.

`verify:phase89a` checks model configuration persistence across browser reload
and same-port service restart. The browser must configure a local mock
OpenAI-compatible model through the normal UI flow, persist the runtime
credential to a temporary local-file store, reload the page, restart the service
on the same port, restore the remembered provider/model selection, and send chat
through `/chat/stream` without re-entering the API Key. It must delete temporary
credential files after verification, avoid recording secret values in evidence,
not call real providers, not alter the default NVIDIA `/chat` lane, and not add
new backend routes.

`verify:phase90a` checks model configuration restart-status readability after
the Phase89A persistence path. After browser reload and same-port service
restart, the chat composer must visibly explain that the model and API Key were
restored from local user configuration, remain usable after service restart, and
can be used directly without re-entering the key. It must not pretend a fresh
`/chat` probe has already been rerun, call real providers, alter the default
NVIDIA `/chat` lane, enable fallback execution, start multi-provider routing,
or add a new backend route.

`verify:phase91a` checks the recovery path when a locally restored runtime
model later fails during chat. The assistant error and composer status must tell
the user to re-check the restored API Key, provider, base URL, and model; the
composer action must switch to `重新检测模型`; and the page must remain usable.
It must use simulated browser failures only, avoid real provider calls, keep
secrets out of evidence, and must not alter the default NVIDIA `/chat` lane,
enable fallback execution, start multi-provider routing, or add a backend
route.

`verify:phase92a` checks the follow-up repair loop after Phase91A: clicking the
composer recovery action must open the model configuration wizard in repair
mode, carry forward the current provider/model/base URL when available, guide
the user to replace or re-check the API Key, and re-run the existing `/chat`
availability probe. It must use simulated browser failures and repair responses
only, avoid real provider calls, keep secrets out of evidence, and must not
alter the default NVIDIA `/chat` lane, enable fallback execution, start
multi-provider routing, or add a backend route.

`verify:phase93a` checks the final user recovery step after Phase92A: once the
repair probe passes, the model configuration card must offer
`继续刚才的问题` and resend the previously failed prompt without requiring the user
to type it again. It must use simulated browser failures and repair responses
only, avoid real provider calls, keep secrets out of evidence, and must not
alter the default NVIDIA `/chat` lane, enable fallback execution, start
multi-provider routing, or add a backend route.

`verify:phase94a` checks the visual recovery step after Phase93A: once repair
passes, the model configuration card must keep the success text compact, fold
diagnostic details behind `查看检测细节`, and make `继续刚才的问题` the first primary
action whenever a failed prompt can be resumed. It must remain UI-only, use
simulated provider failures and repair responses, avoid real provider calls,
keep secrets out of evidence, and must not alter the default NVIDIA `/chat`
lane, enable fallback execution, start multi-provider routing, or add a
backend route.

`verify:phase95a` checks the natural return-to-chat step after model
configuration succeeds: clicking `继续聊天` must focus the chat input, show a
ready-to-chat placeholder and composer hint, and update the session status so
the user knows they can immediately describe their need. It must remain
UI-only over existing model import and `/chat` paths, avoid real provider
calls, keep secrets out of evidence, and must not alter the default NVIDIA
`/chat` lane, enable fallback execution, start multi-provider routing, or add
a backend route.

`verify:phase96a` checks the first-message experience immediately after model
configuration succeeds: the UI must return focus to the chat input, accept the
first typed message, send it through the selected runtime model, clear the
input after submission, return an assistant answer, and restore focus to the
composer. It aggregates the existing Phase 95A and Phase 88A browser checks,
uses local mock provider responses, avoids real provider calls, keeps secrets
out of evidence, and must not alter the default NVIDIA `/chat` lane, enable
fallback execution, start multi-provider routing, or add a backend route.

`verify:phase97a` aggregates the bounded Web chat model-configuration
regressions into one command: success path, first configured message,
repair-and-continue, repair visual polish, ready-to-chat, and ready-first
message. It must reuse existing browser checks, avoid real provider calls,
keep secrets out of evidence, and must not alter the default NVIDIA `/chat`
lane, enable fallback execution, start multi-provider routing, or add a
backend route.

`verify:phase98a` checks the visible model-configuration user journey: the
composer prompt must guide the user into configuration, the three-step wizard
must explain provider/API key/model selection, one-click add/detect must show a
clear success state, and continue-to-chat must return focus to the composer. It
must use a local mock provider, avoid real provider calls, keep secrets out of
evidence/browser state, and must not alter the default NVIDIA `/chat` lane,
enable fallback execution, start multi-provider routing, or add a backend
route.

`verify:phase99a` performs the bounded final visual check for model
configuration. It delegates the Phase 98A browser journey, validates the
screenshot evidence, and checks that the composer prompt, three-step wizard,
success card, and ready-to-chat guidance remain readable. It must not call real
providers, persist secrets, alter the default NVIDIA `/chat` lane, enable
fallback execution, start multi-provider routing, or add a backend route.

`verify:phase100a` performs the bounded stage-freeze check for the Web chat
model-configuration chain. It aggregates provider model import, explicit
model-list probing, model configuration success/repair regressions, ready-first
message behavior, and the final visual user journey. It must use existing
bounded checks and local mocks, avoid real provider calls, keep secrets out of
evidence, and must not alter the default NVIDIA `/chat` lane, enable fallback
execution, start multi-provider routing, or add a backend route.

`verify:phase101a` freezes the ordinary-user model configuration copy. It checks
that the Web chat setup path is short and user-facing: `配置模型 -> 粘贴 Key ->
识别可用模型 -> 一键检测并保存 -> 继续聊天`. Advanced settings and startup
command templates must stay available but collapsed. The check delegates the
existing visual path, uses local mocks only, avoids real provider calls, keeps
secrets out of evidence, and must not alter the default NVIDIA `/chat` lane,
enable fallback execution, start multi-provider routing, or add a backend
business route.

`verify:phase102a-workforce` checks the minimal Agent Workforce product
skeleton. The service exposes `GET /workforce/health`,
`GET /workforce/agents`, and `POST /workforce/plan`; the SDK exposes
`workforceHealth`, `workforceAgents`, and `workforcePlan`; and `/ui` exposes a
small plan preview panel. This is deterministic/rule-based only. It must not
call real LLMs, run concurrent agents, execute code, write project files, attach
to provider registry, alter the default NVIDIA `/chat` lane, alter knowledge or
vector semantics, or connect to workflow execution.

`verify:phase102b-workforce-ux` checks the hardened Agent Workforce preview
experience: empty-goal feedback, example goals, loading/success/error state,
role cards, task/deliverable/acceptance/risk/next-action rendering, and
Markdown copy support. `/workforce/plan` may add product-facing metadata such
as `planVersion`, `createdAt`, `summary`, and `userFriendlyStatus`, but it must
remain deterministic preview-only. Do not use this phase to execute agents,
run code, write project files, attach workflow execution, call providers, alter
provider registry, or change the default NVIDIA `/chat` lane.

`verify:phase102c-workforce-product-closure` checks the Agent Workforce preview
product closure: empty, non-string, and too-long goal errors; complete normal
plan fields; Markdown copy data; JSON export data; clear/restart UI markers;
and the preview-only boundary text. `/workforce/plan` may return `limitations`,
`markdown`, `exportableJson`, and `recommendedNextStep`. It must remain
deterministic and preview-only, with no real LLM calls, concurrent agents, code
execution, user project file writes, workflow execution, provider registry
changes, or default NVIDIA `/chat` changes.

`verify:phase102d-workforce-plan-store` checks the dev-only Agent Workforce
plan store: save, list, read, delete, and task-package export over the
generated plan preview. The store must remain local development history only;
it may write its JSON store to a controlled dev path or system temp path, but
must not save API keys, write user project files, execute agents, call real
LLMs, connect to workflow execution, alter provider registry behavior, or
change the default NVIDIA `/chat` lane.

`verify:phase102e-workforce-user-guide` checks the final ordinary-user wording
for Agent Workforce preview mode. After 102E, do not describe Agent Workforce
as completed real multi-agent execution. It remains a deterministic planning
preview for requirement decomposition, role assignment, task planning,
handoff-package export, and user explanation. Do not expand it into 144 staff,
real LLM workers, workflow runs, code execution, user project file mutation,
provider-registry changes, or default NVIDIA `/chat` changes without an
explicit new mainline and matching verification.

`verify:phase103a-product-readiness` checks the global product-readiness
hardening layer. `/ui` may add clearer user-facing explanations for Chat, model
import, Knowledge/RAG, Workflow, Agent Workforce, and Enterprise/readiness.
Model import must not guess models from API key text: keys may only identify
provider candidates, and real model choices must come from provider
`models/list` responses or explicit user input. Unknown or masked keys must
return clear provider/Base URL guidance, not `unsupported_key_type` or empty
“model 0” explanations. Keep secrets out of logs/evidence, keep Agent Workforce
preview-only, do not claim global release completion, do not start real
multi-provider routing or fallback execution, and do not change the default
NVIDIA `/chat` lane.

`verify:phase104a-first-run-setup` checks the first-run setup wizard and the
read-only `GET /setup/readiness` route. The route may aggregate existing health,
model import, chat, knowledge, and workforce readiness for ordinary-user
guidance. It must not call real providers, expose API keys, mutate runtime
configuration, change the default NVIDIA `/chat` lane, enable real
multi-provider routing/fallback, or represent Agent Workforce as real execution.
The `/ui` setup wizard should tell users what to do next when model detection
or readiness is incomplete.

`verify:phase105a-user-journey` checks the ordinary-user end-to-end product
journey from `/ui` through setup readiness, Chat readiness, model-import
guidance, Knowledge/RAG guidance, Agent Workforce plan generation, save,
history, export, and deletion of the temporary saved plan. Phase 105A must not
be described as global release completion, must not bypass API Key redaction,
must not change the default NVIDIA `/chat` lane, must not enable real fallback
execution, and must not turn Agent Workforce into real code execution or
project file mutation.

`verify:phase106a-delivery-readiness` checks the local install/start/delivery
handoff path: README zero-start guidance, `.env.example` placeholders,
ordinary-user `/ui` path markers, setup readiness, model-import failure
guidance, and delivery boundary wording. Phase 106A must not commit real API
keys, must not treat `.env.example` as a production secret-management solution,
must not describe preview/dev-only surfaces as production completion, must not
bypass API Key redaction, must not alter the default NVIDIA `/chat` lane, and
must not enable real fallback execution or real Agent Workforce execution.

`verify:phase107a-secret-safety` checks release-before-secret safety: README,
AGENTS, `.env.example`, package metadata, `apps/`, `packages/`, `docs`, and
evidence text files must not contain real-looking provider keys, bearer tokens,
or credential URLs. Model import and setup readiness must only expose masked
keys or boolean key presence. Keep real API keys out of logs, UI, docs, and
evidence. Do not describe the local runtime credential file as a production
secret vault, and do not bypass masking to debug provider or model import
issues.

Enterprise aggregate validation is available as:

```powershell
cmd /c pnpm verify:enterprise
```

`verify:enterprise` must remain a pure aggregate of `verify:phase32a`,
`verify:phase33a`, `verify:phase34a`, `verify:phase35a`, and
`verify:phase36a`, `verify:phase37a`, `verify:phase38a`, and
`verify:phase40a`, `verify:phase41a`, `verify:phase42a`, and
`verify:phase43a`, `verify:phase44a`, `verify:phase45a`, and
`verify:phase46a`, `verify:phase47a`, and `verify:phase48a`. It must not
introduce another business implementation path.

The detailed Chinese operation manual is `docs/OPERATION_MANUAL.md`. Keep it
documentation-only unless an explicit new mainline asks for command or runtime
changes.

Phase 39A adds the enterprise deployment handoff documents:

```text
docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md
docs/ENTERPRISE_HANDOFF_MANIFEST.md
docs/ENTERPRISE_ACCEPTANCE_REPORT.md
.env.enterprise.example
```

These files are deployment guidance and safe placeholder configuration only.
They must not contain real secrets, must not introduce new runtime behavior,
and must not be treated as SSO/IAM, SIEM, infrastructure provisioning, or
release automation completion.

Phase 28A is the bounded documented-feature closure check:

```powershell
cmd /c pnpm verify:phase28a
```

It verifies only current documented capabilities: docs markers, `/ui`, service
health, knowledge health, `GET /knowledge/file-types`, bounded
`POST /knowledge/load/file`, local keyword retrieval, file-sqlite persistence
wording, and infra readiness. It must not be used to smuggle in DataEyes,
multi-provider, fallback, governance, GraphRAG, long-term memory, external
connectors, streaming, or release automation.

Daily use is now in defect-driven standby. Handle one concrete issue at a time
with this report template:

```text
复现命令：
实际失败：
期望表现：
唯一失败点：
关键输出：
```

## Default Knowledge Entry

Phase 27 adds local durable persistence for daily knowledge imports:

```powershell
cmd /c pnpm verify:phase27
```

`verify:phase27` checks that `file-sqlite` knowledge storage writes an imported
document to both local JSON and SQLite, then restores and retrieves it after a
fresh service application is created with the same persistence directory. The
managed `dev:phase7b` entry sets `KNOWLEDGE_STORAGE_MODE=file-sqlite` and
`KNOWLEDGE_PERSISTENCE_DIR=.data/knowledge` by default. This is still local
keyword retrieval; it does not move the default mode to vector retrieval or
RAG. The pgvector/Supabase path remains explicit through `KNOWLEDGE_INFRA_MODE=vector`
and the Phase 23 production-readiness gate.

Phase 25A adds the minimal Web visual operation console:

```powershell
cmd /c pnpm verify:phase25a
```

When `ai-gateway-service` is running on the default endpoint, the UI is
available at `http://127.0.0.1:3100/ui`. It may call existing health,
knowledge health, knowledge sources, manual knowledge load, bounded document
file import through `POST /knowledge/load/file`, knowledge retrieve, and
knowledge infra readiness routes. The file parser may support text-like files,
PDF, Word `.docx`, and Excel `.xls` / `.xlsx`, with a 100MB per-file limit; it
must not claim legacy binary `.doc` support unless a future explicit mainline adds a safe parser. It must
not add unrelated business logic, change `/chat`, mix knowledge into the
NVIDIA chat path, scan ports, scan arbitrary files, call providers directly, or
change the default `local-keyword` knowledge mode.

Phase 26A adds the minimal Chat-first Web foreground:

```powershell
cmd /c pnpm verify:phase26a
```

`verify:phase26a` checks that `/ui` exposes the chat-first surface, keeps
chat-window file import available, automatically retrieves local knowledge for
chat prompts, and passes only bounded matched snippets into the prompt sent to
the existing NVIDIA `/chat` path. Workflow automation remains a planning
preview only for Phase 26A, and real workflow execution is only allowed through
the later Phase 30A bounded allowlist.

Phase 24Z seals the final delivery guide and real-usage knowledge sample
validation:

```powershell
cmd /c pnpm verify:phase24
```

`verify:phase24` checks `docs/DELIVERY_GUIDE.md`, loads the bounded local
sample at `apps/ai-gateway-service/knowledge-samples/real-usage-sample.md`,
retrieves it through local keyword knowledge, and verifies top hit, snippet,
highlights, matched terms, score breakdown, and metadata. If vector mode is
explicitly configured, it also checks the bounded Gemini embedding plus
pgvector probe over the same sample documents. Keep this as delivery/sample
validation only; do not turn it into ingestion, connectors, RAG, GraphRAG,
long-term memory, auth/tenant, governance, or release automation.

Phase 23Z adds a blocking knowledge production-readiness gate:

```powershell
cmd /c pnpm verify:phase23
```

`verify:phase23` must remain a bounded aggregate of `verify:phase22` plus the
Phase 23 keyword quality v2 and real vector production-readiness check.
Default knowledge remains local-keyword and in-memory. The Phase 23 keyword
line may add normalization, stopword filtering, field weighting,
exact/phrase/contiguous boosts, stable top hit ordering, snippets, highlights,
matched terms, `topHit`, `topChunk`, `topDocument`, and score breakdown.

Real vector production delivery must not be claimed unless explicit external
prerequisites and a real embedding plus pgvector write/read/retrieve probe are
all satisfied. The required config includes `KNOWLEDGE_INFRA_MODE=vector`,
`KNOWLEDGE_EMBEDDING_PROVIDER`, `KNOWLEDGE_EMBEDDING_MODEL`,
`KNOWLEDGE_EMBEDDING_API_KEY`, `KNOWLEDGE_VECTOR_STORE=pgvector`, and
`PGVECTOR_CONNECTION_STRING`. `PGVECTOR_TABLE` and
`KNOWLEDGE_VECTOR_NAMESPACE` may scope the target table and namespace. If these
are missing, Phase 23Z is blocked rather than production-delivered, and the
default local-keyword mode must stay unaffected. With those prerequisites
present, Phase 23Z has passed the real Gemini embedding plus pgvector
write/read/retrieve probe and may be treated as production-vector-delivered for
this bounded knowledge path.

Phase 22Z freezes the current-boundary knowledge quality and next-gen
infrastructure base:

```powershell
cmd /c pnpm verify:phase22
```

`verify:phase22` must remain a bounded aggregate of the Phase 21 knowledge
checks plus the Phase 22 quality/infra check. Default knowledge remains
`local-keyword`, `in-memory`, and `embedding: not-configured`. Keyword
retrieval may expose normalized query data, weighted ranking, top hit/rank,
matched terms, snippets, highlights, score breakdown, and stable document
metadata. The next-gen infra line is off by default and may only expose
diagnostic readiness for embedding provider and vector store interfaces,
including pgvector config readiness. Do not enable external embeddings, vector
queries, GraphRAG, long-term memory, auth/tenant, external connectors,
governance, or release automation without an explicit new mainline.
The current config entry names are `KNOWLEDGE_INFRA_MODE`,
`KNOWLEDGE_EMBEDDING_PROVIDER`, `KNOWLEDGE_EMBEDDING_MODEL`,
`KNOWLEDGE_EMBEDDING_API_KEY`, `KNOWLEDGE_EMBEDDING_BASE_URL`,
`KNOWLEDGE_VECTOR_STORE`, `PGVECTOR_CONNECTION_STRING`, `PGVECTOR_TABLE`, and
`KNOWLEDGE_VECTOR_NAMESPACE`.

Phase 21Z freezes the current-boundary knowledge usable state:

```powershell
cmd /c pnpm verify:phase21
```

`verify:phase21` must remain a pure aggregate of `verify:phase21a`,
`verify:phase21b`, and `verify:phase21c`. It must not add a second validation
system or new business logic. The frozen knowledge capability is
`GET /knowledge/health`, `GET /knowledge/sources`, `POST /knowledge/load`,
`POST /knowledge/retrieve`, shared SDK `knowledgeLoad` / `knowledgeRetrieve`,
and the `agent-console` verifier that calls knowledge through the SDK. Keep the
boundary local-keyword, in-memory, non-vector, and separate from the default
NVIDIA `/chat` path.

Phase 21C adds the minimal agent-console knowledge retrieval chain:

```powershell
cmd /c pnpm verify:phase21c
```

`verify:phase21c` checks that `apps/agent-console` can use the shared SDK to
call `ai-gateway-service` knowledge retrieval over HTTP. It may load a bounded
local source through `POST /knowledge/load`, retrieve through
`POST /knowledge/retrieve`, and record structured evidence for the result. Keep
this as an upper-entry knowledge check only. Do not mix it into the default
`/chat` path, and do not turn it into full RAG, external connectors, embeddings,
vector databases, pgvector, GraphRAG, long-term memory, auth/tenant, governance,
or release automation without an explicit new mainline.

Phase 21B adds the minimal local knowledge source load:

```powershell
cmd /c pnpm verify:phase21b
```

`verify:phase21b` checks `POST /knowledge/load` by loading a bounded local text
document set and then verifying it through `GET /knowledge/sources` and
`POST /knowledge/retrieve`. Keep this as a minimal in-memory keyword document
load path. Do not turn it into a full ingestion pipeline, external connector,
embedding path, vector database, pgvector, GraphRAG, long-term memory,
auth/tenant layer, governance dashboard, or release automation without an
explicit new mainline.

Phase 21A adds the minimal local knowledge entry:

```powershell
cmd /c pnpm verify:phase21a
```

`verify:phase21a` checks `GET /knowledge/health`, `GET /knowledge/sources`,
and `POST /knowledge/retrieve`. Keep this bounded to in-memory keyword
retrieval over PME 移动地球 operating knowledge unless an explicit new
mainline is assigned. Do not turn knowledge into a provider lane, do not add
external embeddings, vector databases, pgvector, GraphRAG, tenant auth,
connectors, governance dashboards, or release automation as part of this entry.

## Default Startup

Phase 9C default startup is the managed single-command agent-console to
ai-gateway-service NVIDIA single-provider startup check:

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

`dev:phase7b` reuses the existing workspace `start` scripts for
`ai-gateway-service` and `agent-console` through a minimal Phase 9C PID
ownership wrapper. The wrapper uses the current NVIDIA single-provider runtime
environment, fills the existing default NVIDIA runtime variables when they are
not set, enables local `file-sqlite` knowledge persistence under
`.data/knowledge` unless overridden, starts the service first, waits for `/health/check` to report ready,
and only then runs the console startup request. A retryable NVIDIA provider
timeout during that console startup request may be recorded as a startup
warning; real provider response validation stays in `verify:phase7a-1`,
`verify:phase7a`, and `verify:phase8a-4`. Keep this line script-only; do not
expand it into DataEyes, multi-provider execution, fallback execution, scoring,
governance, dashboard, knowledge, streaming, or release automation.

## Default Stop/Cleanup

Phase 9C default stop/cleanup is the directed cleanup command for the managed
startup chain:

```powershell
cmd /c pnpm stop:phase9c
```

`stop:phase9c` only stops the recorded managed startup process tree created by
`dev:phase7b`. It must not be replaced with broad process-name kills, broad
port kills, or any kill/terminate path that cannot confirm process ownership.

## Default Status

Phase 10A default status is the read-only managed startup status command:

```powershell
cmd /c pnpm status:phase10a
```

`status:phase10a` reads the Phase 9C managed startup state and checks only the
recorded owner PID. It must stay read-only and must not expand into broad
process scans, process-name matching, port probing, or business health logic.

## Default Logs

Phase 16C default logs is the read-only managed output view for the current
managed startup chain:

```powershell
cmd /c pnpm logs:phase16a
```

`logs:phase16a` must only read the `logPath` recorded in the Phase 9C managed
startup state. If no current managed state/log path exists, it should report no
attributable output. Do not replace it with broad file scans, system log scans,
process-name matching, port probing, provider calls, or any command that
changes managed startup state.

## Default Idle

Phase 15A default idle composes the existing managed stop and managed status
commands:

```powershell
cmd /c pnpm idle:phase15a
```

`idle:phase15a` must remain equivalent to `stop:phase9c` followed by
`status:phase10a`. Do not replace it with broad process-name kills, broad port
kills, restart, health checks, doctor checks, or any path that bypasses the
Phase 9C PID ownership mechanism.

## Default Restart

Phase 11A default restart composes the existing managed stop and managed start
commands:

```powershell
cmd /c pnpm restart:phase11a
```

`restart:phase11a` must remain equivalent to `stop:phase9c` followed by
`dev:phase7b`. Do not replace it with broad process-name kills, broad port
kills, direct provider logic, or any path that bypasses the Phase 9C PID
ownership mechanism.

## Default Health

Phase 12A default health check is the local service-readiness check:

```powershell
cmd /c pnpm health:phase12a
```

`health:phase12a` must call the running service `/health/check` route and must
not call a provider. Real provider smoke remains under `verify:phase7a-1` /
`verify:phase7a`. Do not replace health with broad network scans, port scans,
direct provider rewrites, or new business health logic.

## Default Doctor

Phase 13A default doctor is the read-only managed status plus workspace check:

```powershell
cmd /c pnpm doctor:phase13a
```

`doctor:phase13a` must remain equivalent to `status:phase10a` followed by the
workspace check. Keep it read-only: do not start, stop, restart, scan ports,
scan broad process lists, call providers, refresh evidence, or change managed
startup state.

## Default Help

Phase 14A default help prints the current default command set and boundary
summary:

```powershell
cmd /c pnpm help:phase14a
```

`help:phase14a` must stay read-only. It must not start, stop, restart, run
health checks, call providers, refresh evidence, scan processes, scan ports, or
change managed startup state.

## Default Orchestrated Acceptance

Phase 8A default readiness/wait validation is the single-command
agent-console to ai-gateway-service NVIDIA single-provider acceptance check:

```powershell
$env:NVIDIA_API_KEY='<your-nvidia-key>'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
cmd /c pnpm verify:phase8a-4
```

`verify:phase8a-4` starts `ai-gateway-service`, waits for the service health
check to report ready, runs `agent-console`, then runs `verify:phase7a` and
cleans up the service process. Service readiness must stay a hard requirement.
If the console or Phase 7A verification reaches the real NVIDIA request stage
and fails only with retryable `NVIDIA_REQUEST_TIMEOUT`, this command may record
a warning instead of failing readiness/wait orchestration. Other failures must
remain hard failures. Keep this line script-only and NVIDIA single-provider
only; do not expand it into DataEyes, multi-provider execution, fallback
execution, scoring, governance, dashboard, knowledge, streaming, or release
automation without an explicit new mainline.

## Default Validation

Phase 7A-4 default validation is the single-command agent-console to
ai-gateway-service NVIDIA single-provider integration check:

```powershell
$env:NVIDIA_API_KEY='<your-nvidia-key>'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
cmd /c pnpm verify:phase7a
```

`verify:phase7a` runs `verify:phase7a-1`, `verify:phase7a-2`, and the
workspace check. Keep the Phase 7A-4 boundary narrow: `agent-console` calls
`ai-gateway-service` through the shared SDK over HTTP, `/chat` is backed by
NVIDIA single-provider execution inside the service, and no local direct
provider path remains in the console entrypoint. This line is script and
default-validation wording only; do not expand into DataEyes, multi-provider
execution, fallback execution, scoring, governance, dashboard, knowledge,
streaming, or release automation without an explicit new mainline.

Phase 6N NVIDIA `real-with-key` smoke evidence is sealed. Do not refresh it
unless the user explicitly reopens that line.
