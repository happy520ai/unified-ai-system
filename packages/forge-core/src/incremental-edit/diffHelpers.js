/**
 * IncrementalEdit — pure diff helper functions.
 *
 * Extracted from incremental-edit/index.js to keep the class module
 * under the 500-line limit (分层律).
 */

/**
 * Determine whether two edits have overlapping or conflicting line ranges.
 *
 * Each edit's range is normalised to [min(startLine,endLine), max(startLine,endLine)]
 * before comparison.  Two ranges [a1,b1] and [a2,b2] overlap when
 * a1 <= b2 AND a2 <= b1.
 *
 * @param {object} a
 * @param {object} b
 * @returns {boolean} `true` if the two edits touch any common line positions.
 */
export function rangesOverlap(a, b) {
  const aMin = Math.min(a.startLine, a.endLine);
  const aMax = Math.max(a.startLine, a.endLine);
  const bMin = Math.min(b.startLine, b.endLine);
  const bMax = Math.max(b.startLine, b.endLine);

  return aMin <= bMax && bMin <= aMax;
}

/**
 * Build a human- and LLM-readable prompt that explains the diff format in
 * the context of a specific file and a description of the desired changes.
 *
 * @param {string} fileContent    - Current content of the file to be edited.
 * @param {string} desiredChanges - Free-text description of what should change.
 * @returns {string} A prompt string suitable for inclusion in an LLM request.
 */
export function generateDiffPrompt(fileContent, desiredChanges) {
  const lines = fileContent === '' ? [] : fileContent.split('\n');
  const gutterWidth = String(lines.length).length;

  const numbered = lines
    .map((line, i) => `${String(i + 1).padStart(gutterWidth, ' ')} | ${line}`)
    .join('\n');

  return [
    '## Diff Edit Instructions',
    '',
    'You are editing a file using a line-number-based diff format.',
    'The current file content (with line numbers) is shown below:',
    '',
    '```',
    numbered || '(empty file)',
    '```',
    '',
    `Desired changes: ${desiredChanges}`,
    '',
    'Respond with a JSON action in the following format:',
    '',
    '```json',
    '{',
    '  "type": "diff",',
    '  "path": "<file-path>",',
    '  "edits": [',
    '    { "startLine": <start>, "endLine": <end>, "newContent": "<replacement or insertion>" }',
    '  ]',
    '}',
    '```',
    '',
    'Rules:',
    '- Line numbers are 1-based and refer to the numbered lines above.',
    '- To replace lines N through M: { "startLine": N, "endLine": M, "newContent": "..." }',
    '- To replace a single line N:    { "startLine": N, "endLine": N, "newContent": "..." }',
    '- To insert after line N:         { "startLine": N+1, "endLine": N, "newContent": "..." }',
    '- To delete lines N through M:    { "startLine": N, "endLine": M, "newContent": "" }',
    '- Edits are applied bottom-to-top, so listing order does not matter.',
    '- Do NOT include overlapping or adjacent edits in the same action.',
    '- Use \\n inside "newContent" to express multi-line replacements or insertions.',
  ].join('\n');
}

/**
 * Compute aggregate statistics for a set of diff edits without applying them.
 *
 * @param {object[]} edits - Edits to analyse.
 * @returns {object}
 */
export function getDiffStats(edits) {
  let linesReplaced = 0;
  let linesInserted = 0;
  let linesDeleted  = 0;

  for (const edit of edits) {
    const isInsert = edit.startLine > edit.endLine;

    if (isInsert) {
      const newLineCount = edit.newContent === '' ? 0 : edit.newContent.split('\n').length;
      linesInserted += newLineCount;
    } else {
      const originalCount = edit.endLine - edit.startLine + 1;
      if (edit.newContent === '') {
        linesDeleted += originalCount;
      } else {
        linesReplaced += originalCount;
      }
    }
  }

  return {
    totalEdits:    edits.length,
    linesReplaced,
    linesInserted,
    linesDeleted,
  };
}

/**
 * Return a system-prompt fragment that teaches an LLM how to emit diff
 * actions.
 *
 * @returns {string} A multi-line Markdown string.
 */
export function buildSystemPrompt() {
  return [
    '## Diff Edit Format',
    '',
    'Instead of writing full file content, you can use "diff" actions for surgical edits:',
    '',
    '```json',
    JSON.stringify({
      type:  'diff',
      path:  'file.js',
      edits: [
        { startLine: 5,  endLine: 8,  newContent: 'replacement for lines 5-8' },
        { startLine: 20, endLine: 19, newContent: 'insert this after line 19' },
      ],
    }, null, 2),
    '```',
    '',
    'Rules:',
    '- Line numbers are 1-based',
    '- Edits are applied bottom-to-top (order doesn\'t matter)',
    '- startLine > endLine means INSERT (newContent is inserted between lines)',
    '- startLine === endLine means replace that single line',
    '- Use "diff" for small targeted changes, "write" for new files or major rewrites',
  ].join('\n');
}
