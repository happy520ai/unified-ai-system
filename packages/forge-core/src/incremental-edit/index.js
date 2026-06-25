import { readFile, writeFile } from 'node:fs/promises';
import {
  rangesOverlap, generateDiffPrompt, getDiffStats, buildSystemPrompt,
} from './diffHelpers.js';

/**
 * @typedef {Object} DiffEdit
 * @property {number} startLine - 1-based start line (inclusive).
 *   When startLine > endLine the edit is an INSERT (content is inserted between lines startLine-1 and startLine).
 * @property {number} endLine - 1-based end line (inclusive).
 *   When endLine < startLine the edit is an INSERT.
 * @property {string} newContent - Replacement / insertion content.
 *   An empty string combined with a valid range (startLine <= endLine) deletes those lines.
 */

/**
 * @typedef {Object} DiffAction
 * @property {'diff'} type
 * @property {string} path - Target file path.
 * @property {DiffEdit[]} edits - Ordered list of line-based edits.
 */

/**
 * @typedef {Object} ApplyDiffResult
 * @property {string} result - The modified file content.
 * @property {number} applied - Count of edits that were successfully applied.
 * @property {string[]} errors - Human-readable error messages for edits that were skipped.
 */

/**
 * @typedef {Object} ApplyDiffToFileResult
 * @property {boolean} modified - Whether the file on disk was actually changed.
 * @property {string} path - Resolved file path.
 * @property {number} applied - Count of edits applied.
 * @property {string[]} errors - Error messages for any edits that could not be applied.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - True when every edit passed all checks.
 * @property {string[]} errors - Collected error messages.
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} valid - True when the action object is well-formed.
 * @property {DiffEdit[]} edits - Normalised edits extracted from the action.
 * @property {string} path - The target path from the action.
 * @property {string[]} errors - Validation error messages.
 */

/**
 * @typedef {Object} DiffStats
 * @property {number} totalEdits - Total number of edits in the set.
 * @property {number} linesReplaced - Original lines covered by replace edits (non-empty newContent).
 * @property {number} linesInserted - New lines introduced by INSERT edits.
 * @property {number} linesDeleted - Original lines removed by delete edits (empty newContent, startLine <= endLine).
 */


/**
 * IncrementalEdit provides a line-number-based diff mode for the Forge code
 * generation engine.
 *
 * It is designed as a robust alternative to the classic oldString/newString
 * replacement strategy: instead of matching arbitrary substrings, callers
 * reference explicit 1-based line ranges, making edits deterministic and easy
 * to reason about.
 *
 * Edit semantics:
 *  - REPLACE  : startLine <= endLine  → lines [startLine … endLine] are replaced by newContent.
 *  - INSERT   : startLine >  endLine  → newContent is inserted between lines (startLine-1) and startLine.
 *  - DELETE   : startLine <= endLine AND newContent === '' → lines [startLine … endLine] are removed.
 *
 * Multiple edits within a single action are applied bottom-to-top (highest
 * startLine first) so that earlier edits never invalidate the line numbers
 * referenced by later ones.
 *
 * @example
 *   const ie = new IncrementalEdit();
 *   const { result, applied, errors } = ie.applyDiff(source, [
 *     { startLine: 5,  endLine: 8,  newContent: 'new line 5\nnew line 6' },
 *     { startLine: 20, endLine: 19, newContent: 'inserted after line 19' },
 *   ]);
 */
