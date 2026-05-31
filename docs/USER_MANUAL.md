# Unified AI System User Manual

Phase 114A is the non-Docker release pack for local and internal users. It
collects the current usable pnpm path, Web UI path, setup flow, model setup,
Knowledge/RAG flow, Agent Workforce preview, safety rules, and known release
limits in one ordinary-user manual.

## Agent Workforce Real UI Trial And Codex Manual Handoff

Phase 200A seals the real browser UI trial as `passed-browser-ui-trial`.
The verified UI path is: open `/ui`, select template, input goal, Generate
Plan, Save Plan, Refresh History, Export JSON, and Export Markdown. JSON export
uses `/workforce/plans/{id}/export?format=json`.

Phase 201A-204A add a Codex Desktop Handoff Pack, a Manual Codex Execution
Loop, Codex Result Review preview, and Safe Desktop Runner Design. These are
manual handoff / preview / design-only surfaces. The web service does not call
Codex CLI, does not call oh-my-codex / OMX, does not create worktrees, does
not connect workflow run, does not dispatch a real external runner, does not
apply or commit Codex results, and does not change the default NVIDIA `/chat`
lane.

### Clipboard Handoff Shortcut

After generating and saving an Agent Workforce Plan in `/ui`, run:

```powershell
cmd /c pnpm run handoff:codex
```

The script pulls the latest saved Plan from `http://127.0.0.1:3100`, extracts
the Codex Desktop Handoff Pack, writes
`.codex-handoff/latest-codex-handoff.md`,
`.codex-handoff/latest-codex-handoff.json`, and
`.codex-handoff/latest-metadata.json`, then copies the Markdown handoff to the
Windows clipboard. Open Codex Desktop or Codex CLI manually and paste it.

```powershell
cmd /c pnpm run handoff:codex:open
cmd /c pnpm run handoff:codex:app
```

`handoff:codex:open` only opens the generated Markdown file.
`handoff:codex:app` only tries to open Codex and does not send the prompt,
run `codex exec`, apply patches, commit, push, create worktrees, or connect
workflow run.

### Codex Result Bridge And Dry-run Loop

If Codex returns a result manually, place it at:

```text
.codex-handoff/inbox/latest-codex-result.md
```

The file must start with `# Codex Result` and include Summary, Changed Files,
Commands Run, Tests Passed, Evidence Paths, Known Issues, Boundary Check, and
Next Steps. Then run:

```powershell
cmd /c pnpm run codex:result:import
```

The import writes `.codex-handoff/review/latest-system-review.md`,
`.codex-handoff/review/latest-feedback-to-codex.md`, and
`.codex-handoff/review/latest-review-summary.json`, and copies feedback to the
Windows clipboard. It does not call Codex CLI and does not apply code.

To preview a controlled loop without invoking Codex:

```powershell
cmd /c pnpm run codex:loop:dry-run
```

The dry-run writes `.codex-handoff/runs/latest-run-summary.json` and
`.codex-handoff/runs/safety-gate-summary.json`. A real one-shot `codex exec`
trial is only for explicit user approval and remains blocked by clean-git,
secret-safety, no-commit, no-push, no-worktree, no-workflow, and default
NVIDIA `/chat` lane safety gates.

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

The final release creation confirmation command is:

```powershell
cmd /c pnpm verify:phase133a-release-creation-confirmation
```

It records the required confirmation phrase
`创建 GitHub Release v0.1.0-rc.1` in
`docs/RELEASE_CREATION_CONFIRMATION.md`. It is read-only and does not create a
tag, create a GitHub Release, upload artifacts, publish packages or images,
deploy, or complete global release.

The real draft prerelease creation verification command is:

```powershell
cmd /c pnpm verify:phase134a-release-creation-execution
```

It verifies that tag `v0.1.0-rc.1` exists locally and remotely, and that the
GitHub Release for that tag exists as draft + prerelease. It does not publish
the draft release, upload artifacts, publish packages or images, deploy, or
complete global release.

The release publish and asset-upload preflight command is:

```powershell
cmd /c pnpm verify:phase135a-release-publish-preflight
```

