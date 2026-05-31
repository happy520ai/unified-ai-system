# Phase585 Authorization Requirements

A future real Workforce provider call requires all fields:

- allowProviderCall=true
- allowedProviderRefs
- allowedCredentialRefs
- allowedModelRefs
- allowedEmployeeIds
- maxRequests
- maxEstimatedCostUsd
- fanoutLimit
- approvalReason

Partial authorization is blocked. Missing authorization is blocked. The gate must not read raw secrets.

