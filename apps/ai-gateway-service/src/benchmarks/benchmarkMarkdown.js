export function renderSystemCapabilityBenchmarkMarkdown(evidence) {
  const dimensionRows = evidence.dimensions
    .map((item) => `| ${item.name} | ${item.score} | ${item.maxScore} | ${(item.limitations ?? [])[0] ?? ""} |`)
    .join("\n");
  const strengthList = evidence.strengths.map((item) => `- ${item}`).join("\n");
  const riskList = evidence.risks.map((item) => `- ${item}`).join("\n");
  const gapList = evidence.gaps.map((item) => `- ${item}`).join("\n");
  const routeList = evidence.recommendedNextRoutes
    .map((item) => `- ${item.priority}: ${item.route}. ${item.reason}`)
    .join("\n");

  return `# Phase 274A Unified System Capability Benchmark

## Benchmark Result

- Status: ${evidence.status}
- Mode: ${evidence.mode}
- Total score: ${evidence.scorecard.totalScore} / ${evidence.scorecard.maxScore}
- Grade: ${evidence.scorecard.grade}
- Production readiness: ${evidence.scorecard.productionReadiness}
- Commercial self-use readiness: ${evidence.scorecard.commercialSelfUseReadiness}
- Paid API safety readiness: ${evidence.scorecard.paidApiSafetyReadiness}
- Paid API calls made in this benchmark: ${evidence.paidApiCallCount}
- External API called: ${evidence.externalApiCalled}
- MiMo API called: ${evidence.mimoApiCalled}

## Headline Metrics

- 270A averageSavingsRatio: ${evidence.headlineMetrics.tokenSavingBenchmarkAverageSavingsRatio}
- 273A averageSavingsRatio: ${evidence.headlineMetrics.ragSourceSelectionAverageSavingsRatio}
- RAG required source recall: ${evidence.headlineMetrics.ragRequiredSourceRecall}
- Latest evidence hit rate: ${evidence.headlineMetrics.latestEvidenceHitRate}
- Stale source selected count: ${evidence.headlineMetrics.staleSourceSelectedCount}
- MiMo working model id: ${evidence.headlineMetrics.mimoWorkingModelId}
- MiMo usage returned: ${evidence.headlineMetrics.mimoUsageReturned}
- Token estimator confidence: ${evidence.headlineMetrics.tokenEstimatorConfidence}
- Cache persistence ready: ${evidence.headlineMetrics.cachePersistenceReady}
- Response cache hit rate: ${evidence.headlineMetrics.responseCacheHitRate ?? "n/a"}

## Dimension Scores

| Dimension | Score | Max | Main limitation |
| --- | ---: | ---: | --- |
${dimensionRows}

## Strengths

${strengthList}

## Risks

${riskList}

## Gaps

${gapList}

## Recommended Next Routes

${routeList}

## Safety

- plainTextApiKeyWritten=false
- apiKeyPrinted=false
- paidApiCallExecuted=false
- externalApiCalled=false
- mimoApiCalled=false
- defaultNvidiaChatLaneChanged=false
- mimoSetAsDefault=false
- longContextSentToPaidApi=false
- largeOutputRequested=false
- stressTestExecuted=false
- codexCliInvoked=false
- codexExecInvoked=false
- workflowRunnerEnabled=false
- worktreeCreated=false
- autoCommit=false
- autoPush=false
`;
}
