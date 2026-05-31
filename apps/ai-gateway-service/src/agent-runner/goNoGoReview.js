export const GO_NO_GO_STATUSES = ["go", "no-go", "review-required"];

export function buildGoNoGoReview(input = {}) {
  const blockers = Array.isArray(input.blockers) ? input.blockers : [];
  const warnings = Array.isArray(input.warnings) ? input.warnings : [];
  const commandsRun = Array.isArray(input.commandsRun) ? input.commandsRun : [];
  const commandsSkipped = Array.isArray(input.commandsSkipped) ? input.commandsSkipped : [];
  const evidencePaths = Array.isArray(input.evidencePaths) ? input.evidencePaths : [];
  const changedFiles = Array.isArray(input.changedFiles) ? input.changedFiles : [];
  const boundaryCheck = {
    fullOpenEnabled: false,
    autoCommit: false,
    autoPush: false,
    releaseOrDeploy: false,
    ...(input.boundaryCheck ?? {}),
  };

  let status = "go";
  if (
    blockers.length > 0
    || boundaryCheck.fullOpenEnabled === true
    || boundaryCheck.autoCommit === true
    || boundaryCheck.autoPush === true
    || boundaryCheck.releaseOrDeploy === true
  ) {
    status = "no-go";
  } else if (warnings.length > 0 || commandsSkipped.length > 0 || input.approvalRequired === true) {
    status = "review-required";
  }

  return {
    status,
    blockers,
    warnings,
    commandsRun,
    commandsSkipped,
    evidencePaths,
    changedFiles,
    boundaryCheck,
    nextSteps: Array.isArray(input.nextSteps) ? input.nextSteps : [],
    approvalRequired: input.approvalRequired === true,
    autoCommit: false,
    autoPush: false,
    releaseOrDeploy: false,
  };
}
