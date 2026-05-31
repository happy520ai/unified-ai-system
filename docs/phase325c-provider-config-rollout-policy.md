# Phase325C Provider Config Rollout Policy

## Stage 1: design_only

- entry criteria: provider has a documented future slot
- allowed action: write docs, schema examples, validation rules
- forbidden action: provider call, key read, route enablement
- evidence requirement: design document and safety boundary
- rollback trigger: design conflicts with current NVIDIA-only boundary
- exit criteria: schema draft approved for dry-run planning

## Stage 2: schema_draft

- entry criteria: design_only complete
- allowed action: define JSON shape and invalid examples
- forbidden action: runtime config load, secret read, UI enable switch
- evidence requirement: valid JSON examples
- rollback trigger: schema allows plaintext secret or implicit paid call
- exit criteria: validation rules reviewed

## Stage 3: shadow_config

- entry criteria: schema draft approved
- allowed action: create non-routing config sample
- forbidden action: route eligibility, provider client use
- evidence requirement: shadow config validation report
- rollback trigger: config can affect runtime
- exit criteria: dry-run resolver design approved

## Stage 4: internal_dry_run

- entry criteria: shadow config cannot route real calls
- allowed action: simulate route and provider decisions
- forbidden action: real provider call, credential read
- evidence requirement: dry-run evidence with providerCalled=false
- rollback trigger: any real call attempt
- exit criteria: dry-run guard proves deny-by-default behavior

## Stage 5: guarded_enablement

- entry criteria: explicit later-phase authorization
- allowed action: narrow provider smoke for one approved provider
- forbidden action: broad rollout, fallback to paid provider, selectable auto-add
- evidence requirement: real smoke evidence, budget evidence, audit evidence
- rollback trigger: rate limit, cost anomaly, missing audit, failed smoke
- exit criteria: provider-specific review completed

## Stage 6: limited_route

- entry criteria: guarded enablement passed
- allowed action: route a small allowlisted model set
- forbidden action: default route takeover, unverified model routing
- evidence requirement: route evidence and selectable review evidence
- rollback trigger: provider failure, completionVerified=false, user-visible regression
- exit criteria: monitored expansion proposal

## Stage 7: monitored_expansion

- entry criteria: limited route stable
- allowed action: expand allowlist with evidence-backed models
- forbidden action: automatic bulk enablement
- evidence requirement: latency, cost, success, failure, and rollback metrics
- rollback trigger: budget breach, quality regression, safety regression
- exit criteria: stable monitored operation record

## Stage 8: rollback

- entry criteria: rollback trigger fired or operator requests removal
- allowed action: disable provider, deny route, remove affected selectable models
- forbidden action: delete evidence, hide failures, use destructive git cleanup by default
- evidence requirement: rollback report and post-rollback verifier
- rollback trigger: not applicable
- exit criteria: route denied and verification passes