It verifies that the existing `v0.1.0-rc.1` GitHub Release is still a draft
prerelease, is not published, has no uploaded assets, and requires explicit
later confirmation before publishing or asset upload. It does not publish the
draft release, upload assets, publish packages or images, deploy, or complete
global release.

The release publish execution verification command is:

```powershell
cmd /c pnpm verify:phase136a-release-publish-execution
```

It verifies that the existing `v0.1.0-rc.1` GitHub Release is published,
remains a prerelease, has no uploaded assets, and still does not publish
packages or images, deploy, or complete global release.

The release draft rollback verification command is:

```powershell
cmd /c pnpm verify:phase137a-release-draft-rollback
```

It verifies that the existing `v0.1.0-rc.1` GitHub Release is back in draft
state, still exists, keeps the git tag, remains a prerelease, has no uploaded
assets, and still does not publish packages or images, deploy, or complete
global release.

The Agent Workforce OMX benchmark verification command is:

```powershell
cmd /c pnpm verify:phase138a-agent-workforce-omx-benchmark
```

It verifies the read-only Agent Workforce OMX benchmark and next-stage design
reference. It does not install or run `oh-my-codex`, start real workers, create
worktrees, run commands, mutate user project files, enable 144 workers, or
change the default NVIDIA `/chat` lane.

The Agent Workforce clarify and consensus preview command is:

```powershell
cmd /c pnpm verify:phase139a-agent-workforce-clarify-consensus
```

It verifies that Agent Workforce plans include clarification questions,
Planner / Architect / Critic consensus, disabled hook event previews, Plan
state / HUD, and a disabled workflow-run handoff. It does not install or run
`oh-my-codex`, does not execute code, does not create worktrees, does not write
user project files, does not call workflow run, and does not enable 144 real
workers.

The Agent Workforce review package and human approval gate preview command is:

```powershell
cmd /c pnpm verify:phase141a-workforce-review-approval-gate
```

After saving an Agent Workforce plan, use the review package control in
`/ui` to summarize the goal, clarification coverage, Planner / Architect /
Critic consensus, acceptance criteria, risks, lifecycle state, and disabled
workflow-run handoff. Then choose one preview decision:
`approved-preview`, `changes-requested`, or `rejected-preview`, add a short
reviewer/note, and save the approval gate preview. This decision is stored as
metadata in the dev-only local plan package; it does not execute agents, does
not create worktrees, does not write user project files, and does not call
workflow run.

The Agent Workforce oh-my-codex handoff preview command is:

```powershell
cmd /c pnpm verify:phase142a-workforce-omx-handoff-preview
```

It verifies that Agent Workforce plans and saved/exported task packages can
include `omxHandoffPreview`: role mapping, suggested future `$deep-interview`,
`$ralplan`, and `$team` commands, preflight requirements, blockers, and an
external-runner boundary. This is metadata only. It does not install or run
oh-my-codex, add dependencies, create worktrees, execute code, write user
project files, call workflow run, or enable real Agent execution.

The Agent Workforce role tier, event ledger, and HUD preview command is:

```powershell
cmd /c pnpm verify:phase143a-role-tier-event-ledger
```

It verifies that Agent Workforce plans and saved/exported task packages include
`roleTiers`, `eventLedgerPreview`, and `workforceHudPreview`. Role tiers group
the existing seven preview roles into Strategy, Architecture, Implementation
Planning, and Quality. The event ledger records disabled hook-style events as
observability metadata only; it does not execute hooks. The HUD shows plan
state, clarification coverage, consensus readiness, review package state,
approval gate state, disabled workflow handoff, preview-only OMX handoff, and
disabled execution. A preview approval is not execution permission.

The Agent Workforce execution readiness preflight preview command is:

```powershell
cmd /c pnpm verify:phase144a-execution-readiness-preflight
```

It verifies that Agent Workforce plans and saved/exported task packages include
`executionReadinessPreflight`. The preflight lists future real execution
requirements such as human approval, clean git workspace, secret-safety,
worktree isolation, task claim token, log redaction, cancellable execution, and
evidence requirements. This is a preview only: execution remains disabled,
overall status remains blocked, approval-preview is not execution approval, and
the system does not inspect git, create worktrees, call workflow run, call
oh-my-codex, or execute agents.

The Agent Workforce External OMX Runner Design command is:

