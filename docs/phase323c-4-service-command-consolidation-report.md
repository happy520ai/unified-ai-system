# Phase323C-4 Service Command Consolidation Report

## 范围

- 本轮只处理 `apps/ai-gateway-service/package.json` 的推荐入口收敛。
- 不删除任何 service scripts。
- 不移动任何 entrypoints。
- 不修改任何既有 `verify:*` 命令语义。

## 新增工具

- [tools/phase323c/build-phase323c-service-command-index.mjs](/E:/AI-Data/AI网关系统/unified-ai-system/tools/phase323c/build-phase323c-service-command-index.mjs)

该工具只读以下输入：

- [apps/ai-gateway-service/package.json](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/package.json)
- [docs/phase323c-script-entrypoint-inventory.json](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-script-entrypoint-inventory.json)
- [docs/phase323c-script-governance-policy.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-script-governance-policy.md)

输出：

- [docs/phase323c-service-recommended-command-index.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-service-recommended-command-index.md)
- [docs/phase323c-service-command-governance-policy.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-service-command-governance-policy.md)

## Service alias

已在 [apps/ai-gateway-service/package.json](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/package.json) 新增 3 个 alias：

- `inventory:phase323c`
- `governance:phase323c`
- `commands:phase323c`

路径均使用相对 `../../tools/phase323c/...`，已实际执行验证通过。

## 结论

- service package 推荐入口已经具备最小可用收敛层
- 历史脚本仍完整保留
- 当前阶段仍以“文档索引 + 推荐入口”治理为主，不做删除或迁移
