export function buildPhase601RollbackCommandPreview() {
  return {
    completed: true,
    rollbackCommandPreviewGenerated: true,
    rollbackCommands: [
      "clear session_override openai_base_url for the active Codex process",
      "restore previous config snapshot ref if a later phase created one",
      "disable relay flag by ref",
      "mark context freshness stale for follow-up review",
      "preserve Phase601/Phase602 evidence",
    ],
    forbiddenCommands: ["git reset --hard", "git clean -fd"],
    rollbackCommandExecuted: false,
    destructiveRollbackForbidden: true,
    evidencePreservationIncluded: true,
  };
}
