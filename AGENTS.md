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

<!-- BEGIN UNIFIED_AI_SYSTEM_AGENT_RULES -->
## Managed Agent Rules

Managed block maintained by `sync:readme-agents-current-state`.

### Phase completion sync rule

- Every phase completion must refresh the README / AGENTS managed block.

### Local Agent operation rules

- permissionMode is required.
- `approvalRecord` is required before apply.
- `allowedFiles` is required before apply.
- `forbiddenPaths` must block `legacy/`, `PROJECT_CONTEXT.md`, `.env`, `.git`, and `node_modules`.
- `dryRun` defaults on.
- `full_open` is disabled.
- `autoCommit=false`.
- `autoPush=false`.
- release and deploy are blocked.

### UI rules

- User-facing Local Agent panels must be first-screen visible or clearly reachable.
- Chat output area must remain large enough for long responses.
- Compact controls are preferred.

### Verification rules

- `node --check` modified JS files.
- `sync:readme-agents-current-state`
- `verify:phase306c-readme-agents-auto-sync-guard`
- `verify:phase306a-ui-usability-redesign`
- `verify:phase303a-305a-ui-ready-approved-local-operation-loop`
- `verify:phase302a-intent-explanation-approval-preview`
- `verify:safe-regression-matrix`
- `verify:phase107a-secret-safety`
- `health:phase12a`
- `doctor:phase13a`
- `pnpm -r --if-present check`

### Evidence rules

- Do not claim pass if the verifier chain is blocked.
- Do not claim clean workspace.
- If a verifier refreshes unrelated evidence, report it as a verifier side effect.

### Workforce / provider boundary rules

