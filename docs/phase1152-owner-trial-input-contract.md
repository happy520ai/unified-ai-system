# Phase1152 Owner Trial Input Contract

Create one of these explicit input files before re-running this phase:

- `docs/phase1151-owner-real-manual-trial.input.json`
- `apps/ai-gateway-service/evidence/phase1151_1160/owner-real-manual-trial-input.json`

Required JSON shape:

```json
{
  "ownerName": "owner name or initials",
  "trialAt": "2026-05-13T12:00:00+08:00",
  "comprehension": {
    "understoodPurpose": true,
    "willingToClickPreview": true,
    "knowsNextStep": true,
    "noticedSafetyBoundary": true
  },
  "screenshotPaths": [],
  "positiveSignals": [],
  "confusionPoints": [],
  "reproducibleIssues": [],
  "notes": ""
}
```

Do not include API keys, secrets, auth.json contents, raw provider endpoints, or production credentials.
