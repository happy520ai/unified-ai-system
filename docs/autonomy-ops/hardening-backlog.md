# 加固项清单（自审计发现）

## P1
- [ ] executeRoleWithLLM 接入真实 provider，让角色产出源码级补丁而非文本
- [ ] worktree 清理时机：commit 失败时 worktree 未 remove（已在 rollbackWorktree 处理，需加测试）
- [ ] 信任阶梯的冷启动校准（连续走运会过早晋升）

## P2
- [ ] 预算重置：当前只能按日 key，缺"立即清零"admin 接口（resetDayUsage 已有，未暴露 HTTP）
- [ ] 范围令牌的依赖图检查（scope 内文件若 import /chat 逻辑可绕过）

## P3
- [ ] 审计链可签名（防篡改）
- [ ] 预算池支持按 agentId 分桶

> 本清单由 7 角色审计自动汇总，planId: undefined
