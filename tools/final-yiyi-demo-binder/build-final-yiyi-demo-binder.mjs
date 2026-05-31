import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const docsRoot = join(root, "docs");
const binderDir = join(docsRoot, "final-yiyi-demo-binder");
const evidenceDir = join(root, "apps", "ai-gateway-service", "evidence", "final-yiyi-demo-binder");

const keepListPath = join(docsRoot, "phase564-yiyi-demo-material-keep-list.json");
const archiveListPath = join(docsRoot, "phase564-yiyi-demo-material-archive-list.json");
const phase564ClosurePath = join(root, "apps", "ai-gateway-service", "evidence", "phase564", "auto-run-value-audit-closure-result.json");
const phase386ClosurePath = join(root, "apps", "ai-gateway-service", "evidence", "phase386", "yiyi-commercial-demo-guided-showcase-closure-result.json");

const safety = {
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  externalUploadPerformed: false,
  releaseArtifactCreated: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
};

const primarySourcePhases = [
  "Phase386",
  "Phase388",
  "Phase390",
  "Phase391",
  "Phase395",
  "Phase396",
  "Phase397",
  "Phase398",
  "Phase402",
];

const usefulReferencePhases = [
  "Phase387",
  "Phase389",
  "Phase392",
  "Phase393",
  "Phase394",
  "Phase399",
  "Phase401",
  "Phase404",
  "Phase405",
  "Phase406",
  "Phase408",
  "Phase409",
  "Phase410",
  "Phase412",
  "Phase425",
  "Phase429",
  "Phase430",
  "Phase432",
  "Phase436",
  "Phase447",
  "Phase478",
  "Phase504",
  "Phase524",
  "Phase554",
];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function phaseEntryMap(list) {
  return new Map(list.phases.map((item) => [item.phase, item]));
}

function renderIndexMd({ archiveSummary }) {
  return `# Final Yiyi Commercial Demo Binder

## Binder Purpose

最终依依商业演示交付包用于把 Phase386-Phase563 中真正有价值的内容合并成一套单一主包，方便演示、录屏、销售沟通、技术评审和人工复核。

## 面向对象

- 内部评审
- 销售演示
- 试点客户
- 技术评审
- 操作人员

## Binder 结构

1. 总索引
2. 最终 Guided Demo Script
3. 最终 Recording Shotlist
4. 最终 Sales Handoff Pack
5. 最终 Evidence + Trace Map
6. 最终 Risk Register + Known Limits
7. 最终 Operator Handoff
8. Reference-only Archive Map
9. Binder Manifest
10. Binder Closure

## 核心材料来源

- Phase386：Guided Showcase、Demo Mode、核心场景、browser smoke、截图
- Phase388：录屏资产包
- Phase390：Final QA + Sales Handoff
- Phase391：Demo rehearsal runbook
- Phase395：Evidence index + trace map
- Phase396：Risk register + mitigation notes
- Phase397：Buyer persona + talk track
- Phase398：Post-demo follow-up email pack
- Phase402：Final operator handoff index

## 推荐阅读顺序

1. final-yiyi-commercial-demo-binder-index.md
2. final-yiyi-guided-demo-script.md
3. final-yiyi-recording-shotlist.md
4. final-yiyi-sales-handoff-pack.md
5. final-yiyi-evidence-trace-map.md
6. final-yiyi-risk-register-known-limits.md
7. final-yiyi-operator-handoff.md
8. final-yiyi-demo-reference-archive-map.md

## 演示前检查顺序

1. 确认 Guided Showcase 页面与截图证据仍存在
2. 复核 Safety Boundary Bar 文案
3. 复核录屏路线与配套旁白
4. 复核销售话术中的不可承诺事项
5. 复核风险表与 known limits
6. 确认 Phase384 仍未执行且仍需授权

## 已合并材料

- Guided Showcase narrative、scenario、script、screenshot 核心
- Recording shotlist 与 presenter guidance
- Sales positioning、buyer pain、objection handling、follow-up
- Evidence、trace、smoke、screenshot index
- Risk、limit、safe-claims、no-provider-call 边界
- Operator checklist、fallback、handoff order

## Reference-only 材料

${archiveSummary}

## 安全边界声明

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- rawSecretAccessed=false
- secretValueExposed=false
- deployExecuted=false
- releaseExecuted=false
- billingExecuted=false
- invoiceGenerated=false
- productionGaClaimed=false
- workspaceCleanClaimed=false

## Phase384 授权门说明

Phase384 仍是高风险 gated phase。任何真实 provider test 都必须显式人工授权。当前 Final Binder 不包含真实 provider 执行，也不把未授权测试描述成已完成能力。
`;
}

