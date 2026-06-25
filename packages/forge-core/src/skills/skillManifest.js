/**
 * skillManifest.js
 *
 * Skill manifest format + parser. A "skill" is a reusable capability that
 * forge can discover (from GitHub), install, and execute on demand — so forge
 * is no longer limited to its 7 built-in workers.
 *
 * SKILL FORMAT:
 *   A skill is a directory (or GitHub repo) containing:
 *     SKILL.md   — manifest (frontmatter + description, human-readable)
 *     index.js   — ESM module exporting async execute(input) => output
 *
 * SKILL.md frontmatter (YAML between --- fences):
 *   ---
 *   name: pdf-parser
 *   version: 1.0.0
 *   description: Extract text and metadata from PDF files
 *   keywords: [pdf, parse, extract, text, document]
 *   category: document
 *   inputs:
 *     - name: filePath
 *       type: string
 *       required: true
 *       description: Path to the PDF file
 *   outputs:
 *     - name: text
 *       type: string
 *       description: Extracted text content
 *   permissions:
 *     - read-file    # can read files
 *     - network      # can make HTTP requests
 *     # forbidden unless whitelisted: eval, child_process, write-file
 *   author: someone
 *   license: MIT
 *   ---
 *   # PDF Parser
 *   Human-readable description of what this skill does...
 *
 * The parser extracts frontmatter + body. The frontmatter becomes the
 * machine-readable manifest; the body becomes the human description.
 */

/**
 * Parse a SKILL.md file into a manifest object.
 * @param {string} content — raw SKILL.md content
 * @returns {{name, version, description, keywords, category, inputs, outputs, permissions, author, license, body, valid, errors}}
 */
export function parseSkillManifest(content) {
  const result = {
    name: null,
    version: null,
    description: null,
    keywords: [],
    category: null,
    inputs: [],
    outputs: [],
    permissions: [],
    author: null,
    license: null,
    body: "",
    valid: false,
    errors: [],
  };

  if (!content || typeof content !== "string") {
    result.errors.push("empty content");
    return result;
  }

  // Extract YAML frontmatter (between leading --- and next ---)
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!fmMatch) {
    result.errors.push("missing frontmatter (must start with ---)");
    result.body = content;
    return result;
  }

  const yamlBlock = fmMatch[1];
  result.body = fmMatch[2].trim();

  // Parse YAML frontmatter (lightweight — handles key: value + key: [list] + nested)
  const parsed = parseSimpleYaml(yamlBlock);

  result.name = parsed.name || null;
  result.version = parsed.version || null;
  result.description = parsed.description || null;
  result.keywords = Array.isArray(parsed.keywords) ? parsed.keywords : (parsed.keywords ? [parsed.keywords] : []);
  result.category = parsed.category || null;
  result.inputs = Array.isArray(parsed.inputs) ? parsed.inputs : [];
  result.outputs = Array.isArray(parsed.outputs) ? parsed.outputs : [];
  result.permissions = Array.isArray(parsed.permissions) ? parsed.permissions : [];
  result.author = parsed.author || null;
  result.license = parsed.license || null;

  // Validate required fields
  if (!result.name) result.errors.push("missing required field: name");
  if (!result.description) result.errors.push("missing required field: description");
  if (!result.version) result.version = "0.0.0";
  // Name must be a valid slug
  if (result.name && !/^[a-z0-9-]+$/.test(result.name)) {
    result.errors.push("name must be lowercase alphanumeric with hyphens only");
  }

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Build a SKILL.md content string from a manifest object (inverse of parse).
 */
export function buildSkillManifest(manifest) {
  const lines = ["---"];
  lines.push(`name: ${manifest.name || "unnamed"}`);
  lines.push(`version: ${manifest.version || "0.0.0"}`);
  if (manifest.description) lines.push(`description: ${manifest.description}`);
  if (manifest.keywords?.length) lines.push(`keywords: [${manifest.keywords.join(", ")}]`);
  if (manifest.category) lines.push(`category: ${manifest.category}`);
  if (manifest.permissions?.length) lines.push(`permissions: [${manifest.permissions.join(", ")}]`);
  if (manifest.author) lines.push(`author: ${manifest.author}`);
  if (manifest.license) lines.push(`license: ${manifest.license}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${manifest.name || "Unnamed Skill"}`);
  lines.push("");
  lines.push(manifest.description || "(no description)");
  return lines.join("\n");
}

/**
 * Lightweight YAML parser — handles the subset used in skill frontmatter.
 * Supports: key: value, key: [item, item], and arrays of objects (- name: ...).
 */
function parseSimpleYaml(text) {
  const result = {};
  const lines = text.split("\n");
  let currentArray = null;
  let currentArrayKey = null;

  for (let line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // Array item under a list (- key: value or - value)
    if (line.match(/^\s*-\s+/)) {
      if (currentArray) {
        const val = line.replace(/^\s*-\s+/, "").trim();
        // Check if it's "key: value" (object item) or plain value
        const kvMatch = val.match(/^(\w+):\s*(.*)$/);
        if (kvMatch) {
          // Object item — merge into last array element or create new
          const last = currentArray[currentArray.length - 1];
          if (last && typeof last === "object") {
            last[kvMatch[1]] = parseValue(kvMatch[2]);
          } else {
            currentArray.push({ [kvMatch[1]]: parseValue(kvMatch[2]) });
          }
        } else {
          // Plain value item
          currentArray.push(parseValue(val));
        }
      }
      continue;
    }

    // key: value
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim();
      currentArray = null;
      currentArrayKey = null;

      if (val === "") {
        // Multi-line value (array follows) — start collecting
        currentArray = [];
        currentArrayKey = key;
        result[key] = currentArray;
      } else if (val.startsWith("[") && val.endsWith("]")) {
        // Inline array: [a, b, c]
        result[key] = val.slice(1, -1).split(",").map((s) => parseValue(s.trim())).filter(Boolean);
      } else {
        result[key] = parseValue(val);
      }
    }
  }
  return result;
}

function parseValue(val) {
  if (!val) return "";
  // Remove surrounding quotes
  const unquoted = val.replace(/^["']|["']$/g, "");
  // Boolean
  if (unquoted === "true") return true;
  if (unquoted === "false") return false;
  // Number
  if (/^\d+$/.test(unquoted)) return parseInt(unquoted, 10);
  if (/^\d+\.\d+$/.test(unquoted)) return parseFloat(unquoted);
  return unquoted;
}
