# Phase315A Provider Latency / Timeout / Retry / Fallback Accountability

Phase315A hardens the Chat Gateway provider execution chain after Phase314A showed that a task can return HTTP 200 and usable text while still carrying timeout or slow-response risk.

## Goal

The gateway now records provider execution timing and separates these states:

- fast HTTP 200 completion
- slow HTTP 200 completion
- HTTP 200 with handled timeout or slow-response protection
- client/provider/gateway timeout without usable output
- retryable provider failures
- fallback-eligible failures where real fallback was not attempted

This phase does not change default `/chat`. It only enhances `/chat-gateway/execute`, evidence, dry-run policy routes, and UI evidence display.

不改变默认 /chat。

## Why HTTP 200 Is Not Enough

A provider response can be structurally valid while still taking long enough to create operational risk. Phase315A therefore records `durationMs`, `timeoutHit`, `timeoutType`, `latencyRiskLevel`, and `completionConfidence`. A completed result with `timeoutHit=true` can still be verified, but its `completionConfidence` is capped at `medium` and the UI must show that the task completed with latency risk.

## Responsibility Fields

Chat Gateway execution and evidence include:

- `startedAt`
- `completedAt`
- `durationMs`
- `providerTimeoutMs`
- `timeoutHit`
- `timeoutType`
- `lateResponseReceived`
- `httpStatus`
- `retryable`
- `retryRecommended`
- `retryAttempted`
- `retryCount`
- `fallbackEligible`
- `fallbackAttempted`
- `fallbackModel`
- `fallbackReason`
- `latencyRiskLevel`
- `completionConfidence`
- `userVisibleLatencySummary`

Allowed `timeoutType` values are `none`, `client_timeout`, `provider_timeout`, `gateway_timeout`, `handled_slow_response`, and `unknown_timeout`.

Allowed `latencyRiskLevel` values are `normal`, `slow`, `timeout_handled`, `timeout_failed`, and `provider_unavailable`.

Allowed `completionConfidence` values are `high`, `medium`, `low`, and `failed`.

## Completion Rules

- HTTP 200 with normal duration can be `completionConfidence=high`.
- HTTP 200 with `timeoutHit=true` and complete text can be `completionVerified=true`, but only `completionConfidence=medium`.
- Provider timeout without usable output is `completionVerified=false`.
- HTTP 4xx is not retryable by default.
- HTTP 5xx, network failure, timeout failure, and rate limit are retryable and fallback-eligible.
- Rate limit is not pass; real smoke stops further calls when it is detected.

## Retry And Fallback

Phase315A records retry and fallback policy, but it does not perform real fallback by default. Real fallback would require `PHASE315A_ENABLE_REAL_FALLBACK=1`; this phase intentionally leaves `fallbackAttempted=false` to avoid consuming extra NVIDIA free API quota.

## Dry-Run

Run:

```powershell
cmd /c pnpm smoke:phase315a-provider-latency-dry-run
cmd /c pnpm verify:phase315a-provider-latency-timeout
```

Dry-run covers:

- `normal_http_200_fast`
- `http_200_slow_no_timeout`
- `http_200_timeout_handled`
- `client_timeout_no_response`
- `provider_404_not_retryable`
- `provider_500_retryable`
- `rate_limited_retryable`
- `fallback_eligible_but_not_attempted`

Dry-run does not call provider. `providerCalled=false` is required.

## Real NVIDIA Latency Smoke

Run only with explicit opt-in:

```powershell
cmd /c "set PHASE315A_NVIDIA_REAL_SMOKE=1&& set PHASE315A_MAX_REAL_SMOKE_TASKS=2&& pnpm smoke:phase315a-nvidia-latency-timeout"
```

The smoke uses Phase313A selectable chat models only and defaults to `nvidia/llama-3.1-nemotron-nano-8b-v1`. It waits at least 3.1 seconds between requests, which is no more than 20 RPM and stays below the NVIDIA free API 40 RPM limit.

## Boundaries

- Default `/chat` is not changed.
- `/chat-gateway/execute` is preserved and only enhanced.
- No MiMo, OpenAI, Claude, OpenRouter, or paid API is called.
- No embedding batch training is performed.
- No browser one-click real smoke button is added.
- No unverified or non-chat model is called.
- API keys are not printed or displayed.
- Workspace dirty is not a failure, but this phase cannot claim the workspace is clean.
