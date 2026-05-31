# Phase 290A Provider Cost and Free Model Governance

## Executive Summary

Phase 290A establishes local static provider cost governance and a free-model-first policy. It does not call paid APIs, MiMo, embedding, or any real external provider.

## Phase Goal

Make provider cost safety explicit before any controlled provider integration or paid-provider execution phase.

## Free Model First Policy

`freeModelFirstPolicy.enabled` is true. Default local operation should prefer free or non-paid routes where available.

## Paid API Guard Policy

`paidApiGuardPolicy.enabled` is true. Manual approval is required before any paid-provider call.

## Manual Approval Required

Manual approval is required before paid smokes, MiMo paid route usage, embedding provider calls, or external provider fallback.

## Auto Fallback To Paid Disabled

Automatic fallback from a free/non-paid path to a paid provider is disabled.

## MiMo Non Default Policy

MiMo remains non-default and requires explicit manual approval before any real call.

## Embedding Non Default Policy

Embedding remains non-default and requires explicit manual approval before any real call.

## Provider Default Boundary

Paid provider default allowed: false. Fallback to paid provider auto allowed: false. Provider default changed: false.

## Final Phase 290A Conclusion

Phase 290A adds static cost-governance policy modules and evidence only. It does not change provider routing or call real providers.
