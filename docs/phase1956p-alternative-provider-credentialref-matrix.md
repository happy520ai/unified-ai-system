# Phase1956P Alternative Provider CredentialRef Matrix

## OpenRouter-compatible route

- routeId: openrouter_compatible
- credentialRefRequired: true
- credentialRefPattern: credentialRef:openrouter:owner-approved
- rawSecretAllowed: false
- authJsonReadAllowed: false
- envDumpAllowed: false
- executionBlockedWithoutCredentialRef: true

## OpenAI-compatible route

- routeId: openai_compatible
- credentialRefRequired: true
- credentialRefPattern: credentialRef:openai:owner-approved
- rawSecretAllowed: false
- authJsonReadAllowed: false
- envDumpAllowed: false
- executionBlockedWithoutCredentialRef: true

## Claude-compatible route

- routeId: claude_compatible
- credentialRefRequired: true
- credentialRefPattern: credentialRef:claude:owner-approved
- rawSecretAllowed: false
- authJsonReadAllowed: false
- envDumpAllowed: false
- executionBlockedWithoutCredentialRef: true

## Volcengine / MiMo route

- routeId: volcengine_mimo
- credentialRefRequired: true
- credentialRefPattern: credentialRef:volcengine-or-mimo:owner-approved
- rawSecretAllowed: false
- authJsonReadAllowed: false
- envDumpAllowed: false
- executionBlockedWithoutCredentialRef: true

## Local synthetic provider fallback

- routeId: local_synthetic_provider_fallback
- credentialRefRequired: true
- credentialRefPattern: credentialRef:local-synthetic:dry-run-only
- rawSecretAllowed: false
- authJsonReadAllowed: false
- envDumpAllowed: false
- executionBlockedWithoutCredentialRef: false


No raw secret, auth header, environment dump, or default chat route change is allowed by this matrix.