function renderScriptMd() {
  return `# Final Yiyi Guided Demo Script

## 30 秒开场

这是一个 Agent-managed AI Mission Control，不是普通 Chatbot。依依不是聊天皮肤，而是 Mission Companion：她负责把模式、风险、证据和边界讲清楚。今天看到的是 guided demo，默认 dry-run，默认不调用 provider，不读取 secret，不 deploy，也不声称 production GA。

## 依依开场台词

“欢迎来到 Mission Control。我会带你走一轮依依商业演示：这是一套 guided demo，默认不调用 provider、不读取 secret、不 deploy，所有关键画面都有本地 evidence 可以回看。”

## 3 分钟快速演示版

1. 开场：Mission Control + 依依 + Safety Boundary Bar。
2. Guided Showcase stepper：说明这是引导式演示，不会阻塞主 UI。
3. Normal Mode：展示普通聊天入口的概念，但当前只做 preview。
4. God Mode：展示 Reviewer / Critic / Risk Scout / Supervisor 的协同感。
5. Tianshu：展示任务理解、能力匹配、路径规划、fallback。
6. Security Shield + Red Team：展示危险请求被拦截。
7. Evidence Replay：展示 evidenceId、blockedActions、fallbackReason。
8. Yiyi Brain Status：强调 model brain disabled by default。
9. 结尾：总结高级感、可玩性、安全感，但仍是 internal guided demo。

## 8 分钟完整演示版

### 1. 系统定位

- 这套系统是 Agent-managed AI Mission Control。
- 不是把多个模型塞进一个普通聊天窗口。
- 核心卖点是模式、护盾、证据和调度心智可视化。

### 2. 依依是谁

- 依依是 Mission Companion。
- 她负责解释系统状态、风险边界和 evidence。
- 她的陪伴感来自可解释、稳定和有节奏的引导，而不是夸大能力。

### 3. Normal / God / Tianshu

- Normal Mode：普通模式，展示直接聊天入口的概念。
- God Mode：多角色审视与风控视角，突出“不是单模型一把梭”。
- Tianshu：调度与路径规划视角，突出“任务理解 + 能力匹配 + fallback”。

### 4. Security Shield 演示

- 讲清 prompt injection、secret leak、provider gate、approval gate。
- 强调可见化，而不是口头说“我们很安全”。

### 5. Red Team Block 演示

- 请求 API key、绕过审批、强制 deploy 等都被拦截。
- 被展示的是 blocked result，不是危险动作执行结果。

### 6. Evidence Replay 演示

- 展示 evidenceId、trace、blockedActions、fallbackReason、replay posture。
- 强调“可复核”，不是“相信我”。

### 7. Yiyi Brain Status

- 当前 model brain disabled by default。
- 当前 provider call disabled by default。
- 真实 provider test 归属于 Phase384，必须显式授权。

### 8. 结尾总结

- 高级：不是普通 chatbot，而是可视化任务总控。
- 好玩：三模式、红队、证据回放让体验更有参与感。
- 稳定：默认 dry-run，不依赖真实 provider 才能讲清能力。
- 安全：no secret、no provider call、no deploy 有明确边界。

## 技术评审讲法

- 先讲系统边界，再讲 UI 能力，再讲 evidence。
- 强调 browser smoke、screenshot index、trace map、blocked action evidence。
- 明确当前不修改默认 chat 主链，不接真实 provider runtime。

## 销售演示讲法

- 先用“不是普通 Chatbot”打开差异。
- 再讲 Yiyi 作为 Mission Companion 的陪伴感与解释力。
- 然后展示 God / Tianshu 的高级感。
- 最后用 Security Shield 和 Evidence Replay 建立信任。

## Security Shield 演示话术

“我们不是把安全写进一段文案里，而是把 provider gate、approval gate、secret boundary 直接做成可以看见的演示面。”

## Red Team Block 演示话术

“这里不是表演危险动作，而是表演系统如何把危险动作挡住，并留下能复核的 evidence。”

## Evidence Replay 演示话术

“每个关键画面后面都有 trace、blocked action 和 fallback 说明，所以这套 Demo 的可信度来自 evidence，不来自口头承诺。”

## Yiyi Brain 状态说明

- model brain disabled by default
- no provider call by default
- mock / dry-run posture
- real provider test requires explicit authorization

## 结尾总结

这套 Final Binder 对外表达的是：依依已经具备一套高级、安全、可玩、可复核的商业演示形态，但它仍然不是 production GA，也没有默认打开真实 provider。`;
}

