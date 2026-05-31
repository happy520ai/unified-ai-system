# Phase1958P-CredentialSetup CredentialRef Contract

## Target Contract

- providerId: openrouter
- modelId: openai/gpt-4o-mini
- credentialRef: credentialRef:openrouter:default
- ownerApprovalTextSourceOfTruth: true
- jsonRole: machine_validation_carrier_only

## Masked Readiness Contract

- masked check may report only: declared, present/resolvable, missing/unresolvable, providerId, modelId, credentialRef
- masked check may check aliases: openrouter, openrouter/default, openrouter:default, openrouter::default, credentialRef:openrouter:default
- masked check must not return raw API key
- masked check must not return authorization header
- masked check must not read auth json raw content
- masked check must not read dot env raw content
- masked check must not dump env

## Current Status

- maskedReadinessStatus: still_missing
- openRouterCredentialRefResolvable: false
- providerCallsMade: false
- externalNetworkRequestMade: false
