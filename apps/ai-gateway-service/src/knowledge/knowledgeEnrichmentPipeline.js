import fs from "fs/promises";
import path from "path";
import {
  generateSummaries,
  autoTag,
  findCrossReferences,
  buildKnowledgeGraph,
  generateDailyDigest,
} from "./knowledgeEnrichmentHelpers.js";

/**
 * Knowledge Enrichment Pipeline
 *
 * Automatically enriches the knowledge base using local text analysis
 * (compatible with free-tier AI models when available).
 *
 * Runs daily to summarise, tag, and cross-reference documents.
 * Persists enrichment artefacts under `.data/knowledge/enrichment/`.
 *
 * Pipeline step implementations live in knowledgeEnrichmentHelpers.js.
 */

const ENRICHMENT_DIR = path.join(process.cwd(), ".data", "knowledge", "enrichment");
const KNOWLEDGE_INDEX = path.join(process.cwd(), ".data", "knowledge", "index.json");
const ENRICHMENT_LOG = path.join(ENRICHMENT_DIR, "enrichment-log.json");

export class KnowledgeEnrichmentPipeline {
  constructor() {
    /** @type {object[]} Enrichment run log entries */
    this.enrichmentLog = [];

    /** @type {object[]} Scheduled topic definitions */
    this.scheduledTopics = [];

    /** @type {string|null} ISO timestamp of last successful run */
    this.lastRun = null;

    /** @type {object} Cumulative statistics */
    this.stats = {
      documentsEnriched: 0,
      tagsGenerated: 0,
      summariesCreated: 0,
      crossRefsFound: 0,
    };

    /** @type {Map<string, object>} docId -> enrichment record */
    this._enrichments = new Map();

    /** @type {string|null} Cron expression for scheduled runs */
    this._schedule = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Initialise: restore persisted enrichment state.
   */
  async init() {
    await fs.mkdir(ENRICHMENT_DIR, { recursive: true });

    try {
      const raw = await fs.readFile(ENRICHMENT_LOG, "utf-8");
      const data = JSON.parse(raw);

      this.enrichmentLog = Array.isArray(data.log) ? data.log : [];
      this.lastRun = data.lastRun ?? null;
      this.stats = { ...this.stats, ...(data.stats ?? {}) };
      this._schedule = data.schedule ?? null;

      // Restore enrichment records
      for (const rec of data.enrichments ?? []) {
        this._enrichments.set(rec.docId, rec);
      }
    } catch {
      // first run
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Full Pipeline                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Run the complete enrichment pipeline.
   *
   * Steps:
   *   1. Scan for un-enriched documents
   *   2. Generate summaries
   *   3. Auto-tag documents
   *   4. Find cross-references
   *   5. Build knowledge graph
   *   6. Generate daily digest
   *
   * @param {object} [options]
   * @param {boolean} [options.forceReEnrich=false]  Re-process already enriched docs
   * @returns {Promise<object>}  Pipeline run result
   */
  async runEnrichment(options = {}) {
    const runId = `enrich-${Date.now()}`;
    const startTime = Date.now();
    const runResult = {
      runId,
      startedAt: new Date().toISOString(),
      steps: {},
    };

    try {
      // Step 1: Scan
      const unenriched = await this.scanUnenriched(options.forceReEnrich);
      runResult.steps.scan = { count: unenriched.length, docIds: unenriched.map((d) => d.docId) };

      if (unenriched.length === 0) {
        runResult.status = "no_documents";
        runResult.completedAt = new Date().toISOString();
        runResult.durationMs = Date.now() - startTime;
        this.enrichmentLog.push(runResult);
        await this._persistLog();
        return runResult;
      }

      // Step 2: Summaries
      const summaries = await generateSummaries(unenriched);
      runResult.steps.summaries = { generated: summaries.length };
      this.stats.summariesCreated += summaries.length;

      // Step 3: Auto-tag
      const tags = await autoTag(unenriched);
      runResult.steps.tags = { generated: tags.length, totalTags: this.stats.tagsGenerated };
      this.stats.tagsGenerated += tags.reduce((s, t) => s + t.tags.length, 0);

      // Step 4: Cross-references
      const crossRefs = await findCrossReferences(unenriched);
      runResult.steps.crossRefs = { found: crossRefs.length };
      this.stats.crossRefsFound += crossRefs.length;

      // Step 5: Knowledge graph
      const enrichedDocs = unenriched.map((doc) => {
        const summary = summaries.find((s) => s.docId === doc.docId);
        const tagSet = tags.find((t) => t.docId === doc.docId);
        const refs = crossRefs.filter((r) => r.fromDocId === doc.docId || r.toDocId === doc.docId);

        return {
          ...doc,
          summary: summary?.summary ?? "",
          tags: tagSet?.tags ?? [],
          crossRefs: refs,
        };
      });

      const graph = await buildKnowledgeGraph(enrichedDocs);
      runResult.steps.graph = { nodes: graph.nodes, edges: graph.edges };

      // Step 6: Daily digest
      const digest = await generateDailyDigest({
        runId,
        enrichedDocs,
        crossRefs,
        graph,
      });
      runResult.steps.digest = { generated: true, digestId: digest.digestId };

      // Update enrichment records
      for (const doc of enrichedDocs) {
        this._enrichments.set(doc.docId, {
          docId: doc.docId,
          summary: doc.summary,
          tags: doc.tags,
          crossRefs: doc.crossRefs,
          enrichedAt: new Date().toISOString(),
        });
      }

      this.stats.documentsEnriched += enrichedDocs.length;
      this.lastRun = new Date().toISOString();

      runResult.status = "completed";
      runResult.completedAt = new Date().toISOString();
      runResult.durationMs = Date.now() - startTime;
      runResult.documentsProcessed = enrichedDocs.length;

      this.enrichmentLog.push(runResult);
      await this._persistLog();

      return runResult;
    } catch (err) {
      runResult.status = "error";
      runResult.error = err.message;
      runResult.completedAt = new Date().toISOString();
      runResult.durationMs = Date.now() - startTime;

      this.enrichmentLog.push(runResult);
      await this._persistLog();

      return runResult;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Pipeline Steps                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Step 1: Scan for documents that have not been enriched.
   *
   * @param {boolean} [forceReEnrich=false]
   * @returns {Promise<object[]>}
   */
  async scanUnenriched(forceReEnrich = false) {
    // Load the knowledge index to discover documents
    let indexEntries = [];
    try {
      const raw = await fs.readFile(KNOWLEDGE_INDEX, "utf-8");
      const data = JSON.parse(raw);
      indexEntries = Array.isArray(data.index) ? data.index : [];
    } catch {
      return [];
    }

    const results = [];

    for (const entry of indexEntries) {
      if (!forceReEnrich && this._enrichments.has(entry.docId)) {
        continue; // already enriched
      }

      // Try to load chunk text for this document
      const chunks = [];
      for (const chunkId of entry.chunkIds ?? []) {
        try {
          const chunkPath = path.join(process.cwd(), ".data", "knowledge", "chunks", `${chunkId}.json`);
          const raw = await fs.readFile(chunkPath, "utf-8");
          const chunk = JSON.parse(raw);
          chunks.push(chunk);
        } catch {
          // skip missing chunks
        }
      }

      if (chunks.length === 0) continue;

      const fullText = chunks.map((c) => c.text).join("\n");
      results.push({
        docId: entry.docId,
        name: entry.name,
        extension: entry.extension,
        chunkCount: chunks.length,
        text: fullText,
        createdAt: entry.createdAt,
      });
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Scheduling                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Schedule enrichment with a cron expression.
   *
   * @param {string} cronExpr  e.g. "0 3 * * *" for daily at 3 AM
   * @returns {object}
   */
  scheduleEnrichment(cronExpr) {
    if (!cronExpr || typeof cronExpr !== "string") {
      throw new Error("A valid cron expression is required.");
    }

    this._schedule = cronExpr;
    return {
      scheduled: true,
      cronExpression: cronExpr,
      nextExpected: "Managed by the QoderWork cron scheduler.",
      note: "Use qoder_cron to register this schedule in the runtime.",
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Status & History                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Get enrichment pipeline status.
   * @returns {object}
   */
  getStatus() {
    return {
      running: false,
      lastRun: this.lastRun,
      schedule: this._schedule,
      stats: { ...this.stats },
      enrichedDocuments: this._enrichments.size,
      totalLogEntries: this.enrichmentLog.length,
    };
  }

  /**
   * Get enrichment run history.
   * @param {number} [limit=10]
   * @returns {object[]}
   */
  getHistory(limit = 10) {
    return this.enrichmentLog
      .slice(-limit)
      .reverse()
      .map((entry) => ({
        runId: entry.runId,
        status: entry.status,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        durationMs: entry.durationMs,
        documentsProcessed: entry.documentsProcessed ?? 0,
        error: entry.error ?? null,
      }));
  }

  /* ------------------------------------------------------------------ */
  /*  Persistence                                                        */
  /* ------------------------------------------------------------------ */

  /** @private */
  async _persistLog() {
    const data = {
      version: "1.0.0",
      lastRun: this.lastRun,
      stats: this.stats,
      schedule: this._schedule,
      log: this.enrichmentLog.slice(-100),
      enrichments: Array.from(this._enrichments.values()),
    };

    await fs.mkdir(ENRICHMENT_DIR, { recursive: true });
    await fs.writeFile(ENRICHMENT_LOG, JSON.stringify(data, null, 2), "utf-8");
  }
}
