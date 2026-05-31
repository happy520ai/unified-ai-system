import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readEvidence,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const systemContextDoc = "docs/AGENT_WORKFORCE_SYSTEM_CONTEXT_PACK.md";
const productDirectionDoc = "docs/AGENT_WORKFORCE_NEXT_PRODUCT_DIRECTION_OUTLINE.md";
const seedPromptDoc = "docs/AGENT_WORKFORCE_SEED_PROMPT_PACK.md";
const sampleHandoffPath = ".codex-handoff/outbox/sample-context-fed-codex-handoff.md";

const phaseDefinitions = {
  "phase-221a-system-context-pack": {
    script: "verify:phase221a-system-context-pack",
    entrypoint: "verifyAgentWorkforceSystemContextPack.js",
    conclusion: "system-context-pack-complete",
    docs: [systemContextDoc],
    checks: ({ docs }) => {
      const doc = docs[systemContextDoc] || "";
      const capabilities = [
        "/ui",
        "Setup readiness",
        "NVIDIA `/chat` main lane",
        "Knowledge/RAG preview",
        "Agent Workforce Preview",
        "Product templates",
        "Saved plans and history",
        "JSON and Markdown export",
        "Codex Desktop Handoff Pack",
        "Manual / controlled Codex bridge",
        "Real browser UI trial passed",
      ];
      const boundaries = [
        "no real Agent execution",
        "no automatic Codex execution by default",
        "no worktree creation",
        "no workflow run hookup",
        "no external runner dispatch",
        "no default NVIDIA `/chat` lane change",
        "no legacy changes",
        "no `PROJECT_CONTEXT.md`",
      ];
      const commands = [
        "cmd /c pnpm run health:phase12a",
        "cmd /c pnpm run doctor:phase13a",
        "cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync",
        "cmd /c pnpm run verify:phase105a-user-journey",
        "cmd /c pnpm run verify:phase107a-secret-safety",
        "cmd /c pnpm -r --if-present check",
      ];
      return {
        docPresent: existsSync(resolve(repoRoot, systemContextDoc)),
        oneLineSummaryPresent:
          doc.includes("local AI Gateway + Agent Workforce Preview") &&
          doc.includes("NVIDIA `/chat` main lane") &&
          doc.includes("Codex result feedback bridge"),
        capabilitiesCovered: capabilities.every((item) => doc.includes(item)),
        workforceStateCovered:
          doc.includes("Phase 142A-199A completed") &&
          doc.includes("Preview product baseline sealed") &&
          doc.includes("UX polish closure sealed") &&
          doc.includes("Manual trial baseline sealed") &&
          doc.includes("Real browser UI trial passed"),
        boundariesCovered: boundaries.every((item) => doc.includes(item)),
        verificationCommandsCovered: commands.every((item) => doc.includes(item)),
        productionExecutionNotClaimed: doc.includes("preview baseline is not a production execution release"),
      };
    },
  },
  "phase-222a-next-product-direction-outline": {
    script: "verify:phase222a-next-product-direction-outline",
    entrypoint: "verifyAgentWorkforceNextProductDirectionOutline.js",
    conclusion: "next-product-direction-outline-complete",
    docs: [productDirectionDoc],
    checks: ({ docs }) => {
      const doc = docs[productDirectionDoc] || "";
      const priorities = [
        "Codex Handoff Automation",
        "Codex Result Inbox / Feedback Outbox",
        "Controlled Codex Loop",
        "UI Operation Experience",
        "Safety And Boundary",
      ];
      const deferred = [
        "No public internet production deployment",
        "No real unattended Agent execution",
        "No automatic commit / push",
        "No workflow run hookup",
        "No default worktree creation",
        "No legacy rewrite",
        "No default NVIDIA `/chat` main lane change",
      ];
      return {
        docPresent: existsSync(resolve(repoRoot, productDirectionDoc)),
        productGoalPresent:
          doc.includes("local AI workbench") &&
          doc.includes("Agent Workforce breaks the goal") &&
          doc.includes("system generates a Codex handoff") &&
          doc.includes("system reads Codex results") &&
          doc.includes("controlled human-AI development loop"),
        prioritiesCovered: priorities.every((item) => doc.includes(item)),
        deferredDirectionsCovered: deferred.every((item) => doc.includes(item)),
        recommendedNextStepPresent:
          doc.includes("Phase 209A-214A: Codex Result Inbox / Feedback Outbox Bridge") &&
          doc.includes("manual file") &&
          doc.includes("controlled `codex exec` dry-run"),
      };
    },
  },
  "phase-223a-agent-workforce-seed-prompt-pack": {
    script: "verify:phase223a-agent-workforce-seed-prompt-pack",
    entrypoint: "verifyAgentWorkforceSeedPromptPack.js",
    conclusion: "agent-workforce-seed-prompt-pack-complete",
    docs: [seedPromptDoc],
    checks: ({ docs }) => {
      const doc = docs[seedPromptDoc] || "";
      const promptNames = [
        "Prompt 1: Generate Normal Development Task Package",
        "Prompt 2: Generate Codex Fix Task Package",
        "Prompt 3: Generate Codex Result Review Task",
      ];
      const commonMarkers = [
        "Current System Context Summary",
        "Allowed Modification Scope",
        "Forbidden Actions",
        "Recommended Verification Commands",
        "Evidence Requirements",
        "Codex Response Format",
        "no legacy changes",
        "no PROJECT_CONTEXT.md",
        "no default NVIDIA /chat lane change",
        "no auto commit/push",
      ];
      return {
        docPresent: existsSync(resolve(repoRoot, seedPromptDoc)),
        threePromptsPresent: promptNames.every((item) => doc.includes(item)),
        requiredSectionsPresent: commonMarkers.every((item) => doc.includes(item)),
        developmentPromptPresent: doc.includes("# Agent Workforce Development Task Seed") && doc.includes("<USER_GOAL>"),
        fixPromptPresent: doc.includes("# Agent Workforce Fix Task Seed") && doc.includes("<PASTE_FAILURE_OR_BUG_SUMMARY>"),
        reviewPromptPresent: doc.includes("# Agent Workforce Codex Result Review Seed") && doc.includes("latest-codex-result.md"),
      };
    },
  },
  "phase-224a-first-context-fed-handoff-trial": {
    script: "verify:phase224a-first-context-fed-handoff-trial",
    entrypoint: "verifyAgentWorkforceFirstContextFedHandoffTrial.js",
    conclusion: "first-context-fed-handoff-trial-complete",
    docs: [systemContextDoc, productDirectionDoc, seedPromptDoc],
    prepare: generateSampleHandoff,
    checks: async ({ docs }) => {
      const handoff = await readRequired(sampleHandoffPath);
      return {
        handoffFilePresent: existsSync(resolve(repoRoot, sampleHandoffPath)),
        readSystemContext: (docs[systemContextDoc] || "").includes("One-line System Summary"),
        readProductDirection: (docs[productDirectionDoc] || "").includes("Product Goal"),
        readSeedPromptPack: (docs[seedPromptDoc] || "").includes("Prompt 1"),
        targetPresent: handoff.includes("Codex Result Inbox / Feedback Outbox Bridge"),
        currentSystemStatusPresent:
          handoff.includes("Current System Status") &&
          handoff.includes("local AI Gateway + Agent Workforce Preview") &&
          handoff.includes("real browser UI trial passed"),
        nextStageGoalPresent:
          handoff.includes("Next Stage Goal") &&
          handoff.includes("local AI workbench") &&
          handoff.includes("controlled human-AI development loop"),
        modificationBoundaryPresent: handoff.includes("Modification Boundary") && handoff.includes("tools/agent-workforce"),
        forbiddenActionsPresent:
          handoff.includes("Do not modify legacy/") &&
          handoff.includes("Do not create PROJECT_CONTEXT.md") &&
          handoff.includes("Do not change the default NVIDIA /chat lane") &&
          handoff.includes("Do not automatically commit or push"),
        verificationCommandsPresent:
          handoff.includes("cmd /c pnpm run verify:phase107a-secret-safety") &&
          handoff.includes("cmd /c pnpm -r --if-present check"),
        evidenceRequirementsPresent: handoff.includes("Evidence Requirements") && handoff.includes("evidence paths"),
        codexResponseFormatPresent: handoff.includes("Codex Response Format") && handoff.includes("Boundary Check"),
        noRuntimeExecutionEnabled: handoff.includes("This sample handoff does not call Codex CLI"),
      };
    },
  },
};

