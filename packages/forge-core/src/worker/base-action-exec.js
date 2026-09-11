/**
 * Action execution engine extracted from BaseWorker.
 *
 * Handles the execution of individual LLM-generated actions (write, edit, diff,
 * bash, read) with safety checks, path validation, syntax verification, and
 * auto-fix. Also exports the helper functions for path matching, import
 * validation, and fuzzy edit matching.
 */

import { readFile, open, mkdir, stat, readdir, access, lstat, realpath } from 'node:fs/promises';
import { constants as fsConstants, existsSync } from 'node:fs';
import { resolve, dirname, extname, relative, join, sep } from 'node:path';
import { matchGlob } from './glob.js';
import { validateJsSyntax, tryFixSyntax, autoLint } from './base-syntax-utils.js';

/**
 * Trusted per-action governance contract for Forge workers. Standalone Forge
 * remains development-compatible only when governanceRequired is false.
 */
export const FORGE_ACTION_TOOL_NAMES = Object.freeze({
  read: 'file_read',
  write: 'file_write',
  edit: 'file_edit',
  // Forge `diff` applies a structured patch and writes the file. It must use
  // the write-capable file_edit lane, never the read-only git_diff lane.
  diff: 'file_edit',
  bash: 'shell_exec',
});

export function createForgeExecutionError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

export function throwIfForgeAborted(signal) {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  const message = reason instanceof Error
    ? reason.message
    : (typeof reason === 'string' && reason ? reason : 'Forge execution was aborted.');
  const error = createForgeExecutionError('FORGE_RUN_ABORTED', message);
  error.name = 'AbortError';
  if (reason instanceof Error) error.cause = reason;
  throw error;
}

export function isForgeAbortError(error, signal) {
  return signal?.aborted === true
    || error?.code === 'FORGE_RUN_ABORTED'
    || error?.name === 'AbortError';
}

function cloneGovernedValue(value) {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      throw createForgeExecutionError(
        'FORGE_ACTION_PARAMS_INVALID',
        'Forge action parameters must be structured-cloneable.',
      );
    }
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function requireRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createForgeExecutionError(
      'FORGE_APPROVED_PARAMS_INVALID',
      'Governance approvedParams must be an object.',
    );
  }
  return value;
}

function requireString(record, key, { allowEmpty = false } = {}) {
  const value = record[key];
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw createForgeExecutionError(
      'FORGE_APPROVED_PARAMS_INVALID',
      `Governance approvedParams.${key} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`,
    );
  }
  return value;
}

export function normalizeForgeWriteContent(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value || '');
}

/** Convert an LLM action into the canonical gateway Tool Proxy shape. */
export function createForgeActionGovernanceRequest({
  action,
  projectRoot,
  relativePath = '',
  resourcePath,
  task = {},
}) {
  const toolName = FORGE_ACTION_TOOL_NAMES[action?.type];
  if (!toolName) {
    throw createForgeExecutionError(
      'FORGE_ACTION_UNSUPPORTED',
      `Forge action type ${String(action?.type)} has no governed tool mapping.`,
    );
  }

  const canonicalRoot = resolve(projectRoot);
  const filePath = relativePath || '.';
  let params;
  switch (action.type) {
    case 'read':
      params = { file_path: filePath };
      break;
    case 'write':
      params = {
        file_path: filePath,
        content: normalizeForgeWriteContent(action.content),
        mode: 'overwrite',
      };
      break;
    case 'edit':
      params = {
        file_path: filePath,
        old_string: typeof action.oldString === 'string' ? action.oldString : String(action.oldString || ''),
        new_string: typeof action.newString === 'string' ? action.newString : String(action.newString || ''),
        allow_multiple: false,
      };
      break;
    case 'diff':
      params = {
        file_path: filePath,
        edits: cloneGovernedValue(action.edits),
        edit_mode: 'structured_diff',
      };
      break;
    case 'bash':
      params = {
        command: typeof action.command === 'string' ? action.command : String(action.command || ''),
        cwd: canonicalRoot,
        timeout_ms: Number.isFinite(Number(action.timeoutMs))
          ? Math.min(Math.max(Number(action.timeoutMs), 1), 60_000)
          : 60_000,
      };
      break;
    default:
      throw createForgeExecutionError('FORGE_ACTION_UNSUPPORTED', `Unsupported Forge action ${action.type}.`);
  }

  const resources = [...new Set([
    action.type === 'bash' ? canonicalRoot : filePath,
    resourcePath || canonicalRoot,
  ].filter(Boolean))];
  const resourceContext = {
    resourceKeys: {
      projectRoot: canonicalRoot,
      path: action.type === 'bash' ? canonicalRoot : filePath,
      canonicalPath: resourcePath || canonicalRoot,
      forgeAction: action.type,
    },
    resources,
  };
  const taskContext = {
    ...(task.id ? { taskId: String(task.id) } : {}),
    ...(task.goalId ? { goalId: String(task.goalId) } : {}),
    ...(task.type ? { taskType: String(task.type) } : {}),
    ...(task.agent_role || task.agentRole
      ? { agentRole: String(task.agent_role || task.agentRole) }
      : {}),
  };

  return deepFreeze({
    actionType: action.type,
    toolName,
    params: cloneGovernedValue(params),
    projectRoot: canonicalRoot,
    resourceContext,
    taskContext,
  });
}

