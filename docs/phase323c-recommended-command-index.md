# Phase323C Recommended Command Index

以下命令是当前长期推荐入口。历史脚本仍保留，但不应作为默认入口继续扩散。

## 基础健康

- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

## Workbench 主链

- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`

## 模型库

- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase312a-unified-model-library`

## 安全

- `cmd /c pnpm run verify:phase107a-secret-safety`

## inventory

- `cmd /c node tools\phase323c\build-phase323c-inventory.mjs`
- `cmd /c node tools\phase323c\build-phase323c-script-governance.mjs`
