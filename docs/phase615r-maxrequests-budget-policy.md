# Phase615R-Fix MaxRequests / Budget Policy

## Policy

- maxRequestsDefault=1
- maxRequestsHardLimit=3
- retryLimit=0
- stopOnFirstFailure=true
- no parallel execution.
- no background daemon.
- no auto scale to production.
- cost must be user-approved before any future real runtime call.

## Runtime Candidate Rule

Future runtime candidates must retain explicit request caps and must not inherit the Phase612 repeated_pass as unlimited approval.
