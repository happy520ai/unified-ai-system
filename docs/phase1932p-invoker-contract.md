# Phase1932P-Invoker Contract

Allowed invocation purpose:
- `phase1932p_guarded_provider_stability_test`

Required fields:
- `providerId`
- `modelId`
- `credentialRef`
- `prompt`
- `expectedResponseContains`
- `timeoutMs`
- `maxRequests`
- `invocationPurpose`

Limits:
- `maxRequests <= 3`
- `timeoutMs <= 30000`

Forbidden behavior:
- raw secret read
- `auth.json` read
- `.env` read
- environment dump
- raw key or authorization header output
- default `/chat-gateway/execute` route change
- deploy, release, tag, artifact upload
