# Final Yiyi Operator Handoff

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
