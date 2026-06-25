/**
 * @module codebase-search
 * @description Semantic code search engine that indexes a project and enables
 * intelligent file/content retrieval WITHOUT external embeddings. Uses TF-IDF-like
 * scoring with code-specific tokenization for identifier-aware search.
 *
 * Key capabilities:
 *   - Inverted index with TF-IDF scoring over code-specific tokens
 *   - Structural bonuses for file name, export, function, and import matches
 *   - Import/require dependency graph extraction
 *   - Smart file chunking by function/class boundaries
 *   - Incremental index refresh for modified files
 *
 * @example
 * ```js
 * import { CodebaseSearch } from './codebase-search/index.js';
 *
 * const search = new CodebaseSearch();
 * await search.buildIndex('/path/to/project');
 *
 * const results = search.search('user authentication login');
 * // [{ path, score, matchedTerms, highlights, relevance }]
 *
 * const related = search.getRelatedFiles('src/auth/login.js');
 * // [{ path, relation, strength }]
 * ```
 */

import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { MAX_FILE_BYTES } from './constants.js';
import { tokenizeFile, tokenizeQuery, walkFiles } from './tokenize.js';
import { extractSignature } from './signature.js';
import { buildHighlights, classifyRelevance, applyStructuralBonuses, findChunkBoundaries, splitBySize, mergeSmallChunks } from './scoring.js';
import { resolveImportPaths } from './resolve.js';
import { computeRelatedFiles } from './related.js';

// ── File record ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FileRecord
 * @property {string} path — relative file path
 * @property {string} absPath — absolute file path
 * @property {number} size — file size in bytes
 * @property {string} language — inferred language from extension
 * @property {number} modifiedAt — last modified timestamp (ms)
 * @property {Map<string, number>} tokenCounts — token -> count in this file
 * @property {number} totalTokens — total token count for this file
 * @property {string[]} importPaths — raw import source paths
 * @property {string[]} exports — exported symbol names
 * @property {string[]} classes — class declaration names
 * @property {string[]} functions — function declaration names
 * @property {string[]} types — type/interface declaration names
 * @property {string} content — raw file content (truncated to MAX_FILE_BYTES)
 */

// ── Standalone helpers (extracted from private methods) ──────────────────────

/**
 * Index a single file into the inverted index and file store.
 *
 * @param {string} relPath
 * @param {string} absPath
 * @param {string} content
 * @param {import('node:fs').Stats} fileStat
 * @param {Map<string, FileRecord>} files
 * @param {Map<string, Set<string>>} invertedIndex
 */
function indexFileInto(relPath, absPath, content, fileStat, files, invertedIndex) {
  const tokenCounts = tokenizeFile(content);

  let totalTokens = 0;
  for (const count of tokenCounts.values()) {
    totalTokens += count;
  }

  const sig = extractSignature(content, relPath);

  /** @type {FileRecord} */
  const record = {
    path: relPath,
    absPath,
    size: fileStat.size,
    language: relPath.match(/\.(.+)$/)?.[1] ?? '',
    modifiedAt: fileStat.mtimeMs || 0,
    tokenCounts,
    totalTokens,
    importPaths: sig.imports,
    exports: sig.exports,
    classes: sig.classes,
    functions: sig.functions,
    types: sig.types,
    content,
  };

  files.set(relPath, record);

  for (const token of tokenCounts.keys()) {
    if (!invertedIndex.has(token)) {
      invertedIndex.set(token, new Set());
    }
    invertedIndex.get(token).add(relPath);
  }
}

/**
 * Remove a file from all index structures (for refresh).
 * @param {string} relPath
 * @param {Map<string, FileRecord>} files
 * @param {Map<string, Set<string>>} invertedIndex
 */
function removeFileFromIndex(relPath, files, invertedIndex) {
  const oldRecord = files.get(relPath);
  if (!oldRecord) return;

  for (const token of oldRecord.tokenCounts.keys()) {
    const fileSet = invertedIndex.get(token);
    if (fileSet) {
      fileSet.delete(relPath);
      if (fileSet.size === 0) {
        invertedIndex.delete(token);
      }
    }
  }

  files.delete(relPath);
}

// ── Main class ───────────────────────────────────────────────────────────────

/**
 * Semantic code search engine using TF-IDF scoring with code-specific
 * tokenization. Indexes a project directory and provides intelligent
 * file/content retrieval without external embedding services.
 */
export class CodebaseSearch {
  /** @type {number} */ #maxResults;
  /** @type {number} */ #minScore;
  /** @type {Record<string, number>} */ #tokenWeights;
  /** @type {Map<string, FileRecord>} */ #files = new Map();
  /** @type {Map<string, Set<string>>} */ #invertedIndex = new Map();
  /** @type {number} */ #totalFiles = 0;
  /** @type {string|null} */ #projectRoot = null;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxResults=10]
   * @param {number} [opts.minScore=0.01]
   * @param {Record<string, number>} [opts.tokenWeights]
   */
  constructor(opts = {}) {
    this.#maxResults = opts.maxResults ?? 10;
    this.#minScore = opts.minScore ?? 0.01;
    this.#tokenWeights = opts.tokenWeights ?? {};
  }

