# Forge — 目标驱动的端到端自主编码系统架构设计

> **代号**: Forge（锻造）
> **定位**: 超越 Codex 和 Claude Code 的目标驱动自主编码协作平台
> **基座**: unified-ai-system 现有治理基础设施
> **日期**: 2026-06-09

---

## 一、问题诊断

### 1.1 现有系统的核心矛盾

unified-ai-system 经过 4000+ 阶段的迭代，建了一套极其精密的**治理基础设施**：Phase 生命周期管理、GVC 自治循环、风险分级门禁、审计追踪、多角色 Workforce。但它的核心矛盾是——**有治理无执行**。

具体表现：
- **没有目标分解能力**：目标靠人工定义在 `goals.json` 里，系统无法自动拆解
- **没有代码生成能力**：Workforce agents 输出的是计划文档，不是代码
- **执行全面默认 dry-run**：`runner-control.json` 里 `dryRunOnly: true`、`noProvider: true`
- **依赖外部工具写代码**：实际编码通过 Codex/OpenCode 桥接（剪贴板粘贴+文件轮询），链路脆弱
- **Phase 系统过度膨胀**：4000+ 阶段的边际收益急剧下降，治理成本远超执行价值

### 1.2 Codex 和 Claude Code 的盲区

| 盲区 | Codex | Claude Code | 我们的机会 |
|------|-------|-------------|-----------|
| 长任务断点续传 | 不支持，任务失败必须重头 | 不支持，会话断即丢失 | **检查点+恢复** |
| 深度代码理解 | 表面搜索 | 较深但仍是文本级 | **AST/类型感知语义图** |
| 多用户协作 | 单用户任务 | 单用户终端 | **共享 Agent Pool** |
| 元认知纠错 | 测试-重试循环 | 4 层错误处理 | **方法多样性强制+置信度校准** |
| 混合执行 | 仅云端沙箱 | 仅本地 | **云端隔离+本地全能力** |
| 自适应上下文 | 简单摘要 | 5 级压缩 | **重要性加权+任务感知** |
| 事务性编辑 | diff 补丁 | old/new 字符串 | **AST 感知事务编辑** |

---

## 二、系统架构总览

```
                        ┌─────────────────────────────────┐
                        │          用户 / 团队             │
                        │   (Web Console / CLI / API)      │
                        └──────────────┬──────────────────┘
                                       │  提交目标
                                       ▼
              ┌────────────────────────────────────────────────────┐
              │              Forge Commander（核心引擎）             │
              │                                                     │
              │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
              │  │ Goal     │→ │ Task     │→ │ Execution        │  │
              │  │ Compiler │  │ Planner  │  │ Orchestrator     │  │
              │  └──────────┘  └──────────┘  └──────────────────┘  │
              │       │             │                │              │
              │       ▼             ▼                ▼              │
              │  ┌──────────────────────────────────────────────┐  │
              │  │          Persistent Task Store (SQLite)       │  │
              │  │     目标 → 子任务 DAG → 检查点 → 结果证据      │  │
              │  └──────────────────────────────────────────────┘  │
              └────────────────────────┬───────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
        ┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
        │  Code Intelligence│ │  Worker Agents  │ │  Verification    │
        │  Layer            │ │  Pool           │ │  Engine          │
        │                   │ │                 │ │                   │
        │ • AST Parser      │ │ • Coder Agent   │ │ • Test Runner     │
        │ • Dependency Graph│ │ • Review Agent  │ │ • Type Checker    │
        │ • Impact Analyzer │ │ • Test Agent    │ │ • Lint/Format     │
        │ • Context Engine  │ │ • Debug Agent   │ │ • Smoke Tester    │
        │ • Codebase Index  │ │ • Refactor Agent│ │ • Evidence Vault  │
        └──────────────────┘ └─────────────────┘ └──────────────────┘
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       ▼
              ┌────────────────────────────────────────────────────┐
              │           AI Gateway（已有，生产就绪）                │
              │   多 Provider 路由 / Fallback / Retry / Streaming   │
              │   Xiaomi MiMo / NVIDIA / OpenAI / 本地模型           │
              └────────────────────────────────────────────────────┘
                    │
                    ▼
              ┌────────────────────────────────────────────────────┐
              │           Governance Shell（已有，增强）              │
              │   风险门禁 / 权限引擎 / 审计追踪 / 回滚清单           │
              └────────────────────────────────────────────────────┘
```

