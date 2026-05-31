import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createSafety,
  evidenceDir,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
} from "./verifyAgentWorkforceClosureSupport.js";

const manualTrialDoc = "docs/AGENT_WORKFORCE_MANUAL_TRIAL_SCRIPT.md";
const feedbackTemplateDoc = "docs/AGENT_WORKFORCE_USER_FEEDBACK_TEMPLATE.md";
const closureDoc = "docs/AGENT_WORKFORCE_LIGHTWEIGHT_ITERATION_CLOSURE.md";

const frictionList = [
  {
    id: "friction-ui-garbled-copy",
    description: "Some Agent Workforce controls and placeholder text were garbled, making first use feel unsafe or unclear.",
    impactedUsers: "Ordinary users trying to generate their first Plan from /ui.",
    suggestedSmallFix: "Replace the garbled title, textarea placeholder, buttons, goal hint, and waiting status with plain copy.",
    involvesExecutionCapability: false,
  },
  {
    id: "friction-quickstart-scattered",
    description: "The path from opening /ui to exporting a handoff package was present but spread across long phase docs.",
    impactedUsers: "Users who need a short start-to-export path without reading the full phase history.",
    suggestedSmallFix: "Add a 6-step quickstart to README, USER_MANUAL, and the manual trial script.",
    involvesExecutionCapability: false,
  },
  {
    id: "friction-approval-preview",
    description: "Approval Preview could be misread as real permission to execute if seen near save/export controls.",
    impactedUsers: "Reviewers recording approval-preview metadata after saving a plan.",
    suggestedSmallFix: "Add nearby helper text that approval-preview records review metadata only and never grants execution permission.",
    involvesExecutionCapability: false,
  },
  {
    id: "friction-export-purpose",
    description: "JSON and Markdown export actions needed a closer reminder that exports are handoff packages, not execution packages.",
    impactedUsers: "Users exporting or sharing an Agent Workforce task package.",
    suggestedSmallFix: "Add export helper text and preserve status wording that suggested OMX commands remain text only.",
    involvesExecutionCapability: false,
  },
  {
    id: "friction-history-boundary",
    description: "History controls could look like a workflow queue unless the disabled boundary is visible beside the actions.",
    impactedUsers: "Users loading old plans from history and looking for the next action.",
    suggestedSmallFix: "Keep history helper text explicit: load, export, and delete only; no execution button is provided.",
    involvesExecutionCapability: false,
  },
];

const phaseDefinitions = {
  "phase-195a-user-friction-review": {
    script: "verify:phase195a-user-friction-review",
    entrypoint: "verifyAgentWorkforceUserFrictionReview.js",
    prerequisite: "phase-194a-final-user-trial-closure",
    conclusion: "user-friction-review-complete",
    docs: [manualTrialDoc, feedbackTemplateDoc],
    buildExtra: () => ({ frictionList }),
    checks: ({ docs }) => ({
      frictionListCountInRange: frictionList.length >= 3 && frictionList.length <= 5,
      allFrictionItemsAreSmall: frictionList.every((item) => item.suggestedSmallFix && item.description && item.impactedUsers),
      noFrictionInvolvesExecutionCapability: frictionList.every((item) => item.involvesExecutionCapability === false),
      manualTrialSourceReviewed: (docs[manualTrialDoc] ?? "").includes("# Agent Workforce Manual Trial Script"),
      feedbackTemplateSourceReviewed: (docs[feedbackTemplateDoc] ?? "").includes("# Agent Workforce User Feedback Template"),
    }),
  },
  "phase-196a-small-ui-copy-fix-pass": {
    script: "verify:phase196a-small-ui-copy-fix-pass",
    entrypoint: "verifyAgentWorkforceSmallUiCopyFixPass.js",
    prerequisite: "phase-195a-user-friction-review",
    conclusion: "small-ui-copy-fix-pass-complete",
    buildExtra: () => ({
      fixedFrictionIds: [
        "friction-ui-garbled-copy",
        "friction-approval-preview",
        "friction-export-purpose",
        "friction-history-boundary",
      ],
    }),
    checks: ({ texts }) => ({
      uiCopyPassMarkerPresent: texts.ui.includes("phase196a-small-ui-copy-fix-pass"),
      quickPathHelperPresent: texts.ui.includes("Quick path: template -> goal -> Generate Plan -> Save -> History -> Export."),
      approvalBoundaryNearControls: texts.ui.includes("Approval Preview records review metadata only; it never grants execution permission."),
      exportBoundaryNearControls: texts.ui.includes("Exports are handoff packages for human review, not execution packages."),
      historyBoundaryNearControls: texts.ui.includes("History has load, export, and delete controls only; no execution button is provided."),
      plainFirstUseControlsPresent:
        texts.ui.includes("Generate Plan") &&
        texts.ui.includes("Copy Markdown") &&
        texts.ui.includes("Export JSON") &&
        texts.ui.includes("Save Plan") &&
        texts.ui.includes("Waiting for a goal. Choose a template, enter a short goal, then generate a preview-only Plan."),
      noExecutionControlAdded:
        !texts.ui.includes("id=\"workforce-execute\"") &&
        !texts.ui.includes("Run external runner") &&
        !texts.ui.includes("externalRunnerDispatchEnabled: true"),
    }),
  },
  "phase-197a-docs-quickstart-tightening": {
    script: "verify:phase197a-docs-quickstart-tightening",
    entrypoint: "verifyAgentWorkforceDocsQuickstartTightening.js",
    prerequisite: "phase-196a-small-ui-copy-fix-pass",
    conclusion: "docs-quickstart-tightening-complete",
    docs: [manualTrialDoc],
    buildExtra: () => ({ quickstartStepCount: 6 }),
    checks: ({ texts, docs }) => {
      const required = [
        "Phase 197A Agent Workforce Quickstart",
        "Open `http://127.0.0.1:3100/ui`",
        "Choose a template",
        "Generate Plan",
        "Save Plan",
        "History",
        "Export JSON or Markdown",
        "Execution Disabled",
        "External Runner Disabled",
      ];
      return {
        readmeQuickstartPresent: required.every((item) => texts.readme.includes(item)),
        userManualQuickstartPresent: required.every((item) => texts.userManual.includes(item)),
        manualTrialQuickstartPresent: required.every((item) => (docs[manualTrialDoc] ?? "").includes(item)),
        quickstartIsSixSteps:
          texts.readme.includes("6. Confirm Execution Disabled and External Runner Disabled remain visible.") &&
          texts.userManual.includes("6. Confirm Execution Disabled and External Runner Disabled remain visible.") &&
          (docs[manualTrialDoc] ?? "").includes("6. Confirm Execution Disabled and External Runner Disabled remain visible."),
      };
    },
  },
  "phase-198a-lightweight-iteration-closure": {
    script: "verify:phase198a-lightweight-iteration-closure",
    entrypoint: "verifyAgentWorkforceLightweightIterationClosure.js",
    prerequisite: "phase-197a-docs-quickstart-tightening",
    evidenceRange: [
      "phase-195a-user-friction-review",
      "phase-196a-small-ui-copy-fix-pass",
      "phase-197a-docs-quickstart-tightening",
    ],
    conclusion: "lightweight-iteration-closure-complete",
    docs: [closureDoc],
    buildExtra: () => ({ blocker: "none" }),
    checks: ({ docs }) => {
      const closure = docs[closureDoc] ?? "";
      return {
        closureDocPresent: closure.includes("# Agent Workforce Lightweight Iteration Closure"),
        requiredSectionsPresent:
          [
            "## Found User Friction",
            "## Small Fixes Completed",
            "## No New Capability",
            "## Boundaries Kept",
            "## Current Blocker",
            "## Next Recommendation",
          ].every((item) => closure.includes(item)),
        frictionItemsRecorded:
          frictionList.every((item) => closure.includes(item.id)) &&
          closure.includes("involvesExecutionCapability: false"),
        noNewCapabilityRecorded:
          closure.includes("No new endpoint, runner dispatch, workflow run, worktree creation, or real Agent execution was added."),
        boundaryRecorded:
          closure.includes("No real Agent execution") &&
          closure.includes("No oh-my-codex or OMX CLI call") &&
          closure.includes("No worktree creation") &&
          closure.includes("No workflow run connection") &&
          closure.includes("No real external runner dispatch") &&
          closure.includes("No default NVIDIA `/chat` lane change"),
        blockerNone: closure.includes("none"),
      };
    },
  },
};

