/**
 * Helper functions and constants for SelfLoopEngine.
 * Extracted to keep index.js under 500 lines per Layering Law (分层律).
 */

/**
 * Decision types returned by the self-loop engine.
 */
export const Decision = Object.freeze({
  ACCEPT: 'ACCEPT',
  ADJUST_RETRY: 'ADJUST_RETRY',
  ROLLBACK_RETRY: 'ROLLBACK_RETRY',
  ESCALATE: 'ESCALATE',
  EXHAUSTED: 'EXHAUSTED',
});

/** Maximum self-loop iterations per task (prevents infinite loops) */
export const MAX_LOOPS = 4;

/** Default verification tier to start with */
export const DEFAULT_TIER = 2;

/** 错误循环的最大尝试次数(独立于验证循环) */
export const MAX_ERROR_LOOPS = 3;

/** 错误类型 → 推荐策略映射 */
export const ERROR_STRATEGY_MAP = {
  timeout: 'increase_timeout',
  rate_limit: 'backoff_and_retry',
  auth_error: 'escalate_to_human',
  network: 'retry_with_backoff',
  parse_error: 'simplify_and_retry',
  unknown: 'targeted_fix',
};

/**
 * Classify failures into categories for targeted adjustments.
 * @param {Array} failures
 * @returns {Set<string>}
 */
export function classifyFailures(failures) {
  const types = new Set();
  for (const f of (failures || [])) {
    const name = (f.checkName || f.name || '').toLowerCase();
    const output = (f.output || '').toLowerCase();
    const tier = f.tier || 0;

    if (name.includes('syntax') || name.includes('eslint') || name.includes('lint') || tier === 1) {
      types.add('lint');
      if (output.includes('syntax')) types.add('syntax');
    }
    if (name.includes('test') || tier === 2) {
      types.add('test_failure');
      if (output.includes('assert') || output.includes('expected')) types.add('assertion');
    }
    if (name.includes('integration') || tier === 3) {
      types.add('integration');
    }
    if (output.includes('runtime') || output.includes('referenceerror') || output.includes('typeerror')) {
      types.add('runtime');
    }
    if (output.includes('cannot find module') || output.includes('enoent')) {
      types.add('missing_module');
    }
  }
  if (types.size === 0) types.add('unknown');
  return types;
}

/**
 * Build a human-readable hint from failures for the retry prompt.
 * @param {Array} failures
 * @param {Set<string>} failureTypes
 * @returns {string}
 */
export function buildFailureHint(failures, failureTypes) {
  const lines = ['## Verification Failures to Fix'];
  for (const f of (failures || [])) {
    const tierName = f.tierName || `Tier ${f.tier || '?'}`;
    const checkName = f.checkName || f.name || 'Unknown';
    const output = (f.output || '').slice(0, 500);
    lines.push(`\n### ${tierName} / ${checkName}`);
    if (f.file) lines.push(`File: ${f.file}`);
    if (output) lines.push(`\`\`\`\n${output}\n\`\`\``);
  }

  if (failureTypes.has('syntax')) {
    lines.push('\n**Hint**: Syntax errors detected. Check bracket matching and import statements.');
  }
  if (failureTypes.has('missing_module')) {
    lines.push('\n**Hint**: Missing module errors. Verify all import paths are correct and files exist.');
  }
  if (failureTypes.has('assertion')) {
    lines.push('\n**Hint**: Test assertions are failing. Read the test file to understand expected behavior, then fix the implementation.');
  }

  return lines.join('\n');
}

/**
 * 分类错误类型
 * @param {string} errorMsg
 * @returns {string}
 */
export function classifyError(errorMsg) {
  const msg = (errorMsg || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline')) return 'timeout';
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) return 'rate_limit';
  if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('401') || msg.includes('api key')) return 'auth_error';
  if (msg.includes('network') || msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('fetch failed')) return 'network';
  if (msg.includes('json') && (msg.includes('parse') || msg.includes('unexpected'))) return 'parse_error';
  return 'unknown';
}

/**
 * Build adjusted parameters for the next retry based on failure patterns.
 * Pure function — no `this` dependency.
 *
 * @param {object} context
 * @param {string} context.taskType — 'implement', 'test', 'refactor', 'debug'
 * @param {Array} context.failures — verification failures
 * @param {number} context.loopCount — current loop iteration (0-based)
 * @param {string} context.previousStrategy — what was tried last
 * @returns {{ promptHints: string, maxTokens: number, responseFormat: string, workerType: string|null }}
 */