```powershell
cmd /c pnpm verify:phase145a-external-omx-runner-design
```

It verifies that Agent Workforce plans and saved/exported task packages include
`externalOmxRunnerDesign`. The design lists proposed future endpoints, required
preflight checks, runner contract requirements, and blockers for a future
external OMX runner. This is design-only metadata: `runnerEnabled=false`,
`executionEnabled=false`, and `designOnly=true`. It does not create real runner
execution endpoints, call oh-my-codex, create worktrees, call workflow run, or
execute Agents.

The Runner Request Review Queue Preview command is:

```powershell
cmd /c pnpm verify:phase146a-runner-request-review-queue
```

It verifies `runnerRequestQueuePreview`: a future external runner request must
enter a human review queue, but the current queue is preview-only with
`queueEnabled=false`, `executionEnabled=false`, and external runner dispatch
disabled.

The Execution Request Approval Record Preview command is:

```powershell
cmd /c pnpm verify:phase147a-execution-approval-record
```

It verifies `executionApprovalRecordPreview`: future execution would require an
approval record, but the current record is preview-only with
`approvalRecordEnabled=false`, `executionEnabled=false`, and approval-preview is
not execution approval.

The External Runner Protocol Freeze command is:

```powershell
cmd /c pnpm verify:phase148a-external-runner-protocol-freeze
```

It verifies `externalRunnerProtocolFreeze`: the current external runner preview
protocol is frozen as `preview-1` with `frozen=true`, `runnerEnabled=false`,
`executionEnabled=false`, and `designOnly=true`. This does not mean the runner
is implemented or can execute.

The Agent Workforce Preview Final UX Seal command is:

```powershell
cmd /c pnpm verify:phase149a-agent-workforce-preview-final-ux-seal
```

It verifies the final preview UX wording and evidence for the whole Agent
Workforce + OMX-compatible handoff line. The user path is: goal clarification,
role planning, consensus preview, review package, approval gate preview, OMX
handoff preview, execution readiness preflight, then runner request / approval /
protocol freeze preview. The console remains preview-only: execution disabled,
external runner disabled, workflow run disabled, and approval-preview is not
execution approval.

The Agent Workforce Preview release summary and user acceptance pack command is:

```powershell
cmd /c pnpm verify:phase150a-agent-workforce-preview-acceptance-pack
```

The acceptance pack is
`docs/AGENT_WORKFORCE_PREVIEW_ACCEPTANCE_PACK.md`. It gives ordinary users and
administrators one checklist for accepting the preview console: open `/ui`,
generate a plan, review role tiers, clarification, consensus, review package,
approval gate, OMX handoff, blocked execution readiness, disabled external
runner preview sections, save/history, and JSON / Markdown export. Phase 150A
does not add real Agent execution, call oh-my-codex, create worktrees, connect
workflow run, add real external runner dispatch, or change the default NVIDIA
`/chat` lane.

The Agent Workforce Preview stage closure decision command is:

```powershell
cmd /c pnpm verify:phase151a-agent-workforce-stage-closure
```

The closure decision is
`docs/AGENT_WORKFORCE_PREVIEW_STAGE_CLOSURE_DECISION.md`. It closes Agent
Workforce Preview + OMX-compatible handoff as a preview/design product
baseline, indexes Phase 142A-150A evidence, references the Phase 150A user
acceptance result, lists current blockers, and records follow-up options. It
does not enable real Agent execution, call oh-my-codex, create worktrees,
connect workflow run, add real external runner dispatch, or change the default
NVIDIA `/chat` lane.

The Agent Workforce demo script and hardened user manual command is:

```powershell
cmd /c pnpm verify:phase152a-agent-workforce-demo-manual
```

The demo script is `docs/AGENT_WORKFORCE_DEMO_SCRIPT.md`. It gives a plain user
walkthrough: start the system, open `/ui`, check setup/readiness, enter Agent
Workforce, paste a sample goal, generate a plan, inspect the 7 roles and role
tiers, review clarification questions, consensus preview, review package,
approval gate preview, OMX handoff preview, blocked execution readiness, and
external runner design / queue / approval / freeze previews. It also covers
saving a plan, viewing history, exporting JSON / Markdown, and explaining why
Execution disabled and External Runner disabled are intentional safety states.

