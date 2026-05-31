# Phase3989A Workbench 顶层信息架构补齐

## 阶段目标

在不修改默认 `/chat`、不修改 `/chat-gateway/execute`、不修改 Provider 运行时行为的前提下，把当前 Workbench 缺失的一线板块补齐为真实可达、非空壳、按钮可用的页面。

## 本阶段边界

- 不修改 `legacy/`
- 不创建 `PROJECT_CONTEXT.md`
- 不 commit / push / deploy / release
- 不读取或打印 `.env`、API Key、secret、token
- 不触发 OpenAI / Claude / OpenRouter / MiMo / paid API
- 不改变默认 `/chat` 行为
- 不改变 `/chat-gateway/execute` 主链
- 不把 `local-agent / repair / help` 做成新的顶层 `data-nav`

## 本阶段新增页面

- `data-page="local-agent"`
- `data-page="repair"`
- `data-page="help"`

这三个页面必须通过现有五按钮主工作台中的内部入口进入，而不是改变 `Phase321A` 既有五按钮主导航。

## 页面要求

### local-agent

- 提供任务输入框
- 提供 `allowedFiles` 输入框
- 提供意图预览、操作计划、patch proposal、创建审批四个动作按钮
- 真实调用现有路由：
  - `POST /local-agent/intent-preview`
  - `POST /local-agent/operation-plan`
  - `POST /local-agent/patch-proposal`
  - `POST /approvals/create`
- 输出必须显示真实返回，不得伪造成功

### repair

- 不是直接执行器
- 只负责解释安全修复边界
- 可以把修复任务和 `allowedFiles` 预填到 `local-agent` 页面
- 不得直接 apply patch

### help

- 不是空白说明页
- 必须清楚写明：
  - 如何使用聊天
  - 如何使用模型配置
  - 如何使用本地智能体与审批链
  - 哪些动作被策略阻断
  - 没有触发 Provider 时要明确告知

## 不可破坏项

- `data-nav="chat" / "models" / "approvals" / "files" / "diagnostics"` 继续保持 5 个
- 不新增 `data-nav="local-agent" / "repair" / "help"`
- 页面中仍保留 `/chat-gateway/execute`
- 页面中仍保留现有审批链与文件登记链

## 验证命令

- `node --check apps/ai-gateway-service/src/ui/consolePage.js`
- `node --check apps/ai-gateway-service/src/entrypoints/smokePhase3989AWorkbenchTopLevelIaRepair.js`
- `node --check apps/ai-gateway-service/src/entrypoints/verifyPhase3989AWorkbenchTopLevelIaRepair.js`
- `pnpm smoke:phase3989a-workbench-top-level-ia-repair`
- `pnpm verify:phase3989a-workbench-top-level-ia-repair`
- `pnpm verify:phase321a-workbench-product-recovery`
- `pnpm verify:phase107a-secret-safety`
- `pnpm sync:readme-agents-current-state`
- `pnpm verify:phase306c-readme-agents-auto-sync-guard`

## sealed / pass 条件

- smoke 与 verifier 全部通过
- `local-agent / repair / help` 三页真实存在
- 现有五按钮主导航未破坏
- 默认 `/chat` 与 Provider 主链未改
- 不暴露 secret
- 不声称 workspace clean
