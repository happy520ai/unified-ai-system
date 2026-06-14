# 自主权系统架构

> 由 unified-ai-system 自审计冲刺自动生成（planId: undefined）

## 三层钳制链

```
前端开关 (POST /workforce/tier)
   ↓ 设置 tier
autonomyTierGovernor  ──→ autonomyBudget (consume 时取 min(配置, 档位cap))
   ↓ 钳制 autonomyMode
workforceControlledExecutor.execute()
   ↓ 分发
sandboxMergeExecutor (worktree 全开 + verify 门 + 自动回滚)
   ↓ verify 全绿
auto-merge candidate → master (仅 unlimited 档)
```

## 三档

| 档 | providerRequests | sandboxMutations | autonomyMode |
|----|------------------|------------------|--------------|
| conservative | 0 (锁) | 500k | sandbox-merge (人工合并) |
| balanced | 10k | 800k | sandbox-merge (人工合并) |
| unlimited | 500k | 1M | sandbox-merge-auto (自动合并) |

## 永恒禁面（任何档都碰不到）

/chat, /chat-gateway/execute, provider runtime, .env, auth.json, .git, legacy/, deploy, release
