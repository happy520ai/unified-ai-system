# Phase386C Yiyi Demo Scenario Pack

The scenario pack maps the Guided Showcase into ten demo scenes. Each scene contains a Yiyi line, emotion state, behavior state, highlight panel, visible safety badges, and explicit no-provider/no-secret/no-deploy flags.

1. Welcome: 欢迎来到 Mission Control。我会带你看一套 dry-run 演示，不读密钥，不调用 Provider，也不部署。
2. Mission Control Overview: 这里不是普通 Chatbot，而是能看见模式、护盾、证据和任务路径的 AI Mission Control。
3. Normal Mode Preview: Normal Mode 展示普通聊天入口的概念，但本轮只是 preview，不会真的发起模型请求。
4. God Mode Arena Preview: God Mode 像一个审查竞技场：Reviewer、Critic、Risk Scout 和 Supervisor 会互相校验。
5. Tianshu Planning Preview: 天枢负责理解任务、匹配能力、规划路径和准备 fallback。本轮只展示调度思路。
6. Security Shield Demo: 安全护盾会标出 prompt injection、secret leak、provider gate 和 approval gate。
7. Red Team Block Demo: 这个请求有点危险，我先帮你挡住啦。攻击演示只记录拦截结果，不执行动作。
8. Evidence Replay Demo: Evidence Replay 会把 evidenceId、trace、blockedActions 和 fallbackReason 摆出来。
9. Yiyi Brain Status: 依依大脑当前默认 dry-run/mock，model-backed brain disabled by default，真实测试必须授权。
10. Closing Summary: 这套 Demo 展示高级、好玩、稳定和安全，但它仍是 internal no-deploy demo，不是 production GA。

All scenarios remain local dry-run preview scenes.