/** Rebuild an action only from authenticated, approval-sealed parameters. */
export function applyApprovedForgeActionParams(actionType, approvedParams, projectRoot) {
  const record = requireRecord(approvedParams);
  switch (actionType) {
    case 'read':
      return { type: 'read', path: requireString(record, 'file_path') };
    case 'write': {
      const mode = record.mode ?? 'overwrite';
      if (mode !== 'overwrite') {
        throw createForgeExecutionError(
          'FORGE_APPROVED_PARAMS_INVALID',
          'Forge write approvals only support overwrite mode.',
        );
      }
      return {
        type: 'write',
        path: requireString(record, 'file_path'),
        content: requireString(record, 'content', { allowEmpty: true }),
      };
    }
    case 'edit':
      if (record.allow_multiple === true) {
        throw createForgeExecutionError(
          'FORGE_APPROVED_PARAMS_INVALID',
          'Forge edit approvals cannot enable allow_multiple.',
        );
      }
      return {
        type: 'edit',
        path: requireString(record, 'file_path'),
        oldString: requireString(record, 'old_string', { allowEmpty: true }),
        newString: requireString(record, 'new_string', { allowEmpty: true }),
      };
    case 'diff':
      if (!Array.isArray(record.edits)) {
        throw createForgeExecutionError(
          'FORGE_APPROVED_PARAMS_INVALID',
          'Governance approvedParams.edits must be an array.',
        );
      }
      if (record.edit_mode !== undefined && record.edit_mode !== 'structured_diff') {
        throw createForgeExecutionError(
          'FORGE_APPROVED_PARAMS_INVALID',
          'Forge diff approvals require edit_mode=structured_diff.',
        );
      }
      return {
        type: 'diff',
        path: requireString(record, 'file_path'),
        edits: cloneGovernedValue(record.edits),
      };
    case 'bash': {
      const canonicalRoot = resolve(projectRoot);
      if (record.cwd !== undefined && resolve(String(record.cwd)) !== canonicalRoot) {
        throw createForgeExecutionError(
          'FORGE_APPROVED_PARAMS_INVALID',
          'Governance-approved shell cwd must equal the Forge project root.',
        );
      }
      const timeout = record.timeout_ms === undefined ? 60_000 : Number(record.timeout_ms);
      if (!Number.isFinite(timeout) || timeout < 1 || timeout > 60_000) {
        throw createForgeExecutionError(
          'FORGE_APPROVED_PARAMS_INVALID',
          'Governance approvedParams.timeout_ms must be between 1 and 60000.',
        );
      }
      return {
        type: 'bash',
        command: requireString(record, 'command'),
        timeoutMs: timeout,
      };
    }
    default:
      throw createForgeExecutionError(
        'FORGE_ACTION_UNSUPPORTED',
        `Unsupported approved Forge action ${String(actionType)}.`,
      );
  }
}

export function readGovernanceOutcome(verdict) {
  return verdict?.outcome ?? verdict?.verdict ?? null;
}