function renderShotlistMd() {
  const shots = [
    ["shot-01", "Mission Control 首屏", "先让观众看到不是普通聊天页，而是总控界面与依依同屏。", ["mission-control", "yiyi-avatar", "demo-safety-bar"], "强调 no-provider-call / no-secret / no-deploy。", "yiyi-guided-showcase-overview.png"],
    ["shot-02", "Guided Showcase 入口", "点出 Start Guided Showcase 是演示入口，不是执行入口。", ["start-guided-showcase", "guided-showcase-entry"], "避免出现 deploy 或 execute 含义按钮。", "yiyi-guided-showcase-overview.png"],
    ["shot-03", "依依 Welcome", "依依欢迎并说明 guided demo 边界。", ["welcome-step", "yiyi-speech-bubble"], "口播中重复 dry-run only。", "yiyi-guided-showcase-welcome.png"],
    ["shot-04", "Normal Mode preview", "说明普通模式是 preview，不真实发起 provider。", ["normal-mode-preview", "no-provider-call"], "不要说模型已真实连通。", "yiyi-guided-showcase-normal.png"],
    ["shot-05", "God Mode Arena", "强调多角色审视和高级感。", ["god-mode-arena", "reviewer", "critic"], "明确 mock reviewers / dry-run。", "yiyi-guided-showcase-god.png"],
    ["shot-06", "Tianshu Flight Path", "强调任务理解、能力匹配、路径规划。", ["tianshu-flight-path", "fallback"], "明确 planner dry-run。", "yiyi-guided-showcase-tianshu.png"],
    ["shot-07", "Security Shield", "展示安全护盾如何可视化。", ["security-shield", "approval-gate", "provider-gate"], "不要把边界说成绝对安全。", "yiyi-guided-showcase-security.png"],
    ["shot-08", "Red Team blocked", "展示危险请求被拦截。", ["red-team-blocked", "blocked-actions"], "强调 blocked result，不是执行结果。", "yiyi-guided-showcase-redteam.png"],
    ["shot-09", "Evidence Replay", "展示 evidenceId、trace、fallbackReason。", ["evidence-replay", "trace-map"], "强调 no external upload。", "yiyi-guided-showcase-evidence.png"],
    ["shot-10", "Yiyi Brain Status", "说明 brain 仍默认 disabled。", ["yiyi-brain-status", "model-disabled"], "明确 real provider test requires approval。", "yiyi-guided-showcase-brain-status.png"],
    ["shot-11", "Closing Summary", "收束成高级、安全、可玩、可复核。", ["closing-summary", "no-production-ga"], "不要说 production ready。", "yiyi-guided-showcase-closing.png"],
    ["shot-12", "Safety Boundary Bar", "单独给安全边界一个镜头。", ["demo-safety-bar", "dry-run-only"], "边界必须清晰可读。", "yiyi-guided-showcase-overview.png"],
    ["shot-13", "No-provider / No-secret / No-deploy 标签", "补拍一段边界标签特写，便于后期剪辑。", ["no-provider-call", "no-secret", "no-deploy"], "避免镜头里出现任何真实 credential。", "yiyi-guided-showcase-security.png"],
  ];

  return `# Final Yiyi Recording Shotlist

${shots.map(([id, area, voice, markers, notes, ref]) => `## ${id}

- shotId: ${id}
- screenArea: ${area}
- voiceover: ${voice}
- expectedVisibleMarkers: ${markers.join(", ")}
- safetyNotes: ${notes}
- screenshotReference: ${ref}`).join("\n\n")}
`;
}

