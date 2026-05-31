# Codex UI Rewrite Playbook

phaseRange: Phase1821-1840AIO

Codex 每次修改 UI 前必须:

1. 读取 `PME_DESIGN.md`.
2. 读取 `OWNER_HOME_DESIGN.md`.
3. 读取 `CHINESE_UI_COPY_RULES.md`.
4. 判断修改是否增加 owner 认知负担.
5. 如果增加按钮数量，必须解释原因.
6. 如果暴露工程词，必须放高级模式或加中文解释.
7. 修改后运行 design verifier.
8. 生成 screenshot evidence when UI changed.

## Required Verifiers

- `pnpm run verify:phase1840-codex-design-knowledge-pack-seal`
- Owner Home contract verifier.
- Owner Report contract verifier.
- No engineering-backend regression guard.
- No button wall guard.
- No phase jargon owner-home guard.

## Output Discipline

When reporting UI work, distinguish:

- implemented UI
- design reference
- automated browser evidence
- owner manual feedback
- known limits

Never say a design reference is shipped UI. Never say automated evidence is human feedback.