- Workforce and Brain Adapter phases default to dry-run or authorization-gate mode.
- Unified IO / branch execution fabric phases must remain dry-run preview unless separately authorized.
- Real provider calls require explicit scoped authorization before execution.
- Credential bindings must use `credentialRef`; raw secret values must not be read or printed.
- Controlled mutation expansion is capped at 56 files; further file-count expansion is blocked by default.
- Any future controlled mutation expansion requires Product Work Value Gate approval with non-empty valueClass and expectedUserValue.
- Low-risk marker-only, managed-block-only, summary-only, or file-count-only phase expansion must not be selected while Product Work Mode blockers remain unresolved.
- Product Work Mode phases must not fabricate owner feedback, Provider stability, deployment, production readiness, or controlled mutation product-value claims.
- Real Provider smoke remains blocked until owner approval explicitly allows maxRequests=1, credentialRefOnly=true, providerCallAllowed=true, and rawSecretPrintAllowed=false.
- Self Evolution Governance may observe, diagnose, propose, and dry-run only; autonomous code mutation, Provider calls, secret reads, deploy, and `/chat` or `/chat-gateway/execute` changes remain blocked.
- Position Library may be source-backed and expandable, but must not claim complete worldwide coverage.
- Phase578A-T must not be conflated with Phase577 source registry / O*NET / SOC / ISCO / ESCO import governance.
- Phase579A-T through Phase591A-T must stay focused on unified IO, internal employee communication bus, adaptive branch execution fabric, result merger, load governance, failure injection, observability, safety, maintenance, and dry-run test expansion.
- Phase592A-T Codex Context Gateway must stay independent from main AI Gateway runtime, `/chat`, `/chat-gateway/execute`, provider runtime, Codex config, and real Codex base_url.
- Phase593A-T Codex Context Gateway Operator Panel Preview must stay UI-only and may only display sanitized `.codex-context` outputs; it must not connect Codex, change Codex config/base_url, call providers, read secrets/webhooks, modify `/chat` or `/chat-gateway/execute`, or restore Yiyi / Character / Guided Showcase.
- Phase594A-T Codex Context Gateway Usage Workflow + Runner Integration Preview must tell Codex/operators to read `.codex-context/current-context-pack.md` first, stop when `context-freshness-report.json` has `stale=true`, use `relevant-files.json` as the default read scope, load `codex-prompt-pack.md`, and run validation commands; it must not modify Codex config/base_url, connect real Codex, call providers, read secrets/webhooks, or modify `/chat` or `/chat-gateway/execute`.
- Phase595A-T Codex Context Gateway Real Usage Trial Without Base URL Change must keep Codex config/base_url unchanged, require `.codex-context/current-context-pack.md` first, stop on stale context, use `relevant-files.json` as the default read scope, track expected/actual read previews, write Phase595 evidence, and avoid project Provider calls, secrets/webhooks, `/chat`, and `/chat-gateway/execute` changes.
- Phase596A-T Codex Context Gateway Repeated Usage Trial + Token Saving Benchmark must keep repeated usage tasks bounded to `.codex-context`, `relevant-files.json`, stale guard, prompt pack loading, validation evidence, token saving estimates, and full repo scan avoidance; it must not modify Codex config/base_url, connect real Codex, call providers, read secrets/webhooks, or modify `/chat` or `/chat-gateway/execute`.
- Phase597A-T Codex Context Gateway Controlled Base URL Integration Design must remain design-only: document config surface, relay architecture, authorization gate, account pool policy, cache miss policy, rate limit/budget/timeout policy, credentialRef-only boundary, rollback, risk review, checklist, config preview, and authorization packet template without modifying Codex config/base_url or connecting relay/provider.
- Phase598A-T Codex Context Gateway Authorization Evidence Intake + Dry-Run Config Simulation must remain authorization-intake and dry-run simulation only: required fields may be validated, redacted config previews may be generated, relay/account-pool/credentialRef/rollback/emergency-disable paths may be simulated, and Mission Control may show authorization status, but real Codex config/base_url writes, relay/proxy start, provider calls, secret/webhook reads, `/chat`, and `/chat-gateway/execute` changes remain blocked.
- Phase599A-T Codex Context Gateway Authorization Packet Completion + Human Approval Review must remain review-only: authorization packet templates, optional sanitized input loading, completeness review, human approval review, config scope review, relay/account-pool ref review, credentialRef review, budget/rate/duration review, rollback/emergency disable review, risk acceptance review, evidence ledger, Mission Control preview, and guarded real test readiness may be generated, but real Codex config/base_url writes, relay/proxy start, provider calls, secret/webhook reads, forged approvals, `/chat`, and `/chat-gateway/execute` changes remain blocked.
- Phase600A-T Codex Context Gateway Authorization Packet Input + Human Approval Record + Guarded Real Test Readiness Review must remain input/readiness-review-only: example input files, optional sanitized authorization packet and human approval record loading, completeness/approval consistency/budget/ref/rollback/risk reviews, evidence ledger, Mission Control readiness preview, and next phase gate reports may be generated, but real Codex config/base_url writes, relay/proxy start, provider calls, secret/webhook reads, forged approvals, `/chat`, and `/chat-gateway/execute` changes remain blocked.
- Phase601A-T Codex Context Gateway Guarded Real Base URL Test Preparation must remain preparation-only: session_override command previews, relay health check previews, credential/account-pool prechecks, one-shot prompt previews, rollback/emergency disable previews, non-execution guards, checklists, evidence ledgers, Mission Control preparation preview, and final command bundle preview may be generated, but no real command, relay connection, proxy start, provider call, persistent config write, `/chat`, `/chat-gateway/execute`, deploy, release, tag, or artifact upload is allowed.
- Phase602A-T Codex Context Gateway Guarded Real Base URL One-Shot Test must require `docs/phase602-final-execution-confirmation.input.json` and maxRequests=1 before any execution; missing confirmation blocks execution, and evidence must keep oneShotExecuted=false, requestAttemptCount=0, retryAttemptCount=0, rawBaseUrlValueExposed=false, secretValueExposed=false, user/project Codex config modified=false, deploy/release/tag/artifact=false.
- Phase603A-T Codex Context Gateway Custom Model Provider Route Preparation must remain design/preparation-only: custom model_provider route preview, sanitized config.toml structure inspection, duplicate provider table check, pme_context_gateway `.preview` artifact, negative-control plan, command bundle preview, rollback/emergency previews, Mission Control preview, and evidence ledger may be generated, but `~/.codex/auth.json` must not be read/touched/copied/output and real config writes, provider switches, relay/proxy starts, provider calls, `/chat`, `/chat-gateway/execute`, deploy, release, tag, or artifact upload remain blocked.
- Phase604A-T Codex Context Gateway Custom model_provider Negative-Control + Guarded One-Shot Test must remain gated by final confirmation: without `docs/phase604-final-execution-confirmation.input.json`, bad model_provider negative-control and custom provider one-shot are not executed; with confirmation, maxRequests=1 and retryLimit=0 still apply, `~/.codex/auth.json` remains denylisted, persistent config writes remain forbidden, and `/chat`, `/chat-gateway/execute`, deploy, release, tag, and artifact upload remain blocked.
- Phase607R-Fix Interactive Terminal Guarded One-Shot Execution Intake may only classify a user-provided manual result input; if the input is missing it seals with blocker=manual_result_input_missing, and it must not execute Codex, call Providers, read auth.json, write Codex config, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, push, commit, restore character modules, or claim workspace clean.
- Phase610R-Fix Codex Exec Custom Model Provider One-Shot Result Intake may only classify and preserve a user-reported sanitized `codex exec` result; it must not re-execute one-shot commands, call Providers by this phase, read auth.json, write Codex config, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, push, commit, claim production readiness, claim release readiness, or claim workspace clean.
- Phase611R-Fix Codex Exec Custom Provider Repeated Guarded Test Design may only prepare a bounded reliability design, budget/rate/rollback policy, command preview, Phase612 confirmation example, and result schema for up to 3 future attempts; it must not execute `codex exec`, call Providers by this phase, read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, push, commit, claim repeated reliability, claim production readiness, claim release readiness, or claim workspace clean.
- Phase612R-Fix Repeated Codex Exec Custom Provider Guarded Reliability Execution may only run the confirmed bounded reliability attempts serially with maxRequests=1 per attempt and retryLimit=0; it must stop on first failure, preserve sanitized evidence, and must not read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, push, commit, claim production readiness, claim release readiness, or claim workspace clean.
- Phase613R-Fix Repeated Reliability Result Closure may only close the Phase612 repeated_pass evidence and design a controlled next gate; it must not execute Codex, call Providers by this phase, read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, push, commit, claim production readiness, claim release readiness, or claim workspace clean.
- Phase614R-Fix Controlled Integration Preview Gate may only prepare preview-only route contract and policy evidence for a future controlled integration; it must not execute Codex, call Providers by this phase, read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, add runtime execution buttons, deploy, release, tag, upload artifacts, push, commit, claim production readiness, claim release readiness, or claim workspace clean.
- Phase615R-Fix Runtime Integration Approval Packet may only prepare approval artifacts and read-only Mission Control preview for a future runtime candidate; it must not execute Codex, call Providers by this phase, read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, add runtime execution buttons, deploy, release, tag, upload artifacts, push, commit, claim production readiness, claim release readiness, or claim workspace clean.
- Phase616R-620R Controlled Runtime Candidate Dry-Run Bundle may only seal dry-run candidate artifacts and read-only Mission Control preview; it must not execute Codex, call Providers by this phase, read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, add runtime execution buttons, deploy, release, tag, upload artifacts, push, commit, claim production readiness, claim release readiness, or claim workspace clean.
- Phase621R-628R Controlled Runtime Candidate Path may only expose isolated `/runtime-candidate/codex-exec-crs/*` candidate endpoints and local dry-run/guarded/reliability evidence; it must not execute real Codex, call Providers by this phase, read auth.json, write Codex config, modify provider runtime, modify default `/chat` or `/chat-gateway/execute` main chain, add deploy/release controls, deploy, release, tag, upload artifacts, push, commit, claim production readiness, claim release readiness, or claim workspace clean.
- Phase632H Token Saving Hard Enforcement Lock makes the token-saving workflow mandatory in AGENTS managed guidance: 必须使用 docs/phase632-codex-token-saving-task-template.md。 未通过 Phase632 preflight，不得继续执行。 All Codex tasks must first pass Phase632 preflight, read context pack, read relevant files, check token budget, check stale=false, forbid full repo scan, and follow output budget. It must not execute `codex exec`, call Providers, read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, or claim workspace clean.
- Phase632I Automatic Token-Saving Preflight Injection keeps the same hard rule in AGENTS managed guidance and adds `pnpm run preflight:phase632-token-saving`; all Codex tasks must first pass Phase632 preflight, context pack, relevant files, token budget, stale=false, forbidden full repo scan, and output budget checks before continuing. It must not execute `codex exec`, call Providers, read auth.json, write Codex config, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, or claim workspace clean.
- Phase633R-637R Full System Audit + Bug Fix + Final System Report Bundle keeps `/chat`, `/chat-gateway/execute`, and provider runtime unchanged; high-risk findings remain approval-gated, low-risk docs/script drift may be fixed, production/release readiness remains false, and Phase632 preflight remains mandatory.
- Phase638R Nightly 20:00 Safe Engineering Task Runner keeps nightly automation bounded: only low/medium-safe tasks may auto-run after Phase632 preflight, high-risk work is evidence gate-only, registration is opt-in, and no Provider, secret, Codex config, `/chat`, `/chat-gateway/execute`, deploy, release, push, or commit action is allowed.
- Phase639R P1 Approval Packet Bundle keeps both P1 risks approval-gated: main-chain integration and provider runtime approval packets are ready, no implementation is executed, Provider is not called, `/chat` and `/chat-gateway/execute` are not modified, provider runtime is not modified, production/release readiness remains false, and Phase632 preflight remains mandatory.
- Phase639R-Nightly keeps the nightly runner fallback operator panel read-only: Windows Task Scheduler remains unregistered, nightly automation is not enabled, fallback launchers are available, Phase632 preflight remains mandatory, and no Provider, secret, Codex config, `/chat`, `/chat-gateway/execute`, deploy, release, push, or commit action is allowed.
- Phase640R-Nightly keeps the permissioned scheduler retry pack manual-only: Windows Task Scheduler remains unregistered until manual permissioned retry succeeds, nightly automation is not enabled yet, fallback launchers remain available, Phase632 preflight remains mandatory, and no Provider, secret, Codex config, `/chat`, `/chat-gateway/execute`, deploy, release, push, or commit action is allowed.
- Phase641R-Nightly records the registration result intake state: scheduledTaskRegistered=false and nightlyAutomationEnabled=false while registration_result_input_missing remains the current blocker; Phase632 preflight remains mandatory and no Provider, secret, Codex config, `/chat`, `/chat-gateway/execute`, deploy, release, push, or commit action is allowed.
- Phase640R-ExternalTool records that Codex/crs gateway is external tool mode: main-chain integration frozen, provider runtime integration frozen, Phase632 preflight mandatory, no `/chat` or `/chat-gateway/execute` integration, no provider runtime mutation, no Provider call by this phase, and no production/release claim.
- Phase641R-645R External Tool Productization Bundle records the external tool productization chain: CLI wrapper ready, operator panel hardened, nightly safe runner reliability checked, open-source dry-run tool pack ready, token-saving benchmark rechecked, Phase632 preflight mandatory, not main chain, not `/chat`, not `/chat-gateway/execute`, not provider runtime, no Provider call, no secret/auth.json/raw base_url, no Codex config write, no deploy/release/push/commit, and production/release not ready.
- Phase646R-650R External Tool Daily Workflow Closure records the daily external-tool operating line: daily workflow ready, task queue ledger ready, evidence dashboard ready, token-saving report ready, next-use playbook ready, external tool mode active, Phase632 preflight mandatory, not main chain, not `/chat`, not `/chat-gateway/execute`, not provider runtime, no Provider call, no secret/auth.json/raw base_url, no Codex config write, no deploy/release/push/commit, and production/release not ready.
- Phase651-666 Taiji / Beidou Engine Self-Use Foundation records a dry-run self-use kernel for natural-language capability generation, capability neuron manifests, immune classification, scaffold/dry-run/verifier/evidence/rollback generation, registry/synapse preview, homeostasis policy, built-in Context Codec and Codex Context neurons, God/Tianshu draft neurons, Mission Control read-only Beidou panel, and Codex long-task token-saving subgateway runner. It must not auto-enable runtime, self-approve capabilities, exceed maxSpawnDepth=1, execute recursive spawn, call Providers, read auth.json/secrets/raw base_url, write Codex config/base_url, modify provider runtime, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, restore Yiyi/Character, or claim production/release readiness.
- Phase1451-1475 Real Local Dogfooding Intake + Issue Repair Closure keeps real dogfooding honest: if no owner daily/weekly ledger or feedback exists, realOwnerDogfoodingRecordCount=0 and blocker=real_owner_dogfooding_records_missing while intakeFrameworkReady=true and issueRepairLoopReady=true; P0 stops, P1 stays gated, only P2/P3 docs/read-only UI repairs are allowed, and no Provider, secret, auth.json, raw CredentialRef, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, workspace-clean, production-ready, or public-launch claim is allowed.
- Phase1476 Concept Field Kernel keeps the concept-field path synthetic only as a synthetic concept-field sub-kernel: synthetic vectors dry-run and benchmark scaffold are allowed, but GloVe/gensim/external dataset downloads, external network, Provider calls, secret/auth.json/raw CredentialRef reads, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, AGI claims, trillion-model-surpass claims, real semantic validation claims, and production readiness claims are blocked.
- Phase1476-1600 Local Self-Use Route A Master Control keeps the Route A path local_self_use_only with five gated AIO rounds; providerCallsMade=false by default, OpenAI/Claude/OpenRouter/MiMo/paid Provider calls are approval-packet-only, and no Provider, secret/auth.json/raw CredentialRef, Codex config write, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, production-ready claim, manual-human-test claim, AGI claim, LLM replacement claim, or trillion-model-surpass claim is allowed.
- Phase1561-1600 Local Self-Use Candidate Finalization keeps the owner-local candidate closure path local_only: it may document startup, health, emergency disable, backup/restore, evidence retention, troubleshooting, upgrade/rollback, and final handoff evidence, but it must not become public SaaS, public production deployment, commercial billing, multi-tenant isolation, public user account system, external SLA, or public marketing claim.
- Phase1601-1620 Global Bug Intake + Stabilization Repair Loop may collect bug inventory, classify P0/P1/P2/P3, repair only P0/P1 issues that stay default-off with rollback and verifier, ledger P2/P3, rebuild regression evidence, and seal a local self-use stable candidate. It must not read secrets/auth.json/raw CredentialRef, call Providers, bypass CredentialRef/provider/budget gates, modify `/chat` or `/chat-gateway/execute` by default, deploy, release, tag, upload artifacts, push, commit, claim automated tests as human feedback, or claim production readiness.
- Phase1506-1530 Local Dogfooding Framework + Evidence Loop keeps local dogfooding honest: frameworkReady and automatedEvidenceReady may seal, but owner dogfooding completion, real human feedback completion, and external tester feedback completion remain unsealed unless real owner/human records exist. Automated screenshots, automated task runs, token-saving measurements, and regression runs must never be counted as ownerManualFeedback or realHumanFeedbackCollected.
- Phase1531-1560 Guarded Real Provider Local Self-Use Test Gate keeps real provider work gated: providerGateReady may seal with providerCallsMade=false and blocker=provider_gate_not_satisfied for real execution when providerRef or credentialRef approval is missing; realProviderTestCompleted, production provider readiness, default main-chain enablement, and paid/non-NVIDIA provider calls remain unsealed.
- Phase1781-1800 Owner Zero-Learning Mode is local desktop one-click operation only: it may create root launchers, auto-start/detect the local service, run local Chrome/Edge headless browser checks against `/ui`, generate/open a Chinese owner daily report, and write local evidence. It must not require owner web-button operation, call Providers, read secrets/auth.json/raw CredentialRef, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, push, commit, claim production readiness, or count automation as human feedback.
- Phase1821-1840 Codex Design Knowledge Pack requires future Codex owner-facing UI edits to read `docs/design/codex-design-knowledge/`; Owner Home must not退回工程后台; owner-facing pages must not become a 按钮墙; Phase / evidence / trace / raw provider details are default-hidden in Advanced Mode; it must not call Providers, read secrets/auth.json/raw CredentialRef, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, push, commit, use remote fonts/CDNs/hotlinked images, claim owner satisfaction improvement, or claim production readiness.
- Phase1881A Legacy Automation Capability Read-Only Audit keeps legacy automation read-only and not integrated: it may generate docs/evidence/verifier output from path and keyword classification only, while legacyModified=false, legacyScriptsExecuted=false, secretValueExposed=false, providerCallsMade=false, deploy/release/tag/artifact/push/commit=false, `/chat` unchanged, and `/chat-gateway/execute` unchanged.
- Phase1889A-1901A Owner Automation Action Registry and Command Palette v1 keeps owner automation display-only with real `/ui` browser visual smoke, final seal, and dry-run preview drawer polish: registeredActionCount=1, `create_desktop_spreadsheet` visible as `帮我在桌面建一个表格`, dry-run preview drawer hierarchy and evidence refs visible, approval-required state visible, screenshot/DOM/seal/polish evidence generated, realRunButtonEnabled=false, realExecutionCapabilityExpanded=false, newFileCreated=false, desktopScanPerformed=false, desktopOtherFilesRead=false, providerCallsMade=false, `/chat` unchanged, and `/chat-gateway/execute` unchanged.
- Phase2088A Controlled Codex Prompt Execution keeps Codex external tool use bounded: exactly one `codex exec` prompt may run only after Phase632 preflight, Phase2087A seal, approvalRecord, allowedFiles, and forbiddenPaths pass; verifier must validate existing evidence and must not invoke Codex a second time; `CRS_OAI_KEY` may be passed only by allowlisted environment variable name and evidence may record only boolean presence; project Providers, secrets/auth.json/.env, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2089A Controlled Codex Patch Proposal keeps Codex external tool patch generation bounded: exactly one `codex exec` patch proposal may run only after Phase632 preflight, Phase2088A seal, approvalRecord, allowedFiles, and forbiddenPaths pass; verifier must validate existing evidence and must not invoke Codex again; the proposal must remain evidence-only with patchProposalApplied=false and targetFileCreated=false; `CRS_OAI_KEY` may be passed only by allowlisted environment variable name and evidence may record only boolean presence; project Providers, secrets/auth.json/.env, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2090A Controlled Patch Apply Gate keeps real patch application narrow: exactly one Phase2089A docs-only addition may be applied after Phase632 preflight, Phase2089A seal, approvalRecord, allowedFiles, and forbiddenPaths pass; rollback evidence is required; verifier must validate the applied file and must not execute Codex or call Providers; source changes, multi-file patches, overwrites, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2091A Controlled Source Patch Apply keeps real source patch application narrow: exactly one new `tools/phase2091/` source file may be applied after Phase632 preflight, Phase2090A seal, approvalRecord, allowedFiles, and forbiddenPaths pass; `node --check`, local source smoke, and rollback evidence are required; verifier must validate the applied file and must not execute Codex or call Providers; existing source modifications, multi-file patches, overwrites, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2092A Controlled Existing Tool Source Mutation keeps real existing source mutation narrow: exactly one existing `tools/phase2091/generated-source-patch-target.mjs` source file may be modified after Phase632 preflight, Phase2091A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA pass; `node --check`, local source smoke, rollback evidence, Phase2091 marker preservation, and Phase2092 marker emission are required; verifier must validate the applied mutation and must not execute Codex or call Providers; create/delete/rename/binary/multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2093A-2095A Controlled Batch Tool Mutation keeps real batch source mutation narrow: exactly two existing low-risk tool source files may be modified after Phase632 preflight, Phase2092A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for both files, local batch smoke, rollback evidence, earlier marker preservation, and Phase2093/Phase2094 marker emission are required; verifier must validate the applied batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2096A-2100A Controlled Triple Tool Mutation keeps real batch source mutation narrow: exactly three existing low-risk tool source files may be modified after Phase632 preflight, Phase2093A-2095A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all three files, local triple smoke, rollback evidence, earlier marker preservation, and Phase2096/Phase2097/Phase2100 marker emission are required; verifier must validate the applied triple batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2101A-2110A Controlled Quad Tool Mutation keeps real batch source mutation narrow while extracting a reusable controlled mutation substrate: exactly four existing low-risk tool source files may be modified after Phase632 preflight, Phase2096A-2100A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all four files, local quad smoke, rollback evidence, earlier marker preservation, and Phase2106/Phase2107/Phase2108/Phase2109 marker emission are required; verifier must validate the applied quad batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2111A-2120A Controlled Quint Tool Mutation keeps real batch source mutation narrow while reusing the JSON smoke helper: exactly five existing low-risk tool source files may be modified after Phase632 preflight, Phase2101A-2110A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all five files, local quint smoke, rollback evidence, earlier marker preservation, and Phase2116/Phase2117/Phase2118/Phase2119/Phase2120 marker emission are required; verifier must validate the applied quint batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2121A-2131A Controlled Sext Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to six commands: exactly six existing low-risk tool source files may be modified after Phase632 preflight, Phase2111A-2120A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all six files, local sext smoke, rollback evidence, earlier marker preservation, and Phase2126/Phase2127/Phase2128/Phase2129/Phase2130/Phase2131 marker emission are required; verifier must validate the applied sext batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2132A-2143A Controlled Sept Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to seven commands: exactly seven existing low-risk tool source files may be modified after Phase632 preflight, Phase2121A-2131A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all seven files, local sept smoke, rollback evidence, earlier marker preservation, and Phase2137/Phase2138/Phase2139/Phase2140/Phase2141/Phase2142/Phase2143 marker emission are required; verifier must validate the applied sept batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2144A-2156A Controlled Oct Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to eight commands: exactly eight existing low-risk tool source files may be modified after Phase632 preflight, Phase2132A-2143A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all eight files, local oct smoke, rollback evidence, earlier marker preservation, and Phase2149/Phase2150/Phase2151/Phase2152/Phase2153/Phase2154/Phase2155/Phase2156 marker emission are required; verifier must validate the applied oct batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2157A-2170A Controlled Nonet Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to nine commands: exactly nine existing low-risk tool source files may be modified after Phase632 preflight, Phase2144A-2156A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all nine files, local nonet smoke, rollback evidence, earlier marker preservation, and Phase2162/Phase2163/Phase2164/Phase2165/Phase2166/Phase2167/Phase2168/Phase2169/Phase2170 marker emission are required; verifier must validate the applied nonet batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2171A-2185A Controlled Deca Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to ten commands: exactly ten existing low-risk tool source files may be modified after Phase632 preflight, Phase2157A-2170A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all ten files, local deca smoke, rollback evidence, earlier marker preservation, and Phase2176/Phase2177/Phase2178/Phase2179/Phase2180/Phase2181/Phase2182/Phase2183/Phase2184/Phase2185 marker emission are required; verifier must validate the applied deca batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2202A-2218A Controlled Twelve Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twelve commands: exactly twelve existing low-risk tool source files may be modified after Phase632 preflight, Phase2186A-2201A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twelve files, local twelve smoke, rollback evidence, earlier marker preservation, and Phase2207/Phase2208/Phase2209/Phase2210/Phase2211/Phase2212/Phase2213/Phase2214/Phase2215/Phase2216/Phase2217/Phase2218 marker emission are required; verifier must validate the applied twelve batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2219A-2236A Controlled Thirteen Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirteen commands: exactly thirteen existing low-risk tool source files may be modified after Phase632 preflight, Phase2202A-2218A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirteen files, local thirteen smoke, rollback evidence, earlier marker preservation, and Phase2224/Phase2225/Phase2226/Phase2227/Phase2228/Phase2229/Phase2230/Phase2231/Phase2232/Phase2233/Phase2234/Phase2235/Phase2236 marker emission are required; verifier must validate the applied thirteen batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2237A-2255A Controlled Fourteen Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to fourteen commands: exactly fourteen existing low-risk tool source files may be modified after Phase632 preflight, Phase2219A-2236A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fourteen files, local fourteen smoke, rollback evidence, earlier marker preservation, and Phase2242/Phase2243/Phase2244/Phase2245/Phase2246/Phase2247/Phase2248/Phase2249/Phase2250/Phase2251/Phase2252/Phase2253/Phase2254/Phase2255 marker emission are required; verifier must validate the applied fourteen batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2256A-2275A Controlled Fifteen Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to fifteen commands: exactly fifteen existing low-risk tool source files may be modified after Phase632 preflight, Phase2237A-2255A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifteen files, local fifteen smoke, rollback evidence, earlier marker preservation, and Phase2261/Phase2262/Phase2263/Phase2264/Phase2265/Phase2266/Phase2267/Phase2268/Phase2269/Phase2270/Phase2271/Phase2272/Phase2273/Phase2274/Phase2275 marker emission are required; verifier must validate the applied fifteen batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2276A-2296A Controlled Sixteen Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to sixteen commands: exactly sixteen existing low-risk tool source files may be modified after Phase632 preflight, Phase2256A-2275A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all sixteen files, local sixteen smoke, rollback evidence, earlier marker preservation, and Phase2281/Phase2282/Phase2283/Phase2284/Phase2285/Phase2286/Phase2287/Phase2288/Phase2289/Phase2290/Phase2291/Phase2292/Phase2293/Phase2294/Phase2295/Phase2296 marker emission are required; verifier must validate the applied sixteen batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2297A-2318A Controlled Seventeen Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to seventeen commands: exactly seventeen existing low-risk tool source files may be modified after Phase632 preflight, Phase2276A-2296A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all seventeen files, local seventeen smoke, rollback evidence, earlier marker preservation, and Phase2302/Phase2303/Phase2304/Phase2305/Phase2306/Phase2307/Phase2308/Phase2309/Phase2310/Phase2311/Phase2312/Phase2313/Phase2314/Phase2315/Phase2316/Phase2317/Phase2318 marker emission are required; verifier must validate the applied seventeen batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2319A-2341A Controlled Eighteen Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to eighteen commands: exactly eighteen existing low-risk tool source files may be modified after Phase632 preflight, Phase2297A-2318A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all eighteen files, local eighteen smoke, rollback evidence, earlier marker preservation, and Phase2324/Phase2325/Phase2326/Phase2327/Phase2328/Phase2329/Phase2330/Phase2331/Phase2332/Phase2333/Phase2334/Phase2335/Phase2336/Phase2337/Phase2338/Phase2339/Phase2340/Phase2341 marker emission are required; verifier must validate the applied eighteen batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2342A-2365A Controlled Nineteen Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to nineteen commands: exactly nineteen existing low-risk tool source files may be modified after Phase632 preflight, Phase2319A-2341A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all nineteen files, local nineteen smoke, rollback evidence, earlier marker preservation, and Phase2347/Phase2348/Phase2349/Phase2350/Phase2351/Phase2352/Phase2353/Phase2354/Phase2355/Phase2356/Phase2357/Phase2358/Phase2359/Phase2360/Phase2361/Phase2362/Phase2363/Phase2364/Phase2365 marker emission are required; verifier must validate the applied nineteen batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2366A-2390A Controlled Twenty Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty commands: exactly twenty existing low-risk tool source files may be modified after Phase632 preflight, Phase2342A-2365A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty files, local twenty smoke, rollback evidence, earlier marker preservation, and Phase2371/Phase2372/Phase2373/Phase2374/Phase2375/Phase2376/Phase2377/Phase2378/Phase2379/Phase2380/Phase2381/Phase2382/Phase2383/Phase2384/Phase2385/Phase2386/Phase2387/Phase2388/Phase2389/Phase2390 marker emission are required; verifier must validate the applied twenty batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2391A-2416A Controlled Twenty-One Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-one commands: exactly twenty-one existing low-risk tool source files may be modified after Phase632 preflight, Phase2366A-2390A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-one files, local twenty-one smoke, rollback evidence, earlier marker preservation, and Phase2396/Phase2397/Phase2398/Phase2399/Phase2400/Phase2401/Phase2402/Phase2403/Phase2404/Phase2405/Phase2406/Phase2407/Phase2408/Phase2409/Phase2410/Phase2411/Phase2412/Phase2413/Phase2414/Phase2415/Phase2416 marker emission are required; verifier must validate the applied twenty-one batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2417A-2443A Controlled Twenty-Two Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-two commands: exactly twenty-two existing low-risk tool source files may be modified after Phase632 preflight, Phase2391A-2416A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-two files, local twenty-two smoke, rollback evidence, earlier marker preservation, and Phase2422/Phase2423/Phase2424/Phase2425/Phase2426/Phase2427/Phase2428/Phase2429/Phase2430/Phase2431/Phase2432/Phase2433/Phase2434/Phase2435/Phase2436/Phase2437/Phase2438/Phase2439/Phase2440/Phase2441/Phase2442/Phase2443 marker emission are required; verifier must validate the applied twenty-two batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2444A-2471A Controlled Twenty-Three Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-three commands: exactly twenty-three existing low-risk tool source files may be modified after Phase632 preflight, Phase2417A-2443A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-three files, local twenty-three smoke, rollback evidence, earlier marker preservation, and Phase2449/Phase2450/Phase2451/Phase2452/Phase2453/Phase2454/Phase2455/Phase2456/Phase2457/Phase2458/Phase2459/Phase2460/Phase2461/Phase2462/Phase2463/Phase2464/Phase2465/Phase2466/Phase2467/Phase2468/Phase2469/Phase2470/Phase2471 marker emission are required; verifier must validate the applied twenty-three batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2472A-2500A Controlled Twenty-Four Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-four commands: exactly twenty-four existing low-risk tool source files may be modified after Phase632 preflight, Phase2444A-2471A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-four files, local twenty-four smoke, rollback evidence, earlier marker preservation, and Phase2477/Phase2478/Phase2479/Phase2480/Phase2481/Phase2482/Phase2483/Phase2484/Phase2485/Phase2486/Phase2487/Phase2488/Phase2489/Phase2490/Phase2491/Phase2492/Phase2493/Phase2494/Phase2495/Phase2496/Phase2497/Phase2498/Phase2499/Phase2500 marker emission are required; verifier must validate the applied twenty-four batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2501A-2530A Controlled Twenty-Five Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-five commands: exactly twenty-five existing low-risk tool source files may be modified after Phase632 preflight, Phase2472A-2500A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-five files, local twenty-five smoke, rollback evidence, earlier marker preservation, and Phase2506/Phase2507/Phase2508/Phase2509/Phase2510/Phase2511/Phase2512/Phase2513/Phase2514/Phase2515/Phase2516/Phase2517/Phase2518/Phase2519/Phase2520/Phase2521/Phase2522/Phase2523/Phase2524/Phase2525/Phase2526/Phase2527/Phase2528/Phase2529/Phase2530 marker emission are required; verifier must validate the applied twenty-five batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2531A-2561A Controlled Twenty-Six Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-six commands: exactly twenty-six existing low-risk tool source files may be modified after Phase632 preflight, Phase2501A-2530A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-six files, local twenty-six smoke, rollback evidence, earlier marker preservation, and Phase2536/Phase2537/Phase2538/Phase2539/Phase2540/Phase2541/Phase2542/Phase2543/Phase2544/Phase2545/Phase2546/Phase2547/Phase2548/Phase2549/Phase2550/Phase2551/Phase2552/Phase2553/Phase2554/Phase2555/Phase2556/Phase2557/Phase2558/Phase2559/Phase2560/Phase2561 marker emission are required; verifier must validate the applied twenty-six batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2562A-2593A Controlled Twenty-Seven Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-seven commands: exactly twenty-seven existing low-risk tool source files may be modified after Phase632 preflight, Phase2531A-2561A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-seven files, local twenty-seven smoke, rollback evidence, earlier marker preservation, and Phase2567/Phase2568/Phase2569/Phase2570/Phase2571/Phase2572/Phase2573/Phase2574/Phase2575/Phase2576/Phase2577/Phase2578/Phase2579/Phase2580/Phase2581/Phase2582/Phase2583/Phase2584/Phase2585/Phase2586/Phase2587/Phase2588/Phase2589/Phase2590/Phase2591/Phase2592/Phase2593 marker emission are required; verifier must validate the applied twenty-seven batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2594A-2626A Controlled Twenty-Eight Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-eight commands: exactly twenty-eight existing low-risk tool source files may be modified after Phase632 preflight, Phase2562A-2593A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-eight files, local twenty-eight smoke, rollback evidence, earlier marker preservation, and Phase2599/Phase2600/Phase2601/Phase2602/Phase2603/Phase2604/Phase2605/Phase2606/Phase2607/Phase2608/Phase2609/Phase2610/Phase2611/Phase2612/Phase2613/Phase2614/Phase2615/Phase2616/Phase2617/Phase2618/Phase2619/Phase2620/Phase2621/Phase2622/Phase2623/Phase2624/Phase2625/Phase2626 marker emission are required; verifier must validate the applied twenty-eight batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2627A-2660A Controlled Twenty-Nine Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to twenty-nine commands: exactly twenty-nine existing low-risk tool source files may be modified after Phase632 preflight, Phase2594A-2626A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all twenty-nine files, local twenty-nine smoke, rollback evidence, earlier marker preservation, and Phase2632/Phase2633/Phase2634/Phase2635/Phase2636/Phase2637/Phase2638/Phase2639/Phase2640/Phase2641/Phase2642/Phase2643/Phase2644/Phase2645/Phase2646/Phase2647/Phase2648/Phase2649/Phase2650/Phase2651/Phase2652/Phase2653/Phase2654/Phase2655/Phase2656/Phase2657/Phase2658/Phase2659/Phase2660 marker emission are required; verifier must validate the applied twenty-nine batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2661A-2695A Controlled Thirty Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty commands: exactly thirty existing low-risk tool source files may be modified after Phase632 preflight, Phase2627A-2660A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty files, local thirty smoke, rollback evidence, earlier marker preservation, and Phase2666/Phase2667/Phase2668/Phase2669/Phase2670/Phase2671/Phase2672/Phase2673/Phase2674/Phase2675/Phase2676/Phase2677/Phase2678/Phase2679/Phase2680/Phase2681/Phase2682/Phase2683/Phase2684/Phase2685/Phase2686/Phase2687/Phase2688/Phase2689/Phase2690/Phase2691/Phase2692/Phase2693/Phase2694/Phase2695 marker emission are required; verifier must validate the applied thirty batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2696A-2731A Controlled Thirty-One Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-one commands: exactly thirty-one existing low-risk tool source files may be modified after Phase632 preflight, Phase2661A-2695A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-one files, local thirty-one smoke, rollback evidence, earlier marker preservation, and Phase2701/Phase2702/Phase2703/Phase2704/Phase2705/Phase2706/Phase2707/Phase2708/Phase2709/Phase2710/Phase2711/Phase2712/Phase2713/Phase2714/Phase2715/Phase2716/Phase2717/Phase2718/Phase2719/Phase2720/Phase2721/Phase2722/Phase2723/Phase2724/Phase2725/Phase2726/Phase2727/Phase2728/Phase2729/Phase2730/Phase2731 marker emission are required; verifier must validate the applied thirty-one batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2732A-2768A Controlled Thirty-Two Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-two commands: exactly thirty-two existing low-risk tool source files may be modified after Phase632 preflight, Phase2696A-2731A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-two files, local thirty-two smoke, rollback evidence, earlier marker preservation, and Phase2737/Phase2738/Phase2739/Phase2740/Phase2741/Phase2742/Phase2743/Phase2744/Phase2745/Phase2746/Phase2747/Phase2748/Phase2749/Phase2750/Phase2751/Phase2752/Phase2753/Phase2754/Phase2755/Phase2756/Phase2757/Phase2758/Phase2759/Phase2760/Phase2761/Phase2762/Phase2763/Phase2764/Phase2765/Phase2766/Phase2767/Phase2768 marker emission are required; verifier must validate the applied thirty-two batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2769A-2806A Controlled Thirty-Three Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-three commands: exactly thirty-three existing low-risk tool source files may be modified after Phase632 preflight, Phase2732A-2768A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-three files, local thirty-three smoke, rollback evidence, earlier marker preservation, and Phase2774/Phase2775/Phase2776/Phase2777/Phase2778/Phase2779/Phase2780/Phase2781/Phase2782/Phase2783/Phase2784/Phase2785/Phase2786/Phase2787/Phase2788/Phase2789/Phase2790/Phase2791/Phase2792/Phase2793/Phase2794/Phase2795/Phase2796/Phase2797/Phase2798/Phase2799/Phase2800/Phase2801/Phase2802/Phase2803/Phase2804/Phase2805/Phase2806 marker emission are required; verifier must validate the applied thirty-three batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2807A-2845A Controlled Thirty-Four Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-four commands: exactly thirty-four existing low-risk tool source files may be modified after Phase632 preflight, Phase2769A-2806A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-four files, local thirty-four smoke, rollback evidence, earlier marker preservation, and Phase2812/Phase2813/Phase2814/Phase2815/Phase2816/Phase2817/Phase2818/Phase2819/Phase2820/Phase2821/Phase2822/Phase2823/Phase2824/Phase2825/Phase2826/Phase2827/Phase2828/Phase2829/Phase2830/Phase2831/Phase2832/Phase2833/Phase2834/Phase2835/Phase2836/Phase2837/Phase2838/Phase2839/Phase2840/Phase2841/Phase2842/Phase2843/Phase2844/Phase2845 marker emission are required; verifier must validate the applied thirty-four batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2846A-2885A Controlled Thirty-Five Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-five commands: exactly thirty-five existing low-risk tool source files may be modified after Phase632 preflight, Phase2807A-2845A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-five files, local thirty-five smoke, rollback evidence, earlier marker preservation, and Phase2851/Phase2852/Phase2853/Phase2854/Phase2855/Phase2856/Phase2857/Phase2858/Phase2859/Phase2860/Phase2861/Phase2862/Phase2863/Phase2864/Phase2865/Phase2866/Phase2867/Phase2868/Phase2869/Phase2870/Phase2871/Phase2872/Phase2873/Phase2874/Phase2875/Phase2876/Phase2877/Phase2878/Phase2879/Phase2880/Phase2881/Phase2882/Phase2883/Phase2884/Phase2885 marker emission are required; verifier must validate the applied thirty-five batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2886A-2926A Controlled Thirty-Six Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-six commands: exactly thirty-six existing low-risk tool source files may be modified after Phase632 preflight, Phase2846A-2885A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-six files, local thirty-six smoke, rollback evidence, earlier marker preservation, and Phase2891/Phase2892/Phase2893/Phase2894/Phase2895/Phase2896/Phase2897/Phase2898/Phase2899/Phase2900/Phase2901/Phase2902/Phase2903/Phase2904/Phase2905/Phase2906/Phase2907/Phase2908/Phase2909/Phase2910/Phase2911/Phase2912/Phase2913/Phase2914/Phase2915/Phase2916/Phase2917/Phase2918/Phase2919/Phase2920/Phase2921/Phase2922/Phase2923/Phase2924/Phase2925/Phase2926 marker emission are required; verifier must validate the applied thirty-six batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2927A-2968A Controlled Thirty-Seven Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-seven commands: exactly thirty-seven existing low-risk tool source files may be modified after Phase632 preflight, Phase2886A-2926A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-seven files, local thirty-seven smoke, rollback evidence, earlier marker preservation, and Phase2932/Phase2933/Phase2934/Phase2935/Phase2936/Phase2937/Phase2938/Phase2939/Phase2940/Phase2941/Phase2942/Phase2943/Phase2944/Phase2945/Phase2946/Phase2947/Phase2948/Phase2949/Phase2950/Phase2951/Phase2952/Phase2953/Phase2954/Phase2955/Phase2956/Phase2957/Phase2958/Phase2959/Phase2960/Phase2961/Phase2962/Phase2963/Phase2964/Phase2965/Phase2966/Phase2967/Phase2968 marker emission are required; verifier must validate the applied thirty-seven batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase2969A-3011A Controlled Thirty-Eight Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-eight commands: exactly thirty-eight existing low-risk tool source files may be modified after Phase632 preflight, Phase2927A-2968A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-eight files, local thirty-eight smoke, rollback evidence, earlier marker preservation, and Phase2974/Phase2975/Phase2976/Phase2977/Phase2978/Phase2979/Phase2980/Phase2981/Phase2982/Phase2983/Phase2984/Phase2985/Phase2986/Phase2987/Phase2988/Phase2989/Phase2990/Phase2991/Phase2992/Phase2993/Phase2994/Phase2995/Phase2996/Phase2997/Phase2998/Phase2999/Phase3000/Phase3001/Phase3002/Phase3003/Phase3004/Phase3005/Phase3006/Phase3007/Phase3008/Phase3009/Phase3010/Phase3011 marker emission are required; verifier must validate the applied thirty-eight batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3012A-3055A Controlled Thirty-Nine Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to thirty-nine commands: exactly thirty-nine existing low-risk tool source files may be modified after Phase632 preflight, Phase2969A-3011A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all thirty-nine files, local thirty-nine smoke, rollback evidence, earlier marker preservation, and Phase3017/Phase3018/Phase3019/Phase3020/Phase3021/Phase3022/Phase3023/Phase3024/Phase3025/Phase3026/Phase3027/Phase3028/Phase3029/Phase3030/Phase3031/Phase3032/Phase3033/Phase3034/Phase3035/Phase3036/Phase3037/Phase3038/Phase3039/Phase3040/Phase3041/Phase3042/Phase3043/Phase3044/Phase3045/Phase3046/Phase3047/Phase3048/Phase3049/Phase3050/Phase3051/Phase3052/Phase3053/Phase3054/Phase3055 marker emission are required; verifier must validate the applied thirty-nine batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3056A-3100A Controlled Forty Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to forty commands: exactly forty existing low-risk tool source files may be modified after Phase632 preflight, Phase3012A-3055A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty files, local forty smoke, rollback evidence, earlier marker preservation, and Phase3061/Phase3062/Phase3063/Phase3064/Phase3065/Phase3066/Phase3067/Phase3068/Phase3069/Phase3070/Phase3071/Phase3072/Phase3073/Phase3074/Phase3075/Phase3076/Phase3077/Phase3078/Phase3079/Phase3080/Phase3081/Phase3082/Phase3083/Phase3084/Phase3085/Phase3086/Phase3087/Phase3088/Phase3089/Phase3090/Phase3091/Phase3092/Phase3093/Phase3094/Phase3095/Phase3096/Phase3097/Phase3098/Phase3099/Phase3100 marker emission are required; verifier must validate the applied forty batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3101A-3146A Controlled Forty-One Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to forty-one commands: exactly forty-one existing low-risk tool source files may be modified after Phase632 preflight, Phase3056A-3100A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-one files, local forty-one smoke, rollback evidence, earlier marker preservation, and Phase3106/Phase3107/Phase3108/Phase3109/Phase3110/Phase3111/Phase3112/Phase3113/Phase3114/Phase3115/Phase3116/Phase3117/Phase3118/Phase3119/Phase3120/Phase3121/Phase3122/Phase3123/Phase3124/Phase3125/Phase3126/Phase3127/Phase3128/Phase3129/Phase3130/Phase3131/Phase3132/Phase3133/Phase3134/Phase3135/Phase3136/Phase3137/Phase3138/Phase3139/Phase3140/Phase3141/Phase3142/Phase3143/Phase3144/Phase3145/Phase3146 marker emission are required; verifier must validate the applied forty-one batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3147A-3193A Controlled Forty-Two Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to forty-two commands: exactly forty-two existing low-risk tool source files may be modified after Phase632 preflight, Phase3101A-3146A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-two files, local forty-two smoke, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3152/Phase3153/Phase3154/Phase3155/Phase3156/Phase3157/Phase3158/Phase3159/Phase3160/Phase3161/Phase3162/Phase3163/Phase3164/Phase3165/Phase3166/Phase3167/Phase3168/Phase3169/Phase3170/Phase3171/Phase3172/Phase3173/Phase3174/Phase3175/Phase3176/Phase3177/Phase3178/Phase3179/Phase3180/Phase3181/Phase3182/Phase3183/Phase3184/Phase3185/Phase3186/Phase3187/Phase3188/Phase3189/Phase3190/Phase3191/Phase3192/Phase3193 marker emission are required; verifier must validate the applied forty-two batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3194A-3241A Controlled Forty-Three Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to forty-three commands: exactly forty-three existing low-risk tool source files may be modified after Phase632 preflight, Phase3147A-3193A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-three files, local forty-three smoke, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3199/Phase3200/Phase3201/Phase3202/Phase3203/Phase3204/Phase3205/Phase3206/Phase3207/Phase3208/Phase3209/Phase3210/Phase3211/Phase3212/Phase3213/Phase3214/Phase3215/Phase3216/Phase3217/Phase3218/Phase3219/Phase3220/Phase3221/Phase3222/Phase3223/Phase3224/Phase3225/Phase3226/Phase3227/Phase3228/Phase3229/Phase3230/Phase3231/Phase3232/Phase3233/Phase3234/Phase3235/Phase3236/Phase3237/Phase3238/Phase3239/Phase3240/Phase3241 marker emission are required; verifier must validate the applied forty-three batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3242A-3290A Controlled Forty-Four Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to forty-four commands: exactly forty-four existing low-risk tool source files may be modified after Phase632 preflight, Phase3194A-3241A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-four files, local forty-four smoke, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3247/Phase3248/Phase3249/Phase3250/Phase3251/Phase3252/Phase3253/Phase3254/Phase3255/Phase3256/Phase3257/Phase3258/Phase3259/Phase3260/Phase3261/Phase3262/Phase3263/Phase3264/Phase3265/Phase3266/Phase3267/Phase3268/Phase3269/Phase3270/Phase3271/Phase3272/Phase3273/Phase3274/Phase3275/Phase3276/Phase3277/Phase3278/Phase3279/Phase3280/Phase3281/Phase3282/Phase3283/Phase3284/Phase3285/Phase3286/Phase3287/Phase3288/Phase3289/Phase3290 marker emission are required; verifier must validate the applied forty-four batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3291A-3340A Controlled Forty-Five Tool Mutation keeps real batch source mutation narrow while expanding the JSON smoke helper to forty-five commands: exactly forty-five existing low-risk tool source files may be modified after Phase632 preflight, Phase3242A-3290A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-five files, local forty-five smoke, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3296/Phase3297/Phase3298/Phase3299/Phase3300/Phase3301/Phase3302/Phase3303/Phase3304/Phase3305/Phase3306/Phase3307/Phase3308/Phase3309/Phase3310/Phase3311/Phase3312/Phase3313/Phase3314/Phase3315/Phase3316/Phase3317/Phase3318/Phase3319/Phase3320/Phase3321/Phase3322/Phase3323/Phase3324/Phase3325/Phase3326/Phase3327/Phase3328/Phase3329/Phase3330/Phase3331/Phase3332/Phase3333/Phase3334/Phase3335/Phase3336/Phase3337/Phase3338/Phase3339/Phase3340 marker emission are required; verifier must validate the applied forty-five batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3341A-3391A Controlled Forty-Six Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to forty-six files: exactly forty-six existing low-risk tool source files may be modified after Phase632 preflight, Phase3291A-3340A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-six files, local forty-six smoke through `tools/phase3341_3391/smoke-controlled-forty-six-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3346/Phase3347/Phase3348/Phase3349/Phase3350/Phase3351/Phase3352/Phase3353/Phase3354/Phase3355/Phase3356/Phase3357/Phase3358/Phase3359/Phase3360/Phase3361/Phase3362/Phase3363/Phase3364/Phase3365/Phase3366/Phase3367/Phase3368/Phase3369/Phase3370/Phase3371/Phase3372/Phase3373/Phase3374/Phase3375/Phase3376/Phase3377/Phase3378/Phase3379/Phase3380/Phase3381/Phase3382/Phase3383/Phase3384/Phase3385/Phase3386/Phase3387/Phase3388/Phase3389/Phase3390/Phase3391 marker emission are required; verifier must validate the applied forty-six batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3392A-3443A Controlled Forty-Seven Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to forty-seven files: exactly forty-seven existing low-risk tool source files may be modified after Phase632 preflight, Phase3341A-3391A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-seven files, local forty-seven smoke through `tools/phase3392_3443/smoke-controlled-forty-seven-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3397/Phase3398/Phase3399/Phase3400/Phase3401/Phase3402/Phase3403/Phase3404/Phase3405/Phase3406/Phase3407/Phase3408/Phase3409/Phase3410/Phase3411/Phase3412/Phase3413/Phase3414/Phase3415/Phase3416/Phase3417/Phase3418/Phase3419/Phase3420/Phase3421/Phase3422/Phase3423/Phase3424/Phase3425/Phase3426/Phase3427/Phase3428/Phase3429/Phase3430/Phase3431/Phase3432/Phase3433/Phase3434/Phase3435/Phase3436/Phase3437/Phase3438/Phase3439/Phase3440/Phase3441/Phase3442/Phase3443 marker emission are required; verifier must validate the applied forty-seven batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3444A-3496A Controlled Forty-Eight Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to forty-eight files: exactly forty-eight existing low-risk tool source files may be modified after Phase632 preflight, Phase3392A-3443A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-eight files, local forty-eight smoke through `tools/phase3444_3496/smoke-controlled-forty-eight-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3449/Phase3450/Phase3451/Phase3452/Phase3453/Phase3454/Phase3455/Phase3456/Phase3457/Phase3458/Phase3459/Phase3460/Phase3461/Phase3462/Phase3463/Phase3464/Phase3465/Phase3466/Phase3467/Phase3468/Phase3469/Phase3470/Phase3471/Phase3472/Phase3473/Phase3474/Phase3475/Phase3476/Phase3477/Phase3478/Phase3479/Phase3480/Phase3481/Phase3482/Phase3483/Phase3484/Phase3485/Phase3486/Phase3487/Phase3488/Phase3489/Phase3490/Phase3491/Phase3492/Phase3493/Phase3494/Phase3495/Phase3496 marker emission are required; verifier must validate the applied forty-eight batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3497A-3550A Controlled Forty-Nine Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to forty-nine files: exactly forty-nine existing low-risk tool source files may be modified after Phase632 preflight, Phase3444A-3496A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all forty-nine files, local forty-nine smoke through `tools/phase3497_3550/smoke-controlled-forty-nine-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3502/Phase3503/Phase3504/Phase3505/Phase3506/Phase3507/Phase3508/Phase3509/Phase3510/Phase3511/Phase3512/Phase3513/Phase3514/Phase3515/Phase3516/Phase3517/Phase3518/Phase3519/Phase3520/Phase3521/Phase3522/Phase3523/Phase3524/Phase3525/Phase3526/Phase3527/Phase3528/Phase3529/Phase3530/Phase3531/Phase3532/Phase3533/Phase3534/Phase3535/Phase3536/Phase3537/Phase3538/Phase3539/Phase3540/Phase3541/Phase3542/Phase3543/Phase3544/Phase3545/Phase3546/Phase3547/Phase3548/Phase3549/Phase3550 marker emission are required; verifier must validate the applied forty-nine batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3551A-3605A Controlled Fifty Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to fifty files: exactly fifty existing low-risk tool source files may be modified after Phase632 preflight, Phase3497A-3550A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifty files, local fifty smoke through `tools/phase3551_3605/smoke-controlled-fifty-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3556/Phase3557/Phase3558/Phase3559/Phase3560/Phase3561/Phase3562/Phase3563/Phase3564/Phase3565/Phase3566/Phase3567/Phase3568/Phase3569/Phase3570/Phase3571/Phase3572/Phase3573/Phase3574/Phase3575/Phase3576/Phase3577/Phase3578/Phase3579/Phase3580/Phase3581/Phase3582/Phase3583/Phase3584/Phase3585/Phase3586/Phase3587/Phase3588/Phase3589/Phase3590/Phase3591/Phase3592/Phase3593/Phase3594/Phase3595/Phase3596/Phase3597/Phase3598/Phase3599/Phase3600/Phase3601/Phase3602/Phase3603/Phase3604/Phase3605 marker emission are required; verifier must validate the applied fifty batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3606A-3661A Controlled Fifty-One Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to fifty-one files: exactly fifty-one existing low-risk tool source files may be modified after Phase632 preflight, Phase3551A-3605A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifty-one files, local fifty-one smoke through `tools/phase3606_3661/smoke-controlled-fifty-one-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3611/Phase3612/Phase3613/Phase3614/Phase3615/Phase3616/Phase3617/Phase3618/Phase3619/Phase3620/Phase3621/Phase3622/Phase3623/Phase3624/Phase3625/Phase3626/Phase3627/Phase3628/Phase3629/Phase3630/Phase3631/Phase3632/Phase3633/Phase3634/Phase3635/Phase3636/Phase3637/Phase3638/Phase3639/Phase3640/Phase3641/Phase3642/Phase3643/Phase3644/Phase3645/Phase3646/Phase3647/Phase3648/Phase3649/Phase3650/Phase3651/Phase3652/Phase3653/Phase3654/Phase3655/Phase3656/Phase3657/Phase3658/Phase3659/Phase3660/Phase3661 marker emission are required; verifier must validate the applied fifty-one batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3662A-3718A Controlled Fifty-Two Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to fifty-two files: exactly fifty-two existing low-risk tool source files may be modified after Phase632 preflight, Phase3606A-3661A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifty-two files, local fifty-two smoke through `tools/phase3662_3718/smoke-controlled-fifty-two-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3667/Phase3668/Phase3669/Phase3670/Phase3671/Phase3672/Phase3673/Phase3674/Phase3675/Phase3676/Phase3677/Phase3678/Phase3679/Phase3680/Phase3681/Phase3682/Phase3683/Phase3684/Phase3685/Phase3686/Phase3687/Phase3688/Phase3689/Phase3690/Phase3691/Phase3692/Phase3693/Phase3694/Phase3695/Phase3696/Phase3697/Phase3698/Phase3699/Phase3700/Phase3701/Phase3702/Phase3703/Phase3704/Phase3705/Phase3706/Phase3707/Phase3708/Phase3709/Phase3710/Phase3711/Phase3712/Phase3713/Phase3714/Phase3715/Phase3716/Phase3717/Phase3718 marker emission are required; verifier must validate the applied fifty-two batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3719A-3776A Controlled Fifty-Three Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to fifty-three files: exactly fifty-three existing low-risk tool source files may be modified after Phase632 preflight, Phase3662A-3718A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifty-three files, local fifty-three smoke through `tools/phase3719_3776/smoke-controlled-fifty-three-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3724/Phase3725/Phase3726/Phase3727/Phase3728/Phase3729/Phase3730/Phase3731/Phase3732/Phase3733/Phase3734/Phase3735/Phase3736/Phase3737/Phase3738/Phase3739/Phase3740/Phase3741/Phase3742/Phase3743/Phase3744/Phase3745/Phase3746/Phase3747/Phase3748/Phase3749/Phase3750/Phase3751/Phase3752/Phase3753/Phase3754/Phase3755/Phase3756/Phase3757/Phase3758/Phase3759/Phase3760/Phase3761/Phase3762/Phase3763/Phase3764/Phase3765/Phase3766/Phase3767/Phase3768/Phase3769/Phase3770/Phase3771/Phase3772/Phase3773/Phase3774/Phase3775/Phase3776 marker emission are required; verifier must validate the applied fifty-three batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3777A-3835A Controlled Fifty-Four Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to fifty-four files: exactly fifty-four existing low-risk tool source files may be modified after Phase632 preflight, Phase3719A-3776A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifty-four files, local fifty-four smoke through `tools/phase3777_3835/smoke-controlled-fifty-four-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3782/Phase3783/Phase3784/Phase3785/Phase3786/Phase3787/Phase3788/Phase3789/Phase3790/Phase3791/Phase3792/Phase3793/Phase3794/Phase3795/Phase3796/Phase3797/Phase3798/Phase3799/Phase3800/Phase3801/Phase3802/Phase3803/Phase3804/Phase3805/Phase3806/Phase3807/Phase3808/Phase3809/Phase3810/Phase3811/Phase3812/Phase3813/Phase3814/Phase3815/Phase3816/Phase3817/Phase3818/Phase3819/Phase3820/Phase3821/Phase3822/Phase3823/Phase3824/Phase3825/Phase3826/Phase3827/Phase3828/Phase3829/Phase3830/Phase3831/Phase3832/Phase3833/Phase3834/Phase3835 marker emission are required; verifier must validate the applied fifty-four batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3836A-3895A Controlled Fifty-Five Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to fifty-five files: exactly fifty-five existing low-risk tool source files may be modified after Phase632 preflight, Phase3777A-3835A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifty-five files, local fifty-five smoke through `tools/phase3836_3895/smoke-controlled-fifty-five-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3841/Phase3842/Phase3843/Phase3844/Phase3845/Phase3846/Phase3847/Phase3848/Phase3849/Phase3850/Phase3851/Phase3852/Phase3853/Phase3854/Phase3855/Phase3856/Phase3857/Phase3858/Phase3859/Phase3860/Phase3861/Phase3862/Phase3863/Phase3864/Phase3865/Phase3866/Phase3867/Phase3868/Phase3869/Phase3870/Phase3871/Phase3872/Phase3873/Phase3874/Phase3875/Phase3876/Phase3877/Phase3878/Phase3879/Phase3880/Phase3881/Phase3882/Phase3883/Phase3884/Phase3885/Phase3886/Phase3887/Phase3888/Phase3889/Phase3890/Phase3891/Phase3892/Phase3893/Phase3894/Phase3895 marker emission are required; verifier must validate the applied fifty-five batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3896A-3956A Controlled Fifty-Six Tool Mutation keeps real batch source mutation narrow while expanding the local mutation line to fifty-six files: exactly fifty-six existing low-risk tool source files may be modified after Phase632 preflight, Phase3836A-3895A seal, approvalRecord, allowedFiles, forbiddenPaths, and expected pre-mutation SHA values pass; `node --check` for all fifty-six files, local fifty-six smoke through `tools/phase3896_3956/smoke-controlled-fifty-six-tool-mutation.mjs`, rollback evidence, idempotent reapply evidence, earlier marker preservation, and Phase3901/Phase3902/Phase3903/Phase3904/Phase3905/Phase3906/Phase3907/Phase3908/Phase3909/Phase3910/Phase3911/Phase3912/Phase3913/Phase3914/Phase3915/Phase3916/Phase3917/Phase3918/Phase3919/Phase3920/Phase3921/Phase3922/Phase3923/Phase3924/Phase3925/Phase3926/Phase3927/Phase3928/Phase3929/Phase3930/Phase3931/Phase3932/Phase3933/Phase3934/Phase3935/Phase3936/Phase3937/Phase3938/Phase3939/Phase3940/Phase3941/Phase3942/Phase3943/Phase3944/Phase3945/Phase3946/Phase3947/Phase3948/Phase3949/Phase3950/Phase3951/Phase3952/Phase3953/Phase3954/Phase3955/Phase3956 marker emission are required; verifier must validate the applied fifty-six batch and must not execute Codex or call Providers; create/delete/rename/binary/unapproved multi-file diffs, unsafe text, secrets/auth.json/.env reads, Codex config/base_url writes, provider runtime, `/chat`, `/chat-gateway/execute`, deploy, release, tag, artifact, push, commit, legacy, PROJECT_CONTEXT.md, and workspace-clean claims remain blocked.
- Phase3957A Controlled Mutation Expansion Hard Stop caps controlled mutation expansion at 56 files: further file-count expansion is blocked by default, Phase3957A-4017A controlled fifty-seven tool mutation must not be generated, no 57th mutation target or Phase3957-4017 tool-source marker may be added, and any future expansion requires Product Work Value Gate approval with non-empty valueClass and expectedUserValue; marker-only, managed-block-only, or changedFileCount-only expansion is rejected while Product Work Mode, Product Reality, Owner Daily Use, provider stability, UI usability, or Self Evolution Governance blockers remain unresolved.
- Phase3958A Product Reality Baseline Compression keeps the 56-file hard cap active and redirects work to product reality: it may generate docs/evidence/verifiers and README/AGENTS managed wording only, must not create Phase3958A-4018A controlled mutation expansion, must not add a 57th mutation target, must not write Phase3958-4018 controlled mutation markers into tool source, and must clearly separate evidence-backed capabilities from dry-run/mock/template/governance artifacts while listing at most 10 Product Work Mode next phases.
- Phase606R Open Source Minimum Readiness Lock may document clone/read/dry-run demo readiness only; it must not call real Providers, read secrets/webhooks/raw endpoint values, write Codex config, modify `/chat` or `/chat-gateway/execute`, deploy, release, tag, upload artifacts, or claim production/open-source release completion.
- Phase607R Public Repo Hygiene Preflight may update public-preflight docs, `.gitignore`, README/AGENTS managed wording, verifier, and evidence only; it must not publish, deploy, release, tag, upload artifacts, push, commit, call Providers, read secrets/webhooks/raw endpoint values, write Codex config, or modify `/chat` or `/chat-gateway/execute`.
- Phase607R-AutoScale through Phase610R Public Readiness Acceleration may generate docs/evidence/verifiers and run local low/medium-safe dry-run checks only; high-risk tasks remain gate-only, releaseCandidateReady may be false, and deploy/release/tag/artifact/push/commit/provider/secret/Codex-config/chat mutations remain blocked.
- Deployment, release, tag creation, and artifact upload remain blocked unless separately authorized.
<!-- END UNIFIED_AI_SYSTEM_AGENT_RULES -->

