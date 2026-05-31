export function buildRunnerConfigPreview() {
  return {
    completed: true,
    runnerConfigPreviewOnly: true,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    configFilesWritten: [],
    previewConfig: {
      contextPack: ".codex-context/current-context-pack.md",
      relevantFiles: ".codex-context/relevant-files.json",
      promptPack: ".codex-context/codex-prompt-pack.md",
      dryRunOnly: true,
    },
  };
}
