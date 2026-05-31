import { buildRunnerConfigPreview } from "./runnerConfigPreview.js";

export function buildRunnerIntegrationPreview(options = {}) {
  const configPreview = options.configPreview || buildRunnerConfigPreview();
  return {
    completed: configPreview.runnerConfigPreviewOnly === true,
    runnerIntegrationPreviewDefined: true,
    runnerConfigPreviewOnly: configPreview.runnerConfigPreviewOnly === true,
    contract: {
      preflight: "read .codex-context files and block when missing",
      freshness: "stop when stale=true",
      scope: "read relevant-files.json before broad exploration",
      prompt: "load codex-prompt-pack.md as task preamble",
      validation: "run planned verifier commands after dry-run task",
    },
    configPreview,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    providerCallsMade: false,
  };
}