## Current Local Operation Rules

- Every local operation must use a permission mode.
- `approvalRecord` is required before apply.
- `allowedFiles` is required before apply.
- `forbiddenPaths` must block `legacy/`, `PROJECT_CONTEXT.md`, `.env`, `.git`,
  and `node_modules`.
- `dryRun` defaults on unless explicitly approved otherwise.
- `full_open` is disabled.
- `autoCommit=false`.
- `autoPush=false`.
- release and deploy are blocked.

## UI Rules

- User-facing local operation panels must be visible, not hidden only in side
  panels.
- Chat output area must remain large enough for long responses.
- Compact controls are preferred.

## Verification Rules

- `node --check` modified JS files.
- `verify:phase303a-305a-ui-ready-approved-local-operation-loop`
- `verify:phase302a-intent-explanation-approval-preview`
- `verify:phase301a-chat-to-local-agent-intent-preview`
- `verify:phase299a-local-agent-operator-preview-panel`
- `verify:phase297a-298a-approved-patch-auto-review-loop`
- `verify:phase296a-read-only-local-agent-runner`
- `verify:phase295a-local-agent-permission-mode-gate`
- `verify:phase294a-safe-refactor-harness`
- `verify:safe-regression-matrix`
- `verify:phase107a-secret-safety`
- `health:phase12a`
- `doctor:phase13a`
- `pnpm -r --if-present check`

