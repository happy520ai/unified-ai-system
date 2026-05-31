export function buildTianshuReviewerBlockedActionBanner(action) {
  const blocked = ["activate_without_approval", "auto_apply", "skip_dry_run"].includes(action);
  return {
    blockedActionBannerVisible: blocked,
    action,
    blocked,
    blockedReason: blocked ? "Reviewer console requires dry-run and explicit governance approval before activation." : null,
  };
}
