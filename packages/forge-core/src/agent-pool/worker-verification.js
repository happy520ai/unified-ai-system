/**
 * Worker Verification & Self-Loop
 * Handles auto-verification after code-mutating tasks and self-loop decisions
 */

import { CODE_MUTATING_TYPES, MAX_VERIFY_RETRIES } from './constants.js';
import { classifyFailure, buildFixPrompt } from './failure-classification.js';

/**
 * Run auto-verification after code-mutating tasks succeed.
 * If verification fails, re-enqueue with targeted fix prompt.
 * Returns modified result object (may set result.success = false on retry).
 */
export async function runAutoVerification(s, goalId, task, userId, entry, result, tracker) {
  const verifyRetryCount = entry.verifyRetryCount ?? 0;
  if (!result.success ||
      !CODE_MUTATING_TYPES.has(task.type) ||
      !s.verifier ||
      s.options.enableAutoVerify === false) {
    return result;
  }

  const autoVerifyStart = Date.now();
  s.eventEmitter.emit('verification_started', {
    goalId, taskId: task.id, type: 'auto', attempt: verifyRetryCount + 1,
  });
  s.metrics.recordVerification({ taskId: task.id, event: 'started' });
  s.store.logEvent(goalId, task.id, 'auto_verify_started', {
    attempt: verifyRetryCount + 1, maxRetries: (s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES),
  });

  try {
    const verifyResult = await s.verifier.verifyAfterMutation(
      goalId, task.id,
      { filesModified: result.filesModified ?? [], maxTier: (s.config?.pool?.verifyMaxTier ?? 2) }
    );
    result.verification = verifyResult;
    s.verificationStats.total++;

    if (verifyResult.overall === 'FAIL' && verifyResult.failures.length > 0) {
      s.verificationStats.failed++;

      for (const f of verifyResult.failures) {
        console.log(`[forge:pool:auto-verify] Tier ${f.tier} / ${f.checkName} FAILED: ${(f.output || '').slice(0, 200)}`);
      }

      if (verifyRetryCount < (s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)) {
        s.verificationStats.retried++;

        const failedFiles = [...new Set(
          verifyResult.failures
            .map(f => f.file || f.filePath)
            .filter(Boolean)
        )];
        const targetFiles = failedFiles.length > 0
          ? failedFiles
          : (result.filesModified ?? []).map(fm => fm.path).filter(Boolean);

        const classification = classifyFailure(verifyResult);
        const fixPrompt = buildFixPrompt(s.verifier, classification, verifyResult, task, targetFiles, verifyRetryCount + 1, (s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES));

        s.store.updateTaskStatus(goalId, task.id, 'pending', {
          errorMessage: `Auto-verification failed (attempt ${verifyRetryCount + 1}/${(s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)}). Targeted fix queued.`,
        });

        s.queue.push({
          goalId,
          task: {
            ...task,
            prompt: fixPrompt,
            allowed_files: [
              ...targetFiles,
              'test/**/*.js', 'test/**/*.ts', 'tests/**/*.js', 'tests/**/*.ts',
              'package.json',
            ],
            allowedFiles: [
              ...targetFiles,
              'test/**/*.js', 'test/**/*.ts', 'tests/**/*.js', 'tests/**/*.ts',
              'package.json',
            ],
            type: 'refactor',
            name: `Fix verification failures (${verifyRetryCount + 1}/${(s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)})`,
            verificationRetryHint: verifyRetryCount + 1,
            isTargetedFix: true,
          },
          userId,
          priority: (entry.priority ?? 50) + 30,
          enqueuedAt: Date.now(),
          verifyRetryCount: verifyRetryCount + 1,
        });

        s.store.logEvent(goalId, task.id, 'auto_verify_retry', {
          attempt: verifyRetryCount + 1,
          maxRetries: (s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES),
          failures: verifyResult.failures.length,
          failureSummary: verifyResult.failures.map(f => `${f.tierName}/${f.checkName}`).join(', '),
        });

        s.eventEmitter.emit('verification_failed', {
          goalId, taskId: task.id, type: 'auto',
          failures: verifyResult.failures,
          retrying: true, attempt: verifyRetryCount + 1,
        });
        s.metrics.recordVerification({
          taskId: task.id, event: 'failed',
          durationMs: Date.now() - autoVerifyStart,
          failureCount: verifyResult.failures.length,
        });

        result.success = false;
        result.error = `Auto-verification failed, retrying (attempt ${verifyRetryCount + 1}/${(s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)})`;
        console.log(`[forge:pool] Auto-verify failed for ${task.id} — re-enqueued for retry (attempt ${verifyRetryCount + 1}/${(s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)})`);
      } else {
        console.log(`[forge:pool] Auto-verify exhausted for ${task.id} — accepting with warnings`);
        result.verificationWarning = `Auto-verification failed after ${(s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)} attempts: ${verifyResult.failures.length} check(s) failed`;

        s.store.logEvent(goalId, task.id, 'auto_verify_exhausted', {
          attempts: (s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES),
          failures: verifyResult.failures.length,
        });

        s.eventEmitter.emit('verification_failed', {
          goalId, taskId: task.id, type: 'auto',
          failures: verifyResult.failures,
          retrying: false, attempt: verifyRetryCount + 1,
          exhausted: true,
        });
        s.metrics.recordVerification({
          taskId: task.id, event: 'failed',
          durationMs: Date.now() - autoVerifyStart,
          failureCount: verifyResult.failures.length,
        });
      }
    } else {
      s.verificationStats.passed++;
      console.log(`[forge:pool] Auto-verify PASSED for ${task.id} (${verifyResult.summary?.checksPassed}/${verifyResult.summary?.checksTotal} checks)`);

      s.store.logEvent(goalId, task.id, 'auto_verify_passed', {
        checksPassed: verifyResult.summary?.checksPassed ?? 0,
        checksTotal: verifyResult.summary?.checksTotal ?? 0,
        durationMs: Date.now() - autoVerifyStart,
      });

      s.eventEmitter.emit('verification_passed', {
        goalId, taskId: task.id, type: 'auto',
        summary: verifyResult.summary,
      });
      s.metrics.recordVerification({
        taskId: task.id, event: 'passed',
        durationMs: Date.now() - autoVerifyStart,
      });
    }
  } catch (verifyErr) {
    console.log(`[forge:pool] Auto-verification engine error: ${verifyErr.message}`);
    s.store.logEvent(goalId, task.id, 'auto_verify_error', { error: verifyErr.message });
  }

  return result;
}

