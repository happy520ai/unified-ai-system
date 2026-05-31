# Phase378E Mission Control Avatar Event Bridge

- 事件桥只负责把 Mission Control UI 事件映射到依依的行为与情绪状态。
- 事件桥不触发 provider、不触发 deploy、不读取 secret、不修改 evidence。
- 所有映射都保留 action matrix 约束。