---

## 三、核心模块设计

### 3.1 Goal Compiler（目标编译器）

**职责**：接收用户的自然语言目标，编译为结构化的可执行计划。

```
输入："给用户模块添加 JWT 认证，包括登录、注册、Token 刷新，写好测试"
                          │
                          ▼
              ┌───────────────────────┐
              │  Goal Analysis (LLM)  │
              │  • 意图识别            │
              │  • 范围界定            │
              │  • 约束提取            │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Codebase Probing     │
              │  • 现有用户模块在哪？   │
              │  • 用了什么框架？       │
              │  • 已有哪些中间件？     │
              │  • 测试框架是什么？     │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Task DAG Generation  │
              │  有向无环图 + 依赖边    │
              └───────────────────────┘
```

**输出示例（Task DAG）**：

```json
{
  "goalId": "g-001",
  "goal": "Add JWT authentication to user module",
  "status": "planned",
  "tasks": [
    {
      "id": "t1",
      "name": "分析现有用户模块结构",
      "type": "explore",
      "agent": "code-archaeologist",
      "dependsOn": [],
      "estimatedMinutes": 5
    },
    {
      "id": "t2",
      "name": "设计 JWT 认证方案",
      "type": "plan",
      "agent": "architect",
      "dependsOn": ["t1"],
      "estimatedMinutes": 10
    },
    {
      "id": "t3",
      "name": "实现注册接口",
      "type": "implement",
      "agent": "coder",
      "dependsOn": ["t2"],
      "allowedFiles": ["src/auth/**", "src/user/**"],
      "estimatedMinutes": 20
    },
    {
      "id": "t4",
      "name": "实现登录接口",
      "type": "implement",
      "agent": "coder",
      "dependsOn": ["t2"],
      "allowedFiles": ["src/auth/**"],
      "parallelWith": "t3",
      "estimatedMinutes": 15
    },
    {
      "id": "t5",
      "name": "实现 Token 刷新",
      "type": "implement",
      "agent": "coder",
      "dependsOn": ["t4"],
      "estimatedMinutes": 15
    },
    {
      "id": "t6",
      "name": "编写单元测试",
      "type": "test",
      "agent": "tester",
      "dependsOn": ["t3", "t4", "t5"],
      "estimatedMinutes": 20
    },
    {
      "id": "t7",
      "name": "集成测试 + 验证",
      "type": "verify",
      "agent": "verifier",
      "dependsOn": ["t6"],
      "estimatedMinutes": 10
    }
  ],
  "checkpoints": ["after_t2", "after_t5", "after_t7"],
  "rollbackPoints": ["before_t3", "before_t6"],
  "budget": { "maxTokens": 500000, "maxMinutes": 120, "maxCost": 5.0 }
}
```

**关键设计**：
- **Codebase Probing** 阶段是强制的——先理解再动手，这是 Codex 和 Claude Code 都做得不够好的地方
- **Task DAG** 支持并行执行（t3 和 t4 无依赖可并行）
- **Budget** 预算控制防止失控
- **Checkpoint/Rollback** 在自然边界自动创建快照

### 3.2 Task Planner（任务规划器）

**职责**：将 Task DAG 转化为执行调度计划，管理依赖、并行度、资源分配。

核心能力：
- **依赖解析**：拓扑排序 Task DAG，识别关键路径
- **并行调度**：无依赖关系的任务自动并行执行
- **动态重规划**：任务失败时重新计算后续 DAG
- **资源感知**：根据可用 Worker 数量和模型负载调整并发度
- **成本预算**：每个任务估算 token 消耗，超出预算时暂停等待确认

```
执行调度引擎状态机：

  PLANNED ──→ QUEUED ──→ RUNNING ──→ COMPLETED ──→ VERIFIED
                 │          │                          │
                 │          ▼                          │
                 │       FAILED ──→ RETRY ──→ ESCALATE │
                 │          │                          │
                 │          ▼                          │
                 │       REPLAN ──→ QUEUED (新 DAG)    │
                 │                                     │
                 └──── BLOCKED (等待审批/确认) ─────────┘
```

