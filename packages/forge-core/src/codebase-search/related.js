/**
 * @module codebase-search/related
 * @description Related-file computation for the code search engine.
 * Finds files connected via imports, reverse imports, and shared symbols.
 */

import { resolveImportPaths } from './resolve.js';

/**
 * Find files related to a given file via imports, exports, and shared identifiers.
 *
 * @param {string} filePath — relative path of the reference file
 * @param {Map<string, { exports: string[], functions: string[], classes: string[], importPaths: string[] }>} files
 * @param {number} depth — maximum traversal depth for import chain
 * @returns {Array<{ path: string, relation: 'imports'|'imported_by'|'shared_symbols', strength: number }>}
 */
export function computeRelatedFiles(filePath, files, depth = 2) {
  const record = files.get(filePath);
  if (!record) return [];

  /** @type {Map<string, { relation: string, strength: number }>} */
  const related = new Map();

  // 1. Direct imports (files this file imports)
  const directDeps = resolveImportPaths(record, files);
  for (const dep of directDeps) {
    if (dep !== filePath) {
      related.set(dep, { relation: 'imports', strength: 1.0 });
    }
  }

  // 2. Reverse imports (files that import this file)
  for (const [otherPath, otherRecord] of files) {
    if (otherPath === filePath) continue;
    const otherDeps = resolveImportPaths(otherRecord, files);
    if (otherDeps.includes(filePath)) {
      related.set(otherPath, { relation: 'imported_by', strength: 0.9 });
    }
  }

  // 3. Shared symbols (files that share exported/imported identifiers)
  const mySymbols = new Set([
    ...record.exports,
    ...record.functions,
    ...record.classes,
  ]);

  if (mySymbols.size > 0) {
    for (const [otherPath, otherRecord] of files) {
      if (otherPath === filePath || related.has(otherPath)) continue;
      const otherSymbols = new Set([
        ...otherRecord.exports,
        ...otherRecord.functions,
        ...otherRecord.classes,
      ]);
      let shared = 0;
      for (const s of mySymbols) {
        if (otherSymbols.has(s)) shared++;
      }
      if (shared > 0) {
        const strength = Math.min(1, shared / Math.max(1, mySymbols.size));
        related.set(otherPath, { relation: 'shared_symbols', strength });
      }
    }
  }

  // 4. Transitive imports (follow chain up to depth)
  if (depth > 1) {
    const visited = new Set([filePath]);
    let frontier = directDeps;

    for (let d = 1; d < depth; d++) {
      const nextFrontier = [];
      for (const dep of frontier) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        const depRecord = files.get(dep);
        if (!depRecord) continue;
        const transitive = resolveImportPaths(depRecord, files);
        for (const t of transitive) {
          if (!visited.has(t) && t !== filePath && !related.has(t)) {
            related.set(t, {
              relation: 'imports',
              strength: Math.max(0.1, 1.0 - (d * 0.3)),
            });
            nextFrontier.push(t);
          }
        }
      }
      frontier = nextFrontier;
    }
  }

  return [...related.entries()]
    .map(([path, info]) => ({
      path,
      relation: /** @type {'imports'|'imported_by'|'shared_symbols'} */ (info.relation),
      strength: Math.round(info.strength * 100) / 100,
    }))
    .sort((a, b) => b.strength - a.strength);
}
