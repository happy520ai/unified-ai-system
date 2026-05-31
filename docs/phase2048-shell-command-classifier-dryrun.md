# Phase2048 Shell Command Classifier Dry-run

Phase2048 adds a PME-owned shell and PowerShell command classifier. It labels command previews as `safe_read`, `safe_test`, `mutation`, `network`, `secret_risk`, `deploy_risk`, `git_risk`, or `provider_risk`.

The classifier is dry-run only. It never executes the command and never reads `.env`, `auth.json`, token, secret, or Provider credential files.
