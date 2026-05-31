export function buildNeuralRelevancePreview(input = {}) {
  const files = scoreItems(input.files || [
    "packages/neural-fabric-runtime/src/index.js",
    "packages/neural-fabric-runtime/specs/neural-op.schema.json",
    "docs/phase1308a-codex-context-gateway-neural-relevance-preview.md",
  ]);
  const evidence = scoreItems(input.evidence || [
    "apps/ai-gateway-service/evidence/phase1304a/safety-boundary-result.json",
    "apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json",
  ]);
  const phases = scoreItems(input.phases || ["Phase1304A", "Phase1308A", "Phase1314A"]);

  return Object.freeze({
    phase: "Phase1308A",
    phaseKey: "phase1308a",
    name: "Codex Context Gateway Neural Relevance Preview",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    readOnly: true,
    dryRunScoring: true,
    files,
    evidence,
    phases,
    codexCalled: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    codexBaseUrlModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      realTrainingEnabled: false,
      mainChainIntegrated: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      workspaceCleanClaimed: false,
    },
  });
}

function scoreItems(items) {
  return items.map((item, index) => Object.freeze({
    item,
    score: Number((1 - index * 0.17).toFixed(2)),
    reason: "dry-run lexical relevance preview",
  }));
}
