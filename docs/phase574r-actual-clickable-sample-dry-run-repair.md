# Phase574R Actual Clickable Sample Dry-run Experience Repair

## 背景

Phase574 已新增 sample dry-run 入口，但用户实际打开的 Workbench / Mission Control 页面仍反馈“点什么都没反应，怎么用都不知道”。Phase574 的验证不足之处在于主要确认了 DOM 和截图，没有真实点击验证用户实际 surface 的按钮反馈。

## 根因

排查确认两个问题：

1. `scenarioTrialCopy.js` 的中文 copy 在实际页面中出现编码损坏，用户难以识别“试用一个任务”。
2. `consolePage.js` 生成的浏览器脚本中存在未转义的换行字符串，导致浏览器抛出 `SyntaxError: Invalid or unexpected token`，整段前端脚本未执行，因此按钮点击没有响应。

## 修复

- 将 sample dry-run 入口提前到 First-Run Tour 之前，首屏更清楚。
- 将 sample dry-run 入口改为真实 button，不再只是锚点。
- 将 dry-run result panel 默认隐藏，点击“开始 sample dry-run”后真实展开。
- 增加独立 sample dry-run 捕获事件处理，避免旧 UI 初始化失败影响核心体验入口。
- 修复 `consolePage.js` 中浏览器脚本的未转义换行字符串。
- 修复 Skip：点击后隐藏 First-Run Tour，并聚焦到 sample dry-run 入口。
- 修复“查看执行详情”：没有真实执行时也打开 sample dry-run detail drawer。

## 点击验收

Phase574R verifier 使用真实 Chromium 打开 `/ui?phase574r=real-click`，并真实点击：

- 开始 sample dry-run
- 查看安全盾
- 查看 Evidence Replay
- Skip
- 查看执行详情

验证结果：

- clickStartSampleDryRunWorks=true
- dryRunResultPanelVisible=true
- skipButtonResponds=true
- viewDetailsButtonResponds=true
- deadButtonDetected=false

## 边界

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- Yiyi / character remains hidden
- 未修改 `/chat`
- 未修改 `/chat-gateway/execute`
- 未修改 provider runtime
- 未修改 selectable gate
- workspaceCleanClaimed=false