/**
 * Decision actions from self-loop engine
 */
export const Decision = {
  ACCEPT: 'accept',
  ADJUST_RETRY: 'adjust_retry',
  ROLLBACK_RETRY: 'rollback_retry',
  ESCALATE: 'escalate',
  EXHAUSTED: 'exhausted',
};

/**
 * Run self-loop engine post-execution decision for code-mutating tasks.
 * May re-enqueue the task with adjusted parameters or escalate to debugger.
 * Returns modified result object.
 */
export async function runSelfLoopDecision(s, goalId, task, userId, entry, result, fileSnapshot, startTime) {
  if (!result.success || !CODE_MUTATING_TYPES.has(task.type) || !s.selfLoop) {
    return result;
  }

  try {
    let verifyResult = null;
    if (result.verification) {
      verifyResult = {
        passed: result.verification.overall !== 'FAIL',
        failures: result.verification.failures || [],
        tier: s.config?.selfLoop?.defaultTier ?? 2,
      };
    } else if (s.verifier) {
      verifyResult = await s.selfLoop.verify(goalId, task.id, {
        filesModified: result.filesModified || [],
      });
    }

    if (verifyResult) {
      const decision = await s.selfLoop.handlePostExecution(goalId, task, result, {
        userId, snapshot: fileSnapshot, verifyResult,
      });

      result.selfLoopDecision = decision;

      if (decision.action === Decision.ADJUST_RETRY) {
        console.log(`[forge:pool:self-loop] ADJUST_RETRY: ${decision.reason}`);
        s.store.updateTaskStatus(goalId, task.id, 'pending', {
          errorMessage: `Self-loop adjust: ${decision.reason}`,
        });
        s.queue.push({
          goalId,
          task: {
            ...task,
            prompt: `${task.prompt}\n\n${decision.adjustments?.promptHints || ''}`,
            isSelfLoopRetry: true,
            selfLoopStrategy: decision.strategy,
          },
          userId,
          priority: (entry.priority ?? 50) + 25,
          enqueuedAt: Date.now(),
          verifyRetryCount: entry.verifyRetryCount ?? 0,
        });
        result.success = false;
        result.error = decision.reason;

      } else if (decision.action === Decision.ROLLBACK_RETRY) {
        console.log(`[forge:pool:self-loop] ROLLBACK_RETRY: ${decision.reason}`);
        if (fileSnapshot) {
          const rollbackResult = await s.selfLoop.rollback(fileSnapshot, s.projectRoot);
          result.rollbackInfo = rollbackResult;
          s.store.logEvent(goalId, task.id, 'self_loop_rollback', {
            restored: rollbackResult.restored,
            deleted: rollbackResult.deleted,
            errors: rollbackResult.errors.length,
          });
        }
        s.store.updateTaskStatus(goalId, task.id, 'pending', {
          errorMessage: `Self-loop rollback: ${decision.reason}`,
        });
        s.queue.push({
          goalId,
          task: {
            ...task,
            prompt: `[AFTER ROLLBACK — Fresh Start]\nPrevious changes were rolled back due to persistent verification failures.\n${task.prompt}\n\nTake a completely different approach to solve this task.\n${decision.adjustments?.promptHints || ''}`,
            isSelfLoopRetry: true,
            selfLoopStrategy: decision.strategy,
            postRollback: true,
          },
          userId,
          priority: (entry.priority ?? 50) + 35,
          enqueuedAt: Date.now(),
          verifyRetryCount: entry.verifyRetryCount ?? 0,
        });
        result.success = false;
        result.error = decision.reason;

      } else if (decision.action === Decision.ESCALATE) {
        console.log(`[forge:pool:self-loop] ESCALATE: ${decision.reason}`);
        s.store.updateTaskStatus(goalId, task.id, 'pending', {
          errorMessage: `Self-loop escalation: ${decision.reason}`,
        });
        s.queue.push({
          goalId,
          task: {
            ...task,
            agent_role: 'debugger',
            agentRole: 'debugger',
            prompt: `[DEBUGGER ESCALATION]\nThe coder agent failed to produce passing code after multiple attempts.\n${task.prompt}\n\n${decision.adjustments?.promptHints || ''}\n\nYour job: deeply analyze the failures, identify root causes, and produce correct code.`,
            isSelfLoopRetry: true,
            selfLoopStrategy: 'debugger',
          },
          userId,
          priority: (entry.priority ?? 50) + 40,
          enqueuedAt: Date.now(),
          verifyRetryCount: entry.verifyRetryCount ?? 0,
        });
        result.success = false;
        result.error = decision.reason;

      } else if (decision.action === Decision.EXHAUSTED) {
        console.log(`[forge:pool:self-loop] EXHAUSTED: ${decision.reason}`);
        result.verificationWarning = (result.verificationWarning || '') +
          `\nSelf-loop exhausted after ${decision.loopCount || '?'} iterations.`;
        s.store.logEvent(goalId, task.id, 'self_loop_exhausted', {
          loopCount: decision.loopCount,
        });

        s.deadLetterQueue.add({
          goalId, task, result,
          verifyResult: verifyResult || null,
          strategyHistory: [],
          loopCount: decision.loopCount || 0,
        });
      }
    }
  } catch (loopErr) {
    console.log(`[forge:pool:self-loop] Engine error (non-fatal): ${loopErr.message}`);
  }

  return result;
}