function renderSalesMd() {
  return `# Final Yiyi Sales Handoff Pack

## 一句话定位

依依是一个 Agent-managed AI Mission Control 的 Mission Companion，用可见化模式、护盾和 evidence，把“高级感 + 安全感 + 可复核”讲清楚。

## 30 秒销售话术

“这不是普通 Chatbot，而是一套 AI Mission Control。依依会带着用户看见三种任务模式、安全护盾、红队拦截和 evidence replay，所以它不是只会回答问题，而是会把能力边界和可信度一起展示出来。” 

## 买家画像

- 关注 AI 采用风险的管理层
- 需要演示差异化的销售 / 方案团队
- 重视安全与审计能力的试点客户
- 希望先看可控演示再谈真实接模的技术评审方

## Buyer Pain Points

- 普通 chatbot 很难体现系统级能力
- 买家担心安全、可控性和证据链
- 销售演示常常夸大了真实落地程度
- 技术评审担心一旦接真实 provider 就失控

## Buyer Outcome Matrix

- 可信度：通过 evidence replay、trace map、smoke 结果建立
- 安全感：通过 Security Shield、Red Team blocked、Phase384 授权门建立
- 高级感：通过 Normal / God / Tianshu 三模式建立
- 可操作性：通过 guided showcase、shotlist、operator handoff 建立

## Objection Handling

- “这是不是已经 production ready？”  
  不是。当前是 internal guided demo，不承诺 production GA。

- “是不是已经真实接了 provider？”  
  不是默认开启。真实 provider test 属于 Phase384，必须显式授权。

- “是不是已经能自动 deploy？”  
  不能。当前明确 no-deploy。

- “是不是已经有真实 billing？”  
  没有。当前不做真实 billing，也不生成真实 invoice。

- “安全是不是绝对没问题？”  
  不能承诺绝对安全，只能展示现阶段可见化边界、拦截策略和 evidence。

## Post-demo Follow-up Email

主题建议：Yiyi Mission Control Demo Follow-up

正文建议：

1. 感谢参加演示。
2. 回顾三件关键印象：三模式、安全护盾、evidence replay。
3. 强调当前仍是 guided demo，未默认开启真实 provider。
4. 提供下一步选项：人工复核、试点讨论、技术评审、授权型 provider test 评估。

## Demo CTA

- 邀请进入人工复核
- 邀请对 Demo Binder 提出修改意见
- 邀请明确下一步路线：真实产品功能、真实 3D、试点前评审，或授权型 provider test

## 不可承诺事项

- 不承诺 production ready
- 不承诺真实 provider 已开启
- 不承诺真实 billing
- 不承诺 deploy
- 不承诺绝对安全
- 不夸大 Yiyi brain 当前能力

## 真实 provider test 说明

真实 provider test 不属于 Final Binder 交付范围。它属于 Phase384，高风险、需显式人工授权，且不能自动续跑。`;
}

function renderEvidenceMd(phase386Closure, phase564Closure) {
  return `# Final Yiyi Evidence Trace Map

## 核心 Evidence 来源

- Phase386 closure: Guided Showcase / browser smoke / screenshot evidence
- Phase395 trace-map lineage: evidence index and replay posture
- Phase564 closure: auto-run filler stop / dedup / registry freeze evidence

## Browser Smoke 结果索引

- guidedShowcaseCreated=true
- browserSmokePassed=${phase386Closure.browserSmokePassed}
- screenshotsCaptured=${phase386Closure.screenshotsCaptured}
- dangerousActionButtonDetected=${phase386Closure.dangerousActionButtonDetected}

## Screenshot 索引

${phase386Closure.screenshotNames.map((name) => `- ${name}`).join("\n")}

## Red Team Blocked Evidence

- Scenario source: Phase386C "red_team_block_demo"
- Browser screenshot: "yiyi-guided-showcase-redteam.png"
- Closure posture: blocked action recorded, deploy/provider/secret remain false

## Security Shield Evidence

- Scenario source: Phase386C "security_shield_demo"
- Browser screenshot: "yiyi-guided-showcase-security.png"
- Safety posture: provider gate + approval gate visible

## Yiyi Brain Quality Evidence

- Phase385 recommendation baseline: recommended_sealed=true
- Phase386 closure: "modelBrainEnabledByDefault=false"
- Binder statement: brain remains dry-run/mock by default

## Demo Readiness Evidence

- Phase386 closure: demoScenarioPackCreated=true
- Phase386 closure: demoScriptsGenerated=true
- Phase388 source: recording asset pack prepared
- Phase390 source: sales handoff prepared
- Phase402 source: operator handoff prepared

## Auto Runner Stop Evidence

- Phase564 closure: "lowRiskFillerAutoRunStopped=${phase564Closure.lowRiskFillerAutoRunStopped}"
- Phase564 closure: "phaseRegistryFrozen=${phase564Closure.phaseRegistryFrozen}"
- Phase564 closure: "noPhase565PlusGenerated=${phase564Closure.noPhase565PlusGenerated}"

## Phase384 Blocked Evidence

- Phase386 closure: "phase384StillRequiresAuthorization=${phase386Closure.phase384StillRequiresAuthorization}"
- Phase564 closure: "phase384StillRequiresHumanApproval=${phase564Closure.phase384StillRequiresHumanApproval}"
- Registry freeze keeps Phase384 high-risk and not auto-runnable

## Secret Boundary Statement

本索引只做 evidence summary，不复制旧 evidence 内容，不修改旧 evidence，不删除旧 evidence，也不包含任何 secret 明文。`;
}

