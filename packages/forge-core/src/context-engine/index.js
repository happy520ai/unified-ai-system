/**
 * Adaptive Context Engine — manages the context window budget intelligently for worker tasks.
 *
 * Problem: LLM context windows are finite. When assembling context for a worker,
 * we must decide what to include and what to omit based on relevance and priority.
 *
 * Strategy: priority-based allocation with graceful degradation.
 *   Priority 1 (highest): Task prompt and instructions (~500 tokens reserved)
 *   Priority 2: Directly relevant files (mentioned in task, changed by deps)
 *   Priority 3: Dependency context (files that import/export from changed files)
 *   Priority 4: Previous task results summary
 *   Priority 5: Project structure overview (package.json, entry points)
 *   Priority 6 (lowest): Key decisions and artifacts from completed tasks
 *
 * Each priority band receives a proportional token budget. When the total exceeds
 * the max context size, lower-priority content is truncated or excluded first.
 *
 * Usage:
 *   const engine = new ContextEngine({ maxContextTokens: 32000 });
 *   const { contextBlock, included, excluded, estimatedTokens } = engine.buildContext({
 *     task: { prompt: '...', relevantFiles: [...] },
 *     codebaseIndex: { files: [...] },
 *     previousResults: [{ taskId, summary }],
 *     changedFiles: ['src/auth.js'],
 *   });
 */

import { FileSnapshot } from './file-snapshot.js';
import {
  PRIORITY_WEIGHTS,
  estimateTokens as _estimateTokens,
  compressFile as _compressFile,
  formatTaskPrompt,
  collectDirectFiles,
  collectDependencyFiles,
  formatFileBlock,
  buildProjectStructure,
  truncateToTokens,
  summarizeResults as _summarizeResults,
  extractKeyDecisions,
} from './helpers.js';

export class ContextEngine {
  /** @type {number} */
  #maxContextTokens;

  /**
   * Optional CodebaseSearch instance for semantic file discovery.
   * When set, buildContext() uses it to find relevant files via TF-IDF search
   * and dependency-aware context building.
   * @type {import('../codebase-search/index.js').CodebaseSearch|null}
   */
  #codebaseSearch = null;

  /**
   * Optional FileSnapshot instance for incremental context building.
   * When set, buildContext() with useDelta=true diffs against this snapshot
   * to avoid re-processing unchanged files.
   * @type {import('./file-snapshot.js').FileSnapshot|null}
   */
  #snapshot = null;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxContextTokens=32000] — total context budget in tokens
   */
  constructor({ maxContextTokens = 32_000 } = {}) {
    this.#maxContextTokens = maxContextTokens;
  }

