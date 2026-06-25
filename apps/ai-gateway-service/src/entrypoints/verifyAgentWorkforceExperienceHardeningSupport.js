import {
  assertEvidencePassed,
  countSecretFindings,
  createDisabledState,
  createPreviewPlan,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";
import { definitions, demoGoals } from "./verifyAgentWorkforceExperienceHardeningDefinitions.js";

export async function runExperienceHardeningCheck(phase) {
  const definition = definitions[phase];
  if (!definition) {
    throw new Error(`Unknown Agent Workforce experience hardening phase: ${phase}`);
  }
  try {
    await assertEvidencePassed(definition.prerequisite);
    if (definition.evidenceRange) {
      await Promise.all(definition.evidenceRange.map((item) => assertEvidencePassed(item)));
    }
    const texts = await readWorkspaceTexts();
    const docs = {};
    for (const path of definition.docs ?? []) {
      docs[path] = await readRequired(path);
    }
    const previewRun = definition.needsPlan
      ? await createPreviewPlan({
        phase,
        selectedTemplate: definition.selectedTemplate ?? "feature-development",
        goal: definition.goal ?? demoGoals[0],
      })
      : null;
    const allText = [
      texts.rootPackageText,
      texts.servicePackageText,
      texts.contracts,
      texts.planner,
      texts.store,
      texts.ui,
      texts.readme,
      texts.agentsDoc,
      texts.userManual,
      ...Object.values(docs),
      JSON.stringify(previewRun ?? {}),
    ].join("\n\n");
    const secretFindingCount = countSecretFindings(allText, phase);
    const phaseChecks = definition.checks({ texts, docs, previewRun });
    const checks = {
      prerequisitePassed: true,
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      noDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      noPlainSecrets: secretFindingCount === 0,
      projectContextNotCreated: noProjectContext(),
      ...phaseChecks,
    };
    const passed = Object.values(checks).every(Boolean);
    await writeEvidence(phase, {
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
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeEvidence(phase, {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: createSafety(),
      conclusion: definitions[phase]?.conclusion?.replace(/complete$/, "incomplete") ?? "agent-workforce-experience-hardening-incomplete",
    });
    process.exitCode = 1;
  }
}
