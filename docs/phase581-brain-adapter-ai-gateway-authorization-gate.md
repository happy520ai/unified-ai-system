# Phase581 Brain Adapter AI Gateway Authorization Gate

Phase581 adds the authorization gate for employee brain calls.

Default behavior:
- Missing authorization blocks provider execution.
- Partial authorization blocks provider execution.
- Dry-run Gateway adapter remains available.
- `/chat-gateway/execute` is not modified or called.

Required fields for a future real provider call:
- allowProviderCall=true
- allowedProviderRefs
- allowedCredentialRefs
- allowedModelRefs
- maxRequests
- maxEstimatedCostUsd
- fanoutLimit
- approvalReason