Plain user meaning: Agent Workforce is an AI team planning control panel. It
helps you split a goal, assign planning roles, produce a review package, and
export task artifacts. It will not automatically execute code, will not call
oh-my-codex, will not create a worktree, will not change your project files,
and will not dispatch a real external runner. OMX-related content is only a
future handoff package preview.

In short:

- Agent Workforce is an AI team planning control panel.
- It will not automatically execute code.
- It will not call oh-my-codex.
- It will not create a worktree.
- It will not change your project files.
- OMX content is a future handoff package preview.

The Agent Workforce product template pack command is:

```powershell
cmd /c pnpm verify:phase153a-agent-workforce-product-template-pack
```

In `/ui`, open Agent Workforce and choose a planning template before generating
the plan. The template only changes the planning context. It helps the preview
ask better clarification questions, frame the seven-role plan, shape the review
package, and produce a more relevant acceptance checklist. It will not execute
code, will not call oh-my-codex, will not create a worktree, will not call
workflow run, and will not dispatch an external runner. Execution disabled and
External Runner disabled are still the expected states.

Available templates:

- Feature Development Template: use this for a new product feature. It focuses
  on requirements, architecture impact, frontend/backend split, testing, and
  acceptance criteria.
- Bug Fix Template: use this for a bug. It focuses on reproduction steps,
  impact scope, root-cause analysis, fix plan, and regression tests.
- Documentation Template: use this for user manuals, API docs, or instructions.
  It focuses on audience, structure, examples, and acceptance standards.
- Code Review Template: use this for reviewing a change. It focuses on risks,
  maintainability, safety, test coverage, and change boundaries.
- Release Checklist Template: use this before release. It focuses on
  verification commands, evidence, secret safety, rollback plan, and boundary
  wording.
- Research / Design Study Template: use this for solution research or technical
  selection. It focuses on goals, options, comparison dimensions, risks, and a
  recommended conclusion.

The Agent Workforce final product closure commands are:

```powershell
cmd /c pnpm verify:phase154a-template-acceptance-sample-plans
cmd /c pnpm verify:phase155a-template-export-copy-ux
cmd /c pnpm verify:phase156a-guided-onboarding-demo-dataset
cmd /c pnpm verify:phase157a-agent-workforce-evidence-index
cmd /c pnpm verify:phase158a-product-readiness-known-limits
cmd /c pnpm verify:phase159a-agent-workforce-preview-rc-seal
cmd /c pnpm verify:phase160a-agent-workforce-final-closure
```

Phase 154A-160A adds sample plans, sample acceptance checklists, copy/export
handoff wording, guided onboarding demo goals, the evidence index, known-limits
hardening, release-candidate preview seal, and final closure snapshot. These
are still preview product features. Copy/export is handoff only, not execution.

Demo goals you can paste:

- Plan a customer-facing export settings feature with reviewable acceptance
  criteria.
- Plan a safe fix for a broken Markdown export button in the web console.
- Plan a user manual section for exporting Agent Workforce task packages.
- Plan a preview release checklist for Agent Workforce documentation updates.
- Plan a design study comparing two safe export package formats.

Current suitable use:

- Requirements breakdown.
- AI team planning.
- Role assignment.
- Review package generation.
- Approval preview.
- OMX handoff task package preview.
- Templated plan generation.

Current unsuitable use:

- Automatic code writing.
- Automatic file changes.
- Calling oh-my-codex.
- Creating worktrees.
- Dispatching a real runner.
- Public multi-user production deployment.

The Agent Workforce clarification answers and lifecycle persistence preview
command is:

```powershell
cmd /c pnpm verify:phase140a-workforce-clarification-lifecycle
```

It verifies that `/workforce/plan` accepts clarification answers, returns
answered and unresolved clarification summaries, and that saved Agent Workforce
plans can persist clarification answers plus preview-only lifecycle state in
the dev-only local plan package. The Web UI exposes a clarification-answer
input, can regenerate the preview with those answers, and shows lifecycle state
in history. It does not install or run `oh-my-codex`, does not execute code,
does not create worktrees, does not write user project files, does not call
workflow run, does not enable real Agent execution, and does not change the
default NVIDIA `/chat` lane.

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
history, read/delete, Markdown copy, JSON export, task-package export,
clarification-answer persistence, and preview-only lifecycle metadata.