## Evidence Rules

- Do not claim pass if the verifier chain is blocked.
- Do not claim clean workspace.
- If a verifier refreshes unrelated evidence, report it as a verifier side
  effect.

## Phase 209A-220A Codex Result Bridge Boundary

Phase 209A-220A is verified by:

```powershell
cmd /c pnpm run verify:phase209a-codex-result-inbox-contract
cmd /c pnpm run verify:phase210a-codex-result-import-script
cmd /c pnpm run verify:phase211a-codex-feedback-outbox-generator
cmd /c pnpm run verify:phase212a-roundtrip-manual-bridge-trial
cmd /c pnpm run verify:phase213a-optional-codex-exec-capture-design
cmd /c pnpm run verify:phase214a-codex-feedback-loop-closure
cmd /c pnpm run verify:phase215a-controlled-codex-exec-runner-script
cmd /c pnpm run verify:phase216a-codex-loop-safety-gate
cmd /c pnpm run verify:phase217a-codex-loop-dry-run-trial
cmd /c pnpm run verify:phase218a-codex-loop-one-shot-real-trial
cmd /c pnpm run verify:phase219a-continuous-loop-policy-freeze
cmd /c pnpm run verify:phase220a-codex-continuous-loop-closure
```

This batch adds a local file bridge for Codex results and a controlled
`codex exec` dry-run loop. Default mode must remain dry-run / disabled /
manual bridge. Do not modify `legacy/`, do not create `PROJECT_CONTEXT.md`,
do not change the default NVIDIA `/chat` lane, do not call oh-my-codex / OMX /
team / ralph, do not create worktrees by default, do not connect workflow run,
do not automatically commit or push, do not automatically apply external
patches, and do not write plaintext API keys to logs, evidence, handoff,
inbox, review, or run files.

