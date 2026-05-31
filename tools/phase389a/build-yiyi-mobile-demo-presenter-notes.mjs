import {
  ensure,
  fileInfo,
  makePhase389Result,
  phase389MobileReviewTargets,
  phase389PresenterSections,
  phase389Safety,
  writeJson,
  writeText,
} from "../phase389-common.mjs";

const phase388Closure = fileInfo("apps/ai-gateway-service/evidence/phase388/yiyi-demo-recording-asset-pack-closure-result.json");
ensure(phase388Closure.exists && phase388Closure.sizeBytes > 20, "Phase388 closure is required before Phase389.");

const presenterNotes = phase389PresenterSections.map((section, index) => ({
  section,
  order: index + 1,
  presenterCue:
    section === "opening"
      ? "Frame Yiyi as a Mission Companion guiding an Agent-managed AI Mission Control demo."
      : section === "brain_status"
        ? "State clearly that model brain remains disabled by default and the current demo is dry-run."
        : section === "closing"
          ? "Close with commercial readiness, safety boundaries, and remaining manual review needs."
          : "Keep the line concise, visible, and tied to the guided showcase step.",
  requiredSafetyLine:
    section === "security_shield" || section === "red_team"
      ? "No provider call, no secret exposure, no deployment, and no approval bypass are performed."
      : "This remains a local guided demo with no real provider execution.",
}));

const mobileChecklist = {
  phase: "Phase389A",
  title: "Yiyi Mobile Demo Adaptation + Presenter Notes",
  packageType: "mobile_demo_presenter_notes",
  sourcePhase: "Phase388",
  mobileReviewTargets: phase389MobileReviewTargets,
  presenterNotes,
  manualMobileBrowserReviewRequired: true,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase389a-yiyi-mobile-demo-review-checklist.json", mobileChecklist);
await writeText(
  "docs/phase389a-yiyi-mobile-demo-adaptation.md",
  [
    "# Phase389A Yiyi Mobile Demo Adaptation",
    "",
    "Phase389A prepares mobile and tablet review targets for the Yiyi guided commercial demo.",
    "",
    "Scope:",
    "- Define mobile/tablet review targets for manual browser checks.",
    "- Keep the guided showcase language compact for presenter use.",
    "- Preserve the no-provider-call, no-secret, no-deploy, no-billing safety posture.",
    "",
    "Review targets:",
    ...phase389MobileReviewTargets.map((item) => `- ${item.viewport} (${item.label}): ${item.reviewFocus}`),
  ].join("\n"),
);
await writeText(
  "docs/phase389a-yiyi-presenter-notes.md",
  [
    "# Phase389A Yiyi Presenter Notes",
    "",
    "Use these notes as a concise presenter layer over the existing Phase386/388 guided showcase assets.",
    "",
    ...presenterNotes.map(
      (item) =>
        `## ${item.order}. ${item.section}\n\n- Cue: ${item.presenterCue}\n- Safety line: ${item.requiredSafetyLine}`,
    ),
  ].join("\n"),
);

const result = makePhase389Result({
  phase: "Phase389A",
  mobileDemoAdaptationCreated: true,
  presenterNotesCreated: true,
  mobileReviewChecklistCreated: true,
  manualMobileBrowserReviewRequired: true,
  reviewTargetCount: phase389MobileReviewTargets.length,
  presenterSectionCount: presenterNotes.length,
  ...phase389Safety,
});

await writeJson("apps/ai-gateway-service/evidence/phase389a/yiyi-mobile-demo-presenter-notes-result.json", result);
console.log(JSON.stringify(result, null, 2));