For common work, choose a template first: Feature Development Template, Bug Fix
Template, Documentation Template, Code Review Template, Release Checklist
Template, or Research / Design Study Template. Templates generate plans only.
They do not execute Agents, do not call oh-my-codex, do not create worktrees,
do not call workflow run, and do not dispatch an external runner.

Current boundary:

- It does not execute code.
- It does not modify user project files.
- It does not connect to workflow run.
- It does not create worktrees.
- It does not start 144 real concurrent employees.
- It is not a real multi-agent executor.

### Phase 197A Agent Workforce Quickstart

1. Open `http://127.0.0.1:3100/ui` after starting the local service.
2. Choose a template in the Agent Workforce Preview panel.
3. Enter one short goal, then click Generate Plan.
4. Review the Plan, Review Package, Approval Preview, and OMX Handoff Preview.
5. Click Save Plan, then use History to reload or inspect the saved preview.
6. Confirm Execution Disabled and External Runner Disabled remain visible.
7. Export JSON or Markdown as a human handoff package.

### Agent Workforce UX Polish Quick Guide

When you first open Agent Workforce Preview, start with a template and one
short goal. Good first goals are:

- Plan a safe Bug Fix for a broken Markdown export button.
- Plan a Documentation update for a user handoff package.
- Plan a Release Checklist for a preview baseline review.

The canonical terms in the UI are Agent Workforce Preview, Plan, Review
Package, Approval Preview, OMX Handoff Preview, External Runner Disabled, and
Execution Disabled. If a goal is empty, too long, or uses an invalid template,
the UI should show a plain validation message without stack traces or API keys.

Exports are handoff packages for human review. They are not execution packages.
Suggested OMX commands are text only. Approval-preview is not execution
approval. The boundary banner should remain visible: Preview only, Execution
Disabled, External Runner Disabled, No oh-my-codex call, and No worktree creation.

### Manual Trial And Feedback

For a guided trial, use `docs/AGENT_WORKFORCE_MANUAL_TRIAL_SCRIPT.md`. It walks
through startup, `/ui`, Agent Workforce, the preview-only banner, template
selection, demo goal, Plan generation, clarification questions, role tiers,
consensus preview, Review Package, Approval Preview, OMX Handoff Preview,
Execution Readiness blocked, External Runner Disabled, save, history, JSON
export, Markdown export, and final confirmation that no code was executed.

After the walkthrough, use `docs/AGENT_WORKFORCE_USER_FEEDBACK_TEMPLATE.md` to
record the trial person, date, scenario, template, goal, understanding of
preview-only and Execution Disabled, approval-preview boundary, OMX handoff
package boundary, unclear steps, UI issues, export issues, acceptance
conclusion, and follow-up suggestions.

The final trial closure is recorded in
`docs/AGENT_WORKFORCE_FINAL_USER_TRIAL_CLOSURE.md`. It is not a production
release and not an execution release.

To answer clarification questions in `/ui`, generate a Workforce preview, then
fill the clarification answer box with one answer per line:

```text
clarify_goal=The exact user outcome to optimize.
clarify_scope=In scope and out of scope.
clarify_acceptance=The verification commands or evidence required.
```

Click the generate button again to regenerate the preview with those answers.
The plan will show answered and unresolved clarification summaries. After
saving the plan, use Save clarification answers to persist the same answers in
the dev-only local plan package. The history cards show lifecycle status and
clarification counts for saved plans.

## 8. Save And Export

Use the Agent Workforce controls in `/ui` to:

- Save generated plans.
- Read plan history.
- Delete saved plans.
- Copy Markdown.
- Export JSON.
- Export a task package.
- Save clarification answers for a saved plan.
- Save preview-only lifecycle state for a saved plan.

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
- GitHub Actions Node.js warning cleanup recorded through
  `cmd /c pnpm verify:phase130a-actions-node24-warning-cleanup`.
- GitHub Release artifact preflight recorded through
  `cmd /c pnpm verify:phase131a-release-artifact-preflight`.
- Release decision pack recorded through
  `cmd /c pnpm verify:phase132a-release-decision-pack`.
