/**
 * JSON parsing and repair utilities extracted from BaseWorker.
 *
 * These pure functions handle the multi-strategy extraction of action arrays
 * from LLM response text, including balanced-bracket matching, string repair,
 * individual object extraction, and keyword-based fallback.
 */

/**
 * Extract a balanced JSON array starting from position `start` in `text`.
 * Correctly skips over JSON string literals (handling escaped quotes) so
 * that brackets inside strings are not counted toward the balance.
 *
 * @param {string} text
 * @param {number} start — index of the opening '['
 * @returns {string|null} — the matched substring including both brackets, or null
 */
export function extractBalancedArray(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Repair unescaped newlines and tabs inside JSON string values.
 * Walks through the text tracking whether we're inside a JSON string,
 * and escapes any literal newlines/tabs found within strings.
 *
 * @param {string} text — potentially malformed JSON text
 * @returns {string} — repaired JSON text
 */
export function repairJsonStrings(text) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
    if (ch === '"' && !escaped) { inString = !inString; result += ch; continue; }
    if (inString) {
      if (ch === '\n') result += '\\n';
      else if (ch === '\r') result += '\\r';
      else if (ch === '\t') result += '\\t';
      else result += ch;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Validate an array of candidate action objects. Only objects whose `type`
 * is in the worker's tool list are kept. Mutation action types (write/edit)
 * are prioritized to the front of the result list.
 *
 * @param {Array} arr — parsed JSON array
 * @param {string[]} tools — available tool names
 * @returns {Array} — validated action objects
 */
export function validateActions(arr, tools) {
  const writes = [];
  const others = [];
  if (!Array.isArray(arr)) return [];
  for (const item of arr) {
    if (item && typeof item === 'object' && item.type && tools.includes(item.type)) {
      if (item.type === 'write' || item.type === 'edit') writes.push(item);
      else others.push(item);
    }
  }
  return [...writes, ...others];
}

/**
 * Try to extract individual JSON action objects from the text when a
 * top-level array cannot be parsed. Looks for `{...}` blocks that contain
 * a recognised "type" key.
 *
 * @param {string} text — cleaned LLM response text
 * @param {string[]} tools — available tool names
 * @returns {Array} — extracted action objects (may be empty)
 */
export function extractIndividualActions(text, tools) {
  const writeActions = [];
  const otherActions = [];
  const seen = new Set();
  const typePattern = /\{\s*["']type["']\s*:\s*["'](write|edit|read|bash)["']/gi;
  let match;

  while ((match = typePattern.exec(text)) !== null) {
    const braceStart = match.index;
    let depth = 0, inStr = false, esc = false, end = -1;

    for (let i = braceStart; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }

    if (end < 0 || seen.has(braceStart)) continue;
    seen.add(braceStart);

    const jsonStr = text.slice(braceStart, end + 1);
    const actionType = match[1].toLowerCase();
    const isMutationAction = actionType === 'write' || actionType === 'edit';

    let parsed = false;
    try {
      const obj = JSON.parse(jsonStr);
      if (obj && obj.type && tools.includes(obj.type)) {
        if (isMutationAction) writeActions.push(obj); else otherActions.push(obj);
        parsed = true;
      }
    } catch { /* will try repairs below */ }

    if (parsed) continue;

    try {
      const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1').replace(/\t/g, '\\t');
      const obj = JSON.parse(fixed);
      if (obj && obj.type && tools.includes(obj.type)) {
        if (isMutationAction) writeActions.push(obj); else otherActions.push(obj);
        parsed = true;
      }
    } catch { /* will try deeper repair */ }

    if (parsed) continue;

    if (isMutationAction) {
      try {
        const repaired = repairJsonStrings(jsonStr);
        const fixed2 = repaired.replace(/,\s*([}\]])/g, '$1').replace(/\t/g, '\\t');
        const obj = JSON.parse(fixed2);
        if (obj && obj.type && tools.includes(obj.type)) {
          if (isMutationAction) writeActions.push(obj); else otherActions.push(obj);
        }
      } catch { /* skip this object */ }
    }
  }

  return [...writeActions, ...otherActions];
}

/**
 * Last-resort fallback: extract write/edit actions from semi-structured text
 * using keyword patterns. Handles cases where the LLM describes its intended
 * actions in natural language rather than producing valid JSON.
 *
 * @param {string} text — cleaned LLM response text
 * @returns {Array} — extracted action objects (may be empty)
 */
export function fallbackKeywordExtraction(text) {
  const actions = [];
  const writePattern = /(?:write|create|new file)[:\s]+[`"]?([\w./\\-]+\.\w+)[`"]?\s*[:\n]\s*```[\w]*\n([\s\S]*?)```/gi;
  let m;
  while ((m = writePattern.exec(text)) !== null) {
    actions.push({ type: 'write', path: m[1], content: m[2] });
  }

  if (actions.length === 0) {
    const fileBlockPattern = /(?:^|\n)\s*(?:\/\/|#|###?)\s*([\w./\\-]+\.\w+)\s*\n+```[\w]*\n([\s\S]*?)```/g;
    while ((m = fileBlockPattern.exec(text)) !== null) {
      actions.push({ type: 'write', path: m[1], content: m[2] });
    }
  }

  return actions;
}

/**
 * Multi-strategy response parser: extract actions and summary from LLM text.
 *
 * Strategies (in order):
 *   A1-A3: Balanced bracket extraction with JSON parse + repair
 *   B1:    Single object wrap
 *   B2:    Full-text parse with repair
 *   B3:    Individual `{...}` block extraction
 *   Step 4: Individual object extraction via regex
 *   Step 5: Keyword-based fallback
 *
 * @param {string} response — raw LLM response text
 * @param {string[]} tools — available tool names
 * @param {{ info: function(string): void }} logger — logger with info method
 * @returns {{ actions: Array, summary: string }}
 */
export function parseResponse(response, tools, logger) {
  const actions = [];
  let summary = '';

  // --- Step 1: Smart markdown fence stripping ---
  let cleaned = response;
  cleaned = cleaned.replace(/```(?:json|JSON|javascript|js|ts|typescript)\s*\n?/g, '');
  cleaned = cleaned.replace(/\n```\s*(?:\n|$)/g, '\n');
  cleaned = cleaned.replace(/^```\s*\n?/, '');
  cleaned = cleaned.replace(/\n?```\s*$/, '\n');

  // --- Step 2: Extract summary ---
  const summaryMatch = cleaned.match(/---SUMMARY---\s*([\s\S]*?)\s*---END---/);
  if (summaryMatch) summary = summaryMatch[1].trim();

  // --- Step 3: Extract JSON array using balanced bracket matching ---
  const withoutSummary = cleaned.replace(/---SUMMARY---[\s\S]*?---END---/, '');

  const strategies = [
    () => {
      const idx = withoutSummary.indexOf('[');
      if (idx < 0) return null;
      return extractBalancedArray(withoutSummary, idx);
    },
    () => {
      const idx = cleaned.indexOf('[');
      if (idx < 0) return null;
      return extractBalancedArray(cleaned, idx);
    },
    () => {
      const searchIn = withoutSummary;
      for (let i = 0; i < searchIn.length; i++) {
        if (searchIn[i] === '[') {
          const candidate = extractBalancedArray(searchIn, i);
          if (candidate) {
            try {
              const parsed = JSON.parse(candidate);
              if (Array.isArray(parsed)) {
                const validated = validateActions(parsed, tools);
                if (validated.length > 0) return candidate;
              }
            } catch { /* try next position */ }
          }
        }
      }
      return null;
    },
  ];

  for (const strategy of strategies) {
    const jsonStr = strategy();
    if (!jsonStr) continue;
    try {
      const parsed = JSON.parse(jsonStr);
      const validated = validateActions(parsed, tools);
      if (validated.length > 0) { actions.push(...validated); break; }
    } catch {
      try {
        const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1').replace(/\t/g, '\\t');
        const parsed = JSON.parse(fixed);
        const validated = validateActions(parsed, tools);
        if (validated.length > 0) { actions.push(...validated); break; }
      } catch {
        try {
          const repaired = repairJsonStrings(jsonStr);
          const fixed2 = repaired.replace(/,\s*([}\]])/g, '$1').replace(/\t/g, '\\t');
          const parsed = JSON.parse(fixed2);
          const validated = validateActions(parsed, tools);
          if (validated.length > 0) { actions.push(...validated); break; }
        } catch { /* try next strategy */ }
      }
    }
  }

  // --- Step 3.5: Advanced repair strategies ---
  if (actions.length === 0) {
    // Strategy B1: Try wrapping a single action object in an array
    try {
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) {
        let repaired = repairJsonStrings(objMatch[0]);
        repaired = repaired.replace(/,\s*([}\]])/g, '$1').replace(/\t/g, '\\t');
        const obj = JSON.parse(repaired);
        if (obj && obj.type && tools.includes(obj.type)) {
          const validated = validateActions([obj], tools);
          if (validated.length > 0) actions.push(...validated);
        }
        if (obj && Array.isArray(obj.actions)) {
          const validated = validateActions(obj.actions, tools);
          if (validated.length > 0) actions.push(...validated);
        }
      }
    } catch { /* continue */ }

    // Strategy B2: Try parsing entire cleaned text as JSON (with repair)
    if (actions.length === 0) {
      try {
        let repaired = repairJsonStrings(cleaned.replace(/---SUMMARY---[\s\S]*?---END---/, '').trim());
        repaired = repaired.replace(/,\s*([}\]])/g, '$1').replace(/\t/g, '\\t');
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed)) {
          const validated = validateActions(parsed, tools);
          if (validated.length > 0) actions.push(...validated);
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.actions)) {
            const validated = validateActions(parsed.actions, tools);
            if (validated.length > 0) actions.push(...validated);
          } else if (parsed.type && tools.includes(parsed.type)) {
            const validated = validateActions([parsed], tools);
            if (validated.length > 0) actions.push(...validated);
          }
        }
      } catch { /* continue */ }
    }

    // Strategy B3: Deep repair on individual `{...}` blocks found via regex
    if (actions.length === 0) {
      const searchIn = withoutSummary.length > 0 ? withoutSummary : cleaned;
      const actionBlocks = [];
      const blockPattern = /\{\s*"type"\s*:\s*"(write|edit|read|bash)"[\s\S]*?\}/gi;
      let bm;
      while ((bm = blockPattern.exec(searchIn)) !== null) {
        let depth = 0, inStr = false, esc = false, end = -1;
        for (let i = bm.index; i < searchIn.length; i++) {
          const ch = searchIn[i];
          if (esc) { esc = false; continue; }
          if (ch === '\\' && inStr) { esc = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end < 0) continue;
        let block = searchIn.slice(bm.index, end + 1);
        try {
          block = repairJsonStrings(block).replace(/,\s*([}\]])/g, '$1').replace(/\t/g, '\\t');
          const obj = JSON.parse(block);
          if (obj && obj.type && tools.includes(obj.type)) actionBlocks.push(obj);
        } catch { /* skip */ }
      }
      if (actionBlocks.length > 0) {
        const validated = validateActions(actionBlocks, tools);
        if (validated.length > 0) actions.push(...validated);
      }
    }
  }

  // --- Step 4: Fallback — extract individual JSON objects ---
  if (actions.length === 0) {
    logger.info(`Array extraction failed, trying individual object extraction...`);
    const extracted = extractIndividualActions(withoutSummary.length > 0 ? withoutSummary : cleaned, tools);
    if (extracted.length > 0) actions.push(...extracted);
  }

  // --- Step 5: Last resort — keyword-based fallback ---
  if (actions.length === 0) {
    logger.info(`Object extraction failed, trying keyword fallback...`);
    const fallback = fallbackKeywordExtraction(cleaned);
    if (fallback.length > 0) actions.push(...fallback);
  }

  return { actions, summary };
}
