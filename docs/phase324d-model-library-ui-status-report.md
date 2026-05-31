# Phase324D Model Library UI Status Report

## Scope

- Generated read-only model status view data for UI/report use.
- Enhanced the Workbench model configuration page to explain selectable,
  smoke-passed, smoke-failed, and unverified model states.
- Did not change selectable gate logic, Chat request body, provider client,
  `/chat-gateway/execute`, or `httpServer.js`.

## UI Additions

- Summary strip with verified selectable count, smoke-passed count, and
  provider scope `NVIDIA-only`.
- Explicit note that OpenAI / Claude / OpenRouter / MiMo are future-provider
  slots and are not enabled for real calls.
- Verified selectable cards now show capability bucket, providerId, and
  evidenceId.
- Failed models now surface failure reason / non-selectable reason.
- Unverified models now surface missing-evidence / not-selectable guidance.

## Current Verified Selectable Models

- abacusai/dracarys-llama-3.1-70b-instruct
- meta/llama-3.1-70b-instruct
- meta/llama-3.1-8b-instruct
- meta/llama-3.3-70b-instruct
- microsoft/phi-4-mini-instruct
- nvidia/llama-3.1-nemotron-nano-8b-v1
- nvidia/llama-3.3-nemotron-super-49b-v1
- nvidia/nemotron-3-super-120b-a12b
- nvidia/nemotron-mini-4b-instruct

## Failed Model Display Coverage

- nvidia/llama-3.3-nemotron-super-49b-v1.5
- nvidia/nemotron-3-nano-30b-a3b
- nvidia/nvidia-nemotron-nano-9b-v2
- meta/llama2-70b
- meta/llama3-8b
- microsoft/phi-3-mini-4k-instruct
- mistralai/mistral-7b-instruct
- mistralai/mistral-7b-instruct-v0.3

## Safety Boundary

- API calls added: none
- NVIDIA API called: false
- Non-NVIDIA API called: false
- Selectable gate modified: false
- Chat dropdown filtering modified: false
- Chat main chain modified: false
- EvidenceId fabricated: false