### 3.3 Execution Orchestrator（执行编排器）

**职责**：调度 Worker Agents 执行具体任务，管理执行生命周期。

这是系统的**心脏**，对标 Codex 的沙箱编排和 Claude Code 的 queryLoop，但更强：

```
                    ┌─────────────────────────────┐
                    │    Execution Orchestrator    │
                    │                              │
  Task Queue ──────→│  ┌──────────────────────┐   │──────→ Results
                    │  │  Worker Pool Manager  │   │
  Model Pool ──────→│  │  • Spawn workers     │   │──────→ Evidence
                    │  │  • Monitor progress   │   │
  Config ──────────→│  │  • Handle failures    │   │
                    │  │  • Enforce budgets    │   │
                    │  └──────────────────────┘   │
                    │                              │
                    │  ┌──────────────────────┐   │
                    │  │  Checkpoint Manager   │   │
                    │  │  • Auto-snapshot      │   │
                    │  │  • Rollback support   │   │
                    │  │  • Resume from any    │   │
                    │  │    checkpoint         │   │
                    │  └──────────────────────┘   │
                    └─────────────────────────────┘
```

**对比优势**：

| 能力 | Codex | Claude Code | Forge |
|------|-------|-------------|-------|
| 并行执行 | 8 个云端沙箱 | 单线程+子代理 | 本地多 Worker 并行 |
| 执行环境 | 隔离沙箱（无网络） | 本地（有网络） | **可配置隔离级别** |
| 断点续传 | 不支持 | 不支持 | **检查点+恢复** |
| 失败恢复 | 重试或失败 | 4 层处理 | **元认知+方法多样性** |
| 会话持久化 | 无 | 会话内 | **跨会话持久化** |

### 3.4 Code Intelligence Layer（代码智能层）

这是让 Forge **真正理解代码**的关键模块，是 Codex 和 Claude Code 都做不到的深度。

```
┌──────────────────────────────────────────────────────┐
│                 Code Intelligence Layer               │
│                                                       │
│  ┌─────────────────┐   ┌───────────────────────────┐ │
│  │  AST Engine      │   │  Dependency Graph          │ │
│  │  • JS/TS Parser  │   │  • Import/Export 链        │ │
│  │  • Python Parser │   │  • 函数调用关系             │ │
│  │  • Go Parser     │   │  • 类型继承链               │ │
│  │  • Rust Parser   │   │  • 运行时依赖               │ │
│  └────────┬────────┘   └─────────────┬─────────────┘ │
│           │                          │                │
│           ▼                          ▼                │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Semantic Code Graph                 │ │
│  │         （持久化的语义代码图谱）                    │ │
│  │                                                  │ │
│  │  Symbol → Definition → References → Callers      │ │
│  │  Module → Exports → Imports → Dependencies       │ │
│  │  Type → Hierarchy → Implementations → Usages     │ │
│  │  Route → Handler → Middleware → Model → DB       │ │
│  └────────────────────────┬────────────────────────┘ │
│                           │                           │
│  ┌────────────────────────▼────────────────────────┐ │
│  │            Impact Analyzer                       │ │
│  │                                                  │ │
│  │  输入: "修改 userController.login 的签名"         │ │
│  │  输出: 影响 12 个文件、3 个测试、2 个路由          │ │
│  │        需要先修改的依赖: authService, jwtMiddleware │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │            Adaptive Context Engine               │ │
│  │                                                  │ │
│  │  • 按任务相关性分配 Context Budget                 │ │
│  │  • 重要性加权压缩（不只是时间衰减）                 │ │
│  │  • 跨会话记忆索引（向量检索 + 结构化记忆）          │ │
│  │  • 主动预加载：根据任务计划预测需要的文件            │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**为什么这很重要**：
- Codex 靠文件搜索和 grep 理解代码——表面级
- Claude Code 靠文本级 project graph——中等深度
- Forge 靠 **AST + 类型系统 + 依赖图**——结构级理解

这意味着 Forge 可以回答：
- "改了这个函数的签名，哪些地方会编译失败？"
- "这个模块的所有入口点是什么？"
- "删掉这个类会不会有运行时报错？"

### 3.5 Worker Agents（工作代理池）

不同于 Claude Code 的单线程和 Codex 的独立沙箱，Forge 的 Worker Pool 支持**角色化分工+协作**。

```
┌─────────────────────────────────────────────────────────────┐
│                      Worker Agent Pool                        │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Coder   │  │  Tester  │  │  Reviewer │  │  Debugger │     │
│  │          │  │          │  │           │  │           │     │
│  │ 写代码   │  │ 写测试   │  │ 审查代码  │  │ 修 Bug   │     │
│  │ 改文件   │  │ 跑测试   │  │ 安全扫描  │  │ 分析日志  │     │
│  │ 重构     │  │ 覆盖率   │  │ 性能检查  │  │ 定位根因  │     │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────┬─────┘     │
│       │             │              │              │           │
│       └─────────────┴──────────────┴──────────────┘           │
│                         │                                     │
│                    ┌────▼─────┐                               │
│                    │  Shared  │                               │
│                    │  Memory  │  ← 所有 Worker 共享任务上下文   │
│                    │  Store   │                               │
│                    └──────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