Real `codex exec` is allowed only when the user explicitly runs the one-shot
command and the safety gate passes. Phase 218A must record
`skipped-not-enabled` when explicit real-run permission is absent; it must not
pretend that Codex was called.

## Phase 200A-204A Codex Manual Handoff Boundary

Phase 200A is verified by:

```powershell
cmd /c pnpm run verify:phase200a-real-ui-trial-final-seal
```

It seals the Phase 199A `passed-browser-ui-trial` result. It does not add
runtime capability.

Phase 201A-204A are verified by:

```powershell
cmd /c pnpm run verify:phase201a-codex-desktop-handoff-pack
cmd /c pnpm run verify:phase202a-manual-codex-execution-loop
cmd /c pnpm run verify:phase203a-codex-result-import-review
cmd /c pnpm run verify:phase204a-safe-desktop-runner-design
```

They add manual handoff / preview / design-only Codex surfaces. Do not
describe them as automatic Codex execution, runner implementation, workflow
run integration, worktree creation, or real external runner dispatch. The web
service must not call Codex CLI, oh-my-codex, OMX CLI, team, or ralph. It must
not automatically apply, merge, commit, or push Codex results. approval-preview
remains review metadata only and is not execution approval.

## Phase 205A-208A Desktop Handoff Automation Boundary

