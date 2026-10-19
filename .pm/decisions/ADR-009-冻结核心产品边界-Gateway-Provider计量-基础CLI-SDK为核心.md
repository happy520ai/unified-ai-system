# ADR-009 冻结核心产品边界：Gateway/Provider计量/基础CLI-SDK 为核心，客户端治理/Workforce/原生权限/候选部署为扩展或实验

- 日期: 2026-09-20
- 状态: 已接受

## 背景

当前阶段名为「维护收缩与核心边界冻结」，T-073 第 1 步要求把模块归为核心 vs 扩展/实验。ADR-003 已决定从功能高覆盖转入维护收缩，但未给出边界清单。治理模型有 26 个模块，kind 取值仅 app/library/tooling/docs/deployment/skills/assets/build-config，无 core/stability 字段；且 upsert_module 是完整替换语义，改 26 个模块的 depends_on 会直接冲击审计输入的依赖模型，风险高于收益，故不用它表达边界。

## 决定

按职责划分三档，不新增模块、不改 kind、不改 depends_on：

【核心（需兼容承诺，修改必须走契约与回归）】ai-gateway-service（网关运行时 + Provider 分发 + 计量/usageLedger）、shared-contracts、shared-sdk、shared-config、shared-utils、agent-console（基础 CLI 部分）、mcp-server、mcp-service。

【扩展（可演进，不承诺对外兼容）】forge-core、workforce-contracts、workforce-scheduler、employee-brain-adapter、position-library、policy-engine、context-codec-core、codex-context-gateway、im-connector-feishu、im-connector-wecom、web-agent、taiji-beidou-engine。

【实验/非产品运行时（不计入核心冻结范围）】deploy（候选部署）、skills、assets、tools、docs、repo-root-config。

关键限制（必须如实记录）：本阶段点名的两类核心边界对象——「客户端治理」与「原生权限/PoP」——**不是独立模块**，它们以 localClient* 能力形式内嵌在 ai-gateway-service 这个核心模块内（含 4713 行的 localClientManagementService.ts 与 Windows 权限/PoP 文件族）。因此模块粒度的边界声明无法表达这个区分：ai-gateway-service 整体被列为核心，但其内部的客户端治理与原生权限子面属于扩展。该区分只能靠路径前缀（apps/ai-gateway-service/src/capabilities/localClient*）表达，或等模块拆分后才能真正入模型。

## 后果

（未记录）
