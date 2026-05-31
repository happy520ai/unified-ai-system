# Owner Daily Use Records

This folder stores owner-provided daily-use records for Product Work Mode.

Manual input file for the first record:

`docs/owner-daily-use/records/owner-daily-use-0001.json`

Rules:

- Do not count Codex self-tests, automated screenshots, verifier output, or generated evidence as owner feedback.
- Do not include API keys, tokens, .env content, auth.json content, or raw secrets.
- Use the template fields from `owner-daily-use-template.json`.
- If no owner record exists, downstream ingest must seal as blocked, not fabricated.
