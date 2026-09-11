# Repository Guidance

## Ownership

- `apps/agent-console` owns operator interaction.
- `apps/ai-gateway-service` owns gateway runtime and Workbench behavior.
- `packages/shared-contracts` owns public protocol types.
- `packages/shared-sdk` owns reusable clients and adapters.
- `packages/shared-config` owns shared configuration.
- `packages/shared-utils` owns implementation-neutral helpers.

## Language and Module Policy

- For new changes, `apps/agent-console` and `apps/ai-gateway-service` should
  prefer TypeScript for runtime behavior and refactors.
- `packages/*` should remain TypeScript-first for contracts, SDKs, shared engines,
  and utility layers.
- Tooling scripts under `tools/*.mjs` should remain Node.js ESM JavaScript.
- Use JSON for schema and contract payloads, and Markdown for runbooks,
  evidence, and operator documentation.
- Introducing a new runtime language (for example Go or Rust) requires a measured
  rationale, migration boundary, and compatibility plan in the PR.
- For every PR that touches runtime code or scripts, follow
  [Language Selection Playbook](/docs/language-selection-playbook.md):
  define the workload, compare alternatives, document why the selected language is
  the best fit, and capture rollback/compatibility impact.  
  PRs that do not include a `Language Selection` section using the playbook
  checklist are not considered merge-ready.

## Public Repository Rules

- Keep application entrypoints under `apps/`.
- Keep reusable contracts, SDKs, configuration, and engines under `packages/`.
- Do not add generated phase ledgers, one-off verifier trees, or committed
  runtime evidence to `master`.
- Generated evidence belongs under `apps/ai-gateway-service/evidence/` and is
  ignored except for its README.
- Historical engineering artifacts belong on the archive branch, not in the
  public product tree.
- Do not recreate `legacy/`.

## Safety

- Never read, print, or commit provider keys, `.env`, raw webhooks, or private
  authorization records.
- Real provider calls require explicit scoped authorization.
- Keep the local fake provider as the credential-free default.
- Do not silently modify `/chat`, provider selection, deployment, or release
  behavior.
- Do not claim production readiness, L5 autonomy, or AGI without independent
  evidence.

## Change Discipline

- Keep changes focused, reversible, and consistent with existing ownership.
- Do not delete runtime code merely because a filename looks old.
- Use structured parsers for JSON and configuration changes.
- Preserve user changes in a dirty worktree.

## Required Checks

Run these before publishing:

```bash
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
```

The public-clone verifier must run without credentials and must leave no
service process behind.

<!-- BEGIN CODEX MANAGED: UNIFIED-AI-SYSTEM -->
# Unified AI System 项目执行边界

## 范围与所有权

- 遵守本文件既有的应用和包所有权；改动放入拥有该行为的最小模块，不创建平行实现或新的历史树。
- 审计发现不等于获准一次性采用整份审计建议。只修复当前目标必需、阻断验收或由本次修改造成的问题；相邻独立问题记录后停止。
- 保留“本地所有应用客户端软件的智能化管理”与模型网关的既有产品边界，不把客户端管理悄然缩减为单纯模型路由。

## 凭据、Provider 与运行时

- 本地 fake provider 是无凭据默认路径。真实 Provider 调用必须获得本次任务的明确、限定授权，并单独报告调用范围和证据。
- 永不读取、打印、修改或提交 `.env`、`.mcp.json`、真实 Provider Key、OAuth 会话、原始 webhook 或私有授权记录；用户明确提供的临时凭据也不得写入持久化规则、日志或证据目录。
- 不静默改变 `/chat`、Provider 选择、模型路径、原生登录、Base URL、配额、部署或发布行为。
- 分开陈述工作树内容、`HEAD`、`master`、标签、当前运行进程和生产环境；文件存在或本地测试通过不等于运行时已加载、远端已发布或生产已验证。

## 变更与验证

- 先检查脏工作树并保留用户修改。不得覆盖、回退、暂存、提交或推送与当前目标无关的文件。
- TypeScript 运行时代码、共享契约、SDK 和工具脚本遵守既有语言与模块策略；若触发 Language Selection 要求，补齐所需说明，不以重写语言扩大范围。
- 从直接测试开始，再运行受影响模块和集成测试。触及共享接口、共享依赖、发布路径或准备发布时，执行仓库既定门禁：`pnpm check`、`pnpm test`、`pnpm check:public`、`pnpm verify:public-clone`。
- 不以 fake-provider、合成测试、进程发现或单次 smoke 冒充真实 Provider、跨主机高可用、灾难恢复、生产稳定性、市场采用或行业领先证据。
- 生成的运行证据仅放入既有忽略目录；不向公共产品树添加一次性验证器、阶段账本、原始日志、数据库或凭据材料。

## 外部操作

- 未经当前用户明确授权，不执行 GitHub 推送、PR 合并、标签、Release、部署、生产修改、真实付费调用、远程配置治理或不可逆数据操作。
- 当目标和项目门禁已满足时立即停止；不自动延伸到全仓重构、基础设施升级、生产投放或下一阶段路线图。
<!-- END CODEX MANAGED: UNIFIED-AI-SYSTEM -->
