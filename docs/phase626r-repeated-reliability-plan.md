# Phase626R Repeated Reliability Plan

## Plan

- maxPlannedAttempts=3
- maxRequestsPerAttempt=1
- maxRequestsTotal=3
- retryLimitPerAttempt=0
- stopOnFirstFailure=true
- noParallelExecution=true
- noBackgroundDaemon=true

## Target

`POST /runtime-candidate/codex-exec-crs/reliability`

## Safety

The repeated reliability run is isolated local candidate validation only. It does not call Provider, does not execute `codex exec`, and does not wire `/chat`.

