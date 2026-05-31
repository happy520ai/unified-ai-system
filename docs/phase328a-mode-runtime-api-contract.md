# Phase328A Mode Runtime API Contract

## Route

`POST /three-mode/execute`

## Request fields

- `requestId`
- `mode`
- `input.content`
- `modelSelection`
- `executionPolicy`
- `audit`

## Success envelope

```json
{
  "success": true,
  "code": "OK",
  "message": "Three Mode runtime completed.",
  "data": {
    "requestId": "phase328a-example",
    "mode": "normal",
    "finalAnswer": "example",
    "selectedModel": {},
    "participantModels": [],
    "plannerDecision": null,
    "supervisorDecision": null,
    "confidenceSummary": {},
    "uncertainty": {},
    "fallbackUsed": false,
    "auditTrace": {}
  },
  "error": null,
  "meta": {
    "timestamp": "2026-05-07T00:00:00.000Z",
    "durationMs": 1000
  }
}
```

## Error envelope

```json
{
  "success": false,
  "code": "THREE_MODE_RUNTIME_ERROR",
  "message": "Three Mode runtime failed.",
  "data": null,
  "error": {
    "code": "MODEL_NOT_SELECTABLE",
    "message": "Model is not selectable.",
    "recoverable": true,
    "details": {}
  },
  "meta": {
    "timestamp": "2026-05-07T00:00:00.000Z",
    "durationMs": 20
  }
}
```
