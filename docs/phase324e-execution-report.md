# Phase324E Execution Report

## Scope

- Generated a read-only model-library operations report.
- Generated dashboard-oriented operations data.
- Read Phase313A, Phase324A/B/C/D local evidence and docs only.
- Did not call APIs, read `.env`, modify model verification metadata, modify UI,
  modify selectable gate, or modify Chat Gateway.

## Outputs

- `docs/phase324e-model-library-operations-report.json`
- `docs/phase324e-model-library-operations-report.md`
- `docs/phase324e-model-library-operations-dashboard-data.json`
- `docs/phase324e-execution-report.md`

## Operations Metrics

- totalModels: 148
- selectableModels: 9
- smokePassedModels: 9
- failedModels: 9
- unverifiedModels: 125
- provider scope: NVIDIA-only
- multi-provider open: false

## Smoke Performance

- Phase324B: 2 pass / 3 fail
- Phase324B-2: 4 pass / 1 fail
- Phase324B-3: 1 pass / 4 fail
- Total new smoke candidates: 7 pass / 8 fail / 15 processed
- New smoke pass rate: 0.4667
- Final smokePassedModels after original verified models: 9

## Failure Analysis

- HTTP 404: 4
- HTTP 410: 1
- nvidia_http_error: 9
- completionVerified=false: 9
- assistantTextPresent=false: 9
- timeout: 0
- schema invalid: 0

Short-term retry is not recommended for HTTP 404 / 410 models:

- meta/llama2-70b
- meta/llama3-8b
- microsoft/phi-3-mini-4k-instruct
- mistralai/mistral-7b-instruct
- mistralai/mistral-7b-instruct-v0.3

## Latency

- passed average latencyMs: 7702.14
- failed average latencyMs: 699.88
- overall average latencyMs: 3967.6
- fastest model: microsoft/phi-3-mini-4k-instruct, 50ms, smoke_failed
- slowest model: meta/llama-3.1-8b-instruct, 30503ms, smoke_passed
- high-latency models to watch:
  - meta/llama-3.1-8b-instruct: 30503ms
  - meta/llama-3.3-70b-instruct: 18410ms

## Evidence Coverage

- selectable models with evidenceId: 9 / 9
- smoke_failed models with evidenceId: 9 / 9
- unverified models: 125
- missing evidence models: 130
- model-row evidence coverage ratio: 0.1216
- smoke evidence coverage ratio: 1

## Next Stage Recommendations

- Phase324D-2: add UI filtering, sorting, latency badges, provider scope filter,
  and evidenceId search.
- Phase324B-4: continue NVIDIA-only smoke only after excluding 404/410
  short-term retry risks.
- Phase324F: design model selection and default recommendation strategy.
- Phase325A: multi-provider safety design only; no real OpenAI / Claude /
  OpenRouter / MiMo calls.

## Safety Boundary

- NVIDIA API called: false
- Non-NVIDIA API called: false
- Production code modified: false
- UI modified: false
- Selectable gate modified: false
- Chat Gateway modified: false
- Verification metadata modified: false
- Existing evidence modified: false
- EvidenceId fabricated: false
- Commit / push / deploy / release: false
- Workspace clean claimed: false

## Seal Recommendation

Phase324E is recommended for sealing if final verification passes:

- `node tools\phase324e\build-phase324e-model-operations-report.mjs`
- `node --check tools\phase324e\build-phase324e-model-operations-report.mjs`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`
