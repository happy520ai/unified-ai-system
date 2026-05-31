# Phase1956P NVIDIA Model Compatibility Dry-Run

- modelCompatibilityDryRunCompleted: true
- dryRunOnly: true
- authorizedModelCount: 2

## nvidia/llama-3.3-nemotron-super-49b-v1

- allowedByExecutor: true
- listedInNvidiaCatalog: true
- endpointTypeDryRun: chat
- expectedEndpointPath: /chat/completions
- historicalAttemptCount: 1
- historicalTimeoutCount: 1
- retryRecommendation: do_not_retry_without_new_owner_approval_and_clearer_route_fix

## nvidia/llama-3.1-nemotron-nano-8b-v1

- allowedByExecutor: true
- listedInNvidiaCatalog: true
- endpointTypeDryRun: chat
- expectedEndpointPath: /chat/completions
- historicalAttemptCount: 1
- historicalTimeoutCount: 1
- retryRecommendation: do_not_retry_without_new_owner_approval_and_clearer_route_fix


Both previously attempted models remain statically allowlisted and chat-shaped, but both have timeout evidence. Static compatibility alone does not authorize another retry.
