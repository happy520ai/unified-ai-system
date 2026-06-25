/**
 * Context building and file gathering for BaseWorker.
 * Extracted from base.js to keep it under 500 lines.
 */

import { join } from 'node:path';
import { glob } from './glob.js';

/**
 * Gather relevant files from the project based on allowed patterns.
 */
export async function gatherFiles(projectRoot, allowedPatterns, taskType, opts) {
  const { knowledgeGraph, injectionDefense } = opts;
  let patterns;
  if (typeof allowedPatterns === 'string') { try { patterns = JSON.parse(allowedPatterns); } catch { patterns = ['**/*']; } }
  else { patterns = allowedPatterns ?? ['**/*']; }
  if (!Array.isArray(patterns)) patterns = ['**/*'];
  const isExplore = taskType === 'explore' || taskType === 'plan';
  const perPatternCap = isExplore ? 15 : 8;
  const totalCap = isExplore ? 30 : 20;
  const globResults = await Promise.all(patterns.map(pattern => glob(projectRoot, pattern)));
  const files = [];
  for (const matches of globResults) { files.push(...matches.slice(0, perPatternCap)); }
  const essentialFiles = ['package.json'];
  if (isExplore) essentialFiles.push('tsconfig.json', 'README.md', '.env.example');
  if (isExplore) {
    const contextPatterns = ['src/**/*.js', 'src/**/*.ts', 'src/index.*'];
    const contextResults = await Promise.all(contextPatterns.map(cp => glob(projectRoot, cp)));
    for (const matches of contextResults) { files.push(...matches.slice(0, 10)); }
  }
  const essentialChecks = await Promise.allSettled(essentialFiles.map(ef => import('node:fs/promises').then(fs => fs.access(join(projectRoot, ef)).then(() => ef))));
  for (const check of essentialChecks) { if (check.status === 'fulfilled') files.push(check.value); }
  const unique = [...new Set(files)];
  let candidates = unique.slice(0, totalCap);
  if (knowledgeGraph) {
    const dependentFiles = new Set();
    for (const f of candidates) {
      for (const dep of knowledgeGraph.getDependencies(f)) dependentFiles.add(dep);
      for (const dep of knowledgeGraph.getDependents(f)) dependentFiles.add(dep);
    }
    const existingSet = new Set(candidates);
    let added = 0;
    for (const dep of dependentFiles) { if (!existingSet.has(dep) && added < 5) { candidates.push(dep); added++; } }
  }
  const readResults = await Promise.allSettled(candidates.map(async (filePath) => {
    const { readFile: rf } = await import('node:fs/promises');
    const content = await rf(join(projectRoot, filePath), 'utf-8');
    if (content.length < 50000) {
      let safeContent = content.slice(0, 6000);
      if (injectionDefense) { const sr = injectionDefense.sanitize(safeContent, { strictness: 'standard' }); if (sr.removed > 0) safeContent = sr.sanitized; }
      if (knowledgeGraph) knowledgeGraph.addFile(filePath, content);
      return { path: filePath, content: safeContent };
    }
    return null;
  }));
  const result = [];
  for (const r of readResults) { if (r.status === 'fulfilled' && r.value) result.push(r.value); }
  return result;
}

/**
 * Build a context block from files and previous context.
 * Delegates to ContextEngine if available, otherwise uses legacy format.
 */
export function buildContextBlock(files, prevContext, engines) {
  if (engines.contextEngine) return buildContextBlockEngine(files, prevContext, engines);
  return buildContextBlockLegacy(files, prevContext, engines);
}

function buildContextBlockEngine(files, prevContext, engines) {
  const engine = engines.contextEngine;
  const codebaseIndex = { files: files.map(f => ({ path: f.path, content: f.content })) };
  const previousResults = [];
  if (prevContext.summary) previousResults.push({ taskId: 'prev', summary: prevContext.summary, filesModified: [] });
  if (prevContext.keyDecisions?.length) { for (const d of prevContext.keyDecisions) previousResults.push({ taskId: 'decision', keyDecision: d }); }
  const changedFiles = prevContext.changedFiles || [];
  const task = { prompt: '', name: '', type: 'implement', allowedFiles: files.map(f => f.path) };
  const result = engine.buildContext({ task, codebaseIndex, previousResults, changedFiles });
  let block = result.context;
  block += buildEnrichmentSection(files, prevContext, engines);
  return block;
}

function buildContextBlockLegacy(files, prevContext, engines) {
  let block = '';
  if (prevContext.summary) block += `## Previous Task Results\n${prevContext.summary}\n\n`;
  if (prevContext.keyDecisions?.length) block += `## Key Decisions Made\n${prevContext.keyDecisions.map(d => `- ${d}`).join('\n')}\n\n`;
  if (files.length > 0) {
    block += `## Relevant Files\n`;
    for (const f of files.slice(0, 15)) block += `\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n`;
  }
  if (engines.memoryEngine) {
    const query = prevContext.summary || files.map(f => f.path).join(' ') || '';
    const { context: memContext } = engines.memoryEngine.buildContext({ query, tokenBudget: 8000, files: [] });
    if (memContext.trim()) block += '\n' + memContext;
  }
  if (engines.semanticMemory) {
    const query = prevContext.summary || files.map(f => f.path).join(' ') || '';
    const results = engines.semanticMemory.search(query, { limit: 5 });
    if (results.length > 0) { block += '\n## Related Knowledge\n'; for (const r of results) { const s = r.content.length > 200 ? r.content.slice(0, 197) + '...' : r.content; block += `- ${s}\n`; } }
  }
  block += buildCrossSessionSection(files, prevContext, engines);
  return block;
}

function buildEnrichmentSection(files, prevContext, engines) {
  let block = '';
  const query = prevContext.summary || files.map(f => f.path).join(' ') || '';
  if (engines.memoryEngine) { const { context: mc } = engines.memoryEngine.buildContext({ query, tokenBudget: 4000, files: [] }); if (mc.trim()) block += '\n' + mc; }
  if (engines.semanticMemory) {
    const results = engines.semanticMemory.search(query, { limit: 5 });
    if (results.length > 0) { block += '\n## Related Knowledge\n'; for (const r of results) { const s = r.content.length > 200 ? r.content.slice(0, 197) + '...' : r.content; block += `- ${s}\n`; } }
  }
  block += buildCrossSessionSection(files, prevContext, engines);
  return block;
}

function buildCrossSessionSection(files, prevContext, engines) {
  if (!engines.crossSessionMemory) return '';
  let block = '';
  const query = prevContext.summary || files.map(f => f.path).join(' ') || '';
  try {
    const insights = engines.crossSessionMemory.search('insights', query, { limit: 3 });
    if (insights.length > 0) { block += '\n## Learned Insights (from past sessions)\n'; for (const item of insights) { const c = item.content.length > 200 ? item.content.slice(0, 197) + '...' : item.content; block += `- ${c} (relevance: ${(item.relevance * 100).toFixed(0)}%)\n`; } }
    const fixes = engines.crossSessionMemory.search('errorFixes', query, { limit: 2 });
    if (fixes.length > 0) { block += '\n## Known Error Fixes\n'; for (const item of fixes) { const c = item.content.length > 200 ? item.content.slice(0, 197) + '...' : item.content; block += `- ${c}\n`; } }
    const strategies = engines.crossSessionMemory.search('strategies', query, { limit: 2 });
    if (strategies.length > 0) { block += '\n## Proven Strategies\n'; for (const item of strategies) { const c = item.content.length > 200 ? item.content.slice(0, 197) + '...' : item.content; block += `- ${c}\n`; } }
  } catch { /* non-critical */ }
  return block;
}