**Worker 通信协议**：

```json
{
  "type": "worker_handoff",
  "from": "coder-1",
  "to": "tester-1",
  "taskId": "t3",
  "status": "implementation_complete",
  "artifacts": {
    "modifiedFiles": ["src/auth/jwt-controller.js", "src/auth/auth-service.js"],
    "newFiles": ["src/auth/jwt-middleware.js"],
    "changesSummary": "Added JWT auth with register, login, refresh endpoints",
    "knownLimitations": "Rate limiting not implemented yet"
  },
  "context": {
    "keyDecisions": ["Used jsonwebtoken library", "RS256 algorithm"],
    "testHints": ["Test token expiry", "Test invalid signature handling"]
  }
}
```

### 3.6 Verification Engine（验证引擎）

```
┌──────────────────────────────────────────────────┐
│              Verification Engine                  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Tier 1: Static Analysis                    │ │
│  │  • TypeScript 类型检查                       │ │
│  │  • ESLint 规则验证                           │ │
│  │  • Import 解析（无悬空引用）                  │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Tier 2: Unit Tests                         │ │
│  │  • 运行现有测试套件                          │ │
│  │  • 生成补充测试（覆盖变更区域）               │ │
│  │  • 变异测试（验证测试质量）                   │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Tier 3: Integration Tests                  │ │
│  │  • 启动服务 + 数据库                         │ │
│  │  • API 端到端测试                            │ │
│  │  • 性能基准对比                              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Tier 4: Smoke Verification                 │ │
│  │  • 应用能正常启动                            │ │
│  │  • 核心路由可达                              │ │
│  │  • 无控制台错误                              │ │
│  │  • 功能回归通过                              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Evidence Vault（证据金库）                   │ │
│  │  • 每次验证的完整输出快照                     │ │
│  │  • 通过/失败的机器可读记录                    │ │
│  │  • 可追溯到具体 task 和 goal                  │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 3.7 Checkpoint & Resume（检查点与恢复）

这是 **Codex 和 Claude Code 都没有的关键能力**。

```
Checkpoint 结构：

