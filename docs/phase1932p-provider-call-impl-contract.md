# Phase1932P-ProviderCallImpl Contract

## Allowed Provider

- `nvidia`

## Allowed Purpose

- `phase1932p_guarded_provider_stability_test`

## Required Fields

- `providerId`
- `modelId`
- `credentialRef`
- `prompt`
- `expectedResponseContains`
- `timeoutMs`
- `invocationPurpose`

## Limits

- `maxRequestsLimit`: 3
- `timeoutMsLimit`: 30000

## Forbidden Behaviors

- raw secret read
- `auth.json` read
- env dump
- raw key output
- auth header logging
- `/chat-gateway/execute` default route change
- deploy, release, tag, artifact upload

The implementation exposes a dry-run contract and a future real execution method. The real method must not directly fetch a Provider or read secrets; it may only call a separately injected safe internal executor.
