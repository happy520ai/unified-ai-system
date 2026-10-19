# ADR-004 Classify verification consumers as internal-only

- 日期: 2026-09-19
- 状态: 已接受

## 背景

Current governance pagination reports 110 private-interface findings, predominantly from tools, docs/examples, and agent-console verification entrypoints directly importing application internals. These consumers are not production integration surfaces.

## 决定

Classify these edges as internal-only verification/example/tool coupling; do not register production public interfaces merely to reduce audit counts. Production promotion requires migration to stable HTTP/SDK contracts.

## 后果

Governance errors remain visible until parser or consumers migrate; ownership and migration conditions are explicit.
