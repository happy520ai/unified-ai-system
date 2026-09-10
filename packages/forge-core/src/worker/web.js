import { BaseWorker } from './base.js';

/** Web actions require the private runtime bound to the approved root request. */
export class WebWorker extends BaseWorker {
  constructor(opts = {}) {
    super({ role: 'web', systemPrompt: 'Execute the approved bounded webpage task.', tools: ['web'] });
    this._webOpts = opts;
  }

  async execute(task, _projectRoot, context = {}) {
    const webTask = context.governedExecution?.webTask;
    if (context.governanceRequired !== true || typeof webTask?.execute !== 'function'
      || task.id !== webTask.taskId) {
      return { success: false, error: 'FORGE_WEB_GOVERNED_PROFILE_REQUIRED',
        output: 'Web execution requires an approved server-owned profile.', filesModified: [],
        tokenUsage: { inputTokens: null, outputTokens: null, totalTokens: null, llmCalls: 0 } };
    }
    context.signal?.throwIfAborted();
    return webTask.execute(task, { signal: context.signal });
  }

  // Keep existing setters source-compatible; these never authorize a browser.
  setGenerate(fn) { this._webOpts.generate = fn; }
  setTierCaps(caps) { this._webOpts.tierCaps = caps; }
}
