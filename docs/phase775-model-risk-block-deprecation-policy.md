# Phase775 Model Risk / Block / Deprecation Policy

## Goal

定义模型 high_risk、blocked、deprecated 判定策略。

## Verified facts

- hardBlocks=raw_secret_policy_violation, blocked, deprecated
- highRiskReasons=sensitive_domain, manual_review_recommended, failed_smoke, wrong_endpoint, rate_limited

## Boundaries

- high_risk, blocked, failed, deprecated, unverified, credential_missing, and cataloged models cannot enter selectable without a future explicit gate.

## Outputs

- modelRiskPolicyReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