Phase 205A-208A may add the local helper script
`tools/agent-workforce/pull-codex-handoff.ps1` and root shortcuts such as:

```powershell
cmd /c pnpm run handoff:codex
```

The helper may call the local service, read the latest saved Agent Workforce
Plan export, write `.codex-handoff/latest-codex-handoff.md`,
`.codex-handoff/latest-codex-handoff.json`, and
`.codex-handoff/latest-metadata.json`, and copy Markdown to the Windows
clipboard. It must not auto-run Codex, must not call `codex exec`, must not
pass a task prompt to Codex, must not create worktrees, must not connect
workflow run, must not add real external runner dispatch, and must not apply,
merge, commit, or push changes. If `handoff:codex:app` is used, it may only
attempt to open Codex for a human to paste manually.

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

## Phase 130A GitHub Actions Node 24 Warning Cleanup Boundary

Phase 130A is verified by:

```powershell
cmd /c pnpm verify:phase130a-actions-node24-warning-cleanup
```

It only updates the existing GitHub Actions release gate to Node 24 action
versions to clean up the non-blocking Node.js 20 deprecation warning. It must
preserve the existing release-readiness checks and must not create GitHub
Releases, publish packages, publish container images, deploy cloud
infrastructure, expose public production access, enable real multi-agent
execution, or claim global release complete.

## Phase 131A Release Artifact Preflight Boundary

Phase 131A is verified by:

```powershell
cmd /c pnpm verify:phase131a-release-artifact-preflight
```

It records GitHub Release and artifact readiness as a read-only preflight only.
It may inspect repository state, latest remote Release Gate state, local git
tags, existing GitHub Releases, release preflight documentation, and workflow
publish/deploy markers. It must not create git tags, create GitHub Releases,
upload release artifacts, publish packages, publish container images, deploy
cloud infrastructure, expose public production access, enable real multi-agent
execution, or claim global release complete.

## Phase 132A Release Decision Pack Boundary

Phase 132A is verified by:

```powershell
cmd /c pnpm verify:phase132a-release-decision-pack
```

It records a draft release version, tag, title, prerelease/draft posture, and
release notes text in `docs/RELEASE_DECISION_PACK.md`. It is a read-only
decision pack only. It must not create git tags, create GitHub Releases, upload
release artifacts, publish packages, publish container images, deploy cloud
infrastructure, expose public production access, enable real multi-agent
execution, or claim global release complete.

## Phase 133A Release Creation Confirmation Boundary

Phase 133A is verified by:

```powershell
cmd /c pnpm verify:phase133a-release-creation-confirmation
```

