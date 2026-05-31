export const routeQualityRound2Copy = Object.freeze({
  title: "Route Quality Round 2",
  subtitle: "Read-only status for Phase941-960 Round 2 NVIDIA-only route quality testing.",
  badges: [
    "NVIDIA-only",
    "CredentialRef-only",
    "approval-gated",
    "no default route change",
    "no deploy",
  ],
  safetyLines: [
    "Missing approval blocks all Provider requests.",
    "Failed, blocked, high-risk, deprecated, and credential-missing models are excluded before runtime.",
    "The panel does not expose buttons for Provider execution, selectable mutation, /chat enablement, deploy, release, or secret reads.",
  ],
});
