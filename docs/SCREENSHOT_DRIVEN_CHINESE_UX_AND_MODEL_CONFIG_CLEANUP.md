# Phase308C Screenshot-driven Chinese UX And Model Config Cleanup

## A. Phase308C 目标和边界

Phase308C 是截图驱动的最终产品体验补丁，目标是让 `/ui` 在中文模式下更像用户可理解的 AI Gateway Workbench，而不是英文调试后台。

本阶段只修改 UI、文案、前端交互、静态 verifier、evidence，以及 README / AGENTS managed block 同步。它不修改后端 route，不改变 `/chat` 默认链路，不修改 provider、agent-runner、patch runner 或 auto review 逻辑。

## B. 用户截图暴露的问题

截图暴露的问题包括中文模式英文残留、侧边栏副标题混排、Inspector 调试字段、Local Agent 英文字段、模型配置入口不明显、Repair Center 不像安全修复入口、Help 不像说明书、页面空壳感、无意义按钮，以及缺少侧边栏收起 / 展开按钮。

## C. 中文模式清理范围

中文模式下普通用户可见标题、按钮、字段、placeholder、Inspector、Help、Repair Center、Local Agent 和空状态均以中文为主。允许保留的技术词包括 AI Gateway Workbench、Chat、Local Agent、API、RAG、Provider、NVIDIA、allowedFiles、dryRun、go/no-go、evidence、rollback、JSON、Git、MCP、token、Base URL、Model ID、README、AGENTS、verifier 和 consolePage.js。

## D. Sidebar 简化设计

中文侧边栏改为单一中文主标签：快速对话、全局搜索、知识库、模型配置、本地智能体、审批任务、安全修复、使用帮助、系统设置、诊断中心。副标题只保留中文短句。

## E. Sidebar 收起 / 展开按钮设计

顶部左侧加入小型侧边栏按钮，绑定 `data-workbench-action="toggle-sidebar"`。它支持点击和 `Ctrl+B`，状态写入 `localStorage` 的 `aiGatewayWorkbenchSidebarCollapsed`，折叠时主工作区自动扩展。

## F. 模型配置核心入口恢复

模型配置恢复为一级入口：左侧导航、顶部按钮、Chat composer 和 Settings 都能进入模型配置页。Models 页面包含当前 Provider、Model ID、默认 `/chat` 链路、API Key 状态、Base URL、Model ID 输入和禁用保存原因。

## G. Inspector 中文化和用户化

Inspector 改为“当前上下文”，只显示当前任务、安全边界、审批与文件、证据 / 回滚四类卡片。中文模式下不再显示 permissionMode、approvalRecord、next step 等英文调试标签。

## H. Local Agent 中文化

Local Agent 保留受控闭环，但按钮改为确认执行、预览意图、生成补丁方案、批准应用、运行自动审查、停止 / 重置当前操作。字段显示权限模式、允许文件、意图类型、风险等级、建议权限模式、阻止原因和下一步。

## I. 自动化确认执行入口设计

新增“确认执行”主按钮。它读取任务输入，空任务时提示先输入任务；有任务但 allowedFiles 为空时高亮允许文件输入并阻断继续；只有任务和 allowedFiles 都存在时才进入意图预览。它不会自动 approve、不会自动 apply、不会绕过 Auto Review。

## J. Repair Center 安全修复入口

Repair Center 中文标题改为“安全修复”，主按钮为“开始安全修复”。点击后只切换到本地智能体，填入安全修复模板，高亮 allowedFiles，并提示先填写允许文件，不自动批准、不自动应用、不运行命令。

## K. Help 说明书化

Help 保留系统介绍、新手三步、模块说明、Local Agent 用法、allowedFiles 填写、模型配置、安全修复、Full-open 禁用原因和 FAQ。它是用户说明书，不是工程碎句。

## L. 无用按钮清理

保留按钮必须满足三类之一：可导航、有现有 handler、或明确 disabled reason。模型保存和连接测试保持 disabled，并显示当前仅为 UI 配置入口，不会写入 secret。

## M. i18n key 补齐

补齐 sidebar、模型配置、Inspector、Local Agent、Repair、automation confirm run、Help 和 common unavailable reason 等 key，并继续支持 `zh-CN` 和 `en-US`。

## N. 安全禁项

页面不得出现 full_open 可选项、commit / push / deploy / release 执行按钮、workspace cleanup、git reset、git clean、一键全仓 apply 或一键全仓 repair。安全提示继续显示 Full-open 已禁用、不会 commit / push / deploy / release、.env / secrets 已阻止、legacy/ 已阻止、workspace dirty 不等于 clean。

## O. 不新增执行能力说明

Phase308C 不新增真实执行能力。确认执行只是进入受控预览流程；Repair Center 只是引导用户进入 Local Agent；模型配置保存和连接测试没有后端 handler 时保持 disabled。

## P. 验收清单

- 中文模式主要页面、按钮和 Inspector 为中文。
- 模型配置入口明显。
- 侧边栏可点击收起 / 展开并持久化。
- `Ctrl+B` 可切换侧边栏。
- 确认执行不会绕过审批。
- allowedFiles 为空时阻断继续 apply。
- Repair Center 是安全修复入口。
- Help 是系统说明书。
- Button QA deadButtonsFound=0。

## Q. 不可声称能力

不得声称 workspace clean，不得声称新增 provider 保存能力，不得声称自动全仓修复、自动 commit、自动 push、自动 deploy、自动 release、读取 secret 或 full-open 可用。

## R. 后续建议，但不要执行

下一步可以让用户重新打开 `http://127.0.0.1:3100/ui?ts=308c` 截图验收；如果仍有具体截图问题，再进入后续小补丁阶段，不自动开始 Phase309。
