# Phase607R Public Repo Hygiene Preflight

## Purpose

Phase607R checks public repository hygiene before any public release action. It is a preflight only and does not deploy, release, tag, upload artifacts, push, or commit.

## Checked Areas

- `.gitignore` coverage for environment files, dependency folders, build/cache/temp/log/runtime outputs, `.codex/`, and project Codex config.
- README first-screen public posture wording.
- License decision state.
- Security policy decision state.
- Contributor guide decision state.
- Known limits and local dry-run quickstart docs.
- Evidence local path policy.

## Decisions

- publicBlockerReportGenerated=true
- readmeFirstScreenChecked=true
- licenseDecisionRecorded=true
- securityPolicyDecisionRecorded=true
- contributingGuideDecisionRecorded=true
- evidenceLocalPathPolicyRecorded=true

## Safety Flags

- providerCallsMade=false
- secretValueExposed=false
- rawBaseUrlValueExposed=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- pushExecuted=false
- commitCreated=false
- chatModified=false
- chatGatewayExecuteModified=false
- codexConfigModified=false
- workspaceCleanClaimed=false

## Evidence Local Path Policy

Evidence may include local relative paths for repo files and phase artifacts. Public publication still needs a later scrub pass for machine-specific absolute paths, screenshots, and runtime captures. This phase records the policy and blocker state; it does not rewrite historical evidence.
