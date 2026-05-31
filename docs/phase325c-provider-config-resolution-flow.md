# Phase325C Provider Config Resolution Flow

## Resolution Order

Future provider config resolution should follow this order:

1. static provider registry
2. environment availability check
3. secret reference validation
4. provider enablement policy
5. route policy eligibility
6. runtime guard
7. dry-run validation
8. final provider availability

## 1. Static Provider Registry

The static registry defines provider identity, provider type, supported model families, and baseline status. In Phase325C this is design-only and does not alter current runtime resolution.

NVIDIA remains the current runtime provider. OpenAI, Claude, OpenRouter, MiMo, and local remain future-provider-slot or design_only.

## 2. Environment Availability Check

The environment availability check may determine whether a named environment variable is expected, but it must not print or expose its value.

For design-only providers, availability is informational and cannot enable real calls.

## 3. Secret Reference Validation

Secret reference validation checks shape only:

- reference kind exists
- environment variable name is allowed
- no plaintext secret field exists
- redaction is required

It must not read a real key in Phase325C.

## 4. Provider Enablement Policy

Provider enablement requires status, rollout stage, approval, and kill switch checks. Any future-provider-slot or design_only provider fails real-call eligibility.

## 5. Route Policy Eligibility

Route policy determines whether a provider may serve a route. The default rule is deny unless explicitly allowed.

Non-NVIDIA providers must have route eligibility set to denied in this phase.

## 6. Runtime Guard

The runtime guard is the final non-negotiable stop before any provider call. It must reject:

- future-provider-slot real calls
- non-NVIDIA paid provider calls in design stages
- missing credentialRef
- missing budget policy
- missing audit policy
- engaged kill switch
- route-denied provider

## 7. Dry-Run Validation

Dry-run validation can simulate config decisions and produce evidence. It must not call providers or mutate selectable metadata.

Dry-run output must include:

- provider considered
- route decision
- reason
- realCallsAllowed
- providerCalled=false
- redaction confirmation

## 8. Final Provider Availability

Final provider availability is true only when all previous checks pass and the rollout stage allows real calls.

In Phase325C, final availability is only a design concept. It does not change existing runtime resolution.

## Non-Implementation Boundary

This phase does not:

- modify router code
- modify provider runtime code
- modify Chat Gateway main chain
- modify Workbench provider toggles
- open OpenAI, Claude, OpenRouter, MiMo, or local runtime calls

