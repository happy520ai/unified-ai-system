# Owner Home Design Contract

phaseRange: Phase1821-1840AIO

## Contract

- 第一屏只允许一个 primary CTA.
- 必须展示三张结果卡:
  - 今天完成了什么
  - 发现了什么问题
  - 下一步点哪里
- 工程模块默认折叠.
- 高级模式不能干扰 owner.
- owner 不应看到 Phase / verifier / trace / raw evidence path.
- owner 不应看到 raw Provider details or Provider Gate phrasing on the first screen.
- owner only sees 今天完成了什么 / 发现了什么问题 / 下一步点哪里.

## Required First-Screen Structure

1. Plain Chinese heading.
2. One reassurance line explaining local-only operation.
3. One primary action: 让小天自动检查今天系统状态.
4. Visible feedback area for the action.
5. Three result cards.
6. Owner daily report preview or shortcut.
7. Advanced Mode disclosure below the owner task.

## Owner Must Not Need To Know

- What a phase is.
- What a verifier is.
- What a trace is.
- Where raw evidence JSON lives.
- How Provider Gate or CredentialRef work.
- Which module owns a backend subsystem.

## Allowed Advanced Details

Advanced Mode may include phase ids, evidence paths, trace names, dry-run labels, local log paths, verifier names, and Provider Gate state, but only after explicit disclosure.

