export function createOperatorPreviewExplainer() {
  return {
    permissionModeExplanation: [
      "Manual Approval Mode keeps writes and patch apply behind explicit human approval.",
      "Auto Review Mode may auto-run only whitelisted local verifiers, but it is still not full_open.",
      "full_open remains disabled and is not an available operator mode.",
    ],
    approvalRecordExplanation: [
      "Approval records describe whether a future apply path could be considered under bounded rules.",
      "Approval metadata does not mean a patch has already been applied.",
      "Manual mode expects patch-level approval; auto_review may accept task-level approval under the existing bounded policy.",
    ],
    dryRunExplanation: [
      "dryRunDefault=true keeps the preview in a non-executing posture.",
      "The preview explains what would be reviewed without performing patch apply or review execution.",
    ],
    applyReadyExplanation: [
      "Apply-ready is a descriptive state only.",
      "It means the bounded rules for a future apply path are understood, not that Phase300A performs apply.",
      "realPatchAppliedByDefault remains false.",
    ],
    goNoGoExplanation: [
      "go means no blocker is currently represented in the preview state.",
      "no-go means a blocker, boundary failure, or failed command would stop progress.",
      "review-required means a human should inspect warnings, skipped items, or pending approval context before proceeding.",
    ],
    rollbackManifestExplanation: [
      "Rollback manifest summaries describe what would need operator review if a future approved patch changed files.",
      "They summarize changed files and before/after references without exposing secret content or enabling automatic rollback.",
    ],
    evidenceLinkageExplanation: [
      "Phase299A evidence records that the operator preview is read-only.",
      "Phase297A-298A evidence records dry-run-by-default patch and review boundaries.",
      "Upstream verifier presence links the current preview state back to prior bounded phases.",
    ],
    blockerExplanation: [
      "A blocker is a stop condition that should prevent the operator from treating the state as ready.",
    ],
    warningExplanation: [
      "A warning indicates that review is still needed even when no hard blocker is present.",
    ],
    informationalExplanation: [
      "Informational notes provide context such as full_open remaining disabled and workspace cleanliness not being claimed.",
    ],
  };
}

export const OPERATOR_PREVIEW_EXPLAINER = createOperatorPreviewExplainer();

export function getOperatorPreviewExplainer() {
  return OPERATOR_PREVIEW_EXPLAINER;
}
