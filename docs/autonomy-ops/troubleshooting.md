# 故障排查

## 任务被 budget_exhausted 拦
检查 GET /workforce/autonomy/usage。可改 env WORKFORCE_DAILY_* 或重启清当天用量。

## 付费调用被 resource_locked
当前档 conservative 把 providerRequests 钳到 0。切到 balanced/unlimited。

## 候选分支没自动合并
auto-merge 仅 unlimited 档触发。balanced 及以下要人工 git merge workforce/<planId>。

## worktree 创建失败
主树脏不影响 worktree（从 HEAD 创建）。若失败检查是否有进程锁文件（如 dotnet）。

## verify 失败但文件已写
设计如此：失败 → 自动回滚 → worktree + 候选分支删除。文件不会进 main。
