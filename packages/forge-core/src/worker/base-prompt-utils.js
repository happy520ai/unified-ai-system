/**
 * Prompt building and post-execution lifecycle utilities for BaseWorker.
 */

import {
  buildImportConstraintText,
  getLanguageFileExtension,
  normalizeLanguageCandidate,
  preferredLanguageLabel,
} from '../goal-refiner/helpers.js';

export { buildImportConstraintText, getLanguageFileExtension };

function resolveLanguage(languageOrTask) {
  if (!languageOrTask) return null;
  if (typeof languageOrTask === 'object' && languageOrTask.language !== undefined) {
    return normalizeLanguageCandidate(languageOrTask.language);
  }
  return normalizeLanguageCandidate(languageOrTask);
}

/**
 * Build a language label for prompt constraints.
 *
 * @param {object} task
 * @returns {string}
 */
export function buildLanguageLabel(task = {}) {
  return preferredLanguageLabel(resolveLanguage(task));
}

/**
 * Build the full user prompt for the LLM.
 */
export function buildPrompt(task, contextBlock, extraContext, opts) {
  const { tools, role, errorPatternLearner } = opts;
  const taskLanguage = resolveLanguage(task);
  const mutationTypes = new Set(['implement', 'test', 'refactor']);
  const isMutation = mutationTypes.has(task.type);
  const ext = getLanguageFileExtension(taskLanguage);
  const hasTool = (t) => tools.includes(t);
  let actionList = '';
  let actionIdx = 1;
  if (hasTool('read')) actionList += `${actionIdx++}. Read file: {"type": "read", "path": "relative/path.${ext}"}\n`;
  if (hasTool('write')) actionList += `${actionIdx++}. Write file: {"type": "write", "path": "relative/path.${ext}", "content": "full file content"}\n`;
  if (hasTool('edit')) actionList += `${actionIdx++}. Edit file: {"type": "edit", "path": "relative/path.${ext}", "oldString": "exact old text to find", "newString": "replacement text"}\n`;
  if (hasTool('diff')) actionList += `${actionIdx++}. Diff edit: {"type": "diff", "path": "relative/path.${ext}", "edits": [{"startLine": 5, "endLine": 8, "newContent": "replacement"}]}\n`;
  if (hasTool('bash')) actionList += `${actionIdx++}. Run command: {"type": "bash", "command": "npm test"}\n`;
  const mutationActions = [];
  if (hasTool('write')) mutationActions.push('"write"');
  if (hasTool('edit')) mutationActions.push('"edit"');
  if (hasTool('diff')) mutationActions.push('"diff"');
  const mutationActionStr = mutationActions.length > 0 ? mutationActions.join(' or ') : '"write"';
  let prompt = `${contextBlock}\n\n## Your Task\n${task.prompt || task.name}\n\n` +
    `## Instructions\nIMPORTANT: When editing files, your oldString must match the EXACT text in the file including all whitespace and indentation.\n` +
    `If you are unsure of the exact content, use a "read" action first to read the file, then use "edit" or "write".\n` +
    `Prefer "write" (full file content) over "edit" when making substantial changes.\n\n### Actions:\n${actionList}`;
  if (Array.isArray(task.constraints) && task.constraints.length > 0) {
    prompt += `\n## Constraints\n${task.constraints.map((constraint) => `- ${constraint}`).join('\n')}\n`;
  }
  if (taskLanguage) {
    prompt += `\n## Primary Language\nPrimary implementation language: ${buildLanguageLabel(task)}.\n`;
  }
  if (isMutation) {
    prompt += `\n**IMPORTANT: This is a ${task.type} task. You MUST include ${mutationActionStr} actions to create/modify files. ` +
      `Do NOT only read files or run commands — produce the actual code changes.**\n`;
    prompt += `**IMPORTS: Every file you write MUST include ALL necessary import statements at the top. ` +
      `${buildImportConstraintText(taskLanguage)} ` +
      `Use proper multi-line formatting with newlines and indentation.**\n`;
  }
  if (extraContext) prompt += `\n## Additional Context\n${extraContext}\n`;
  if (errorPatternLearner) {
    const instructions = errorPatternLearner.getInstructions({ workerType: role, taskType: task.type });
    if (instructions.trim()) prompt += '\n' + instructions + '\n';
  }
  prompt += `\nRespond with a JSON array of actions, followed by:\n---SUMMARY---\nBrief description of what was done.\n---END---`;
  return prompt;
}

/**
 * Store task learnings into cross-session memory after execution.
 */
export function storePostExecutionLearnings(result, task, crossSessionMemory) {
  if (!crossSessionMemory) return;
  try {
    const taskDesc = task.name || task.prompt?.slice(0, 100) || task.id;
    if (result.success && result.summary) {
      crossSessionMemory.store('insights', {
        content: `Task "${taskDesc}" succeeded: ${result.summary.slice(0, 300)}`,
        source: task.type || 'unknown',
        tags: [task.type, result.filesModified?.length ? `${result.filesModified.length}-files` : 'no-files'],
      });
    }
    if (!result.success && result.error) {
      crossSessionMemory.store('errorFixes', {
        content: `Task "${taskDesc}" failed: ${String(result.error).slice(0, 300)}`,
        source: task.type || 'unknown',
        tags: ['error', task.type],
      });
    }
    if (result.filesModified?.length > 0) {
      const patterns = result.filesModified.map(f => f.path || f).join(', ');
      crossSessionMemory.store('strategies', {
        content: `${task.type} task modified: ${patterns}`,
        source: task.type || 'unknown',
        tags: ['file-pattern', task.type],
      });
    }
  } catch { /* cross-session storage is non-critical */ }
}