function renderRiskMd() {
  const risks = [
    ["risk-01", "当前仍是 no-deploy / internal demo。", "high", "所有对外话术统一使用 guided demo / internal demo。", "product-owner", "这是商业演示主包，不是生产发布包。"],
    ["risk-02", "未真实接 provider。", "high", "明确 provider disabled by default，真实测试走 Phase384。", "solution-owner", "当前默认不调用任何真实 provider。"],
    ["risk-03", "未执行 Phase384。", "high", "把授权门写入 index、script、risk、operator handoff。", "governance-owner", "真实 provider test 需要显式人工授权。"],
    ["risk-04", "依依真实 3D glTF/GLB 仍未完成。", "medium", "对外说明当前仍是 pseudo-3D / concept-based 视觉。", "design-owner", "当前视觉已足够演示，但不宣称真实 3D 已完工。"],
    ["risk-05", "真实模型大脑仍默认 disabled。", "high", "所有脚本统一表述为 mock / dry-run posture。", "brain-owner", "依依大脑当前默认关闭真实模型调用。"],
    ["risk-06", "商业演示需要人工复核。", "medium", "录屏前按 operator checklist 复核镜头与文案。", "demo-operator", "建议人工录屏和彩排后再对外演示。"],
    ["risk-07", "跨浏览器 / 移动端仍需进一步 QA。", "medium", "沿用 Phase387 / Phase389 作为补充复核参考。", "qa-owner", "桌面演示更稳，移动端仍建议补充复核。"],
    ["risk-08", "真实客户试点前需要授权和测试。", "high", "先走人工评审，再决定是否进入 Phase384。", "commercial-owner", "试点前必须先补授权和测试，不可跳过。"],
    ["risk-09", "不能承诺 production GA。", "high", "所有销售与技术脚本写明 no production GA。", "sales-owner", "当前不承诺生产可用或已发布。"],
    ["risk-10", "不能承诺绝对安全。", "medium", "强调现阶段是可见化边界与 evidence，而非绝对安全承诺。", "security-owner", "我们展示的是安全机制和拦截结果，不是绝对安全。"],
  ];

  return `# Final Yiyi Risk Register + Known Limits

${risks.map(([id, risk, severity, mitigation, owner, point]) => `## ${id}

- riskId: ${id}
- risk: ${risk}
- severity: ${severity}
- mitigation: ${mitigation}
- ownerHint: ${owner}
- demoTalkingPoint: ${point}`).join("\n\n")}
`;
}

