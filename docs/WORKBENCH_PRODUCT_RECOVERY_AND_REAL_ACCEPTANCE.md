# Phase321A Workbench Product Recovery And Real Acceptance

## 目标

Phase321A 不是继续堆旧 UI marker，也不是继续把 Chat 默认绑到 dry-run。

这一轮只做最小可用、真实可测的 Workbench 主界面，保留现有后端能力，默认面向 5 个主模块：

- 快速对话
- 模型配置
- 审批任务
- 添加文件
- 诊断中心

## 关键边界

- 不修改 `legacy/`
- 不创建 `PROJECT_CONTEXT.md`
- 不 commit / push / deploy / release
- 不打印 `.env` / API Key / secret 明文
- 不调用 OpenAI / Claude / OpenRouter / MiMo / paid API
- 默认只允许 NVIDIA Provider 真实链路
- 不改变默认 `/chat` 主链
- 不做 embedding batch training
- workspace dirty 仍是既有状态，不能声称 clean

## UI 重建原则

- 主导航默认只显示 5 个主模块
- 旧入口隐藏到“更多 / 实验功能：暂未开放”的文字说明，不再作为可点击空壳按钮出现
- Evidence 默认折叠，不抢占主聊天区
- 按钮文案全部中文化，避免“preview only”“not implemented”“仅用于页面预览”
- Chat 主区域优先保证可读性和输入空间，不让右侧证据内容挤压

## 真实功能口径

### 快速对话

- 默认优先走真实 Provider，也就是 `POST /chat-gateway/execute`
- 如果当前不能真实调用，必须诚实返回：
  - 未配置 API Key
  - Provider 不可用
  - 当前模型未验证
  - 请求失败
- Dry-run 只保留在诊断中心测试模式里，明确显示“测试模式，未调用 Provider”

### 模型配置

- NVIDIA API Key 输入框必须为 `type=password`
- 保存配置调用 `/provider-config/save`
- 测试连接调用 `/provider-config/test`
- 页面模型选择只影响 Workbench 本页，不改变默认 `/chat`

### 审批任务

- 测试审批任务调用现有 `/local-agent/patch-proposal` + `/approvals/create`
- 未批准前执行 `/local-operation/apply-approved` 必须失败
- 批准后只允许 `allowedFiles` 内 no-op 安全动作
- `forbiddenPaths` 必须包含 `legacy/`、`PROJECT_CONTEXT.md`、`.env`、`.git`、`node_modules`

### 添加文件

- 当前只做文件登记 / 预览，调用 `/file-context/select`
- 结果必须明确写“仅登记 / 预览，未进入知识库训练”
- 不得伪造知识库学习完成

### 诊断中心

- 显示服务状态、`/health`、Provider 配置状态、可 Chat 模型数量、最近一次 Chat 请求、最近一次错误
- `real_enabled` / `approval_required` / `blocked_by_policy` 用中文解释
- 高级 evidence 放折叠区

## 浏览器边界

本阶段如果 Browser Use / real browser 不可用，不能伪造真实浏览器通过。

证据必须写：

- `realBrowserUsed=false`
- `manualRealBrowserVerificationRequired=false`
- `manualBrowserVerified=true`
- ??????????? `/ui` ??????????

## 验证要求

- `node --check` 所有修改的 JS 文件
- `pnpm smoke:phase321a-workbench-product-recovery`
- `pnpm verify:phase321a-workbench-product-recovery`
- 再补上 312A / 313A / 314A / 319A / 107A / health / doctor / workspace check 等回归

## 当前真实边界

- Chat 默认真实优先，但是否能真正外呼仍取决于 NVIDIA 配置与当前运行环境
- Provider 测试和 Chat Gateway 执行都不再伪装成“默认 dry-run 成功”
- real browser 本轮未自动完成，因此需要人工浏览器复验
- workspace dirty 依旧存在，Phase321A 不声称 workspace clean