  /**
   * Build an inverted index of the project at the given root directory.
   *
   * @param {string} projectRoot
   * @param {object} [opts]
   * @param {string[]} [opts.skipDirs]
   * @returns {Promise<{ fileCount: number, tokenCount: number, indexSize: number }>}
   */
  async buildIndex(projectRoot, opts = {}) {
    this.#projectRoot = projectRoot;
    this.#files.clear();
    this.#invertedIndex.clear();

    const fileList = await walkFiles(projectRoot, projectRoot, opts.skipDirs);

    for (const { absPath, relPath } of fileList) {
      try {
        const fileStat = await stat(absPath);
        if (fileStat.size > 2_000_000) continue;

        const raw = await readFile(absPath, { encoding: 'utf-8' });
        const content = raw.length > MAX_FILE_BYTES
          ? raw.slice(0, MAX_FILE_BYTES)
          : raw;

        indexFileInto(relPath, absPath, content, fileStat, this.#files, this.#invertedIndex);
      } catch {
        // Skip unreadable files silently
      }
    }

    this.#totalFiles = this.#files.size;

    let totalTokenEntries = 0;
    for (const record of this.#files.values()) {
      totalTokenEntries += record.totalTokens;
    }

    return {
      fileCount: this.#files.size,
      tokenCount: this.#invertedIndex.size,
      indexSize: totalTokenEntries,
    };
  }

  /**
   * Search for relevant files/code given a natural language query.
   *
   * @param {string} query
   * @param {object} [opts]
   * @param {number} [opts.maxResults]
   * @param {string} [opts.fileFilter]
   * @param {boolean} [opts.boostRecent=false]
   * @param {boolean} [opts.boostImports=true]
   * @returns {Array<{ path: string, score: number, matchedTerms: string[], highlights: string[], relevance: string }>}
   */
  search(query, opts = {}) {
    const maxResults = opts.maxResults ?? this.#maxResults;
    const boostRecent = opts.boostRecent ?? false;
    const boostImports = opts.boostImports ?? true;

    const queryTokens = tokenizeQuery(query);
    if (queryTokens.length === 0) return [];

    /** @type {Map<string, { score: number, matchedTerms: Set<string> }>} */
    const scores = new Map();
    const N = Math.max(1, this.#totalFiles);

    // TF-IDF scoring
    for (const token of queryTokens) {
      const fileSet = this.#invertedIndex.get(token);
      if (!fileSet) continue;

      const idf = Math.log(N / Math.max(1, fileSet.size));

      for (const filePath of fileSet) {
        if (opts.fileFilter && !filePath.includes(opts.fileFilter)) continue;
        const record = this.#files.get(filePath);
        if (!record) continue;

        const count = record.tokenCounts.get(token) || 0;
        const tf = count / Math.max(1, record.totalTokens);
        const weight = this.#tokenWeights[token] ?? 1;

        if (!scores.has(filePath)) {
          scores.set(filePath, { score: 0, matchedTerms: new Set() });
        }
        const entry = scores.get(filePath);
        entry.score += tf * idf * weight;
        entry.matchedTerms.add(token);
      }
    }

    // Structural bonuses (delegated to scoring module)
    applyStructuralBonuses(scores, this.#files, queryTokens, query.toLowerCase(), boostImports, boostRecent);

    // Build final results
    return [...scores.entries()]
      .filter(([, entry]) => entry.score >= this.#minScore)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, maxResults)
      .map(([filePath, entry]) => {
        const record = this.#files.get(filePath);
        const matchedTerms = [...entry.matchedTerms];
        return {
          path: filePath,
          score: Math.round(entry.score * 1000) / 1000,
          matchedTerms,
          highlights: buildHighlights(record, matchedTerms),
          relevance: classifyRelevance(entry.score),
        };
      });
  }

  /**
   * Find files related to a given file via imports, exports, and shared identifiers.
   *
   * @param {string} filePath
   * @param {number} [depth=2]
   * @returns {Array<{ path: string, relation: 'imports'|'imported_by'|'shared_symbols', strength: number }>}
   */
  getRelatedFiles(filePath, depth = 2) {
    return computeRelatedFiles(filePath, this.#files, depth);
  }

  /**
   * Get the dependency graph for a file.
   *
   * @param {string} filePath
   * @returns {{ direct: string[], transitive: string[], dependents: string[] }}
   */
  getDependencyGraph(filePath) {
    const record = this.#files.get(filePath);
    const direct = record ? resolveImportPaths(record, this.#files) : [];

    const visited = new Set([filePath]);
    const transitive = [];
    let frontier = [...direct];

    for (let d = 0; d < 3; d++) {
      const next = [];
      for (const dep of frontier) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        transitive.push(dep);
        const depRecord = this.#files.get(dep);
        if (depRecord) {
          next.push(...resolveImportPaths(depRecord, this.#files));
        }
      }
      frontier = next;
    }

    const dependents = [];
    for (const [otherPath, otherRecord] of this.#files) {
      if (otherPath === filePath) continue;
      const deps = resolveImportPaths(otherRecord, this.#files);
      if (deps.includes(filePath)) {
        dependents.push(otherPath);
      }
    }

    return { direct, transitive, dependents };
  }

  /**
   * Get a structural signature of a file.
   *
   * @param {string} filePath
   * @returns {{ exports: string[], classes: string[], functions: string[], types: string[], imports: string[] } | null}
   */
  getFileSignature(filePath) {
    const record = this.#files.get(filePath);
    if (!record) return null;
    return {
      exports: [...record.exports],
      classes: [...record.classes],
      functions: [...record.functions],
      types: [...record.types],
      imports: [...record.importPaths],
    };
  }

  /**
   * Get file content split into semantic chunks.
   *
   * @param {string} filePath
   * @param {object} [opts]
   * @param {number} [opts.maxChunkSize=2000]
   * @param {number} [opts.overlap=200]
   * @param {boolean} [opts.prioritizeExports=true]
   * @returns {Array<{ content: string, startLine: number, endLine: number, type: 'function'|'class'|'module' }>}
   */
  getFileChunks(filePath, opts = {}) {
    const record = this.#files.get(filePath);
    if (!record || !record.content) return [];

    const maxChunkSize = opts.maxChunkSize ?? 2000;
    const overlap = opts.overlap ?? 200;
    const prioritizeExports = opts.prioritizeExports ?? true;
    const lines = record.content.split('\n');
    const boundaries = findChunkBoundaries(lines);

    if (boundaries.length === 0) {
      return splitBySize(lines, maxChunkSize, overlap);
    }

    /** @type {Array<{ content: string, startLine: number, endLine: number, type: string }>} */
    const chunks = [];
    let currentStart = 0;

    for (const boundary of boundaries) {
      const blockText = lines.slice(currentStart, boundary.start).join('\n');
      if (blockText.length > maxChunkSize && currentStart < boundary.start) {
        chunks.push({
          content: blockText.slice(0, maxChunkSize),
          startLine: currentStart + 1,
          endLine: boundary.start,
          type: 'module',
        });
        currentStart = boundary.start;
      }
    }

    if (currentStart < lines.length) {
      const remaining = lines.slice(currentStart).join('\n');
      if (remaining.trim().length > 0) {
        chunks.push({
          content: remaining.slice(0, maxChunkSize),
          startLine: currentStart + 1,
          endLine: lines.length,
          type: 'module',
        });
      }
    }

    const merged = mergeSmallChunks(chunks, maxChunkSize, overlap);

    if (prioritizeExports) {
      merged.sort((a, b) => {
        const aExp = record.exports.some(e => a.content.includes(e)) ? 0 : 1;
        const bExp = record.exports.some(e => b.content.includes(e)) ? 0 : 1;
        return aExp - bExp || a.startLine - b.startLine;
      });
    }

    return merged;
  }

  /**
   * Refresh the index for specific files after modifications.
   *
   * @param {string[]} filePaths
   * @returns {Promise<{ refreshed: number, errors: string[] }>}
   */
  async refreshFiles(filePaths) {
    if (!this.#projectRoot) {
      throw new Error('Index not built. Call buildIndex() first.');
    }

    let refreshed = 0;
    const errors = [];

    for (const relPath of filePaths) {
      const absPath = join(this.#projectRoot, relPath);
      const resolvedRoot = resolve(this.#projectRoot);
      const resolvedPath = resolve(this.#projectRoot, relPath);
      if (resolvedPath !== resolvedRoot &&
          !resolvedPath.startsWith(resolvedRoot + '/') &&
          !resolvedPath.startsWith(resolvedRoot + '\\')) {
        errors.push(`${relPath}: path traversal blocked`);
        continue;
      }
      try {
        removeFileFromIndex(relPath, this.#files, this.#invertedIndex);

        const fileStat = await stat(absPath);
        const raw = await readFile(absPath, { encoding: 'utf-8' });
        const content = raw.length > MAX_FILE_BYTES
          ? raw.slice(0, MAX_FILE_BYTES)
          : raw;

        indexFileInto(relPath, absPath, content, fileStat, this.#files, this.#invertedIndex);
        refreshed++;
      } catch (err) {
        errors.push(`${relPath}: ${err.message || err}`);
      }
    }

    this.#totalFiles = this.#files.size;
    return { refreshed, errors };
  }

  /**
   * Get statistics about the current index.
   *
   * @returns {{ fileCount: number, tokenCount: number, avgTokensPerFile: number, topTerms: Array<{ term: string, docFreq: number }> }}
   */
  getStats() {
    let totalTokens = 0;
    for (const record of this.#files.values()) {
      totalTokens += record.totalTokens;
    }

    const termFreqs = [...this.#invertedIndex.entries()]
      .map(([term, fileSet]) => ({ term, docFreq: fileSet.size }))
      .sort((a, b) => b.docFreq - a.docFreq)
      .slice(0, 20);

    return {
      fileCount: this.#files.size,
      tokenCount: this.#invertedIndex.size,
      avgTokensPerFile: this.#files.size > 0
        ? Math.round(totalTokens / this.#files.size)
        : 0,
      topTerms: termFreqs,
    };
  }
}
