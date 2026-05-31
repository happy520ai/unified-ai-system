# Final Yiyi Risk Register + Known Limits

## risk-01

- riskId: risk-01
- risk: 当前仍是 no-deploy / internal demo。
- severity: high
- mitigation: 所有对外话术统一使用 guided demo / internal demo。
- ownerHint: product-owner
- demoTalkingPoint: 这是商业演示主包，不是生产发布包。

## risk-02

- riskId: risk-02
- risk: 未真实接 provider。
- severity: high
- mitigation: 明确 provider disabled by default，真实测试走 Phase384。
- ownerHint: solution-owner
- demoTalkingPoint: 当前默认不调用任何真实 provider。

## risk-03

- riskId: risk-03
- risk: 未执行 Phase384。
- severity: high
- mitigation: 把授权门写入 index、script、risk、operator handoff。
- ownerHint: governance-owner
- demoTalkingPoint: 真实 provider test 需要显式人工授权。

## risk-04

- riskId: risk-04
- risk: 依依真实 3D glTF/GLB 仍未完成。
- severity: medium
- mitigation: 对外说明当前仍是 pseudo-3D / concept-based 视觉。
- ownerHint: design-owner
- demoTalkingPoint: 当前视觉已足够演示，但不宣称真实 3D 已完工。

## risk-05

- riskId: risk-05
- risk: 真实模型大脑仍默认 disabled。
- severity: high
- mitigation: 所有脚本统一表述为 mock / dry-run posture。
- ownerHint: brain-owner
- demoTalkingPoint: 依依大脑当前默认关闭真实模型调用。

## risk-06

- riskId: risk-06
- risk: 商业演示需要人工复核。
- severity: medium
- mitigation: 录屏前按 operator checklist 复核镜头与文案。
- ownerHint: demo-operator
- demoTalkingPoint: 建议人工录屏和彩排后再对外演示。

## risk-07

- riskId: risk-07
- risk: 跨浏览器 / 移动端仍需进一步 QA。
- severity: medium
- mitigation: 沿用 Phase387 / Phase389 作为补充复核参考。
- ownerHint: qa-owner
- demoTalkingPoint: 桌面演示更稳，移动端仍建议补充复核。

## risk-08

- riskId: risk-08
- risk: 真实客户试点前需要授权和测试。
- severity: high
- mitigation: 先走人工评审，再决定是否进入 Phase384。
- ownerHint: commercial-owner
- demoTalkingPoint: 试点前必须先补授权和测试，不可跳过。

## risk-09

- riskId: risk-09
- risk: 不能承诺 production GA。
- severity: high
- mitigation: 所有销售与技术脚本写明 no production GA。
- ownerHint: sales-owner
- demoTalkingPoint: 当前不承诺生产可用或已发布。

## risk-10

- riskId: risk-10
- risk: 不能承诺绝对安全。
- severity: medium
- mitigation: 强调现阶段是可见化边界与 evidence，而非绝对安全承诺。
- ownerHint: security-owner
- demoTalkingPoint: 我们展示的是安全机制和拦截结果，不是绝对安全。
