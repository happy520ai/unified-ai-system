import fs from "fs/promises";
import path from "path";

/**
 * Knowledge Enrichment Helpers
 *
 * Pure helper functions extracted from KnowledgeEnrichmentPipeline.
 * These implement the individual pipeline steps: summarisation,
 * auto-tagging, cross-reference discovery, knowledge-graph building,
 * and daily-digest generation.
 */

const ENRICHMENT_DIR = path.join(process.cwd(), ".data", "knowledge", "enrichment");
const GRAPH_FILE = path.join(ENRICHMENT_DIR, "knowledge-graph.json");
const DIGEST_DIR = path.join(ENRICHMENT_DIR, "digests");

/** Common tag vocabulary for auto-tagging. */
export const TAG_PATTERNS = [
  { tag: "ai", patterns: [/人工智能/i, /artificial intelligence/i, /机器学习/i, /machine learning/i, /neural/i, /神经网络/i] },
  { tag: "api", patterns: [/api/i, /endpoint/i, /rest/i, /graphql/i, /接口/i] },
  { tag: "architecture", patterns: [/架构/i, /architecture/i, /microservice/i, /微服务/i, /设计模式/i] },
  { tag: "security", patterns: [/安全/i, /security/i, /auth/i, /认证/i, /encryption/i, /加密/i] },
  { tag: "database", patterns: [/数据库/i, /database/i, /sql/i, /nosql/i, /postgres/i, /mongodb/i] },
  { tag: "deployment", patterns: [/部署/i, /deploy/i, /docker/i, /kubernetes/i, /ci\/cd/i, /运维/i] },
  { tag: "performance", patterns: [/性能/i, /performance/i, /optimization/i, /优化/i, /latency/i, /延迟/i] },
  { tag: "gateway", patterns: [/网关/i, /gateway/i, /routing/i, /路由/i, /proxy/i, /代理/i] },
  { tag: "knowledge", patterns: [/知识库/i, /knowledge/i, /rag/i, /retrieval/i, /检索/i] },
  { tag: "cost", patterns: [/成本/i, /cost/i, /billing/i, /计费/i, /token/i, /费用/i] },
  { tag: "testing", patterns: [/测试/i, /test/i, /benchmark/i, /基准/i, /qa/i] },
  { tag: "monitoring", patterns: [/监控/i, /monitor/i, /observability/i, /可观测/i, /log/i, /日志/i] },
];

/**
 * Generate extractive summaries for documents.
 *
 * Uses a simple extractive approach: pick the top-scoring sentences
 * based on word frequency (TextRank-lite).
 *
 * @param {object[]} documents
 * @returns {Promise<object[]>}
 */
export async function generateSummaries(documents) {
  const results = [];

  for (const doc of documents) {
    const sentences = doc.text
      .split(/(?<=[.!?。！？\n])\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length === 0) {
      results.push({ docId: doc.docId, summary: "", sentenceCount: 0 });
      continue;
    }

    // Word frequency scoring
    const wordFreq = new Map();
    for (const sentence of sentences) {
      const words = sentence.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }

    // Score each sentence
    const scored = sentences.map((sentence, idx) => {
      const words = sentence.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
      const score = words.reduce((sum, w) => sum + (wordFreq.get(w) ?? 0), 0) / (words.length || 1);
      return { sentence, score, idx };
    });

    // Pick top 3 sentences, preserving original order
    const topCount = Math.min(3, scored.length);
    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topCount)
      .sort((a, b) => a.idx - b.idx);

    const summary = top.map((t) => t.sentence).join(" ");
    results.push({
      docId: doc.docId,
      summary,
      sentenceCount: sentences.length,
      selectedSentences: topCount,
    });
  }

  return results;
}

/**
 * Auto-tag documents based on content patterns.
 *
 * @param {object[]} documents
 * @returns {Promise<object[]>}
 */
export async function autoTag(documents) {
  const results = [];

  for (const doc of documents) {
    const tags = new Set();

    for (const { tag, patterns } of TAG_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(doc.text)) {
          tags.add(tag);
          break;
        }
      }
    }

    // Extract potential keyword tags from document name
    const nameParts = (doc.name ?? "")
      .replace(/[._-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .map((w) => w.toLowerCase())
      .slice(0, 5);

    for (const part of nameParts) {
      const matched = TAG_PATTERNS.find(({ patterns }) =>
        patterns.some((p) => p.test(part))
      );
      if (matched) tags.add(matched.tag);
    }

    results.push({
      docId: doc.docId,
      tags: Array.from(tags),
      tagCount: tags.size,
    });
  }

  return results;
}

