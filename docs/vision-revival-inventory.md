# Vision Revival Inventory(设想盘点)

> 背景:2026-08-22 的减法把 forge-core / three-mode / taiji 钩子 / workforce 链 / im 连接器从产品面移除,业主指出这些承载的是**最初设想**,已全量恢复(HEAD `e1fb2101` + 本文档)。本清单按设想族群盘点每块"想做什么、接活要什么、建议",供业主勾选哪些真正点亮。**未勾选的保持恢复后的现状(在场、不接线、不碍事)。**

## 族群 A:多智能体锻造流水线(forge 的心脏)

| 模块 | 想做什么 | 接活需要 | 建议 |
| --- | --- | --- | --- |
| agent-pool + worker/ | 常驻智能体池,按角色派工 | 与 `src/workforce/` 执行线对接(审批/worktree/claim token 已就绪) | **值得接**:workforce 线已有治理骨架,缺的就是"常驻池"这一层 |
| dynamic-roles + consensus | 动态角色 + 共识决策 | 挂到 workforce 的 role executors | 值得接,作为 workforce 的角色引擎 |
| goal-compiler / refiner / templates | 把模糊目标编译成可执行任务树 | 接 `/workflow/plan` 上游 | 值得接,prompt 增强器已是同思路的轻量版 |
| orchestrator + multi-agent-review | 总编排 + 多智能体互审 | 接 workforceService 主循环 | 可接,与 review 包互补 |
| self-loop / self-healing | 自我循环修复 | 需要安全评审(自治风险) | 封存,等治理线成熟 |
| agent-communication | 智能体间消息协议 | A2A 网关已自有 JSON-RPC 面 | 已被原生超越,建议融合进 A2A |

## 族群 B:打磨与质量

| 模块 | 想做什么 | 建议 |
| --- | --- | --- |
| iterative-refiner + deep-polish 批次 | 迭代精修产物 | **值得接**:可做成 `/forge/polish` 受治理端点 |
| quality-gate + verification | 质量门禁 | 与攻防回归互补,值得接 |
| error-pattern-learner / enhanced-retry | 从失败模式学习重试 | 小而美,值得接 |
| checkpoint / decision-trace / progress-* | 检查点与决策追踪 | 审计哈希链已有,建议融合 |
| token-predictor / progress-estimator | token/进度预估 | 轻量,可挂 /metrics |

## 族群 C:记忆体系

| 模块 | 想做什么 | 建议 |
| --- | --- | --- |
| cross-session-memory + semantic-memory + memory-engine | 跨会话语义记忆 | **网关原生空白**,值得接:接 knowledge 服务的向量层 |
| knowledge-graph | 知识图谱 | 与 sqlite-vec 检索互补,可接 `/knowledge/graph/*`(路由已在) |

## 族群 D:运行时治理与韧性

| 模块 | 想做什么 | 建议 |
| --- | --- | --- |
| sandbox-executor + bash-safety | 沙箱执行 | workforce 的 worktree 隔离同族,建议合并 |
| adaptive-scaling / predictive-health / chaos-engineer | 自适应缩放/预测健康/混沌 | 熔断器+健康分已有轻量版,封存待多实例真需求 |
| graceful-degradation / dead-letter-queue / resilience | 降级/死信/韧性 | 部分被优雅停机契约覆盖,余下可接 |
| injection-defense / security / networkTargetGuard | 注入防御 | guardrails 引擎已有,融合 |

## 族群 E:上下文工程

| 模块 | 想做什么 | 建议 |
| --- | --- | --- |
| context-engine + incremental-edit + code-intel + codebase-search | 增量上下文/代码智能 | codex-context-gateway 已是直系后代(活着),forge 版建议封存 |
| context-manager | 会话上下文管理 | 同上,已被超越 |

## 族群 F:成本与观测

| 模块 | 建议 |
| --- | --- |
| cost-attribution / calculator / budget-* | 虚拟 key+计费台账已覆盖;billing 细粒度归因可融合 |
| execution-analytics / metrics / tracing | OTel+Prometheus 已覆盖,封存 |
| forge-dashboard / health-dashboard / live-stream | 与"无浏览器 UI"诚实边界冲突——**要接就要改边界**,需业主拍板 |

## 族群 G:执行与集成底座

| 模块 | 建议 |
| --- | --- |
| task-store(SQLite) | 可直接给本地计费台账/workflow 用,值得接 |
| tool-calling-registry + skills/ + plugins | 与 agentToolRegistry 同族,融合 |
| llm-client / multimodal-client / gateway-bridge | 已被 provider adapters 超越,封存 |
| websocket / api-server / multi-user / export-import / config-hub | 按需,当前无缺口 |

## 族群 H:网关侧设想(本会话恢复的)

| 设想 | 想做什么 | 建议 |
| --- | --- | --- |
| **three-mode**(神/工/治) | 三模式运行时(能力路由/上帝模式/治理门) | 已恢复路由与遥测;接活=把 modeRuntimeExecutor 挂到真实 provider lane 并定义三模式语义——**需要业主给出三模式的业务定义** |
| **taiji-beidou 引擎** | NL→能力编译、免疫风险分类、运行时门 | 钩子已接回;接活=让引擎真实参与路由决策(当前仅预览) |
| **workforce 链**(岗位库/员工大脑/调度器) | 组织化多智能体 | 接活=让 workforcePreviewService 真实调用调度器并暴露 `/workforce/preview` 路由 |
| **im 连接器**(飞书/企微) | IM 通道触达 | 接活=capability 路由改用包内 connector(替代内联实现)+ 加 dry-run 默认 |

## 接活统一规矩

任何点亮项都走同一流程:挂在治理门后(权限/预算/审计)→ 补测试 → 四门禁绿 → CHANGELOG 记录。恢复的包若长期未点亮,再次动它们前**先问业主**。
