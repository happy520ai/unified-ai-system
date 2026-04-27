# NVIDIA Real Route Smoke Evidence

- executedAt: 2026-04-21T11:34:58.734Z
- mode: real-with-key
- provider: nvidia
- model: meta/llama-3.1-8b-instruct
- NVIDIA_API_KEY present: true
- NVIDIA_BASE_URL present: false
- success: true
- externalSuccessEvidence: true
- failure: false
- skipped: false
- conclusion: verified: NVIDIA real-with-key smoke returned HTTP 200 with selectedProvider=nvidia and success=true.

## Commands

```powershell
# Loaded .env into the current process without printing NVIDIA_API_KEY.
$env:AI_GATEWAY_SMOKE_MODE='real-with-key'
$env:NVIDIA_MODEL='meta/llama-3.1-8b-instruct'
Remove-Item Env:NVIDIA_BASE_URL -ErrorAction SilentlyContinue
node .\apps\ai-gateway-service\src\entrypoints\smokeNvidiaRoute.js
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service check
```

## Smoke Result

```json
{
  "smoke": "nvidia-route",
  "mode": "real-with-key",
  "nvidiaApiKeyPresent": true,
  "nvidiaModel": "meta/llama-3.1-8b-instruct",
  "checks": [
    {
      "name": "nvidia-real-with-key-route",
      "expected": "NVIDIA route returns a route envelope from the real provider path",
      "httpStatus": 200,
      "result": {
        "success": true,
        "code": "ROUTE_OK",
        "message": "Route executed successfully.",
        "data": {
          "selectedProvider": "nvidia",
          "selectedModel": "meta/llama-3.1-8b-instruct",
          "executionMode": "real",
          "executionStatus": "success",
          "outputText": "It seems like you're referring to a specific command or process related to NVIDIA's graphics drivers or network configuration. However, I need a bit more context to provide",
          "warnings": [
            {
              "code": "provider_preference_applied",
              "message": "Provider selection used explicit request or fixed default preference."
            }
          ]
        },
        "error": null,
        "meta": {
          "requestId": "req_mo8jr7dy_bxtzrqv0",
          "traceId": "req_mo8jr7dy_bxtzrqv0",
          "timestamp": "2026-04-21T11:34:58.734Z",
          "durationMs": 1161
        }
      }
    }
  ]
}
```

## Route Envelope Summary

- httpStatus: 200
- success: true
- code: ROUTE_OK
- selectedProvider: nvidia
- selectedModel: meta/llama-3.1-8b-instruct
- executionMode: real
- executionStatus: success
- error: null

## Service Check

`cmd /c pnpm --filter @unified-ai-system/ai-gateway-service check` passed.
