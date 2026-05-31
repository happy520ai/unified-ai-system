# PME Design

phaseRange: Phase1821-1840AIO

## productIdentity

PME is a 本地老板 AI 总控台: one local owner checks whether the AI Gateway system can be used today, whether anything is risky, and what the next action is.

## designGoal

零学习、少按钮、中文日报、结果优先。The owner should not need to understand phases, verifiers, evidence paths, trace files, provider gates, or engineering route names before using the system.

## visualStyle

- 极简未来 OS.
- 深色科技感 may be used sparingly, but the owner workflow must stay calm and legible.
- 大留白.
- 清晰状态.
- Product-like, not engineering-backend-like.
- Local system fonts only.

## ownerModePrinciples

- Boss home first, engineering backend second.
- The first screen has one primary CTA.
- The page shows three result cards: 今天完成了什么 / 发现了什么问题 / 下一步点哪里.
- Reports are more important than the page.
- Every button click must produce visible feedback.
- Codex automation results must be translated into a boss daily report.

## operatorModePrinciples

- Operator mode may show diagnostics, logs, and local evidence references.
- Operator mode must remain local-only unless a later phase explicitly authorizes a gated path.
- Operator controls must distinguish dry-run, preview, skipped, blocked, and real execution.

## engineeringModePrinciples

- Engineering modules must be collapsed by default for owner-facing pages.
- Phase, verifier, trace, raw evidence path, raw provider detail, and CredentialRef details belong in Advanced Mode.
- Engineering mode must not compete with the owner primary task.

## typographyRules

- Use local system fonts only, with Microsoft YaHei / Segoe UI / Arial fallbacks.
- Avoid viewport-scaled text.
- Headings should be short and Chinese-first.
- Technical English may appear only when it is a product name, route id, or advanced-mode detail.

## spacingRules

- Prefer stable, breathable spacing over dense module stacking.
- Use 8px-radius cards and buttons unless a local design token already says otherwise.
- Fixed-format elements need stable dimensions so feedback text does not shift the layout.

## buttonRules

- Owner Home has exactly one primary CTA.
- Secondary actions must be links, folded details, or advanced-mode actions.
- Every clickable control must show visible feedback.
- Disabled or gated actions must explain why in plain Chinese.

## cardRules

- The three owner result cards are mandatory.
- Cards must answer what happened, what is wrong, and what to do next.
- Cards must not expose JSON, trace, raw evidence paths, or phase jargon in the first screen.

## statusRules

- Say "没有调用真实模型" instead of making Provider status sound mysterious.
- Say "系统检查通过" instead of "verifier passed" in owner-facing copy.
- Say "详细记录已保存，可在高级模式查看" instead of "evidence path".

## reportRules

- The owner daily report is the primary deliverable.
- The report title must be Chinese.
- The first screen of the report has only owner-understandable facts.
- Advanced details go at the bottom.
- The next step gives one primary action only.

## accessibilityRules

- Controls need accessible labels or visible labels.
- Status feedback uses `role="status"` or an equivalent visible feedback region.
- Color must not be the only signal.
- Text must fit on narrow screens.

## forbiddenPatterns

- Button wall.
- Engineering dashboard as owner home.
- Exposed Phase / evidence / trace / Provider Gate on owner first screen.
- Remote fonts, CDN imports, external image hotlinks.
- Fancy 3D, complex big-screen cockpit, or decorative module pile-up.
- Claiming a design doc, screenshot, or automated test is deployed product readiness.