function normalizeForPathComparison(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isWithinRoot(target, root) {
  const normalizedTarget = normalizeForPathComparison(target);
  const normalizedRoot = normalizeForPathComparison(root);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + sep);
}

/**
 * Resolve an action path through canonical existing parents and reject every
 * symlink/junction component. This closes static link escapes; callers repeat
 * the check after creating parent directories and immediately before writes.
 */
export async function resolveActionPath(projectRoot, actionPath = '') {
  const canonicalRoot = await realpath(resolve(projectRoot));
  const target = resolve(canonicalRoot, actionPath || '');
  if (!isWithinRoot(target, canonicalRoot)) {
    throw new Error(`Path traversal blocked: ${actionPath} resolves outside project root`);
  }

  const rel = relative(canonicalRoot, target);
  let cursor = canonicalRoot;
  for (const segment of rel.split(/[\\/]+/).filter(Boolean)) {
    cursor = join(cursor, segment);
    let entry;
    try {
      entry = await lstat(cursor);
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`Path traversal blocked: ${actionPath} contains a symlink or junction`);
    }
    const canonicalEntry = await realpath(cursor);
    if (!isWithinRoot(canonicalEntry, canonicalRoot)) {
      throw new Error(`Path traversal blocked: ${actionPath} resolves outside project root`);
    }
  }
  return target;
}

async function writeFileNoFollow(path, content) {
  const flags = fsConstants.O_WRONLY
    | fsConstants.O_CREAT
    | fsConstants.O_TRUNC
    | (fsConstants.O_NOFOLLOW ?? 0);
  const handle = await open(path, flags, 0o600);
  try {
    await handle.writeFile(content, 'utf8');
  } finally {
    await handle.close();
  }
}

/**
 * Execute a single action (write/edit/diff/bash/read) within the project.
 *
 * @param {object} action — the action object from LLM response
 * @param {string} projectRoot — absolute path to the project root
 * @param {object} task — the task being executed (for allowed_files)
 * @param {object} opts
 * @param {object} opts.logger — ForgeLogger instance
 * @param {object} opts.bashSafety — BashSafety instance
 * @param {object} opts.incrementalEdit — IncrementalEdit instance
 * @param {string[]} opts.tools — available tool names
 * @returns {Promise<object>} — action result
 */
