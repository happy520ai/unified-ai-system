# ADR-008 shared-contracts 如实声明 javascript 而非回避 .js 配置文件

- 日期: 2026-09-19
- 状态: 已接受

## 背景

shared-contracts 的测试原先由裸 node --test 执行，无法解析 TypeScript ESM 的 ./index.js 到 .ts 源文件。修复需要 package-local vitest 配置。仓库根已使用 vitest.config.js（JavaScript），而该模块 governance 只声明了 typescript，于是 audit_governance 报 module-language-drift。

## 决定

新增 packages/shared-contracts/vitest.config.js 作为 package-local Vitest 配置，并在治理模型中如实把 javascript 加入 shared-contracts 的 languages（不改成 .ts 变体来回避声明）。理由：文件确实是 JavaScript，模块内存在 .js 就必须如实声明，而不是为了让审计数字变小去改变文件扩展名或来源结构。

## 后果

shared-contracts 模块 languages 由 json+markdown+typescript 变为 javascript+json+markdown+typescript，module-language-drift 消除。代价是：该包今后需对 .js 配置文件同样遵守质量门禁。若后续把 vitest 配置改为 .ts 并移除 .js 文件，可再回收该声明。
