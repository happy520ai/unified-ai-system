# Phase632E Forbidden Full Repo Scan Gate

## Gate Fields

fullRepoScanForbidden=true
unrelatedHistoryForbidden=true
stopWhenRelevantFilesInsufficient=true
noAutomaticScopeExpansion=true

## Policy

Future Codex tasks must not use full repository scans as the default way to understand the project. They must stay inside the context pack and relevant file list unless a later explicit phase authorizes a broader read scope.

## Enforcement

- Full repo scans are forbidden by default.
- Repeated reading of unrelated history is forbidden by default.
- If relevant files are insufficient, stop and record the missing context.
- Do not automatically expand scope through broad file discovery.
- Do not read secrets, auth.json, webhooks, or raw endpoint values.

## Boundary

Phase632E does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not deploy, release, tag, push, or commit, and does not claim workspace clean.