export class IncrementalEdit {

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Apply a set of line-number-based diff edits to an in-memory file string.
   *
   * The method works by splitting the content into an array of lines, sorting
   * the edits by startLine in descending order (bottom-to-top), validating each
   * edit against the current line count, and splicing the line array
   * accordingly.  Edits that overlap with one another are detected up front and
   * skipped with an error.
   *
   * @param {string} fileContent - The complete original file content.
   * @param {DiffEdit[]} edits    - Edits to apply.  Order does not matter; they
   *   will be sorted internally.
   * @returns {ApplyDiffResult}
   */
  applyDiff(fileContent, edits) {
    // Treat a truly empty string as zero lines (avoids the [''] quirk of split).
    const lines = fileContent === '' ? [] : fileContent.split('\n');
    const totalLines = lines.length;

    /** @type {string[]} */
    const errors = [];
    let applied = 0;

    if (!Array.isArray(edits) || edits.length === 0) {
      return { result: lines.join('\n'), applied: 0, errors };
    }

    // Sort descending by startLine so we process the lowest lines last,
    // preserving their positions as higher edits are applied first.
    const sorted = [...edits].sort((a, b) => b.startLine - a.startLine);

    // Pre-flight: detect all overlapping pairs and mark their indices.
    const overlappingIndices = new Set();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (rangesOverlap(sorted[i], sorted[j])) {
          if (!overlappingIndices.has(i) && !overlappingIndices.has(j)) {
            errors.push(
              `Overlapping edits detected: [${sorted[i].startLine}–${sorted[i].endLine}] ` +
              `and [${sorted[j].startLine}–${sorted[j].endLine}]; both skipped`
            );
          }
          overlappingIndices.add(i);
          overlappingIndices.add(j);
        }
      }
    }

    // Apply each edit.
    for (let i = 0; i < sorted.length; i++) {
      if (overlappingIndices.has(i)) {
        // Already reported above; skip silently here.
        continue;
      }

      const edit = sorted[i];
      const isInsert = edit.startLine > edit.endLine;

      // --- Validation --------------------------------------------------------

      if (isInsert) {
        // INSERT: we insert *after* line (startLine - 1).
        // Valid when (startLine - 1) is between 0 and totalLines inclusive.
        if (edit.startLine - 1 > totalLines) {
          errors.push(
            `INSERT at line ${edit.startLine}: target position ${edit.startLine - 1} ` +
            `is beyond file length (${totalLines} line${totalLines !== 1 ? 's' : ''}); skipped`
          );
          continue;
        }
        if (edit.startLine < 1) {
          errors.push(`INSERT at line ${edit.startLine}: startLine must be >= 1; skipped`);
          continue;
        }
      } else {
        // REPLACE / DELETE: the full [startLine, endLine] range must exist.
        if (totalLines === 0) {
          errors.push(
            `Edit [${edit.startLine}–${edit.endLine}]: cannot modify lines in an empty file; ` +
            `use an INSERT (startLine > endLine) instead; skipped`
          );
          continue;
        }
        if (edit.startLine < 1) {
          errors.push(`Edit [${edit.startLine}–${edit.endLine}]: startLine must be >= 1; skipped`);
          continue;
        }
        if (edit.endLine > totalLines) {
          errors.push(
            `Edit [${edit.startLine}–${edit.endLine}]: endLine ${edit.endLine} ` +
            `exceeds file length (${totalLines} line${totalLines !== 1 ? 's' : ''}); skipped`
          );
          continue;
        }
      }

      // --- Application -------------------------------------------------------

      /** @type {string[]} */
      const newLines = edit.newContent === '' ? [] : edit.newContent.split('\n');

      if (isInsert) {
        // Insert at array index (startLine - 1), removing zero elements.
        const spliceIndex = edit.startLine - 1;
        lines.splice(spliceIndex, 0, ...newLines);
      } else {
        // Replace / delete starting at array index (startLine - 1).
        const spliceIndex = edit.startLine - 1;
        const deleteCount = edit.endLine - edit.startLine + 1;
        lines.splice(spliceIndex, deleteCount, ...newLines);
      }

      applied++;
    }

    return { result: lines.join('\n'), applied, errors };
  }

  /**
   * Read a file from disk, apply diff edits, and write the result back.
   *
   * If no edits can be applied (all fail validation or the file cannot be
   * read), the file is left untouched and `modified` is `false`.
   *
   * @param {string} filePath    - Absolute or relative path to the target file.
   * @param {DiffEdit[]} edits   - Edits to apply.
   * @returns {Promise<ApplyDiffToFileResult>}
   */
  async applyDiffToFile(filePath, edits) {
    let content;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      return {
        modified: false,
        path: filePath,
        applied: 0,
        errors: [`Failed to read file "${filePath}": ${err.message}`],
      };
    }

    const { result, applied, errors } = this.applyDiff(content, edits);

    if (applied === 0) {
      return { modified: false, path: filePath, applied, errors };
    }

    try {
      await writeFile(filePath, result, 'utf-8');
    } catch (err) {
      errors.push(`Failed to write file "${filePath}": ${err.message}`);
      return { modified: false, path: filePath, applied, errors };
    }

    return { modified: true, path: filePath, applied, errors };
  }

  /**
   * Build a human- and LLM-readable prompt that explains the diff format in
   * the context of a specific file and a description of the desired changes.
   *
   * The returned string includes a numbered listing of the current file content
   * so that the LLM can reference exact line numbers when constructing edits.
   *
   * @param {string} fileContent    - Current content of the file to be edited.
   * @param {string} desiredChanges - Free-text description of what should change.
   * @returns {string} A prompt string suitable for inclusion in an LLM request.
   */
  generateDiffPrompt(fileContent, desiredChanges) {
    return generateDiffPrompt(fileContent, desiredChanges);
  }

  /**
   * Validate and normalise a raw diff action object (e.g. parsed from LLM
   * JSON output).
   *
   * Returns normalised {@link DiffEdit} objects alongside any validation
   * errors.  A `valid` result of `true` guarantees that every edit has
   * well-formed integer line numbers and a string `newContent`, but does NOT
   * guarantee that the line numbers are within the bounds of any particular
   * file (use {@link validateEdits} for that).
   *
   * @param {Object} action - The raw action object to parse.
   * @returns {ParseResult}
   */
  parseDiffAction(action) {
    /** @type {string[]} */
    const errors = [];

    if (action === null || action === undefined || typeof action !== 'object') {
      return { valid: false, edits: [], path: '', errors: ['Action must be a non-null object.'] };
    }

    // --- type ----------------------------------------------------------------
    if (action.type !== 'diff') {
      errors.push(`Expected action type "diff", received "${String(action.type)}".`);
    }

    // --- path ----------------------------------------------------------------
    const path = typeof action.path === 'string' ? action.path.trim() : '';
    if (!path) {
      errors.push('Missing or invalid "path" field (must be a non-empty string).');
    }

    // --- edits ---------------------------------------------------------------
    const rawEdits = Array.isArray(action.edits) ? action.edits : null;
    if (!rawEdits || rawEdits.length === 0) {
      errors.push('Missing or empty "edits" array.');
      return { valid: errors.length === 0, edits: [], path, errors };
    }

    /** @type {DiffEdit[]} */
    const edits = [];

    for (let i = 0; i < rawEdits.length; i++) {
      const raw = rawEdits[i];

      if (raw === null || raw === undefined || typeof raw !== 'object') {
        errors.push(`Edit [${i}]: must be a non-null object.`);
        continue;
      }

      const startLine  = typeof raw.startLine  === 'number' && Number.isInteger(raw.startLine)  ? raw.startLine  : null;
      const endLine    = typeof raw.endLine    === 'number' && Number.isInteger(raw.endLine)    ? raw.endLine    : null;
      const newContent = typeof raw.newContent === 'string'                                      ? raw.newContent : null;

      if (startLine === null) {
        errors.push(`Edit [${i}]: "startLine" must be an integer.`);
      }
      if (endLine === null) {
        errors.push(`Edit [${i}]: "endLine" must be an integer.`);
      }
      if (newContent === null) {
        errors.push(`Edit [${i}]: "newContent" must be a string (use "" for deletions).`);
      }

      if (startLine !== null && endLine !== null && newContent !== null) {
        if (startLine < 1) {
          errors.push(`Edit [${i}]: "startLine" must be >= 1, received ${startLine}.`);
        } else {
          edits.push({ startLine, endLine, newContent });
        }
      }
    }

    return { valid: errors.length === 0, edits, path, errors };
  }

  /**
   * Validate that every edit in a set references line numbers within the
   * bounds of a file that contains `totalLines` lines.
   *
   * This also checks for overlapping edits and reports them as errors.
   *
   * @param {DiffEdit[]} edits     - Edits to validate.
   * @param {number}     totalLines - Number of lines in the target file.
   * @returns {ValidationResult}
   */
  validateEdits(edits, totalLines) {
    /** @type {string[]} */
    const errors = [];

    for (let i = 0; i < edits.length; i++) {
      const { startLine, endLine } = edits[i];
      const isInsert = startLine > endLine;

      if (isInsert) {
        // Inserting after line (startLine - 1).
        // That position must exist or be the file boundary (0 … totalLines).
        if (startLine < 1) {
          errors.push(`Edit [${i}]: INSERT startLine ${startLine} must be >= 1.`);
        } else if (startLine - 1 > totalLines) {
          errors.push(
            `Edit [${i}]: INSERT after line ${startLine - 1} exceeds file length ` +
            `(${totalLines} line${totalLines !== 1 ? 's' : ''}).`
          );
        }
      } else {
        if (totalLines === 0) {
          errors.push(
            `Edit [${i}] [${startLine}–${endLine}]: cannot replace/delete lines in an empty file; ` +
            `use an INSERT (startLine > endLine) instead.`
          );
        } else {
          if (startLine < 1) {
            errors.push(`Edit [${i}]: startLine ${startLine} must be >= 1.`);
          }
          if (endLine > totalLines) {
            errors.push(
              `Edit [${i}]: endLine ${endLine} exceeds file length ` +
              `(${totalLines} line${totalLines !== 1 ? 's' : ''}).`
            );
          }
          if (startLine > endLine + 1) {
            // Non-INSERT with startLine > endLine + 1 is malformed (not a valid
            // INSERT either, since the gap is more than 1).
            errors.push(
              `Edit [${i}]: startLine (${startLine}) is greater than endLine (${endLine}) + 1; ` +
              `this is not a valid INSERT or REPLACE.`
            );
          }
        }
      }
    }

    // Overlap check (all pairs).
    for (let i = 0; i < edits.length; i++) {
      for (let j = i + 1; j < edits.length; j++) {
        if (rangesOverlap(edits[i], edits[j])) {
          errors.push(
            `Edit [${i}] [${edits[i].startLine}–${edits[i].endLine}] overlaps with ` +
            `edit [${j}] [${edits[j].startLine}–${edits[j].endLine}].`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Compute aggregate statistics for a set of diff edits without applying them.
   *
   * - `linesReplaced` counts original lines covered by REPLACE edits (those
   *   with startLine <= endLine and non-empty newContent).
   * - `linesInserted` counts the new lines introduced by INSERT edits.
   * - `linesDeleted` counts original lines removed by DELETE edits (those with
   *   startLine <= endLine and empty newContent).
   *
   * @param {DiffEdit[]} edits - Edits to analyse.
   * @returns {DiffStats}
   */
  getDiffStats(edits) {
    return getDiffStats(edits);
  }

  // ---------------------------------------------------------------------------
  // Static helpers
  // ---------------------------------------------------------------------------

  /**
   * Return a system-prompt fragment that teaches an LLM how to emit diff
   * actions.
   *
   * Include this in the system message of a code-generation conversation so
   * the model knows the exact JSON schema and semantics of the "diff" action
   * type.
   *
   * @returns {string} A multi-line Markdown string.
   */
  static buildSystemPrompt() {
    return buildSystemPrompt();
  }
}
