export function buildPhase603ConfigRollbackPreview() {
  return {
    completed: true,
    rollbackPreviewGenerated: true,
    destructiveRollbackForbidden: true,
    evidencePreservationIncluded: true,
    configModified: false,
    steps: [
      "session_override: no persistent rollback needed after the command exits",
      "project_config_preview: restore or delete only the preview artifact, not .codex/config.toml",
      "project_config: restore previous file snapshot only after explicit later approval",
      "user_config: restore previous file snapshot only after explicit later approval",
      "preserve docs and evidence for audit",
      "never use git reset --hard as rollback",
    ],
  };
}
