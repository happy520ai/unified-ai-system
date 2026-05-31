# Phase632B Relevant Files Mandatory Gate

## Gate Fields

relevantFilesRequired=true
relevantFilesPath=.codex-context/relevant-files.json
selectionModeRequired=targeted-not-full-repo
maxRelevantFilesDefault=20
maxRelevantFilesHardLimit=50
fullRepoScanForbidden=true

## Policy

Every future Codex task must use `.codex-context/relevant-files.json` as the default read scope. The selected files must be targeted, bounded, and explicitly tied to the task.

## Enforcement

- Require `.codex-context/relevant-files.json`.
- Require targeted-not-full-repo selection mode.
- Default to 20 relevant files or fewer.
- Hard stop when relevant files exceed 50 unless a later explicit phase authorizes a larger scope.
- Do not read unlisted files for convenience. Stop and ask for a refreshed context pack when the relevant file list is insufficient.

## Boundary

Phase632B does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not deploy, release, tag, push, or commit, and does not claim workspace clean.
