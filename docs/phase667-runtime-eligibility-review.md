# Phase667 Runtime Eligibility Review

Phase667 reviews capability neuron manifests from `capabilities/_registry_preview` and decides whether they can enter sandbox/local auto runtime v0.

Admission is limited to verifier-passed, rollback-backed, low-risk manifests. The output is `capabilities/_runtime_admitted/*.runtime-admission.json`.

Safety boundary:
- providerCallsAllowed=false
- secretReadAllowed=false
- deployAllowed=false
- chatMutationAllowed=false
- chatGatewayExecuteMutationAllowed=false
- codexConfigMutationAllowed=false
- selfApprovalAllowed=false
- maxSpawnDepth=1
- productionRuntimeEligible=false
