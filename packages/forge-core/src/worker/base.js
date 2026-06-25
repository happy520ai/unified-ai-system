/**
 * Base Worker Agent — handles LLM interaction, file operations, and tool execution.
 *
 * Every worker:
 *   1. Receives a task with a prompt and allowed file globs
 *   2. Reads relevant files from the project
 *   3. Calls the LLM with context + instructions
 *   4. Applies file changes (edits/writes) based on LLM output
 *   5. Returns structured results
 *
 * Extracted helpers:
 *   - base-json-utils.js    — JSON parsing, repair, response extraction
 *   - base-syntax-utils.js  — syntax validation, auto-fix, auto-lint
 *   - base-action-exec.js   — action execution, path validation, import checks
 *   - base-context-build.js — context building, file gathering
 *   - base-prompt-utils.js  — prompt building, post-execution learnings
 *   - base-llm-call.js      — LLM calling with caching and retry
 *   - base-self-review.js   — self-review validation and auto-fix
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { callLLMStream } from '../llm-client.js';
import { BashSafety } from '../bash-safety/index.js';
import { IncrementalEdit } from '../incremental-edit/index.js';
import { ForgeLogger, LogLevel } from '../logger/index.js';
import { MemoryType } from '../memory-engine/index.js';
import { parseResponse } from './base-json-utils.js';
import { executeAction } from './base-action-exec.js';
import { gatherFiles, buildContextBlock } from './base-context-build.js';
import { buildPrompt, storePostExecutionLearnings } from './base-prompt-utils.js';
import { callLLM, callLLMWithRetry } from './base-llm-call.js';
import { selfReview } from './base-self-review.js';

export class BaseWorker {
  #role;
  #systemPrompt;
  #tools;
  #tokenUsage;
  #bashSafety;
  #incrementalEdit;
  #logger;
  #llmCache;
  #memoryEngine;
  #semanticMemory;
  #knowledgeGraph;
  #errorPatternLearner;
  #promptRegistry;
  #injectionDefense;
  #contextEngine;
  #crossSessionMemory;
  #iterativeRefiner;
  #qualityGate;

  constructor({ role, systemPrompt, tools = ['read', 'write', 'edit', 'diff', 'grep', 'glob', 'bash'], bashSafetyOpts, logger, llmCache }) {
    this.#role = role;
    this.#systemPrompt = systemPrompt;
    this.#tools = tools;
    this.#bashSafety = new BashSafety(bashSafetyOpts);
    this.#incrementalEdit = new IncrementalEdit();
    this.#logger = logger || new ForgeLogger({ module: `forge:${role}`, level: LogLevel.INFO });
    this.#llmCache = llmCache || null;
  }

  get role() { return this.#role; }

  setMemoryEngine(engine) { this.#memoryEngine = engine; }
  getMemoryEngine() { return this.#memoryEngine; }
  setSemanticMemory(sm) { this.#semanticMemory = sm; }
  setKnowledgeGraph(kg) { this.#knowledgeGraph = kg; }
  setErrorPatternLearner(epl) { this.#errorPatternLearner = epl; }
  setPromptRegistry(pr) { this.#promptRegistry = pr; }
  setInjectionDefense(pid) { this.#injectionDefense = pid; }
  setContextEngine(ce) { this.#contextEngine = ce; }
  setCrossSessionMemory(csm) { this.#crossSessionMemory = csm; }
  setIterativeRefiner(refiner) { this.#iterativeRefiner = refiner; }
  setQualityGate(gate) { this.#qualityGate = gate; }

  /** P9: Store task learnings into cross-session memory after execution. */
  storePostExecutionLearnings(result, task) {
    storePostExecutionLearnings(result, task, this.#crossSessionMemory);
  }

  /**
   * Execute a single task.
   * @param {object} task — from TaskStore
   * @param {string} projectRoot — absolute path to the project root
   * @param {object} context — accumulated context from previous tasks
   * @returns {object} — { success, output, filesModified, toolCalls }
   */
  async execute(task, projectRoot, context = {}) {
    this.#logger.info(`Executing task ${task.id}: ${task.name}`);
    this.#tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: 0 };

    const llmParams = { llmCache: this.#llmCache, logger: this.#logger, tokenUsage: this.#tokenUsage };
    const engines = {
      contextEngine: this.#contextEngine, memoryEngine: this.#memoryEngine,
      semanticMemory: this.#semanticMemory, crossSessionMemory: this.#crossSessionMemory,
    };

    // 1. Gather context: read relevant files
    const relevantFiles = await gatherFiles(projectRoot, task.allowed_files || task.allowedFiles, task.type, {
      knowledgeGraph: this.#knowledgeGraph, injectionDefense: this.#injectionDefense,
    });
    const contextBlock = buildContextBlock(relevantFiles, context, engines);

    const mutationTypes = new Set(['implement', 'test', 'refactor']);
    const isMutation = mutationTypes.has(task.type);
    const llmMaxTokens = isMutation ? 32768 : 8192;

    // 2. Build the prompt (with subclass-specific extra context)
    const extraContext = await this._getExtraContext(projectRoot, task);
    const userPrompt = buildPrompt(task, contextBlock, extraContext, {
      tools: this.#tools, role: this.#role, errorPatternLearner: this.#errorPatternLearner,
    });

    // 3. Call LLM (with retry for network errors)
    let llmResponse = await callLLMWithRetry(this.#systemPrompt, userPrompt, llmMaxTokens, isMutation ? { responseFormat: 'json' } : {}, llmParams);

    // 4. Parse and apply tool calls
    let { actions, summary } = parseResponse(llmResponse, this.#tools, this.#logger);
    let filesModified = [];

    this.#logger.info(`LLM returned ${actions.length} action(s), summary: ${(summary || '').slice(0, 100)}`);
    if (actions.length > 0) {
      this.#logger.info(`Actions: ${actions.map(a => `${a.type}(${a.path || a.command?.slice(0, 30) || 'N/A'})`).join(', ')}`);
    }

    // 4b. Pre-flight: if mutation task got ZERO actions, retry with strict prompt
    let hasWriteActions = actions.some(a => ['write', 'edit', 'diff'].includes(a.type));
    let readActions = actions.filter(a => a.type === 'read');

    if (isMutation && actions.length === 0) {
      this.#logger.info(`Pre-flight: mutation task got 0 actions, retrying with strict prompt...`);
      const strictPrompt = `You MUST output a valid JSON array of actions. No explanation, no reasoning — ONLY JSON.\n\n` +
        `Task: ${task.prompt || task.name}\n\n${contextBlock}\n\n` +
        `Output format (EXACTLY this structure):\n` +
        `[{"type": "write", "path": "src/file.js", "content": "full file content here"}]\n\n` +
        `Rules:\n- The "content" value MUST be a plain string with \\n for newlines.\n` +
        `- Include ALL import statements in the content.\n` +
        `- NEVER import JS built-in globals.\n\nOutput the JSON array NOW:\n` +
        `---SUMMARY---\nImplemented changes.\n---END---`;
      try {
        const retryResp = await callLLMWithRetry(this.#systemPrompt, strictPrompt, llmMaxTokens, { responseFormat: 'json' }, llmParams);
        const retryParsed = parseResponse(retryResp, this.#tools, this.#logger);
        if (retryParsed.actions.length > 0) {
          actions = retryParsed.actions; summary = retryParsed.summary; llmResponse = retryResp;
          this.#logger.info(`Pre-flight retry succeeded: ${actions.length} action(s)`);
        }
      } catch (err) { this.#logger.info(`Pre-flight retry failed: ${err.message}`); }
    }

    // 5. Multi-round: if mutation task only got read actions, execute reads then retry
    hasWriteActions = actions.some(a => ['write', 'edit', 'diff'].includes(a.type));
    readActions = actions.filter(a => a.type === 'read');
    if (isMutation && !hasWriteActions && readActions.length > 0) {
      this.#logger.info(`Multi-round: executing ${readActions.length} read(s) first, then requesting writes...`);
      const readResults = [];
      for (const ra of readActions) {
        try {
          const result = await executeAction(ra, projectRoot, task, { logger: this.#logger, bashSafety: this.#bashSafety, incrementalEdit: this.#incrementalEdit, tools: this.#tools });
          readResults.push({ path: ra.path, output: result.output });
        } catch { /* skip failed reads */ }
      }
      const readContext = readResults.map(r => `### ${r.path}\n\`\`\`\n${(r.output || '').slice(0, 4000)}\n\`\`\``).join('\n\n');
      const writeActions = this.#tools.includes('write') ? 'write' : '';
      const editActions = this.#tools.includes('edit') ? 'edit' : '';
      const writeActionStr = [writeActions, editActions].filter(Boolean).join(' or ');

      let followUpPrompt = `${contextBlock}\n\n## Files You Just Read\n${readContext}\n\n` +
        `## Your Task (REPEATED)\n${task.prompt || task.name}\n\n` +
        `## CRITICAL INSTRUCTION\n` +
        `You have now read the relevant files above. You MUST now produce ${writeActionStr.toUpperCase()} actions.\n` +
        `Do NOT return read actions again. Create or modify files using "${writeActionStr}" actions.\n` +
        `EVERY file you write MUST include ALL necessary import statements at the top.\n` +
        `NEVER import JS built-in globals (Map, Set, Array, Promise, Object, Error, Date, console, Buffer, etc.).\n` +
        `Use proper multi-line formatting with newlines and indentation.\n\n### Actions:\n`;
      if (this.#tools.includes('write')) followUpPrompt += `1. Write file: {"type": "write", "path": "relative/path.js", "content": "full file content with imports"}\n`;
      if (this.#tools.includes('edit')) followUpPrompt += `2. Edit file: {"type": "edit", "path": "relative/path.js", "oldString": "exact old text", "newString": "replacement text"}\n`;
      followUpPrompt += `\nRespond with a JSON array of ${writeActionStr} actions, followed by:\n---SUMMARY---\nBrief description.\n---END---`;

      try {
        const followUpResponse = await callLLMWithRetry(this.#systemPrompt, followUpPrompt, llmMaxTokens, { responseFormat: 'json' }, llmParams);
        const followUpParsed = parseResponse(followUpResponse, this.#tools, this.#logger);
        if (followUpParsed.actions.some(a => ['write', 'edit', 'diff'].includes(a.type))) {
          actions = followUpParsed.actions; summary = followUpParsed.summary;
          this.#logger.info(`Multi-round succeeded: ${actions.length} action(s) with writes`);
        } else {
          this.#logger.info(`Multi-round still got no writes. Trying final retry...`);
          const writeExample = this.#tools.includes('write')
            ? `[{"type": "write", "path": "test/cache.test.js", "content": "import { ... } from '../src/cache.js';\\n// full test code here"}]`
            : '';
          const finalPrompt = `You are a ${this.#role} agent. Your task is: ${task.prompt || task.name}\n\n` +
            `Here is the codebase context:\n${readContext}\n\n` +
            `STOP REASONING. DO NOT ANALYZE. Output JSON IMMEDIATELY.\n` +
            `YOUR ONLY JOB: Output a JSON array with a "write" action containing the FULL file content including imports.\n` +
            `Example format: ${writeExample}\n---SUMMARY---\nCreated files.\n---END---`;
          const finalResponse = await callLLMWithRetry(this.#systemPrompt, finalPrompt, llmMaxTokens, { responseFormat: 'json' }, llmParams);
          const finalParsed = parseResponse(finalResponse, this.#tools, this.#logger);
          if (finalParsed.actions.some(a => ['write', 'edit', 'diff'].includes(a.type))) {
            actions = finalParsed.actions; summary = finalParsed.summary;
            this.#logger.info(`Final retry succeeded: ${actions.length} action(s)`);
          }
        }
      } catch (err) { this.#logger.info(`Multi-round LLM call failed: ${err.message}`); }
    } else if (isMutation && !hasWriteActions && readActions.length === 0) {
      this.#logger.info(`Mutation task got no write actions. Retrying...`);
      const taskFiles = task.allowedFiles || ['src/*.js'];
      const suggestedPath = task.type === 'test' ? 'test/test_file.test.js' : (taskFiles[0] || 'src/file.js').replace(/\*\*/g, '').replace(/\*/g, 'example');
      const retryPrompt = `You are a ${this.#role} agent. Your task is:\n${task.prompt || task.name}\n\n` +
        `${contextBlock}\n\nSTOP REASONING. DO NOT ANALYZE. DO NOT THINK.\n` +
        `You MUST output a JSON array with a "write" action containing FULL file content.\n` +
        `Include ALL necessary import statements at the top of the file content.\n` +
        `NEVER import JS built-in globals (Map, Set, Array, Promise, Date, console, Buffer, etc.).\n` +
        `Use proper multi-line formatting (newlines as \\n).\n` +
        `Format: [{"type": "write", "path": "${suggestedPath}", "content": "import ...\\n// full code here"}]\n` +
        `Output the JSON array NOW, then:\n---SUMMARY---\nDone.\n---END---`;
      try {
        const retryResponse = await callLLMWithRetry(this.#systemPrompt, retryPrompt, llmMaxTokens, { responseFormat: 'json' }, llmParams);
        const retryParsed = parseResponse(retryResponse, this.#tools, this.#logger);
        if (retryParsed.actions.some(a => ['write', 'edit', 'diff'].includes(a.type))) {
          actions = retryParsed.actions; summary = retryParsed.summary;
          this.#logger.info(`Retry succeeded: ${actions.length} action(s)`);
        }
      } catch (err) { this.#logger.info(`Retry LLM call failed: ${err.message}`); }
    }

    // 6. Execute actions (with error feedback retry)
    const execOpts = { logger: this.#logger, bashSafety: this.#bashSafety, incrementalEdit: this.#incrementalEdit, tools: this.#tools };
    const executionErrors = [];
    for (const action of actions) {
      try {
        const result = await executeAction(action, projectRoot, task, execOpts);
        if (result.modified) filesModified.push(result);
      } catch (err) {
        this.#logger.error(` Action failed: ${action.type} ${action.path}: ${err.message}`);
        executionErrors.push({ action, error: err.message });
      }
    }

    // 6b. Error feedback retry
    if (executionErrors.length > 0 && isMutation && filesModified.length < actions.filter(a => ['write', 'edit', 'diff'].includes(a.type)).length) {
      const maxRetries = 2;
      for (let retry = 0; retry < maxRetries; retry++) {
        const errorReport = executionErrors.map(e => `- ${e.action.type}(${e.action.path || e.action.command?.slice(0, 40) || 'N/A'}): ${e.error}`).join('\n');
        this.#logger.info(`Error feedback retry (${retry + 1}/${maxRetries}): ${executionErrors.length} error(s)`);
        const errorFiles = [...new Set(executionErrors.map(e => e.action.path).filter(Boolean))];
        let currentFileStates = '';
        for (const fp of errorFiles) {
          try { const content = await readFile(resolve(projectRoot, fp), 'utf-8'); currentFileStates += `\n### ${fp} (current content)\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\`\n`; } catch { /* file may not exist yet */ }
        }
        const fixPrompt = `${contextBlock}\n\n## Your Task\n${task.prompt || task.name}\n\n` +
          `## PREVIOUS ATTEMPT FAILED\nYour previous output produced these errors:\n${errorReport}\n\n` +
          `${currentFileStates ? `## Current File States\n${currentFileStates}\n` : ''}` +
          `## FIX INSTRUCTIONS\nOutput a JSON array with corrected "write" actions. Use the FULL file content (with all imports).\n` +
          `IMPORTANT:\n- The "content" field MUST be a plain string (not an object or number).\n` +
          `- Escape all newlines as \\n, all tabs as \\t, all quotes as \\".\n` +
          `- NEVER import JS built-in globals (Map, Set, Array, Promise, console, Buffer, etc.).\n` +
          `- Use proper multi-line code formatting.\n\n` +
          `Format: [{"type": "write", "path": "src/file.js", "content": "full file content as string"}]\n` +
          `---SUMMARY---\nFixed previous errors.\n---END---`;
        try {
          const retryResponse = await callLLMWithRetry(this.#systemPrompt, fixPrompt, llmMaxTokens, { responseFormat: 'json' }, llmParams);
          const retryParsed = parseResponse(retryResponse, this.#tools, this.#logger);
          const retryWrites = retryParsed.actions.filter(a => ['write', 'edit', 'diff'].includes(a.type));
          if (retryWrites.length > 0) {
            const newErrors = [];
            for (const ra of retryWrites) {
              try {
                const result = await executeAction(ra, projectRoot, task, execOpts);
                if (result.modified) {
                  const idx = filesModified.findIndex(f => f.path === ra.path);
                  if (idx >= 0) filesModified[idx] = result; else filesModified.push(result);
                }
              } catch (err) { newErrors.push({ action: ra, error: err.message }); this.#logger.error(` Retry action failed: ${ra.type} ${ra.path}: ${err.message}`); }
            }
            if (newErrors.length === 0) { executionErrors.length = 0; this.#logger.info(`Error feedback retry succeeded: all actions completed`); break; }
            executionErrors.length = 0; executionErrors.push(...newErrors);
          }
        } catch (err) { this.#logger.info(`Error feedback retry LLM call failed: ${err.message}`); }
      }
    }

    // Report remaining errors
    if (executionErrors.length > 0) {
      const errorMsg = executionErrors.map(e => `${e.action.type}(${e.action.path}): ${e.error}`).join('; ');
      if (filesModified.length === 0) {
        if (this.#memoryEngine) {
          this.#memoryEngine.remember(`Task "${task.name || task.id}" (${task.type}) FAILED: ${errorMsg}`, { type: MemoryType.ERROR, tags: [task.type || 'task', 'failure'], importance: 85 });
        }
        return { success: false, output: `All actions failed: ${errorMsg}`, filesModified: [], error: errorMsg, summary, tokenUsage: this.#tokenUsage };
      }
      return { success: true, output: `${summary || 'Partial success'} | Errors: ${errorMsg}`, filesModified, toolCalls: actions.length, warnings: executionErrors.map(e => e.error), tokenUsage: this.#tokenUsage };
    }

    if (isMutation && actions.length === 0) {
      return { success: false, output: `LLM returned no executable actions. Response preview: ${llmResponse.slice(0, 500)}`, filesModified: [], error: 'No actions produced by LLM for a mutation task', summary, tokenUsage: this.#tokenUsage };
    }
    if (isMutation && filesModified.length === 0) {
      return { success: false, output: `LLM returned ${actions.length} actions but none modified any files.`, filesModified: [], error: 'Mutation task produced no file changes', summary, tokenUsage: this.#tokenUsage };
    }

    // Store task results in memory engine
    if (this.#memoryEngine) {
      const memContent = `Task "${task.name || task.id}" (${task.type}): succeeded. ${summary || ''} Files: ${filesModified.join(', ') || 'none'}`;
      this.#memoryEngine.remember(memContent, { type: MemoryType.ACTION, tags: [task.type || 'task', ...(filesModified.length > 0 ? ['modified'] : [])], importance: 70 });
    }

    // P7: Record prompt metric in registry
    if (this.#promptRegistry) {
      const activePrompt = this.#promptRegistry.getActive(this.#role);
      if (activePrompt) {
        this.#promptRegistry.recordMetric(this.#role, activePrompt.version, {
          taskId: task.id, success: true, tokenUsage: this.#tokenUsage.totalTokens || 0, duration: 0, quality: filesModified.length > 0 ? 80 : 50,
        });
      }
    }

    // P11-2: Iterative refinement
    let refinementResult = null;
    let qualityGateResult = null;
    const refinableTypes = new Set(['implement', 'refactor']);
    if (this.#iterativeRefiner && refinableTypes.has(task.type) && filesModified.length > 0) {
      this.#logger.info(`P11-2: Running iterative refinement on ${filesModified.length} modified file(s)...`);
      try {
        let combinedCode = '';
        for (const fm of filesModified.slice(0, 5)) {
          const fp = fm.path || fm;
          if (typeof fp !== 'string') continue;
          try { const content = await readFile(resolve(projectRoot, fp), 'utf-8'); combinedCode += `\n// --- ${fp} ---\n${content}\n`; } catch { /* skip */ }
        }
        if (combinedCode.trim().length > 0) {
          const llmCaller = async (prompt, systemPrompt, options) => {
            return await callLLMWithRetry(systemPrompt, prompt, options?.maxTokens || 8192, options?.responseFormat ? { responseFormat: options.responseFormat } : {}, llmParams);
          };
          const refineTask = { prompt: task.prompt || task.name || '', context: contextBlock.slice(0, 4000), expectedFiles: filesModified.map(fm => fm.path || fm).filter(Boolean), constraints: task.constraints || [] };
          refinementResult = await this.#iterativeRefiner.refine(refineTask, llmCaller);
          this.#logger.info(`P11-2: Refinement complete — ${refinementResult.passes} pass(es), score: ${refinementResult.finalScore}, converged: ${refinementResult.converged}`);
        }
      } catch (err) { this.#logger.info(`P11-2: Iterative refinement failed: ${err.message}`); }
    }

    // P11-2: Quality gate
    if (this.#qualityGate && filesModified.length > 0) {
      try {
        for (const fm of filesModified.slice(0, 5)) {
          const fp = fm.path || fm;
          if (typeof fp !== 'string') continue;
          try {
            const content = await readFile(resolve(projectRoot, fp), 'utf-8');
            const gateResult = await this.#qualityGate.evaluate(content, { ...task, expectedFiles: [fp] });
            if (!gateResult.passed) {
              qualityGateResult = qualityGateResult || { blockingIssues: [], warnings: [], files: [] };
              qualityGateResult.blockingIssues.push(...gateResult.blockingIssues.map(b => `${fp}: ${b}`));
              qualityGateResult.warnings.push(...gateResult.warnings.map(w => `${fp}: ${w}`));
              qualityGateResult.files.push({ path: fp, score: gateResult.score, passed: gateResult.passed });
              this.#logger.info(`P11-2: Quality gate FAILED for ${fp} (score: ${gateResult.score}): ${gateResult.blockingIssues.join('; ')}`);
            } else { this.#logger.info(`P11-2: Quality gate passed for ${fp} (score: ${gateResult.score})`); }
          } catch { /* skip */ }
        }
      } catch (err) { this.#logger.info(`P11-2: Quality gate evaluation failed: ${err.message}`); }
    }

    // 7. Self-review: validate modified files
    let selfReviewResult = { valid: true, issues: [], autoFixed: 0 };
    const writeEditActions = actions.filter(a => ['write', 'edit', 'diff'].includes(a.type));
    if (filesModified.length > 0 && writeEditActions.length > 0) {
      selfReviewResult = await selfReview(projectRoot, filesModified);
      if (!selfReviewResult.valid && selfReviewResult.issues.length > 0) {
        this.#logger.info(`Self-review found ${selfReviewResult.issues.length} issue(s), attempting LLM-driven fix...`);
        let fileContext = '';
        const issueFiles = [...new Set(selfReviewResult.issues.map(i => i.file))];
        for (const fp of issueFiles.slice(0, 5)) {
          try { const content = await readFile(resolve(projectRoot, fp), 'utf-8'); fileContext += `\n### ${fp} (current content)\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\`\n`; } catch { /* skip */ }
        }
        const issueReport = selfReviewResult.issues.map(i => `- ${i.type.toUpperCase()} in ${i.file}: ${i.error}`).join('\n');
        const reviewFixPrompt = `${contextBlock}\n\n## SELF-REVIEW VALIDATION FAILURES\n` +
          `Your code changes have the following validation issues:\n${issueReport}\n\n${fileContext}\n` +
          `## FIX INSTRUCTIONS\nOutput a JSON array with corrected "edit" or "write" actions to fix ONLY the issues listed above.\n` +
          `Make minimal, targeted changes. Do NOT rewrite unrelated code.\nInclude ALL import statements in any "write" action.\n` +
          `Format: [{"type": "edit", "path": "src/file.js", "oldString": "...", "newString": "..."}]\n---SUMMARY---\nFixed validation issues.\n---END---`;
        try {
          const fixResponse = await callLLMWithRetry(this.#systemPrompt, reviewFixPrompt, llmMaxTokens, { responseFormat: 'json' }, llmParams);
          const fixParsed = parseResponse(fixResponse, this.#tools, this.#logger);
          const fixActions = fixParsed.actions.filter(a => ['write', 'edit', 'diff'].includes(a.type));
          if (fixActions.length > 0) {
            for (const fa of fixActions) {
              try { await executeAction(fa, projectRoot, task, execOpts); } catch (fixErr) { this.#logger.info(`Self-review fix action failed: ${fa.type} ${fa.path}: ${fixErr.message}`); }
            }
            selfReviewResult = await selfReview(projectRoot, filesModified);
            this.#logger.info(`Self-review after LLM fix: valid=${selfReviewResult.valid}, issues=${selfReviewResult.issues.length}, autoFixed=${selfReviewResult.autoFixed}`);
          }
        } catch (fixErr) { this.#logger.info(`Self-review LLM fix call failed: ${fixErr.message}`); }
      } else { this.#logger.info(`Self-review passed: valid=${selfReviewResult.valid}, autoFixed=${selfReviewResult.autoFixed}`); }
    }

    return {
      success: true, output: summary || llmResponse, filesModified, toolCalls: actions.length,
      tokenUsage: this.#tokenUsage, selfReview: selfReviewResult, refinement: refinementResult || undefined, qualityGate: qualityGateResult || undefined,
    };
  }

  /** Execute a task with streaming LLM output. */
  async executeWithStream(task, options = {}) {
    const onProgress = options.onProgress || (() => {});
    this.#tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: 0 };
    const projectRoot = options.projectRoot || process.cwd();
    const engines = {
      contextEngine: this.#contextEngine, memoryEngine: this.#memoryEngine,
      semanticMemory: this.#semanticMemory, crossSessionMemory: this.#crossSessionMemory,
    };
    const relevantFiles = await gatherFiles(projectRoot, task.allowed_files || task.allowedFiles, task.type, {
      knowledgeGraph: this.#knowledgeGraph, injectionDefense: this.#injectionDefense,
    });
    const contextBlock = buildContextBlock(relevantFiles, options.context || {}, engines);
    const extraContext = await this._getExtraContext(projectRoot, task);
    const prompt = buildPrompt(task, contextBlock, extraContext, {
      tools: this.#tools, role: this.#role, errorPatternLearner: this.#errorPatternLearner,
    });
    this.#logger.info(`[${this.#role}] Streaming task: ${task.id || task.type}`);
    try {
      let fullText = '';
      const result = await callLLMStream(this.#systemPrompt, prompt, {
        temperature: task.temperature ?? 0.2, maxTokens: task.maxTokens ?? 4096, goalId: task.goalId,
        onChunk: (delta) => { fullText += delta; onProgress(delta); },
      });
      const { actions, summary } = parseResponse(result.text, this.#tools, this.#logger);
      let filesModified = [];
      const execOpts = { logger: this.#logger, bashSafety: this.#bashSafety, incrementalEdit: this.#incrementalEdit, tools: this.#tools };
      for (const action of actions) {
        try { const r = await executeAction(action, projectRoot, task, execOpts); if (r.modified) filesModified.push(r); }
        catch (err) { this.#logger.error(`[${this.#role}] Stream action failed: ${err.message}`); }
      }
      if (result.usage) { this.#tokenUsage.totalTokens = (this.#tokenUsage.totalTokens || 0) + (result.usage.totalTokens || 0); }
      return { taskId: task.id, status: 'completed', text: result.text, filesModified, summary, usage: result.usage, streaming: true };
    } catch (err) {
      this.#logger.error(`[${this.#role}] Stream execution failed: ${err.message}`);
      return { taskId: task.id, status: 'failed', error: err.message, streaming: true };
    }
  }

  /** Subclass hook: return extra context to append to the user prompt. */
  async _getExtraContext(_projectRoot, _task) { return ''; }
}