  /**
   * Attach a CodebaseSearch instance for semantic context building.
   * When set, the context engine will use TF-IDF search and dependency
   * graph traversal to discover relevant files beyond those explicitly
   * listed in the task.
   *
   * @param {import('../codebase-search/index.js').CodebaseSearch} search
   */
  setCodebaseSearch(search) {
    this.#codebaseSearch = search;
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Build an optimized context block for a worker task.
   *
   * @param {object} params
   * @param {object} params.task — the task object ({ prompt, name, relevantFiles? })
   * @param {object} [params.codebaseIndex] — codebase index ({ files: [{ path, content }] })
   * @param {Array}  [params.previousResults] — completed task results ([{ taskId, summary, filesModified }])
   * @param {string[]} [params.changedFiles] — file paths modified by upstream tasks
   * @returns {{ contextBlock: string, included: { files: string[], summaries: string[] }, excluded: string[], estimatedTokens: number }}
   */
  buildContext({ task, codebaseIndex, previousResults, changedFiles, useDelta = false, deltaStaleThreshold = 500 }) {
    const budget = this.#maxContextTokens;
    const tok = (t) => this.estimateTokens(t);

    // Compute per-band budgets
    const bandBudgets = {};
    for (const [band, weight] of Object.entries(PRIORITY_WEIGHTS)) {
      bandBudgets[band] = Math.floor(budget * weight);
    }

    const sections = [];
    const included = { files: [], summaries: [] };
    const excluded = [];
    let totalTokens = 0;

    // ── Priority 1: Task prompt (always included) ──────────────────────
    const taskText = formatTaskPrompt(task);
    const taskTokens = tok(taskText);
    sections.push({ priority: 1, text: taskText, tokens: taskTokens, band: 'taskPrompt' });
    totalTokens += taskTokens;

    // Collect all indexed files for lookups
    const allFiles = codebaseIndex?.files ?? [];
    const fileMap = new Map(allFiles.map(f => [f.path, f]));
    const changedSet = new Set(changedFiles ?? []);

    // ── Delta context: incremental rebuild (opt-in via useDelta) ───────
    let deltaMode = 'none';
    let deltaTokenSaved = 0;

    if (useDelta) {
      const newSnapshot = new FileSnapshot();
      for (const file of allFiles) {
        newSnapshot.update(file.path, file.content);
      }

      if (this.#snapshot) {
        const delta = this.#snapshot.diff(newSnapshot);
        const changeCount = delta.added.length + delta.modified.length + delta.removed.length;

        if (changeCount > deltaStaleThreshold) {
          deltaMode = 'full';
        } else {
          deltaMode = 'delta';
          for (const p of delta.added) changedSet.add(p);
          for (const p of delta.modified) changedSet.add(p);

          const unchangedTokens = delta.unchanged.reduce((sum, p) => {
            const f = fileMap.get(p);
            return sum + (f ? tok(f.content) : 0);
          }, 0);
          const signatureTokens = delta.unchanged.length * 20;
          deltaTokenSaved = Math.max(0, unchangedTokens - signatureTokens);
        }
      } else {
        deltaMode = 'full';
      }

      this.#snapshot = newSnapshot;
    }

    // ── Priority 2: Directly relevant files ────────────────────────────
    const directFileNames = collectDirectFiles(task, changedSet);

    // Semantic augmentation via CodebaseSearch TF-IDF
    if (this.#codebaseSearch && task.prompt) {
      const semanticResults = this.#buildSemanticContext(task);
      for (const sr of semanticResults.searchHits) {
        if (!directFileNames.includes(sr.path)) {
          directFileNames.push(sr.path);
        }
      }
    }

    const directBudget = bandBudgets.directFiles;
    let directUsed = 0;

    for (const name of directFileNames) {
      const file = fileMap.get(name);
      if (!file) continue;

      const maxFileTokens = Math.floor((directBudget - directUsed) / Math.max(1, directFileNames.length - directFileNames.indexOf(name)));
      const remaining = directBudget - directUsed;
      if (remaining <= 50) break;

      const fileContent = formatFileBlock(file.path, file.content, Math.min(maxFileTokens, remaining), tok, _compressFile);
      const fileTokens = tok(fileContent);

      if (directUsed + fileTokens <= directBudget) {
        sections.push({ priority: 2, text: fileContent, tokens: fileTokens, band: 'directFiles' });
        included.files.push(file.path);
        directUsed += fileTokens;
        totalTokens += fileTokens;
      } else {
        const compressed = formatFileBlock(file.path, this.compressFile(file.content, Math.min(maxFileTokens, remaining)), Math.min(maxFileTokens, remaining), tok, _compressFile);
        const compressedTokens = tok(compressed);
        if (compressedTokens <= remaining) {
          sections.push({ priority: 2, text: compressed, tokens: compressedTokens, band: 'directFiles' });
          included.files.push(file.path);
          directUsed += compressedTokens;
          totalTokens += compressedTokens;
        } else {
          excluded.push(`${file.path} (direct, exceeded band budget)`);
        }
      }
    }

    // ── Priority 3: Dependency context ─────────────────────────────────
    const depFileNames = collectDependencyFiles(allFiles, changedSet, directFileNames);

    // Semantic augmentation: expand dependency chain via CodebaseSearch
    if (this.#codebaseSearch) {
      const directSet = new Set(directFileNames);
      for (const directFile of directFileNames) {
        try {
          const related = this.#codebaseSearch.getRelatedFiles(directFile, 1);
          for (const rel of related) {
            if (!directSet.has(rel.path) && !depFileNames.includes(rel.path)) {
              depFileNames.push(rel.path);
            }
          }
        } catch {
          // getRelatedFiles may fail if file is not indexed; skip silently
        }
      }
    }

    const depBudget = bandBudgets.dependencyFiles;
    let depUsed = 0;

    for (const name of depFileNames) {
      const file = fileMap.get(name);
      if (!file) continue;

      const remaining = depBudget - depUsed;
      if (remaining <= 50) break;

      const maxFileTokens = Math.min(remaining, 2000); // cap per file
      const fileContent = formatFileBlock(file.path, this.compressFile(file.content, maxFileTokens), maxFileTokens, tok, _compressFile);
      const fileTokens = tok(fileContent);

      if (depUsed + fileTokens <= depBudget) {
        sections.push({ priority: 3, text: fileContent, tokens: fileTokens, band: 'dependencyFiles' });
        included.files.push(file.path);
        depUsed += fileTokens;
        totalTokens += fileTokens;
      } else {
        excluded.push(`${file.path} (dependency, exceeded band budget)`);
      }
    }

    // ── Priority 4: Previous task results ──────────────────────────────
    if (previousResults && previousResults.length > 0) {
      const summaryText = this.summarizeResults(previousResults, bandBudgets.previousResults);
      const summaryTokens = tok(summaryText);

      if (summaryTokens > 0 && totalTokens + summaryTokens <= budget) {
        sections.push({ priority: 4, text: summaryText, tokens: summaryTokens, band: 'previousResults' });
        included.summaries.push(`${previousResults.length} task result(s)`);
        totalTokens += summaryTokens;
      } else if (previousResults.length > 0) {
        excluded.push('previous task results (exceeded budget)');
      }
    }

    // ── Priority 5: Project structure ──────────────────────────────────
    const structureText = buildProjectStructure(allFiles);
    if (structureText) {
      const structTokens = tok(structureText);
      if (structTokens <= bandBudgets.projectStructure && totalTokens + structTokens <= budget) {
        sections.push({ priority: 5, text: structureText, tokens: structTokens, band: 'projectStructure' });
        included.files.push('(project structure overview)');
        totalTokens += structTokens;
      } else {
        excluded.push('project structure overview (exceeded budget)');
      }
    }

    // ── Priority 6: Key decisions ──────────────────────────────────────
    if (previousResults && previousResults.length > 0) {
      const decisionsText = extractKeyDecisions(previousResults, bandBudgets.keyDecisions, tok);
      if (decisionsText) {
        const decisionTokens = tok(decisionsText);
        if (decisionTokens <= bandBudgets.keyDecisions && totalTokens + decisionTokens <= budget) {
          sections.push({ priority: 6, text: decisionsText, tokens: decisionTokens, band: 'keyDecisions' });
          included.summaries.push('key decisions');
          totalTokens += decisionTokens;
        } else {
          excluded.push('key decisions (exceeded budget)');
        }
      }
    }

    // ── Priority 6.5: File signatures (semantic bonus) ──────────────
    if (this.#codebaseSearch && included.files.length > 0) {
      const sigLines = [];
      for (const filePath of included.files) {
        if (filePath.startsWith('(')) continue;
        try {
          const sig = this.#codebaseSearch.getFileSignature(filePath);
          if (!sig) continue;
          const parts = [];
          if (sig.exports.length > 0) parts.push(`exports: ${sig.exports.join(', ')}`);
          if (sig.classes.length > 0) parts.push(`classes: ${sig.classes.join(', ')}`);
          if (sig.functions.length > 0) parts.push(`functions: ${sig.functions.slice(0, 8).join(', ')}`);
          if (sig.types.length > 0) parts.push(`types: ${sig.types.join(', ')}`);
          if (parts.length > 0) {
            sigLines.push(`- **${filePath}**: ${parts.join('; ')}`);
          }
        } catch {
          // skip files without signatures
        }
      }
      if (sigLines.length > 0) {
        const sigText = `## File Signatures\n${sigLines.join('\n')}`;
        const sigTokens = tok(sigText);
        if (sigTokens <= 500 && totalTokens + sigTokens <= budget) {
          sections.push({ priority: 7, text: sigText, tokens: sigTokens, band: 'fileSignatures' });
          included.summaries.push('file signatures');
          totalTokens += sigTokens;
        }
      }
    }

    // ── Assemble final context block ───────────────────────────────────
    sections.sort((a, b) => a.priority - b.priority);
    const contextBlock = sections.map(s => s.text).join('\n\n');

    return {
      contextBlock,
      included,
      excluded,
      estimatedTokens: totalTokens,
      _metadata: { deltaMode, deltaTokenSaved },
    };
  }

  /**
   * Estimate the token count for a string.
   * @param {string} text
   * @returns {number}
   */
  estimateTokens(text) {
    return _estimateTokens(text);
  }

  /**
   * Compress file content to fit within a token budget.
   * @param {string} content
   * @param {number} maxTokens
   * @returns {string}
   */
  compressFile(content, maxTokens) {
    return _compressFile(content, maxTokens, _estimateTokens);
  }

  /**
   * Build a summary from completed task results for downstream tasks.
   * @param {Array} completedTasks
   * @param {number} [maxTokens=1000]
   * @returns {string}
   */
  summarizeResults(completedTasks, maxTokens = 1000) {
    return _summarizeResults(completedTasks, maxTokens, _estimateTokens, truncateToTokens);
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Build a semantic context section using the attached CodebaseSearch.
   * Must remain a class method because it accesses #codebaseSearch.
   *
   * @param {object} task — task object with { prompt, name, relevantFiles? }
   * @returns {{ searchHits: Array, relatedFiles: Array, signatures: Array }}
   */
  #buildSemanticContext(task) {
    const result = { searchHits: [], relatedFiles: [], signatures: [] };
    if (!this.#codebaseSearch) return result;

    // 1. Search for relevant files using the task description
    const query = [task.name, task.prompt].filter(Boolean).join(' ');
    if (query.trim().length > 0) {
      try {
        const hits = this.#codebaseSearch.search(query, { maxResults: 8, boostImports: true });
        result.searchHits = hits.map(h => ({ path: h.path, score: h.score, matchedTerms: h.matchedTerms }));
      } catch {
        // Search may fail if index is not built; degrade gracefully
      }
    }

    // 2. For each explicitly relevant file, discover related files
    const entryFiles = [
      ...(task.relevantFiles || []),
      ...(task.allowedFiles || task.allowed_files || []),
    ];

    for (const entryFile of entryFiles) {
      try {
        const related = this.#codebaseSearch.getRelatedFiles(entryFile, 2);
        for (const rel of related) {
          if (!result.relatedFiles.some(r => r.path === rel.path)) {
            result.relatedFiles.push(rel);
          }
        }
      } catch {
        // getRelatedFiles may fail for unindexed files
      }
    }

    // 3. Collect structural signatures for all discovered files
    const allDiscoveredPaths = new Set([
      ...result.searchHits.map(h => h.path),
      ...result.relatedFiles.map(r => r.path),
      ...entryFiles,
    ]);

    for (const filePath of allDiscoveredPaths) {
      try {
        const sig = this.#codebaseSearch.getFileSignature(filePath);
        if (sig && (sig.exports.length > 0 || sig.functions.length > 0 || sig.classes.length > 0)) {
          result.signatures.push({
            path: filePath,
            exports: sig.exports,
            functions: sig.functions,
            classes: sig.classes,
          });
        }
      } catch {
        // skip
      }
    }

    return result;
  }
}
