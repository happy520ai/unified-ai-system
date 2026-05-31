# Phase1651 Codex Browser Operator Scope

This phase allows Codex to operate a local browser against the local PME AI Gateway UI and produce evidence.

Allowed:

- Start a local 127.0.0.1 service for the current process.
- Open local Mission Control with a headless browser.
- Click dry-run, preview, local-only, and read-only panels.
- Generate screenshots, DOM snapshots, trace ledgers, and daily record drafts.

Blocked:

- Provider calls.
- Secret, token, auth.json, webhook, or raw CredentialRef reads.
- /chat or /chat-gateway/execute default behavior changes.
- deploy, release, tag, artifact upload, push, commit.
- Owner subjective feedback fabrication.