It records the final read-only confirmation pack before any real GitHub Release
creation in `docs/RELEASE_CREATION_CONFIRMATION.md`. It may inspect repository
state, latest remote Release Gate state, local and remote candidate tags,
existing GitHub Releases, and the required user confirmation phrase. It must
not create git tags, create GitHub Releases, upload release artifacts, publish
packages, publish container images, deploy cloud infrastructure, expose public
production access, enable real multi-agent execution, or claim global release
complete.

## Phase 134A Release Creation Execution Boundary

Phase 134A is verified by:

```powershell
cmd /c pnpm verify:phase134a-release-creation-execution
```

It creates the candidate git tag `v0.1.0-rc.1` and the GitHub draft prerelease
for that tag after explicit user confirmation. It may verify local and remote
tag state, the draft prerelease state, release target gate success, and release
execution evidence. It must not publish the draft release, upload release
artifacts, publish packages, publish container images, deploy cloud
infrastructure, expose public production access, enable real multi-agent
execution, or claim global release complete.

## Phase 135A Release Publish Preflight Boundary

Phase 135A is verified by:

```powershell
cmd /c pnpm verify:phase135a-release-publish-preflight
```

It records the read-only preflight before publishing the existing
`v0.1.0-rc.1` GitHub draft prerelease or uploading assets. It may verify the
draft prerelease state, asset count, local and remote tag state, latest Release
Gate status, release target gate status, and required explicit confirmation
phrases. It must not publish the draft release, upload release artifacts,
publish packages, publish container images, deploy cloud infrastructure, expose
public production access, enable real multi-agent execution, or claim global
release complete.

## Phase 136A Release Publish Execution Boundary

Phase 136A is verified by:

```powershell
cmd /c pnpm verify:phase136a-release-publish-execution
```

It publishes the existing GitHub prerelease `v0.1.0-rc.1` after explicit user
confirmation. It may verify the release is no longer a draft, remains a
prerelease, has a `publishedAt` timestamp, still has no assets, and preserves
local/remote tag state and release-gate evidence. It must not upload release
artifacts, publish packages, publish container images, deploy cloud
infrastructure, expose public production access, enable real multi-agent
execution, or claim global release complete.

## Phase 137A Release Draft Rollback Boundary

Phase 137A is verified by:

```powershell
cmd /c pnpm verify:phase137a-release-draft-rollback
```

It rolls the existing GitHub prerelease `v0.1.0-rc.1` back to draft state after
explicit user confirmation. It may verify the release is draft again, remains a
prerelease, keeps the tag and target commit, has no assets, and records that
GitHub may retain the historical `publishedAt` timestamp. It must not delete
the GitHub Release, delete the git tag, upload release artifacts, publish
packages, publish container images, deploy cloud infrastructure, expose public
production access, enable real multi-agent execution, or claim global release
complete.

## Phase 138A Agent Workforce OMX Benchmark Boundary

Phase 138A is verified by:

```powershell
cmd /c pnpm verify:phase138a-agent-workforce-omx-benchmark
```

It records a read-only `oh-my-codex` benchmark for Agent Workforce next-stage
design in `docs/AGENT_WORKFORCE_OMX_BENCHMARK.md`. It may cite public OMX
capabilities such as clarification, consensus planning, worktree-first team
execution, durable state, hooks, notifications, and verification, and may map
them into future bounded Agent Workforce requirements. It must not install or
run OMX, start real workers, create worktrees, execute commands through an
agent workforce, mutate user project files, enable 144-worker execution,
change the default NVIDIA `/chat` lane, publish releases, deploy cloud
infrastructure, or claim real Agent Workforce execution is complete.

## Phase 139A Agent Workforce Clarify And Consensus Preview Boundary

Phase 139A is verified by:

```powershell
cmd /c pnpm verify:phase139a-agent-workforce-clarify-consensus
```

It may add preview-only `clarifyQuestions`, `consensusPreview`,
`hookEventsPreview`, and `planState` fields to `/workforce/plan`, update the
Agent Workforce Web UI to show clarification questions, Planner / Architect /
Critic consensus, disabled hook event examples, Plan state / HUD, and a
disabled workflow-run handoff, and record matching docs/evidence. It must not
modify `legacy/`, create `PROJECT_CONTEXT.md`, change the default NVIDIA
`/chat` lane, introduce or run `oh-my-codex`, execute code, create worktrees,
mutate user project files, call workflow run, enable 144 real workers, or
record plaintext API keys in evidence, logs, or UI.

For this phase, Agent Workforce must not create worktrees and must not call
workflow run.

## Phase 141A Agent Workforce Review Package + Human Approval Gate Preview Boundary

Phase 141A is verified by:

```powershell
cmd /c pnpm verify:phase141a-workforce-review-approval-gate
```

It may add preview-only `reviewPackagePreview` and `approvalGatePreview`
fields to `/workforce/plan`, persist those fields in the dev-only local plan
package, expose read-only review package retrieval for saved plans, and record
a human approval gate preview decision as metadata only. It may update the Web
UI, shared contracts, SDK, docs, and evidence for this preview flow. It must
not modify `legacy/`, create `PROJECT_CONTEXT.md`, install or run
`oh-my-codex`, create worktrees, execute code through Agent Workforce, mutate
user project files, call workflow run, enable real Agent execution, enable 144
real workers, change the default NVIDIA `/chat` lane, or record plaintext API
keys in evidence, logs, UI, or docs.

For this phase, Agent Workforce must not create worktrees and must not call
workflow run. A recorded approval is not permission to execute.

## Phase 142A Agent Workforce OMX Handoff Preview Boundary

Phase 142A is verified by:

```powershell
cmd /c pnpm verify:phase142a-workforce-omx-handoff-preview
```

It may add preview-only `omxHandoffPreview` fields to `/workforce/plan`, saved
Agent Workforce task packages, exports, shared contracts, Web UI, docs, and
evidence. The handoff may describe an oh-my-codex-compatible future workflow,
role mapping, suggested `$deep-interview`, `$ralplan`, and `$team` commands,
preflight requirements, blockers, and an external-runner boundary. It must not
install or run `oh-my-codex`, add it as a dependency, create worktrees, execute
code, mutate user project files, call workflow run, enable real Agent
execution, enable 144 real workers, change the default NVIDIA `/chat` lane, or
record plaintext API keys in evidence, logs, UI, or docs.

For this phase, Agent Workforce must not create worktrees and must not call
workflow run. OMX handoff suggestions are documentation/metadata only.

## Phase 143A Agent Workforce Role Tier + Event Ledger Boundary

Phase 143A is verified by:

```powershell
cmd /c pnpm verify:phase143a-role-tier-event-ledger
```

It may add preview-only `roleTiers`, `eventLedgerPreview`, and
`workforceHudPreview` fields to `/workforce/plan`, saved Agent Workforce task
packages, exports, shared contracts, Web UI, docs, and evidence. Role tiers
may group the existing seven preview roles into Strategy, Architecture,
Implementation Planning, and Quality. Event ledger entries may record disabled
hook-style events as observability metadata only. The HUD may summarize plan
state, clarification coverage, Planner / Architect / Critic consensus, review
package state, approval gate state, disabled workflow handoff, preview-only OMX
handoff, and disabled execution. It must not add 33 OMX roles, register or
execute hooks, install or run `oh-my-codex`, add it as a dependency, create
worktrees, execute code, mutate user project files, call workflow run, enable
real Agent execution, enable 144 real workers, change the default NVIDIA
`/chat` lane, or record plaintext API keys in evidence, logs, UI, or docs.

For this phase, Agent Workforce must not create worktrees and must not call
workflow run. A preview approval is not permission to execute.

## Phase 144A Agent Workforce Execution Readiness Preflight Boundary

Phase 144A is verified by:

```powershell
cmd /c pnpm verify:phase144a-execution-readiness-preflight
```

It may add preview-only `executionReadinessPreflight` fields to
`/workforce/plan`, saved Agent Workforce task packages, exports, shared
contracts, Web UI, docs, and evidence. The preflight may describe future real
execution prerequisites such as human approval, clean git workspace,
secret-safety, worktree isolation, task claim tokens, log redaction,
cancellable execution, and execution evidence. It must keep
`executionEnabled=false` and `overallStatus` blocked or preview-blocked. It
must not inspect or mutate the real git workspace, install or run
`oh-my-codex`, add it as a dependency, call `$deep-interview`, `$ralplan`,
`$team`, or `ralph`, create worktrees, execute code, mutate user project
files, call workflow run, enable real Agent execution, treat approval-preview
as execution approval, change the default NVIDIA `/chat` lane, or record
plaintext API keys in evidence, logs, UI, or docs.

For this phase, Agent Workforce must not create worktrees and must not call
workflow run. The preflight is a future-readiness preview only.

## Phase 145A Agent Workforce External OMX Runner Design Boundary

Phase 145A is verified by:

```powershell
cmd /c pnpm verify:phase145a-external-omx-runner-design
```

It may add design-only `externalOmxRunnerDesign` fields to `/workforce/plan`,
saved Agent Workforce task packages, exports, shared contracts, Web UI, docs,
and evidence. The runner design may describe proposed future endpoints,
required preflight checks, runner contract requirements, and blocked reasons.
It must keep `runnerEnabled=false`, `executionEnabled=false`, and
`designOnly=true`. It must not add real runner execution endpoints, inspect or
mutate the real git workspace, install or run `oh-my-codex`, add it as a
dependency, call `$deep-interview`, `$ralplan`, `$team`, or `ralph`, create
worktrees, execute code, mutate user project files, call workflow run, treat
approval-preview as execution approval, change the default NVIDIA `/chat` lane,
or record plaintext API keys in evidence, logs, UI, or docs.

For this phase, Agent Workforce must not create worktrees and must not call
workflow run. The external runner protocol is a future design surface only.

## Phase 146A Runner Request Review Queue Preview Boundary

Phase 146A is verified by:

```powershell
cmd /c pnpm verify:phase146a-runner-request-review-queue
```

It may add preview-only `runnerRequestQueuePreview` fields to Agent Workforce
plans, saved packages, exports, contracts, Web UI, docs, and evidence. The
queue must keep `queueEnabled=false` and `executionEnabled=false`; it must not
auto-dispatch, dispatch to an external runner, execute Agents, call workflow
run, create worktrees, inspect or mutate git/worktree state, call
`oh-my-codex`, or treat approval-preview as execution permission.

## Phase 147A Execution Request Approval Record Preview Boundary

Phase 147A is verified by:

```powershell
cmd /c pnpm verify:phase147a-execution-approval-record
```

It may add preview-only `executionApprovalRecordPreview` fields to Agent
Workforce plans, saved packages, exports, contracts, Web UI, docs, and
evidence. The record must keep `approvalRecordEnabled=false`,
`executionEnabled=false`, and `approvalPreviewIsExecutionPermission=false`.
It must not create real execution approval, execute Agents, call workflow run,
create worktrees, call `oh-my-codex`, add real runner execution, or change the
default NVIDIA `/chat` lane.

## Phase 148A External Runner Protocol Freeze Boundary

Phase 148A is verified by:

```powershell
cmd /c pnpm verify:phase148a-external-runner-protocol-freeze
```

It may add design-only `externalRunnerProtocolFreeze` fields to Agent Workforce
plans, saved packages, exports, contracts, Web UI, docs, and evidence. The
freeze must keep `frozen=true`, `runnerEnabled=false`, `executionEnabled=false`,
and `designOnly=true`. It freezes the preview protocol only; it must not claim
the runner is implemented, must not enable execution, must not call
`oh-my-codex`, must not create worktrees, must not call workflow run, must not
add shell execution or runner dispatch, and must not change the default NVIDIA
`/chat` lane.

## Phase 149A Agent Workforce Preview Final UX Seal Boundary

Phase 149A is verified by:

```powershell
cmd /c pnpm verify:phase149a-agent-workforce-preview-final-ux-seal
```

It may add final UX seal wording and `agentWorkforcePreviewFinalUxSeal`
metadata to Agent Workforce plans, saved packages, exports, contracts, Web UI,
docs, and evidence. The seal may summarize the covered 142A-148A preview
capabilities and the user path from goal clarification through runner protocol
freeze. It must keep Agent Workforce preview-only, OMX handoff as task
package/handoff preview only, execution disabled, workflow run disabled,
external runner dispatch disabled, and approval-preview not execution approval.
It must not modify `legacy/`, create `PROJECT_CONTEXT.md`, install or run
`oh-my-codex`, call OMX CLI, `$team`, or `ralph`, execute real Agents, create
worktrees, call workflow run, add real runner dispatch, change the default
NVIDIA `/chat` lane, or record plaintext API keys in evidence, logs, UI, or
docs.

