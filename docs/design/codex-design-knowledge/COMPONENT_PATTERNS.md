# Component Patterns

phaseRange: Phase1821-1840AIO

## OwnerPrimaryAction

One visually dominant button for owner flow. It starts the local boss-mode check or opens the current owner report. It must have feedback after click.

## OwnerStatusCard

Reusable shell for the three required owner cards: 今天完成了什么 / 发现了什么问题 / 下一步点哪里. Cards should use plain Chinese and avoid technical paths on the first screen.

## OwnerDailyReport

Report surface that summarizes Codex automation in owner language. It must place evidence/log paths in a bottom advanced section.

## NextActionCard

Gives one clear next action. Do not present multiple competing CTAs to the owner.

## AdvancedModeDrawer

Contains engineering details, phase ids, verifier names, evidence paths, trace data, provider gate state, and local logs. It is collapsed by default.

## FailureFriendlyMessage

Explains failure reason, local log path, and one next step. It must not blame the owner or expose raw stack traces in the first screen.

## ButtonFeedbackState

Visible, persistent feedback near the clicked button. It should show started, completed, blocked, skipped, or failed in Chinese.

