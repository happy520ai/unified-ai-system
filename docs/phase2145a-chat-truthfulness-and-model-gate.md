# Phase2145A: Chat Truthfulness + Model Gate + Owner Automation Routing Repair

## 阶段目标

修复以下已确认问题：

1. **本地动作请求被普通聊天假完成** — 用户请求"真实创建桌面文件/表格"时，聊天主链误走普通 general_chat，模型输出教程文本，结果被误感知为"已完成"
2. **当前页面模型选择门禁不够前置** — 用户能点到未验证或不允许直接聊天的模型
3. **blocked / preview / completed 三种状态表达不清** — 用户看不懂系统到底有没有真实执行
4. **owner automation 中文文案乱码**
5. **聊天 Markdown 未正确渲染**

## 前置条件

- Phase314A Chat Gateway Task Closure 已通过
- Phase107A Secret Safety 已通过
- Owner Automation Chat Proposal 路由已存在
- create_desktop_spreadsheet 链路已存在

## 禁止事项

- 不修改 legacy/
- 不创建 PROJECT_CONTEXT.md
- 不 commit / push / deploy / release
- 不读取/打印 .env 明文或 API Key
- 不调用 MiMo / OpenAI / Claude / OpenRouter
- 不把泛化"桌面文件"请求扩成任意真实文件写入
- 不让 unverified 模型进入普通 Chat 下拉
- 不把 preview 伪装成 completed
- 不修改默认 /chat 基础 URL 和主路由语义

## 允许修改文件范围

- `apps/ai-gateway-service/src/chat-gateway/chatGatewayTaskMatrix.js`
- `apps/ai-gateway-service/src/chat-gateway/resultCompletionVerifier.js`
- `apps/ai-gateway-service/src/http/httpServer.js`
- `apps/ai-gateway-service/src/ui/consolePage.js`
- `apps/ai-gateway-service/src/ui/copy/ownerAutomationCopy.js`
- `apps/ai-gateway-service/src/entrypoints/verifyPhase2145A*.js`
- `docs/phase2145a-*.md`
- `apps/ai-gateway-service/evidence/phase2145a-*.json`

## 本地动作请求为什么不能由普通聊天直接标记完成

本地桌面动作（如创建表格、CSV 文件）需要：
1. 真实文件系统写入
2. 用户审批
3. 安全边界检查

普通聊天只生成文本回复，不执行任何副作用。如果模型输出了"教程文本"就标记为 completed，用户会误以为文件已创建。

## currentPageModelSelection 新门禁规则

只有同时满足以下条件的模型才能进入普通聊天选择：
- `verificationStatus === "smoke_passed"`
- `selectable === true`
- `directChatAllowed === true`
- `capabilityBucket in ["chat", "reasoning_chat", "code"]`

## create_desktop_spreadsheet 接入边界

- 命中"桌面表格"意图时，路由到 local_action_preview
- 返回 approvalRequired=true
- 不直接执行文件写入
- 泛化"桌面文件"请求触发澄清

## UI 状态语义

| 状态 | 含义 | 视觉 |
|------|------|------|
| blocked | 请求被安全策略拦截 | 红色警告 |
| preview | 请求已识别，需要审批才能执行 | 蓝色信息 |
| completed | 请求已真实完成 | 绿色成功 |

## dry-run 验证范围

- 本地表格请求检测
- 本地文件动作请求检测
- 泛化请求澄清
- 完成判定正确性
- 安全拒绝正确性
- 普通聊天正确性

## sealed/pass 判定

- 所有验证用例通过
- 无安全边界违反
- 无 preview 伪装为 completed

## blocker 判定

- 本地动作被普通聊天标记为 completed
- 未验证模型可被选中进行普通聊天
- 安全拒绝调用了 provider