export async function executeAction(action, projectRoot, task, opts = {}) {
  const {
    governedExecution = null,
    governanceRequired = false,
    signal,
  } = opts;
  throwIfForgeAborted(signal);

  const governable = Object.hasOwn(FORGE_ACTION_TOOL_NAMES, action?.type);
  const beforeAction = governedExecution?.beforeAction;
  if (governanceRequired && typeof beforeAction !== 'function') {
    throw createForgeExecutionError(
      'FORGE_ACTION_GOVERNANCE_REQUIRED',
      'Forge production-governed execution requires a server-owned beforeAction hook.',
    );
  }
  if (governedExecution && typeof beforeAction !== 'function') {
    throw createForgeExecutionError(
      'FORGE_ACTION_GOVERNANCE_INVALID',
      'The supplied governedExecution does not implement beforeAction.',
    );
  }
  if (!governable) {
    if (governanceRequired || governedExecution) {
      throw createForgeExecutionError(
        'FORGE_ACTION_UNSUPPORTED',
        `Forge action type ${String(action?.type)} cannot run through the governance hook.`,
      );
    }
    return executeActionBody(action, projectRoot, task, opts);
  }
  if (typeof beforeAction !== 'function') {
    // Development-only compatibility for direct/standalone Forge use.
    return executeActionBody(action, projectRoot, task, opts);
  }

  const prepared = await prepareActionPath(action, projectRoot, task, opts.logger);
  const request = createForgeActionGovernanceRequest({
    action: prepared.action,
    projectRoot: prepared.canonicalRoot,
    relativePath: prepared.relativePath,
    resourcePath: prepared.fullPath,
    task,
  });
  throwIfForgeAborted(signal);

  let authorization;
  try {
    authorization = await beforeAction(request);
  } catch (error) {
    throwIfForgeAborted(signal);
    if (error?.code) throw error;
    throw createForgeExecutionError(
      'FORGE_ACTION_GOVERNANCE_FAILED',
      `Forge governance hook failed closed: ${error?.message ?? String(error)}`,
    );
  }

  const outcome = readGovernanceOutcome(authorization);
  if (outcome !== 'allow') {
    try {
      authorization?.executionLease?.release?.();
    } finally {
      throw createForgeExecutionError(
        authorization?.code ?? 'FORGE_ACTION_NOT_ALLOWED',
        authorization?.reason
          ?? `Forge action ${request.toolName} was not allowed by governance (${outcome ?? 'missing verdict'}).`,
        { outcome, toolName: request.toolName },
      );
    }
  }

  if (!authorization?.policy || typeof authorization?.executionLease?.release !== 'function') {
    authorization?.executionLease?.release?.();
    throw createForgeExecutionError(
      'FORGE_ACTION_LEASE_REQUIRED',
      `Governance allowed ${request.toolName} without a verified policy and releasable per-action lease.`,
      { toolName: request.toolName },
    );
  }

  const actionLease = authorization?.executionLease;
  let effectiveRequest = request;
  let afterCalled = false;
  const invokeAfterAction = async ({ result, error }) => {
    if (typeof governedExecution?.afterAction !== 'function') return null;
    afterCalled = true;
    return governedExecution.afterAction({
      ...effectiveRequest,
      authorization,
      ...(error ? { error } : { result }),
    });
  };

  try {
    const effectiveAction = authorization?.approvedParams === undefined
      ? prepared.action
      : applyApprovedForgeActionParams(action.type, authorization.approvedParams, prepared.canonicalRoot);
    const effectivePrepared = authorization?.approvedParams === undefined
      ? prepared
      : await prepareActionPath(effectiveAction, projectRoot, task, opts.logger);
    effectiveRequest = createForgeActionGovernanceRequest({
      action: effectivePrepared.action,
      projectRoot: effectivePrepared.canonicalRoot,
      relativePath: effectivePrepared.relativePath,
      resourcePath: effectivePrepared.fullPath,
      task,
    });

    // The run signal is synchronous, so a revocation between the policy verdict
    // and the effect is observed immediately before the actual action body.
    throwIfForgeAborted(signal);
    await governedExecution?.assertActive?.('commit');
    await actionLease?.assertActive?.('commit');
    throwIfForgeAborted(signal);

    let result = await executeActionBody(effectivePrepared.action, projectRoot, task, opts);
    const afterResult = await invokeAfterAction({ result });
    if (afterResult && Object.hasOwn(afterResult, 'result')) result = afterResult.result;
    return result;
  } catch (error) {
    if (!afterCalled) {
      try {
        await invokeAfterAction({ error });
      } catch (afterError) {
        try { error.afterActionError = afterError; } catch { /* preserve original failure */ }
      }
    }
    throw error;
  } finally {
    actionLease?.release?.();
  }
}

async function prepareActionPath(action, projectRoot, task, logger = { info() {} }) {
  const preparedAction = { ...action };
  const canonicalRoot = await realpath(resolve(projectRoot));
  let relativePath = preparedAction.path || '';
  let fullPath = await resolveActionPath(projectRoot, relativePath);
  const mutatingActions = new Set(['write', 'edit', 'diff']);
  if (preparedAction.path && mutatingActions.has(preparedAction.type)) {
    const patterns = task.allowed_files || task.allowedFiles;
    if (!isAllowed(relativePath, patterns)) {
      const inferred = inferCorrectPath(relativePath, patterns);
      if (inferred && isAllowed(inferred, patterns)) {
        logger.info(`Path auto-corrected: ${relativePath} → ${inferred} (inferred subdirectory prefix)`);
        preparedAction.path = inferred;
        relativePath = inferred;
        fullPath = await resolveActionPath(projectRoot, inferred);
      } else {
        logger.info(`BLOCKED: ${relativePath} not in patterns: ${JSON.stringify(patterns?.slice?.(0, 5) || patterns)}`);
        throw new Error(`File ${relativePath} is not in allowed patterns`);
      }
    }
  }
  if (preparedAction.type === 'write') {
    preparedAction.content = normalizeForgeWriteContent(preparedAction.content);
  }
  return { action: preparedAction, relativePath, fullPath, canonicalRoot };
}