/**
 * Find cross-references between documents using shared terms
 * and tag overlap.
 *
 * @param {object[]} documents
 * @returns {Promise<object[]>}
 */
export async function findCrossReferences(documents) {
  const refs = [];

  // Build term-document map
  const termDocs = new Map();
  for (const doc of documents) {
    const terms = doc.text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4);

    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      const list = termDocs.get(term) ?? [];
      list.push(doc.docId);
      termDocs.set(term, list);
    }
  }

  // Find shared terms between document pairs
  const pairScores = new Map();
  for (const [, docList] of termDocs) {
    if (docList.length < 2) continue;

    for (let i = 0; i < docList.length; i++) {
      for (let j = i + 1; j < docList.length; j++) {
        const pairKey = [docList[i], docList[j]].sort().join("|");
        pairScores.set(pairKey, (pairScores.get(pairKey) ?? 0) + 1);
      }
    }
  }

  // Convert to cross-reference records (only if shared terms > threshold)
  const threshold = 5;
  for (const [pairKey, score] of pairScores) {
    if (score < threshold) continue;

    const [docA, docB] = pairKey.split("|");
    refs.push({
      fromDocId: docA,
      toDocId: docB,
      sharedTerms: score,
      strength: score > 20 ? "strong" : score > 10 ? "moderate" : "weak",
    });
  }

  // Sort by strength
  refs.sort((a, b) => b.sharedTerms - a.sharedTerms);
  return refs;
}

/**
 * Build a knowledge graph from enriched documents.
 *
 * @param {object[]} enrichedDocs
 * @returns {Promise<object>}
 */
export async function buildKnowledgeGraph(enrichedDocs) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  for (const doc of enrichedDocs) {
    if (!nodeIds.has(doc.docId)) {
      nodes.push({
        id: doc.docId,
        label: doc.name ?? doc.docId,
        tags: doc.tags ?? [],
        type: "document",
      });
      nodeIds.add(doc.docId);
    }

    // Tag-based edges
    for (const tag of doc.tags ?? []) {
      const tagNodeId = `tag:${tag}`;
      if (!nodeIds.has(tagNodeId)) {
        nodes.push({ id: tagNodeId, label: tag, type: "tag" });
        nodeIds.add(tagNodeId);
      }

      edges.push({
        source: doc.docId,
        target: tagNodeId,
        type: "has_tag",
      });
    }

    // Cross-reference edges
    for (const ref of doc.crossRefs ?? []) {
      const targetId = ref.toDocId === doc.docId ? ref.fromDocId : ref.toDocId;
      edges.push({
        source: doc.docId,
        target: targetId,
        type: "cross_ref",
        weight: ref.sharedTerms,
        strength: ref.strength,
      });
    }
  }

  const graph = { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length };

  // Persist graph
  await fs.mkdir(ENRICHMENT_DIR, { recursive: true });
  await fs.writeFile(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf-8");

  return graph;
}

/**
 * Generate a daily digest summarising the enrichment run.
 *
 * @param {object} enrichmentResults
 * @returns {Promise<object>}
 */
export async function generateDailyDigest(enrichmentResults) {
  const digestId = `digest-${Date.now()}`;
  const dateStr = new Date().toISOString().slice(0, 10);

  // Aggregate tag frequency
  const tagFreq = new Map();
  for (const doc of enrichmentResults.enrichedDocs ?? []) {
    for (const tag of doc.tags ?? []) {
      tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const digest = {
    digestId,
    date: dateStr,
    runId: enrichmentResults.runId,
    documentsProcessed: enrichmentResults.enrichedDocs?.length ?? 0,
    topTags,
    crossReferences: enrichmentResults.crossRefs?.length ?? 0,
    graphNodes: enrichmentResults.graph?.nodeCount ?? 0,
    graphEdges: enrichmentResults.graph?.edgeCount ?? 0,
    summaries: (enrichmentResults.enrichedDocs ?? []).map((d) => ({
      docId: d.docId,
      name: d.name,
      summary: d.summary?.slice(0, 200) ?? "",
      tags: d.tags,
    })),
    generatedAt: new Date().toISOString(),
  };

  // Persist digest
  await fs.mkdir(DIGEST_DIR, { recursive: true });
  const digestFile = path.join(DIGEST_DIR, `${digestId}.json`);
  await fs.writeFile(digestFile, JSON.stringify(digest, null, 2), "utf-8");

  return digest;
}
