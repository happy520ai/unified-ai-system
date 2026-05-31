# Phase326A User-Owned Model Library Boundary

## Product Boundary

The production product should be built around a user-owned model library.

This means:

- the user configures Provider
- the user configures Model
- the user provides or references their own API Key
- the platform does not default to providing production Provider keys
- the platform does not call unauthorized providers for the user

NVIDIA is currently an internal test convenience and free smoke baseline. It is not the final production provider binding.

## Platform Responsibilities

The platform is responsible for:

- credential reference validation
- availability check
- routing policy
- fallback policy
- observability
- governance
- rollback
- safety guard
- evidence and audit trail

The platform is not responsible for silently supplying paid Provider access in production.

## User-Specific Model Library

Each user may have their own:

- configured providers
- configured models
- selectableModels
- fallback chain
- mode policy
- budget policy
- provider priority
- blocked provider list
- audit retention policy

This makes Normal Mode, God Mode, and Tianshu Mode user-scoped, not globally hardcoded.

## Mode Dependency

All three future modes depend on the user's model library:

- Normal Mode uses one user-selected model.
- God Mode uses multiple user-authorized participant models.
- Tianshu Mode searches the user's authorized model set and chooses a model or model combination.

If a user has not configured a provider or model, the system must not treat it as available.

## Security Boundary

User-owned API keys must be stored and referenced through secure credential references in a later authorized runtime phase.

Phase326A does not:

- read user API keys
- write API keys
- expose `.env`
- configure production provider credentials
- enable user-owned provider runtime