async function executeActionBody(action, projectRoot, task, opts) {
  const {
    logger,
    bashSafety,
    incrementalEdit,
    sandboxExecutor,
    signal,
    governanceRequired = false,
  } = opts;
  throwIfForgeAborted(signal);
  let fullPath = await resolveActionPath(projectRoot, action.path || '');
  let relPath = action.path || '';

  // Security: only restrict destructive operations (write/edit) to allowed patterns
  const mutatingActions = new Set(['write', 'edit', 'diff']);
  if (action.path && mutatingActions.has(action.type)) {
    const patterns = task.allowed_files || task.allowedFiles;
    if (!isAllowed(relPath, patterns)) {
      const inferred = inferCorrectPath(relPath, patterns);
      if (inferred && isAllowed(inferred, patterns)) {
        logger.info(`Path auto-corrected: ${relPath} → ${inferred} (inferred subdirectory prefix)`);
        action.path = inferred;
        relPath = inferred;
        fullPath = await resolveActionPath(projectRoot, inferred);
      } else {
        logger.info(`BLOCKED: ${relPath} not in patterns: ${JSON.stringify(patterns?.slice?.(0, 5) || patterns)}`);
        throw new Error(`File ${relPath} is not in allowed patterns`);
      }
    }
  }

  switch (action.type) {
    case 'write': {
      throwIfForgeAborted(signal);
      await mkdir(dirname(fullPath), { recursive: true });
      fullPath = await resolveActionPath(projectRoot, relPath);

      let contentToWrite = action.content;
      if (typeof contentToWrite !== 'string') {
        if (contentToWrite && typeof contentToWrite === 'object') {
          contentToWrite = JSON.stringify(contentToWrite, null, 2);
        } else {
          contentToWrite = String(contentToWrite || '');
        }
        logger.info(`Warning: action.content was not a string, coerced to string for ${relPath}`);
      }

      // Pre-write syntax validation for JS files
      if (!governanceRequired && relPath.match(/\.m?js$/)) {
        const syntaxCheck = await validateJsSyntax(contentToWrite);
        if (!syntaxCheck.valid) {
          logger.info(`Syntax error in ${relPath} (line ${syntaxCheck.line || '?'}): ${syntaxCheck.error}`);
          const fixed = tryFixSyntax(contentToWrite);
          if (fixed) {
            const retryCheck = await validateJsSyntax(fixed);
            if (retryCheck.valid) {
              logger.info(`Auto-fixed syntax errors in ${relPath}`);
              contentToWrite = fixed;
            } else {
              logger.info(`Auto-fix did not resolve all errors: ${retryCheck.error}`);
            }
          } else {
            logger.info(`Could not auto-fix syntax errors in ${relPath}`);
          }
        }

        // Pre-write import validation
        const importFix = fixAndValidateImports(contentToWrite, fullPath, relPath);
        if (importFix.fixed) {
          logger.info(`Auto-fixed import issues in ${relPath}: ${importFix.fixes.join('; ')}`);
          contentToWrite = importFix.content;
        }
        for (const w of importFix.warnings) {
          logger.info(`Import warning in ${relPath}: ${w}`);
        }
      }

      fullPath = await resolveActionPath(projectRoot, relPath);
      throwIfForgeAborted(signal);
      await writeFileNoFollow(fullPath, contentToWrite);
      try {
        await access(fullPath);
        const written = await readFile(fullPath, 'utf-8');
        if (written.length === 0 && contentToWrite.length > 0) {
          throw new Error('File was written but is empty');
        }
      } catch (verifyErr) {
        throw new Error(`Write verification failed for ${relPath}: ${verifyErr.message}`);
      }
      if (!governanceRequired) {
        await autoLint(fullPath, relPath, logger, { projectRoot, sandboxExecutor, signal });
      }
      return { modified: true, path: relPath, action: 'created' };
    }

    case 'edit': {
      const oldStr = typeof action.oldString === 'string' ? action.oldString : String(action.oldString || '');
      const newStr = typeof action.newString === 'string' ? action.newString : String(action.newString || '');
      fullPath = await resolveActionPath(projectRoot, relPath);
      throwIfForgeAborted(signal);
      const current = await readFile(fullPath, 'utf-8');

      if (!current.includes(oldStr)) {
        // Fuzzy matching: normalize whitespace
        const fuzzyResult = fuzzyMatchEdit(current, oldStr, newStr);
        if (fuzzyResult) {
          fullPath = await resolveActionPath(projectRoot, relPath);
          throwIfForgeAborted(signal);
          await writeFileNoFollow(fullPath, fuzzyResult.content);
          try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
          logger.info(fuzzyResult.message);
          return { modified: true, path: relPath, action: 'modified' };
        }

        // Line-based matching
        const lineResult = lineBasedEdit(current, oldStr, newStr);
        if (lineResult) {
          fullPath = await resolveActionPath(projectRoot, relPath);
          throwIfForgeAborted(signal);
          await writeFileNoFollow(fullPath, lineResult.content);
          try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
          logger.info(lineResult.message);
          return { modified: true, path: relPath, action: 'modified' };
        }

        const snippet = current.slice(0, 2000);
        throw new Error(`oldString not found in ${relPath}. Actual file content starts with:\n\`\`\`\n${snippet}\n\`\`\``);
      }

      const updated = current.replace(oldStr, newStr);

      // Post-edit syntax validation for JS files
      if (!governanceRequired && relPath.match(/\.m?js$/)) {
        const editCheck = await validateJsSyntax(updated);
        if (!editCheck.valid) {
          logger.info(`Edit would introduce syntax error in ${relPath} (line ${editCheck.line || '?'}): ${editCheck.error}`);
          const fixed = tryFixSyntax(updated);
          if (fixed) {
            const retryCheck = await validateJsSyntax(fixed);
            if (retryCheck.valid) {
              logger.info(`Auto-fixed post-edit syntax errors in ${relPath}`);
              fullPath = await resolveActionPath(projectRoot, relPath);
              throwIfForgeAborted(signal);
              await writeFileNoFollow(fullPath, fixed);
              try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
              return { modified: true, path: relPath, action: 'modified' };
            }
          }
          logger.info(`Proceeding with edit despite syntax warning for ${relPath}`);
        }
      }

      fullPath = await resolveActionPath(projectRoot, relPath);
      throwIfForgeAborted(signal);
      await writeFileNoFollow(fullPath, updated);
      try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
      if (!governanceRequired) {
        await autoLint(fullPath, relPath, logger, { projectRoot, sandboxExecutor, signal });
      }
      return { modified: true, path: relPath, action: 'modified' };
    }

    case 'diff': {
      if (!action.edits || !Array.isArray(action.edits)) {
        throw new Error(`Diff action requires an "edits" array`);
      }
      fullPath = await resolveActionPath(projectRoot, relPath);
      throwIfForgeAborted(signal);
      const current = await readFile(fullPath, 'utf8');
      const appliedDiff = incrementalEdit.applyDiff(current, action.edits);
      const diffResult = {
        modified: appliedDiff.applied > 0,
        path: fullPath,
        applied: appliedDiff.applied,
        errors: appliedDiff.errors,
      };
      if (diffResult.modified) {
        fullPath = await resolveActionPath(projectRoot, relPath);
        throwIfForgeAborted(signal);
        await writeFileNoFollow(fullPath, appliedDiff.result);
      }
      if (diffResult.errors.length > 0) {
        logger.info(`Diff edit had ${diffResult.errors.length} error(s): ${diffResult.errors.join('; ')}`);
      }
      if (diffResult.applied > 0) {
        if (!governanceRequired && relPath.match(/\.m?js$/)) {
          await autoLint(fullPath, relPath, logger, { projectRoot, sandboxExecutor, signal });
        }
        logger.info(`Diff edit: ${diffResult.applied} edit(s) applied to ${relPath}`);
        return { modified: true, path: relPath, action: 'diff-applied', applied: diffResult.applied, errors: diffResult.errors };
      }
      return { modified: false, path: relPath, errors: diffResult.errors };
    }

    case 'bash': {
      const { SafetyVerdict } = await import('../bash-safety/index.js');
      const safetyCheck = bashSafety.check(action.command);
      if (safetyCheck.verdict === SafetyVerdict.BLOCKED) {
        logger.info(`Bash BLOCKED: "${action.command?.slice(0, 60)}" — ${safetyCheck.reason}`);
        throw new Error(`Command blocked by safety policy: ${safetyCheck.reason}`);
      }
      if (safetyCheck.verdict === SafetyVerdict.NEEDS_REVIEW) {
        logger.info(`Bash NEEDS_REVIEW: "${action.command?.slice(0, 60)}" — skipping in automated mode`);
        throw new Error(`Command requires manual review: ${safetyCheck.reason}`);
      }
      if (!sandboxExecutor) {
        throw new Error('SANDBOX_BACKEND_UNAVAILABLE: LLM-generated bash requires an attested isolation backend.');
      }
      throwIfForgeAborted(signal);
      const result = await sandboxExecutor.execute(action.command, {
        cwd: projectRoot,
        level: 'full',
        workspaceMode: 'ro',
        timeout: Number.isFinite(Number(action.timeoutMs))
          ? Math.min(Math.max(Number(action.timeoutMs), 1), 60_000)
          : 60_000,
        signal,
      });
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, 5000);
      if (result.exitCode !== 0 || result.killed || result.cleanupUncertain) {
        throw new Error(`Sandbox command failed (${result.killReason || result.exitCode}): ${output}`);
      }
      return {
        modified: false,
        output,
      };
    }

    case 'read': {
      try {
        fullPath = await resolveActionPath(projectRoot, relPath);
        throwIfForgeAborted(signal);
        const fileStat = await stat(fullPath);
        if (fileStat.isDirectory()) {
          throwIfForgeAborted(signal);
          const entries = await readdir(fullPath);
          return { modified: false, output: `Directory: ${entries.join('\n')}` };
        }
        throwIfForgeAborted(signal);
        const content = await readFile(fullPath, 'utf-8');
        return { modified: false, output: content.slice(0, 8000) };
      } catch (err) {
        if (err.code === 'ENOENT') {
          return { modified: false, output: `File not found: ${relPath}. Use "write" action to create it.` };
        }
        throw err;
      }
    }

    default:
      return { modified: false };
  }
}

