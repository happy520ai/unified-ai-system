/**
 * Web Worker — drives browser automation via the web-agent package.
 *
 * Unlike CoderWorker/TesterWorker (which operate on project FILES), the WebWorker
 * operates on LIVE WEB PAGES. Its execute() path is fundamentally different:
 *
 *   1. The task prompt becomes the "operation manual" (or is interpreted as a goal)
 *   2. Launch Chromium via the web-agent's browserLauncher
 *   3. Run the web-agent's perceive-decide-act loop against the target URL
 *   4. Return extracted data / operation results as the task output
 *
 * The WebWorker is registered in the agent pool with role 'web' and tool 'web'.
 * The orchestrator routes web-operation tasks (type 'web' or 'scrape') to it.
 *
 * Integration with web-agent package:
 *   - Uses createWebAgent() from packages/web-agent/src/webAgent.js
 *   - Uses launchBrowser() from packages/web-agent/src/browserLauncher.js
 *   - The LLM brain uses a generate() function injected at construction time
 *     (so the WebWorker uses the SAME provider as the rest of forge-core)
 */

import { BaseWorker } from './base.js';

// Dynamic import of the web-agent package (sibling package in the monorepo).
// We import lazily so forge-core doesn't hard-depend on playwright being installed
// at module load time — only when a WebWorker actually executes.
let _webAgentModules = null;
async function loadWebAgent() {
  if (_webAgentModules) return _webAgentModules;
  try {
    _webAgentModules = {
      createWebAgent: (await import('../../../web-agent/src/webAgent.js')).createWebAgent,
      launchBrowser: (await import('../../../web-agent/src/browserLauncher.js')).launchBrowser,
      parseManual: (await import('../../../web-agent/src/manualParser.js')).parseManual,
      recognizeModules: (await import('../../../web-agent/src/moduleRecognizer.js')).recognizeModules,
    };
  } catch {
    // Fallback: try the package name resolution
    _webAgentModules = {
      createWebAgent: (await import('@unified-ai-system/web-agent')).createWebAgent,
      launchBrowser: (await import('@unified-ai-system/web-agent')).launchBrowser,
      parseManual: (await import('@unified-ai-system/web-agent')).parseManual,
      recognizeModules: (await import('@unified-ai-system/web-agent')).recognizeModules,
    };
  }
  return _webAgentModules;
}

export class WebWorker extends BaseWorker {
  /**
   * @param {object} [opts]
   * @param {Function} [opts.generate] — LLM generate function for the web-agent brain.
   *        If not provided, the web-agent will use its own default (which requires
   *        a provider to be configured separately).
   * @param {object} [opts.tierCaps] — autonomy tier caps (controls allowed actions)
   * @param {string} [opts.providerId] — LLM provider for web-agent decisions
   * @param {string} [opts.modelId] — LLM model for web-agent decisions
   */
  constructor(opts = {}) {
    super({
      role: 'web',
      systemPrompt: `You are the Forge Web Worker — a browser automation agent that operates live web pages.

Your job is to complete web-operation tasks: navigate websites, fill forms, click buttons, extract data, and follow operation manuals.

You receive a task with a goal (natural language) and optionally a start URL + operation manual. You drive the web-agent engine to perceive web pages, decide actions, and execute them.

Output format: return a summary of what was accomplished, plus any extracted data.`,
      tools: ['web'],
    });
    this._webOpts = opts;
  }

  /**
   * Execute a web-operation task.
   *
   * Overrides BaseWorker.execute() entirely because web tasks don't follow the
   * file-based action model. Instead:
   *   - task.prompt → operation manual (or goal for the web-agent)
   *   - task.url or task.startUrl → target URL
   *   - task.manual → explicit operation manual (markdown or JSON)
   *   - task.headless → show/hide browser (default false = visible)
   *
   * @returns {Promise<{success, output, filesModified: [], toolCalls, extracted, tier}>}
   */
  async execute(task, _projectRoot, _context = {}) {
    const { launchBrowser, createWebAgent, recognizeModules } = await loadWebAgent();

    // Determine the operation parameters from the task
    const startUrl = task.url || task.startUrl || task.targetUrl;
    const manual = task.manual || task.prompt || task.name;
    const headless = task.headless ?? false; // visible by default — user can watch
    const goal = task.name || task.prompt?.slice(0, 100) || 'web operation';

    if (!startUrl && !manual) {
      return {
        success: false,
        output: 'Web task requires either a url or a manual/prompt.',
        filesModified: [],
        error: 'missing_url_or_manual',
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: 0 },
      };
    }

    // If only a URL is given (no manual), do a perceive-only operation first
    if (startUrl && !manual) {
      return await this._perceiveOnly(startUrl, headless, goal);
    }

    // Full run: manual + URL
    try {
      const browser = await launchBrowser({ headless });
      const agent = createWebAgent({
        browser,
        generate: this._webOpts.generate || (async () => ({ message: { content: '' } })),
        tierCaps: this._webOpts.tierCaps || { autonomyMode: 'sandbox-merge' },
        providerId: this._webOpts.providerId,
        modelId: this._webOpts.modelId,
        limits: task.limits,
      });

      const result = await agent.run({
        manual,
        startUrl,
        headless,
      });

      return {
        success: result.success,
        output: result.success
          ? `Web operation completed: ${result.stepsCompleted}/${result.stepsTotal} steps, ${result.actionsTotal} actions.`
          : `Web operation partially completed: ${result.stepsCompleted}/${result.stepsTotal} steps.`,
        filesModified: [], // web workers don't modify project files
        toolCalls: result.actionsTotal,
        extracted: result.extracted,
        trace: result.trace,
        webResult: result,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: result.actionsTotal },
      };
    } catch (err) {
      return {
        success: false,
        output: `Web operation failed: ${err.message}`,
        filesModified: [],
        error: err.message,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: 0 },
      };
    }
  }

  /**
   * Perceive-only mode: just recognize all modules on a URL and return them.
   * Used when the task has a URL but no explicit operation manual.
   */
  async _perceiveOnly(url, headless, goal) {
    const { launchBrowser, recognizeModules } = await loadWebAgent();
    try {
      const browser = await launchBrowser({ headless });
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const snapshot = await recognizeModules(page, { maxModules: 200 });
      await context.close().catch(() => {});

      return {
        success: true,
        output: `Perceived ${snapshot.moduleCount} modules on ${url}: ${JSON.stringify(snapshot.stats)}`,
        filesModified: [],
        toolCalls: 1,
        extracted: [{ step: 0, mid: null, text: JSON.stringify(snapshot, null, 2) }],
        webSnapshot: snapshot,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: 0 },
      };
    } catch (err) {
      return {
        success: false,
        output: `Perceive failed: ${err.message}`,
        filesModified: [],
        error: err.message,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: 0 },
      };
    }
  }

  /**
   * Set the LLM generate function (for late binding after construction).
   */
  setGenerate(fn) {
    this._webOpts.generate = fn;
  }

  /**
   * Set tier caps (for autonomy mode control).
   */
  setTierCaps(caps) {
    this._webOpts.tierCaps = caps;
  }
}
