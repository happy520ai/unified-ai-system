# Phase568 Low-Risk Fix Candidates

## Status

Real internal trial feedback now exists, so Phase568 can promote a first batch of low-risk copy and hierarchy candidates. These are candidates only and must not be implemented inside Phase568B.

## Candidate List

### 1. Add one-line mode summaries

- Normal Mode:
  `单模型直聊：选择一个已配置模型，预览一次普通任务响应。`
- God Mode:
  `多模型互审：让多个候选模型互相检查，再由 supervisor 汇总。`
- Tianshu Mode:
  `任务规划：先理解任务，再建议模型组合与执行路线。`

### 2. Reduce repeated guarded / pending / telemetry copy

- Collapse repeated boundary reminders that currently appear almost unchanged across the three mode surface.
- Keep one strong dry-run / no-provider-call boundary, but avoid repeating the full state block three times.

### 3. Button wording candidates

- `运行普通模式` -> `预览普通模式结果`
- `运行 God Mode` -> `预览 God Mode 方案`
- `运行天枢模式` -> `预览天枢规划`
- `测试连接` -> `检查配置状态（不调用真实任务）`
- `执行已批准安全动作` -> `预览已批准动作说明`
- `批准 / 拒绝` -> add dry-run context such as `批准此 dry-run 候选 / 拒绝此 dry-run 候选`

### 4. Security Shield explanation candidates

- Reframe as `它保护什么 / 它不做什么`
- Keep protections visible:
  - prompt injection
  - secret leak
  - provider bypass
  - dangerous action
  - budget / quota risk
- Keep non-claims visible:
  - not a completed production security audit
  - does not auto-execute real provider calls

### 5. Tianshu emphasis candidate

- Move the planner value explanation ahead of dense status fields so the user first understands why Tianshu exists.

### 6. Evidence Replay stability candidate

- Keep Evidence Replay wording stable and avoid over-editing the clearest current product area.

## Not Allowed In Phase568B

- UI implementation
- runtime changes
- provider calls
- secret handling changes
- billing / invoice
- deploy / release / tag / artifact upload
- Yiyi / character restoration
- `/chat-gateway/execute` change
- provider runtime change
- selectable gate change

## Recommendation

The next safe follow-up phase can implement a small copy-only repair pass focused on mode summaries, button wording, Security Shield framing, and Tianshu positioning.

Boundary remains:

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- Yiyi / character remains hidden