- Release creation confirmation recorded through
  `cmd /c pnpm verify:phase133a-release-creation-confirmation`.
- GitHub draft prerelease created through
  `cmd /c pnpm verify:phase134a-release-creation-execution`.
- Release publish and asset-upload preflight recorded through
  `cmd /c pnpm verify:phase135a-release-publish-preflight`.
- GitHub prerelease publication completed through
  `cmd /c pnpm verify:phase136a-release-publish-execution`.
- GitHub prerelease rolled back to draft through
  `cmd /c pnpm verify:phase137a-release-draft-rollback`.
- Agent Workforce OMX benchmark and next-stage design reference recorded
  through `cmd /c pnpm verify:phase138a-agent-workforce-omx-benchmark`.
- Agent Workforce clarify and consensus preview recorded through
  `cmd /c pnpm verify:phase139a-agent-workforce-clarify-consensus`.
- Agent Workforce clarification answers and lifecycle persistence preview
  recorded through
  `cmd /c pnpm verify:phase140a-workforce-clarification-lifecycle`.
- Agent Workforce review package and human approval gate preview recorded
  through
  `cmd /c pnpm verify:phase141a-workforce-review-approval-gate`.
- Agent Workforce Preview release summary and user acceptance pack recorded
  through
  `cmd /c pnpm verify:phase150a-agent-workforce-preview-acceptance-pack`.
- Agent Workforce Preview stage closure decision recorded through
  `cmd /c pnpm verify:phase151a-agent-workforce-stage-closure`.
- Agent Workforce demo script and ordinary-user manual hardening recorded
  through `cmd /c pnpm verify:phase152a-agent-workforce-demo-manual`.
- Agent Workforce product template pack recorded through
  `cmd /c pnpm verify:phase153a-agent-workforce-product-template-pack`.
- Agent Workforce preview product closure recorded through
  `cmd /c pnpm verify:phase160a-agent-workforce-final-closure`.

Not complete yet:

- Cloud deployment.
- Automated deployment or release publishing automation.
- Release asset upload.
- Package or container image publishing.
- Current shell PATH refresh if `gh` is still not recognized before reopening
  PowerShell.