{
  "checkpointId": "cp-007",
  "timestamp": "2026-06-09T14:30:00Z",
  "goalId": "g-001",
  "completedTasks": ["t1", "t2", "t3", "t4"],
  "pendingTasks": ["t5", "t6", "t7"],
  "workspaceState": {
    "gitCommit": "a1b2c3d",       // Git 提交哈希
    "modifiedFiles": [...],        // 相对基准的文件变更
    "newFiles": [...],
    "untrackedFiles": [...]
  },
  "agentState": {
    "contextSummary": "...",       // 压缩后的上下文摘要
    "keyDecisions": [...],         // 关键决策记录
    "openQuestions": [...],        // 待解决的问题
    "learnedPatterns": [...]       // 执行中发现的模式
  },
  "budget": {
    "tokensUsed": 125000,
    "tokensRemaining": 375000,
    "timeElapsed": "35m",
    "costSoFar": 1.85
  }
}
```

**使用场景**：
- 执行到一半崩溃了 → 从最近检查点恢复
- 想在不同机器上继续 → 导出检查点，导入继续
- 想回退到某个决策点 → 选择特定检查点回滚
- 长任务跨夜执行 → 检查点持久化，次日恢复

---

## 四、执行流程示例

以目标 **"给 AI Gateway 添加请求限流功能"** 为例：

```
Step 1: Goal Compiler 编译目标
  ↓
  分析代码库：发现是 Express 应用，已有 provider registry
  ↓
  生成 Task DAG:
    t1: 探索现有中间件架构 (explore)
    t2: 设计限流方案 (plan)
    t3: 实现限流中间件 (implement) ← 可与 t4 并行
    t4: 添加配置项 (implement)
    t5: 编写单元测试 (test)
    t6: 集成测试 (verify)
  ↓
Step 2: Task Planner 调度
  ↓
  t1 先行 → t2 等 t1 → [t3, t4] 并行 → t5 等 [t3,t4] → t6 等 t5
  ↓
Step 3: Execution Orchestrator 执行
  ↓
  ┌─ t1: Code Archaeologist Worker 启动
  │   读取 src/index.js, src/middleware/, package.json
  │   输出: 现有中间件清单、路由结构、依赖
  │   → CHECKPOINT
  │
  ├─ t2: Architect Worker 启动
  │   输入: t1 的探索结果 + 代码库结构
  │   输出: 限流方案设计 (express-rate-limit + Redis backend)
  │   → CHECKPOINT + 人工审批点（可选）
  │
  ├─ t3: Coder Worker #1 启动 ─┐
  │   创建 src/middleware/rate-limiter.js  │ 并行执行
  │   修改 src/index.js 注册中间件         │
  │   → CHECKPOINT                       │
  │                                      │
  ├─ t4: Coder Worker #2 启动 ─┘
  │   修改 shared-config 添加限流配置
  │   → CHECKPOINT
  │
  ├─ t5: Tester Worker 启动
  │   编写 test/rate-limiter.test.js
  │   运行测试 → 2 个失败
  │   反馈给 Coder Worker → 修复 → 重跑 → 全部通过
  │   → CHECKPOINT
  │
  └─ t6: Verifier Worker 启动
      静态分析 ✓
      单元测全部通过 ✓
      启动服务 + 压测限流 ✓
      无控制台错误 ✓
      → 生成证据报告
  ↓
Step 4: 完成
  ↓
  输出:
    • 修改文件清单 + diff
    • 全部测试通过的证据
    • 性能基准数据
    • 回滚命令 (git revert)
    • 变更摘要（可发送给团队成员）