export async function runContextPackCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown context pack phase: ${phase}`);
  }

  try {
    const texts = await readWorkspaceTexts();
    const phase220 = await readEvidence("phase-220a-codex-continuous-loop-closure");
    const docs = {};
    for (const docPath of definition.docs || []) {
      docs[docPath] = await readRequired(docPath);
    }
    if (definition.prepare) {
      await definition.prepare({ docs });
    }

    const allText = [
      texts.rootPackageText,
      texts.servicePackageText,
      ...Object.values(docs),
      existsSync(resolve(repoRoot, sampleHandoffPath)) ? await readFile(resolve(repoRoot, sampleHandoffPath), "utf8") : "",
    ].join("\n\n");
    const secretFindingCount = countSecretFindings(allText, phase);
    const specificChecks = await definition.checks({ texts, docs });
    const checks = {
      phase220Passed: phase220.status === "passed",
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      noOhMyCodexDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      projectContextNotCreated: noProjectContext(),
      noPlainSecrets: secretFindingCount === 0,
      ...specificChecks,
    };
    const passed = Object.values(checks).every(Boolean);
    await writeEvidence(phase, {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      checks,
      verifiedDocuments: definition.docs || [],
      generatedFiles: phase === "phase-224a-first-context-fed-handoff-trial" ? [sampleHandoffPath] : [],
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliInvoked: false,
        codexExecInvoked: false,
        autoCommit: false,
        autoPush: false,
      },
      secretFindingCount,
      conclusion: passed ? definition.conclusion : definition.conclusion.replace(/complete$/, "incomplete"),
      notes: [
        "Phase 221A-224A only adds system context, product direction, seed prompts, and a context-fed sample handoff.",
        "No real Agent execution, Codex CLI call, worktree, workflow run, auto commit/push, or default NVIDIA /chat change.",
      ],
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeEvidence(phase, {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliInvoked: false,
        codexExecInvoked: false,
        autoCommit: false,
        autoPush: false,
      },
      conclusion: definition.conclusion.replace(/complete$/, "incomplete"),
    });
    process.exitCode = 1;
  }
}

async function generateSampleHandoff({ docs }) {
  const outputPath = resolve(repoRoot, sampleHandoffPath);
  await mkdir(resolve(repoRoot, ".codex-handoff/outbox"), { recursive: true });
  const contextExcerpt = extractSection(docs[systemContextDoc], "One-line System Summary");
  const directionExcerpt = extractSection(docs[productDirectionDoc], "A. Product Goal");
  const seedExcerpt = extractSection(docs[seedPromptDoc], "Prompt 1: Generate Normal Development Task Package");
  const handoff = `# Context-fed Codex Handoff Sample

