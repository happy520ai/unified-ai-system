# Phase576C Employee Pyramid Dry-Run Scheduler

## Goal

Phase576C adds a virtual Employee Library and Expert Workforce Pyramid over the Position Library. Employees are dry-run expert roles, not real workers and not a complete occupation universe.

## Pyramid Levels

- L0 System Governor
- L1 Executive Council
- L2 Domain Chiefs
- L3 Principal Experts
- L4 Senior Specialists
- L5 Operators
- L6 Assistants

## Scheduler Policy

- maxCandidateEmployees=5
- maxActiveEmployees=3
- maxBrainCalls=0
- maxBrainCallsFutureDefault=2
- timeoutMsPerEmployee=8000
- globalTimeoutMs=30000
- useCache=true
- requireEvidence=true
- requireApprovalForProviderCall=true

## Boundary

No provider call, no secret access, no all-library broadcast, no automatic model request per employee.
