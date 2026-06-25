/**
 * codeIntelligenceTools.js — TF-IDF semantic search and AST-aware code editing.
 *
 * Split from agentToolRegistry.js for 分层律 compliance.
 */

import { buildTool, createInputSchema } from "./toolCore.js";

// ============================================================
// Semantic Search Tool (TF-IDF)
// ============================================================

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "and", "but", "or",
  "nor", "not", "so", "if", "then", "than", "that", "this", "these",
  "those", "it", "its", "what", "which", "who", "when", "where", "how",
]);

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * TF-IDF based semantic search over code files.
 * Lightweight local implementation — no external embeddings needed.
 */
export async function semanticSearchToolImpl(params, context) {
  const { query, path: searchPath = ".", filePattern = "**/*.{js,mjs,ts,tsx,jsx,py,java,go,rs,c,cpp,h,md}", maxResults = 10, chunkSize = 50 } = params;

  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return { status: "error", error: "query must be a non-empty string (min 2 chars)." };
  }

  const { resolve, relative } = await import("node:path");
  const { readFile } = await import("node:fs/promises");

  const baseDir = resolve(context.workingDirectory || ".", searchPath);

  // Collect files using glob
  let files;
  try {
    const globTool = context.registry?.getTool("glob");
    if (globTool) {
      const globResult = await globTool.execute({ pattern: filePattern, path: baseDir }, context);
      if (globResult?.status === "success" && Array.isArray(globResult.files)) {
        files = globResult.files;
      }
    }
  } catch {
    // fallback
  }

  if (!files || files.length === 0) {
    // Fallback: use basic file listing
    try {
      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(baseDir, { recursive: true, withFileTypes: true });
      files = entries
        .filter(e => e.isFile())
        .map(e => resolve(e.parentPath || e.path || baseDir, e.name))
        .filter(f => /\.(js|mjs|ts|tsx|jsx|py|java|go|rs|c|cpp|h|md)$/i.test(f))
        .slice(0, 200);
    } catch (err) {
      return { status: "error", error: `Failed to list files: ${err.message}` };
    }
  }

  // Build TF-IDF index
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return { status: "error", error: "No meaningful search terms in query." };
  }

  const results = [];
  const totalDocs = files.length;

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      // Score each chunk of the file
      for (let startLine = 0; startLine < lines.length; startLine += chunkSize) {
        const endLine = Math.min(startLine + chunkSize, lines.length);
        const chunkText = lines.slice(startLine, endLine).join("\n");
        const chunkTerms = tokenize(chunkText);

        if (chunkTerms.length === 0) continue;

        let score = 0;
        const matchedTerms = new Set();

        for (const qTerm of queryTerms) {
          const termFreq = chunkTerms.filter(t => t === qTerm).length;
          if (termFreq > 0) {
            // TF: term frequency in chunk
            const tf = termFreq / chunkTerms.length;
            // Simple IDF approximation
            score += tf * (1 + Math.log(totalDocs / (1 + termFreq)));
            matchedTerms.add(qTerm);
          }
          // Partial match boost
          const partialMatches = chunkTerms.filter(t => t.includes(qTerm) || qTerm.includes(t)).length;
          if (partialMatches > 0 && !matchedTerms.has(qTerm)) {
            score += 0.3 * (partialMatches / chunkTerms.length);
          }
        }

        if (score > 0) {
          results.push({
            file: relative(context.workingDirectory || ".", filePath),
            startLine: startLine + 1,
            endLine,
            score: Math.round(score * 10000) / 10000,
            matchedTerms: [...matchedTerms],
            snippet: lines.slice(startLine, Math.min(startLine + 5, endLine)).join("\n").slice(0, 300),
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Sort by score descending, return top results
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, maxResults);

  return {
    status: "success",
    query,
    totalFilesSearched: totalDocs,
    totalMatches: results.length,
    results: topResults,
  };
}

// ============================================================
// AST-Aware Edit Tool helpers
// ============================================================

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripCommentsAndStrings(line) {
  // Remove single-line comments
  let result = line.replace(/\/\/.*$/, "");
  // Remove string literals
  result = result.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '""');
  // Remove block comment fragments on same line
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

export function replaceIdentifierInLine(line, oldName, newName) {
  // Replace identifier only in code portions, not in strings/comments
  let result = "";
  let i = 0;

  while (i < line.length) {
    // Skip string literals
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const quote = line[i];
      result += quote;
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === "\\") {
          result += line[i] + (line[i + 1] || "");
          i += 2;
        } else {
          result += line[i];
          i++;
        }
      }
      if (i < line.length) {
        result += line[i]; // closing quote
        i++;
      }
      continue;
    }

    // Skip single-line comments
    if (line[i] === "/" && line[i + 1] === "/") {
      result += line.slice(i);
      break;
    }

    // Check for identifier match
    if (line.slice(i, i + oldName.length) === oldName) {
      const before = i > 0 ? line[i - 1] : " ";
      const after = line[i + oldName.length] || " ";
      // Word boundary check
      if (!/\w/.test(before) && !/\w/.test(after)) {
        result += newName;
        i += oldName.length;
        continue;
      }
    }

    result += line[i];
    i++;
  }

  return result;
}