## Phase 150A Agent Workforce Preview Acceptance Pack Boundary

Phase 150A is verified by:

```powershell
cmd /c pnpm verify:phase150a-agent-workforce-preview-acceptance-pack
```

It may add the Agent Workforce Preview release summary / user acceptance pack
at `docs/AGENT_WORKFORCE_PREVIEW_ACCEPTANCE_PACK.md`, index existing evidence,
list completed preview capabilities, record user and administrator acceptance
paths, refresh documentation, and write matching evidence. It is documentation
and validation only. It must not modify `legacy/`, create `PROJECT_CONTEXT.md`,
introduce an `oh-my-codex` dependency, call OMX CLI, `$team`, or `ralph`,
execute real Agents, create worktrees, call workflow run, add real external
runner dispatch, change the default NVIDIA `/chat` lane, treat
approval-preview as execution approval, or record plaintext API keys in UI,
logs, docs, or evidence.

## Phase 151A Agent Workforce Preview Stage Closure Decision Boundary

Phase 151A is verified by:

```powershell
cmd /c pnpm verify:phase151a-agent-workforce-stage-closure
```

It may add the stage closure decision document at
`docs/AGENT_WORKFORCE_PREVIEW_STAGE_CLOSURE_DECISION.md`, index 142A-150A
evidence, reference the Phase 150A acceptance result, record current blockers,
list follow-up options, recommend the default route, refresh documentation, and
write matching evidence. It is closure decision and documentation only. It must
not modify `legacy/`, create `PROJECT_CONTEXT.md`, introduce an
`oh-my-codex` dependency, call OMX CLI, `$team`, or `ralph`, execute real
Agents, create worktrees, call workflow run, add real external runner dispatch,
change the default NVIDIA `/chat` lane, treat approval-preview as execution
approval, or record plaintext API keys in UI, logs, docs, or evidence.

## Phase 152A Agent Workforce Demo Script / User Manual Hardening Boundary

Phase 152A is verified by:

```powershell
cmd /c pnpm verify:phase152a-agent-workforce-demo-manual
```

It may add or update `docs/AGENT_WORKFORCE_DEMO_SCRIPT.md`, harden
`docs/USER_MANUAL.md`, minimally sync README / AGENTS, and write matching
evidence. It is documentation, demo path, user explanation, developer
verification path, and evidence only. It must not modify `legacy/`, create
`PROJECT_CONTEXT.md`, introduce an `oh-my-codex` dependency, call OMX CLI,
`$team`, or `ralph`, execute real Agents, create worktrees, call workflow run,
add real external runner dispatch, change the default NVIDIA `/chat` lane,
treat approval-preview as execution approval, or record plaintext API keys in
UI, logs, docs, or evidence.

## Phase 153A Agent Workforce Product Template Pack Boundary

Phase 153A is verified by:

```powershell
cmd /c pnpm verify:phase153a-agent-workforce-product-template-pack
```

It may add preview-only Agent Workforce product templates, `selectedTemplate`,
`templateContext`, and `productTemplatesPreview` fields to plans, saved
packages, exports, contracts, Web UI, docs, and evidence. The allowed template
pack covers Feature Development Template, Bug Fix Template, Documentation
Template, Code Review Template, Release Checklist Template, and Research /
Design Study Template. Templates may shape plan prompt/context, clarification
framing, role planning, review package framing, and acceptance checklist only.
They must not trigger runtime execution.

It must not modify `legacy/`, create `PROJECT_CONTEXT.md`, introduce an
`oh-my-codex` dependency, call OMX CLI, `$team`, or `ralph`, execute real
Agents, create worktrees, call workflow run, add real external runner dispatch,
change the default NVIDIA `/chat` lane, treat approval-preview as execution
approval, or record plaintext API keys in UI, logs, docs, or evidence.

## Phase 154A-160A Agent Workforce Preview Product Closure Batch Boundary

Phase 154A-160A is verified by:

```powershell
cmd /c pnpm verify:phase154a-template-acceptance-sample-plans
cmd /c pnpm verify:phase155a-template-export-copy-ux
cmd /c pnpm verify:phase156a-guided-onboarding-demo-dataset
cmd /c pnpm verify:phase157a-agent-workforce-evidence-index
cmd /c pnpm verify:phase158a-product-readiness-known-limits
cmd /c pnpm verify:phase159a-agent-workforce-preview-rc-seal
cmd /c pnpm verify:phase160a-agent-workforce-final-closure
```

These phases may add template sample plans, sample acceptance checklists,
copy/export handoff wording, guided demo goals, evidence index documentation,
known-limits hardening, release-candidate preview seal, final closure snapshot,
validation entrypoints, and evidence. They are product closure, documentation,
preview data, and evidence only.

They must not modify `legacy/`, create `PROJECT_CONTEXT.md`, introduce an
`oh-my-codex` dependency, call OMX CLI, `$deep-interview`, `$ralplan`, `$team`,
or `ralph`, execute real Agents, create worktrees, call workflow run, add real
external runner dispatch, change the default NVIDIA `/chat` lane, treat
approval-preview as execution approval, execute suggested OMX commands, or
record plaintext API keys in UI, logs, docs, or evidence. RC seal and final
closure mean preview product baseline only, not production-ready execution.

## Phase 161A-180A Agent Workforce Preview Product Experience / Delivery Hardening Boundary

Phase 161A-180A is verified by:

```powershell
cmd /c pnpm run verify:phase180a-final-product-decision-gate
cmd /c pnpm run verify:phase179a-full-preview-regression-sweep
cmd /c pnpm run verify:phase171a-verification-matrix
```

These phases may add UI information architecture polish, read-only dashboard
summary cards, template gallery UX, readable plan output, review / approval /
handoff clarity, saved plan history UX, export handoffPackageManifest, guided
demo mode, user manual navigation, README / AGENTS boundary sync,
verification matrix, local operator runbook, manual QA checklist, final
evidence manifest, RC2 seal, install/start/use path checks, documentation
cross-link index, user handoff package, full preview regression sweep, final
product decision gate docs, validation entrypoints, and evidence.

They must do not default into real execution, do not call oh-my-codex, do not
create worktrees, do not connect workflow run, do not add real external runner
dispatch, do not change the default NVIDIA `/chat` lane, do not treat
approval-preview as execution approval, do not reopen Docker / cloud / CI/CD /
multi-user production mainlines, and do not record plaintext API keys in UI,
logs, docs, or evidence.

The Phase 161A-180A outcome remains a preview product baseline only:
Execution disabled, External Runner disabled, workflow run disabled, and no
real Agent execution. Permanent short boundary phrase: do not create worktrees.

## Phase 181A-190A Agent Workforce Preview UI / Experience Polish Boundary

Phase 181A-190A is verified by:

```powershell
cmd /c pnpm run verify:phase181a-empty-state-first-use-guidance
cmd /c pnpm run verify:phase182a-error-validation-ux
cmd /c pnpm run verify:phase183a-terminology-consistency
cmd /c pnpm run verify:phase184a-export-handoff-wording
cmd /c pnpm run verify:phase185a-accessibility-readability
cmd /c pnpm run verify:phase186a-demo-goal-copy-polish
cmd /c pnpm run verify:phase187a-history-detail-polish
cmd /c pnpm run verify:phase188a-boundary-banner-safety-notice
cmd /c pnpm run verify:phase189a-microcopy-regression-pack
cmd /c pnpm run verify:phase190a-ux-polish-closure
```

These phases may polish empty states, validation messages, canonical
terminology, export handoff wording, readability, demo goal copy, saved-plan
details, boundary banners, documentation, validation entrypoints, and evidence.
They are UI / experience / documentation / evidence polish only. They must not
add large product capabilities, real Agent execution, oh-my-codex integration,
worktree creation, workflow run handoff, real external runner dispatch, or
changes to the default NVIDIA `/chat` lane. They must keep approval-preview
from being described as execution approval and must not record plaintext API
keys in UI, logs, docs, or evidence.

Canonical UI terms for this batch are: Agent Workforce Preview, Plan, Review
Package, Approval Preview, OMX Handoff Preview, External Runner Disabled, and
Execution Disabled. The boundary banner must keep these states visible:
Preview only, Execution Disabled, External Runner Disabled, No oh-my-codex
call, and No worktree creation.

## Phase 191A-194A Agent Workforce Preview Manual Trial Boundary

Phase 191A-194A is verified by:

```powershell
cmd /c pnpm run verify:phase191a-manual-trial-walkthrough
cmd /c pnpm run verify:phase192a-user-feedback-template
cmd /c pnpm run verify:phase193a-small-ux-fix-pass
cmd /c pnpm run verify:phase194a-final-user-trial-closure
```

These phases may add a manual trial script, real UI walkthrough checklist,
user feedback template, small bounded UI / wording fixes based on the trial
path, final user trial closure docs, validation entrypoints, and evidence.
They must remain documentation, checklist, small UX, and evidence work only.
They must not add large product capabilities, real Agent execution,
oh-my-codex or OMX CLI calls, worktree creation, workflow run handoff, real
external runner dispatch, or default NVIDIA `/chat` lane changes. They must
not treat approval-preview as execution approval and must not describe final
user trial closure as a production release.

## Phase 195A-198A Agent Workforce Preview Lightweight Iteration Boundary

Phase 195A-198A is verified by:

```powershell
cmd /c pnpm run verify:phase195a-user-friction-review
cmd /c pnpm run verify:phase196a-small-ui-copy-fix-pass
cmd /c pnpm run verify:phase197a-docs-quickstart-tightening
cmd /c pnpm run verify:phase198a-lightweight-iteration-closure
```

These phases may record a small ordinary-user friction list, adjust bounded UI
copy, tighten README / USER_MANUAL / manual-trial quickstart wording, add a
lightweight iteration closure document, and write matching evidence. They must
remain lightweight UI / documentation / experience work only. They must not
add runtime capability, new execution endpoints, real Agent execution,
oh-my-codex or OMX CLI calls, worktree creation, workflow run handoff, real
external runner dispatch, or default NVIDIA `/chat` lane changes. They must
not treat approval-preview as execution approval and must not record plaintext
API keys in UI, docs, logs, or evidence.

## Phase 140A Agent Workforce Clarification Answers + Plan Lifecycle Persistence Preview Boundary

Phase 140A is verified by:

```powershell
cmd /c pnpm verify:phase140a-workforce-clarification-lifecycle
```

It may accept `clarificationAnswers` in `/workforce/plan`, return
`answeredClarifications` and `unresolvedClarifications`, persist
clarification answers plus preview-only lifecycle state for saved Agent
Workforce plans in the dev-only local plan package, and expose matching Web UI
controls for answer entry, preview regeneration, and history lifecycle status.
It must not modify `legacy/`, create `PROJECT_CONTEXT.md`, install or run
`oh-my-codex`, create worktrees, execute code, mutate user project files, call
workflow run, enable real Agent execution, enable 144 real workers, change the
default NVIDIA `/chat` lane, or record plaintext API keys in evidence, logs,
UI, or docs.

For this phase, Agent Workforce must not create worktrees and must not call
workflow run.

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
## Agent Workforce Fully Automated Controlled Loop Boundary

Phase 225A-232A adds local automation for:

- Goal to Agent Workforce plan.
- Auto-save latest plan.
- Codex Desktop handoff file generation.
- Clipboard handoff copy.
- Waiting for `.codex-handoff/inbox/latest-codex-result.md`.
- Codex result import.
- System review and feedback generation.
- Controlled dry-run loop.
- Explicit real Codex one-shot only.

Default mode is manual bridge / dry-run. Do not describe this as unattended production execution. Do not automatically call Codex CLI unless the explicit one-shot command and approval flags are present. Do not automatically apply patches, merge, commit, push, create worktrees, or dispatch workflow runs. Continue to preserve `legacy/`, do not create `PROJECT_CONTEXT.md`, and do not change the default NVIDIA `/chat` lane.