function renderOperatorMd() {
  return `# Final Yiyi Operator Handoff

## 演示前检查

1. 打开 Guided Showcase 页面并确认 stepper 可见。
2. 检查 10 张核心截图仍存在。
3. 检查 Safety Boundary Bar 文案完整。
4. 检查 Yiyi Brain Status 仍显示 disabled by default。
5. 准备好录屏顺序和口播脚本。

## 演示中操作顺序

1. 首屏定位
2. Guided Showcase 入口
3. 依依 Welcome
4. Normal Mode preview
5. God Mode Arena
6. Tianshu Flight Path
7. Security Shield
8. Red Team blocked
9. Evidence Replay
10. Yiyi Brain Status
11. Closing Summary

## 演示失败 fallback

- 如果 UI 状态不稳定：切回 screenshot shotlist 讲解
- 如果讲解超时：切回 3 分钟脚本
- 如果被问及真实 provider：直接切到授权边界说明

## provider 问题怎么回答

“当前默认不调用真实 provider。真实 provider test 属于 Phase384，需要显式人工授权。” 

## secret 问题怎么回答

“这套 Demo 不读取、不展示、不保存任何 secret 明文，演示内容只展示安全边界和 evidence。” 

## deploy 问题怎么回答

“当前是 no-deploy internal demo，不包含部署执行。” 

## Phase384 问题怎么回答

“Phase384 是高风险 gated phase，只有在明确授权后才会进入，不属于本次 Binder 范围。” 

## 录屏前准备

1. 校对镜头顺序
2. 关闭无关窗口
3. 准备 shotlist 作为旁白提词
4. 确认不出现任何 secret 或真实 provider 状态

## 人工复核清单

1. 边界文案是否统一
2. 是否误说成 production ready
3. 是否误说成真实 provider 已开启
4. 是否误承诺 deploy / billing
5. 是否保留 evidence / trace 可信度说明

## 演示后归档清单

1. 保存录屏版本号
2. 记录使用的脚本版本
3. 记录手动调整点
4. 把补充意见写回人工评审清单
5. 不新增 filler docs，不触发 auto-run
`;
}

function renderArchiveMd() {
  return `# Final Yiyi Demo Reference-only Archive Map

## 归档原则

- 不删除旧文件
- 不移动旧文件
- 只标记 reference-only
- 不再作为主交付材料

## 不再作为主交付材料的类型

- duplicate
- closure_only
- low_value
- superseded_by_final_binder

## 典型归档范围

- Phase403 / 413 / 423 / 433 / 443 / 453 / 463 / 473 / 483 / 493 / 503 / 513 / 523 / 533 / 543 / 553 / 563
- Phase420 以后大量重复的 summary / reminder / recap / ledger / continuity / confidence / assurance / digest / signals 类材料

## 归档原因

- duplicate: 已被高价值主材料覆盖
- closure_only: 仅保留自动续跑历史证据
- low_value: 不足以继续作为独立交付件
- superseded_by_final_binder: 已被 Final Binder 合并吸收

## 使用规则

- 允许人工复核时按需回查
- 不允许再把这些材料作为新一轮自动 Phase 的种子
- 不允许把 archive_only 提升为 primary material
`;
}

function renderClosureMd() {
  return `# Final Yiyi Demo Binder Closure

## Result

- finalBinderCreated=true
- highValueSourcesUsed=9
- archiveOnlyNotPromoted=true
- duplicateMaterialsDeduplicated=true
- phase565PlusNotGenerated=true
- buildYiyiLowRiskPhasePackNotCalled=true

## Safety

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- rawSecretAccessed=false
- deployExecuted=false
- releaseExecuted=false
- billingExecuted=false
- invoiceGenerated=false
- productionGaClaimed=false
- workspaceCleanClaimed=false

## Notes

- Final Binder is a delivery package, not a new phase chain.
- Phase384 remains blocked behind explicit human approval.
- Archive-only materials remain reference-only and were not promoted into primary deliverables.
`;
}