```

---

## 五、与现有系统的整合策略

### 5.1 复用已有基础设施

| 已有组件 | 复用方式 | 改造程度 |
|----------|---------|---------|
| AI Gateway 多 Provider 路由 | 直接使用 | 无改造 |
| Chat Gateway 意图分类 | 作为 Goal Compiler 的输入预处理 | 轻微适配 |
| GVC 权限引擎 | 作为 Governance Shell | 放宽 dry-run 限制 |
| 证据验证框架 | 作为 Verification Engine 基础 | 扩展测试层 |
| Project Brain JSON 模式 | 作为 Task Store 数据格式参考 | 重构为 SQLite |
| Phase 生命周期模式 | 简化为 Task 状态机 | 大幅精简 |

### 5.2 新建模块优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | Task Store (SQLite) | 所有模块的数据基础 |
| P0 | Goal Compiler | 核心能力，无此则无法工作 |
| P0 | Execution Orchestrator | 核心引擎 |
| P1 | Worker Agent (Coder + Tester) | 最小可用执行单元 |
| P1 | Verification Engine (Tier 1+2) | 最小验证能力 |
| P1 | Checkpoint Manager | 断点续传核心 |
| P2 | Code Intelligence Layer | 深度代码理解 |
| P2 | Worker Agent (Reviewer + Debugger) | 增强能力 |
| P2 | Verification Engine (Tier 3+4) | 完整验证 |
| P3 | Multi-user Collaboration | 团队协作 |
| P3 | Adaptive Context Engine | 高级上下文管理 |

### 5.3 技术选型建议

| 组件 | 选型 | 理由 |
|------|------|------|
| 语言 | Node.js (ESM) | 与现有 Gateway 一致，复用生态 |
| Task Store | better-sqlite3 | 嵌入式、高性能、已在项目中使用 |
| AST 解析 | tree-sitter | 多语言、增量解析、高性能 |
| 代码索引 | SQLite FTS5 + 自定义图 | 全文搜索 + 依赖图 |
| Worker 隔离 | Worker Threads / child_process | 进程隔离 + 共享内存 |
| 检查点 | Git + JSON 快照 | 文件系统级快照 + 元数据 |
| API 层 | 复用 Express 路由 | 接入现有 Gateway |

---

## 六、Forge vs Codex vs Claude Code 对比

| 维度 | Codex | Claude Code | Forge |
|------|-------|-------------|-------|
| **目标理解** | 隐式（靠模型推理） | 显式规划 | **Goal Compiler + 代码探测** |
| **任务分解** | 自动子代理 | 手动编排 | **自动 DAG + 依赖解析** |
| **代码理解** | grep + 搜索 | 文本级 project graph | **AST + 类型 + 语义图** |
| **编辑能力** | diff 补丁 | old/new 字符串 | **AST 感知 + 事务性** |
| **并行执行** | 8 云端沙箱 | 单线程 | **本地多 Worker** |
| **测试能力** | 沙箱内（无网络） | 本地（无限） | **分层验证 + 动态环境** |
| **错误恢复** | 测试-重试 | 4 层 | **元认知 + 方法多样性** |
| **长任务** | 不支持恢复 | 不支持恢复 | **检查点 + 断点续传** |
| **协作** | 单用户 | 单用户 | **共享 Agent Pool** |
| **治理审计** | 任务日志 | 终端转录 | **全链路证据金库** |
| **成本控制** | 不透明 | API 计费 | **预算预估 + 硬上限** |
| **模型选择** | 锁定 OpenAI | 锁定 Anthropic | **多 Provider 自由切换** |

---

## 七、MVP 路线图

### Phase 1: 最小可用（2-3 周）
- Task Store (SQLite)
- Goal Compiler（LLM 驱动的目标编译）
- 单 Worker Agent（Coder，可写可改）
- 基础 Verification（类型检查 + 跑测试）
- CLI 接口：`forge run "添加 JWT 认证"`

### Phase 2: 核心闭环（2-3 周）
- Execution Orchestrator（DAG 调度）
- Tester + Verifier Worker
- Checkpoint Manager（检查点+恢复）
- 并行执行（2+ Worker 同时工作）
- 预算控制 + 成本追踪

### Phase 3: 智能增强（3-4 周）
- Code Intelligence Layer（AST + 依赖图）
- Reviewer + Debugger Worker
- Adaptive Context Engine
- Impact Analyzer（变更影响分析）
- 完整 4 层验证引擎

### Phase 4: 协作进化（2-3 周）
- Multi-user Agent Pool
- Web Console（实时任务看板）
- 跨会话任务转移
- 团队知识库（向量索引）
- 与现有 AI Gateway 深度整合

---

## 八、总结

Forge 不是从零造轮子——它站在 unified-ai-system 4000+ 阶段积累的**治理基础设施**之上，补上缺失的**自主编码智能层**。

**核心差异化**：
1. **目标驱动而非指令驱动**：给目标，不是给命令
2. **理解代码而非搜索代码**：AST + 语义图，不是 grep
3. **可恢复而非一次性**：检查点 + 断点续传
4. **团队协作而非单兵作战**：共享 Agent Pool
5. **多模型自由而非锁定**：小米 MiMo、NVIDIA、OpenAI 随时切换
6. **治理审计而非黑箱**：全链路证据金库

Codex 强在沙箱隔离和并行，Claude Code 强在深度推理和上下文管理。Forge 的目标是**两者兼具，再加上它们都没有的能力**。