## Task Goal
Implement the first stage of a Codex Result Inbox / Feedback Outbox Bridge. Keep
it as a local file bridge only: do not automatically call Codex, do not
automatically commit or push, and do not enable unattended execution.

## Current System Status
${contextExcerpt}

Current state: local AI Gateway + Agent Workforce Preview, preview product baseline, UX polish closure, manual trial baseline, real browser UI trial passed, Codex Desktop Handoff Pack available, manual/controlled Codex bridge available, and controlled loop dry-run available.

## Next Stage Goal
${directionExcerpt}

Next direction: continue toward a local AI workbench and controlled human-AI development loop while preserving all safety boundaries.

## Seed Prompt Source
${seedExcerpt}

## Modification Boundary
- Prefer docs/, tools/agent-workforce/, apps/ai-gateway-service/evidence/, and
  focused verify entrypoints.
- Keep implementation small, local, reversible, and preview/manual by default.

## Forbidden Actions
- Do not modify legacy/
- Do not create PROJECT_CONTEXT.md
- Do not enable real Agent execution
- Do not call Codex CLI by default
- Do not call oh-my-codex / OMX
- Do not create a worktree
- Do not connect workflow run
- Do not dispatch an external runner
- Do not change the default NVIDIA /chat lane
- Do not automatically commit or push
- Do not write plaintext API keys

## Verification Commands
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm -r --if-present check

## Evidence Requirements
- List changed files.
- Record commands run.
- Record verification results and evidence paths.
- Confirm no legacy change, no PROJECT_CONTEXT.md, no Codex CLI by default, no
  worktree, no workflow run, no auto commit/push, no default NVIDIA /chat lane
  change, and no plaintext API key exposure.

## Codex Response Format
A. Summary
B. Changed Files
C. Commands Run
D. Verification Result
E. Evidence Paths
F. Boundary Check
G. Known Issues
H. Next Step

## Trial Boundary
This sample handoff does not call Codex CLI, does not execute code through
Agent Workforce, does not create a worktree, does not connect workflow run, and
does not commit or push.
`;
  await writeFile(outputPath, handoff, "utf8");
}

function extractSection(text, heading) {
  if (!text) {
    return "- source section unavailable";
  }
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`, "m");
  const match = text.match(pattern);
  if (!match) {
    return "- source section unavailable";
  }
  return match[1].trim().split(/\r?\n/).slice(0, 12).join("\n");
}