export function computeAdjustments({ taskType, failures, loopCount, previousStrategy }) {
  const adjustments = {
    promptHints: '',
    maxTokens: 32768,
    responseFormat: 'json',
    workerType: null,  // null = same worker, string = escalate to different worker
  };

  // Analyze failure patterns
  const failureTypes = classifyFailures(failures);

  // Loop-count-based escalation
  if (loopCount === 0) {
    // First retry: minimal hints, focus on the specific failures
    adjustments.promptHints = buildFailureHint(failures, failureTypes);
  } else if (loopCount === 1) {
    // Second retry: stricter constraints + more examples
    adjustments.promptHints = buildFailureHint(failures, failureTypes) +
      '\n\n## STRICT RULES (Previous attempts failed)\n' +
      '- Double-check ALL import statements before writing.\n' +
      '- Verify bracket matching: every { needs }, every ( needs ).\n' +
      '- Use "write" (full file) instead of "edit" to avoid whitespace mismatches.\n' +
      '- Read the file FIRST, then write the COMPLETE corrected content.\n';
  } else if (loopCount >= 2) {
    // Third+ retry: escalate strategy
    adjustments.promptHints = buildFailureHint(failures, failureTypes) +
      '\n\n## CRITICAL: Multiple previous attempts have failed.\n' +
      '- You MUST read every file you plan to modify BEFORE writing.\n' +
      '- Output the MINIMUM changes needed to fix the failures.\n' +
      '- If a test is failing, read the test file to understand what it expects.\n' +
      '- Use "edit" for small targeted fixes; "write" only for new files.\n';

    // Escalate to debugger worker if syntax/semantic errors persist
    if (failureTypes.has('syntax') || failureTypes.has('runtime')) {
      adjustments.workerType = 'debugger';
    }
  }

  // Failure-type specific adjustments
  if (failureTypes.has('test_failure') && taskType !== 'test') {
    adjustments.promptHints += '\n- Tests are failing. Focus on making the implementation match test expectations.\n';
  }
  if (failureTypes.has('lint')) {
    adjustments.promptHints += '\n- Fix ALL linting errors. Run `npx eslint --fix` style corrections.\n';
  }

  return adjustments;
}

/**
 * 根据错误类型计算调整参数
 * @param {string} errorType
 * @param {object} result
 * @param {number} loopCount
 * @param {object} context
 * @returns {object}
 */
export function computeErrorAdjustments(errorType, result, loopCount, context) {
  const base = {
    promptHints: '',
    timeoutMs: context.timeoutMs || 30000,
    retryCount: loopCount,
    workerType: context.workerType || 'coder',
  };

  switch (errorType) {
    case 'timeout':
      base.timeoutMs = Math.min(120000, (context.timeoutMs || 30000) * (loopCount + 1) * 1.5);
      base.promptHints = '\n## Error Context\nPrevious attempt timed out. Consider simplifying the task or breaking it into smaller steps.';
      break;
    case 'rate_limit':
      base.promptHints = '\n## Error Context\nRate limited. Retrying after backoff.';
      break;
    case 'network':
      base.promptHints = '\n## Error Context\nNetwork error occurred. Ensure external dependencies are reachable.';
      break;
    case 'parse_error':
      base.promptHints = '\n## Error Context\nOutput parsing failed. Ensure output is valid JSON and matches the expected schema.';
      base.workerType = 'debugger';
      break;
    default:
      base.promptHints = `\n## Error Context\n${(result.error || result.message || '').slice(0, 500)}`;
      break;
  }

  return base;
}

/**
 * Create a file-level snapshot before mutation.
 * Converted from SelfLoopEngine.#snapshotBefore to standalone function.
 *
 * @param {string} projectRoot
 * @param {string[]} filePaths — relative paths to snapshot
 * @returns {{ snapshotId: string, files: Map<string, string|null>, createdAt: number }}
 */
export async function createSnapshot(projectRoot, filePaths) {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const files = new Map();

  const reads = await Promise.allSettled(
    filePaths.map(async (fp) => {
      const fullPath = join(projectRoot, fp);
      try {
        const content = await readFile(fullPath, 'utf-8');
        return { path: fp, content };
      } catch (err) {
        if (err.code === 'ENOENT') {
          return { path: fp, content: null };
        }
        throw err;
      }
    })
  );

  for (const r of reads) {
    if (r.status === 'fulfilled') {
      files.set(r.value.path, r.value.content);
    }
  }

  return { snapshotId, files, createdAt: Date.now() };
}

/**
 * Restore files to their pre-mutation state from a snapshot.
 * Converted from SelfLoopEngine.#rollback to standalone function.
 *
 * @param {object} snapshot — returned by createSnapshot()
 * @param {string} root — project root path
 * @returns {{ restored: number, deleted: number, errors: string[] }}
 */
export async function restoreSnapshot(snapshot, root) {
  const { writeFile, mkdir, unlink } = await import('node:fs/promises');
  const { join, dirname } = await import('node:path');
  let restored = 0;
  let deleted = 0;
  const errors = [];

  for (const [filePath, originalContent] of snapshot.files) {
    const fullPath = join(root, filePath);
    try {
      if (originalContent === null) {
        try {
          await unlink(fullPath);
          deleted++;
        } catch (unlinkErr) {
          if (unlinkErr.code !== 'ENOENT') {
            errors.push(`Failed to delete ${filePath}: ${unlinkErr.message}`);
          }
        }
      } else {
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, originalContent, 'utf-8');
        restored++;
      }
    } catch (err) {
      errors.push(`Rollback failed for ${filePath}: ${err.message}`);
    }
  }

  return { restored, deleted, errors };
}
