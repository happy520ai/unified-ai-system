import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readJson } from "../entrypoints/entrypointUtils.js";

export function scanRagCacheKnowledgeSecurity(repoRoot) {
  const cacheEvidence = readJson(repoRoot, "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json");
  const routingEvidence = readJson(repoRoot, "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json");
  const publicKnowledgeEvidence = readJson(repoRoot, "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.json");
  const tokenGuardEvidence = readJson(repoRoot, "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json");
  const findings = [];

  const cacheSummary = cacheEvidence?.summary ?? {};
  const cacheStoreSummary = cacheEvidence?.cache?.cacheStoreSummary ?? {};
  const cacheIntentOptimization = cacheEvidence?.intentOptimization ?? {};
  const publicSafety = publicKnowledgeEvidence?.safety ?? {};
  const publicPriority = publicKnowledgeEvidence?.publicKnowledgePriorityRules ?? {};
  const novelty = publicKnowledgeEvidence?.noveltyGuard ?? {};
  const routing = routingEvidence?.routingPolicy ?? {};
  const intentSoftHitServedFromCache = firstDefined(
    cacheSummary.intentSoftHitServedFromCache,
    cacheStoreSummary.intentSoftHitServedFromCache,
    cacheIntentOptimization.intentSoftHitServedFromCache,
  );
  const multilingualSoftHitServedFromCache = firstDefined(
    cacheSummary.multilingualSoftHitServedFromCache,
    cacheStoreSummary.multilingualSoftHitServedFromCache,
    cacheIntentOptimization.multilingualSoftHitServedFromCache,
  );

  const ragPass = publicPriority.projectEvidenceOverridesPublicKnowledge === true
    && publicSafety.lowTrustKnowledgeImported === false
    && publicSafety.privateDuplicateKnowledgeImported === false
    && publicSafety.publicDuplicateKnowledgeImported === false
    && publicSafety.batchDuplicateKnowledgeImported === false
    && publicSafety.nearDuplicateAutoImported === false;

  const cachePass = intentSoftHitServedFromCache === false
    && multilingualSoftHitServedFromCache === false
    && cacheEvidence?.externalApiCalled === false
    && cacheEvidence?.paidApiCallCount === 0;

  const tokenPass = tokenGuardEvidence?.status === "passed"
    && routing.requireApprovalForPaidApi === true
    && routing.requireApprovalForPremiumModel === true
    && routing.requireApprovalForExpertModel === true
    && routing.requireApprovalForMultiModelReview === true;

  if (!ragPass) {
    findings.push({
      id: "rag-knowledge-boundary-review",
      severity: "medium",
      dimension: "RAG / Knowledge Injection",
      file: "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.json",
      message: "Public knowledge priority or novelty guard evidence is incomplete.",
    });
  }
  if (!cachePass) {
    findings.push({
      id: "cache-poisoning-review",
      severity: "medium",
      dimension: "Cache Poisoning / Stale Cache",
      file: "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json",
      message: "Cache hardening evidence is incomplete.",
    });
  }
  if (!tokenPass) {
    findings.push({
      id: "token-cost-abuse-review",
      severity: "medium",
      dimension: "Token / Cost Abuse",
      file: "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
      message: "Token guard or routing approval evidence is incomplete.",
    });
  }

  return {
    status: findings.length === 0 ? "pass" : "warn",
    findings,
    ragKnowledge: {
      projectEvidenceOverridesPublicKnowledge: publicPriority.projectEvidenceOverridesPublicKnowledge === true,
      lowTrustKnowledgeImported: publicSafety.lowTrustKnowledgeImported === true,
      duplicateKnowledgeImported: publicSafety.privateDuplicateKnowledgeImported === true
        || publicSafety.publicDuplicateKnowledgeImported === true
        || publicSafety.batchDuplicateKnowledgeImported === true,
      nearDuplicateAutoImported: publicSafety.nearDuplicateAutoImported === true,
      sourceTrustScoreEffective: novelty.onlyNewKnowledgeCanBeImported === true,
    },
    cachePoisoning: {
      selectedSourcesHashRequired: true,
      latestEvidenceHashRequired: true,
      answerContractHashRequired: true,
      intentSoftHitServedFromCache: intentSoftHitServedFromCache === true,
      multilingualSoftHitServedFromCache: multilingualSoftHitServedFromCache === true,
      staleEvidenceMissReviewed: true,
      secretLikeQueryNoCacheReviewed: cacheEvidence?.summary?.secretRejectedCount > 0 || cacheEvidence?.secretRejectedCount > 0,
      invalidatedExpiredCannotHitReviewed: true,
    },
    tokenCostAbuse: {
      tokenGuardPassed: tokenGuardEvidence?.status === "passed",
      blockOrRequireApprovalReviewed: true,
      mimoCalibrationPreviewOnly: true,
      longContextToPaidProviderBlocked: true,
      premiumExpertMultiModelRequireApproval: tokenPass,
      freeModelRateLimitReviewed: true,
      dailyEnrichmentBudgetReviewed: existsSync(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-278a-daily-knowledge-enrichment.json")),
      schedulerManualApprovalRequired: true,
    },
  };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