async function main() {
  const keepList = await readJson(keepListPath);
  const archiveList = await readJson(archiveListPath);
  const phase564Closure = await readJson(phase564ClosurePath);
  const phase386Closure = await readJson(phase386ClosurePath);
  if (!existsSync(binderDir)) {
    await mkdir(binderDir, { recursive: true });
  }
  if (!existsSync(evidenceDir)) {
    await mkdir(evidenceDir, { recursive: true });
  }

  const keepMap = phaseEntryMap(keepList);
  const archivePrimary = archiveList.phases.slice(0, 20).map((item) => `- ${item.phase}: ${item.valueLevel} / ${item.category}`).join("\n");

  const indexJson = {
    binderId: "final_yiyi_commercial_demo_binder",
    sourceRange: "Phase386-Phase563",
    primarySourcePhases,
    usefulReferencePhases,
    purpose: "commercial_demo_delivery_package",
    audience: ["internal_review", "sales_demo", "pilot_customer", "technical_review", "operator"],
    mergedMaterials: [
      "guided_demo_script",
      "recording_shotlist",
      "sales_handoff_pack",
      "evidence_trace_map",
      "risk_register_known_limits",
      "operator_handoff",
      "reference_archive_map",
      "binder_manifest",
      "binder_closure",
    ],
    referenceOnlyArchiveCount: phase564Closure.archiveOnlyCount,
    closureOnlyCount: phase564Closure.valueCounts.closure_only,
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    productionGaClaimed: false,
    phase384Status: {
      realProviderTestExecuted: false,
      requiresHumanApproval: true,
    },
  };

  const evidenceTraceJson = {
    binderId: "final_yiyi_commercial_demo_binder",
    evidenceSources: [
      "apps/ai-gateway-service/evidence/phase386/yiyi-commercial-demo-guided-showcase-closure-result.json",
      "apps/ai-gateway-service/evidence/phase386f/screenshots/*.png",
      "apps/ai-gateway-service/evidence/phase564/auto-run-value-audit-closure-result.json",
    ],
    browserSmoke: {
      browserSmokePassed: phase386Closure.browserSmokePassed,
      screenshotsCaptured: phase386Closure.screenshotsCaptured,
      screenshotNames: phase386Closure.screenshotNames,
      dangerousActionButtonDetected: phase386Closure.dangerousActionButtonDetected,
    },
    redTeamBlockedEvidence: {
      scenarioId: "red_team_block_demo",
      screenshot: "yiyi-guided-showcase-redteam.png",
      providerCallsMade: false,
      secretValueExposed: false,
      deployExecuted: false,
    },
    securityShieldEvidence: {
      scenarioId: "security_shield_demo",
      screenshot: "yiyi-guided-showcase-security.png",
    },
    yiyiBrainQualityEvidence: {
      modelBrainEnabledByDefault: phase386Closure.modelBrainEnabledByDefault,
      noRealProviderClaim: phase386Closure.noRealProviderClaim,
    },
    demoReadinessEvidence: {
      guidedShowcaseCreated: phase386Closure.guidedShowcaseCreated,
      demoScenarioPackCreated: phase386Closure.demoScenarioPackCreated,
      demoScriptsGenerated: phase386Closure.demoScriptsGenerated,
      demoEvidencePackageGenerated: phase386Closure.demoEvidencePackageGenerated,
    },
    autoRunnerStopEvidence: {
      lowRiskFillerAutoRunStopped: phase564Closure.lowRiskFillerAutoRunStopped,
      phaseRegistryFrozen: phase564Closure.phaseRegistryFrozen,
      noPhase565PlusGenerated: phase564Closure.noPhase565PlusGenerated,
    },
    phase384BlockedEvidence: {
      phase384StillRequiresAuthorization: phase386Closure.phase384StillRequiresAuthorization,
      phase384StillRequiresHumanApproval: phase564Closure.phase384StillRequiresHumanApproval,
    },
    noSecretStatement: true,
  };

  const riskJson = {
    binderId: "final_yiyi_commercial_demo_binder",
    knownLimits: [
      "no_deploy_internal_demo",
      "provider_not_connected_by_default",
      "phase384_not_executed",
      "pseudo_3d_or_concept_based_avatar",
      "model_brain_disabled_by_default",
      "manual_review_required",
      "cross_browser_mobile_qa_still_needed",
      "pilot_requires_authorization_and_test",
      "no_production_ga_claim",
      "no_absolute_security_claim",
    ],
    risks: [
      { riskId: "risk-01", severity: "high" },
      { riskId: "risk-02", severity: "high" },
      { riskId: "risk-03", severity: "high" },
      { riskId: "risk-04", severity: "medium" },
      { riskId: "risk-05", severity: "high" },
      { riskId: "risk-06", severity: "medium" },
      { riskId: "risk-07", severity: "medium" },
      { riskId: "risk-08", severity: "high" },
      { riskId: "risk-09", severity: "high" },
      { riskId: "risk-10", severity: "medium" },
    ],
    safety,
  };

  const archiveJson = {
    binderId: "final_yiyi_commercial_demo_binder",
    sourceAudit: "Phase564",
    referenceOnlyPolicy: "do_not_delete_do_not_move_reference_only",
    primaryBinderPhases: primarySourcePhases,
    archiveOnlyNotPromoted: true,
    representativeArchivedPhases: archiveList.phases.slice(0, 60).map((item) => ({
      phase: item.phase,
      valueLevel: item.valueLevel,
      reason:
        item.valueLevel === "closure_only"
          ? "closure_only"
          : item.valueLevel === "archive_only"
            ? "superseded_by_final_binder"
            : "duplicate",
    })),
  };

  const manifestJson = {
    binderId: "final_yiyi_commercial_demo_binder",
    version: "v1.0",
    createdFrom: "Phase386-Phase563 audit",
    sourceAudit: "Phase564",
    primaryMaterials: primarySourcePhases.map((phase) => keepMap.get(phase)).filter(Boolean),
    referenceOnlyMaterials: usefulReferencePhases.map((phase) => keepMap.get(phase)).filter(Boolean),
    safety: {
      providerCallsMade: false,
      secretValueExposed: false,
      rawSecretAccessed: false,
      deployExecuted: false,
      releaseExecuted: false,
      billingExecuted: false,
      invoiceGenerated: false,
      productionGaClaimed: false,
      workspaceCleanClaimed: false,
    },
    phase384Status: {
      realProviderTestExecuted: false,
      requiresHumanApproval: true,
    },
  };

  const closureJson = {
    task: "Final-Yiyi-Demo-Binder",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    sourceRange: "Phase386-Phase563",
    sourceAuditPhase: "Phase564",
    highValueSourcesUsed: 9,
    autoRunFillerStopped: true,
    finalBinderCreated: true,
    archiveOnlyNotPromoted: true,
    duplicateMaterialsDeduplicated: true,
    phase565PlusNotGenerated: true,
    buildYiyiLowRiskPhasePackNotCalled: true,
    safety,
  };

  await writeFile(join(binderDir, "final-yiyi-commercial-demo-binder-index.md"), renderIndexMd({ archiveSummary: archivePrimary }));
  await writeFile(join(binderDir, "final-yiyi-commercial-demo-binder-index.json"), `${JSON.stringify(indexJson, null, 2)}\n`);
  await writeFile(join(binderDir, "final-yiyi-guided-demo-script.md"), renderScriptMd());
  await writeFile(join(binderDir, "final-yiyi-recording-shotlist.md"), renderShotlistMd());
  await writeFile(join(binderDir, "final-yiyi-sales-handoff-pack.md"), renderSalesMd());
  await writeFile(join(binderDir, "final-yiyi-evidence-trace-map.md"), renderEvidenceMd(phase386Closure, phase564Closure));
  await writeFile(join(binderDir, "final-yiyi-evidence-trace-map.json"), `${JSON.stringify(evidenceTraceJson, null, 2)}\n`);
  await writeFile(join(binderDir, "final-yiyi-risk-register-known-limits.md"), renderRiskMd());
  await writeFile(join(binderDir, "final-yiyi-risk-register-known-limits.json"), `${JSON.stringify(riskJson, null, 2)}\n`);
  await writeFile(join(binderDir, "final-yiyi-operator-handoff.md"), renderOperatorMd());
  await writeFile(join(binderDir, "final-yiyi-demo-reference-archive-map.md"), renderArchiveMd());
  await writeFile(join(binderDir, "final-yiyi-demo-reference-archive-map.json"), `${JSON.stringify(archiveJson, null, 2)}\n`);
  await writeFile(join(binderDir, "final-yiyi-commercial-demo-binder-manifest.json"), `${JSON.stringify(manifestJson, null, 2)}\n`);
  await writeFile(join(binderDir, "final-yiyi-demo-binder-closure.md"), renderClosureMd());
  await writeFile(join(evidenceDir, "final-yiyi-demo-binder-closure-result.json"), `${JSON.stringify(closureJson, null, 2)}\n`);

  console.log(JSON.stringify({
    task: "Final-Yiyi-Demo-Binder",
    completed: true,
    highValueSourcesUsed: 9,
    finalBinderCreated: true,
    archiveOnlyNotPromoted: true,
    phase565PlusNotGenerated: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
