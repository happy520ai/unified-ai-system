export const productDeepOptimizationRoadmapPanel = {
  phase: "286A",
  marker: "phase286a-product-deep-optimization-roadmap",
  analysisDirections: [
    "coreWorkflow",
    "productConsole",
    "knowledgeSystem",
    "providerCostGovernance",
    "deploymentOperations",
    "regressionQuality",
  ],
  recommendedNextPhases: [
    "Phase287A Core / Architecture Refactor",
    "Phase288A Architecture Debt Cleanup",
    "Phase289A Deployment Runtime Stability",
    "Phase290A Provider Cost Governance",
    "Phase291A Unified Regression Matrix",
    "Phase292A Product Operation Manual",
  ],
};

export function createProductDeepOptimizationRoadmapFallback() {
  return {
    status: "not-run",
    phase: productDeepOptimizationRoadmapPanel.phase,
    analysisDirections: productDeepOptimizationRoadmapPanel.analysisDirections,
    recommendedNextPhases: productDeepOptimizationRoadmapPanel.recommendedNextPhases,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    productionReadyClaimed: false,
    salesMaterialCreated: false,
    roadmapPanelAdded: true,
  };
}

export function renderProductDeepOptimizationRoadmapPanel(summary, escapeHtml) {
  const analysisItems = (summary.analysisDirections || productDeepOptimizationRoadmapPanel.analysisDirections)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const nextPhaseItems = (summary.recommendedNextPhases || productDeepOptimizationRoadmapPanel.recommendedNextPhases)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
      <section id="product-deep-optimization-roadmap" class="operator-quick-entry product-console-entry" data-phase="${productDeepOptimizationRoadmapPanel.marker}" data-console="product-deep-optimization-roadmap" aria-label="Product deep optimization roadmap">
        <div class="operator-quick-head">
          <span class="operator-eyebrow">产品深度优化 / Product Optimization</span>
          <h2>Phase 286A Product Deep Optimization Roadmap</h2>
          <p>继续打磨产品主流程、控制台、知识系统、成本治理、运行稳定性和回归质量；这不是销售材料，也不是 production-ready 声明。</p>
        </div>
        <div class="product-console-grid">
          <article class="product-console-card" data-marker="Phase 286A roadmap analysis panel">
            <strong>分析方向</strong>
            <ul>${analysisItems}</ul>
          </article>
          <article class="product-console-card" data-marker="Phase 286A next phase panel">
            <strong>推荐后续阶段</strong>
            <ol>${nextPhaseItems}</ol>
          </article>
          <article class="product-console-card" data-marker="Phase 286A safety boundary panel">
            <strong>边界</strong>
            <ul>
              <li>Paid API called: <code>${escapeHtml(summary.paidApiCallCount ?? 0)}</code></li>
              <li>External provider called: <code>${escapeHtml(summary.externalApiCalled === true)}</code></li>
              <li>MiMo called: <code>${escapeHtml(summary.mimoApiCalled === true)}</code></li>
              <li>Embedding called: <code>${escapeHtml(summary.embeddingCalled === true)}</code></li>
              <li>Production-ready claimed: <code>${escapeHtml(summary.productionReadyClaimed === true)}</code></li>
            </ul>
          </article>
          <article class="product-console-card" data-marker="Phase 286A no sales material panel">
            <strong>不可承诺</strong>
            <p>本阶段只给产品继续优化路线，不生成销售承诺，不代表真实部署、真实 release 或真实 provider 调用。</p>
          </article>
        </div>
      </section>`;
}
