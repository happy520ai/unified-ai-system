// Extracted verbatim from cli-core.js so the enhance/demo/serve command
// cluster lives beside the other command modules. Pure mechanical move;
// behaviour unchanged.
import { spawn } from "node:child_process";
import { readVerificationSource, readWindowsVerificationHistory } from "./verificationHistory.ts";
import { resolvePrompt, runChildProcess } from "./cliRuntime.js";
import { repoRoot, demoEntrypoint, serviceEntrypoint, usageReportUrl } from "./cliPaths.js";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { unwrapEnvelope } from "./cli-shared-helpers.js";

export function runVerificationHistory(options, runtime, output) {
  const root = runtime.verificationRepoRoot ?? repoRoot;
  const source = readVerificationSource(root);
  const result = readWindowsVerificationHistory(root, { source, now: Date.now(),
    platform: process.platform, arch: process.arch, nodeVersion: process.version });
  const sourceAfter = readVerificationSource(root);
  if (source.head !== sourceAfter.head || source.worktree !== sourceAfter.worktree) {
    result.ok = false; result.status = "source_changed_during_read";
  }
  if (options.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    output.write(`Local Windows verification: ${result.status}\nLocal checkout: ${source.head ?? "unknown"} (${source.worktree})\n`);
    output.write("Local unsigned summaries; running deployment and release approval are not verified.\n");
    for (const run of result.runs) {
      output.write(`${run.runId}  ${run.status}  ${run.assessment}\n`);
      for (const stage of run.stages ?? []) {
        const count = stage.counts;
        output.write(`  ${stage.id}: ${stage.status}${count ? ` (${count.passed} passed, ${count.failed} failed, ${count.skipped} skipped)` : ""}\n`);
      }
    }
    output.write(`${result.nextAction}\n`);
  }
  return result.ok ? 0 : 2;
}

export async function runEnhance(options, output, stdin) {
  const prompt = await resolvePrompt(options, stdin, { required: true });
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: options.timeoutMs,
    headers: process.env.PME_AUTH_TOKEN
      ? { authorization: `Bearer ${process.env.PME_AUTH_TOKEN}` }
      : {},
  });
  const response = await client.enhancePrompt({
    input: prompt,
    profile: options.profile,
    language: options.language,
  });
  const enhancement = unwrapEnvelope(response);
  if (typeof enhancement.enhancedPrompt !== "string") {
    throw new Error("The gateway did not return an enhanced prompt.");
  }

  const result = {
    ok: true,
    gatewayUrl: options.url,
    original: enhancement.original,
    enhancedPrompt: enhancement.enhancedPrompt,
    profile: enhancement.profile,
    language: enhancement.language,
    detectedSignals: enhancement.signals ?? {},
    compiledSections: summarizeCompiledSections(enhancement.sections),
    clarifyingQuestions: enhancement.clarifyingQuestions ?? [],
    metadata: enhancement.metadata ?? {},
  };

  if (options.evidence) {
    output.write(`${JSON.stringify(buildEnhancementEvidence(result), null, 2)}\n`);
  } else if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderEnhancement(result, output);
  }
  return 0;
}

function buildEnhancementEvidence(result) {
  const metadata = result.metadata ?? {};
  const providerFreeEvidence =
    metadata.providerCalled === false
    && metadata.credentialRequired === false
    && metadata.deterministic === true;

  if (!providerFreeEvidence) {
    throw new Error(
      "The gateway did not return complete provider-free enhancement evidence.",
    );
  }

  return {
    schema: "unified-ai-system/usage-report/v1",
    command: [
      "pnpm gateway enhance",
      JSON.stringify(result.original),
      "--profile",
      result.profile,
      "--language",
      result.language,
      // The report is only produced under --evidence, so the command that
      // reproduces this artifact has to carry the flag.
      "--evidence",
    ].join(" "),
    environment: `${process.platform}; Node ${process.version}`,
    mode: "prompt-enhancement",
    providerCalled: false,
    credentialRequired: false,
    deterministic: true,
    original: result.original,
    enhancedPrompt: result.enhancedPrompt,
    profile: result.profile,
    language: result.language,
    detectedSignals: result.detectedSignals,
    compiledSections: result.compiledSections,
    clarifyingQuestions: result.clarifyingQuestions,
    reportUrl: usageReportUrl,
    reviewBeforeSharing: true,
  };
}

function summarizeCompiledSections(sections) {
  return Array.isArray(sections)
    ? sections.map((section) => ({
        id: section.id,
        title: section.title,
        itemCount: Array.isArray(section.items) ? section.items.length : 0,
      }))
    : [];
}

export async function runDemo(options, runtime) {
  const args = [demoEntrypoint];
  if (options.json) args.push("--json");
  if (options.evidence) args.push("--evidence");

  const prompt = await resolvePrompt(options, runtime.stdin ?? process.stdin, {
    required: false,
  });
  const env = {
    ...(runtime.env ?? process.env),
    ...(prompt ? { AI_GATEWAY_DEMO_PROMPT: prompt } : {}),
  };

  return runChildProcess(
    runtime.spawnProcess ?? spawn,
    process.execPath,
    [
      ...args,
      ...(options.enhance ? ["--enhance"] : []),
      ...(options.profileProvided ? ["--profile", options.profile] : []),
      ...(options.languageProvided ? ["--language", options.language] : []),
    ],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
}

export async function runServe(options, runtime, output) {
  const env = {
    ...(runtime.env ?? process.env),
    ...(options.host ? { AI_GATEWAY_SERVICE_HOST: options.host } : {}),
    ...(options.port ? { AI_GATEWAY_SERVICE_PORT: String(options.port) } : {}),
  };

  output.write(
    [
      "",
      output.bold("Unified AI System"),
      output.muted("Starting the gateway. Press Ctrl+C to stop."),
      "",
    ].join("\n"),
  );

  return runChildProcess(
    runtime.spawnProcess ?? spawn,
    process.execPath,
    [serviceEntrypoint],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      windowsHide: true,
    },
    { forwardSignals: true },
  );
}

function renderEnhancement(result, output) {
  const clarifyingQuestions = Array.isArray(result.clarifyingQuestions)
    ? result.clarifyingQuestions
    : [];
  const metadata = result.metadata ?? {};
  const safetyProven =
    metadata.providerCalled === false
    && metadata.credentialRequired === false
    && metadata.deterministic === true;
  const safetyLabel = safetyProven
    ? output.green("[safe]")
    : output.yellow("[check]");
  const questionLines = clarifyingQuestions.length > 0
    ? [
        "",
        output.bold("Questions to refine (optional)"),
        ...clarifyingQuestions.map((question, index) => `  ${index + 1}. ${question}`),
      ]
    : [];
  const lines = [
    "",
    output.bold("Enhanced prompt"),
    output.muted(`${result.profile} | ${result.language} | local deterministic engine`),
    "",
    result.enhancedPrompt,
    ...questionLines,
    "",
    `  ${safetyLabel} provider call ${metadata.providerCalled === false ? "none" : "check JSON"} | credentials ${metadata.credentialRequired === false ? "not required" : "check JSON"} | deterministic ${metadata.deterministic === true ? "yes" : "check JSON"}`,
    metadata.originalPreserved === true
      ? output.muted("  Original request preserved. Use --evidence for a shareable report, or --json for raw output.")
      : output.muted("  Review the JSON metadata before sharing this result."),
    "",
  ];
  output.write(`${lines.join("\n")}\n`);
}
