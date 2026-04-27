# OpenAI Real Route Smoke Evidence

- executedAt: 2026-04-21T10:41:40.175Z
- mode: real-with-key
- provider: openai
- model: gpt-4o-mini
- success: false
- failure: true
- skipped: false
- requestId: req_mo8humpv_2zpuhex7
- durationMs: 1997
- conclusion: still blocked

## Route Envelope Summary

```json
{
  "success": false,
  "code": "OPENAI_RATE_LIMIT",
  "message": "You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.",
  "data": {
    "selectedProvider": "openai",
    "selectedModel": "gpt-4o-mini",
    "executionMode": "real",
    "executionStatus": "error",
    "outputTextPresent": false,
    "warnings": [
      {
        "code": "provider_preference_applied",
        "message": "Provider selection used explicit request or fixed default preference."
      }
    ]
  },
  "error": {
    "code": "OPENAI_RATE_LIMIT",
    "type": "rate_limit",
    "message": "You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.",
    "retryable": true,
    "provider": "openai",
    "model": "gpt-4o-mini",
    "details": {
      "providerId": "openai",
      "modelId": "gpt-4o-mini",
      "statusCode": 429,
      "errorType": "insufficient_quota",
      "errorCode": "insufficient_quota"
    }
  },
  "meta": {
    "requestId": "req_mo8humpv_2zpuhex7",
    "traceId": "req_mo8humpv_2zpuhex7",
    "timestamp": "2026-04-21T10:41:40.175Z",
    "durationMs": 1997
  }
}
```
