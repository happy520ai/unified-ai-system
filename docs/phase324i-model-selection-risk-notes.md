# Phase324I Model Selection Risk Notes

- Failed, HTTP 404/410, timeout, high-risk, manual_review_required, and unverified models are excluded from recommendation lists.
- Phase324B-7 passed model is recommended only if Phase324C-6 apply made it smoke_passed/selectable in verification metadata.
- Capability tags are recommendation hints when `inferenceSource=model_id_heuristic`; they are not measured benchmark results.

## High Risk Exclusion List

- deepseek-ai/deepseek-v3.1-terminus: phase324h_high_risk_exclusion
- deepseek-ai/deepseek-v3.2: phase324h_high_risk_exclusion
- google/gemma-7b: phase324h_high_risk_exclusion
- microsoft/phi-3-medium-128k-instruct: phase324h_high_risk_exclusion
- microsoft/phi-4-mini-flash-reasoning: phase324h_high_risk_exclusion
- deepseek-ai/deepseek-v4-flash: phase324h_high_risk_exclusion
- minimaxai/minimax-m2.5: phase324h_high_risk_exclusion

## Failed Exclusion List

- deepseek-ai/deepseek-v3.1-terminus: phase324h_failed_or_not_recommended_retry
- deepseek-ai/deepseek-v3.2: phase324h_failed_or_not_recommended_retry
- deepseek-ai/deepseek-v4-flash: phase324h_failed_or_not_recommended_retry
- google/gemma-7b: phase324h_failed_or_not_recommended_retry
- microsoft/phi-3-medium-128k-instruct: phase324h_failed_or_not_recommended_retry
- microsoft/phi-4-mini-flash-reasoning: phase324h_failed_or_not_recommended_retry
- minimaxai/minimax-m2.5: phase324h_failed_or_not_recommended_retry

