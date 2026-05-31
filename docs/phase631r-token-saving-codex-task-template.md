# Phase631R-Fix Token-Saving Codex Task Template

你只能读取：

- .codex-context/current-context-pack.md
- .codex-context/relevant-files.json 中列出的文件

必须先检查：

- .codex-context/context-freshness-report.json
- stale=false
- relevant files 数量不超过 hard limit
- task scope explicit

不得全仓扫描。
不得反复读取无关历史。
不得读取 secret。
不得读取 auth.json。
不得读取 webhook 或 raw base_url。
不得修改未列入 allowedFiles 的文件。
不得修改 /chat，除非当前阶段明确授权。
不得修改 /chat-gateway/execute，除非当前阶段明确授权。
不得调用 Provider，除非当前阶段明确授权。

执行输出必须包含：

- 修改文件
- 验证命令
- 边界确认
- 是否读取 auth.json
- 是否暴露 secret/raw base_url/webhook
- 是否修改 /chat 或 /chat-gateway/execute
- 是否 deploy/release/tag/push/commit

如需读取 relevant-files.json 之外的文件，必须先停止并说明原因，不得自行扩大读取范围。
