# ADR-007 Classify six intra-gateway file cycles as refactor debt

- 日期: 2026-09-19
- 状态: 已接受

## 背景

Six intra-gateway file cycles were reported. Source review shows: (1) roleExecutors.js↔roleExecutorsLlm.js is a barrel re-export plus EXECUTOR_MAP runtime import; (2) governedAgentTaskProfile.ts↔workforceNodeTestVerification.ts is a runtime helper import pair; (3) localClient*Toml/Jsonc/Transaction/ContinueYaml form a parser-transaction cycle; (4) localClientNativePopReplayRuntime↔identity/snapshot/sqlite/native authority cycle; (5) idempotencyCoordinator↔postgres/sqliteCoordinator is a factory-registry cycle; (6) agentApprovalStore↔agentGovernanceService↔toolProxy↔governedWebTaskRuntime↔workforceCodeDeliveryRuntime is a larger cross-domain cycle.

## 决定

Classify all six as tool-debt/intentional internal architecture requiring targeted refactor with regression tests. Do not rewrite module boundaries now; only record ownership and migration conditions.

## 后果

The six file-cycles stay visible as warnings until a deliberate refactor with regression coverage; no runtime behavior is changed now.
