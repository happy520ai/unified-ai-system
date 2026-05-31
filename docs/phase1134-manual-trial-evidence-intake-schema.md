# Phase1134 Manual Trial Evidence Intake Schema

Use this schema for future real manual trial evidence intake.

```json
{
  "trialId": "local-human-trial-YYYYMMDD-001",
  "date": "YYYY-MM-DD",
  "testerType": "owner | external-local-tester",
  "testerAlias": "non-sensitive alias",
  "screenRefs": [],
  "taskEntered": "",
  "firstScreenPurposeUnderstood": null,
  "primaryCtaExpectation": "",
  "safeToClickPreview": null,
  "modeUnderstanding": {
    "normal": "",
    "god": "",
    "tianshu": ""
  },
  "nextStepUnderstood": null,
  "confusions": [],
  "issues": [],
  "severity": "none | p0 | p1 | p2 | p3 | ordinary",
  "humanFeedbackConfirmed": true,
  "codexGenerated": false,
  "providerCallsMade": false,
  "secretValueExposed": false,
  "deployExecuted": false
}
```

## Intake Rules

- `humanFeedbackConfirmed=true` may only be used for real human input.
- Do not use Codex wording as human feedback.
- Do not include API keys, secrets, raw auth files, or raw endpoint values.
- If an issue is reproducible, include steps and screenshot refs.