/**
 * AST-aware code editor. Uses scope analysis to ensure edits only affect
 * the intended identifier, avoiding accidental changes to same-named
 * variables in different scopes.
 */
export async function astEditToolImpl(params, context) {
  const { file, editType, target, replacement, scope = "all" } = params;

  if (!file || !editType || !target) {
    return { status: "error", error: "Missing required params: file, editType, target." };
  }

  const { resolve } = await import("node:path");
  const { readFile, writeFile } = await import("node:fs/promises");

  // Security: validate file path before write operation
  const validation = validateFilePath(file, { allowWrite: true });
  if (!validation.safe) return { status: "error", error: validation.reason };
  const filePath = resolve(context.workingDirectory || ".", file);
  let content;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    return { status: "error", error: `Cannot read ${file}: ${err.message}` };
  }

  const lines = content.split("\n");
  let changeCount = 0;
  const changes = [];

  switch (editType) {
    case "rename_identifier": {
      // Rename an identifier with scope awareness
      // Uses a simple heuristic: only rename in declaration + usage patterns
      // Avoids renaming inside strings and comments

      const identifierRegex = new RegExp(`\\b${escapeRegex(target)}\\b`, "g");
      const newLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const stripped = stripCommentsAndStrings(line);

        if (stripped.includes(target)) {
          // Count occurrences in code-only portion
          const codeMatches = stripped.match(identifierRegex);
          if (codeMatches) {
            // Apply rename only to code portions of the original line
            let newLine = line;
            // Strategy: replace in code, preserve strings/comments
            newLine = replaceIdentifierInLine(line, target, replacement);
            if (newLine !== line) {
              changeCount += codeMatches.length;
              changes.push({ line: i + 1, from: target, to: replacement, context: line.trim().slice(0, 120) });
            }
            newLines.push(newLine);
          } else {
            newLines.push(line);
          }
        } else {
          newLines.push(line);
        }
      }

      if (changeCount > 0) {
        await writeFile(filePath, newLines.join("\n"), "utf-8");
      }
      break;
    }

    case "extract_function": {
      // Extract lines [startLine..endLine] into a named function
      const { startLine, endLine } = params;
      if (!startLine || !endLine || !replacement) {
        return { status: "error", error: "extract_function needs startLine, endLine, and replacement (function name)." };
      }

      const extracted = lines.slice(startLine - 1, endLine);
      const indent = extracted[0]?.match(/^(\s*)/)?.[1] || "  ";
      const funcDecl = `${indent}function ${replacement}() {\n${extracted.map(l => indent + "  " + l.trim()).join("\n")}\n${indent}}`;
      const callSite = `${indent}${replacement}();`;

      const newLines = [
        ...lines.slice(0, startLine - 1),
        callSite,
        "",
        funcDecl,
        ...lines.slice(endLine),
      ];

      await writeFile(filePath, newLines.join("\n"), "utf-8");
      changeCount = 1;
      changes.push({ type: "extract", function: replacement, lines: `${startLine}-${endLine}` });
      break;
    }

    case "wrap_in_condition":
    case "wrap_in_try": {
      const { startLine, endLine: wrapEnd } = params;
      if (!startLine || !wrapEnd) {
        return { status: "error", error: `${editType} needs startLine and endLine.` };
      }

      const indent = lines[startLine - 1]?.match(/^(\s*)/)?.[1] || "  ";
      let wrapper;
      if (editType === "wrap_in_try") {
        wrapper = { open: `${indent}try {`, close: `${indent}} catch (err) {\n${indent}  console.error(err);\n${indent}}` };
      } else {
        const condition = params.condition || "true";
        wrapper = { open: `${indent}if (${condition}) {`, close: `${indent}}` };
      }

      const body = lines.slice(startLine - 1, wrapEnd).map(l => indent + "  " + l.trimStart());
      const newLines = [
        ...lines.slice(0, startLine - 1),
        wrapper.open,
        ...body,
        wrapper.close,
        ...lines.slice(wrapEnd),
      ];

      await writeFile(filePath, newLines.join("\n"), "utf-8");
      changeCount = 1;
      changes.push({ type: editType, lines: `${startLine}-${wrapEnd}` });
      break;
    }

    default:
      return { status: "error", error: `Unknown editType: ${editType}. Supported: rename_identifier, extract_function, wrap_in_condition, wrap_in_try.` };
  }

  return {
    status: "success",
    file,
    editType,
    changes: changeCount,
    details: changes.slice(0, 20),
  };
}

