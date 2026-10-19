# ADR-005 Treat Taiji evidenceRef as data-field false positive

- 日期: 2026-09-19
- 状态: 已接受

## 背景

The Taiji source contains evidenceRef-like strings in synthetic trace data, with no import/export/runtime module loading edge. Governance reports an undeclared dependency from taiji-beidou-engine to ai-gateway-service for that file.

## 决定

Classify the edge as parser-false-positive/tool-debt under T-080/T-081; do not add a runtime dependency. Revisit only when the parser supports structured evidence-field exclusion.

## 后果

The undeclared-dependency finding remains until parser support and a fresh audit remove it; runtime boundaries remain unchanged.
