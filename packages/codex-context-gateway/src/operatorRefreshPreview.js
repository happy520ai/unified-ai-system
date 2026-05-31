import { readOperatorPanelPreview } from "./operatorPanelPreview.js";

export function buildOperatorRefreshPreview(options = {}) {
  const before = readOperatorPanelPreview(options);
  const after = readOperatorPanelPreview(options);
  return {
    completed: true,
    refreshPreviewWorks: after.completed === true,
    contextHashRechecked: Boolean(before.contextPack.contextHash && after.contextPack.contextHash),
    previousHash: before.contextPack.contextHash,
    currentHash: after.contextPack.contextHash,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    providerCallsMade: false,
    realPhaseExecuted: false,
    autoCommitExecuted: false,
  };
}
