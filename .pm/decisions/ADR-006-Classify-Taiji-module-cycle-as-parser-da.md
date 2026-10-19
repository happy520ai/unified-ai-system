# ADR-006 Classify Taiji module cycle as parser data-reference debt

- 日期: 2026-09-19
- 状态: 已接受

## 背景

The Taiji package has no runtime imports of ai-gateway-service; its references are evidenceRef, lastEvidenceRef, executionRef, bridgeDryRunRef and evidence data strings. The ai-gateway-service imports Taiji runtime capabilities, but the reverse edge is not a runtime edge in the source.

## 决定

Treat the reported taiji-beidou-engine -> ai-gateway-service edge and resulting module-cycle as parser-false-positive/tool-debt under T-080/T-081. Preserve the current runtime dependency graph and do not add or remove package dependencies solely to change audit counts.

## 后果

The module-cycle finding remains visible as a parser/data-reference debt until the analyzer excludes structured evidence fields and a fresh audit confirms the result. No package dependency changes are made.