/**
 * Check if a file path matches any of the allowed glob patterns.
 * @param {string} filePath
 * @param {string[]|string} patterns
 * @returns {boolean}
 */
export function isAllowed(filePath, patterns) {
  if (!patterns) return true;
  let pats;
  if (typeof patterns === 'string') {
    try { pats = JSON.parse(patterns); } catch { return true; }
  } else {
    pats = patterns;
  }
  if (!Array.isArray(pats)) return true;
  return pats.some(pat => matchGlob(filePath, pat));
}

/**
 * Validate and auto-fix import statements in generated JS.
 *
 * Catches semantic errors that pass `node --check` but crash on module load:
 *   1. `import { assert } from 'node:test'` — assert is NOT exported by
 *      node:test. Auto-fix: split into separate imports.
 *   2. Local relative imports pointing to non-existent files — logged as warning.
 *
 * @param {string} content — JavaScript source code
 * @param {string} fullPath — absolute file path
 * @param {string} relPath — relative path for logging
 * @returns {{fixed: boolean, content: string, fixes: string[], warnings: string[]}}
 */
export function fixAndValidateImports(content, fullPath, relPath) {
  const result = { fixed: false, content, fixes: [], warnings: [] };
  if (typeof content !== 'string' || !content) return result;
  let out = content;

  // Fix 1: `import { ..., assert, ... } from 'node:test'` → split assert out
  const nodeTestAssert = /import\s*\{([^}]*)\}\s*from\s*['"]node:test['"];?/g;
  let m;
  while ((m = nodeTestAssert.exec(content)) !== null) {
    const specifiers = m[1].split(',').map(s => s.trim()).filter(Boolean);
    const hasAssert = specifiers.some(s => s === 'assert' || s.startsWith('assert '));
    if (!hasAssert) continue;
    const others = specifiers.filter(s => !(s === 'assert' || s.startsWith('assert ')));
    const replacement = others.length > 0
      ? `import { ${others.join(', ')} } from 'node:test';\nimport assert from 'node:assert';`
      : `import assert from 'node:assert';`;
    out = out.replace(m[0], replacement);
    result.fixes.push(`moved 'assert' import from node:test to node:assert`);
  }

  // Fix 2: check local relative imports exist on disk
  const localImport = /(?:import\s*[^;]*?from\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
  while ((m = localImport.exec(out)) !== null) {
    const spec = m[1];
    try {
      const baseDir = dirname(fullPath);
      let candidate = resolve(baseDir, spec);
      const tryPaths = extname(spec) ? [candidate] : [candidate, candidate + '.mjs', candidate + '.js', candidate + '/index.mjs', candidate + '/index.js'];
      const found = tryPaths.some(p => existsSync(p));
      if (!found) {
        result.warnings.push(`local import '${spec}' does not resolve to an existing file (will be created later?)`);
      }
    } catch { /* path resolution is best-effort */ }
  }

  if (out !== content) { result.fixed = true; result.content = out; }
  return result;
}

/**
 * When the LLM forgets a subdirectory prefix, try to infer the correct full
 * path by matching the file's basename against concrete (non-glob) allowed
 * patterns that share the same basename.
 *
 * @param {string} filePath — the file path to correct
 * @param {string[]|string} patterns — allowed file patterns
 * @returns {string|null} — corrected path, or null if ambiguous
 */
export function inferCorrectPath(filePath, patterns) {
  if (!patterns || !filePath) return null;
  let pats;
  if (typeof patterns === 'string') {
    try { pats = JSON.parse(patterns); } catch { return null; }
  } else {
    pats = patterns;
  }
  if (!Array.isArray(pats)) return null;

  const fileBasename = filePath.split(/[\\/]/).pop().toLowerCase();
  const candidates = [];
  for (const pat of pats) {
    if (typeof pat !== 'string') continue;
    if (pat.includes('*') || pat.includes('?')) continue;
    const patBasename = pat.split(/[\\/]/).pop().toLowerCase();
    if (patBasename === fileBasename && pat !== filePath) {
      candidates.push(pat);
    }
  }
  if (candidates.length === 1) return candidates[0];
  return null;
}

/**
 * Fuzzy edit: normalize whitespace and try to find oldStr in current content.
 * @returns {{ content: string, message: string }|null}
 */
function fuzzyMatchEdit(current, oldStr, newStr) {
  const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
  const normalizedCurrent = normalize(current);
  const normalizedOld = normalize(oldStr);

  if (normalizedCurrent.includes(normalizedOld)) {
    const updated = normalizedCurrent.replace(normalizedOld, newStr.replace(/\r\n/g, '\n'));
    return { content: updated, message: 'Fuzzy edit (whitespace normalized) succeeded' };
  }
  return null;
}

/**
 * Line-based fuzzy edit: find the best block of matching lines and replace.
 * @returns {{ content: string, message: string }|null}
 */
function lineBasedEdit(current, oldStr, newStr) {
  const currentLines = current.split('\n');
  const oldLines = oldStr.split('\n').map(l => l.trimEnd());

  if (oldLines.length === 0 || currentLines.length === 0) return null;

  let bestStart = -1;
  let bestScore = 0;

  for (let i = 0; i <= currentLines.length - oldLines.length; i++) {
    let score = 0;
    for (let j = 0; j < oldLines.length; j++) {
      if (currentLines[i + j].trimEnd() === oldLines[j].trimEnd()) score++;
    }
    if (score > bestScore) { bestScore = score; bestStart = i; }
  }

  if (bestStart >= 0 && bestScore / oldLines.length >= 0.6) {
    const newLines = currentLines.slice();
    newLines.splice(bestStart, oldLines.length, ...newStr.split('\n'));
    return {
      content: newLines.join('\n'),
      message: `Fuzzy edit: matched ${bestScore}/${oldLines.length} lines at line ${bestStart + 1}`,
    };
  }
  return null;
}