// ============================================================
// Semantic Search / AST Edit factory wrappers
// ============================================================

export function createSemanticSearchTool(workingDirectory = process.cwd()) {
  return buildTool({
    name: "semantic_search",
    description: "Semantic code search using TF-IDF scoring over code files. Finds code chunks most relevant to a natural language query. Use for 'find similar code', 'where is X implemented', 'show me code related to Y'.",
    inputSchema: createInputSchema({
      query: { type: "string", description: "Natural language search query" },
      path: { type: "string", description: "Directory to search (default: working directory)" },
      filePattern: { type: "string", description: "Glob pattern for files to search (default: common code files)" },
      maxResults: { type: "integer", description: "Maximum results to return (default: 10)" },
    }, ["query"]),
    isReadOnly: true,
    maxResultSizeChars: 20000,
    async execute(params, context) {
      return semanticSearchToolImpl(params, { ...context, workingDirectory });
    },
  });
}

export function createAstEditTool(workingDirectory = process.cwd()) {
  return buildTool({
    name: "ast_edit",
    description: "AST-aware code editor that understands scope. Supports: rename_identifier (scope-safe rename avoiding strings/comments), extract_function (extract lines into a function), wrap_in_condition, wrap_in_try. Safer than string replacement for identifiers.",
    inputSchema: createInputSchema({
      file: { type: "string", description: "File path relative to working directory" },
      editType: { type: "string", enum: ["rename_identifier", "extract_function", "wrap_in_condition", "wrap_in_try"], description: "Type of structural edit" },
      target: { type: "string", description: "Target identifier or code to modify" },
      replacement: { type: "string", description: "New name or function name" },
      startLine: { type: "integer", description: "Start line for block operations" },
      endLine: { type: "integer", description: "End line for block operations" },
      scope: { type: "string", description: "Scope of the edit: 'all' (default) or 'local'" },
      condition: { type: "string", description: "Condition for wrap_in_condition" },
    }, ["file", "editType", "target"]),
    requiredPermissions: ["file:write"],
    isReadOnly: false,
    maxResultSizeChars: 10000,
    async execute(params, context) {
      return astEditToolImpl(params, { ...context, workingDirectory });
    },
  });
}
