# Phase585 Guarded Real Provider Workforce Test Authorization Gate

Phase585 creates the gate for future real provider workforce tests.

This phase does not execute a real provider call by default.

If any required authorization field is missing, the execution status is:

`blocked_pending_specific_authorization`

Required fields:
- allowProviderCall=true
- allowedProviderRefs
- allowedCredentialRefs
- allowedModelRefs
- allowedEmployeeIds
- maxRequests
- maxEstimatedCostUsd
- fanoutLimit
- approvalReason

