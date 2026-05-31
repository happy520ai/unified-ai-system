# Phase1905A Command Palette Gated Real Run Entry

Phase1905A adds a gated real-run entry to Owner OS / Command Palette.

## UI Copy Requirements

- 显示“真实创建需要单独确认”
- 显示“默认先预览”
- 显示“不会覆盖已有文件”
- 显示“不会扫描桌面”
- 显示“不会读取桌面其他文件”

## Approval

Real run requires `docs/approvals/phase1905a-owner-desktop-real-run.input.json`.

If the file is missing, the verifier writes `docs/approvals/phase1905a-owner-desktop-real-run.input.template.json`, sets `completed=true`, `recommended_sealed=false`, and records blocker `owner_real_run_approval_missing`.

The template is not a real owner approval.
