# Phase1312A Worker Isolation Design + Mock Hard Timeout

## Goal

Design a Neural Fabric worker isolation model and validate hard-timeout termination with a fixed mock task. This phase proves the lifecycle boundary only: start an isolated worker, hit a hard timeout, terminate the worker, keep the main thread alive, and write an execution transcript.

## Scope

- Mock worker only.
- Fixed task type: `mock-hard-timeout`.
- No arbitrary user code execution.
- No runtime inference.
- No real model execution.
- No training.
- No model download.
- No Provider calls.
- No network access.
- No secret, API key, token, `.env`, or `auth.json` reads.
- No `/chat` or `/chat-gateway/execute` integration.
- No main-chain integration.

## Isolation Model

Phase1312A uses Node.js `worker_threads` as a local dry-run isolation primitive. The main thread owns the timeout clock, transcript, and final policy result. The worker owns only a fixed mock task file and receives only structured worker data with a whitelisted task type.

The worker file does not evaluate strings, load user-provided modules, execute model code, or call external services. It posts lifecycle messages and then holds until the main thread reaches the configured timeout. The main thread then calls `worker.terminate()` and records the termination event.

## Transcript Contract

The dry-run returns an immutable transcript with ordered events:

- `main-thread-started`
- `worker-started`
- `worker-holding`
- `hard-timeout-reached`
- `terminate-requested`
- `worker-terminated`
- `main-thread-survived`

The transcript is content-addressed for evidence reproducibility.

## Required Result Flags

- `workerTimeoutTerminates=true`
- `mainThreadSurvives=true`
- `executionTranscriptWritten=true`

## Safety Boundary Flags

- `mockWorkerOnly=true`
- `userCodeExecuted=false`
- `realModelExecuted=false`
- `trainingExecuted=false`
- `providerCallsMade=false`
- `secretRead=false`
- `secretValueExposed=false`
- `networkUsed=false`
- `mainChainIntegrated=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`

## Implementation Files

- `packages/neural-fabric-runtime/src/workerIsolationDryRun.js`
- `packages/neural-fabric-runtime/src/mockWorkerTask.js`
- `packages/neural-fabric-runtime/tools/check-worker-isolation-dry-run.mjs`
- `tools/phase1312a/verify-worker-isolation-dry-run.mjs`

## Evidence

`apps/ai-gateway-service/evidence/phase1312a/worker-isolation-dry-run-result.json`

## Verification

```powershell
node --check packages/neural-fabric-runtime/src/workerIsolationDryRun.js
node --check packages/neural-fabric-runtime/src/mockWorkerTask.js
node --check packages/neural-fabric-runtime/tools/check-worker-isolation-dry-run.mjs
node --check tools/phase1312a/verify-worker-isolation-dry-run.mjs
node packages/neural-fabric-runtime/tools/check-worker-isolation-dry-run.mjs
pnpm --filter @unified-ai-system/neural-fabric-runtime check
pnpm run verify:phase1312a-worker-isolation-dry-run
pnpm run verify:phase107a-secret-safety
pnpm -r --if-present check
```
