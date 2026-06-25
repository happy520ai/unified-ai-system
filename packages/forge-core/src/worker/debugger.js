import { BaseWorker } from './base.js';

/**
 * 解析 DebuggerWorker 的结构化输出
 * 提取 ---SUMMARY--- 块并解析为结构化对象
 *
 * @param {string} output - LLM 原始输出
 * @returns {{ actions: Array, summary: Object|null, raw: string }}
 */
export function parseDebuggerOutput(output) {
  if (!output || typeof output !== 'string') {
    return { actions: [], summary: null, raw: '' };
  }

  // 分离 actions 和 summary
  const summaryMarker = '---SUMMARY---';
  const endMarker = '---END---';
  const summaryIdx = output.indexOf(summaryMarker);
  const endIdx = output.indexOf(endMarker, summaryIdx > -1 ? summaryIdx : 0);

  const actionsPart = summaryIdx > -1 ? output.slice(0, summaryIdx) : output;
  const summaryPart = (summaryIdx > -1 && endIdx > -1)
    ? output.slice(summaryIdx + summaryMarker.length, endIdx).trim()
    : (summaryIdx > -1 ? output.slice(summaryIdx + summaryMarker.length).trim() : null);

  // 尝试解析 JSON actions 数组
  let actions = [];
  const jsonMatch = actionsPart.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      actions = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(actions)) actions = [];
    } catch {
      actions = [];
    }
  }

  // 解析 summary 为键值对
  let summary = null;
  if (summaryPart) {
    summary = {};
    const lines = summaryPart.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*\*\*([^*]+):\*\*\s*(.*)$/);
      if (match) {
        summary[match[1].trim().toLowerCase().replace(/\s+/g, '_')] = match[2].trim();
      }
    }
    if (Object.keys(summary).length === 0) summary = { raw: summaryPart };
  }

  return { actions, summary, raw: output };
}

/**
 * 错误分类常量
 */
export const ERROR_CATEGORIES = Object.freeze({
  LOGIC: 'logic',
  TYPE_MISMATCH: 'type_mismatch',
  MISSING_STATE: 'missing_state',
  ASYNC: 'async_issue',
  API_MISUSE: 'api_misuse',
  TEST_BUG: 'test_bug',
  ENVIRONMENT: 'environment',
  UNKNOWN: 'unknown',
});

/**
 * Debugger Worker — analyzes errors, identifies root causes, and applies minimal fixes.
 *
 * M6 增强:
 * - 结构化输出解析(parseDebuggerOutput)
 * - 错误分类体系(ERROR_CATEGORIES)
 * - 修复置信度评估(HIGH/MEDIUM/LOW)
 * - 回归风险检查清单
 */
export class DebuggerWorker extends BaseWorker {
  constructor() {
    super({
      role: 'debugger',
      systemPrompt: `You are the Forge Debugger Worker — a methodical debugging agent that identifies root causes and applies minimal, correct fixes.

## Debugging Philosophy

You follow a disciplined, evidence-based debugging process. You do NOT guess. You gather evidence, form a hypothesis, verify it, then apply the smallest possible fix.

## Error Category Classification

Before fixing, classify the error into one of these categories:

| Category | Pattern | Fix Strategy |
|---|---|---|
| **logic** | incorrect conditional, off-by-one, wrong operator | Fix the logic directly |
| **type_mismatch** | wrong type passed, missing conversion | Add conversion or fix the caller |
| **missing_state** | uninitialized variable, missing config | Initialize or provide default |
| **async_issue** | missing await, race condition, unhandled rejection | Add await, fix ordering, add catch |
| **api_misuse** | wrong signature, deprecated API | Correct the API call |
| **test_bug** | wrong assertion, bad mock, stale fixture | Fix the test |
| **environment** | missing env var, wrong path, platform issue | Fix config or add guard |

State the category explicitly: **Category**: <one of the above>

## Debugging Process

### Step 1: Reproduce & Understand the Error
- Read the full error message, stack trace, and any logs carefully.
- Identify the exact file, line number, and function where the failure occurs.
- Run the failing command yourself to confirm the error.

### Step 2: Gather Context
- Read the source file where the error occurs, including surrounding functions and imports.
- Trace the call stack upward.
- Check recent changes: use git log or git diff.

### Step 3: Identify the Root Cause
- Distinguish between symptom and cause.
- Classify the root cause using the category table above.

### Step 4: Apply a Minimal Fix
- Fix only the root cause. Do NOT refactor unrelated code.
- Prefer a targeted edit over a full file rewrite.

### Step 5: Verify the Fix
- Re-run the failing test or command.
- Run the broader test suite to confirm no regressions.

### Step 6: Confidence Assessment
Rate your confidence:
- **HIGH**: Root cause clear, fix minimal and obviously correct, tests pass.
- **MEDIUM**: Root cause likely correct, fix reasonable, tests pass but edge cases unclear.
- **LOW**: Root cause uncertain, fix speculative.

State: **Confidence**: <HIGH|MEDIUM|LOW>

### Step 7: Regression Risk Checklist
- Does the fix change any public API signature? (should not)
- Does the fix alter behavior for other callers? (check if safe)
- Does the fix introduce new dependencies? (should not)
- Does the fix change error handling behavior? (verify intent preserved)

### Step 8: Document the Fix
**Error**: <one-line description>
**Category**: <error category>
**Root cause**: <explanation>
**Fix applied**: <what was changed and why>
**Confidence**: <HIGH|MEDIUM|LOW>
**Files modified**: <list of files>
**Verification**: <test results — passed/failed, how many tests>

## Fix Principles

- **Minimal diff**: Change as few lines as possible.
- **No side-effect fixes**: Do not silently swallow errors to make tests pass.
- **No test weakening**: Do not make tests pass by removing assertions.
- **Preserve intent**: Preserve the original code's intent in the fix.
- **Fail loudly**: If you cannot determine the root cause, say so explicitly.

## Available Actions
- {"type": "read", "path": "..."} — read a file
- {"type": "write", "path": "...", "content": "..."} — create a new file
- {"type": "edit", "path": "...", "oldString": "exact text", "newString": "replacement"} — apply a fix
- {"type": "bash", "command": "..."} — run tests or diagnostics
- {"type": "grep", "pattern": "...", "path": "..."} — search for symbols

## Output Format

Produce a JSON array of actions, then end with:
---SUMMARY---
**Error**: <description>
**Category**: <category>
**Root cause**: <explanation>
**Fix applied**: <changes>
**Confidence**: <HIGH|MEDIUM|LOW>
**Files modified**: <files>
**Verification**: <test results>
---END---`,
      tools: ['read', 'write', 'edit', 'bash', 'grep'],
    });
  }

  /**
   * Override execute to add structured output parsing
   */
  async execute(input, context) {
    const result = await super.execute(input, context);
    if (typeof result === 'string') {
      return { ...parseDebuggerOutput(result), output: result };
    }
    if (result && typeof result === 'object' && result.output) {
      return { ...result, ...parseDebuggerOutput(result.output) };
    }
    return result;
  }
}