- Pull request workflow.
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
cmd /c pnpm verify:phase130a-actions-node24-warning-cleanup
cmd /c pnpm verify:phase131a-release-artifact-preflight
cmd /c pnpm verify:phase132a-release-decision-pack
cmd /c pnpm verify:phase133a-release-creation-confirmation
cmd /c pnpm verify:phase134a-release-creation-execution
cmd /c pnpm verify:phase135a-release-publish-preflight
cmd /c pnpm verify:phase136a-release-publish-execution
cmd /c pnpm verify:phase137a-release-draft-rollback
cmd /c pnpm verify:phase138a-agent-workforce-omx-benchmark
cmd /c pnpm verify:phase139a-agent-workforce-clarify-consensus
cmd /c pnpm verify:phase140a-workforce-clarification-lifecycle
cmd /c pnpm verify:phase141a-workforce-review-approval-gate
cmd /c pnpm verify:phase112a-non-docker-release-check
cmd /c pnpm verify:phase107a-secret-safety
cmd /c pnpm verify:phase105a-user-journey
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm -r --if-present check
```

## Agent Workforce Navigation Hardening

This section is the ordinary-user path for the hardened Agent Workforce
Preview baseline. Agent Workforce is an AI team planning control panel. It
helps you split a goal, choose a template, assign roles, review the plan, and
export a handoff package. It will not automatically execute code, will not
call oh-my-codex, will not create worktrees, and will not modify project
files.

### Start from zero

Run:

```powershell
cmd /c pnpm install
cmd /c pnpm dev:phase7b
```

No Docker / cloud / CI/CD expansion is part of this path.

Exact local path boundary: No Docker / cloud / CI/CD expansion.

### Open /ui

Open the local service UI and enter the Agent Workforce panel.

### Choose a template

Choose Feature Development, Bug Fix, Documentation, Code Review, Release
Checklist, or Research / Design Study. Templates only shape the plan context.

### Generate a plan

Enter a goal or click a demo goal. The result is a preview plan with Goal
Summary, Clarification Questions, Role Plan, Role Tiers, Consensus Preview,
Review Package, Acceptance Checklist, OMX Handoff Preview, Execution Readiness,
and External Runner Preview.

### Save history

Click save. History shows plan id, selected template, createdAt, plan state,
and execution disabled. History does not trigger execution.

### Export JSON / Markdown

Export JSON or copy Markdown to create a handoff package. Copy/export is
handoff only, not execution.

### View handoff package

The handoff package can include selected template, role tiers, review package,
approval preview, OMX handoff preview, execution readiness, and external
runner disabled reasons.

### Understand execution disabled

Execution disabled and External Runner disabled are safety states. Approval
preview is not execution approval. OMX Handoff Preview is only a future task
package preview and does not call OMX CLI, `$team`, or `ralph`.

### Guided demo goals

- Feature Development template: Plan a customer-facing export settings feature with reviewable acceptance criteria.
- Bug Fix template: Plan a safe fix for a broken Markdown export button in the web console.
- Documentation template: Plan a user manual section for exporting Agent Workforce task packages.
- Code Review template: Plan a code review for a UI export change without executing code.
- Release Checklist template: Plan a preview release checklist for Agent Workforce documentation updates.
- Research / Design Study template: Plan a design study comparing two safe export package formats.

### Product experience hardening verification

```powershell
cmd /c pnpm run verify:phase161a-ui-information-architecture
cmd /c pnpm run verify:phase162a-workforce-dashboard-summary-cards
cmd /c pnpm run verify:phase163a-template-gallery-ux
cmd /c pnpm run verify:phase164a-plan-output-readability
cmd /c pnpm run verify:phase165a-review-approval-handoff-clarity
cmd /c pnpm run verify:phase166a-saved-plans-history-ux
cmd /c pnpm run verify:phase167a-export-handoff-package-manifest
cmd /c pnpm run verify:phase168a-guided-demo-mode-polish
cmd /c pnpm run verify:phase169a-user-manual-navigation
cmd /c pnpm run verify:phase170a-readme-agents-boundary-sync
cmd /c pnpm run verify:phase171a-verification-matrix
cmd /c pnpm run verify:phase172a-local-operator-runbook
cmd /c pnpm run verify:phase173a-manual-qa-checklist
cmd /c pnpm run verify:phase174a-evidence-manifest-final
cmd /c pnpm run verify:phase175a-agent-workforce-preview-rc2-seal
cmd /c pnpm run verify:phase176a-install-start-use-path
cmd /c pnpm run verify:phase177a-documentation-crosslink-index
cmd /c pnpm run verify:phase178a-user-handoff-package
cmd /c pnpm run verify:phase179a-full-preview-regression-sweep
cmd /c pnpm run verify:phase180a-final-product-decision-gate
```
## Agent Workforce One-key Controlled Loop

For everyday use, run the manual bridge loop:

```powershell
cmd /c pnpm run agent:auto:manual-loop -- -Goal "帮我实现一个小功能"
```

The system will generate an Agent Workforce plan, auto-save it, generate a Codex handoff, copy it to the clipboard, wait for a Codex result file, import the result, generate system review feedback, and copy feedback to the clipboard.

Modes:

- Manual bridge loop: recommended daily mode. It does not call Codex CLI. A human pastes the handoff into Codex and writes the result to `.codex-handoff/inbox/latest-codex-result.md`.
- Dry-run loop: run `cmd /c pnpm run agent:auto:dry-run -- -Goal "..."` to validate the controlled loop and safety gate without real Codex execution.
- Real Codex one-shot: run only when you intentionally approve one real Codex exec round. It does not commit, push, create a worktree, or dispatch workflow runs.

Desktop control:

```powershell
%USERPROFILE%\Desktop\unified-ai-system-全自动闭环.bat
```

Safety defaults:

- Codex is not called by default.
- The loop is not unattended or infinite.
- `MaxRounds` defaults to 1 and is capped at 3.
- No automatic apply, merge, commit, or push.
- No default worktree creation.
- No workflow run hookup.
- No `legacy/` edits.
- No `PROJECT_CONTEXT.md` creation.
- No default NVIDIA `/chat` lane change.
- No plaintext API keys in UI, logs, evidence, or handoff files.