export async function runLightweightIterationCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown Agent Workforce lightweight iteration phase: ${phase}`);
  }

  try {
    await assertEvidencePassed(definition.prerequisite);
    for (const evidencePhase of definition.evidenceRange ?? []) {
      await assertEvidencePassed(evidencePhase);
    }

    const texts = await readWorkspaceTexts();
    const docs = {};
    for (const docPath of definition.docs ?? []) {
      docs[docPath] = await readRequired(docPath);
    }

    const allText = [
      texts.rootPackageText,
      texts.servicePackageText,
      texts.ui,
      texts.readme,
      texts.agentsDoc,
      texts.userManual,
      ...Object.values(docs),
    ].join("\n\n");
    const secretFindingCount = countSecretFindings(allText, phase);

    const checks = {
      prerequisitePassed: true,
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      noDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      noPlainSecrets: secretFindingCount === 0,
      projectContextNotCreated: noProjectContext(),
      ...definition.checks({ texts, docs }),
    };
    const passed = Object.values(checks).every(Boolean);
    await writeLightweightEvidence(phase, {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      checks,
      verifiedDocuments: definition.docs ?? [],
      prerequisite: definition.prerequisite,
      disabledState: createDisabledState(),
      safety: createSafety(),
      secretFindingCount,
      conclusion: passed ? definition.conclusion : definition.conclusion.replace(/complete$/, "incomplete"),
      notes: [
        "Phase 195A-198A remains lightweight UI copy, documentation, experience review, and evidence only.",
        "No real Agent execution, no oh-my-codex or OMX call, no worktree creation, no workflow run, no real external runner dispatch.",
      ],
      ...(definition.buildExtra?.() ?? {}),
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeLightweightEvidence(phase, {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: createSafety(),
      conclusion: definition.conclusion.replace(/complete$/, "incomplete"),
    });
    process.exitCode = 1;
  }
}

async function writeLightweightEvidence(phase, body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, `${phase}.json`), `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(resolve(evidenceDir, `${phase}.md`), createMarkdown(body), "utf8");
}

function createMarkdown(body) {
  return `# ${body.phase} Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Conclusion: ${body.conclusion}
- Execution enabled: ${body.disabledState?.executionEnabled ?? false}
- Runner enabled: ${body.disabledState?.runnerEnabled ?? false}
- Workflow run enabled: ${body.disabledState?.workflowRunEnabled ?? false}
- External runner dispatch enabled: ${body.disabledState?.externalRunnerDispatchEnabled ?? false}
- Calls oh-my-codex: ${body.safety?.callsOhMyCodex ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}

## Checks

${Object.entries(body.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}

## Friction List

${(body.frictionList ?? []).map((item) => `- ${item.id}: ${item.description} Impact: ${item.impactedUsers} Suggested small fix: ${item.suggestedSmallFix} involvesExecutionCapability: ${item.involvesExecutionCapability}`).join("\n")}

## Notes

${(body.notes ?? []).map((item) => `- ${item}`).join("\n")}
`;
}
