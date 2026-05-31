# Phase632F Output Budget Mandatory Gate

## Gate Fields

outputBudgetRequired=true
conciseOutputRequired=true
longLogsForbidden=true
finalResponseBoundaryRequired=true
mustReportModifiedFiles=true
mustReportValidationCommands=true
mustReportBoundaryConfirmation=true

## Policy

Future Codex task output must stay concise and evidence-oriented. Long logs should remain in command output or evidence files; the final response should report only the facts needed for review.

## Enforcement

- Require an output budget before final response.
- Summarize validation results without pasting long logs.
- Report modified files.
- Report validation commands.
- Report boundary confirmation, including Provider, auth.json, Codex config, `/chat`, `/chat-gateway/execute`, deploy, release, push, and commit status.

## Boundary

Phase632F does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not deploy, release, tag, push, or commit, and does not claim workspace clean.
